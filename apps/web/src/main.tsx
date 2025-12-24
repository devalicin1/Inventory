import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider, useNavigate, useLocation, useParams } from 'react-router-dom'
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import './index.css'
import App from './App.tsx'
import { Login } from './routes/Login'
import { ForgotPassword } from './routes/ForgotPassword'
import { Landing } from './routes/Landing'
import { Admin } from './routes/Admin'
import { Dashboard } from './routes/Dashboard'
import { Inventory } from './routes/Inventory'
import { Production } from './routes/Production'
import { ProductionLayout } from './routes/production/ProductionLayout'
import { ProductionCalendar } from './components/ProductionCalendar'
import { ProductionReports } from './components/ProductionReports'
import { ProductionSettings } from './components/ProductionSettings'
import { Settings } from './routes/Settings'
import { Integrations } from './routes/Integrations'
import { QuickBooksCallback } from './routes/QuickBooksCallback'
import { Reports } from './routes/Reports'
import { PurchaseOrders } from './routes/PurchaseOrders'
import { PurchaseOrderForm } from './routes/PurchaseOrderForm'
import { ProductionScanner } from './components/scanner/ProductionScanner'
import { PurchaseOrderScanner } from './components/scanner/PurchaseOrderScanner'
import { ProductDetails } from './components/ProductDetails'
import { ProtectedRoute } from './components/auth/ProtectedRoute'
import { CreateWorkspace } from './components/CreateWorkspace'
import { ErrorPage } from './components/ErrorPage'
import { ErrorBoundary } from './components/ErrorBoundary'
import { useSessionStore } from './state/sessionStore'
import { getDoc, doc } from 'firebase/firestore'
import { db } from './lib/firebase'

// Wrapper components to get workspaceId from session
function ProductionCalendarWrapper() {
  const { workspaceId } = useSessionStore()
  if (!workspaceId) return <div>Loading...</div>
  return <ProductionCalendar workspaceId={workspaceId} />
}

function ProductionReportsWrapper() {
  const { workspaceId } = useSessionStore()
  if (!workspaceId) return <div>Loading...</div>
  return <ProductionReports workspaceId={workspaceId} />
}

function ProductionSettingsWrapper() {
  const { workspaceId } = useSessionStore()
  if (!workspaceId) return <div>Loading...</div>
  return <ProductionSettings workspaceId={workspaceId} />
}

function ProductDetailsWrapper() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { workspaceId } = useSessionStore()

  const { data: product, isLoading, error } = useQuery({
    queryKey: ['product', workspaceId, id],
    queryFn: async () => {
      if (!workspaceId || !id) return null
      const productDoc = await getDoc(doc(db, 'workspaces', workspaceId, 'products', id))
      if (!productDoc.exists()) {
        throw new Error('Product not found')
      }
      return { id: productDoc.id, ...productDoc.data() } as any
    },
    enabled: !!workspaceId && !!id,
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading product...</p>
        </div>
      </div>
    )
  }

  if (error || !product) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-red-600 mb-4">Product not found</p>
          <button
            onClick={() => navigate('/inventory')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Back to Inventory
          </button>
        </div>
      </div>
    )
  }

  return (
    <ProductDetails
      product={product}
      onClose={() => navigate('/inventory')}
      onSaved={() => {
        // Optionally refresh or navigate
      }}
    />
  )
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: true, // Refetch when window regains focus for real-time updates
      retry: 1,
      staleTime: 30 * 1000, // 30 seconds - shorter for more responsive updates
      gcTime: 5 * 60 * 1000, // 5 minutes garbage collection time (formerly cacheTime)
    },
  },
})

function ScannerPage() {
  const { workspaceId } = useSessionStore()
  const navigate = useNavigate()
  const location = useLocation()

  if (!workspaceId) return null

  const handleClose = () => {
    // Try to go back if there is history, otherwise go to dashboard
    if (window.history.length > 1) {
      navigate(-1)
    } else {
      navigate('/')
    }
  }

  // Check if this is a PO scanner (from query param or path)
  const isPOScanner = location.search.includes('po=true') || location.pathname.includes('po-scanner') || location.pathname === '/scan/po'

  if (isPOScanner) {
    // FORCE HARD NAVIGATION: use window.location.href to kill all camera streams and clear state
    return <PurchaseOrderScanner workspaceId={workspaceId} onClose={() => window.location.href = '/purchase-orders'} />
  }

  return <ProductionScanner workspaceId={workspaceId} onClose={handleClose} />
}


const router = createBrowserRouter([
  {
    path: '/landing',
    element: <Landing />,
    errorElement: <ErrorPage />,
  },
  {
    path: '/login',
    element: <Login />,
  },
  {
    path: '/forgot-password',
    element: <ForgotPassword />,
  },
  {
    path: '/create-workspace',
    element: <CreateWorkspace />,
  },
  {
    path: '/',
    element: <App />,
    errorElement: <ErrorPage />,
    children: [
      {
        index: true,
        element: (
          <ProtectedRoute requiredScreen="home">
            <Dashboard />
          </ProtectedRoute>
        ),
      },
      {
        path: 'admin',
        element: (
          <ProtectedRoute requireSuperAdmin>
            <Admin />
          </ProtectedRoute>
        ),
      },
      {
        path: 'inventory',
        element: (
          <ProtectedRoute requiredScreen="inventory">
            <Inventory />
          </ProtectedRoute>
        ),
      },
      {
        path: 'inventory/:id',
        element: (
          <ProtectedRoute requiredScreen="inventory">
            <ProductDetailsWrapper />
          </ProtectedRoute>
        ),
      },
      {
        path: 'production',
        element: (
          <ProtectedRoute requiredScreen="production">
            <ProductionLayout />
          </ProtectedRoute>
        ),
        children: [
          { index: true, element: <Production /> },
          { path: 'calendar', element: <ProductionCalendarWrapper /> },
          { path: 'reports', element: <ProductionReportsWrapper /> },
          { path: 'settings', element: <ProductionSettingsWrapper /> },
        ]
      },
      {
        path: 'reports',
        element: (
          <ProtectedRoute requiredScreen="reports">
            <Reports />
          </ProtectedRoute>
        ),
      },
      {
        path: 'settings',
        element: (
          <ProtectedRoute requiredScreen="settings">
            <Settings />
          </ProtectedRoute>
        ),
      },
      {
        path: 'integrations',
        element: (
          <ProtectedRoute requiredScreen="settings">
            <Integrations />
          </ProtectedRoute>
        ),
      },
      {
        path: 'quickbooks/callback',
        element: <QuickBooksCallback />,
      },
      {
        path: 'scan',
        element: (
          <ProtectedRoute requiredScreen="scan">
            <ScannerPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'scan/po',
        element: (
          <ProtectedRoute requiredScreen="scan">
            <ScannerPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'purchase-orders',
        element: (
          <ProtectedRoute requiredScreen="purchase-orders">
            <PurchaseOrders />
          </ProtectedRoute>
        ),
      },
      {
        path: 'purchase-orders/new',
        element: (
          <ProtectedRoute requiredScreen="purchase-orders">
            <PurchaseOrderForm />
          </ProtectedRoute>
        ),
      },
      {
        path: 'purchase-orders/:id',
        element: (
          <ProtectedRoute requiredScreen="purchase-orders">
            <PurchaseOrderForm />
          </ProtectedRoute>
        ),
      },
      {
        path: 'purchase-orders/:id/edit',
        element: (
          <ProtectedRoute requiredScreen="purchase-orders">
            <PurchaseOrderForm />
          </ProtectedRoute>
        ),
      },
    ]
  },
  {
    path: '*',
    element: <ErrorPage />,
  },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
)
