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
          { path: 'calendar', element: <ProductionCalendar workspaceId={'demo-workspace'} /> },
          { path: 'reports', element: <ProductionReports workspaceId={'demo-workspace'} /> },
          { path: 'settings', element: <ProductionSettings workspaceId={'demo-workspace'} /> },
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
