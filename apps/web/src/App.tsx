import { useEffect, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useSessionStore } from './state/sessionStore'
import { Sidebar } from './components/layout/Sidebar'
import { MobileNav } from './components/layout/MobileNav'
import { GlobalSearch } from './components/search/GlobalSearch'
import { WorkspaceSelector } from './components/WorkspaceSelector'
import { CreateWorkspace } from './components/CreateWorkspace'
import { ToastContainer, useToasts, removeToast } from './components/ui/Toast'
import { useUIStore } from './state/uiStore'
import { onAuthStateChanged } from './lib/auth'
import { getUserWorkspaces } from './api/workspace-users'
import { isSuperAdmin } from './utils/permissions'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from './lib/firebase'
import type { User } from 'firebase/auth'
import './App.css'

function App() {
  const { setSession, clear, switchWorkspace, userWorkspaces, workspaceId } = useSessionStore()
  const { toggleSearch, closeSearch, isSidebarCollapsed } = useUIStore()
  const [authLoading, setAuthLoading] = useState(true)
  const [showWorkspaceSelector, setShowWorkspaceSelector] = useState(false)
  const toasts = useToasts()
  const navigate = useNavigate()

  // Global search shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        toggleSearch()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [toggleSearch])

  // Close search on route change
  const location = useLocation()
  useEffect(() => {
    closeSearch()
  }, [location, closeSearch])

  // Firebase Auth state listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(async (user: User | null) => {
      setAuthLoading(true)
      
      if (!user) {
        clear()
        setAuthLoading(false)
        // Redirect to login page when user signs out
        if (window.location.pathname !== '/login') {
          navigate('/login', { replace: true })
        }
        return
      }

      try {
        console.log('=== User Login Process Started ===')
        console.log('User ID:', user.uid)
        console.log('User Email:', user.email)
        
        // Kullanıcı profil bilgilerini Firestore'dan al veya oluştur
        const userDocRef = doc(db, 'users', user.uid)
        let userDoc = await getDoc(userDocRef)
        
        if (!userDoc.exists()) {
          console.log('⚠ New user detected, creating user profile...')
          // Yeni kullanıcı profili oluştur
          await setDoc(userDocRef, {
            email: user.email,
            displayName: user.displayName || null,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          })
          userDoc = await getDoc(userDocRef)
          console.log('✓ User profile created')
        } else {
          console.log('✓ User profile found')
        }

        const userData = userDoc.data()
        console.log('User Profile Data:', {
          email: userData?.email,
          displayName: userData?.displayName,
        })
        
        // Super admin kontrolü
        const superAdmin = await isSuperAdmin(user.uid, user.email || null)
        console.log('Super Admin Status:', superAdmin)
        
        // Kullanıcının workspace'lerini al
        console.log('Fetching user workspaces...')
        const userWorkspaces = await getUserWorkspaces(user.uid)
        console.log(`✓ Found ${userWorkspaces.length} workspace(s) for user`)
        
        // Her workspace için detaylı bilgi logla
        if (userWorkspaces.length > 0) {
          console.log('User Workspaces Details:')
          userWorkspaces.forEach((ws, index) => {
            console.log(`  ${index + 1}. Workspace: ${ws.name} (ID: ${ws.workspaceId})`)
            console.log(`     Role: ${ws.role}`)
            console.log(`     Path: workspaces/${ws.workspaceId}/users/${user.uid}`)
          })
        } else {
          console.warn('⚠ WARNING: User has no workspaces assigned!')
          console.warn('   User needs to be added to at least one workspace by an admin.')
          console.warn('   User ID:', user.uid)
          console.warn('   User Email:', user.email)
        }
        
        // localStorage'dan önceki workspace seçimini kontrol et
        const savedWorkspaceId = localStorage.getItem('selectedWorkspaceId')
        let initialWorkspaceId: string | null = null
        
        // Eğer kaydedilmiş workspaceId varsa ve bu workspace hala kullanıcının workspace listesindeyse, onu kullan
        if (savedWorkspaceId && userWorkspaces.some(ws => ws.workspaceId === savedWorkspaceId)) {
          initialWorkspaceId = savedWorkspaceId
          console.log('Restoring saved workspace from localStorage:', savedWorkspaceId)
        }
        
        // Session'ı güncelle
        const sessionData = {
          userId: user.uid,
          email: user.email || null,
          displayName: userData?.displayName || user.displayName || null,
          workspaceId: initialWorkspaceId,
          roles: initialWorkspaceId ? [userWorkspaces.find(ws => ws.workspaceId === initialWorkspaceId)?.role || 'staff'] : [],
          userWorkspaces,
          isSuperAdmin: superAdmin,
        }
        
        setSession(sessionData)
        console.log('✓ Session updated')
        
        // Eğer zaten geçerli bir workspace seçilmişse, selector gösterme
        if (initialWorkspaceId) {
          console.log('Workspace already selected and valid - keeping:', initialWorkspaceId)
          // Workspace zaten seçili, selector gösterme
        } else if (userWorkspaces.length > 1) {
          // Birden fazla workspace varsa ve henüz seçilmemişse selector göster
          console.log('Multiple workspaces found - showing workspace selector')
          setShowWorkspaceSelector(true)
        } else if (userWorkspaces.length === 1) {
          // Tek workspace varsa otomatik seç
          const defaultWorkspace = userWorkspaces[0]
          console.log('Single workspace found - auto-selecting:', {
            workspaceId: defaultWorkspace.workspaceId,
            name: defaultWorkspace.name,
            role: defaultWorkspace.role,
          })
          switchWorkspace(defaultWorkspace.workspaceId)
          localStorage.setItem('selectedWorkspaceId', defaultWorkspace.workspaceId)
          console.log('✓ Workspace auto-selected')
        } else {
          console.warn('⚠ No workspaces found - user needs to be added to a workspace')
        }
        
        console.log('=== User Login Process Completed ===')
      } catch (error) {
        console.error('❌ Error loading user session:', error)
        console.error('Error details:', {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
        })
        clear()
      } finally {
        setAuthLoading(false)
      }
    })

    return () => unsubscribe()
  }, [setSession, clear, switchWorkspace])

  // Workspace seçimi yapıldığında
  const handleWorkspaceSelect = (selectedWorkspaceId: string) => {
    switchWorkspace(selectedWorkspaceId)
    localStorage.setItem('selectedWorkspaceId', selectedWorkspaceId)
    setShowWorkspaceSelector(false)
    console.log('✓ Workspace selected:', selectedWorkspaceId)
  }

  // Loading state göster
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  // Workspace seçim ekranını göster
  if (showWorkspaceSelector && userWorkspaces.length > 0) {
    return <WorkspaceSelector workspaces={userWorkspaces} onSelect={handleWorkspaceSelect} />
  }

  // Workspace seçilmemişse ve workspace yoksa - show workspace creation
  if (!workspaceId && userWorkspaces.length === 0) {
    const { userId } = useSessionStore.getState()
    return (
      <CreateWorkspace
        onComplete={async () => {
          // After workspace creation, reload user workspaces
          if (userId) {
            const updatedWorkspaces = await getUserWorkspaces(userId)
            if (updatedWorkspaces.length > 0) {
              const defaultWorkspace = updatedWorkspaces[0]
              switchWorkspace(defaultWorkspace.workspaceId)
              localStorage.setItem('selectedWorkspaceId', defaultWorkspace.workspaceId)
              setSession({ userWorkspaces: updatedWorkspaces })
              // Force reload to refresh the app state
              window.location.reload()
            }
          }
        }}
      />
    )
  }

  return (
    <div className="app-shell bg-gray-50">
      <GlobalSearch />
      <Sidebar />
      <MobileNav />
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {/* Main content */}
      <main className={`main-content ${isSidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
        <div className="w-full max-w-full overflow-x-hidden">
          <Outlet />
        </div>
      </main>
    </div>
  )
}

export default App
