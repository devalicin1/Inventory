import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getCycleCountReport, exportToCSV } from '../../api/reports'
import type { CycleCountRow, ReportFilters } from '../../api/reports'
import { ReportFilters as FilterComponent } from './ReportFilters'
import { ExportButton } from './ExportButton'
import { DataTable } from '../DataTable'

interface CycleCountAccuracyProps {
  workspaceId: string
}

export function CycleCountAccuracy({ workspaceId }: CycleCountAccuracyProps) {
  const [filters, setFilters] = useState<ReportFilters>({})
  const [isExporting, setIsExporting] = useState(false)

  const { data: reportData = [], isLoading, error } = useQuery({
    queryKey: ['cycle-count', workspaceId, filters],
    queryFn: () => getCycleCountReport(workspaceId, filters),
    enabled: !!workspaceId
  })

  // Calculate summary statistics
  const stats = {
    totalCounts: reportData.length,
    totalVarianceValue: reportData.reduce((sum, row) => sum + Math.abs(row.varianceValue), 0),
    avgItemAccuracy: reportData.length > 0 
      ? reportData.reduce((sum, row) => sum + row.itemAccuracy, 0) / reportData.length 
      : 0,
    perfectCounts: reportData.filter(row => row.itemAccuracy === 100).length,
    financialAccuracy: reportData.length > 0 
      ? 100 - (reportData.reduce((sum, row) => sum + Math.abs(row.varianceValue), 0) / 
               reportData.reduce((sum, row) => sum + Math.abs(row.systemQty * 10), 0)) * 100
      : 0
  }

  const handleExport = async () => {
    setIsExporting(true)
    try {
      const columns = [
        { key: 'sku' as keyof CycleCountRow, label: 'SKU' },
        { key: 'location' as keyof CycleCountRow, label: 'Location' },
        { key: 'systemQty' as keyof CycleCountRow, label: 'System Qty' },
        { key: 'countedQty' as keyof CycleCountRow, label: 'Counted Qty' },
        { key: 'varianceQty' as keyof CycleCountRow, label: 'Variance Qty' },
        { key: 'varianceValue' as keyof CycleCountRow, label: 'Variance £' },
        { key: 'itemAccuracy' as keyof CycleCountRow, label: 'Item Accuracy %' },
        { key: 'countDate' as keyof CycleCountRow, label: 'Count Date' },
        { key: 'countGroup' as keyof CycleCountRow, label: 'Count Group' },
        { key: 'user' as keyof CycleCountRow, label: 'User' }
      ]
      
      exportToCSV(reportData, 'cycle-count-accuracy.csv', columns)
    } finally {
      setIsExporting(false)
    }
  }

  const columns = [
    { 
      key: 'sku' as keyof CycleCountRow, 
      label: 'SKU',
      render: (value: string) => value || '-'
    },
    { key: 'location' as keyof CycleCountRow, label: 'Location' },
    { 
      key: 'systemQty' as keyof CycleCountRow, 
      label: 'System Qty',
      render: (value: number) => value.toFixed(2)
    },
    { 
      key: 'countedQty' as keyof CycleCountRow, 
      label: 'Counted Qty',
      render: (value: number) => value.toFixed(2)
    },
    { 
      key: 'varianceQty' as keyof CycleCountRow, 
      label: 'Variance Qty',
      render: (value: number) => (
        <span className={value === 0 ? 'text-green-600' : value > 0 ? 'text-blue-600' : 'text-red-600'}>
          {value > 0 ? '+' : ''}{value.toFixed(2)}
        </span>
      )
    },
    { 
      key: 'varianceValue' as keyof CycleCountRow, 
      label: 'Variance £',
      render: (value: number) => (
        <span className={value === 0 ? 'text-green-600' : value > 0 ? 'text-blue-600' : 'text-red-600'}>
          {value > 0 ? '+' : ''}£{value.toFixed(2)}
        </span>
      )
    },
    { 
      key: 'itemAccuracy' as keyof CycleCountRow, 
      label: 'Item Accuracy %',
      render: (value: number) => (
        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
          value === 100 ? 'bg-green-100 text-green-800' :
          value >= 95 ? 'bg-yellow-100 text-yellow-800' :
          'bg-red-100 text-red-800'
        }`}>
          {value.toFixed(1)}%
        </span>
      )
    },
    { key: 'countDate' as keyof CycleCountRow, label: 'Count Date' },
    { 
      key: 'countGroup' as keyof CycleCountRow, 
      label: 'Count Group',
      render: (value: string) => (
        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
          value === 'A' ? 'bg-green-100 text-green-800' :
          value === 'B' ? 'bg-yellow-100 text-yellow-800' :
          'bg-gray-100 text-gray-800'
        }`}>
          {value}
        </span>
      )
    },
    { key: 'user' as keyof CycleCountRow, label: 'User' }
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
          <h3 className="text-sm font-medium text-gray-500">Total Counts</h3>
          <p className="text-2xl font-semibold text-gray-900">{stats.totalCounts}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <h3 className="text-sm font-medium text-gray-500">Avg Item Accuracy</h3>
          <p className="text-2xl font-semibold text-gray-900">{stats.avgItemAccuracy.toFixed(1)}%</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <h3 className="text-sm font-medium text-gray-500">Perfect Counts</h3>
          <p className="text-2xl font-semibold text-green-600">{stats.perfectCounts}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <h3 className="text-sm font-medium text-gray-500">Financial Accuracy</h3>
          <p className="text-2xl font-semibold text-gray-900">{stats.financialAccuracy.toFixed(1)}%</p>
        </div>
      </div>

      {/* Accuracy Distribution */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Accuracy Distribution</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-2xl font-semibold text-green-600">
              {reportData.filter(row => row.itemAccuracy === 100).length}
            </div>
            <div className="text-sm text-gray-500">Perfect (100%)</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-semibold text-yellow-600">
              {reportData.filter(row => row.itemAccuracy >= 95 && row.itemAccuracy < 100).length}
            </div>
            <div className="text-sm text-gray-500">Good (95-99%)</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-semibold text-red-600">
              {reportData.filter(row => row.itemAccuracy < 95).length}
            </div>
            <div className="text-sm text-gray-500">Poor (&lt;95%)</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <FilterComponent
        filters={filters}
        onFiltersChange={setFilters}
        workspaceId={workspaceId}
        showFolder={true}
        showDateRange={true}
        showLocation={true}
        showAbcClass={true}
      />

      {/* Export Button */}
      <div className="flex justify-end">
        <ExportButton
          onExport={handleExport}
          isLoading={isExporting}
          filename="cycle-count-accuracy"
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
          <p className="text-gray-500">No cycle count data available for the selected filters.</p>
          <p className="text-sm text-gray-400 mt-2">Cycle counting functionality needs to be implemented.</p>
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
