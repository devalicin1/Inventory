import { db } from '../lib/firebase'
import {
  addDoc,
  collection,
  getDocs,
  getDoc,
  doc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  where,
  serverTimestamp,
  limit,
  DocumentSnapshot,
  startAfter,
  onSnapshot,
  Timestamp,
} from 'firebase/firestore'

export type PurchaseOrderStatus = 'Draft' | 'Submitted' | 'Approved' | 'Ordered' | 'Partially Received' | 'Received' | 'Cancelled'

export interface PurchaseOrderLineItem {
  id?: string
  productId?: string
  itemDescription: string
  partNumber?: string
  orderQuantity: number
  uom?: string
  unitRate: number
  amount: number
  quantityReceived?: number
  dateReceived?: Date | Timestamp
}

export interface Vendor {
  id?: string
  name: string
  address1?: string
  address2?: string
  city?: string
  state?: string
  zipCode?: string
  country?: string
  email?: string
  phoneNumber?: string
}

export interface Address {
  name: string
  address1: string
  address2?: string
  city: string
  state?: string
  zipCode: string
  country: string
}

export interface PurchaseOrder {
  id: string
  poNumber: string
  status: PurchaseOrderStatus
  orderTotal: number
  vendor?: Vendor
  lineItems: PurchaseOrderLineItem[]
  dates: {
    submittedBy?: string
    dateExpected?: Date | Timestamp
    approvedBy?: string
    dateOrdered?: Date | Timestamp
    dateReceived?: Date | Timestamp
  }
  shipTo?: Address
  billTo?: Address
  notes?: string
  createdBy?: string
  createdAt: Date | Timestamp
  updatedAt: Date | Timestamp
  lastUpdated?: Date | Timestamp
}

// Generate PO number
async function generatePONumber(workspaceId: string): Promise<string> {
  const col = collection(db, 'workspaces', workspaceId, 'purchaseOrders')
  const q = query(col, orderBy('createdAt', 'desc'), limit(1))
  const snap = await getDocs(q)
  
  if (snap.empty) {
    return 'PO-000001'
  }
  
  const lastPO = snap.docs[0].data() as PurchaseOrder
  const lastNumber = parseInt(lastPO.poNumber.replace('PO-', ''))
  const nextNumber = (lastNumber + 1).toString().padStart(6, '0')
  return `PO-${nextNumber}`
}

// Helper function to remove undefined values (Firestore doesn't accept undefined)
const removeUndefined = (obj: any): any => {
  const cleaned: any = {}
  for (const key in obj) {
    if (obj[key] !== undefined) {
      if (typeof obj[key] === 'object' && obj[key] !== null && !(obj[key] instanceof Date) && !(obj[key] as any)?.toDate) {
        cleaned[key] = removeUndefined(obj[key])
      } else {
        cleaned[key] = obj[key]
      }
    }
  }
  return cleaned
}

// Create a new purchase order
export async function createPurchaseOrder(
  workspaceId: string,
  data: Omit<PurchaseOrder, 'id' | 'poNumber' | 'createdAt' | 'updatedAt' | 'lastUpdated'>
): Promise<PurchaseOrder> {
  const poNumber = await generatePONumber(workspaceId)
  const col = collection(db, 'workspaces', workspaceId, 'purchaseOrders')
  
  const poData = {
    ...data,
    poNumber,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    lastUpdated: serverTimestamp(),
  }
  
  const cleanedData = removeUndefined(poData)
  const docRef = await addDoc(col, cleanedData)
  const docSnap = await getDoc(docRef)
  return { id: docSnap.id, ...(docSnap.data() as any) } as PurchaseOrder
}

// Helper function to convert Firestore Timestamps to Date objects
const convertTimestamps = (data: any): any => {
  if (data === null || data === undefined) return data
  
  // Check if it's a serverTimestamp placeholder (must check this FIRST)
  if (data._methodName === 'serverTimestamp' || (typeof data === 'object' && data._methodName === 'serverTimestamp')) {
    return undefined // Return undefined for unresolved serverTimestamp
  }
  
  // Check if it's a Firestore Timestamp (must check this BEFORE checking for object)
  if (data.toDate && typeof data.toDate === 'function') {
    return data.toDate()
  }
  
  // Check if it's a Firestore Timestamp object with seconds (must check this BEFORE checking for object)
  if (data.seconds !== undefined && typeof data.seconds === 'number') {
    // Handle nanoseconds if present (convert to milliseconds)
    const milliseconds = data.seconds * 1000 + (data.nanoseconds ? Math.floor(data.nanoseconds / 1000000) : 0)
    return new Date(milliseconds)
  }
  
  // Already a Date object
  if (data instanceof Date) {
    return data
  }
  
  // Handle arrays FIRST (before object check, because arrays are objects in JS)
  if (Array.isArray(data)) {
    return data.map((item) => convertTimestamps(item))
  }
  
  // Handle objects (but not Date objects or arrays)
  if (typeof data === 'object' && data !== null && !(data instanceof Date)) {
    // Check if this looks like an array stored as object (e.g., {0: {...}, 1: {...}})
    const keys = Object.keys(data)
    const numericKeys = keys.filter(k => !isNaN(parseInt(k)) && parseInt(k).toString() === k)
    
    // If all keys are numeric and sequential (or mostly numeric), treat as array
    if (numericKeys.length > 0 && numericKeys.length === keys.length) {
      const arrayData = numericKeys
        .sort((a, b) => parseInt(a) - parseInt(b))
        .map(key => convertTimestamps(data[key]))
      return arrayData
    }
    
    // Regular object conversion
    const converted: any = {}
    for (const key in data) {
      if (data.hasOwnProperty(key)) {
        converted[key] = convertTimestamps(data[key])
      }
    }
    return converted
  }
  
  // Primitive values (string, number, boolean, etc.)
  return data
}

// Get a single purchase order
export async function getPurchaseOrder(
  workspaceId: string,
  poId: string
): Promise<PurchaseOrder | null> {
  const docRef = doc(db, 'workspaces', workspaceId, 'purchaseOrders', poId)
  const docSnap = await getDoc(docRef)
  
  if (!docSnap.exists()) {
    return null
  }
  
  const rawData = docSnap.data()
  console.log('[getPurchaseOrder] Raw data from Firestore:', rawData)
  console.log('[getPurchaseOrder] Raw lineItems:', rawData?.lineItems, 'type:', typeof rawData?.lineItems, 'isArray:', Array.isArray(rawData?.lineItems))
  
  const convertedData = convertTimestamps(rawData)
  console.log('[getPurchaseOrder] Converted data:', convertedData)
  console.log('[getPurchaseOrder] Converted lineItems:', convertedData?.lineItems, 'type:', typeof convertedData?.lineItems, 'isArray:', Array.isArray(convertedData?.lineItems))
  
  const result = { id: docSnap.id, ...convertedData } as PurchaseOrder
  console.log('[getPurchaseOrder] Final result lineItems:', result.lineItems, 'length:', result.lineItems?.length || 0)
  
  return result
}

// List purchase orders
export async function listPurchaseOrders(
  workspaceId: string,
  filters?: {
    status?: PurchaseOrderStatus[]
    vendorId?: string
  },
  pagination?: {
    limit?: number
    startAfter?: DocumentSnapshot
  }
): Promise<{ purchaseOrders: PurchaseOrder[]; lastDoc?: DocumentSnapshot }> {
  try {
    const constraints: any[] = []
    
    if (filters?.status && filters.status.length > 0) {
      constraints.push(where('status', 'in', filters.status))
    }
    if (filters?.vendorId) {
      constraints.push(where('vendor.id', '==', filters.vendorId))
    }
    
    constraints.push(orderBy('createdAt', 'desc'))
    
    if (pagination?.limit) {
      constraints.push(limit(pagination.limit))
    }
    if (pagination?.startAfter) {
      constraints.push(startAfter(pagination.startAfter))
    }
    
    const col = collection(db, 'workspaces', workspaceId, 'purchaseOrders')
    const q = query(col, ...constraints)
    const snap = await getDocs(q)
    
    const purchaseOrders = snap.docs.map((d) => {
      const rawData = d.data()
      const convertedData = convertTimestamps(rawData)
      return {
        id: d.id,
        ...convertedData,
      } as PurchaseOrder
    })
    
    return {
      purchaseOrders,
      lastDoc: snap.docs[snap.docs.length - 1] as DocumentSnapshot | undefined,
    }
  } catch (error) {
    console.error('Error fetching purchase orders:', error)
    throw error
  }
}

// Update purchase order
export async function updatePurchaseOrder(
  workspaceId: string,
  poId: string,
  data: Partial<PurchaseOrder>
): Promise<void> {
  const docRef = doc(db, 'workspaces', workspaceId, 'purchaseOrders', poId)
  const cleanedData = removeUndefined(data)
  await updateDoc(docRef, {
    ...cleanedData,
    updatedAt: serverTimestamp(),
    lastUpdated: serverTimestamp(),
  } as any)
}

// Delete purchase order
export async function deletePurchaseOrder(
  workspaceId: string,
  poId: string
): Promise<void> {
  const docRef = doc(db, 'workspaces', workspaceId, 'purchaseOrders', poId)
  await deleteDoc(docRef)
}

// Subscribe to purchase orders (real-time)
export function subscribeToPurchaseOrders(
  workspaceId: string,
  callback: (purchaseOrders: PurchaseOrder[]) => void,
  onError?: (error: Error) => void
): () => void {
  const col = collection(db, 'workspaces', workspaceId, 'purchaseOrders')
  const q = query(col, orderBy('createdAt', 'desc'))
  
  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      const purchaseOrders = snapshot.docs.map((d) => {
        const rawData = d.data()
        const convertedData = convertTimestamps(rawData)
        return {
          id: d.id,
          ...convertedData,
        } as PurchaseOrder
      })
      callback(purchaseOrders)
    },
    (error) => {
      console.error('[subscribeToPurchaseOrders] Error:', error)
      if (onError) {
        onError(error as Error)
      }
    }
  )
  
  return unsubscribe
}
