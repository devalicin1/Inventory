import { db } from '../lib/firebase'
import {
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  serverTimestamp,
  query,
  orderBy,
} from 'firebase/firestore'
import type { Role } from './workspace-users'

export interface RolePermission {
  role: string // Can be standard Role or custom role name
  permissions: string[]
  screens: string[] // Screen access permissions
  isCustom: boolean // Whether this is a custom role
  createdAt: any
  updatedAt: any
}

// Standard roles (cannot be deleted)
export const STANDARD_ROLES: Role[] = ['owner', 'admin', 'manager', 'staff', 'operator']

// Default role permissions
const DEFAULT_ROLE_PERMISSIONS: Record<Role, string[]> = {
  owner: ['*'], // All permissions
  admin: ['manage_users', 'manage_settings', 'view_reports', 'manage_inventory', 'manage_production'],
  manager: ['view_reports', 'manage_inventory', 'manage_production'],
  staff: ['view_reports', 'manage_inventory'],
  operator: ['manage_production'],
}

// Default screen access for standard roles
const DEFAULT_SCREEN_ACCESS: Record<Role, string[]> = {
  owner: ['*'], // All screens
  admin: ['home', 'inventory', 'production', 'scan', 'find', 'purchase-orders', 'reports', 'settings'],
  manager: ['home', 'inventory', 'production', 'scan', 'find', 'purchase-orders', 'reports'],
  staff: ['home', 'inventory', 'scan', 'find', 'reports'],
  operator: ['home', 'production', 'scan'],
}

// Available screens in the application
export const AVAILABLE_SCREENS = [
  { id: 'home', name: 'Home / Dashboard', path: '/' },
  { id: 'inventory', name: 'Inventory', path: '/inventory' },
  { id: 'production', name: 'Production', path: '/production' },
  { id: 'scan', name: 'Scan', path: '/scan' },
  { id: 'find', name: 'Find / Search', path: '/', action: 'search' },
  { id: 'purchase-orders', name: 'Purchase Orders', path: '/purchase-orders' },
  { id: 'reports', name: 'Reports', path: '/reports' },
  { id: 'settings', name: 'Settings', path: '/settings' },
]

/**
 * Get role permissions for a workspace (or default if not set)
 */
export async function getRolePermissions(
  workspaceId: string,
  role: string
): Promise<string[]> {
  try {
    const roleDocRef = doc(db, 'workspaces', workspaceId, 'role-permissions', role)
    const roleDoc = await getDoc(roleDocRef)
    
    console.log('[getRolePermissions] Checking role:', { workspaceId, role, exists: roleDoc.exists() })
    
    if (roleDoc.exists()) {
      const data = roleDoc.data()
      console.log('[getRolePermissions] Raw data from Firestore:', { 
        role, 
        rawPermissions: data.permissions, 
        rawPermissionsType: typeof data.permissions,
        isArray: Array.isArray(data.permissions)
      })
      
      // Handle both array and string formats (for backward compatibility)
      let permissions: string[] = []
      if (Array.isArray(data.permissions)) {
        permissions = data.permissions
      } else if (typeof data.permissions === 'string') {
        // Convert comma-separated string to array
        permissions = data.permissions.split(',').map((p: string) => p.trim()).filter((p: string) => p.length > 0)
      } else if (STANDARD_ROLES.includes(role as Role)) {
        permissions = DEFAULT_ROLE_PERMISSIONS[role as Role]
      }
      console.log('[getRolePermissions] Found permissions in document:', { 
        role, 
        permissions: permissions.join(', '), 
        permissionsArray: permissions,
        count: permissions.length 
      })
      return permissions
    }
    
    // Return default permissions if not set (only for standard roles)
    if (STANDARD_ROLES.includes(role as Role)) {
      const defaultPermissions = DEFAULT_ROLE_PERMISSIONS[role as Role]
      console.log('[getRolePermissions] Using default permissions:', { role, defaultPermissions })
      return defaultPermissions
    }
    
    console.log('[getRolePermissions] No permissions found for custom role:', role)
    return []
  } catch (error) {
    console.error('[getRolePermissions] Error getting role permissions:', error)
    // Return default on error (only for standard roles)
    if (STANDARD_ROLES.includes(role as Role)) {
      return DEFAULT_ROLE_PERMISSIONS[role as Role]
    }
    return []
  }
}

/**
 * Get screen access for a role
 */
export async function getRoleScreens(
  workspaceId: string,
  role: string
): Promise<string[]> {
  try {
    const roleDocRef = doc(db, 'workspaces', workspaceId, 'role-permissions', role)
    const roleDoc = await getDoc(roleDocRef)
    
    if (roleDoc.exists()) {
      const data = roleDoc.data()
      // Handle both array and string formats (for backward compatibility)
      if (Array.isArray(data.screens)) {
        return data.screens
      } else if (typeof data.screens === 'string') {
        return data.screens.split(',').map((s: string) => s.trim()).filter((s: string) => s.length > 0)
      } else if (STANDARD_ROLES.includes(role as Role)) {
        return DEFAULT_SCREEN_ACCESS[role as Role]
      }
      return []
    }
    
    // Return default screens if not set (only for standard roles)
    if (STANDARD_ROLES.includes(role as Role)) {
      return DEFAULT_SCREEN_ACCESS[role as Role]
    }
    
    return []
  } catch (error) {
    console.error('Error getting role screens:', error)
    // Return default on error (only for standard roles)
    if (STANDARD_ROLES.includes(role as Role)) {
      return DEFAULT_SCREEN_ACCESS[role as Role]
    }
    return []
  }
}

/**
 * Get full role permission data (permissions + screens)
 */
export async function getRolePermissionData(
  workspaceId: string,
  role: string
): Promise<RolePermission> {
  try {
    const roleDocRef = doc(db, 'workspaces', workspaceId, 'role-permissions', role)
    const roleDoc = await getDoc(roleDocRef)
    
    if (roleDoc.exists()) {
      const data = roleDoc.data()
      // Handle both array and string formats (for backward compatibility)
      let permissions: string[] = []
      if (Array.isArray(data.permissions)) {
        permissions = data.permissions
      } else if (typeof data.permissions === 'string') {
        permissions = data.permissions.split(',').map((p: string) => p.trim()).filter((p: string) => p.length > 0)
      } else if (STANDARD_ROLES.includes(role as Role)) {
        permissions = DEFAULT_ROLE_PERMISSIONS[role as Role]
      }
      
      let screens: string[] = []
      if (Array.isArray(data.screens)) {
        screens = data.screens
      } else if (typeof data.screens === 'string') {
        screens = data.screens.split(',').map((s: string) => s.trim()).filter((s: string) => s.length > 0)
      } else if (STANDARD_ROLES.includes(role as Role)) {
        screens = DEFAULT_SCREEN_ACCESS[role as Role]
      }
      
      return {
        role,
        permissions,
        screens,
        isCustom: data.isCustom || false,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      }
    }
    
    // Return default for standard roles
    if (STANDARD_ROLES.includes(role as Role)) {
      return {
        role,
        permissions: DEFAULT_ROLE_PERMISSIONS[role as Role],
        screens: DEFAULT_SCREEN_ACCESS[role as Role],
        isCustom: false,
        createdAt: null,
        updatedAt: null,
      }
    }
    
    // Custom role not found
    return {
      role,
      permissions: [],
      screens: [],
      isCustom: true,
      createdAt: null,
      updatedAt: null,
    }
  } catch (error) {
    console.error('Error getting role permission data:', error)
    throw error
  }
}

/**
 * Get all role permissions for a workspace (including custom roles)
 */
export async function getAllRolePermissions(
  workspaceId: string
): Promise<Record<string, string[]>> {
  const permissions: Record<string, string[]> = {}
  
  // Get standard roles
  for (const role of STANDARD_ROLES) {
    permissions[role] = await getRolePermissions(workspaceId, role)
  }
  
  // Get custom roles
  try {
    const rolesCol = collection(db, 'workspaces', workspaceId, 'role-permissions')
    const rolesSnapshot = await getDocs(rolesCol)
    
    for (const roleDoc of rolesSnapshot.docs) {
      const roleName = roleDoc.id
      if (!STANDARD_ROLES.includes(roleName as Role)) {
        const data = roleDoc.data()
        // Handle both array and string formats
        if (Array.isArray(data.permissions)) {
          permissions[roleName] = data.permissions
        } else if (typeof data.permissions === 'string') {
          permissions[roleName] = data.permissions.split(',').map((p: string) => p.trim()).filter((p: string) => p.length > 0)
        } else {
          permissions[roleName] = []
        }
      }
    }
  } catch (error) {
    console.error('Error fetching custom roles:', error)
  }
  
  return permissions
}

/**
 * Get all roles (standard + custom) with full permission data
 */
export async function getAllRoles(
  workspaceId: string
): Promise<RolePermission[]> {
  const roles: RolePermission[] = []
  
  // Get standard roles
  for (const role of STANDARD_ROLES) {
    roles.push(await getRolePermissionData(workspaceId, role))
  }
  
  // Get custom roles
  try {
    const rolesCol = collection(db, 'workspaces', workspaceId, 'role-permissions')
    const rolesSnapshot = await getDocs(query(rolesCol, orderBy('createdAt', 'desc')))
    
    for (const roleDoc of rolesSnapshot.docs) {
      const roleName = roleDoc.id
      if (!STANDARD_ROLES.includes(roleName as Role)) {
        const data = roleDoc.data()
        // Handle both array and string formats
        let permissions: string[] = []
        if (Array.isArray(data.permissions)) {
          permissions = data.permissions
        } else if (typeof data.permissions === 'string') {
          permissions = data.permissions.split(',').map((p: string) => p.trim()).filter((p: string) => p.length > 0)
        }
        
        let screens: string[] = []
        if (Array.isArray(data.screens)) {
          screens = data.screens
        } else if (typeof data.screens === 'string') {
          screens = data.screens.split(',').map((s: string) => s.trim()).filter((s: string) => s.length > 0)
        }
        
        roles.push({
          role: roleName,
          permissions,
          screens,
          isCustom: true,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
        })
      }
    }
  } catch (error) {
    console.error('Error fetching custom roles:', error)
  }
  
  return roles
}

/**
 * Update role permissions and screens for a workspace
 * Also syncs permissions for all users with this role
 */
export async function updateRolePermissions(
  workspaceId: string,
  role: string,
  permissions: string[],
  screens?: string[]
): Promise<void> {
  if (!workspaceId || !role) {
    throw new Error('workspaceId and role are required')
  }

  try {
    const roleDocRef = doc(db, 'workspaces', workspaceId, 'role-permissions', role)
    const roleDoc = await getDoc(roleDocRef)
    const now = serverTimestamp()
    const isCustom = !STANDARD_ROLES.includes(role as Role)
    
    const updateData: any = {
      role,
      permissions,
      updatedAt: now,
    }
    
    if (screens !== undefined) {
      updateData.screens = screens
    }
    
    if (isCustom) {
      updateData.isCustom = true
    }
    
    if (roleDoc.exists()) {
      // Update existing
      await updateDoc(roleDocRef, updateData)
    } else {
      // Create new
      await setDoc(roleDocRef, {
        ...updateData,
        createdAt: now,
      })
    }

    // Sync permissions for all users with this role
    // This ensures that when role permissions are updated, all users with that role get the updated permissions
    try {
      const { listWorkspaceUsers } = await import('./workspace-users')
      const users = await listWorkspaceUsers(workspaceId)
      const usersWithRole = users.filter(u => u.role === role)
      
      if (usersWithRole.length > 0) {
        console.log(`[updateRolePermissions] Syncing permissions for ${usersWithRole.length} user(s) with role "${role}"`)
        
        const { updateDoc: updateUserDoc } = await import('firebase/firestore')
        const updatePromises = usersWithRole.map(async (user) => {
          const userRef = doc(db, 'workspaces', workspaceId, 'users', user.userId)
          const updateUserData: any = {
            permissions: permissions, // Update to match role permissions
            updatedAt: serverTimestamp(),
          }
          
          if (screens !== undefined) {
            updateUserData.screens = screens
          }
          
          await updateUserDoc(userRef, updateUserData)
          console.log(`[updateRolePermissions] ✓ Synced permissions for user ${user.userId}`)
        })
        
        await Promise.all(updatePromises)
        console.log(`[updateRolePermissions] ✓ All users with role "${role}" have been synced`)
      }
    } catch (syncError) {
      // Log error but don't fail the main operation
      console.error('[updateRolePermissions] Error syncing user permissions:', syncError)
      console.warn('[updateRolePermissions] Role permissions updated, but user permissions sync failed. Users may need to be manually updated.')
    }
  } catch (error) {
    console.error('Error updating role permissions:', error)
    throw error
  }
}

/**
 * Create a custom role
 */
export async function createCustomRole(
  workspaceId: string,
  roleName: string,
  permissions: string[],
  screens: string[]
): Promise<void> {
  if (!workspaceId || !roleName) {
    throw new Error('workspaceId and roleName are required')
  }
  
  // Validate role name
  if (STANDARD_ROLES.includes(roleName as Role)) {
    throw new Error('Cannot create a role with the same name as a standard role')
  }
  
  // Check if role already exists
  const roleDocRef = doc(db, 'workspaces', workspaceId, 'role-permissions', roleName)
  const roleDoc = await getDoc(roleDocRef)
  
  if (roleDoc.exists()) {
    throw new Error('Role already exists')
  }
  
  const now = serverTimestamp()
  
  await setDoc(roleDocRef, {
    role: roleName,
    permissions,
    screens,
    isCustom: true,
    createdAt: now,
    updatedAt: now,
  })
}

/**
 * Delete a custom role
 */
export async function deleteCustomRole(
  workspaceId: string,
  roleName: string
): Promise<void> {
  if (!workspaceId || !roleName) {
    throw new Error('workspaceId and roleName are required')
  }
  
  // Cannot delete standard roles
  if (STANDARD_ROLES.includes(roleName as Role)) {
    throw new Error('Cannot delete standard roles')
  }
  
  const roleDocRef = doc(db, 'workspaces', workspaceId, 'role-permissions', roleName)
  await deleteDoc(roleDocRef)
}

/**
 * Reset role permissions to default for a workspace
 */
export async function resetRolePermissionsToDefault(
  workspaceId: string,
  role: string
): Promise<void> {
  if (!STANDARD_ROLES.includes(role as Role)) {
    throw new Error('Can only reset standard roles to default')
  }
  
  const defaultPermissions = DEFAULT_ROLE_PERMISSIONS[role as Role]
  const defaultScreens = DEFAULT_SCREEN_ACCESS[role as Role]
  await updateRolePermissions(workspaceId, role, defaultPermissions, defaultScreens)
}

/**
 * Get available permission options
 */
export function getAvailablePermissions(): string[] {
  return [
    '*', // All permissions
    'manage_users',
    'manage_settings',
    'view_reports',
    'manage_inventory',
    'manage_production',
    'view_production',
    'manage_purchase_orders',
    'view_purchase_orders',
    'manage_sales',
    'view_sales',
  ]
}
