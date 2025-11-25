import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
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
import { ProductionScanner } from './components/ProductionScanner'
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
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
})

function ScannerPage() {
  const { workspaceId } = useSessionStore()
  if (!workspaceId) return null
  return <ProductionScanner workspaceId={workspaceId} />
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
