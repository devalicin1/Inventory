import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { useSessionStore } from './state/sessionStore'
import { Sidebar } from './components/layout/Sidebar'
import { MobileNav } from './components/layout/MobileNav'
import './App.css'

function App() {
  const { setSession } = useSessionStore()

  // Mock authentication for development
  useEffect(() => {
    // Set a mock user session for development
    setSession({
      userId: 'demo-user-123',
      email: 'demo@example.com',
      workspaceId: 'demo-workspace',
      roles: ['owner']
    })
  }, [setSession])

  return (
    <div className="app-shell bg-gray-50">
      <Sidebar />
      <MobileNav />

      {/* Main content */}
      <main className="main-content">
        <div className="px-12">
          <Outlet />
        </div>
      </main>
    </div>
  )
}

export default App
