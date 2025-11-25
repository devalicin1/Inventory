import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getStockOnHandReport, exportToCSV } from '../../api/reports'
import type { StockOnHandRow, ReportFilters } from '../../api/reports'
import { ReportFilters as FilterComponent } from './ReportFilters'
import { ExportButton } from './ExportButton'
import { DataTable } from '../DataTable'

interface StockOnHandProps {
  workspaceId: string
}

const reportTabs = [
  { id: 'all', name: 'All Locations' },
  { id: 'location', name: 'By Location' },
  { id: 'category', name: 'By Category' },
  { id: 'low-stock', name: 'Low Stock' },
  { id: 'over-stock', name: 'Over Stock' }
]

export function StockOnHand({ workspaceId }: StockOnHandProps) {
  const [activeTab, setActiveTab] = useState('all')
  const [filters, setFilters] = useState<ReportFilters>({})
  const [isExporting, setIsExporting] = useState(false)

  const { data: reportData = [], isLoading, error } = useQuery({
    queryKey: ['stock-on-hand', workspaceId, filters],
    queryFn: () => getStockOnHandReport(workspaceId, filters),
    enabled: !!workspaceId
  })

  // Filter data based on active tab
  const filteredData = reportData.filter(row => {
    switch (activeTab) {
      case 'low-stock':
        return row.lowStock
      case 'over-stock':
        return row.overStock
      default:
        return true
    }
  })

  // Group data for category and location tabs
  const groupedData = activeTab === 'category' 
    ? reportData.reduce((acc, row) => {
        const category = row.category || 'Uncategorized'
        if (!acc[category]) acc[category] = []
        acc[category].push(row)
        return acc
      }, {} as Record<string, StockOnHandRow[]>)
    : activeTab === 'location'
    ? reportData.reduce((acc, row) => {
        const location = row.location
        if (!acc[location]) acc[location] = []
        acc[location].push(row)
        return acc
      }, {} as Record<string, StockOnHandRow[]>)
    : {}

  // Calculate summary statistics
  const stats = {
    totalSKUs: filteredData.length,
    lowStockCount: reportData.filter(r => r.lowStock).length,
    overStockCount: reportData.filter(r => r.overStock).length,
    totalValue: filteredData.reduce((sum, row) => sum + (row.soh * 10), 0), // Mock unit cost
    avgDaysOfCover: filteredData.length > 0 
      ? filteredData.reduce((sum, row) => sum + row.daysOfCover, 0) / filteredData.length 
      : 0
  }

  const handleExport = async () => {
    setIsExporting(true)
    try {
      const columns = [
        { key: 'sku' as keyof StockOnHandRow, label: 'SKU' },
        { key: 'productName' as keyof StockOnHandRow, label: 'Product Name' },
        { key: 'location' as keyof StockOnHandRow, label: 'Location' },
        { key: 'soh' as keyof StockOnHandRow, label: 'SOH' },
        { key: 'allocated' as keyof StockOnHandRow, label: 'Allocated' },
        { key: 'available' as keyof StockOnHandRow, label: 'Available' },
        { key: 'onPO' as keyof StockOnHandRow, label: 'On PO' },
        { key: 'min' as keyof StockOnHandRow, label: 'Min' },
        { key: 'max' as keyof StockOnHandRow, label: 'Max' },
        { key: 'safety' as keyof StockOnHandRow, label: 'Safety' },
        { key: 'reorderPoint' as keyof StockOnHandRow, label: 'Reorder Point' },
        { key: 'daysOfCover' as keyof StockOnHandRow, label: 'Days of Cover' }
      ]
      
      exportToCSV(filteredData, `stock-on-hand-${activeTab}.csv`, columns)
    } finally {
      setIsExporting(false)
    }
  }

  // Helper function to clean product names and fix encoding issues
  const cleanProductName = (name: string | null | undefined): string => {
    if (!name) return 'Unnamed Product'
    let cleaned = String(name)
      .replace(/\uFFFD/g, '') // Remove replacement characters ()
      .replace(/\u0000/g, '') // Remove null characters
      .trim()
    
    // Try to decode HTML entities if any
    try {
      const textarea = document.createElement('textarea')
      textarea.innerHTML = cleaned
      cleaned = textarea.value || cleaned
    } catch (e) {
      // If decoding fails, use original
    }
    
    // Remove question marks that appear between numbers (likely encoding errors for special characters)
    // Pattern: " ? " or " ?" or "? " between alphanumeric characters
    cleaned = cleaned.replace(/\s+\?\s+/g, ' ') // Remove " ? " patterns (space-question-space)
    cleaned = cleaned.replace(/(\d)\s+\?(\s+\d)/g, '$1$2') // Remove " ? " between numbers
    cleaned = cleaned.replace(/(\w)\s+\?(\s+\w)/g, '$1$2') // Remove " ? " between words
    cleaned = cleaned.replace(/\s+\?/g, '') // Remove trailing " ?"
    cleaned = cleaned.replace(/\?\s+/g, '') // Remove leading "? "
    cleaned = cleaned.replace(/\s+/g, ' ') // Normalize multiple spaces to single space
    cleaned = cleaned.trim()
    
    return cleaned || 'Unnamed Product'
  }

  const columns = [
    { 
      key: 'sku' as keyof StockOnHandRow, 
      label: 'SKU',
      render: (value: string) => value || '-'
    },
    { 
      key: 'productName' as keyof StockOnHandRow, 
      label: 'Product Name',
      render: (value: string) => cleanProductName(value)
    },
    { key: 'location' as keyof StockOnHandRow, label: 'Location' },
    { 
      key: 'soh' as keyof StockOnHandRow, 
      label: 'SOH',
      render: (value: number) => value != null ? value.toFixed(2) : '-'
    },
    { 
      key: 'allocated' as keyof StockOnHandRow, 
      label: 'Allocated',
      render: (value: number) => value != null ? value.toFixed(2) : '-'
    },
    { 
      key: 'available' as keyof StockOnHandRow, 
      label: 'Available',
      render: (value: number) => value != null ? value.toFixed(2) : '-'
    },
    { 
      key: 'onPO' as keyof StockOnHandRow, 
      label: 'On PO',
      render: (value: number) => value != null ? value.toFixed(2) : '-'
    },
    { 
      key: 'min' as keyof StockOnHandRow, 
      label: 'Min',
      render: (value: number) => value != null ? value.toFixed(2) : '-'
    },
    { 
      key: 'max' as keyof StockOnHandRow, 
      label: 'Max',
      render: (value: number) => value != null ? value.toFixed(2) : '-'
    },
    { 
      key: 'safety' as keyof StockOnHandRow, 
      label: 'Safety',
      render: (value: number) => value != null ? value.toFixed(2) : '-'
    },
    { 
      key: 'reorderPoint' as keyof StockOnHandRow, 
      label: 'Reorder Point',
      render: (value: number) => value != null ? value.toFixed(2) : '-'
    },
    { 
      key: 'daysOfCover' as keyof StockOnHandRow, 
      label: 'Days of Cover',
      render: (value: number) => value != null ? value.toFixed(1) : '-'
    },
    {
      key: 'lowStock' as keyof StockOnHandRow,
      label: 'Status',
      render: (_value: boolean, row: StockOnHandRow) => {
        if (row.lowStock) {
          return <span className="px-2 py-1 text-xs font-medium text-red-800 bg-red-100 rounded-full">Low Stock</span>
        }
        if (row.overStock) {
          return <span className="px-2 py-1 text-xs font-medium text-yellow-800 bg-yellow-100 rounded-full">Over Stock</span>
        }
        return <span className="px-2 py-1 text-xs font-medium text-green-800 bg-green-100 rounded-full">Normal</span>
      }
    }
  ]

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600">Error loading report: {error.message}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <h3 className="text-sm font-medium text-gray-500">Total SKUs</h3>
          <p className="text-2xl font-semibold text-gray-900">{stats.totalSKUs}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <h3 className="text-sm font-medium text-gray-500">Low Stock Items</h3>
          <p className="text-2xl font-semibold text-red-600">{stats.lowStockCount}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <h3 className="text-sm font-medium text-gray-500">Over Stock Items</h3>
          <p className="text-2xl font-semibold text-yellow-600">{stats.overStockCount}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <h3 className="text-sm font-medium text-gray-500">Avg Days of Cover</h3>
          <p className="text-2xl font-semibold text-gray-900">{stats.avgDaysOfCover.toFixed(1)}</p>
        </div>
      </div>

      {/* Filters */}
      <FilterComponent
        filters={filters}
        onFiltersChange={setFilters}
        showDateRange={true}
        showLocation={true}
        showCategory={true}
        showSupplier={true}
        showLowStockOnly={true}
      />

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {reportTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.name}
            </button>
          ))}
        </nav>
      </div>

      {/* Export Button */}
      <div className="flex justify-end">
        <ExportButton
          onExport={handleExport}
          isLoading={isExporting}
          filename="stock-on-hand"
        />
      </div>

      {/* Data Table */}
      {isLoading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-500">Loading report data...</p>
        </div>
      ) : activeTab === 'category' || activeTab === 'location' ? (
        <div className="space-y-6">
          {Object.entries(groupedData).map(([group, rows]) => (
            <div key={group} className="bg-white rounded-lg border border-gray-200">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">
                  {group} ({rows.length} items)
                </h3>
              </div>
              <DataTable
                data={rows}
                columns={columns}
                onRowClick={() => {}}
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200">
          <DataTable
            data={filteredData}
            columns={columns}
            onRowClick={() => {}}
          />
        </div>
      )}
    </div>
  )
}
