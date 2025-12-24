/**
 * QuickBooks API Integration
 * 
 * This module handles communication with QuickBooks Online API
 * Requires OAuth 2.0 authentication
 */

import admin from 'firebase-admin'

export interface QuickBooksConfig {
  clientId: string
  clientSecret: string
  redirectUri: string
  environment: 'sandbox' | 'production'
  realmId?: string
  accessToken?: string
  refreshToken?: string
  tokenExpiry?: number
}

export type AutoSyncInterval =
  | 'off'
  | '30m'
  | '1h'
  | '4h'
  | '1d'
  | '7d'

export interface QuickBooksAutoSyncConfig {
  inventorySyncInterval: AutoSyncInterval
  productImportInterval: AutoSyncInterval
  lastInventorySyncAt?: admin.firestore.Timestamp | null
  lastProductImportAt?: admin.firestore.Timestamp | null
}

export interface QuickBooksItem {
  Id?: string
  Name: string
  Type: 'Inventory' | 'Service' | 'NonInventory'
  Sku?: string
  QtyOnHand?: number
  UnitPrice?: number
  PurchaseCost?: number
  ReorderPoint?: number
  ImageUrl?: string
  IncomeAccountRef?: { value: string; name?: string }
  ExpenseAccountRef?: { value: string; name?: string }
  AssetAccountRef?: { value: string; name?: string }
}

export interface QuickBooksInvoice {
  Id?: string
  DocNumber?: string
  TxnDate: string
  DueDate?: string
  CustomerRef: { value: string; name?: string }
  Line: Array<{
    DetailType: 'SalesItemLineDetail'
    Amount: number
    SalesItemLineDetail: {
      ItemRef: { value: string; name?: string }
      UnitPrice: number
      Qty: number
    }
    Description?: string
  }>
}

/**
 * Get QuickBooks configuration for a workspace
 */
export async function getQuickBooksConfig(workspaceId: string): Promise<QuickBooksConfig | null> {
  const db = admin.firestore()
  const configDoc = await db.doc(`workspaces/${workspaceId}/settings/quickbooks`).get()
  
  if (!configDoc.exists) {
    return null
  }
  
  return configDoc.data() as QuickBooksConfig
}

export async function getQuickBooksAutoSyncConfig(
  workspaceId: string
): Promise<QuickBooksAutoSyncConfig | null> {
  const db = admin.firestore()
  const doc = await db
    .doc(`workspaces/${workspaceId}/settings/quickbooksAutoSync`)
    .get()

  if (!doc.exists) {
    return null
  }

  const data = doc.data() as Partial<QuickBooksAutoSyncConfig>

  return {
    inventorySyncInterval: data.inventorySyncInterval ?? 'off',
    productImportInterval: data.productImportInterval ?? 'off',
    lastInventorySyncAt: (data.lastInventorySyncAt as admin.firestore.Timestamp | null) ?? null,
    lastProductImportAt: (data.lastProductImportAt as admin.firestore.Timestamp | null) ?? null,
  }
}

export async function saveQuickBooksAutoSyncConfig(
  workspaceId: string,
  config: Partial<QuickBooksAutoSyncConfig>
): Promise<void> {
  const db = admin.firestore()
  const ref = db.doc(`workspaces/${workspaceId}/settings/quickbooksAutoSync`)

  await ref.set(
    {
      ...(config.inventorySyncInterval !== undefined && {
        inventorySyncInterval: config.inventorySyncInterval,
      }),
      ...(config.productImportInterval !== undefined && {
        productImportInterval: config.productImportInterval,
      }),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  )
}

/**
 * Save QuickBooks configuration for a workspace
 */
export async function saveQuickBooksConfig(
  workspaceId: string,
  config: Partial<QuickBooksConfig>
): Promise<void> {
  const db = admin.firestore()
  const configRef = db.doc(`workspaces/${workspaceId}/settings/quickbooks`)
  
  await configRef.set({
    ...config,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true })
}

/**
 * Get OAuth authorization URL
 */
export function getQuickBooksAuthUrl(config: QuickBooksConfig): string {
  console.log('[getQuickBooksAuthUrl] Config:', {
    clientId: config.clientId ? '***' : 'MISSING',
    redirectUri: config.redirectUri || 'MISSING',
    environment: config.environment,
  })
  
  if (!config.clientId) {
    throw new Error('Client ID is required')
  }
  if (!config.redirectUri) {
    throw new Error('Redirect URI is required')
  }
  
  const baseUrl = config.environment === 'sandbox'
    ? 'https://appcenter.intuit.com/connect/oauth2'
    : 'https://appcenter.intuit.com/connect/oauth2'
  
  const params = new URLSearchParams({
    client_id: config.clientId,
    scope: 'com.intuit.quickbooks.accounting',
    redirect_uri: config.redirectUri,
    response_type: 'code',
    access_type: 'offline',
    // State is required by Intuit; we can use a static value for now or later
    // replace with workspace-specific/random state for CSRF protection
    state: 'inventory-app',
  })
  
  const authUrl = `${baseUrl}?${params.toString()}`
  console.log('[getQuickBooksAuthUrl] Generated URL:', authUrl.substring(0, 200) + '...')
  
  return authUrl
}

/**
 * Exchange authorization code for access token
 */
export async function exchangeCodeForToken(
  config: QuickBooksConfig,
  authCode: string,
  realmId: string
): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
  const tokenUrl = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer'
  
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
  })
  
  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Token exchange failed: ${error}`)
  }
  
  const data = await response.json()
  
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
  }
}

/**
 * Refresh access token using refresh token
 */
export async function refreshAccessToken(
  config: QuickBooksConfig
): Promise<{ accessToken: string; expiresIn: number }> {
  if (!config.refreshToken) {
    throw new Error('No refresh token available')
  }
  
  const tokenUrl = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer'
  
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
  })
  
  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Token refresh failed: ${error}`)
  }
  
  const data = await response.json()
  
  return {
    accessToken: data.access_token,
    expiresIn: data.expires_in,
  }
}

/**
 * Get valid access token (refresh if needed)
 */
export async function getValidAccessToken(
  workspaceId: string
): Promise<string> {
  const config = await getQuickBooksConfig(workspaceId)
  if (!config || !config.accessToken) {
    throw new Error('QuickBooks not connected')
  }
  
  // Check if token is expired (with 5 minute buffer)
  const now = Date.now()
  const expiryTime = (config.tokenExpiry || 0) * 1000
  const buffer = 5 * 60 * 1000 // 5 minutes
  
  if (now >= expiryTime - buffer) {
    // Token expired or about to expire, refresh it
    const refreshed = await refreshAccessToken(config)
    const newExpiry = Math.floor(Date.now() / 1000) + refreshed.expiresIn
    
    await saveQuickBooksConfig(workspaceId, {
      accessToken: refreshed.accessToken,
      tokenExpiry: newExpiry,
    })
    
    return refreshed.accessToken
  }
  
  return config.accessToken
}

/**
 * Make API request to QuickBooks
 * - Uses stored access token
 * - On 401 (token expired/revoked) tries one refresh + retry
 */
async function quickBooksRequest(
  workspaceId: string,
  method: string,
  endpoint: string,
  body?: any
): Promise<any> {
  const config = await getQuickBooksConfig(workspaceId)
  if (!config || !config.realmId) {
    throw new Error('QuickBooks not connected')
  }
  
  const baseUrl = config.environment === 'sandbox'
    ? 'https://sandbox-quickbooks.api.intuit.com'
    : 'https://quickbooks.api.intuit.com'
  
  const url = `${baseUrl}/v3/company/${config.realmId}${endpoint}`
  console.log(`[quickBooksRequest] ${method} ${url}`)

  // Helper to actually perform the fetch with given token
  const doFetch = async (token: string) => {
    return fetch(url, {
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    })
  }

  // First attempt with current/valid token
  let accessToken = await getValidAccessToken(workspaceId)
  let response = await doFetch(accessToken)

  // If token is expired/revoked, QuickBooks returns 401 with code 3200
  if (response.status === 401) {
    console.warn('[quickBooksRequest] Received 401, trying to refresh token...')
    try {
      const refreshed = await refreshAccessToken(config)
      const newExpiry = Math.floor(Date.now() / 1000) + refreshed.expiresIn

      await saveQuickBooksConfig(workspaceId, {
        accessToken: refreshed.accessToken,
        tokenExpiry: newExpiry,
      })

      accessToken = refreshed.accessToken
      response = await doFetch(accessToken)
    } catch (err: any) {
      console.error('[quickBooksRequest] Token refresh failed:', err?.message || err)
      // If refresh de başarısızsa, kullanıcıdan yeniden bağlantı istenmeli
      throw new Error(
        `QuickBooks token expired or revoked and refresh failed. Please reconnect QuickBooks from Settings. Details: ${err?.message || err}`
      )
    }
  }
  
  if (!response.ok) {
    const errorText = await response.text()
    console.error(`[quickBooksRequest] Error ${response.status}:`, errorText.substring(0, 500))
    throw new Error(`QuickBooks API error (${response.status}): ${errorText.substring(0, 200)}`)
  }
  
  const data = await response.json()
  return data
}

/**
 * Get primary image URL for a QuickBooks item (if any)
 */
async function getQuickBooksItemImageUrl(
  workspaceId: string,
  itemId: string
): Promise<string | null> {
  try {
    console.log('[getQuickBooksItemImageUrl] Fetching image for item:', itemId)
    const query = encodeURIComponent(
      `SELECT * FROM Attachable WHERE AttachableRef.EntityRef.Id = '${itemId}'`
    )

    const response = await quickBooksRequest(
      workspaceId,
      'GET',
      `/query?query=${query}&minorversion=75`
    )

    console.log(
      '[getQuickBooksItemImageUrl] Raw response:',
      JSON.stringify(response).substring(0, 500)
    )

    const attachables = response?.QueryResponse?.Attachable
    if (!attachables) return null

    const list = Array.isArray(attachables) ? attachables : [attachables]
    const first = list[0]

    const url =
      first?.TempDownloadUri ||
      first?.FileAccessUri ||
      first?.ContentUrl ||
      null

    return url || null
  } catch (err) {
    console.error('[getQuickBooksItemImageUrl] Error fetching image:', err)
    return null
  }
}

/**
 * Sync product to QuickBooks as Item
 */
export async function syncProductToQuickBooks(
  workspaceId: string,
  product: {
    id: string
    name: string
    sku: string
    qtyOnHand?: number
    pricePerBox?: number
    uom?: string
  },
  quickBooksItemId?: string
): Promise<string> {
  const item: QuickBooksItem = {
    Name: product.name,
    Type: 'Inventory',
    Sku: product.sku,
    QtyOnHand: product.qtyOnHand || 0,
    UnitPrice: product.pricePerBox || 0,
  }
  
  if (quickBooksItemId) {
    item.Id = quickBooksItemId
    // Update existing item
    const response = await quickBooksRequest(
      workspaceId,
      'POST',
      `/item?minorversion=75`,
      item
    )
    return response.Item.Id
  } else {
    // Create new item
    const response = await quickBooksRequest(
      workspaceId,
      'POST',
      `/item?minorversion=75`,
      item
    )
    return response.Item.Id
  }
}

/**
 * Get QuickBooks items
 */
export async function getQuickBooksItems(workspaceId: string): Promise<QuickBooksItem[]> {
  try {
    const query = encodeURIComponent('SELECT * FROM Item MAXRESULTS 1000')
    const response = await quickBooksRequest(
      workspaceId,
      'GET',
      `/query?query=${query}&minorversion=75`
    )

    console.log('[getQuickBooksItems] Response:', JSON.stringify(response).substring(0, 500))

    const items = response?.QueryResponse?.Item
    if (!items) {
      console.log('[getQuickBooksItems] No items found in response')
      return []
    }

    const normalized = Array.isArray(items) ? items : [items]
    console.log(`[getQuickBooksItems] Found ${normalized.length} items`)
    return normalized
  } catch (error: any) {
    console.error('[getQuickBooksItems] Error:', error)
    throw new Error(`Failed to fetch QuickBooks items: ${error.message || 'Unknown error'}`)
  }
}

/**
 * Create invoice in QuickBooks
 */
export async function createQuickBooksInvoice(
  workspaceId: string,
  invoice: QuickBooksInvoice
): Promise<string> {
  const response = await quickBooksRequest(
    workspaceId,
    'POST',
    `/invoice?minorversion=75`,
    invoice
  )
  
  return response.Invoice.Id
}

/**
 * Import products from QuickBooks to Inventory
 * If allowedSkus is provided, only those SKUs will be imported.
 */
export async function importProductsFromQuickBooks(
  workspaceId: string,
  allowedSkus?: string[],
  options?: { jobId?: string; trigger?: 'manual' | 'auto' }
): Promise<{ imported: number; updated: number; skipped: number; errors: number; totalItems: number }> {
  console.log(`[importProductsFromQuickBooks] Starting import for workspace: ${workspaceId}`)
  console.log('[importProductsFromQuickBooks] allowedSkus:', allowedSkus)
  const db = admin.firestore()
  const startedAt = admin.firestore.FieldValue.serverTimestamp()
  const jobId = options?.jobId
  const jobRef = jobId
    ? db.doc(`workspaces/${workspaceId}/quickbooksImports/${jobId}`)
    : null
  
  console.log(`[importProductsFromQuickBooks] jobId: ${jobId}, jobRef exists: ${!!jobRef}, jobRef path: ${jobRef?.path || 'N/A'}`)

  try {
    // Step 1: Get items from QuickBooks
    console.log('[importProductsFromQuickBooks] Step 1: Fetching items from QuickBooks...')
    console.log('[importProductsFromQuickBooks] jobId:', jobId)
    console.log('[importProductsFromQuickBooks] allowedSkus:', allowedSkus)
    const items = await getQuickBooksItems(workspaceId)
    console.log(`[importProductsFromQuickBooks] Step 1 complete: Found ${items.length} items`)
    console.log(`[importProductsFromQuickBooks] Items array type: ${Array.isArray(items) ? 'array' : typeof items}`)
    if (items.length === 0) {
      console.warn('[importProductsFromQuickBooks] WARNING: No items found from QuickBooks!')
    }
    const MAX_DETAILS = 200
    type ItemDetail = {
      sku?: string
      name?: string
      quickBooksItemId?: string | null
      productId?: string | null
      action: 'imported' | 'updated' | 'skipped' | 'error'
      reason?: string
    }
    const details: ItemDetail[] = []
    const pushDetail = (detail: ItemDetail) => {
      if (details.length < MAX_DETAILS) {
        details.push(detail)
      }
    }

    if (!Array.isArray(items)) {
      throw new Error(`Expected array but got ${typeof items}`)
    }
    
    let imported = 0
    let updated = 0
    let skipped = 0
    let errors = 0
    let processed = 0

    // Initialize job document if provided
    if (jobRef) {
      await jobRef.set(
        {
          type: 'product_import',
          trigger: options?.trigger || 'manual',
          status: 'running',
          startedAt,
          totalItems: items.length,
          processed: 0,
          imported: 0,
          updated: 0,
          skipped: 0,
          errors: 0,
          allowedSkus: allowedSkus ?? [],
          lastUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      )
    }

    const flushProgress = async () => {
      if (!jobRef) {
        console.warn('[importProductsFromQuickBooks] flushProgress called but jobRef is null/undefined')
        return
      }
      try {
        const progressData = {
          processed,
          imported,
          updated,
          skipped,
          errors,
          totalItems: items.length,
          details: {
            items: details,
            truncated: details.length >= MAX_DETAILS,
          },
          lastUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }
        console.log(`[importProductsFromQuickBooks] flushProgress: Writing to Firestore jobRef=${jobRef.path}, data:`, {
          processed,
          imported,
          updated,
          skipped,
          errors,
          totalItems: items.length,
        })
        await jobRef.set(progressData, { merge: true })
        console.log(`[importProductsFromQuickBooks] Progress flushed successfully: ${processed}/${items.length} processed (imported: ${imported}, updated: ${updated}, skipped: ${skipped}, errors: ${errors})`)
      } catch (error: any) {
        console.error('[importProductsFromQuickBooks] Failed to update job progress:', error)
        console.error('[importProductsFromQuickBooks] Error details:', {
          processed,
          imported,
          updated,
          skipped,
          errors,
          totalItems: items.length,
          errorMessage: error?.message,
          errorStack: error?.stack,
        })
      }
    }
    
    console.log(`[importProductsFromQuickBooks] Step 2: Processing ${items.length} items...`)
    console.log(`[importProductsFromQuickBooks] jobRef check: jobId=${jobId}, jobRef=${!!jobRef ? 'exists' : 'null'}`)
    
    // Send initial progress update immediately so frontend knows totalItems
    // This MUST happen after items are fetched to ensure totalItems is correct
    if (jobRef) {
      console.log(`[importProductsFromQuickBooks] Sending initial progress update: totalItems=${items.length}, processed=${processed}`)
      await flushProgress()
      console.log(`[importProductsFromQuickBooks] Initial progress update sent`)
    } else {
      console.warn(`[importProductsFromQuickBooks] WARNING: jobRef is null! Cannot update progress. jobId=${jobId}`)
    }
    
    const allowedSet = allowedSkus && allowedSkus.length > 0
      ? new Set(allowedSkus.map(s => String(s).trim()))
      : null
    
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      
      // Increment processed counter at the START of each iteration
      // This ensures ALL items are counted, including skipped ones
      processed++
      console.log(
        `[importProductsFromQuickBooks] Processing item ${i + 1}/${items.length} (processed: ${processed}): ${ 
          item?.Name || 'Unknown'
        }`
      )

      const skuRaw = String(item?.Sku || '').trim()
      const normalizedSku = skuRaw.toUpperCase()
      const nameRaw = String(item?.Name || '').trim()

      // Only import Inventory type items
      if (!item || item.Type !== 'Inventory' || !skuRaw || !nameRaw) {
        console.log(
          `[importProductsFromQuickBooks] Skipping item (invalid type/SKU/name): Type=${item?.Type}, SKU=${item?.Sku}, Name=${item?.Name}`
        )
        skipped++
        pushDetail({
          sku: skuRaw || item?.Sku,
          name: nameRaw || item?.Name,
          quickBooksItemId: item?.Id ? String(item.Id) : null,
          productId: null,
          action: 'skipped',
          reason: 'Non-inventory item or missing SKU/name',
        })
        // Update progress before continuing
        if (jobRef && (processed % 5 === 0 || processed === items.length)) {
          await flushProgress()
        }
        continue
      }

      const sku = normalizedSku

      // If user selected specific SKUs, skip others
      if (allowedSet && !allowedSet.has(sku)) {
        console.log(
          `[importProductsFromQuickBooks] Skipping item not in allowedSkus: SKU=${sku}`
        )
        skipped++
        pushDetail({
          sku,
          name: nameRaw,
          quickBooksItemId: item.Id ? String(item.Id) : null,
          productId: null,
          action: 'skipped',
          reason: 'SKU not in selected list',
        })
        // Update progress before continuing
        if (jobRef && (processed % 5 === 0 || processed === items.length)) {
          await flushProgress()
        }
        continue
      }

      try {
        // First try to find by QuickBooks Item Id (stable identifier)
        let existingDoc: FirebaseFirestore.QueryDocumentSnapshot<FirebaseFirestore.DocumentData> | null =
          null

        if (item.Id) {
          const idQuery = db
            .collection(`workspaces/${workspaceId}/products`)
            .where('quickBooksItemId', '==', String(item.Id))
            .limit(1)

          const idSnap = await idQuery.get()
          if (!idSnap.empty) {
            existingDoc = idSnap.docs[0]
            console.log(
              `[importProductsFromQuickBooks] Found existing product by QuickBooks Id for SKU=${sku}, productId=${existingDoc.id}`
            )
          }
        }

        // Fallback: check by normalized SKU (in case older records don't have quickBooksItemId)
        if (!existingDoc) {
          console.log(`[importProductsFromQuickBooks] Checking if product exists by SKU=${sku}`)
          const existingQuery = db
            .collection(`workspaces/${workspaceId}/products`)
            .where('sku', '==', sku)
            .limit(2)

          const existingSnap = await existingQuery.get()

          if (!existingSnap.empty) {
            // If multiple products share same SKU, always update the first one to avoid creating more duplicates
            if (existingSnap.size > 1) {
              console.warn(
                `[importProductsFromQuickBooks] Multiple products found for SKU=${sku}. Will update the first one and log a warning.`
              )
            }
            existingDoc = existingSnap.docs[0]
          }
        }

        // Try to fetch image URL once per item
        let imageUrl: string | null = null
        if (item.Id) {
          imageUrl = await getQuickBooksItemImageUrl(workspaceId, String(item.Id))
        }

        if (existingDoc) {
          const existingData = existingDoc.data()

          const updates: any = {}

          const newName = nameRaw
          const newPrice = Number(item.UnitPrice) || 0
          const newReorderPoint = Number(item.ReorderPoint) || 0
          const newQbId = item.Id ? String(item.Id) : null
          const newImageUrl = imageUrl || existingData.imageUrl || null

          if (newName && newName !== (existingData.name || '')) {
            updates.name = newName
          }
          if (
            existingData.pricePerBox === undefined ||
            existingData.pricePerBox !== newPrice
          ) {
            updates.pricePerBox = newPrice
          }
          if (
            existingData.reorderPoint === undefined ||
            existingData.reorderPoint !== newReorderPoint
          ) {
            updates.reorderPoint = newReorderPoint
          }
          if (newQbId && existingData.quickBooksItemId !== newQbId) {
            updates.quickBooksItemId = newQbId
          }
          if (newImageUrl && existingData.imageUrl !== newImageUrl) {
            updates.imageUrl = newImageUrl
          }

          if (Object.keys(updates).length > 0) {
            updates.updatedAt = admin.firestore.FieldValue.serverTimestamp()
            updates.quickBooksLastSyncAt = admin.firestore.FieldValue.serverTimestamp()
            await existingDoc.ref.update(updates)
            updated++
            pushDetail({
              sku,
              name: newName,
              quickBooksItemId: newQbId,
              productId: existingDoc.id,
              action: 'updated',
              reason: 'Updated existing product from QuickBooks',
            })
          } else {
            skipped++
            pushDetail({
              sku,
              name: newName,
              quickBooksItemId: newQbId,
              productId: existingDoc.id,
              action: 'skipped',
              reason: 'No changes (already up to date)',
            })
          }

          // Update progress before continuing
          if (jobRef && (processed % 5 === 0 || processed === items.length)) {
            await flushProgress()
          }
          continue
        }

        // Create new product
        console.log(
          `[importProductsFromQuickBooks] Creating product: ${item.Name} (${sku})`
        )
        const productData: any = {
          name: nameRaw,
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
        }

        // Validate required fields
        if (!productData.name || !productData.sku) {
          console.error(
            `[importProductsFromQuickBooks] Invalid product data:`,
            productData
          )
          errors++
          pushDetail({
            sku,
            name: productData.name,
            quickBooksItemId: productData.quickBooksItemId,
            productId: null,
            action: 'error',
            reason: 'Invalid product data (missing name or SKU)',
          })
          // Update progress before continuing
          if (jobRef && (processed % 5 === 0 || processed === items.length)) {
            await flushProgress()
          }
          continue
        }

        const productRef = await db
          .collection(`workspaces/${workspaceId}/products`)
          .add(productData)
        const productId = productRef.id
        console.log(`[importProductsFromQuickBooks] Product created: ${productId}`)

        // If there's initial quantity, create stock transaction
        const qty = Number(item.QtyOnHand) || 0
        if (qty > 0) {
          console.log(
            `[importProductsFromQuickBooks] Creating stock transaction: qty=${qty}`
          )
          await db.collection(`workspaces/${workspaceId}/stockTxns`).add({
            workspaceId,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            type: 'Receive',
            productId,
            qty: qty,
            userId: 'system',
            reason: 'Imported from QuickBooks',
          })
        }

        imported++
        pushDetail({
          sku,
          name: nameRaw,
          quickBooksItemId: item.Id ? String(item.Id) : null,
          productId,
          action: 'imported',
          reason: 'Imported as new product from QuickBooks',
        })
      } catch (error: any) {
        console.error(
          `[importProductsFromQuickBooks] Error importing product ${item.Name} (${sku}):`,
          error
        )
        console.error(`[importProductsFromQuickBooks] Error stack:`, error.stack)
        errors++
        pushDetail({
          sku,
          name: nameRaw,
          quickBooksItemId: item.Id ? String(item.Id) : null,
          productId: null,
          action: 'error',
          reason: error?.message || 'Unknown error while importing product',
        })
      }

      // Update job progress periodically (every 5 items for better responsiveness)
      // Note: processed++ is now at the start of the loop, so we just need to flush progress here
      if (jobRef && (processed % 5 === 0 || processed === items.length)) {
        await flushProgress()
      }
    }

    console.log(
      `[importProductsFromQuickBooks] Completed: ${imported} imported, ${updated} updated, ${skipped} skipped, ${errors} errors`
    )

    // Log operation under workspace (manual trigger by default)
    await db.collection(`workspaces/${workspaceId}/quickbooksLogs`).add({
      type: 'product_import',
      trigger: options?.trigger || 'manual',
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
      details: {
        items: details,
        truncated: details.length >= MAX_DETAILS,
      },
    })

    // Final job update
    if (jobRef) {
      await jobRef.set(
        {
          status: errors > 0 ? 'failed' : 'success',
          processed,
          imported,
          updated,
          skipped,
          errors,
          totalItems: items.length,
          finishedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      )
    }

    return { imported, updated, skipped, errors, totalItems: items.length }
  } catch (error: any) {
    console.error('[importProductsFromQuickBooks] Fatal error:', error)
    console.error('[importProductsFromQuickBooks] Error stack:', error.stack)
    console.error('[importProductsFromQuickBooks] Error message:', error.message)

    // Log failed operation
    await db.collection(`workspaces/${workspaceId}/quickbooksLogs`).add({
      type: 'product_import',
      trigger: options?.trigger || 'manual',
      startedAt,
      finishedAt: admin.firestore.FieldValue.serverTimestamp(),
      status: 'failed',
      errorMessage: error.message || 'Unknown error',
      allowedSkus: allowedSkus ?? [],
    })

    // Mark job as failed if tracking
    if (jobRef) {
      await jobRef.set(
        {
          status: 'failed',
          errorMessage: error.message || 'Unknown error',
          finishedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      )
    }

    throw new Error(`Failed to import products from QuickBooks: ${error.message || 'Unknown error'}`)
  }
}

/**
 * Sync inventory levels from QuickBooks
 */
export async function syncInventoryFromQuickBooks(workspaceId: string): Promise<void> {
  const db = admin.firestore()
  const startedAt = admin.firestore.FieldValue.serverTimestamp()

  const items = await getQuickBooksItems(workspaceId)

  let matched = 0
  let updated = 0
  let unchanged = 0

  for (const item of items) {
    if (item.Type === 'Inventory' && item.Sku) {
      // Find product by SKU and update qtyOnHand
      const productsQuery = db.collection(`workspaces/${workspaceId}/products`)
        .where('sku', '==', item.Sku)
        .limit(1)
      
      const productsSnap = await productsQuery.get()
      if (!productsSnap.empty) {
        matched++
        const productDoc = productsSnap.docs[0]
        const productId = productDoc.id
        const currentData = productDoc.data()

        const newQty = item.QtyOnHand ?? 0

        // Calculate actual current stock from all transactions (source of truth)
        // This ensures we compare against the real stock, not a potentially stale qtyOnHand
        const txnsQuery = db.collection(`workspaces/${workspaceId}/stockTxns`)
          .where('productId', '==', productId)
        const txnsSnap = await txnsQuery.get()
        
        let calculatedQty = 0
        txnsSnap.docs.forEach(txnDoc => {
          const txn = txnDoc.data()
          const txnQty = Number(txn.qty || 0)
          const txnType = txn.type
          
          // Handle both signed qty (new format) and unsigned qty with type (old format)
          // If qty is negative, it's already signed (new format), use as-is
          // If qty is positive, determine sign from type (old format)
          let deltaQty = txnQty
          if (txnQty >= 0) {
            // qty is positive, determine sign from type (backward compatibility)
            switch (txnType) {
              case 'Produce':
              case 'Receive':
              case 'Adjust+':
                deltaQty = Math.abs(txnQty)
                break
              case 'Consume':
              case 'Ship':
              case 'Issue':
              case 'Adjust-':
                deltaQty = -Math.abs(txnQty)
                break
              case 'Transfer':
                deltaQty = txn.toLoc ? Math.abs(txnQty) : -Math.abs(txnQty)
                break
              case 'Count':
                deltaQty = 0
                break
              default:
                // For unknown types, assume qty is already signed
                deltaQty = txnQty
            }
          }
          // If qty is negative, it's already signed (new format), use as-is
          calculatedQty += deltaQty
        })

        // Use calculated quantity as the current stock (source of truth)
        // Fall back to qtyOnHand if no transactions exist
        const currentQty = txnsSnap.size > 0 
          ? calculatedQty 
          : ((currentData.qtyOnHand as number | undefined) ?? 0)

        // Update if quantity changed
        if (newQty !== currentQty) {
          updated++
          const diff = newQty - currentQty

          // Only create transaction if there's a meaningful difference
          if (Math.abs(diff) > 0.0001) {
            // Create stock transaction to keep history consistent
            // Use signed qty (positive for Receive, negative for Issue) to match createStockTransaction behavior
            const txnType = diff > 0 ? 'Receive' : 'Issue'
            const signedQty = diff > 0 ? Math.abs(diff) : -Math.abs(diff)
            
            await db.collection(`workspaces/${workspaceId}/stockTxns`).add({
              workspaceId,
              timestamp: admin.firestore.FieldValue.serverTimestamp(),
              type: txnType,
              productId: productId,
              qty: signedQty, // Use signed qty (positive for Receive, negative for Issue)
              userId: 'system',
              reason: 'Synced inventory from QuickBooks',
            })

            // Update product qtyOnHand using increment (like createStockTransaction does)
            // This ensures consistency with the transaction-based stock tracking
            await productDoc.ref.update({
              quantityBox: newQty,
              qtyOnHand: admin.firestore.FieldValue.increment(signedQty),
              quickBooksItemId: item.Id,
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
              quickBooksLastSyncAt: admin.firestore.FieldValue.serverTimestamp(),
            })
          } else {
            // No transaction needed, just update metadata
            await productDoc.ref.update({
              quantityBox: newQty,
              quickBooksItemId: item.Id,
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
              quickBooksLastSyncAt: admin.firestore.FieldValue.serverTimestamp(),
            })
          }
        } else {
          unchanged++
          // Still update metadata even if quantity hasn't changed
          await productDoc.ref.update({
            quickBooksItemId: item.Id,
            quickBooksLastSyncAt: admin.firestore.FieldValue.serverTimestamp(),
          })
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
  })
}

