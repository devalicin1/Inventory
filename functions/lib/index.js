import * as admin from 'firebase-admin';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { onCall, onRequest } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { setGlobalOptions } from 'firebase-functions/v2/options';
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
