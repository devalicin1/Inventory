import admin from 'firebase-admin';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { onCall, onRequest } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { setGlobalOptions } from 'firebase-functions/v2/options';
import { getQuickBooksConfig as getQBConfig, saveQuickBooksConfig as saveQBConfig, getQuickBooksAuthUrl as getQBAuthUrl, exchangeCodeForToken, syncProductToQuickBooks as syncProductToQB, getQuickBooksItems as getQBItems, createQuickBooksInvoice as createQBInvoice, syncInventoryFromQuickBooks as syncInventoryFromQB, importProductsFromQuickBooks as importProductsFromQB, getQuickBooksAutoSyncConfig, saveQuickBooksAutoSyncConfig, } from './quickbooks.js';
admin.initializeApp();
setGlobalOptions({ region: 'us-central1', maxInstances: 10 });
export const onStockTxnWrite = onDocumentCreated('workspaces/{wId}/stockTxns/{txnId}', async (event) => {
    const wId = event.params.wId;
    const snap = event.data;
    if (!snap)
        return;
    const txn = snap.data();
    const db = admin.firestore();
    // Basic validation
    if (txn.workspaceId !== wId) {
        console.warn('Workspace mismatch in txn', wId);
        return;
    }
    if (!Number.isFinite(txn.qty) || txn.qty === 0)
        return;
    // Determine stock document key by product/location/batch/serial
    const stockIdParts = [txn.productId, txn.toLoc || txn.fromLoc || ''];
    if (txn.batchId)
        stockIdParts.push(`b:${txn.batchId}`);
    if (txn.serialId)
        stockIdParts.push(`s:${txn.serialId}`);
    const stockId = stockIdParts.join('_');
    const stockRef = db.doc(`workspaces/${wId}/stock/${stockId}`);
    await db.runTransaction(async (t) => {
        const stockSnap = await t.get(stockRef);
        const exists = stockSnap.exists;
        const doc = (exists ? stockSnap.data() : {});
        const prevQty = Number(doc.qtyOnHand || 0);
        const prevAvgCost = Number(doc.avgCost || 0);
        let deltaQty = txn.qty;
        let newAvgCost = prevAvgCost;
        // Movement semantics
        switch (txn.type) {
            case 'Produce':
            case 'Receive':
            case 'Adjust+':
                // moving average cost update when increasing stock with unitCost
                if (typeof txn.unitCost === 'number' && txn.unitCost >= 0) {
                    const totalCost = prevAvgCost * prevQty + txn.unitCost * Math.abs(txn.qty);
                    const newQty = prevQty + Math.abs(txn.qty);
                    newAvgCost = newQty > 0 ? totalCost / newQty : prevAvgCost;
                }
                deltaQty = Math.abs(txn.qty);
                break;
            case 'Consume':
            case 'Ship':
            case 'Adjust-':
                deltaQty = -Math.abs(txn.qty);
                break;
            case 'Transfer':
                // Treat as + at toLoc and - at fromLoc via two txns on client or higher-level logic
                // Here we assume stockId uses toLoc if present; otherwise fromLoc
                deltaQty = txn.toLoc ? Math.abs(txn.qty) : -Math.abs(txn.qty);
                break;
            case 'Count':
                // Absolute set not supported at stock doc; represent as Adjust+/- externally
                deltaQty = 0;
                break;
        }
        const nextQty = prevQty + deltaQty;
        const payload = {
            workspaceId: wId,
            productId: txn.productId,
            locationId: txn.toLoc || txn.fromLoc || null,
            batchId: txn.batchId || null,
            serialId: txn.serialId || null,
            qtyOnHand: nextQty,
            avgCost: newAvgCost,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            createdAt: exists ? doc.createdAt : admin.firestore.FieldValue.serverTimestamp(),
        };
        if (exists)
            t.update(stockRef, payload);
        else
            t.set(stockRef, payload);
    });
});
export const createProductionOrder = onCall(async (request) => {
    const { workspaceId, productId, plannedQty, bomVersion, dueDate, notes } = request.data;
    const userId = request.auth?.uid;
    if (!userId)
        throw new Error('Unauthenticated');
    const db = admin.firestore();
    const workspaceRef = db.doc(`workspaces/${workspaceId}`);
    const workspace = await workspaceRef.get();
    if (!workspace.exists)
        throw new Error('Workspace not found');
    // Get BOM
    const bomQuery = db.collection(`workspaces/${workspaceId}/boms`)
        .where('productId', '==', productId)
        .where('version', '==', bomVersion)
        .limit(1);
    const bomSnap = await bomQuery.get();
    if (bomSnap.empty)
        throw new Error('BOM not found');
    const bom = bomSnap.docs[0].data();
    // Check component availability
    const shortages = [];
    for (const line of bom.lines || []) {
        const stockQuery = db.collection(`workspaces/${workspaceId}/stock`)
            .where('productId', '==', line.componentId);
        const stockSnap = await stockQuery.get();
        const totalOnHand = stockSnap.docs.reduce((sum, doc) => sum + (doc.data().qtyOnHand || 0), 0);
        const required = line.qtyPer * plannedQty * (1 + (line.scrapPct || 0) / 100);
        if (totalOnHand < required) {
            shortages.push({
                componentId: line.componentId,
                required,
                available: totalOnHand,
                shortfall: required - totalOnHand
            });
        }
    }
    // Generate PO code
    const poCountQuery = db.collection(`workspaces/${workspaceId}/productionOrders`).count();
    const poCount = await poCountQuery.get();
    const code = `PO-${String(poCount.data().count + 1).padStart(4, '0')}`;
    // Create PO
    const poRef = db.collection(`workspaces/${workspaceId}/productionOrders`).doc();
    await poRef.set({
        code,
        productId,
        plannedQty,
        bomVersion,
        dueDate: admin.firestore.Timestamp.fromDate(new Date(dueDate)),
        status: 'Draft',
        notes: notes || '',
        workspaceId,
        createdBy: userId,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    return {
        poId: poRef.id,
        code,
        shortages: shortages.length > 0 ? shortages : null
    };
});
export const completeTask = onCall(async (request) => {
    const { workspaceId, taskId, produceQty, consumeQty } = request.data;
    const userId = request.auth?.uid;
    if (!userId)
        throw new Error('Unauthenticated');
    const db = admin.firestore();
    const taskRef = db.doc(`workspaces/${workspaceId}/tasks/${taskId}`);
    const taskSnap = await taskRef.get();
    if (!taskSnap.exists)
        throw new Error('Task not found');
    const task = taskSnap.data();
    // Update task status
    await taskRef.update({
        status: 'Done',
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    // Create stock transactions if linked to PO/product
    if (task.links?.productId) {
        const productId = task.links.productId;
        const poId = task.links.poId;
        if (produceQty > 0) {
            await db.collection(`workspaces/${workspaceId}/stockTxns`).add({
                workspaceId,
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                type: 'Produce',
                refs: { poId, taskId },
                productId,
                qty: produceQty,
                userId,
                reason: 'Task completion'
            });
        }
        if (consumeQty > 0) {
            await db.collection(`workspaces/${workspaceId}/stockTxns`).add({
                workspaceId,
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                type: 'Consume',
                refs: { poId, taskId },
                productId,
                qty: consumeQty,
                userId,
                reason: 'Task completion'
            });
        }
        // Update PO stage if linked
        if (poId) {
            const poRef = db.doc(`workspaces/${workspaceId}/productionOrders/${poId}`);
            const poSnap = await poRef.get();
            if (poSnap.exists) {
                const po = poSnap.data();
                if (po.status === 'In-Progress') {
                    await poRef.update({
                        status: 'QA',
                        updatedAt: admin.firestore.FieldValue.serverTimestamp()
                    });
                }
            }
        }
    }
    return { success: true };
});
// Stub: Generate barcode/QR PDF and return signed URL (to be implemented later)
export const barcodeLabelPdf = onRequest(async (req, res) => {
    try {
        // Placeholder response; implement real PDF generation later.
        res.status(200).json({ message: 'barcodeLabelPdf not implemented yet' });
    }
    catch (e) {
        res.status(500).json({ error: e?.message || 'Unexpected error' });
    }
});
// Scheduled low-stock watcher: scans stock below min/reorder and logs notifications (stub)
export const lowStockWatcher = onSchedule('every 24 hours', async () => {
    const db = admin.firestore();
    const workspacesSnap = await db.collection('workspaces').get();
    for (const w of workspacesSnap.docs) {
        const wId = w.id;
        const productsSnap = await db.collection(`workspaces/${wId}/products`).get();
        const stockSnap = await db.collection(`workspaces/${wId}/stock`).get();
        const productIdToMin = {};
        for (const p of productsSnap.docs) {
            const d = p.data();
            productIdToMin[p.id] = Number(d.minStock || 0);
        }
        const low = [];
        const onHandByProduct = {};
        for (const s of stockSnap.docs) {
            const d = s.data();
            const pid = d.productId;
            onHandByProduct[pid] = (onHandByProduct[pid] || 0) + Number(d.qtyOnHand || 0);
        }
        for (const [pid, onHand] of Object.entries(onHandByProduct)) {
            const min = productIdToMin[pid] || 0;
            if (onHand < min)
                low.push({ productId: pid, onHand, min });
        }
        if (low.length) {
            await db.collection(`workspaces/${wId}/notifications`).add({
                type: 'lowStock',
                items: low,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
        }
    }
});
// ===== QUICKBOOKS INTEGRATION =====
/**
 * Get QuickBooks authorization URL
 */
export const getQuickBooksAuthUrl = onCall(async (request) => {
    const { workspaceId } = request.data;
    const userId = request.auth?.uid;
    if (!userId)
        throw new Error('Unauthenticated');
    if (!workspaceId)
        throw new Error('workspaceId is required');
    console.log('[getQuickBooksAuthUrl] Request for workspace:', workspaceId);
    const config = await getQBConfig(workspaceId);
    if (!config) {
        throw new Error('QuickBooks not configured. Please set up client ID and secret first.');
    }
    console.log('[getQuickBooksAuthUrl] Config loaded:', {
        hasClientId: !!config.clientId,
        hasRedirectUri: !!config.redirectUri,
        environment: config.environment,
    });
    if (!config.redirectUri) {
        throw new Error('Redirect URI is missing. Please configure it in Settings.');
    }
    const authUrl = getQBAuthUrl(config);
    console.log('[getQuickBooksAuthUrl] Returning auth URL');
    return { authUrl };
});
/**
 * Handle QuickBooks OAuth callback
 */
export const quickBooksOAuthCallback = onCall(async (request) => {
    const { workspaceId, authCode, realmId } = request.data;
    const userId = request.auth?.uid;
    if (!userId)
        throw new Error('Unauthenticated');
    if (!workspaceId || !authCode || !realmId) {
        throw new Error('workspaceId, authCode, and realmId are required');
    }
    const config = await getQBConfig(workspaceId);
    if (!config) {
        throw new Error('QuickBooks not configured');
    }
    const tokens = await exchangeCodeForToken(config, authCode, realmId);
    const tokenExpiry = Math.floor(Date.now() / 1000) + tokens.expiresIn;
    await saveQBConfig(workspaceId, {
        realmId,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        tokenExpiry,
    });
    return { success: true };
});
/**
 * Save QuickBooks configuration
 */
export const saveQuickBooksConfig = onCall(async (request) => {
    const { workspaceId, config } = request.data;
    const userId = request.auth?.uid;
    if (!userId)
        throw new Error('Unauthenticated');
    if (!workspaceId)
        throw new Error('workspaceId is required');
    console.log('[saveQuickBooksConfig] Saving config:', {
        workspaceId,
        hasClientId: !!config?.clientId,
        hasClientSecret: !!config?.clientSecret,
        redirectUri: config?.redirectUri || 'MISSING',
        environment: config?.environment,
    });
    if (!config?.redirectUri) {
        console.warn('[saveQuickBooksConfig] WARNING: redirectUri is missing!');
    }
    await saveQBConfig(workspaceId, config);
    console.log('[saveQuickBooksConfig] Config saved successfully');
    return { success: true };
});
/**
 * Get QuickBooks configuration
 */
export const getQuickBooksConfig = onCall(async (request) => {
    const { workspaceId } = request.data;
    const userId = request.auth?.uid;
    if (!userId)
        throw new Error('Unauthenticated');
    if (!workspaceId)
        throw new Error('workspaceId is required');
    const config = await getQBConfig(workspaceId);
    if (!config) {
        return { connected: false };
    }
    // Check if connection is complete (realmId and accessToken are required)
    const isConnected = !!(config.realmId && config.accessToken);
    // Don't return sensitive tokens to client
    return {
        connected: isConnected,
        environment: config.environment,
        realmId: config.realmId,
    };
});
/**
 * Sync product to QuickBooks
 */
export const syncProductToQuickBooks = onCall(async (request) => {
    const { workspaceId, product, quickBooksItemId } = request.data;
    const userId = request.auth?.uid;
    if (!userId)
        throw new Error('Unauthenticated');
    if (!workspaceId || !product) {
        throw new Error('workspaceId and product are required');
    }
    const itemId = await syncProductToQB(workspaceId, product, quickBooksItemId);
    return { itemId };
});
/**
 * Import products from QuickBooks
 */
export const importProductsFromQuickBooks = onCall(async (request) => {
    console.log('[importProductsFromQuickBooks] Function called');
    console.log('[importProductsFromQuickBooks] Request data:', JSON.stringify(request.data));
    const { workspaceId, skus } = request.data;
    const userId = request.auth?.uid;
    console.log('[importProductsFromQuickBooks] workspaceId:', workspaceId);
    console.log('[importProductsFromQuickBooks] userId:', userId);
    if (!userId) {
        console.error('[importProductsFromQuickBooks] Unauthenticated request');
        throw new Error('Unauthenticated');
    }
    if (!workspaceId) {
        console.error('[importProductsFromQuickBooks] Missing workspaceId');
        throw new Error('workspaceId is required');
    }
    try {
        console.log('[importProductsFromQuickBooks] Starting import...');
        const result = await importProductsFromQB(workspaceId, skus);
        console.log('[importProductsFromQuickBooks] Import completed:', JSON.stringify(result));
        return result;
    }
    catch (error) {
        console.error('[importProductsFromQuickBooks] Error in function:', error);
        console.error('[importProductsFromQuickBooks] Error stack:', error.stack);
        console.error('[importProductsFromQuickBooks] Error message:', error.message);
        throw error;
    }
});
/**
 * Sync inventory from QuickBooks
 */
export const syncInventoryFromQuickBooks = onCall(async (request) => {
    const { workspaceId } = request.data;
    const userId = request.auth?.uid;
    if (!userId)
        throw new Error('Unauthenticated');
    if (!workspaceId)
        throw new Error('workspaceId is required');
    await syncInventoryFromQB(workspaceId);
    return { success: true };
});
/**
 * Get QuickBooks logs (recent activity)
 */
export const getQuickBooksLogs = onCall(async (request) => {
    const { workspaceId, limit = 20 } = request.data;
    const userId = request.auth?.uid;
    if (!userId)
        throw new Error('Unauthenticated');
    if (!workspaceId)
        throw new Error('workspaceId is required');
    const db = admin.firestore();
    const snap = await db
        .collection(`workspaces/${workspaceId}/quickbooksLogs`)
        .orderBy('finishedAt', 'desc')
        .limit(typeof limit === 'number' && limit > 0 ? limit : 20)
        .get();
    const logs = snap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
    }));
    return { logs };
});
/**
 * Get QuickBooks auto-sync configuration
 */
export const getQuickBooksAutoSyncConfigFn = onCall(async (request) => {
    const { workspaceId } = request.data;
    const userId = request.auth?.uid;
    if (!userId)
        throw new Error('Unauthenticated');
    if (!workspaceId)
        throw new Error('workspaceId is required');
    const config = await getQuickBooksAutoSyncConfig(workspaceId);
    // Default config if not set yet
    const effective = config ?? {
        inventorySyncInterval: 'off',
        productImportInterval: 'off',
        lastInventorySyncAt: null,
        lastProductImportAt: null,
    };
    return {
        inventorySyncInterval: effective.inventorySyncInterval,
        productImportInterval: effective.productImportInterval,
        lastInventorySyncAt: effective.lastInventorySyncAt ?? null,
        lastProductImportAt: effective.lastProductImportAt ?? null,
    };
});
/**
 * Save QuickBooks auto-sync configuration
 */
export const saveQuickBooksAutoSyncConfigFn = onCall(async (request) => {
    const { workspaceId, config } = request.data;
    const userId = request.auth?.uid;
    if (!userId)
        throw new Error('Unauthenticated');
    if (!workspaceId)
        throw new Error('workspaceId is required');
    if (!config)
        throw new Error('config is required');
    await saveQuickBooksAutoSyncConfig(workspaceId, config);
    return { success: true };
});
function intervalToMs(interval) {
    switch (interval) {
        case '30m':
            return 30 * 60 * 1000;
        case '1h':
            return 60 * 60 * 1000;
        case '4h':
            return 4 * 60 * 60 * 1000;
        case '1d':
            return 24 * 60 * 60 * 1000;
        case '7d':
            return 7 * 24 * 60 * 60 * 1000;
        case 'off':
        default:
            return null;
    }
}
/**
 * Scheduled driver for QuickBooks auto-sync
 * Runs every 30 minutes and triggers inventory sync / product import
 * based on per-workspace auto-sync configuration.
 */
export const runQuickBooksAutoSync = onSchedule('every 30 minutes', async () => {
    const db = admin.firestore();
    const now = Date.now();
    const workspacesSnap = await db.collection('workspaces').get();
    for (const workspace of workspacesSnap.docs) {
        const workspaceId = workspace.id;
        try {
            const qbConfig = await getQBConfig(workspaceId);
            if (!qbConfig?.accessToken || !qbConfig.realmId) {
                continue;
            }
            const autoSyncConfig = (await getQuickBooksAutoSyncConfig(workspaceId)) ??
                {
                    inventorySyncInterval: 'off',
                    productImportInterval: 'off',
                };
            const inventoryIntervalMs = intervalToMs(autoSyncConfig.inventorySyncInterval);
            const productIntervalMs = intervalToMs(autoSyncConfig.productImportInterval);
            const autoSyncRef = db.doc(`workspaces/${workspaceId}/settings/quickbooksAutoSync`);
            // Inventory sync
            if (inventoryIntervalMs) {
                const last = autoSyncConfig.lastInventorySyncAt?.toMillis?.() ?? 0;
                if (!last || now - last >= inventoryIntervalMs) {
                    const startedAt = admin.firestore.FieldValue.serverTimestamp();
                    try {
                        await syncInventoryFromQB(workspaceId);
                        await autoSyncRef.set({
                            lastInventorySyncAt: admin.firestore.FieldValue.serverTimestamp(),
                            inventorySyncInterval: autoSyncConfig.inventorySyncInterval,
                        }, { merge: true });
                        await db.collection(`workspaces/${workspaceId}/quickbooksLogs`).add({
                            type: 'inventory_sync',
                            trigger: 'auto',
                            status: 'success',
                            startedAt,
                            finishedAt: admin.firestore.FieldValue.serverTimestamp(),
                        });
                    }
                    catch (error) {
                        console.error('[runQuickBooksAutoSync] Inventory sync failed for workspace', workspaceId, error);
                        await db.collection(`workspaces/${workspaceId}/quickbooksLogs`).add({
                            type: 'inventory_sync',
                            trigger: 'auto',
                            status: 'failed',
                            startedAt,
                            finishedAt: admin.firestore.FieldValue.serverTimestamp(),
                            errorMessage: error?.message || String(error),
                        });
                    }
                }
            }
            // Product import (full, without SKU filtering)
            if (productIntervalMs) {
                const last = autoSyncConfig.lastProductImportAt?.toMillis?.() ?? 0;
                if (!last || now - last >= productIntervalMs) {
                    const startedAt = admin.firestore.FieldValue.serverTimestamp();
                    try {
                        const result = await importProductsFromQB(workspaceId);
                        await autoSyncRef.set({
                            lastProductImportAt: admin.firestore.FieldValue.serverTimestamp(),
                            productImportInterval: autoSyncConfig.productImportInterval,
                        }, { merge: true });
                        await db.collection(`workspaces/${workspaceId}/quickbooksLogs`).add({
                            type: 'product_import',
                            trigger: 'auto',
                            status: 'success',
                            startedAt,
                            finishedAt: admin.firestore.FieldValue.serverTimestamp(),
                            imported: result.imported,
                            updated: result.updated,
                            skipped: result.skipped,
                            errors: result.errors,
                        });
                    }
                    catch (error) {
                        console.error('[runQuickBooksAutoSync] Product import failed for workspace', workspaceId, error);
                        await db.collection(`workspaces/${workspaceId}/quickbooksLogs`).add({
                            type: 'product_import',
                            trigger: 'auto',
                            status: 'failed',
                            startedAt,
                            finishedAt: admin.firestore.FieldValue.serverTimestamp(),
                            errorMessage: error?.message || String(error),
                        });
                    }
                }
            }
        }
        catch (err) {
            console.error('[runQuickBooksAutoSync] Error handling workspace', workspaceId, err);
        }
    }
});
/**
 * Get QuickBooks items
 */
export const getQuickBooksItems = onCall(async (request) => {
    const { workspaceId } = request.data;
    const userId = request.auth?.uid;
    if (!userId)
        throw new Error('Unauthenticated');
    if (!workspaceId)
        throw new Error('workspaceId is required');
    try {
        const items = await getQBItems(workspaceId);
        console.log(`[getQuickBooksItems] Returning ${items.length} items`);
        return { items };
    }
    catch (error) {
        console.error('[getQuickBooksItems] Error:', error);
        throw new Error(`Failed to get QuickBooks items: ${error.message || 'Unknown error'}`);
    }
});
/**
 * Create invoice in QuickBooks
 */
export const createQuickBooksInvoice = onCall(async (request) => {
    const { workspaceId, invoice } = request.data;
    const userId = request.auth?.uid;
    if (!userId)
        throw new Error('Unauthenticated');
    if (!workspaceId || !invoice) {
        throw new Error('workspaceId and invoice are required');
    }
    const invoiceId = await createQBInvoice(workspaceId, invoice);
    return { invoiceId };
});
