import './App.css'
import { Outlet, NavLink } from 'react-router-dom'
import { 
  HomeIcon, 
  CubeIcon, 
  CogIcon, 
  ClipboardDocumentListIcon,
  UserIcon,
  QrCodeIcon,
  ChartBarIcon
} from '@heroicons/react/24/outline'

function App() {
  
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Desktop Sidebar */}
      <div className="hidden md:fixed md:inset-y-0 md:flex md:w-64 md:flex-col">
        <div className="flex min-h-0 flex-1 flex-col bg-white shadow-lg">
          <div className="flex flex-1 flex-col overflow-y-auto pt-5 pb-4">
            <div className="flex flex-shrink-0 items-center px-4">
              <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center">
                <CubeIcon className="h-5 w-5 text-white" />
              </div>
              <span className="ml-3 text-xl font-bold text-gray-900">Inventory</span>
            </div>
            <nav className="mt-8 flex-1 space-y-1 px-2">
              <NavLink
                to="/"
                className={({ isActive }) => `group flex items-center px-2 py-2 text-sm font-medium rounded-md ${isActive ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}
              >
                <HomeIcon className="mr-3 h-5 w-5 flex-shrink-0" />
                Dashboard
              </NavLink>
              <NavLink
                to="/inventory"
                className={({ isActive }) => `group flex items-center px-2 py-2 text-sm font-medium rounded-md ${isActive ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}
              >
                <CubeIcon className="mr-3 h-5 w-5 flex-shrink-0" />
                Inventory
              </NavLink>
              <NavLink
                to="/production"
                className={({ isActive }) => `group flex items-center px-2 py-2 text-sm font-medium rounded-md ${isActive ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}
              >
                <CogIcon className="mr-3 h-5 w-5 flex-shrink-0" />
                Production
              </NavLink>
              <NavLink
                to="/work"
                className={({ isActive }) => `group flex items-center px-2 py-2 text-sm font-medium rounded-md ${isActive ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}
              >
                <ClipboardDocumentListIcon className="mr-3 h-5 w-5 flex-shrink-0" />
                Work Management
              </NavLink>
              <NavLink
                to="/my"
                className={({ isActive }) => `group flex items-center px-2 py-2 text-sm font-medium rounded-md ${isActive ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}
              >
                <UserIcon className="mr-3 h-5 w-5 flex-shrink-0" />
                My Work
              </NavLink>
              <NavLink
                to="/reports"
                className={({ isActive }) => `group flex items-center px-2 py-2 text-sm font-medium rounded-md ${isActive ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}
              >
                <ChartBarIcon className="mr-3 h-5 w-5 flex-shrink-0" />
                Reports
              </NavLink>
            </nav>
          </div>
        </div>
      </div>

      {/* Mobile bottom navigation */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200">
        <nav className="grid grid-cols-4 gap-1">
          <NavLink 
            to="/" 
            className={({ isActive }) => `flex flex-col items-center py-2 px-1 text-xs font-medium ${isActive ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <HomeIcon className="h-6 w-6 mb-1" />
            Dashboard
          </NavLink>
          <NavLink 
            to="/inventory" 
            className={({ isActive }) => `flex flex-col items-center py-2 px-1 text-xs font-medium ${isActive ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <CubeIcon className="h-6 w-6 mb-1" />
            Inventory
          </NavLink>
          <NavLink 
            to="/scan" 
            className={({ isActive }) => `flex flex-col items-center py-2 px-1 text-xs font-medium ${isActive ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <QrCodeIcon className="h-6 w-6 mb-1" />
            Scan
          </NavLink>
          <NavLink 
            to="/my" 
            className={({ isActive }) => `flex flex-col items-center py-2 px-1 text-xs font-medium ${isActive ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <UserIcon className="h-6 w-6 mb-1" />
            My Work
          </NavLink>
        </nav>
      </div>

      {/* Main content */}
      <div className="md:pl-64 flex flex-col flex-1">
        <main className="flex-1 pb-16 md:pb-0">
          <div className="w-full px-6 lg:px-10">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}

export default App
