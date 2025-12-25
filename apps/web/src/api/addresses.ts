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
  onSnapshot,
  type Timestamp,
  type DocumentData,
} from 'firebase/firestore'

export interface Address {
  id: string
  name: string
  address1: string
  address2?: string
  city: string
  state?: string
  zipCode: string
  country: string
  type: 'ship' | 'bill' | 'both'
  notes?: string
  createdAt: Date | Timestamp
  updatedAt: Date | Timestamp
}

export interface AddressInput {
  name: string
  address1: string
  address2?: string
  city: string
  state?: string
  zipCode: string
  country: string
  type: 'ship' | 'bill' | 'both'
  notes?: string
}

// List addresses
export async function listAddresses(
  workspaceId: string,
  type?: 'ship' | 'bill' | 'both'
): Promise<Address[]> {
  try {
    const col = collection(db, 'workspaces', workspaceId, 'addresses')
    let q = query(col, orderBy('name'))
    
    if (type) {
      q = query(col, where('type', 'in', type === 'both' ? ['ship', 'bill', 'both'] : [type, 'both']), orderBy('name'))
    }
    
    const snap = await getDocs(q)
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as DocumentData) })) as Address[]
  } catch (error) {
    console.error('Error fetching addresses:', error)
    throw error
  }
}

// Get a single address
export async function getAddress(workspaceId: string, addressId: string): Promise<Address | null> {
  try {
    const docRef = doc(db, 'workspaces', workspaceId, 'addresses', addressId)
    const docSnap = await getDoc(docRef)
    
    if (!docSnap.exists()) {
      return null
    }
    
    return { id: docSnap.id, ...(docSnap.data() as DocumentData) } as Address
  } catch (error) {
    console.error('Error fetching address:', error)
    throw error
  }
}

// Helper function to remove undefined values (Firestore doesn't accept undefined)
const removeUndefined = <T extends Record<string, unknown>>(obj: T): Partial<T> => {
  const cleaned: Partial<T> = {}
  for (const key in obj) {
    if (obj[key] !== undefined) {
      cleaned[key] = obj[key]
    }
  }
  return cleaned
}

// Create address
export async function createAddress(workspaceId: string, data: AddressInput): Promise<Address> {
  try {
    const col = collection(db, 'workspaces', workspaceId, 'addresses')
    const cleanedData = removeUndefined(data)
    const docRef = await addDoc(col, {
      ...cleanedData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    const docSnap = await getDoc(docRef)
    return { id: docSnap.id, ...(docSnap.data() as DocumentData) } as Address
  } catch (error) {
    console.error('Error creating address:', error)
    throw error
  }
}

// Update address
export async function updateAddress(workspaceId: string, addressId: string, data: Partial<AddressInput>): Promise<void> {
  try {
    const docRef = doc(db, 'workspaces', workspaceId, 'addresses', addressId)
    const cleanedData = removeUndefined(data)
    await updateDoc(docRef, {
      ...cleanedData,
      updatedAt: serverTimestamp(),
    })
  } catch (error) {
    console.error('Error updating address:', error)
    throw error
  }
}

// Delete address
export async function deleteAddress(workspaceId: string, addressId: string): Promise<void> {
  try {
    const docRef = doc(db, 'workspaces', workspaceId, 'addresses', addressId)
    await deleteDoc(docRef)
  } catch (error) {
    console.error('Error deleting address:', error)
    throw error
  }
}

// Subscribe to addresses (real-time)
export function subscribeToAddresses(
  workspaceId: string,
  callback: (addresses: Address[]) => void,
  onError?: (error: Error) => void
): () => void {
  const col = collection(db, 'workspaces', workspaceId, 'addresses')
  const q = query(col, orderBy('name'))
  
  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      const addresses = snapshot.docs.map((d) => ({
        id: d.id,
        ...(d.data() as DocumentData),
      })) as Address[]
      callback(addresses)
    },
    (error) => {
      console.error('[subscribeToAddresses] Error:', error)
      if (onError) {
        onError(error as Error)
      }
    }
  )
  
  return unsubscribe
}
