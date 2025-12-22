import { db } from '../lib/firebase'
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  query,
  orderBy,
} from 'firebase/firestore'
import { addUserToWorkspace } from './workspace-users'

export interface Workspace {
  id: string
  name: string
  currency: string
  timezone: string
  plan: {
    tier: string
    limits: {
      users: number
      skus: number
    }
  }
  createdBy: string
  createdAt: any
  updatedAt: any
}

export interface WorkspaceInput {
  name: string
  currency: string
  timezone: string
}

/**
 * Tüm workspace'leri listele (sadece super admin için)
 */
/**
 * Tüm workspace'leri listele (sadece super admin için)
 */
export async function listWorkspaces(): Promise<Workspace[]> {
  try {
    console.log('=== Fetching all workspaces from Firestore ===')
    const workspacesCol = collection(db, 'workspaces')
    console.log('Collection path:', workspacesCol.path)
    console.log('Collection ID:', workspacesCol.id)
    
    // Önce orderBy olmadan direkt alalım (index sorunlarını önlemek için)
    let snapshot
    try {
      // Direkt collection'dan al (orderBy olmadan) - bu en güvenli yöntem
      console.log('Attempting to fetch without orderBy...')
      snapshot = await getDocs(workspacesCol)
      console.log(`✓ Fetched ${snapshot.docs.length} workspaces (without orderBy)`)
      
      // Eğer sonuç varsa ve createdAt field'ı varsa, orderBy ile tekrar deneyelim
      if (snapshot.docs.length > 0) {
        const firstDoc = snapshot.docs[0].data()
        console.log('First document sample:', {
          id: snapshot.docs[0].id,
          name: firstDoc.name,
          hasCreatedAt: !!firstDoc.createdAt
        })
        
        if (firstDoc.createdAt) {
          try {
            console.log('Attempting to re-fetch with orderBy...')
            const q = query(workspacesCol, orderBy('createdAt', 'desc'))
            const orderedSnapshot = await getDocs(q)
            if (orderedSnapshot.docs.length > 0) {
              console.log(`✓ Re-fetched ${orderedSnapshot.docs.length} workspaces with orderBy`)
              snapshot = orderedSnapshot
            }
          } catch (orderByError: any) {
            console.warn('⚠ Could not order by createdAt, using unordered results:', orderByError?.message)
            console.warn('This is OK - we will sort manually if needed')
            // Mevcut snapshot'ı kullanmaya devam et
          }
        }
      }
    } catch (error: any) {
      console.error('❌ Error fetching workspaces:', error)
      console.error('Error code:', error?.code)
      console.error('Error message:', error?.message)
      console.error('Full error:', error)
      
      // Permission denied hatası ise özel mesaj
      if (error?.code === 'permission-denied') {
        throw new Error('Workspace\'leri görüntüleme yetkiniz yok. Firestore rules\'u kontrol edin veya super admin olun.')
      }
      
      throw error
    }
    
    if (snapshot.empty) {
      console.log('⚠ No workspaces found in database')
      console.log('This could mean:')
      console.log('  1. No workspaces exist in Firestore')
      console.log('  2. Firestore rules are blocking access')
      console.log('  3. Collection path is incorrect')
      return []
    }
    
    console.log(`Processing ${snapshot.docs.length} workspace documents...`)
    const workspaces = snapshot.docs.map((doc) => {
      const data = doc.data()
      console.log(`Processing workspace document: ${doc.id}`, {
        hasName: !!data.name,
        hasCurrency: !!data.currency,
        hasCreatedAt: !!data.createdAt,
        dataKeys: Object.keys(data)
      })
      
      const workspace = {
        id: doc.id,
        name: data.name || 'Unnamed Workspace',
        currency: data.currency || 'USD',
        timezone: data.timezone || 'UTC',
        plan: data.plan || {
          tier: 'free-dev',
          limits: { users: 10, skus: 1000 }
        },
        createdBy: data.createdBy || '',
        createdAt: data.createdAt || null,
        updatedAt: data.updatedAt || null,
      } as Workspace
      console.log(`Workspace found: ${workspace.id} - ${workspace.name}`)
      return workspace
    })
    
    // Eğer orderBy başarısız olduysa, manuel olarak sırala
    if (workspaces.length > 0 && workspaces[0].createdAt) {
      workspaces.sort((a, b) => {
        const aTime = a.createdAt?.toMillis?.() || a.createdAt?.seconds || 0
        const bTime = b.createdAt?.toMillis?.() || b.createdAt?.seconds || 0
        return bTime - aTime
      })
    }
    
    console.log(`Returning ${workspaces.length} workspaces`)
    return workspaces
  } catch (error: any) {
    console.error('Error listing workspaces:', error)
    console.error('Error code:', error?.code)
    console.error('Error message:', error?.message)
    // Firestore permission hatası ise daha açıklayıcı mesaj
    if (error?.code === 'permission-denied') {
      throw new Error('Workspace\'leri görüntüleme yetkiniz yok. Super admin olmanız gerekiyor.')
    }
    throw error
  }
}

/**
 * Workspace detayını getir
 */
export async function getWorkspace(workspaceId: string): Promise<Workspace | null> {
  if (!workspaceId) {
    throw new Error('workspaceId is required')
  }

  try {
    const workspaceDoc = await getDoc(doc(db, 'workspaces', workspaceId))
    
    if (!workspaceDoc.exists()) {
      return null
    }
    
    return {
      id: workspaceDoc.id,
      ...workspaceDoc.data(),
    } as Workspace
  } catch (error) {
    console.error('Error getting workspace:', error)
    throw error
  }
}

/**
 * Yeni workspace oluştur
 */
export async function createWorkspace(
  input: WorkspaceInput,
  createdBy: string
): Promise<string> {
  if (!input.name || !input.currency || !input.timezone) {
    throw new Error('Workspace name, currency, and timezone are required')
  }

  try {
    const now = serverTimestamp()
    
    // Workspace document oluştur
    const workspaceRef = await addDoc(collection(db, 'workspaces'), {
      name: input.name.trim(),
      currency: input.currency,
      timezone: input.timezone,
      plan: {
        tier: 'free-dev',
        limits: {
          users: 10,
          skus: 1000,
        },
      },
      createdBy,
      createdAt: now,
      updatedAt: now,
    })
    
    // Oluşturan kullanıcıyı owner rolü ile ekle
    await addUserToWorkspace(workspaceRef.id, createdBy, 'owner', createdBy)
    
    return workspaceRef.id
  } catch (error) {
    console.error('Error creating workspace:', error)
    throw error
  }
}

/**
 * Workspace'i güncelle
 */
export async function updateWorkspace(
  workspaceId: string,
  input: Partial<WorkspaceInput>
): Promise<void> {
  if (!workspaceId) {
    throw new Error('workspaceId is required')
  }

  try {
    const workspaceRef = doc(db, 'workspaces', workspaceId)
    const updateData: any = {
      updatedAt: serverTimestamp(),
    }
    
    if (input.name !== undefined) {
      updateData.name = input.name.trim()
    }
    if (input.currency !== undefined) {
      updateData.currency = input.currency
    }
    if (input.timezone !== undefined) {
      updateData.timezone = input.timezone
    }
    
    await updateDoc(workspaceRef, updateData)
  } catch (error) {
    console.error('Error updating workspace:', error)
    throw error
  }
}

/**
 * Workspace'i sil (opsiyonel - dikkatli kullanılmalı)
 */
export async function deleteWorkspace(workspaceId: string): Promise<void> {
  if (!workspaceId) {
    throw new Error('workspaceId is required')
  }

  try {
    const workspaceRef = doc(db, 'workspaces', workspaceId)
    await deleteDoc(workspaceRef)
    
    // Not: Subcollection'lar (users, products, etc.) otomatik silinmez
    // Bu işlem için Cloud Function veya batch delete gerekebilir
  } catch (error) {
    console.error('Error deleting workspace:', error)
    throw error
  }
}
