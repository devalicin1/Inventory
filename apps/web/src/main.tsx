import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import App from './App.tsx'
import { Dashboard } from './routes/Dashboard'
import { Inventory } from './routes/Inventory'
import { Production } from './routes/Production'
import { Work } from './routes/Work'

const queryClient = new QueryClient()

const router = createBrowserRouter([
  { 
    path: '/', 
    element: <App />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'inventory', element: <Inventory /> },
      { path: 'production', element: <Production /> },
      { path: 'work', element: <Work /> },
      { path: 'my', element: <Work /> },
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
