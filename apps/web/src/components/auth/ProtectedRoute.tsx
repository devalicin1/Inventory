import { ReactNode, useEffect, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useSessionStore } from '../../state/sessionStore'
import { hasScreenAccess } from '../../utils/permissions'

interface ProtectedRouteProps {
  children: ReactNode
  requireSuperAdmin?: boolean
  requiredScreen?: string // Screen ID required to access this route
}

// Map routes to screen IDs
const routeToScreenMap: Record<string, string> = {
  '/': 'home',
  '/inventory': 'inventory',
  '/production': 'production',
  '/scan': 'scan',
  '/scan/po': 'scan',
  '/purchase-orders': 'purchase-orders',
  '/reports': 'reports',
  '/settings': 'settings',
}

export function ProtectedRoute({ 
  children, 
  requireSuperAdmin = false,
  requiredScreen 
}: ProtectedRouteProps) {
  const { userId, isSuperAdmin, workspaceId } = useSessionStore()
  const location = useLocation()
  const [hasAccess, setHasAccess] = useState<boolean | null>(null)

  // Determine screen ID from route or prop
  const screenId = requiredScreen || routeToScreenMap[location.pathname] || null

  // Check screen access
  useEffect(() => {
    if (!screenId || !workspaceId || !userId) {
      setHasAccess(true) // No screen restriction
      return
    }

    hasScreenAccess(workspaceId, userId, screenId)
      .then((access) => {
        setHasAccess(access)
      })
      .catch(() => {
        setHasAccess(false)
      })
  }, [screenId, workspaceId, userId])

  // Kullanıcı giriş yapmamışsa login sayfasına yönlendir
  if (!userId) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // Super admin gerekiyorsa kontrol et
  if (requireSuperAdmin && !isSuperAdmin) {
    return <Navigate to="/" replace />
  }

  // Screen access kontrolü
  if (screenId && hasAccess === false) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600 mb-4">You don't have permission to access this screen.</p>
          <Navigate to="/" replace />
        </div>
      </div>
    )
  }

  // Loading state while checking access
  if (screenId && hasAccess === null) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Checking access...</p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
