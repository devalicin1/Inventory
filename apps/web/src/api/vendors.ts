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
  serverTimestamp,
  onSnapshot,
} from 'firebase/firestore'

export interface Vendor {
  id: string
  name: string
  address1?: string
  address2?: string
  city?: string
  state?: string
  zipCode?: string
  country?: string
  email?: string
  phoneNumber?: string
  notes?: string
  createdAt: Date | any
  updatedAt: Date | any
}

export interface VendorInput {
  name: string
  address1?: string
  address2?: string
  city?: string
  state?: string
  zipCode?: string
  country?: string
  email?: string
  phoneNumber?: string
  notes?: string
}

// List vendors
export async function listVendors(workspaceId: string): Promise<Vendor[]> {
  try {
    const col = collection(db, 'workspaces', workspaceId, 'vendors')
    const q = query(col, orderBy('name'))
    const snap = await getDocs(q)
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Vendor[]
  } catch (error) {
    console.error('Error fetching vendors:', error)
    throw error
  }
}

// Get a single vendor
export async function getVendor(workspaceId: string, vendorId: string): Promise<Vendor | null> {
  try {
    const docRef = doc(db, 'workspaces', workspaceId, 'vendors', vendorId)
    const docSnap = await getDoc(docRef)
    
    if (!docSnap.exists()) {
      return null
    }
    
    return { id: docSnap.id, ...(docSnap.data() as any) } as Vendor
  } catch (error) {
    console.error('Error fetching vendor:', error)
    throw error
  }
}

// Helper function to remove undefined values (Firestore doesn't accept undefined)
const removeUndefined = (obj: any): any => {
  const cleaned: any = {}
  for (const key in obj) {
    if (obj[key] !== undefined) {
      cleaned[key] = obj[key]
    }
  }
  return cleaned
}

// Create vendor
export async function createVendor(workspaceId: string, data: VendorInput): Promise<Vendor> {
  try {
    const col = collection(db, 'workspaces', workspaceId, 'vendors')
    const cleanedData = removeUndefined(data)
    const docRef = await addDoc(col, {
      ...cleanedData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    const docSnap = await getDoc(docRef)
    return { id: docSnap.id, ...(docSnap.data() as any) } as Vendor
  } catch (error) {
    console.error('Error creating vendor:', error)
    throw error
  }
}

// Update vendor
export async function updateVendor(workspaceId: string, vendorId: string, data: Partial<VendorInput>): Promise<void> {
  try {
    const docRef = doc(db, 'workspaces', workspaceId, 'vendors', vendorId)
    const cleanedData = removeUndefined(data)
    await updateDoc(docRef, {
      ...cleanedData,
      updatedAt: serverTimestamp(),
    } as any)
  } catch (error) {
    console.error('Error updating vendor:', error)
    throw error
  }
}

// Delete vendor
export async function deleteVendor(workspaceId: string, vendorId: string): Promise<void> {
  try {
    const docRef = doc(db, 'workspaces', workspaceId, 'vendors', vendorId)
    await deleteDoc(docRef)
  } catch (error) {
    console.error('Error deleting vendor:', error)
    throw error
  }
}

// Subscribe to vendors (real-time)
export function subscribeToVendors(
  workspaceId: string,
  callback: (vendors: Vendor[]) => void,
  onError?: (error: Error) => void
): () => void {
  const col = collection(db, 'workspaces', workspaceId, 'vendors')
  const q = query(col, orderBy('name'))
  
  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      const vendors = snapshot.docs.map((d) => ({
        id: d.id,
        ...(d.data() as any),
      })) as Vendor[]
      callback(vendors)
    },
    (error) => {
      console.error('[subscribeToVendors] Error:', error)
      if (onError) {
        onError(error as Error)
      }
    }
  )
  
  return unsubscribe
}
