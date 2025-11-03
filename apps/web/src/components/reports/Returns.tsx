import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getReturnsReport, exportToCSV } from '../../api/reports'
import type { ReturnsRow, ReportFilters } from '../../api/reports'
import { ReportFilters as FilterComponent } from './ReportFilters'
import { ExportButton } from './ExportButton'
import { DataTable } from '../DataTable'

interface ReturnsProps {
  workspaceId: string
}

const statusColors = {
  'Open': 'bg-yellow-100 text-yellow-800',
  'Closed': 'bg-green-100 text-green-800',
  'Pending': 'bg-blue-100 text-blue-800'
}

const dispositionColors = {
  'Restock': 'bg-green-100 text-green-800',
  'Scrap': 'bg-red-100 text-red-800',
  'Repair': 'bg-yellow-100 text-yellow-800'
}

export function Returns({ workspaceId }: ReturnsProps) {
  const [filters, setFilters] = useState<ReportFilters>({})
  const [isExporting, setIsExporting] = useState(false)

  const { data: reportData = [], isLoading, error } = useQuery({
    queryKey: ['returns', workspaceId, filters],
    queryFn: () => getReturnsReport(workspaceId, filters),
    enabled: !!workspaceId
  })

  // Calculate summary statistics
  const stats = {
    totalReturns: reportData.length,
    totalValue: reportData.reduce((sum, row) => sum + row.creditNote, 0),
    openReturns: reportData.filter(row => row.status === 'Open').length,
    closedReturns: reportData.filter(row => row.status === 'Closed').length,
    avgCreditNote: reportData.length > 0 
      ? reportData.reduce((sum, row) => sum + row.creditNote, 0) / reportData.length 
      : 0
  }

  // Group by reason code
  const reasonBreakdown = reportData.reduce((acc, row) => {
    if (!acc[row.reasonCode]) {
      acc[row.reasonCode] = { count: 0, value: 0 }
    }
    acc[row.reasonCode].count += 1
    acc[row.reasonCode].value += row.creditNote
    return acc
  }, {} as Record<string, { count: number; value: number }>)

  const handleExport = async () => {
    setIsExporting(true)
    try {
      const columns = [
        { key: 'rmaNo' as keyof ReturnsRow, label: 'RMA No' },
        { key: 'date' as keyof ReturnsRow, label: 'Date' },
        { key: 'customer' as keyof ReturnsRow, label: 'Customer' },
        { key: 'orderNo' as keyof ReturnsRow, label: 'Order No' },
        { key: 'sku' as keyof ReturnsRow, label: 'SKU' },
        { key: 'qty' as keyof ReturnsRow, label: 'Qty' },
        { key: 'reasonCode' as keyof ReturnsRow, label: 'Reason Code' },
        { key: 'disposition' as keyof ReturnsRow, label: 'Disposition' },
        { key: 'creditNote' as keyof ReturnsRow, label: 'Credit Note £' },
        { key: 'linkedClaim' as keyof ReturnsRow, label: 'Linked Claim' },
        { key: 'status' as keyof ReturnsRow, label: 'Status' },
        { key: 'notes' as keyof ReturnsRow, label: 'Notes' }
      ]
      
      exportToCSV(reportData, 'returns-credit-notes.csv', columns)
    } finally {
      setIsExporting(false)
    }
  }

  const columns = [
    { key: 'rmaNo' as keyof ReturnsRow, label: 'RMA No' },
    { key: 'date' as keyof ReturnsRow, label: 'Date' },
    { key: 'customer' as keyof ReturnsRow, label: 'Customer' },
    { key: 'orderNo' as keyof ReturnsRow, label: 'Order No' },
    { key: 'sku' as keyof ReturnsRow, label: 'SKU' },
    { 
      key: 'qty' as keyof ReturnsRow, 
      label: 'Qty',
      render: (value: number) => value.toFixed(0)
    },
    { key: 'reasonCode' as keyof ReturnsRow, label: 'Reason Code' },
    { 
      key: 'disposition' as keyof ReturnsRow, 
      label: 'Disposition',
      render: (value: string) => (
        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
          dispositionColors[value as keyof typeof dispositionColors] || 'bg-gray-100 text-gray-800'
        }`}>
          {value}
        </span>
      )
    },
    { 
      key: 'creditNote' as keyof ReturnsRow, 
      label: 'Credit Note £',
      render: (value: number) => `£${value.toFixed(2)}`
    },
    { 
      key: 'linkedClaim' as keyof ReturnsRow, 
      label: 'Linked Claim',
      render: (value: string) => value || '-'
    },
    { 
      key: 'status' as keyof ReturnsRow, 
      label: 'Status',
      render: (value: string) => (
        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
          statusColors[value as keyof typeof statusColors] || 'bg-gray-100 text-gray-800'
        }`}>
          {value}
        </span>
      )
    },
    { key: 'notes' as keyof ReturnsRow, label: 'Notes' }
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
          <h3 className="text-sm font-medium text-gray-500">Total Returns</h3>
          <p className="text-2xl font-semibold text-gray-900">{stats.totalReturns}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <h3 className="text-sm font-medium text-gray-500">Total Value</h3>
          <p className="text-2xl font-semibold text-gray-900">£{stats.totalValue.toFixed(2)}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <h3 className="text-sm font-medium text-gray-500">Open Returns</h3>
          <p className="text-2xl font-semibold text-yellow-600">{stats.openReturns}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <h3 className="text-sm font-medium text-gray-500">Avg Credit Note</h3>
          <p className="text-2xl font-semibold text-gray-900">£{stats.avgCreditNote.toFixed(2)}</p>
        </div>
      </div>

      {/* Status & Disposition Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Status Breakdown</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Open</span>
              <span className="text-sm font-medium text-yellow-600">{stats.openReturns}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Closed</span>
              <span className="text-sm font-medium text-green-600">{stats.closedReturns}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Pending</span>
              <span className="text-sm font-medium text-blue-600">
                {stats.totalReturns - stats.openReturns - stats.closedReturns}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Top Return Reasons</h3>
          <div className="space-y-2">
            {Object.entries(reasonBreakdown)
              .sort(([,a], [,b]) => b.count - a.count)
              .slice(0, 5)
              .map(([reason, data]) => (
                <div key={reason} className="flex justify-between items-center text-sm">
                  <span className="text-gray-600">{reason}</span>
                  <div className="text-right">
                    <span className="font-medium">{data.count}</span>
                    <span className="text-gray-500 ml-2">(£{data.value.toFixed(2)})</span>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* Filters */}
      <FilterComponent
        filters={filters}
        onFiltersChange={setFilters}
        showDateRange={true}
        showChannel={true}
        showReasonCode={true}
        showCustomer={true}
      />

      {/* Export Button */}
      <div className="flex justify-end">
        <ExportButton
          onExport={handleExport}
          isLoading={isExporting}
          filename="returns-credit-notes"
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
          <p className="text-gray-500">No returns data available for the selected filters.</p>
          <p className="text-sm text-gray-400 mt-2">Returns tracking functionality needs to be implemented.</p>
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
