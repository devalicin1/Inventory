import { 
  CubeIcon, 
  CogIcon, 
  ClipboardDocumentListIcon,
  ChartBarIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon
} from '@heroicons/react/24/outline'

export function Dashboard() {
  return (
    <div className="py-6">
      <div className="w-full px-6 lg:px-10">
        {/* Header */}
        <div className="mb-6 pb-4 border-b border-gray-100">
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="mt-2 text-sm text-gray-600">
            Welcome back! Here's what's happening with your inventory today.
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
          <div className="overflow-hidden rounded-lg bg-white px-4 py-5 shadow-sm border border-gray-100 sm:p-6">
            <dt className="truncate text-sm font-medium text-gray-500">Total Products</dt>
            <dd className="mt-1 text-3xl font-semibold tracking-tight text-gray-900">127</dd>
          </div>
          <div className="overflow-hidden rounded-lg bg-white px-4 py-5 shadow-sm border border-gray-100 sm:p-6">
            <dt className="truncate text-sm font-medium text-gray-500">Low Stock Items</dt>
            <dd className="mt-1 flex items-baseline">
              <p className="text-3xl font-semibold tracking-tight text-red-600">12</p>
              <ExclamationTriangleIcon className="ml-2 h-5 w-5 text-red-500" />
            </dd>
          </div>
          <div className="overflow-hidden rounded-lg bg-white px-4 py-5 shadow-sm border border-gray-100 sm:p-6">
            <dt className="truncate text-sm font-medium text-gray-500">Active Orders</dt>
            <dd className="mt-1 flex items-baseline">
              <p className="text-3xl font-semibold tracking-tight text-blue-600">8</p>
              <ClockIcon className="ml-2 h-5 w-5 text-blue-500" />
            </dd>
          </div>
          <div className="overflow-hidden rounded-lg bg-white px-4 py-5 shadow-sm border border-gray-100 sm:p-6">
            <dt className="truncate text-sm font-medium text-gray-500">Completed Today</dt>
            <dd className="mt-1 flex items-baseline">
              <p className="text-3xl font-semibold tracking-tight text-green-600">23</p>
              <CheckCircleIcon className="ml-2 h-5 w-5 text-green-500" />
            </dd>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 mb-8">
          <div className="bg-white overflow-hidden shadow-sm border border-gray-100 rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <CubeIcon className="h-6 w-6 text-gray-400" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Inventory Management
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      Track products and stock levels
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
            <div className="bg-gray-50 px-5 py-3 border-t border-gray-100">
              <div className="text-sm">
                <a href="/inventory" className="font-medium text-blue-600 hover:text-blue-500">
                  View inventory
                </a>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow-sm border border-gray-100 rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <CogIcon className="h-6 w-6 text-gray-400" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Production Orders
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      Manage manufacturing workflows
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
            <div className="bg-gray-50 px-5 py-3 border-t border-gray-100">
              <div className="text-sm">
                <a href="/production" className="font-medium text-blue-600 hover:text-blue-500">
                  View production
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white shadow-sm border border-gray-100 overflow-hidden sm:rounded-md">
          <div className="px-4 py-5 sm:px-6 border-b border-gray-100">
            <h3 className="text-lg leading-6 font-medium text-gray-900">Recent Activity</h3>
            <p className="mt-1 max-w-2xl text-sm text-gray-500">
              Latest updates from your inventory system
            </p>
          </div>
          <ul className="divide-y divide-gray-200">
            <li className="px-4 py-4 sm:px-6">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-blue-600 truncate">
                  New product added: Widget A
                </p>
                <div className="ml-2 flex-shrink-0 flex">
                  <p className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                    Active
                  </p>
                </div>
              </div>
              <div className="mt-2">
                <div className="flex items-center text-sm text-gray-500">
                  <ClockIcon className="flex-shrink-0 mr-1.5 h-4 w-4 text-gray-400" />
                  <p>2 hours ago</p>
                </div>
              </div>
            </li>
            <li className="px-4 py-4 sm:px-6">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-blue-600 truncate">
                  Production Order PO-0001 completed
                </p>
                <div className="ml-2 flex-shrink-0 flex">
                  <p className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                    Done
                  </p>
                </div>
              </div>
              <div className="mt-2">
                <div className="flex items-center text-sm text-gray-500">
                  <ClockIcon className="flex-shrink-0 mr-1.5 h-4 w-4 text-gray-400" />
                  <p>4 hours ago</p>
                </div>
              </div>
            </li>
            <li className="px-4 py-4 sm:px-6">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-red-600 truncate">
                  Low stock alert: Component C
                </p>
                <div className="ml-2 flex-shrink-0 flex">
                  <p className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                    Warning
                  </p>
                </div>
              </div>
              <div className="mt-2">
                <div className="flex items-center text-sm text-gray-500">
                  <ClockIcon className="flex-shrink-0 mr-1.5 h-4 w-4 text-gray-400" />
                  <p>6 hours ago</p>
                </div>
              </div>
            </li>
          </ul>
        </div>
      </div>
    </div>
  )
}
