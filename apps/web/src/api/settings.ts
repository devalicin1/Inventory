import { db } from '../lib/firebase'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore'

// UOM (Unit of Measure) functions
export interface UOM {
  id: string
  name: string
  symbol: string
  description?: string
  createdAt?: any
  updatedAt?: any
}

export async function listUOMs(workspaceId: string): Promise<UOM[]> {
  const col = collection(db, 'workspaces', workspaceId, 'uoms')
  const qy = query(col, orderBy('name'))
  const snap = await getDocs(qy)
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as UOM[]
}

export async function createUOM(workspaceId: string, data: { name: string; symbol: string; description?: string }): Promise<string> {
  const col = collection(db, 'workspaces', workspaceId, 'uoms')
  const ref = await addDoc(col, {
    name: data.name.trim(),
    symbol: data.symbol.trim(),
    description: data.description?.trim() || null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  } as any)
  return ref.id
}

export async function updateUOM(workspaceId: string, id: string, data: { name: string; symbol: string; description?: string }): Promise<void> {
  await updateDoc(doc(db, 'workspaces', workspaceId, 'uoms', id), {
    name: data.name.trim(),
    symbol: data.symbol.trim(),
    description: data.description?.trim() || null,
    updatedAt: serverTimestamp(),
  } as any)
}

export async function deleteUOM(workspaceId: string, id: string): Promise<void> {
  await deleteDoc(doc(db, 'workspaces', workspaceId, 'uoms', id))
}

// Category functions
export interface Category {
  id: string
  name: string
  description?: string
  createdAt?: any
  updatedAt?: any
}

export async function listCategories(workspaceId: string): Promise<Category[]> {
  const col = collection(db, 'workspaces', workspaceId, 'categories')
  const qy = query(col, orderBy('name'))
  const snap = await getDocs(qy)
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Category[]
}

export async function createCategory(workspaceId: string, data: { name: string; description?: string }): Promise<string> {
  const col = collection(db, 'workspaces', workspaceId, 'categories')
  const ref = await addDoc(col, {
    name: data.name.trim(),
    description: data.description?.trim() || null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  } as any)
  return ref.id
}

export async function updateCategory(workspaceId: string, id: string, data: { name: string; description?: string }): Promise<void> {
  await updateDoc(doc(db, 'workspaces', workspaceId, 'categories', id), {
    name: data.name.trim(),
    description: data.description?.trim() || null,
    updatedAt: serverTimestamp(),
  } as any)
}

export async function deleteCategory(workspaceId: string, id: string): Promise<void> {
  await deleteDoc(doc(db, 'workspaces', workspaceId, 'categories', id))
}

// Subcategory functions
export interface Subcategory {
  id: string
  name: string
  categoryId: string
  description?: string
  createdAt?: any
  updatedAt?: any
}

export async function listSubcategories(workspaceId: string): Promise<Subcategory[]> {
  const col = collection(db, 'workspaces', workspaceId, 'subcategories')
  const qy = query(col, orderBy('name'))
  const snap = await getDocs(qy)
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Subcategory[]
}

export async function createSubcategory(workspaceId: string, data: { name: string; categoryId: string; description?: string }): Promise<string> {
  const col = collection(db, 'workspaces', workspaceId, 'subcategories')
  const ref = await addDoc(col, {
    name: data.name.trim(),
    categoryId: data.categoryId,
    description: data.description?.trim() || null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  } as any)
  return ref.id
}

export async function updateSubcategory(workspaceId: string, id: string, data: { name: string; categoryId: string; description?: string }): Promise<void> {
  await updateDoc(doc(db, 'workspaces', workspaceId, 'subcategories', id), {
    name: data.name.trim(),
    categoryId: data.categoryId,
    description: data.description?.trim() || null,
    updatedAt: serverTimestamp(),
  } as any)
}

export async function deleteSubcategory(workspaceId: string, id: string): Promise<void> {
  await deleteDoc(doc(db, 'workspaces', workspaceId, 'subcategories', id))
}

// Custom Field functions
export interface CustomField {
  id: string
  name: string
  type: 'text' | 'number' | 'date' | 'boolean' | 'select'
  options?: string[]
  required: boolean
  active: boolean
  groupId?: string // Optional - if null, applies to all groups
  createdAt?: any
  updatedAt?: any
}

export async function listCustomFields(workspaceId: string): Promise<CustomField[]> {
  const col = collection(db, 'workspaces', workspaceId, 'customFields')
  const qy = query(col, orderBy('name'))
  const snap = await getDocs(qy)
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as CustomField[]
}

export async function createCustomField(workspaceId: string, data: { 
  name: string; 
  type: 'text' | 'number' | 'date' | 'boolean' | 'select';
  options?: string[];
  required: boolean;
  active: boolean;
  groupId?: string;
}): Promise<string> {
  const col = collection(db, 'workspaces', workspaceId, 'customFields')
  const ref = await addDoc(col, {
    name: data.name.trim(),
    type: data.type,
    options: data.type === 'select' ? (data.options || []) : null,
    required: data.required,
    active: data.active,
    groupId: data.groupId || null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  } as any)
  return ref.id
}

export async function updateCustomField(workspaceId: string, id: string, data: { 
  name: string; 
  type: 'text' | 'number' | 'date' | 'boolean' | 'select';
  options?: string[];
  required: boolean;
  active: boolean;
  groupId?: string;
}): Promise<void> {
  await updateDoc(doc(db, 'workspaces', workspaceId, 'customFields', id), {
    name: data.name.trim(),
    type: data.type,
    options: data.type === 'select' ? (data.options || []) : null,
    required: data.required,
    active: data.active,
    groupId: data.groupId || null,
    updatedAt: serverTimestamp(),
  } as any)
}

export async function deleteCustomField(workspaceId: string, id: string): Promise<void> {
  await deleteDoc(doc(db, 'workspaces', workspaceId, 'customFields', id))
}

// Stock Operation Reason functions
export interface StockReason {
  id: string
  name: string
  operationType: 'stock_in' | 'stock_out' | 'transfer' | 'adjustment'
  description?: string
  active: boolean
  createdAt?: any
  updatedAt?: any
}

export async function listStockReasons(workspaceId: string): Promise<StockReason[]> {
  const col = collection(db, 'workspaces', workspaceId, 'stockReasons')
  const qy = query(col, orderBy('operationType'), orderBy('name'))
  const snap = await getDocs(qy)
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as StockReason[]
}

export async function createStockReason(workspaceId: string, data: { 
  name: string; 
  operationType: 'stock_in' | 'stock_out' | 'transfer' | 'adjustment';
  description?: string;
  active: boolean;
}): Promise<string> {
  const col = collection(db, 'workspaces', workspaceId, 'stockReasons')
  const ref = await addDoc(col, {
    name: data.name.trim(),
    operationType: data.operationType,
    description: data.description?.trim() || null,
    active: Boolean(data.active),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  } as any)
  return ref.id
}

export async function updateStockReason(workspaceId: string, id: string, data: { 
  name: string; 
  operationType: 'stock_in' | 'stock_out' | 'transfer' | 'adjustment';
  description?: string;
  active: boolean;
}): Promise<void> {
  await updateDoc(doc(db, 'workspaces', workspaceId, 'stockReasons', id), {
    name: data.name.trim(),
    operationType: data.operationType,
    description: data.description?.trim() || null,
    active: Boolean(data.active),
    updatedAt: serverTimestamp(),
  } as any)
}

export async function deleteStockReason(workspaceId: string, id: string): Promise<void> {
  await deleteDoc(doc(db, 'workspaces', workspaceId, 'stockReasons', id))
}

// Initialize default stock reasons for a workspace
export async function initializeDefaultStockReasons(workspaceId: string): Promise<void> {
  const defaultReasons = [
    // Stock In reasons
    { name: 'Purchase Order Received', operationType: 'stock_in' as const, description: 'Items received from purchase order' },
    { name: 'Production Completed', operationType: 'stock_in' as const, description: 'Items produced in-house' },
    { name: 'Return from Customer', operationType: 'stock_in' as const, description: 'Items returned by customer' },
    { name: 'Found Inventory', operationType: 'stock_in' as const, description: 'Items found during inventory count' },
    { name: 'Transfer In', operationType: 'stock_in' as const, description: 'Items transferred from another location' },
    
    // Stock Out reasons
    { name: 'Sales Order', operationType: 'stock_out' as const, description: 'Items sold to customer' },
    { name: 'Production Consumption', operationType: 'stock_out' as const, description: 'Items used in production' },
    { name: 'Damaged/Defective', operationType: 'stock_out' as const, description: 'Items damaged or defective' },
    { name: 'Expired', operationType: 'stock_out' as const, description: 'Items past expiration date' },
    { name: 'Transfer Out', operationType: 'stock_out' as const, description: 'Items transferred to another location' },
    { name: 'Sample/Testing', operationType: 'stock_out' as const, description: 'Items used for samples or testing' },
    
    // Transfer reasons
    { name: 'Location Transfer', operationType: 'transfer' as const, description: 'Moving items between locations' },
    { name: 'Bin Transfer', operationType: 'transfer' as const, description: 'Moving items between bins' },
    { name: 'Quality Control', operationType: 'transfer' as const, description: 'Moving items for quality inspection' },
    { name: 'Repackaging', operationType: 'transfer' as const, description: 'Moving items for repackaging' },
    
    // Adjustment reasons
    { name: 'Inventory Count Correction', operationType: 'adjustment' as const, description: 'Correcting inventory count discrepancies' },
    { name: 'Theft/Loss', operationType: 'adjustment' as const, description: 'Adjusting for stolen or lost items' },
    { name: 'System Error', operationType: 'adjustment' as const, description: 'Correcting system calculation errors' },
    { name: 'Write-off', operationType: 'adjustment' as const, description: 'Writing off obsolete or unusable items' },
    { name: 'Revaluation', operationType: 'adjustment' as const, description: 'Adjusting item values' },
  ]

  // Check if reasons already exist
  const existing = await listStockReasons(workspaceId)
  if (existing.length > 0) return

  // Create all default reasons
  for (const reason of defaultReasons) {
    await createStockReason(workspaceId, { ...reason, active: true })
  }
}

// Report Settings functions
export interface ReportSettings {
  rawMaterialGroupIds: string[] // Group IDs that should be treated as raw materials
  updatedAt?: any
}

const DEFAULT_REPORT_SETTINGS: ReportSettings = {
  rawMaterialGroupIds: []
}

export async function getReportSettings(workspaceId: string): Promise<ReportSettings> {
  try {
    const docRef = doc(db, 'workspaces', workspaceId, 'settings', 'reports')
    const docSnap = await getDoc(docRef)
    
    if (docSnap.exists()) {
      const data = docSnap.data()
      return {
        rawMaterialGroupIds: data.rawMaterialGroupIds || [],
        updatedAt: data.updatedAt
      }
    }
    return DEFAULT_REPORT_SETTINGS
  } catch (error) {
    console.error('Error fetching report settings:', error)
    return DEFAULT_REPORT_SETTINGS
  }
}

export async function updateReportSettings(workspaceId: string, settings: Partial<ReportSettings>): Promise<void> {
  try {
    const docRef = doc(db, 'workspaces', workspaceId, 'settings', 'reports')
    const docSnap = await getDoc(docRef)
    
    const settingsData: any = {
      ...(docSnap.exists() ? docSnap.data() : DEFAULT_REPORT_SETTINGS),
      ...settings,
      updatedAt: serverTimestamp()
    }
    
    if (docSnap.exists()) {
      // Update existing document
      await updateDoc(docRef, settingsData)
    } else {
      // Create new document
      await setDoc(docRef, settingsData)
    }
  } catch (error) {
    console.error('Error updating report settings:', error)
    throw error
  }
}
