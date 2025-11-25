import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getReplenishmentReport, exportToCSV } from '../../api/reports'
import type { ReplenishmentRow, ReportFilters } from '../../api/reports'
import { ReportFilters as FilterComponent } from './ReportFilters'
import { ExportButton } from './ExportButton'
import { DataTable } from '../DataTable'

interface ReplenishmentProps {
  workspaceId: string
}

export function Replenishment({ workspaceId }: ReplenishmentProps) {
  const [filters, setFilters] = useState<ReportFilters>({})
  const [isExporting, setIsExporting] = useState(false)

  const { data: reportData = [], isLoading, error } = useQuery({
    queryKey: ['replenishment', workspaceId, filters],
    queryFn: () => getReplenishmentReport(workspaceId, filters),
    enabled: !!workspaceId
  })

  // Filter for items that need replenishment
  const needsReplenishment = reportData.filter(row => row.suggestedQty > 0)

  // Calculate summary statistics
  const stats = {
    totalSKUs: reportData.length,
    needsReplenishment: needsReplenishment.length,
    totalSuggestedValue: needsReplenishment.reduce((sum, row) => sum + (row.suggestedQty * 10), 0), // Mock unit cost
    avgLeadTime: reportData.length > 0 
      ? reportData.reduce((sum, row) => sum + row.leadTime, 0) / reportData.length 
      : 0,
    avgSafetyStock: reportData.length > 0 
      ? reportData.reduce((sum, row) => sum + row.safety, 0) / reportData.length 
      : 0
  }

  const handleExport = async () => {
    setIsExporting(true)
    try {
      const columns = [
        { key: 'sku' as keyof ReplenishmentRow, label: 'SKU' },
        { key: 'product' as keyof ReplenishmentRow, label: 'Product' },
        { key: 'avgDailyDemand' as keyof ReplenishmentRow, label: 'Avg Daily Demand' },
        { key: 'leadTime' as keyof ReplenishmentRow, label: 'Lead Time (Days)' },
        { key: 'reviewPeriod' as keyof ReplenishmentRow, label: 'Review Period (Days)' },
        { key: 'safety' as keyof ReplenishmentRow, label: 'Safety Stock' },
        { key: 'targetStock' as keyof ReplenishmentRow, label: 'Target Stock' },
        { key: 'available' as keyof ReplenishmentRow, label: 'Available' },
        { key: 'onPO' as keyof ReplenishmentRow, label: 'On PO' },
        { key: 'suggestedQty' as keyof ReplenishmentRow, label: 'Suggested Qty' },
        { key: 'moq' as keyof ReplenishmentRow, label: 'MOQ' },
        { key: 'casePack' as keyof ReplenishmentRow, label: 'Case Pack' },
        { key: 'supplier' as keyof ReplenishmentRow, label: 'Supplier' }
      ]
      
      exportToCSV(reportData, 'replenishment-suggestions.csv', columns)
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
    cleaned = cleaned.replace(/\s+\?\s+/g, ' ') // Remove " ? " patterns
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
      key: 'sku' as keyof ReplenishmentRow, 
      label: 'SKU',
      render: (value: string) => value || '-'
    },
    { 
      key: 'product' as keyof ReplenishmentRow, 
      label: 'Product',
      render: (value: string) => cleanProductName(value)
    },
    { 
      key: 'avgDailyDemand' as keyof ReplenishmentRow, 
      label: 'Avg Daily Demand',
      render: (value: number) => value.toFixed(2)
    },
    { key: 'leadTime' as keyof ReplenishmentRow, label: 'Lead Time (Days)' },
    { key: 'reviewPeriod' as keyof ReplenishmentRow, label: 'Review Period (Days)' },
    { 
      key: 'safety' as keyof ReplenishmentRow, 
      label: 'Safety Stock',
      render: (value: number) => value.toFixed(2)
    },
    { 
      key: 'targetStock' as keyof ReplenishmentRow, 
      label: 'Target Stock',
      render: (value: number) => value.toFixed(2)
    },
    { 
      key: 'available' as keyof ReplenishmentRow, 
      label: 'Available',
      render: (value: number) => value.toFixed(2)
    },
    { 
      key: 'onPO' as keyof ReplenishmentRow, 
      label: 'On PO',
      render: (value: number) => value.toFixed(2)
    },
    { 
      key: 'suggestedQty' as keyof ReplenishmentRow, 
      label: 'Suggested Qty',
      render: (value: number) => (
        <span className={value > 0 ? 'text-red-600 font-medium' : 'text-gray-500'}>
          {value > 0 ? value.toFixed(0) : '-'}
        </span>
      )
    },
    { key: 'moq' as keyof ReplenishmentRow, label: 'MOQ' },
    { key: 'casePack' as keyof ReplenishmentRow, label: 'Case Pack' },
    { key: 'supplier' as keyof ReplenishmentRow, label: 'Supplier' }
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
          <h3 className="text-sm font-medium text-gray-500">Need Replenishment</h3>
          <p className="text-2xl font-semibold text-red-600">{stats.needsReplenishment}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <h3 className="text-sm font-medium text-gray-500">Suggested Value</h3>
          <p className="text-2xl font-semibold text-gray-900">£{stats.totalSuggestedValue.toFixed(2)}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <h3 className="text-sm font-medium text-gray-500">Avg Lead Time</h3>
          <p className="text-2xl font-semibold text-gray-900">{stats.avgLeadTime.toFixed(0)} days</p>
        </div>
      </div>

      {/* Priority Actions */}
      {needsReplenishment.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h3 className="text-sm font-medium text-red-800 mb-2">Priority Replenishment Items</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {needsReplenishment.slice(0, 6).map((item, index) => (
              <div key={item.sku} className="text-sm text-red-700">
                {index + 1}. {item.sku} - {item.suggestedQty.toFixed(0)} units
              </div>
            ))}
            {needsReplenishment.length > 6 && (
              <div className="text-sm text-red-600 font-medium">
                +{needsReplenishment.length - 6} more items...
              </div>
            )}
          </div>
        </div>
      )}

      {/* Filters */}
      <FilterComponent
        filters={filters}
        onFiltersChange={setFilters}
        showSupplier={true}
        showLowStockOnly={true}
        showAbcClass={true}
      />

      {/* Export Button */}
      <div className="flex justify-end">
        <ExportButton
          onExport={handleExport}
          isLoading={isExporting}
          filename="replenishment-suggestions"
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
          <p className="text-gray-500">No replenishment data available for the selected filters.</p>
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
