import { db } from '../lib/firebase'
import {
  addDoc,
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  where,
  doc,
  updateDoc,
  getDoc,
  increment,
  deleteDoc,
} from 'firebase/firestore'

export type UiTxnType = 'in' | 'out' | 'transfer' | 'adjustment'

function mapUiTypeToServer(type: UiTxnType, qty: number) {
  switch (type) {
    case 'in':
      return { serverType: 'Receive' as const, signedQty: Math.abs(qty) }
    case 'out':
      return { serverType: 'Ship' as const, signedQty: -Math.abs(qty) }
    case 'transfer':
      // Treat transfer as positive to toLoc; client can extend with locations later
      return { serverType: 'Transfer' as const, signedQty: Math.abs(qty) }
    case 'adjustment':
    default:
      // Default to positive adjustment for now
      return { serverType: 'Adjust+' as const, signedQty: Math.abs(qty) }
  }
}

export async function createStockTransaction(params: {
  workspaceId: string
  productId: string
  type: UiTxnType
  qty: number
  userId?: string | null
  reason?: string
  reference?: string
  fromLoc?: string | null
  toLoc?: string | null
  unitCost?: number | null
  refs?: any
}) {
  const { workspaceId, productId, type, qty, userId, reason, reference, fromLoc, toLoc, unitCost } = params
  const { serverType, signedQty } = mapUiTypeToServer(type, qty)
  const col = collection(db, 'workspaces', workspaceId, 'stockTxns')
  await addDoc(col, {
    workspaceId,
    timestamp: serverTimestamp(),
    type: serverType,
    refs: { ...(reference ? { ref: reference } : {}), ...((params as any).refs || {}) },
    productId,
    fromLoc: fromLoc || null,
    toLoc: toLoc || null,
    qty: signedQty,
    unitCost: typeof unitCost === 'number' ? unitCost : null,
    userId: userId || 'anonymous',
    reason: reason || '',
  } as any)

  // Keep the product's aggregated qtyOnHand field in sync with transactions so
  // inventory lists and real-time subscriptions always see the latest stock.
  try {
    const productRef = doc(db, 'workspaces', workspaceId, 'products', productId)
    await updateDoc(productRef, {
      qtyOnHand: increment(signedQty),
    } as any)
  } catch (e) {
    // If this fails we still keep the transaction history; callers can
    // recalculate using recalculateProductStock to repair any inconsistencies.
    console.warn('[createStockTransaction] Failed to increment qtyOnHand:', e)
  }
}

export interface StockTxn {
  id: string
  timestamp: any
  type: string
  productId: string
  qty: number
  userId?: string
  reason?: string
  refs?: any
}

export async function listProductStockTxns(
  workspaceId: string,
  productId: string,
  max: number = 50
): Promise<StockTxn[]> {
  const col = collection(db, 'workspaces', workspaceId, 'stockTxns')
  const qy = query(col, where('productId', '==', productId), orderBy('timestamp', 'desc'), limit(max))
  const snap = await getDocs(qy)
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as StockTxn[]
}

export async function listAllStockTxns(
  workspaceId: string,
  max: number = 50
): Promise<StockTxn[]> {
  const col = collection(db, 'workspaces', workspaceId, 'stockTxns')
  const qy = query(col, orderBy('timestamp', 'desc'), limit(max))
  const snap = await getDocs(qy)
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as StockTxn[]
}

export async function getProductOnHand(workspaceId: string, productId: string): Promise<number> {
  // Calculate on-hand quantity from ALL transaction history (not limited)
  // Use where query without orderBy to avoid index requirement and get all transactions
  const txnsCol = collection(db, 'workspaces', workspaceId, 'stockTxns')
  const txnsQuery = query(
    txnsCol,
    where('productId', '==', productId)
  )
  const txnsSnap = await getDocs(txnsQuery)
  
  // Sum all transaction quantities
  // Handle both signed qty (new format) and unsigned qty with type (old format) for backward compatibility
  let totalQty = 0
  txnsSnap.docs.forEach(txnDoc => {
    const txn = txnDoc.data()
    const txnQty = Number(txn.qty || 0)
    const txnType = txn.type
    
    // If qty is already signed (negative for OUT transactions), use it directly
    // Otherwise, determine sign from type (for backward compatibility)
    let deltaQty = txnQty
    if (txnQty >= 0) {
      // qty is positive, determine sign from type
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
    totalQty += deltaQty
  })
  
  return totalQty
}

export interface ListedProduct {
  id: string
  name: string
  sku: string
  uom: string
  minStock: number
  reorderPoint: number
  status: string
  qtyOnHand?: number
  [key: string]: any
}

// Lists products and enriches each with current qtyOnHand by calculating from transaction history
export async function listProducts(workspaceId: string): Promise<ListedProduct[]> {
  const productsCol = collection(db, 'workspaces', workspaceId, 'products')
  const prodSnap = await getDocs(query(productsCol, orderBy('name')))

  // Calculate on-hand quantity for each product from transaction history
  const productsWithStock = await Promise.all(
    prodSnap.docs.map(async (d) => {
      const data = d.data() as any
      const onHand = await getProductOnHand(workspaceId, d.id)
      return {
        id: d.id,
        ...data,
        qtyOnHand: onHand,
      } as ListedProduct
    })
  )

  return productsWithStock
}

export async function getProductByCode(workspaceId: string, code: string): Promise<ListedProduct | null> {
  const productsCol = collection(db, 'workspaces', workspaceId, 'products')

  // Try finding by SKU first
  const skuQuery = query(productsCol, where('sku', '==', code), limit(1))
  const skuSnap = await getDocs(skuQuery)

  if (!skuSnap.empty) {
    const d = skuSnap.docs[0]
    const data = d.data() as any
    const onHand = await getProductOnHand(workspaceId, d.id)
    return { id: d.id, ...data, qtyOnHand: onHand } as ListedProduct
  }

  // If not found by SKU, try ID
  try {
    const docRef = doc(db, 'workspaces', workspaceId, 'products', code)
    const docSnap = await getDoc(docRef)
    if (docSnap.exists()) {
      const data = docSnap.data() as any
      const onHand = await getProductOnHand(workspaceId, docSnap.id)
      return { id: docSnap.id, ...data, qtyOnHand: onHand } as ListedProduct
    }
  } catch (e) {
    // Ignore invalid ID format errors
  }

  return null
}

/**
 * Recalculates qtyOnHand for a specific product based on transaction history
 */
export async function recalculateProductStock(workspaceId: string, productId: string): Promise<number> {
  // Get all transactions for this product (without orderBy to avoid index requirement)
  const txnsCol = collection(db, 'workspaces', workspaceId, 'stockTxns')
  const txnsQuery = query(
    txnsCol,
    where('productId', '==', productId)
  )
  const txnsSnap = await getDocs(txnsQuery)

  // Calculate total from transactions using the same logic as getProductOnHand
  let calculatedQty = 0
  txnsSnap.docs.forEach(txnDoc => {
    const txn = txnDoc.data()
    const txnQty = Number(txn.qty || 0)
    const txnType = txn.type
    
    // Handle both signed qty (new format) and unsigned qty with type (old format)
    let deltaQty = txnQty
    if (txnQty >= 0) {
      // qty is positive, determine sign from type
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

  // Update the product document
  const productRef = doc(db, 'workspaces', workspaceId, 'products', productId)
  await updateDoc(productRef, {
    qtyOnHand: calculatedQty
  })

  console.log(`Product ${productId}: Recalculated qtyOnHand = ${calculatedQty} (from ${txnsSnap.size} transactions)`)

  return calculatedQty
}

/**
 * Delete a stock transaction and recalculate product stock
 * Only owners can delete transactions
 */
export async function deleteStockTransaction(
  workspaceId: string,
  transactionId: string,
  productId: string
): Promise<void> {
  // Delete the transaction
  const txnRef = doc(db, 'workspaces', workspaceId, 'stockTxns', transactionId)
  await deleteDoc(txnRef)

  // Recalculate product stock after deletion
  await recalculateProductStock(workspaceId, productId)
}

