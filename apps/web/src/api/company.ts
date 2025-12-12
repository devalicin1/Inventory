import { db } from '../lib/firebase'
import {
  getDoc,
  doc,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore'

export interface CompanyInformation {
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
  taxId?: string
  registrationNumber?: string
  website?: string
  notes?: string
  updatedAt: Date | any
}

export interface CompanyInformationInput {
  name: string
  address1?: string
  address2?: string
  city?: string
  state?: string
  zipCode?: string
  country?: string
  email?: string
  phoneNumber?: string
  taxId?: string
  registrationNumber?: string
  website?: string
  notes?: string
}

// Get company information
export async function getCompanyInformation(workspaceId: string): Promise<CompanyInformation | null> {
  try {
    const docRef = doc(db, 'workspaces', workspaceId, 'company', 'information')
    const docSnap = await getDoc(docRef)
    
    if (!docSnap.exists()) {
      return null
    }
    
    return { id: docSnap.id, ...(docSnap.data() as any) } as CompanyInformation
  } catch (error) {
    console.error('Error fetching company information:', error)
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

// Update company information
export async function updateCompanyInformation(
  workspaceId: string,
  data: CompanyInformationInput
): Promise<CompanyInformation> {
  try {
    const docRef = doc(db, 'workspaces', workspaceId, 'company', 'information')
    const cleanedData = removeUndefined(data)
    await setDoc(docRef, {
      ...cleanedData,
      updatedAt: serverTimestamp(),
    }, { merge: true })
    
    const docSnap = await getDoc(docRef)
    return { id: docSnap.id, ...(docSnap.data() as any) } as CompanyInformation
  } catch (error) {
    console.error('Error updating company information:', error)
    throw error
  }
}
