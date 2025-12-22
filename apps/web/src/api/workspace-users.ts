import { db } from '../lib/firebase'
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore'

export type Role = 'owner' | 'admin' | 'manager' | 'staff' | 'operator'
export type RoleOrCustom = Role | string // Can be standard role or custom role name

/**
 * Tüm kullanıcıları listele (users collection'ından)
 */
export async function listAllUsers(): Promise<Array<{
  id: string
  email: string | null
  displayName: string | null
}>> {
  try {
    const usersCol = collection(db, 'users')
    const snapshot = await getDocs(usersCol)
    
    const users: Array<{
      id: string
      email: string | null
      displayName: string | null
    }> = []
    
    for (const userDoc of snapshot.docs) {
      const data = userDoc.data()
      users.push({
        id: userDoc.id,
        email: data.email || null,
        displayName: data.displayName || null,
      })
    }
    
    return users
  } catch (error) {
    console.error('Error listing all users:', error)
    throw error
  }
}

export interface WorkspaceUser {
  id: string
  userId: string
  email?: string
  displayName?: string
  role: RoleOrCustom
  permissions: string[] // Array of permission strings
  screens?: string[] // Array of screen IDs user can access
  createdAt: any
  updatedAt: any
  createdBy: string
}

export interface WorkspaceUserInput {
  userId: string
  role: RoleOrCustom
  permissions?: string[]
  screens?: string[]
}

/**
 * Workspace'deki tüm kullanıcıları listele
 */
export async function listWorkspaceUsers(workspaceId: string): Promise<WorkspaceUser[]> {
  if (!workspaceId) {
    throw new Error('workspaceId is required')
  }

  try {
    const usersCol = collection(db, 'workspaces', workspaceId, 'users')
    const snapshot = await getDocs(usersCol)
    
    const users: WorkspaceUser[] = []
    
    for (const userDoc of snapshot.docs) {
      const data = userDoc.data()
      
      // Kullanıcı bilgilerini users collection'ından al
      let email: string | undefined
      let displayName: string | undefined
      
      try {
        const userProfileDoc = await getDoc(doc(db, 'users', userDoc.id))
        if (userProfileDoc.exists()) {
          const userProfile = userProfileDoc.data()
          email = userProfile.email
          displayName = userProfile.displayName
        }
      } catch (error) {
        console.warn(`Could not fetch user profile for ${userDoc.id}:`, error)
      }
      
      users.push({
        id: userDoc.id,
        userId: userDoc.id,
        email,
        displayName,
        role: (data.role as string) || 'staff', // Ensure role is always a string
        permissions: Array.isArray(data.permissions) ? data.permissions : (data.permissions || []),
        screens: Array.isArray(data.screens) ? data.screens : undefined,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        createdBy: data.createdBy || '',
      })
    }
    
    return users
  } catch (error) {
    console.error('Error listing workspace users:', error)
    throw error
  }
}

/**
 * Workspace'e kullanıcı ekle ve rol ata
 * Her workspace'in kullanıcıları ayrı ayrı tutulur: workspaces/{workspaceId}/users/{userId}
 */
export async function addUserToWorkspace(
  workspaceId: string,
  userId: string,
  role: Role,
  createdBy: string
): Promise<void> {
  if (!workspaceId || !userId) {
    throw new Error('workspaceId and userId are required')
  }

  try {
    console.log(`[addUserToWorkspace] Adding user to workspace...`)
    console.log(`  - Workspace ID: ${workspaceId}`)
    console.log(`  - User ID: ${userId}`)
    console.log(`  - Role: ${role}`)
    console.log(`  - Created By: ${createdBy}`)
    console.log(`  - Database Path: workspaces/${workspaceId}/users/${userId}`)
    
    // Get role permissions and screens from Firestore
    const { getRolePermissions, getRoleScreens } = await import('./role-permissions')
    const permissions = await getRolePermissions(workspaceId, role)
    const screens = await getRoleScreens(workspaceId, role)
    
    console.log(`  - Permissions: ${permissions.length > 0 ? permissions.join(', ') : 'none'}`)
    console.log(`  - Screens: ${screens.length > 0 ? screens.join(', ') : 'none'}`)
    
    const userRef = doc(db, 'workspaces', workspaceId, 'users', userId)
    const now = serverTimestamp()
    
    const userData = {
      role,
      permissions: permissions, // Save permissions array based on role
      screens: screens, // Save screens array based on role
      createdAt: now,
      updatedAt: now,
      createdBy,
    }
    
    console.log(`[addUserToWorkspace] Saving user data to Firestore...`)
    await setDoc(userRef, userData)
    
    console.log(`[addUserToWorkspace] ✓ User successfully added to workspace`)
    console.log(`  - Workspace: ${workspaceId}`)
    console.log(`  - User: ${userId}`)
    console.log(`  - Role: ${role}`)
    console.log(`  - Permissions saved: ${permissions.length} permission(s)`)
  } catch (error) {
    console.error('[addUserToWorkspace] ❌ Error adding user to workspace:', error)
    console.error('Error details:', {
      workspaceId,
      userId,
      role,
      message: error instanceof Error ? error.message : 'Unknown error',
    })
    throw error
  }
}

/**
 * Kullanıcının workspace'deki rolünü güncelle
 * Her workspace'in kullanıcıları ayrı ayrı tutulur: workspaces/{workspaceId}/users/{userId}
 */
export async function updateUserRole(
  workspaceId: string,
  userId: string,
  role: Role
): Promise<void> {
  if (!workspaceId || !userId) {
    throw new Error('workspaceId and userId are required')
  }

  try {
    console.log(`[updateUserRole] Updating user role...`)
    console.log(`  - Workspace ID: ${workspaceId}`)
    console.log(`  - User ID: ${userId}`)
    console.log(`  - New Role: ${role}`)
    console.log(`  - Database Path: workspaces/${workspaceId}/users/${userId}`)
    
    // Get role permissions and screens from Firestore
    const { getRolePermissions, getRoleScreens } = await import('./role-permissions')
    const permissions = await getRolePermissions(workspaceId, role)
    const screens = await getRoleScreens(workspaceId, role)
    
    console.log(`  - New Permissions: ${permissions.length > 0 ? permissions.join(', ') : 'none'}`)
    console.log(`  - New Screens: ${screens.length > 0 ? screens.join(', ') : 'none'}`)
    
    const userRef = doc(db, 'workspaces', workspaceId, 'users', userId)
    await updateDoc(userRef, {
      role,
      permissions: permissions, // Update permissions when role changes
      screens: screens, // Update screens when role changes
      updatedAt: serverTimestamp(),
    })
    
    console.log(`[updateUserRole] ✓ User role updated successfully`)
    console.log(`  - Workspace: ${workspaceId}`)
    console.log(`  - User: ${userId}`)
    console.log(`  - Role: ${role}`)
    console.log(`  - Permissions updated: ${permissions.length} permission(s)`)
  } catch (error) {
    console.error('[updateUserRole] ❌ Error updating user role:', error)
    console.error('Error details:', {
      workspaceId,
      userId,
      role,
      message: error instanceof Error ? error.message : 'Unknown error',
    })
    throw error
  }
}

/**
 * Kullanıcıyı workspace'den çıkar
 */
export async function removeUserFromWorkspace(
  workspaceId: string,
  userId: string
): Promise<void> {
  if (!workspaceId || !userId) {
    throw new Error('workspaceId and userId are required')
  }

  try {
    const userRef = doc(db, 'workspaces', workspaceId, 'users', userId)
    await deleteDoc(userRef)
  } catch (error) {
    console.error('Error removing user from workspace:', error)
    throw error
  }
}

/**
 * Kullanıcının üye olduğu workspace'leri getir
 * Her workspace'in kullanıcıları ayrı ayrı tutulur: workspaces/{workspaceId}/users/{userId}
 */
export async function getUserWorkspaces(userId: string): Promise<Array<{
  workspaceId: string
  name: string
  role: Role
  permissions?: string[]
}>> {
  if (!userId) {
    console.warn('getUserWorkspaces: userId is required')
    return []
  }

  try {
    console.log(`[getUserWorkspaces] Fetching workspaces for user: ${userId}`)
    
    // Tüm workspace'leri al ve kullanıcının üye olduklarını filtrele
    // Her workspace'in users subcollection'ı ayrı ayrı tutulur
    const workspacesCol = collection(db, 'workspaces')
    const workspacesSnapshot = await getDocs(workspacesCol)
    
    console.log(`[getUserWorkspaces] Found ${workspacesSnapshot.docs.length} total workspace(s)`)
    
    const userWorkspaces: Array<{
      workspaceId: string
      name: string
      role: Role
      permissions?: string[]
    }> = []
    
    // Her workspace için kullanıcının üyeliğini kontrol et
    // Her workspace'in users subcollection'ı ayrı olduğu için her birini kontrol ediyoruz
    for (const workspaceDoc of workspacesSnapshot.docs) {
      const workspaceId = workspaceDoc.id
      const workspaceData = workspaceDoc.data()
      
      // Kullanıcının bu workspace'deki kaydını kontrol et
      // Path: workspaces/{workspaceId}/users/{userId}
      const userDocRef = doc(db, 'workspaces', workspaceId, 'users', userId)
      const userDoc = await getDoc(userDocRef)
      
      if (userDoc.exists()) {
        const userData = userDoc.data()
        const role = userData.role || 'staff'
        const permissions = userData.permissions || []
        
        console.log(`[getUserWorkspaces] ✓ User is member of workspace: ${workspaceData.name}`)
        console.log(`  - Workspace ID: ${workspaceId}`)
        console.log(`  - Role: ${role}`)
        console.log(`  - Permissions: ${permissions.length > 0 ? permissions.join(', ') : 'none'}`)
        console.log(`  - Database Path: workspaces/${workspaceId}/users/${userId}`)
        
        userWorkspaces.push({
          workspaceId,
          name: workspaceData.name || 'Unnamed Workspace',
          role: role as Role,
          permissions: Array.isArray(permissions) ? permissions : [],
        })
      }
    }
    
    console.log(`[getUserWorkspaces] User is member of ${userWorkspaces.length} workspace(s)`)
    
    if (userWorkspaces.length === 0) {
      console.warn(`[getUserWorkspaces] ⚠ User ${userId} is not a member of any workspace`)
      console.warn('  User needs to be added to a workspace by an admin.')
    }
    
    return userWorkspaces
  } catch (error) {
    console.error('[getUserWorkspaces] ❌ Error getting user workspaces:', error)
    console.error('Error details:', {
      userId,
      message: error instanceof Error ? error.message : 'Unknown error',
    })
    throw error
  }
}
