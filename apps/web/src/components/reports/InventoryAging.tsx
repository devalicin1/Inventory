import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getInventoryAgingReport, exportToCSV } from '../../api/reports'
import type { InventoryAgingRow, ReportFilters } from '../../api/reports'
import { ReportFilters as FilterComponent } from './ReportFilters'
import { ExportButton } from './ExportButton'
import { DataTable } from '../DataTable'

interface InventoryAgingProps {
  workspaceId: string
}

const agingBuckets = [
  { id: '0-30', name: '0-30 Days', color: 'bg-green-100 text-green-800' },
  { id: '31-60', name: '31-60 Days', color: 'bg-yellow-100 text-yellow-800' },
  { id: '61-90', name: '61-90 Days', color: 'bg-orange-100 text-orange-800' },
  { id: '90+', name: '90+ Days', color: 'bg-red-100 text-red-800' }
]

export function InventoryAging({ workspaceId }: InventoryAgingProps) {
  const [filters, setFilters] = useState<ReportFilters>({})
  const [isExporting, setIsExporting] = useState(false)

  const { data: reportData = [], isLoading, error } = useQuery({
    queryKey: ['inventory-aging', workspaceId, filters],
    queryFn: () => getInventoryAgingReport(workspaceId, filters),
    enabled: !!workspaceId
  })

  // Calculate summary statistics
  const stats = {
    totalSKUs: reportData.length,
    totalValue: reportData.reduce((sum, row) => sum + row.value, 0),
    deadStockCount: reportData.filter(r => r.deadStock).length,
    deadStockValue: reportData.filter(r => r.deadStock).reduce((sum, row) => sum + row.value, 0),
    avgDaysOnHand: reportData.length > 0 
      ? reportData.reduce((sum, row) => sum + row.daysOnHand, 0) / reportData.length 
      : 0
  }

  // Group by aging bucket
  const bucketStats = agingBuckets.map(bucket => {
    const items = reportData.filter(row => row.agingBucket === bucket.id)
    return {
      ...bucket,
      count: items.length,
      value: items.reduce((sum, row) => sum + row.value, 0)
    }
  })

  const handleExport = async () => {
    setIsExporting(true)
    try {
      const columns = [
        { key: 'sku' as keyof InventoryAgingRow, label: 'SKU' },
        { key: 'product' as keyof InventoryAgingRow, label: 'Product' },
        { key: 'firstReceiptDate' as keyof InventoryAgingRow, label: 'First Receipt Date' },
        { key: 'daysOnHand' as keyof InventoryAgingRow, label: 'Days On-Hand' },
        { key: 'agingBucket' as keyof InventoryAgingRow, label: 'Aging Bucket' },
        { key: 'quantity' as keyof InventoryAgingRow, label: 'Quantity' },
        { key: 'unitCost' as keyof InventoryAgingRow, label: 'Unit Cost' },
        { key: 'value' as keyof InventoryAgingRow, label: 'Value (£)' }
      ]
      
      exportToCSV(reportData, 'inventory-aging.csv', columns)
    } finally {
      setIsExporting(false)
    }
  }

  const columns = [
    { key: 'sku' as keyof InventoryAgingRow, label: 'SKU' },
    { key: 'product' as keyof InventoryAgingRow, label: 'Product' },
    { key: 'firstReceiptDate' as keyof InventoryAgingRow, label: 'First Receipt Date' },
    { key: 'daysOnHand' as keyof InventoryAgingRow, label: 'Days On-Hand' },
    { 
      key: 'agingBucket' as keyof InventoryAgingRow, 
      label: 'Aging Bucket',
      render: (value: string) => {
        const bucket = agingBuckets.find(b => b.id === value)
        return (
          <span className={`px-2 py-1 text-xs font-medium rounded-full ${bucket?.color || 'bg-gray-100 text-gray-800'}`}>
            {value}
          </span>
        )
      }
    },
    { 
      key: 'quantity' as keyof InventoryAgingRow, 
      label: 'Quantity',
      render: (value: number) => value.toFixed(2)
    },
    { 
      key: 'unitCost' as keyof InventoryAgingRow, 
      label: 'Unit Cost',
      render: (value: number) => `£${value.toFixed(2)}`
    },
    { 
      key: 'value' as keyof InventoryAgingRow, 
      label: 'Value (£)',
      render: (value: number) => `£${value.toFixed(2)}`
    },
    {
      key: 'deadStock' as keyof InventoryAgingRow,
      label: 'Status',
      render: (value: boolean) => value ? (
        <span className="px-2 py-1 text-xs font-medium text-red-800 bg-red-100 rounded-full">
          Dead Stock
        </span>
      ) : null
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
          <h3 className="text-sm font-medium text-gray-500">Total Value</h3>
          <p className="text-2xl font-semibold text-gray-900">£{stats.totalValue.toFixed(2)}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <h3 className="text-sm font-medium text-gray-500">Dead Stock Items</h3>
          <p className="text-2xl font-semibold text-red-600">{stats.deadStockCount}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <h3 className="text-sm font-medium text-gray-500">Avg Days On-Hand</h3>
          <p className="text-2xl font-semibold text-gray-900">{stats.avgDaysOnHand.toFixed(0)}</p>
        </div>
      </div>

      {/* Aging Bucket Breakdown */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Aging Bucket Breakdown</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {bucketStats.map(bucket => (
            <div key={bucket.id} className="text-center">
              <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${bucket.color} mb-2`}>
                {bucket.name}
              </div>
              <p className="text-2xl font-semibold text-gray-900">{bucket.count}</p>
              <p className="text-sm text-gray-500">£{bucket.value.toFixed(2)}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Filters */}
      <FilterComponent
        filters={filters}
        onFiltersChange={setFilters}
        showAgingBucket={true}
        showCategory={true}
        showLocation={true}
      />

      {/* Export Button */}
      <div className="flex justify-end">
        <ExportButton
          onExport={handleExport}
          isLoading={isExporting}
          filename="inventory-aging"
        />
      </div>

      {/* Data Table */}
      {isLoading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-500">Loading report data...</p>
        </div>
      ) : reportData.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-500">No aging data available for the selected filters.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200">
          <DataTable
            data={reportData}
            columns={columns}
            onRowClick={() => {}}
          />
        </div>
      )}
    </div>
  )
}
