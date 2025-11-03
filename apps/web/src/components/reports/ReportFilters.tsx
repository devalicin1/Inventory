import { useState } from 'react'
import type { ReportFilters as FilterType } from '../../api/reports'

interface ReportFiltersProps {
  filters: FilterType
  onFiltersChange: (filters: FilterType) => void
  availableLocations?: string[]
  availableCategories?: string[]
  availableSuppliers?: string[]
  availableChannels?: string[]
  availableUsers?: string[]
  availableReasonCodes?: string[]
  availableCustomers?: string[]
  showDateRange?: boolean
  showLocation?: boolean
  showCategory?: boolean
  showSupplier?: boolean
  showChannel?: boolean
  showUser?: boolean
  showReasonCode?: boolean
  showCustomer?: boolean
  showSku?: boolean
  showMovementType?: boolean
  showAbcClass?: boolean
  showLowStockOnly?: boolean
  showAgingBucket?: boolean
}

export function ReportFilters({
  filters,
  onFiltersChange,
  availableLocations = [],
  availableCategories = [],
  availableSuppliers = [],
  availableChannels = [],
  availableUsers = [],
  // availableReasonCodes = [],
  // availableCustomers = [],
  showDateRange = true,
  showLocation = false,
  showCategory = false,
  showSupplier = false,
  showChannel = false,
  showUser = false,
  // showReasonCode = false,
  // showCustomer = false,
  showSku = false,
  showMovementType = false,
  showAbcClass = false,
  showLowStockOnly = false,
  showAgingBucket = false
}: ReportFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  const handleFilterChange = (key: keyof FilterType, value: any) => {
    onFiltersChange({
      ...filters,
      [key]: value
    })
  }

  const clearFilters = () => {
    onFiltersChange({})
  }

  const hasActiveFilters = Object.values(filters).some(value => 
    value !== undefined && value !== '' && 
    (Array.isArray(value) ? value.length > 0 : true)
  )

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-900">Filters</h3>
        <div className="flex items-center space-x-2">
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Clear all
            </button>
          )}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-sm text-blue-600 hover:text-blue-700"
          >
            {isExpanded ? 'Hide' : 'Show'} filters
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {showDateRange && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date From
                </label>
                <input
                  type="date"
                  value={filters.dateFrom || ''}
                  onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date To
                </label>
                <input
                  type="date"
                  value={filters.dateTo || ''}
                  onChange={(e) => handleFilterChange('dateTo', e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </>
          )}

          {showLocation && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Location
              </label>
              <select
                value={filters.location || ''}
                onChange={(e) => handleFilterChange('location', e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Locations</option>
                {availableLocations.map(location => (
                  <option key={location} value={location}>{location}</option>
                ))}
              </select>
            </div>
          )}

          {showCategory && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Category
              </label>
              <select
                value={filters.category || ''}
                onChange={(e) => handleFilterChange('category', e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Categories</option>
                {availableCategories.map(category => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </div>
          )}

          {showSupplier && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Supplier
              </label>
              <select
                value={filters.supplier || ''}
                onChange={(e) => handleFilterChange('supplier', e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Suppliers</option>
                {availableSuppliers.map(supplier => (
                  <option key={supplier} value={supplier}>{supplier}</option>
                ))}
              </select>
            </div>
          )}

          {showChannel && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Channel
              </label>
              <select
                value={filters.channel || ''}
                onChange={(e) => handleFilterChange('channel', e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Channels</option>
                {availableChannels.map(channel => (
                  <option key={channel} value={channel}>{channel}</option>
                ))}
              </select>
            </div>
          )}

          {showUser && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                User
              </label>
              <select
                value={filters.user || ''}
                onChange={(e) => handleFilterChange('user', e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Users</option>
                {availableUsers.map(user => (
                  <option key={user} value={user}>{user}</option>
                ))}
              </select>
            </div>
          )}

          {showSku && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                SKU
              </label>
              <input
                type="text"
                value={filters.sku || ''}
                onChange={(e) => handleFilterChange('sku', e.target.value)}
                placeholder="Enter SKU..."
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          {showMovementType && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Movement Type
              </label>
              <select
                value={filters.movementType || ''}
                onChange={(e) => handleFilterChange('movementType', e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Types</option>
                <option value="Receive">Receive</option>
                <option value="Ship">Ship</option>
                <option value="Transfer">Transfer</option>
                <option value="Adjust+">Adjust+</option>
                <option value="Adjust-">Adjust-</option>
                <option value="Return to Stock">Return to Stock</option>
                <option value="Write-off">Write-off</option>
              </select>
            </div>
          )}

          {showAbcClass && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ABC Class
              </label>
              <select
                value={filters.abcClass || ''}
                onChange={(e) => handleFilterChange('abcClass', e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Classes</option>
                <option value="A">A Class</option>
                <option value="B">B Class</option>
                <option value="C">C Class</option>
              </select>
            </div>
          )}

          {showAgingBucket && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Aging Bucket
              </label>
              <select
                value={filters.agingBucket || ''}
                onChange={(e) => handleFilterChange('agingBucket', e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Buckets</option>
                <option value="0-30">0-30 Days</option>
                <option value="31-60">31-60 Days</option>
                <option value="61-90">61-90 Days</option>
                <option value="90+">90+ Days</option>
              </select>
            </div>
          )}

          {showLowStockOnly && (
            <div className="flex items-center">
              <input
                type="checkbox"
                id="lowStockOnly"
                checked={filters.lowStockOnly || false}
                onChange={(e) => handleFilterChange('lowStockOnly', e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="lowStockOnly" className="ml-2 text-sm text-gray-700">
                Low Stock Only
              </label>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
