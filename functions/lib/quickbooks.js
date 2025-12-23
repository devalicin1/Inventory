/**
 * QuickBooks API Integration
 *
 * This module handles communication with QuickBooks Online API
 * Requires OAuth 2.0 authentication
 */
import admin from 'firebase-admin';
/**
 * Get QuickBooks configuration for a workspace
 */
export async function getQuickBooksConfig(workspaceId) {
    const db = admin.firestore();
    const configDoc = await db.doc(`workspaces/${workspaceId}/settings/quickbooks`).get();
    if (!configDoc.exists) {
        return null;
    }
    return configDoc.data();
}
export async function getQuickBooksAutoSyncConfig(workspaceId) {
    const db = admin.firestore();
    const doc = await db
        .doc(`workspaces/${workspaceId}/settings/quickbooksAutoSync`)
        .get();
    if (!doc.exists) {
        return null;
    }
    const data = doc.data();
    return {
        inventorySyncInterval: data.inventorySyncInterval ?? 'off',
        productImportInterval: data.productImportInterval ?? 'off',
        lastInventorySyncAt: data.lastInventorySyncAt ?? null,
        lastProductImportAt: data.lastProductImportAt ?? null,
    };
}
export async function saveQuickBooksAutoSyncConfig(workspaceId, config) {
    const db = admin.firestore();
    const ref = db.doc(`workspaces/${workspaceId}/settings/quickbooksAutoSync`);
    await ref.set({
        ...(config.inventorySyncInterval !== undefined && {
            inventorySyncInterval: config.inventorySyncInterval,
        }),
        ...(config.productImportInterval !== undefined && {
            productImportInterval: config.productImportInterval,
        }),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
}
/**
 * Save QuickBooks configuration for a workspace
 */
export async function saveQuickBooksConfig(workspaceId, config) {
    const db = admin.firestore();
    const configRef = db.doc(`workspaces/${workspaceId}/settings/quickbooks`);
    await configRef.set({
        ...config,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
}
/**
 * Get OAuth authorization URL
 */
export function getQuickBooksAuthUrl(config) {
    console.log('[getQuickBooksAuthUrl] Config:', {
        clientId: config.clientId ? '***' : 'MISSING',
        redirectUri: config.redirectUri || 'MISSING',
        environment: config.environment,
    });
    if (!config.clientId) {
        throw new Error('Client ID is required');
    }
    if (!config.redirectUri) {
        throw new Error('Redirect URI is required');
    }
    const baseUrl = config.environment === 'sandbox'
        ? 'https://appcenter.intuit.com/connect/oauth2'
        : 'https://appcenter.intuit.com/connect/oauth2';
    const params = new URLSearchParams({
        client_id: config.clientId,
        scope: 'com.intuit.quickbooks.accounting',
        redirect_uri: config.redirectUri,
        response_type: 'code',
        access_type: 'offline',
        // State is required by Intuit; we can use a static value for now or later
        // replace with workspace-specific/random state for CSRF protection
        state: 'inventory-app',
    });
    const authUrl = `${baseUrl}?${params.toString()}`;
    console.log('[getQuickBooksAuthUrl] Generated URL:', authUrl.substring(0, 200) + '...');
    return authUrl;
}
/**
 * Exchange authorization code for access token
 */
export async function exchangeCodeForToken(config, authCode, realmId) {
    const tokenUrl = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';
    const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json',
            'Authorization': `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64')}`,
        },
        body: new URLSearchParams({
            grant_type: 'authorization_code',
            code: authCode,
            redirect_uri: config.redirectUri,
        }),
    });
    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Token exchange failed: ${error}`);
    }
    const data = await response.json();
    return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresIn: data.expires_in,
    };
}
/**
 * Refresh access token using refresh token
 */
export async function refreshAccessToken(config) {
    if (!config.refreshToken) {
        throw new Error('No refresh token available');
    }
    const tokenUrl = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';
    const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json',
            'Authorization': `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64')}`,
        },
        body: new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: config.refreshToken,
        }),
    });
    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Token refresh failed: ${error}`);
    }
    const data = await response.json();
    return {
        accessToken: data.access_token,
        expiresIn: data.expires_in,
    };
}
/**
 * Get valid access token (refresh if needed)
 */
export async function getValidAccessToken(workspaceId) {
    const config = await getQuickBooksConfig(workspaceId);
    if (!config || !config.accessToken) {
        throw new Error('QuickBooks not connected');
    }
    // Check if token is expired (with 5 minute buffer)
    const now = Date.now();
    const expiryTime = (config.tokenExpiry || 0) * 1000;
    const buffer = 5 * 60 * 1000; // 5 minutes
    if (now >= expiryTime - buffer) {
        // Token expired or about to expire, refresh it
        const refreshed = await refreshAccessToken(config);
        const newExpiry = Math.floor(Date.now() / 1000) + refreshed.expiresIn;
        await saveQuickBooksConfig(workspaceId, {
            accessToken: refreshed.accessToken,
            tokenExpiry: newExpiry,
        });
        return refreshed.accessToken;
    }
    return config.accessToken;
}
/**
 * Make API request to QuickBooks
 * - Uses stored access token
 * - On 401 (token expired/revoked) tries one refresh + retry
 */
async function quickBooksRequest(workspaceId, method, endpoint, body) {
    const config = await getQuickBooksConfig(workspaceId);
    if (!config || !config.realmId) {
        throw new Error('QuickBooks not connected');
    }
    const baseUrl = config.environment === 'sandbox'
        ? 'https://sandbox-quickbooks.api.intuit.com'
        : 'https://quickbooks.api.intuit.com';
    const url = `${baseUrl}/v3/company/${config.realmId}${endpoint}`;
    console.log(`[quickBooksRequest] ${method} ${url}`);
    // Helper to actually perform the fetch with given token
    const doFetch = async (token) => {
        return fetch(url, {
            method,
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json',
                'Content-Type': 'application/json',
            },
            body: body ? JSON.stringify(body) : undefined,
        });
    };
    // First attempt with current/valid token
    let accessToken = await getValidAccessToken(workspaceId);
    let response = await doFetch(accessToken);
    // If token is expired/revoked, QuickBooks returns 401 with code 3200
    if (response.status === 401) {
        console.warn('[quickBooksRequest] Received 401, trying to refresh token...');
        try {
            const refreshed = await refreshAccessToken(config);
            const newExpiry = Math.floor(Date.now() / 1000) + refreshed.expiresIn;
            await saveQuickBooksConfig(workspaceId, {
                accessToken: refreshed.accessToken,
                tokenExpiry: newExpiry,
            });
            accessToken = refreshed.accessToken;
            response = await doFetch(accessToken);
        }
        catch (err) {
            console.error('[quickBooksRequest] Token refresh failed:', err?.message || err);
            // If refresh de başarısızsa, kullanıcıdan yeniden bağlantı istenmeli
            throw new Error(`QuickBooks token expired or revoked and refresh failed. Please reconnect QuickBooks from Settings. Details: ${err?.message || err}`);
        }
    }
    if (!response.ok) {
        const errorText = await response.text();
        console.error(`[quickBooksRequest] Error ${response.status}:`, errorText.substring(0, 500));
        throw new Error(`QuickBooks API error (${response.status}): ${errorText.substring(0, 200)}`);
    }
    const data = await response.json();
    return data;
}
/**
 * Get primary image URL for a QuickBooks item (if any)
 */
async function getQuickBooksItemImageUrl(workspaceId, itemId) {
    try {
        console.log('[getQuickBooksItemImageUrl] Fetching image for item:', itemId);
        const query = encodeURIComponent(`SELECT * FROM Attachable WHERE AttachableRef.EntityRef.Id = '${itemId}'`);
        const response = await quickBooksRequest(workspaceId, 'GET', `/query?query=${query}&minorversion=75`);
        console.log('[getQuickBooksItemImageUrl] Raw response:', JSON.stringify(response).substring(0, 500));
        const attachables = response?.QueryResponse?.Attachable;
        if (!attachables)
            return null;
        const list = Array.isArray(attachables) ? attachables : [attachables];
        const first = list[0];
        const url = first?.TempDownloadUri ||
            first?.FileAccessUri ||
            first?.ContentUrl ||
            null;
        return url || null;
    }
    catch (err) {
        console.error('[getQuickBooksItemImageUrl] Error fetching image:', err);
        return null;
    }
}
/**
 * Sync product to QuickBooks as Item
 */
export async function syncProductToQuickBooks(workspaceId, product, quickBooksItemId) {
    const item = {
        Name: product.name,
        Type: 'Inventory',
        Sku: product.sku,
        QtyOnHand: product.qtyOnHand || 0,
        UnitPrice: product.pricePerBox || 0,
    };
    if (quickBooksItemId) {
        item.Id = quickBooksItemId;
        // Update existing item
        const response = await quickBooksRequest(workspaceId, 'POST', `/item?minorversion=75`, item);
        return response.Item.Id;
    }
    else {
        // Create new item
        const response = await quickBooksRequest(workspaceId, 'POST', `/item?minorversion=75`, item);
        return response.Item.Id;
    }
}
/**
 * Get QuickBooks items
 */
export async function getQuickBooksItems(workspaceId) {
    try {
        const query = encodeURIComponent('SELECT * FROM Item MAXRESULTS 1000');
        const response = await quickBooksRequest(workspaceId, 'GET', `/query?query=${query}&minorversion=75`);
        console.log('[getQuickBooksItems] Response:', JSON.stringify(response).substring(0, 500));
        const items = response?.QueryResponse?.Item;
        if (!items) {
            console.log('[getQuickBooksItems] No items found in response');
            return [];
        }
        const normalized = Array.isArray(items) ? items : [items];
        console.log(`[getQuickBooksItems] Found ${normalized.length} items`);
        return normalized;
    }
    catch (error) {
        console.error('[getQuickBooksItems] Error:', error);
        throw new Error(`Failed to fetch QuickBooks items: ${error.message || 'Unknown error'}`);
    }
}
/**
 * Create invoice in QuickBooks
 */
export async function createQuickBooksInvoice(workspaceId, invoice) {
    const response = await quickBooksRequest(workspaceId, 'POST', `/invoice?minorversion=75`, invoice);
    return response.Invoice.Id;
}
/**
 * Import products from QuickBooks to Inventory
 * If allowedSkus is provided, only those SKUs will be imported.
 */
export async function importProductsFromQuickBooks(workspaceId, allowedSkus) {
    console.log(`[importProductsFromQuickBooks] Starting import for workspace: ${workspaceId}`);
    console.log('[importProductsFromQuickBooks] allowedSkus:', allowedSkus);
    const db = admin.firestore();
    const startedAt = admin.firestore.FieldValue.serverTimestamp();
    try {
        // Step 1: Get items from QuickBooks
        console.log('[importProductsFromQuickBooks] Step 1: Fetching items from QuickBooks...');
        const items = await getQuickBooksItems(workspaceId);
        console.log(`[importProductsFromQuickBooks] Step 1 complete: Found ${items.length} items`);
        if (!Array.isArray(items)) {
            throw new Error(`Expected array but got ${typeof items}`);
        }
        let imported = 0;
        let updated = 0;
        let skipped = 0;
        let errors = 0;
        console.log(`[importProductsFromQuickBooks] Step 2: Processing ${items.length} items...`);
        const allowedSet = allowedSkus && allowedSkus.length > 0
            ? new Set(allowedSkus.map(s => String(s).trim()))
            : null;
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            console.log(`[importProductsFromQuickBooks] Processing item ${i + 1}/${items.length}: ${item?.Name || 'Unknown'}`);
            // Only import Inventory type items
            if (!item || item.Type !== 'Inventory' || !item.Sku || !item.Name) {
                console.log(`[importProductsFromQuickBooks] Skipping item (invalid type/SKU/name): Type=${item?.Type}, SKU=${item?.Sku}, Name=${item?.Name}`);
                skipped++;
                continue;
            }
            const sku = String(item.Sku || '').trim();
            // If user selected specific SKUs, skip others
            if (allowedSet && !allowedSet.has(sku)) {
                console.log(`[importProductsFromQuickBooks] Skipping item not in allowedSkus: SKU=${sku}`);
                skipped++;
                continue;
            }
            try {
                // Check if product already exists by SKU
                console.log(`[importProductsFromQuickBooks] Checking if product exists: SKU=${sku}`);
                const existingQuery = db.collection(`workspaces/${workspaceId}/products`)
                    .where('sku', '==', sku)
                    .limit(1);
                const existingSnap = await existingQuery.get();
                // Try to fetch image URL once per item
                let imageUrl = null;
                if (item.Id) {
                    imageUrl = await getQuickBooksItemImageUrl(workspaceId, String(item.Id));
                }
                if (!existingSnap.empty) {
                    const existingDoc = existingSnap.docs[0];
                    const existingData = existingDoc.data();
                    const updates = {};
                    const newName = String(item.Name || '').trim();
                    const newPrice = Number(item.UnitPrice) || 0;
                    const newReorderPoint = Number(item.ReorderPoint) || 0;
                    const newQbId = item.Id ? String(item.Id) : null;
                    const newImageUrl = imageUrl || existingData.imageUrl || null;
                    if (newName && newName !== (existingData.name || '')) {
                        updates.name = newName;
                    }
                    if (existingData.pricePerBox === undefined || existingData.pricePerBox !== newPrice) {
                        updates.pricePerBox = newPrice;
                    }
                    if (existingData.reorderPoint === undefined ||
                        existingData.reorderPoint !== newReorderPoint) {
                        updates.reorderPoint = newReorderPoint;
                    }
                    if (newQbId && existingData.quickBooksItemId !== newQbId) {
                        updates.quickBooksItemId = newQbId;
                    }
                    if (newImageUrl && existingData.imageUrl !== newImageUrl) {
                        updates.imageUrl = newImageUrl;
                    }
                    if (Object.keys(updates).length > 0) {
                        updates.updatedAt = admin.firestore.FieldValue.serverTimestamp();
                        updates.quickBooksLastSyncAt = admin.firestore.FieldValue.serverTimestamp();
                        await existingDoc.ref.update(updates);
                        updated++;
                    }
                    else {
                        skipped++;
                    }
                    continue;
                }
                // Create new product
                console.log(`[importProductsFromQuickBooks] Creating product: ${item.Name} (${sku})`);
                const productData = {
                    name: String(item.Name || '').trim(),
                    sku,
                    uom: 'unit', // Default UOM, can be customized
                    minStock: 0,
                    reorderPoint: Number(item.ReorderPoint) || 0,
                    status: 'active',
                    groupId: null,
                    quantityBox: Number(item.QtyOnHand) || 0,
                    pricePerBox: Number(item.UnitPrice) || 0,
                    quickBooksItemId: item.Id ? String(item.Id) : null,
                    imageUrl: imageUrl || null,
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                    quickBooksLastSyncAt: admin.firestore.FieldValue.serverTimestamp(),
                };
                // Validate required fields
                if (!productData.name || !productData.sku) {
                    console.error(`[importProductsFromQuickBooks] Invalid product data:`, productData);
                    errors++;
                    continue;
                }
                const productRef = await db.collection(`workspaces/${workspaceId}/products`).add(productData);
                const productId = productRef.id;
                console.log(`[importProductsFromQuickBooks] Product created: ${productId}`);
                // If there's initial quantity, create stock transaction
                const qty = Number(item.QtyOnHand) || 0;
                if (qty > 0) {
                    console.log(`[importProductsFromQuickBooks] Creating stock transaction: qty=${qty}`);
                    await db.collection(`workspaces/${workspaceId}/stockTxns`).add({
                        workspaceId,
                        timestamp: admin.firestore.FieldValue.serverTimestamp(),
                        type: 'Receive',
                        productId,
                        qty: qty,
                        userId: 'system',
                        reason: 'Imported from QuickBooks',
                    });
                }
                imported++;
            }
            catch (error) {
                console.error(`[importProductsFromQuickBooks] Error importing product ${item.Name} (${sku}):`, error);
                console.error(`[importProductsFromQuickBooks] Error stack:`, error.stack);
                errors++;
            }
        }
        console.log(`[importProductsFromQuickBooks] Completed: ${imported} imported, ${updated} updated, ${skipped} skipped, ${errors} errors`);
        // Log operation under workspace (manual trigger by default)
        await db.collection(`workspaces/${workspaceId}/quickbooksLogs`).add({
            type: 'product_import',
            trigger: 'manual',
            status: errors > 0 ? 'failed' : 'success',
            startedAt,
            finishedAt: admin.firestore.FieldValue.serverTimestamp(),
            imported,
            updated,
            skipped,
            errors,
            filteredBySkus: !!allowedSkus && allowedSkus.length > 0,
            allowedSkus: allowedSkus ?? [],
            totalItemsFromQuickBooks: items.length,
        });
        return { imported, updated, skipped, errors };
    }
    catch (error) {
        console.error('[importProductsFromQuickBooks] Fatal error:', error);
        console.error('[importProductsFromQuickBooks] Error stack:', error.stack);
        console.error('[importProductsFromQuickBooks] Error message:', error.message);
        // Log failed operation
        await db.collection(`workspaces/${workspaceId}/quickbooksLogs`).add({
            type: 'product_import',
            trigger: 'manual',
            startedAt,
            finishedAt: admin.firestore.FieldValue.serverTimestamp(),
            status: 'failed',
            errorMessage: error.message || 'Unknown error',
            allowedSkus: allowedSkus ?? [],
        });
        throw new Error(`Failed to import products from QuickBooks: ${error.message || 'Unknown error'}`);
    }
}
/**
 * Sync inventory levels from QuickBooks
 */
export async function syncInventoryFromQuickBooks(workspaceId) {
    const db = admin.firestore();
    const startedAt = admin.firestore.FieldValue.serverTimestamp();
    const items = await getQuickBooksItems(workspaceId);
    let matched = 0;
    let updated = 0;
    let unchanged = 0;
    for (const item of items) {
        if (item.Type === 'Inventory' && item.Sku) {
            // Find product by SKU and update qtyOnHand
            const productsQuery = db.collection(`workspaces/${workspaceId}/products`)
                .where('sku', '==', item.Sku)
                .limit(1);
            const productsSnap = await productsQuery.get();
            if (!productsSnap.empty) {
                matched++;
                const productDoc = productsSnap.docs[0];
                const currentData = productDoc.data();
                const newQty = item.QtyOnHand ?? 0;
                const currentQty = currentData.quantityBox ??
                    currentData.qtyOnHand ??
                    0;
                // Update if quantity changed
                if (newQty !== currentQty) {
                    updated++;
                    const diff = newQty - currentQty;
                    // Update product base quantity
                    await productDoc.ref.update({
                        quantityBox: newQty,
                        quickBooksItemId: item.Id,
                        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                        quickBooksLastSyncAt: admin.firestore.FieldValue.serverTimestamp(),
                    });
                    // Create stock transaction to keep history consistent
                    if (diff !== 0) {
                        await db.collection(`workspaces/${workspaceId}/stockTxns`).add({
                            workspaceId,
                            timestamp: admin.firestore.FieldValue.serverTimestamp(),
                            type: diff > 0 ? 'Receive' : 'Issue',
                            productId: productDoc.id,
                            qty: Math.abs(diff),
                            userId: 'system',
                            reason: 'Synced inventory from QuickBooks',
                        });
                    }
                }
                else {
                    unchanged++;
                }
            }
        }
    }
    await db.collection(`workspaces/${workspaceId}/quickbooksLogs`).add({
        type: 'inventory_sync',
        trigger: 'manual',
        status: 'success',
        startedAt,
        finishedAt: admin.firestore.FieldValue.serverTimestamp(),
        totalItemsFromQuickBooks: items.length,
        matchedProducts: matched,
        updatedProducts: updated,
        unchangedProducts: unchanged,
    });
}
