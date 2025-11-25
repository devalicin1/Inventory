import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getSkuVelocityReport, exportToCSV } from '../../api/reports'
import type { SkuVelocityRow, ReportFilters } from '../../api/reports'
import { ReportFilters as FilterComponent } from './ReportFilters'
import { ExportButton } from './ExportButton'
import { DataTable } from '../DataTable'

interface SkuVelocityProps {
  workspaceId: string
}

const abcColors = {
  A: 'bg-green-100 text-green-800',
  B: 'bg-yellow-100 text-yellow-800',
  C: 'bg-gray-100 text-gray-800'
}

export function SkuVelocity({ workspaceId }: SkuVelocityProps) {
  const [filters, setFilters] = useState<ReportFilters>({})
  const [isExporting, setIsExporting] = useState(false)

  const { data: reportData = [], isLoading, error } = useQuery({
    queryKey: ['sku-velocity', workspaceId, filters],
    queryFn: () => getSkuVelocityReport(workspaceId, filters),
    enabled: !!workspaceId
  })

  // Calculate summary statistics
  const stats = {
    totalSKUs: reportData.length,
    totalRevenue: reportData.reduce((sum, row) => sum + row.netRevenue, 0),
    avgVelocity: reportData.length > 0 
      ? reportData.reduce((sum, row) => sum + row.unitsSoldPerDay, 0) / reportData.length 
      : 0,
    avgTurnover: reportData.length > 0 
      ? reportData.reduce((sum, row) => sum + row.turnoverRatio, 0) / reportData.length 
      : 0
  }

  // ABC class breakdown
  const abcBreakdown = {
    A: reportData.filter(row => row.abcClass === 'A'),
    B: reportData.filter(row => row.abcClass === 'B'),
    C: reportData.filter(row => row.abcClass === 'C')
  }

  const handleExport = async () => {
    setIsExporting(true)
    try {
      const columns = [
        { key: 'sku' as keyof SkuVelocityRow, label: 'SKU' },
        { key: 'product' as keyof SkuVelocityRow, label: 'Product' },
        { key: 'unitsSoldPerDay' as keyof SkuVelocityRow, label: 'Units Sold/Day' },
        { key: 'revenuePerDay' as keyof SkuVelocityRow, label: 'Revenue/Day' },
        { key: 'netUnits' as keyof SkuVelocityRow, label: 'Net Units' },
        { key: 'netRevenue' as keyof SkuVelocityRow, label: 'Net Revenue' },
        { key: 'turnoverRatio' as keyof SkuVelocityRow, label: 'Turnover Ratio' },
        { key: 'sellThroughPercent' as keyof SkuVelocityRow, label: 'Sell-through %' },
        { key: 'abcClass' as keyof SkuVelocityRow, label: 'ABC Class' },
        { key: 'channel' as keyof SkuVelocityRow, label: 'Channel' }
      ]
      
      exportToCSV(reportData, 'sku-velocity-abc.csv', columns)
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
      key: 'sku' as keyof SkuVelocityRow, 
      label: 'SKU',
      render: (value: string) => value || '-'
    },
    { 
      key: 'product' as keyof SkuVelocityRow, 
      label: 'Product',
      render: (value: string) => cleanProductName(value)
    },
    { 
      key: 'unitsSoldPerDay' as keyof SkuVelocityRow, 
      label: 'Units Sold/Day',
      render: (value: number) => value.toFixed(2)
    },
    { 
      key: 'revenuePerDay' as keyof SkuVelocityRow, 
      label: 'Revenue/Day',
      render: (value: number) => `£${value.toFixed(2)}`
    },
    { 
      key: 'netUnits' as keyof SkuVelocityRow, 
      label: 'Net Units',
      render: (value: number) => value.toFixed(0)
    },
    { 
      key: 'netRevenue' as keyof SkuVelocityRow, 
      label: 'Net Revenue',
      render: (value: number) => `£${value.toFixed(2)}`
    },
    { 
      key: 'turnoverRatio' as keyof SkuVelocityRow, 
      label: 'Turnover Ratio',
      render: (value: number) => value.toFixed(2)
    },
    { 
      key: 'sellThroughPercent' as keyof SkuVelocityRow, 
      label: 'Sell-through %',
      render: (value: number) => `${value.toFixed(1)}%`
    },
    { 
      key: 'abcClass' as keyof SkuVelocityRow, 
      label: 'ABC Class',
      render: (value: string) => (
        <span className={`px-2 py-1 text-xs font-medium rounded-full ${abcColors[value as keyof typeof abcColors] || 'bg-gray-100 text-gray-800'}`}>
          {value}
        </span>
      )
    },
    { key: 'channel' as keyof SkuVelocityRow, label: 'Channel' }
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
          <h3 className="text-sm font-medium text-gray-500">Total Revenue</h3>
          <p className="text-2xl font-semibold text-gray-900">£{stats.totalRevenue.toFixed(2)}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <h3 className="text-sm font-medium text-gray-500">Avg Velocity</h3>
          <p className="text-2xl font-semibold text-gray-900">{stats.avgVelocity.toFixed(1)} units/day</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <h3 className="text-sm font-medium text-gray-500">Avg Turnover</h3>
          <p className="text-2xl font-semibold text-gray-900">{stats.avgTurnover.toFixed(1)}x</p>
        </div>
      </div>

      {/* ABC Class Breakdown */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">ABC Classification Breakdown</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Object.entries(abcBreakdown).map(([class_, items]) => (
            <div key={class_} className="text-center">
              <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${abcColors[class_ as keyof typeof abcColors]} mb-2`}>
                {class_} Class
              </div>
              <p className="text-2xl font-semibold text-gray-900">{items.length}</p>
              <p className="text-sm text-gray-500">
                £{items.reduce((sum, item) => sum + item.netRevenue, 0).toFixed(2)} revenue
              </p>
              <p className="text-xs text-gray-400">
                {((items.length / reportData.length) * 100).toFixed(1)}% of SKUs
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Top Performers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Top Revenue Generators</h3>
          <div className="space-y-2">
            {reportData
              .sort((a, b) => b.netRevenue - a.netRevenue)
              .slice(0, 5)
              .map((item, index) => (
                <div key={item.sku} className="flex justify-between items-center text-sm">
                  <span className="text-gray-600">{index + 1}. {cleanProductName(item.product)}</span>
                  <span className="font-medium">£{item.netRevenue.toFixed(2)}</span>
                </div>
              ))}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Highest Velocity SKUs</h3>
          <div className="space-y-2">
            {reportData
              .sort((a, b) => b.unitsSoldPerDay - a.unitsSoldPerDay)
              .slice(0, 5)
              .map((item, index) => (
                <div key={item.sku} className="flex justify-between items-center text-sm">
                  <span className="text-gray-600">{index + 1}. {cleanProductName(item.product)}</span>
                  <span className="font-medium">{item.unitsSoldPerDay.toFixed(1)} units/day</span>
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* Filters */}
      <FilterComponent
        filters={filters}
        onFiltersChange={setFilters}
        showChannel={true}
        showCategory={true}
        showAbcClass={true}
      />

      {/* Export Button */}
      <div className="flex justify-end">
        <ExportButton
          onExport={handleExport}
          isLoading={isExporting}
          filename="sku-velocity-abc"
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
          <p className="text-gray-500">No velocity data available for the selected filters.</p>
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
