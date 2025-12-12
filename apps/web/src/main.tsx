import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider, useNavigate, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import App from './App.tsx'
import { Dashboard } from './routes/Dashboard'
import { Inventory } from './routes/Inventory'
import { Production } from './routes/Production'
import { ProductionLayout } from './routes/production/ProductionLayout'
import { ProductionCalendar } from './components/ProductionCalendar'
import { ProductionReports } from './components/ProductionReports'
import { ProductionSettings } from './components/ProductionSettings'
import { Work } from './routes/Work'
import { Settings } from './routes/Settings'
import { Reports } from './routes/Reports'
import { PurchaseOrders } from './routes/PurchaseOrders'
import { PurchaseOrderForm } from './routes/PurchaseOrderForm'
import { ProductionScanner } from './components/scanner/ProductionScanner'
import { PurchaseOrderScanner } from './components/scanner/PurchaseOrderScanner'
import { useSessionStore } from './state/sessionStore'

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
    return <PurchaseOrderScanner workspaceId={workspaceId} onClose={handleClose} />
  }

  return <ProductionScanner workspaceId={workspaceId} onClose={handleClose} />
}

const router = createBrowserRouter([
  { 
    path: '/', 
    element: <App />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'inventory', element: <Inventory /> },
      {
        path: 'production',
        element: <ProductionLayout />,
        children: [
          { index: true, element: <Production /> },
          { path: 'calendar', element: <ProductionCalendarWrapper /> },
          { path: 'reports', element: <ProductionReportsWrapper /> },
          { path: 'settings', element: <ProductionSettingsWrapper /> },
        ]
      },
      { path: 'work', element: <Work /> },
      { path: 'my', element: <Work /> },
      { path: 'reports', element: <Reports /> },
      { path: 'settings', element: <Settings /> },
      { path: 'scan', element: <ScannerPage /> },
      { path: 'scan/po', element: <ScannerPage /> },
      { path: 'purchase-orders', element: <PurchaseOrders /> },
      { path: 'purchase-orders/new', element: <PurchaseOrderForm /> },
      { path: 'purchase-orders/:id', element: <PurchaseOrderForm /> },
      { path: 'purchase-orders/:id/edit', element: <PurchaseOrderForm /> },
    ]
  },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
)
