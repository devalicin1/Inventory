import { db } from '../lib/firebase'
import { doc, getDoc } from 'firebase/firestore'

// Super admin email listesi (environment variable'dan veya config'den alınabilir)
const SUPER_ADMIN_EMAILS = [
  'admin@inventory.com',
  // Daha fazla super admin email'i buraya eklenebilir
]

/**
 * Kullanıcının super admin olup olmadığını kontrol et
 */
export async function isSuperAdmin(userId: string | null, email: string | null): Promise<boolean> {
  if (!userId || !email) return false
  
  // Email listesinden kontrol
  if (SUPER_ADMIN_EMAILS.includes(email.toLowerCase())) {
    return true
  }
  
  // Firestore'dan kontrol (opsiyonel - users/{userId}/isSuperAdmin flag)
  try {
    const userDoc = await getDoc(doc(db, 'users', userId))
    if (userDoc.exists()) {
      const userData = userDoc.data()
      return userData.isSuperAdmin === true
    }
  } catch (error) {
    console.error('Error checking super admin status:', error)
  }
  
  return false
}

/**
 * Kullanıcının workspace'de belirli bir yetkiye sahip olup olmadığını kontrol et
 */
export async function hasWorkspacePermission(
  workspaceId: string,
  userId: string | null,
  permission: string
): Promise<boolean> {
  if (!workspaceId || !userId) {
    console.log('[hasWorkspacePermission] Missing params:', { workspaceId, userId, permission })
    return false
  }
  
  try {
    const userDocRef = doc(db, 'workspaces', workspaceId, 'users', userId)
    const userDoc = await getDoc(userDocRef)
    
    if (!userDoc.exists()) {
      console.log('[hasWorkspacePermission] User document does not exist:', { workspaceId, userId })
      return false
    }
    
    const userData = userDoc.data()
    const role = userData.role as string
    
    console.log('[hasWorkspacePermission] User data:', { 
      workspaceId, 
      userId, 
      role,
      directPermissions: userData.permissions,
      requestedPermission: permission
    })
    
    // Always check role-permissions collection for the most up-to-date permissions
    // This ensures that if admin updates role permissions, users get the updated permissions immediately
    const { getRolePermissions } = await import('../api/role-permissions')
    let rolePermissions = await getRolePermissions(workspaceId, role as any)
    
    // Ensure rolePermissions is an array (handle string format for backward compatibility)
    if (!Array.isArray(rolePermissions)) {
      if (typeof rolePermissions === 'string') {
        rolePermissions = rolePermissions.split(',').map((p: string) => p.trim()).filter((p: string) => p.length > 0)
      } else {
        rolePermissions = []
      }
    }
    
    // IMPORTANT: Role permissions are the ONLY source of truth
    // Direct permissions in user document are IGNORED to prevent stale permissions
    // When role permissions are updated, user permissions are automatically synced via updateRolePermissions
    // This ensures that if a permission is removed from role permissions, it's immediately removed from all users
    
    // Use ONLY role permissions - ignore direct permissions to prevent stale data
    const allPermissions = rolePermissions
    const hasPermission = allPermissions.includes('*') || allPermissions.includes(permission)
    
    // Log direct permissions for debugging, but don't use them
    let directPermissions: string[] = []
    if (userData.permissions) {
      if (Array.isArray(userData.permissions)) {
        directPermissions = userData.permissions
      } else if (typeof userData.permissions === 'string') {
        directPermissions = userData.permissions.split(',').map((p: string) => p.trim()).filter((p: string) => p.length > 0)
      }
    }
    
    // Detailed logging for debugging
    console.log('[hasWorkspacePermission] Permission check result:', { 
      role, 
      rolePermissions: rolePermissions,
      rolePermissionsCount: rolePermissions.length,
      directPermissions: directPermissions,
      directPermissionsCount: directPermissions.length,
      allPermissions: allPermissions,
      allPermissionsCount: allPermissions.length,
      requestedPermission: permission,
      hasPermission: hasPermission,
      includesCheck: allPermissions.includes(permission),
      wildcardCheck: allPermissions.includes('*'),
      note: 'Direct permissions are IGNORED - only role permissions are used. User permissions are synced when role permissions are updated.'
    })
    
    // Also log the actual boolean value clearly
    console.log(`[hasWorkspacePermission] FINAL RESULT: hasPermission = ${hasPermission} for permission "${permission}" (role: ${role}, rolePermissions: [${rolePermissions.join(', ')}])`)
    
    return hasPermission
  } catch (error) {
    console.error('[hasWorkspacePermission] Error checking workspace permission:', error)
    return false
  }
}

/**
 * Kullanıcının workspace'i yönetme yetkisine sahip olup olmadığını kontrol et
 */
export async function canManageWorkspace(
  workspaceId: string,
  userId: string | null
): Promise<boolean> {
  if (!workspaceId || !userId) return false
  
  try {
    const userDoc = await getDoc(doc(db, 'workspaces', workspaceId, 'users', userId))
    if (!userDoc.exists()) return false
    
    const userData = userDoc.data()
    const role = userData.role
    
    // Owner ve admin workspace'i yönetebilir
    return role === 'owner' || role === 'admin'
  } catch (error) {
    console.error('Error checking workspace management permission:', error)
    return false
  }
}

/**
 * Kullanıcının belirli bir ekrana erişim yetkisi olup olmadığını kontrol et
 * IMPORTANT: Role permissions are the ONLY source of truth for screens as well
 */
export async function hasScreenAccess(
  workspaceId: string,
  userId: string | null,
  screenId: string
): Promise<boolean> {
  if (!workspaceId || !userId) return false
  
  try {
    const userDoc = await getDoc(doc(db, 'workspaces', workspaceId, 'users', userId))
    if (!userDoc.exists()) return false
    
    const userData = userDoc.data()
    const role = userData.role as string
    
    // IMPORTANT: Always get screens from role-permissions collection
    // Direct screens in user document are IGNORED to prevent stale data
    // This ensures that if admin updates role screens, users get the updated screens immediately
    const { getRoleScreens } = await import('../api/role-permissions')
    const screens = await getRoleScreens(workspaceId, role)
    return screens.includes('*') || screens.includes(screenId)
  } catch (error) {
    console.error('Error checking screen access:', error)
    return false
  }
}
