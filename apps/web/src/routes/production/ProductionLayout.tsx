import { Outlet, NavLink } from 'react-router-dom'
import {
  Squares2X2Icon,
  CalendarIcon,
  ChartBarIcon,
  CogIcon
} from '@heroicons/react/24/outline'

export function ProductionLayout() {
  return (
    <div className="space-y-8">
      {/* Header Section - Matching Dashboard Style */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Production</h1>
          <p className="mt-1 text-sm text-gray-500">
            Plan, execute, and analyze production workflows and job management.
          </p>
        </div>
      </div>

      {/* Module Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-6 overflow-x-auto no-scrollbar">
          <NavLink
            to="/production"
            end
            className={({ isActive }) => `py-2 px-1 border-b-2 text-sm font-medium flex items-center space-x-2 whitespace-nowrap ${isActive ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
          >
            <Squares2X2Icon className="h-4 w-4" />
            <span>Board & List</span>
          </NavLink>
          <NavLink
            to="/production/calendar"
            className={({ isActive }) => `py-2 px-1 border-b-2 text-sm font-medium flex items-center space-x-2 whitespace-nowrap ${isActive ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
          >
            <CalendarIcon className="h-4 w-4" />
            <span>Calendar</span>
          </NavLink>
          <NavLink
            to="/production/reports"
            className={({ isActive }) => `py-2 px-1 border-b-2 text-sm font-medium flex items-center space-x-2 whitespace-nowrap ${isActive ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
          >
            <ChartBarIcon className="h-4 w-4" />
            <span>Reports</span>
          </NavLink>
          <NavLink
            to="/production/settings"
            className={({ isActive }) => `py-2 px-1 border-b-2 text-sm font-medium flex items-center space-x-2 whitespace-nowrap ${isActive ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
          >
            <CogIcon className="h-4 w-4" />
            <span>Settings</span>
          </NavLink>
        </nav>
      </div>

      {/* Content */}
      <div>
        <Outlet />
      </div>
    </div>
  )
}


