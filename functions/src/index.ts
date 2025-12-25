import admin from 'firebase-admin'
import { onDocumentCreated } from 'firebase-functions/v2/firestore'
import { onCall, onRequest } from 'firebase-functions/v2/https'
import { onSchedule } from 'firebase-functions/v2/scheduler'
import { setGlobalOptions } from 'firebase-functions/v2/options'
import nodemailer from 'nodemailer'
import {
  getQuickBooksConfig as getQBConfig,
  saveQuickBooksConfig as saveQBConfig,
  getQuickBooksAuthUrl as getQBAuthUrl,
  exchangeCodeForToken,
  syncProductToQuickBooks as syncProductToQB,
  getQuickBooksItems as getQBItems,
  createQuickBooksInvoice as createQBInvoice,
  syncInventoryFromQuickBooks as syncInventoryFromQB,
  importProductsFromQuickBooks as importProductsFromQB,
  getQuickBooksAutoSyncConfig,
  saveQuickBooksAutoSyncConfig,
  type QuickBooksConfig,
  type QuickBooksAutoSyncConfig,
} from './quickbooks.js'

admin.initializeApp()
setGlobalOptions({ region: 'us-central1', maxInstances: 10 })

interface StockTxn {
  workspaceId: string
  timestamp: admin.firestore.Timestamp
  type: 'Produce' | 'Consume' | 'Transfer' | 'Adjust+' | 'Adjust-' | 'Receive' | 'Ship' | 'Count'
  refs?: { poId?: string; taskId?: string }
  productId: string
  fromLoc?: string
  toLoc?: string
  batchId?: string
  serialId?: string
  qty: number
  unitCost?: number
  userId: string
  reason?: string
}

export const onStockTxnWrite = onDocumentCreated(
  'workspaces/{wId}/stockTxns/{txnId}',
  async (event) => {
    const wId = event.params.wId as string
    const snap = event.data
    if (!snap) return
    const txn = snap.data() as StockTxn

    const db = admin.firestore()

    // Basic validation
    if (txn.workspaceId !== wId) {
      console.warn('Workspace mismatch in txn', wId)
      return
    }
    if (!Number.isFinite(txn.qty) || txn.qty === 0) return

    // Determine stock document key by product/location/batch/serial
    const stockIdParts = [txn.productId, txn.toLoc || txn.fromLoc || '']
    if (txn.batchId) stockIdParts.push(`b:${txn.batchId}`)
    if (txn.serialId) stockIdParts.push(`s:${txn.serialId}`)
    const stockId = stockIdParts.join('_')

    const stockRef = db.doc(`workspaces/${wId}/stock/${stockId}`)
    await db.runTransaction(async (t) => {
      const stockSnap = await t.get(stockRef)
      const exists = stockSnap.exists
      const doc = (exists ? stockSnap.data() : {}) as any

      const prevQty: number = Number(doc.qtyOnHand || 0)
      const prevAvgCost: number = Number(doc.avgCost || 0)

      let deltaQty = txn.qty
      let newAvgCost = prevAvgCost

      // Movement semantics
      switch (txn.type) {
        case 'Produce':
        case 'Receive':
        case 'Adjust+':
          // moving average cost update when increasing stock with unitCost
          if (typeof txn.unitCost === 'number' && txn.unitCost >= 0) {
            const totalCost = prevAvgCost * prevQty + txn.unitCost * Math.abs(txn.qty)
            const newQty = prevQty + Math.abs(txn.qty)
            newAvgCost = newQty > 0 ? totalCost / newQty : prevAvgCost
          }
          deltaQty = Math.abs(txn.qty)
          break
        case 'Consume':
        case 'Ship':
        case 'Adjust-':
          deltaQty = -Math.abs(txn.qty)
          break
        case 'Transfer':
          // Treat as + at toLoc and - at fromLoc via two txns on client or higher-level logic
          // Here we assume stockId uses toLoc if present; otherwise fromLoc
          deltaQty = txn.toLoc ? Math.abs(txn.qty) : -Math.abs(txn.qty)
          break
        case 'Count':
          // Absolute set not supported at stock doc; represent as Adjust+/- externally
          deltaQty = 0
          break
      }

      const nextQty = prevQty + deltaQty
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
      }
      if (exists) t.update(stockRef, payload)
      else t.set(stockRef, payload)
    })
  }
)

export const createProductionOrder = onCall(async (request) => {
  const { workspaceId, productId, plannedQty, bomVersion, dueDate, notes } = request.data
  const userId = request.auth?.uid
  if (!userId) throw new Error('Unauthenticated')

  const db = admin.firestore()
  const workspaceRef = db.doc(`workspaces/${workspaceId}`)
  const workspace = await workspaceRef.get()
  if (!workspace.exists) throw new Error('Workspace not found')

  // Get BOM
  const bomQuery = db.collection(`workspaces/${workspaceId}/boms`)
    .where('productId', '==', productId)
    .where('version', '==', bomVersion)
    .limit(1)
  const bomSnap = await bomQuery.get()
  if (bomSnap.empty) throw new Error('BOM not found')
  const bom = bomSnap.docs[0].data()

  // Check component availability
  const shortages: any[] = []
  for (const line of bom.lines || []) {
    const stockQuery = db.collection(`workspaces/${workspaceId}/stock`)
      .where('productId', '==', line.componentId)
    const stockSnap = await stockQuery.get()
    const totalOnHand = stockSnap.docs.reduce((sum, doc) => sum + (doc.data().qtyOnHand || 0), 0)
    const required = line.qtyPer * plannedQty * (1 + (line.scrapPct || 0) / 100)
    if (totalOnHand < required) {
      shortages.push({
        componentId: line.componentId,
        required,
        available: totalOnHand,
        shortfall: required - totalOnHand
      })
    }
  }

  // Generate PO code
  const poCountQuery = db.collection(`workspaces/${workspaceId}/productionOrders`).count()
  const poCount = await poCountQuery.get()
  const code = `PO-${String(poCount.data().count + 1).padStart(4, '0')}`

  // Create PO
  const poRef = db.collection(`workspaces/${workspaceId}/productionOrders`).doc()
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
  })

  return {
    poId: poRef.id,
    code,
    shortages: shortages.length > 0 ? shortages : null
  }
})

export const completeTask = onCall(async (request) => {
  const { workspaceId, taskId, produceQty, consumeQty } = request.data
  const userId = request.auth?.uid
  if (!userId) throw new Error('Unauthenticated')

  const db = admin.firestore()
  const taskRef = db.doc(`workspaces/${workspaceId}/tasks/${taskId}`)
  const taskSnap = await taskRef.get()
  if (!taskSnap.exists) throw new Error('Task not found')
  const task = taskSnap.data()!

  // Update task status
  await taskRef.update({
    status: 'Done',
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  })

  // Create stock transactions if linked to PO/product
  if (task.links?.productId) {
    const productId = task.links.productId
    const poId = task.links.poId

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
      })
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
      })
    }

    // Update PO stage if linked
    if (poId) {
      const poRef = db.doc(`workspaces/${workspaceId}/productionOrders/${poId}`)
      const poSnap = await poRef.get()
      if (poSnap.exists) {
        const po = poSnap.data()!
        if (po.status === 'In-Progress') {
          await poRef.update({
            status: 'QA',
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          })
        }
      }
    }
  }

  return { success: true }
})

// Stub: Generate barcode/QR PDF and return signed URL (to be implemented later)
export const barcodeLabelPdf = onRequest(async (req, res) => {
  try {
    // Placeholder response; implement real PDF generation later.
    res.status(200).json({ message: 'barcodeLabelPdf not implemented yet' })
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Unexpected error' })
  }
})

// Scheduled low-stock watcher: scans stock below min/reorder and logs notifications (stub)
export const lowStockWatcher = onSchedule('every 24 hours', async () => {
  const db = admin.firestore()
  const workspacesSnap = await db.collection('workspaces').get()
  for (const w of workspacesSnap.docs) {
    const wId = w.id
    const productsSnap = await db.collection(`workspaces/${wId}/products`).get()
    const stockSnap = await db.collection(`workspaces/${wId}/stock`).get()
    const productIdToMin: Record<string, number> = {}
    for (const p of productsSnap.docs) {
      const d = p.data() as any
      productIdToMin[p.id] = Number(d.minStock || 0)
    }
    const low: Array<{ productId: string; onHand: number; min: number }> = []
    const onHandByProduct: Record<string, number> = {}
    for (const s of stockSnap.docs) {
      const d = s.data() as any
      const pid = d.productId
      onHandByProduct[pid] = (onHandByProduct[pid] || 0) + Number(d.qtyOnHand || 0)
    }
    for (const [pid, onHand] of Object.entries(onHandByProduct)) {
      const min = productIdToMin[pid] || 0
      if (onHand < min) low.push({ productId: pid, onHand, min })
    }
    if (low.length) {
      await db.collection(`workspaces/${wId}/notifications`).add({
        type: 'lowStock',
        items: low,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      })
    }
  }
})

// ===== QUICKBOOKS INTEGRATION =====

/**
 * Get QuickBooks authorization URL
 */
export const getQuickBooksAuthUrl = onCall(async (request) => {
  const { workspaceId } = request.data
  const userId = request.auth?.uid
  if (!userId) throw new Error('Unauthenticated')
  if (!workspaceId) throw new Error('workspaceId is required')

  console.log('[getQuickBooksAuthUrl] Request for workspace:', workspaceId)
  
  const config = await getQBConfig(workspaceId)
  if (!config) {
    throw new Error('QuickBooks not configured. Please set up client ID and secret first.')
  }

  console.log('[getQuickBooksAuthUrl] Config loaded:', {
    hasClientId: !!config.clientId,
    hasRedirectUri: !!config.redirectUri,
    environment: config.environment,
  })

  if (!config.redirectUri) {
    throw new Error('Redirect URI is missing. Please configure it in Settings.')
  }

  const authUrl = getQBAuthUrl(config)
  console.log('[getQuickBooksAuthUrl] Returning auth URL')
  return { authUrl }
})

/**
 * Handle QuickBooks OAuth callback
 */
export const quickBooksOAuthCallback = onCall(async (request) => {
  const { workspaceId, authCode, realmId } = request.data
  const userId = request.auth?.uid
  if (!userId) throw new Error('Unauthenticated')
  if (!workspaceId || !authCode || !realmId) {
    throw new Error('workspaceId, authCode, and realmId are required')
  }

  const config = await getQBConfig(workspaceId)
  if (!config) {
    throw new Error('QuickBooks not configured')
  }

  const tokens = await exchangeCodeForToken(config, authCode, realmId)
  const tokenExpiry = Math.floor(Date.now() / 1000) + tokens.expiresIn

  await saveQBConfig(workspaceId, {
    realmId,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    tokenExpiry,
  })

  return { success: true }
})

/**
 * Save QuickBooks configuration
 */
export const saveQuickBooksConfig = onCall(async (request) => {
  const { workspaceId, config } = request.data
  const userId = request.auth?.uid
  if (!userId) throw new Error('Unauthenticated')
  if (!workspaceId) throw new Error('workspaceId is required')

  console.log('[saveQuickBooksConfig] Saving config:', {
    workspaceId,
    hasClientId: !!config?.clientId,
    hasClientSecret: !!config?.clientSecret,
    redirectUri: config?.redirectUri || 'MISSING',
    environment: config?.environment,
  })

  if (!config?.redirectUri) {
    console.warn('[saveQuickBooksConfig] WARNING: redirectUri is missing!')
  }

  await saveQBConfig(workspaceId, config)
  console.log('[saveQuickBooksConfig] Config saved successfully')
  return { success: true }
})

/**
 * Get QuickBooks configuration
 */
export const getQuickBooksConfig = onCall(async (request) => {
  const { workspaceId } = request.data
  const userId = request.auth?.uid
  if (!userId) throw new Error('Unauthenticated')
  if (!workspaceId) throw new Error('workspaceId is required')

  const config = await getQBConfig(workspaceId)
  if (!config) {
    return { connected: false }
  }

  // Check if connection is complete (realmId and accessToken are required)
  const isConnected = !!(config.realmId && config.accessToken)

  // Don't return sensitive tokens to client
  return {
    connected: isConnected,
    environment: config.environment,
    realmId: config.realmId,
  }
})

/**
 * Sync product to QuickBooks
 */
export const syncProductToQuickBooks = onCall(async (request) => {
  const { workspaceId, product, quickBooksItemId } = request.data
  const userId = request.auth?.uid
  if (!userId) throw new Error('Unauthenticated')
  if (!workspaceId || !product) {
    throw new Error('workspaceId and product are required')
  }

  const itemId = await syncProductToQB(workspaceId, product, quickBooksItemId)
  return { itemId }
})

/**
 * Import products from QuickBooks
 */
export const importProductsFromQuickBooks = onCall(async (request) => {
  console.log('[importProductsFromQuickBooks] Function called')
  console.log('[importProductsFromQuickBooks] Request data:', JSON.stringify(request.data))
  
  const { workspaceId, skus, jobId } = request.data as {
    workspaceId?: string
    skus?: string[]
    jobId?: string
  }
  const userId = request.auth?.uid
  
  console.log('[importProductsFromQuickBooks] workspaceId:', workspaceId)
  console.log('[importProductsFromQuickBooks] userId:', userId)
  
  if (!userId) {
    console.error('[importProductsFromQuickBooks] Unauthenticated request')
    throw new Error('Unauthenticated')
  }
  if (!workspaceId) {
    console.error('[importProductsFromQuickBooks] Missing workspaceId')
    throw new Error('workspaceId is required')
  }

  try {
    console.log('[importProductsFromQuickBooks] Starting import...')
    const result = await importProductsFromQB(workspaceId, skus, {
      jobId,
      trigger: 'manual',
    })
    console.log('[importProductsFromQuickBooks] Import completed:', JSON.stringify(result))
    return result
  } catch (error: any) {
    console.error('[importProductsFromQuickBooks] Error in function:', error)
    console.error('[importProductsFromQuickBooks] Error stack:', error.stack)
    console.error('[importProductsFromQuickBooks] Error message:', error.message)
    throw error
  }
})

/**
 * Sync inventory from QuickBooks
 */
export const syncInventoryFromQuickBooks = onCall(async (request) => {
  const { workspaceId } = request.data
  const userId = request.auth?.uid
  if (!userId) throw new Error('Unauthenticated')
  if (!workspaceId) throw new Error('workspaceId is required')

  await syncInventoryFromQB(workspaceId)
  return { success: true }
})

/**
 * Get QuickBooks logs (recent activity)
 */
export const getQuickBooksLogs = onCall(async (request) => {
  const { workspaceId, limit = 20 } = request.data as {
    workspaceId?: string
    limit?: number
  }
  const userId = request.auth?.uid
  if (!userId) throw new Error('Unauthenticated')
  if (!workspaceId) throw new Error('workspaceId is required')

  const db = admin.firestore()

  const snap = await db
    .collection(`workspaces/${workspaceId}/quickbooksLogs`)
    .orderBy('finishedAt', 'desc')
    .limit(typeof limit === 'number' && limit > 0 ? limit : 20)
    .get()

  const logs = snap.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }))

  return { logs }
})

/**
 * Get QuickBooks auto-sync configuration
 */
export const getQuickBooksAutoSyncConfigFn = onCall(async (request) => {
  const { workspaceId } = request.data as { workspaceId?: string }
  const userId = request.auth?.uid
  if (!userId) throw new Error('Unauthenticated')
  if (!workspaceId) throw new Error('workspaceId is required')

  const config = await getQuickBooksAutoSyncConfig(workspaceId)

  // Default config if not set yet
  const effective: QuickBooksAutoSyncConfig = config ?? {
    inventorySyncInterval: 'off',
    productImportInterval: 'off',
    lastInventorySyncAt: null,
    lastProductImportAt: null,
  }

  return {
    inventorySyncInterval: effective.inventorySyncInterval,
    productImportInterval: effective.productImportInterval,
    lastInventorySyncAt: effective.lastInventorySyncAt ?? null,
    lastProductImportAt: effective.lastProductImportAt ?? null,
  }
})

/**
 * Save QuickBooks auto-sync configuration
 */
export const saveQuickBooksAutoSyncConfigFn = onCall(async (request) => {
  const { workspaceId, config } = request.data as {
    workspaceId?: string
    config?: Partial<QuickBooksAutoSyncConfig>
  }
  const userId = request.auth?.uid
  if (!userId) throw new Error('Unauthenticated')
  if (!workspaceId) throw new Error('workspaceId is required')
  if (!config) throw new Error('config is required')

  await saveQuickBooksAutoSyncConfig(workspaceId, config)

  return { success: true }
})

function intervalToMs(interval: string | undefined | null): number | null {
  switch (interval) {
    case '30m':
      return 30 * 60 * 1000
    case '1h':
      return 60 * 60 * 1000
    case '4h':
      return 4 * 60 * 60 * 1000
    case '1d':
      return 24 * 60 * 60 * 1000
    case '7d':
      return 7 * 24 * 60 * 60 * 1000
    case 'off':
    default:
      return null
  }
}

/**
 * Scheduled driver for QuickBooks auto-sync
 * Runs every 30 minutes and triggers inventory sync / product import
 * based on per-workspace auto-sync configuration.
 */
export const runQuickBooksAutoSync = onSchedule('every 30 minutes', async () => {
  const db = admin.firestore()
  const now = Date.now()

  const workspacesSnap = await db.collection('workspaces').get()

  for (const workspace of workspacesSnap.docs) {
    const workspaceId = workspace.id

    try {
      const qbConfig = await getQBConfig(workspaceId)
      if (!qbConfig?.accessToken || !qbConfig.realmId) {
        continue
      }

      const autoSyncConfig =
        (await getQuickBooksAutoSyncConfig(workspaceId)) ??
        ({
          inventorySyncInterval: 'off',
          productImportInterval: 'off',
        } as QuickBooksAutoSyncConfig)

      const inventoryIntervalMs = intervalToMs(autoSyncConfig.inventorySyncInterval)
      const productIntervalMs = intervalToMs(autoSyncConfig.productImportInterval)

      const autoSyncRef = db.doc(`workspaces/${workspaceId}/settings/quickbooksAutoSync`)

      // Inventory sync
      if (inventoryIntervalMs) {
        const last = autoSyncConfig.lastInventorySyncAt?.toMillis?.() ?? 0
        if (!last || now - last >= inventoryIntervalMs) {
          const startedAt = admin.firestore.FieldValue.serverTimestamp()
          try {
            await syncInventoryFromQB(workspaceId)
            await autoSyncRef.set(
              {
                lastInventorySyncAt: admin.firestore.FieldValue.serverTimestamp(),
                inventorySyncInterval: autoSyncConfig.inventorySyncInterval,
              },
              { merge: true }
            )
            await db.collection(`workspaces/${workspaceId}/quickbooksLogs`).add({
              type: 'inventory_sync',
              trigger: 'auto',
              status: 'success',
              startedAt,
              finishedAt: admin.firestore.FieldValue.serverTimestamp(),
            })
          } catch (error: any) {
            console.error(
              '[runQuickBooksAutoSync] Inventory sync failed for workspace',
              workspaceId,
              error
            )
            await db.collection(`workspaces/${workspaceId}/quickbooksLogs`).add({
              type: 'inventory_sync',
              trigger: 'auto',
              status: 'failed',
              startedAt,
              finishedAt: admin.firestore.FieldValue.serverTimestamp(),
              errorMessage: error?.message || String(error),
            })
          }
        }
      }

      // Product import (full, without SKU filtering)
      if (productIntervalMs) {
        const last = autoSyncConfig.lastProductImportAt?.toMillis?.() ?? 0
        if (!last || now - last >= productIntervalMs) {
          const startedAt = admin.firestore.FieldValue.serverTimestamp()
          try {
            const result = await importProductsFromQB(workspaceId)
            await autoSyncRef.set(
              {
                lastProductImportAt: admin.firestore.FieldValue.serverTimestamp(),
                productImportInterval: autoSyncConfig.productImportInterval,
              },
              { merge: true }
            )
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
            })
          } catch (error: any) {
            console.error(
              '[runQuickBooksAutoSync] Product import failed for workspace',
              workspaceId,
              error
            )
            await db.collection(`workspaces/${workspaceId}/quickbooksLogs`).add({
              type: 'product_import',
              trigger: 'auto',
              status: 'failed',
              startedAt,
              finishedAt: admin.firestore.FieldValue.serverTimestamp(),
              errorMessage: error?.message || String(error),
            })
          }
        }
      }
    } catch (err) {
      console.error('[runQuickBooksAutoSync] Error handling workspace', workspaceId, err)
    }
  }
})

/**
 * Get QuickBooks items
 */
export const getQuickBooksItems = onCall(async (request) => {
  const { workspaceId } = request.data
  const userId = request.auth?.uid
  if (!userId) throw new Error('Unauthenticated')
  if (!workspaceId) throw new Error('workspaceId is required')

  try {
    const items = await getQBItems(workspaceId)
    console.log(`[getQuickBooksItems] Returning ${items.length} items`)
    return { items }
  } catch (error: any) {
    console.error('[getQuickBooksItems] Error:', error)
    throw new Error(`Failed to get QuickBooks items: ${error.message || 'Unknown error'}`)
  }
})

/**
 * Create invoice in QuickBooks
 */
export const createQuickBooksInvoice = onCall(async (request) => {
  const { workspaceId, invoice } = request.data
  const userId = request.auth?.uid
  if (!userId) throw new Error('Unauthenticated')
  if (!workspaceId || !invoice) {
    throw new Error('workspaceId and invoice are required')
  }

  const invoiceId = await createQBInvoice(workspaceId, invoice)
  return { invoiceId }
})

// ===== TEAM INVITATIONS =====

/**
 * Email transporter setup (using environment variables or default SMTP)
 */
function getEmailTransporter() {
  // For production, use environment variables:
  // SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS
  // For development/testing, you can use a service like Ethereal Email or Gmail
  
  const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com'
  const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10)
  const smtpUser = process.env.SMTP_USER || ''
  const smtpPass = process.env.SMTP_PASS || ''
  
  if (!smtpUser || !smtpPass) {
    console.warn('[getEmailTransporter] SMTP credentials not configured. Email sending will fail.')
    console.warn('Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS environment variables.')
  }
  
  return nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  })
}

/**
 * Send workspace invitation email
 */
export const sendWorkspaceInvitation = onCall(async (request) => {
  const { workspaceId, email, role, inviterName, workspaceName } = request.data
  const userId = request.auth?.uid
  
  if (!userId) throw new Error('Unauthenticated')
  if (!workspaceId || !email || !role) {
    throw new Error('workspaceId, email, and role are required')
  }
  
  const db = admin.firestore()
  
  // Verify user is owner of the workspace
  const userDoc = await db.doc(`workspaces/${workspaceId}/users/${userId}`).get()
  if (!userDoc.exists) {
    throw new Error('User not found in workspace')
  }
  
  const userData = userDoc.data()
  if (userData?.role !== 'owner') {
    throw new Error('Only workspace owners can send invitations')
  }
  
  // Check if user already exists in workspace
  const existingUserQuery = await db
    .collection('users')
    .where('email', '==', email.toLowerCase())
    .limit(1)
    .get()
  
  let existingUserId: string | null = null
  if (!existingUserQuery.empty) {
    existingUserId = existingUserQuery.docs[0].id
    const existingWorkspaceUser = await db
      .doc(`workspaces/${workspaceId}/users/${existingUserId}`)
      .get()
    if (existingWorkspaceUser.exists) {
      throw new Error('User is already a member of this workspace')
    }
  }
  
  // Generate a secure invitation token
  const token = `${workspaceId}-${Date.now()}-${Math.random().toString(36).substring(2, 15)}-${Math.random().toString(36).substring(2, 15)}`
  
  // Create invitation document
  const invitationRef = db.collection(`workspaces/${workspaceId}/invitations`).doc()
  const invitationData = {
    email: email.toLowerCase(),
    role,
    token,
    status: 'pending',
    createdBy: userId,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    expiresAt: admin.firestore.Timestamp.fromDate(
      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
    ),
    existingUserId, // If user already has account
  }
  
  await invitationRef.set(invitationData)
  
  // Send email
  try {
    const transporter = getEmailTransporter()
    const appUrl = process.env.APP_URL || 'http://localhost:5173'
    const invitationLink = `${appUrl}/accept-invitation?token=${token}&workspaceId=${workspaceId}`
    
    const mailOptions = {
      from: `"${workspaceName || 'Inventory System'}" <${process.env.SMTP_USER || 'noreply@inventory.com'}>`,
      to: email,
      subject: `You've been invited to join ${workspaceName || 'a workspace'}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Workspace Invitation</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0;">You've Been Invited!</h1>
          </div>
          <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
            <p>Hello,</p>
            <p><strong>${inviterName || 'A workspace owner'}</strong> has invited you to join <strong>${workspaceName || 'their workspace'}</strong> as a <strong>${role}</strong>.</p>
            <p style="text-align: center; margin: 30px 0;">
              <a href="${invitationLink}" 
                 style="background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
                Accept Invitation
              </a>
            </p>
            <p style="font-size: 12px; color: #666;">
              Or copy and paste this link into your browser:<br>
              <a href="${invitationLink}" style="color: #667eea; word-break: break-all;">${invitationLink}</a>
            </p>
            <p style="font-size: 12px; color: #999; margin-top: 30px; border-top: 1px solid #ddd; padding-top: 20px;">
              This invitation will expire in 7 days. If you didn't expect this invitation, you can safely ignore this email.
            </p>
          </div>
        </body>
        </html>
      `,
      text: `
        Hello,
        
        ${inviterName || 'A workspace owner'} has invited you to join ${workspaceName || 'their workspace'} as a ${role}.
        
        Click here to accept: ${invitationLink}
        
        This invitation will expire in 7 days.
      `,
    }
    
    await transporter.sendMail(mailOptions)
    console.log(`[sendWorkspaceInvitation] Email sent to ${email}`)
  } catch (error: any) {
    console.error('[sendWorkspaceInvitation] Failed to send email:', error)
    // Don't throw - invitation is still created in database
    // User can resend email later
  }
  
  return {
    success: true,
    invitationId: invitationRef.id,
    token,
  }
})

/**
 * Accept workspace invitation
 */
export const acceptWorkspaceInvitation = onCall(async (request) => {
  const { token, workspaceId, userId } = request.data
  
  if (!token || !workspaceId || !userId) {
    throw new Error('token, workspaceId, and userId are required')
  }
  
  const db = admin.firestore()
  
  // Find invitation
  const invitationsRef = db.collection(`workspaces/${workspaceId}/invitations`)
  const invitationsQuery = await invitationsRef
    .where('token', '==', token)
    .where('status', '==', 'pending')
    .limit(1)
    .get()
  
  if (invitationsQuery.empty) {
    throw new Error('Invalid or expired invitation')
  }
  
  const invitationDoc = invitationsQuery.docs[0]
  const invitation = invitationDoc.data()
  
  // Check expiration
  const expiresAt = invitation.expiresAt?.toMillis?.() || 0
  if (expiresAt < Date.now()) {
    await invitationDoc.ref.update({ status: 'expired' })
    throw new Error('Invitation has expired')
  }
  
  // Verify email matches
  const userDoc = await db.doc(`users/${userId}`).get()
  if (!userDoc.exists) {
    throw new Error('User not found')
  }
  
  const userData = userDoc.data()
  if (userData?.email?.toLowerCase() !== invitation.email.toLowerCase()) {
    throw new Error('Invitation email does not match your account email')
  }
  
  // Add user to workspace
  const { getRolePermissions, getRoleScreens } = await import('./role-permissions.js')
  const permissions = await getRolePermissions(workspaceId, invitation.role)
  const screens = await getRoleScreens(workspaceId, invitation.role)
  
  await db.doc(`workspaces/${workspaceId}/users/${userId}`).set({
    role: invitation.role,
    permissions,
    screens,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    createdBy: invitation.createdBy,
  })
  
  // Update invitation status
  await invitationDoc.ref.update({
    status: 'accepted',
    acceptedAt: admin.firestore.FieldValue.serverTimestamp(),
    acceptedBy: userId,
  })
  
  return { success: true }
})

