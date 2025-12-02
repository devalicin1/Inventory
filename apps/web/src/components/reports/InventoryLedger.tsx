import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getInventoryLedgerReport, exportToCSV } from '../../api/reports'
import type { InventoryLedgerRow, ReportFilters } from '../../api/reports'
import { ReportFilters as FilterComponent } from './ReportFilters'
import { ExportButton } from './ExportButton'
import { DataTable } from '../DataTable'

interface InventoryLedgerProps {
  workspaceId: string
}

export function InventoryLedger({ workspaceId }: InventoryLedgerProps) {
  const [filters, setFilters] = useState<ReportFilters>({})
  const [isExporting, setIsExporting] = useState(false)

  const { data: reportData = [], isLoading, error } = useQuery({
    queryKey: ['inventory-ledger', workspaceId, filters],
    queryFn: () => getInventoryLedgerReport(workspaceId, filters),
    enabled: !!workspaceId
  })

  // Calculate summary statistics
  const stats = {
    totalTransactions: reportData.length,
    totalIn: reportData.reduce((sum, row) => sum + row.qtyIn, 0),
    totalOut: reportData.reduce((sum, row) => sum + row.qtyOut, 0),
    netMovement: reportData.reduce((sum, row) => sum + row.net, 0),
    currentBalance: reportData.length > 0 ? reportData[reportData.length - 1]?.runningBalance || 0 : 0
  }

  const handleExport = async () => {
    setIsExporting(true)
    try {
      const columns = [
        { key: 'dateTime' as keyof InventoryLedgerRow, label: 'Date/Time' },
        { key: 'documentNo' as keyof InventoryLedgerRow, label: 'Document No' },
        { key: 'movementType' as keyof InventoryLedgerRow, label: 'Movement Type' },
        { key: 'locationIn' as keyof InventoryLedgerRow, label: 'Location In' },
        { key: 'locationOut' as keyof InventoryLedgerRow, label: 'Location Out' },
        { key: 'qtyIn' as keyof InventoryLedgerRow, label: 'Qty In' },
        { key: 'qtyOut' as keyof InventoryLedgerRow, label: 'Qty Out' },
        { key: 'net' as keyof InventoryLedgerRow, label: 'Net' },
        { key: 'runningBalance' as keyof InventoryLedgerRow, label: 'Running Balance' },
        { key: 'user' as keyof InventoryLedgerRow, label: 'User' },
        { key: 'notes' as keyof InventoryLedgerRow, label: 'Notes' }
      ]
      
      exportToCSV(reportData, 'inventory-ledger.csv', columns)
    } finally {
      setIsExporting(false)
    }
  }

  const columns = [
    { key: 'dateTime' as keyof InventoryLedgerRow, label: 'Date/Time' },
    { key: 'documentNo' as keyof InventoryLedgerRow, label: 'Document No' },
    { 
      key: 'movementType' as keyof InventoryLedgerRow, 
      label: 'Movement Type',
      render: (value: string) => (
        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
          value === 'Receive' ? 'bg-green-100 text-green-800' :
          value === 'Ship' ? 'bg-blue-100 text-blue-800' :
          value === 'Transfer' ? 'bg-yellow-100 text-yellow-800' :
          value.includes('Adjust') ? 'bg-purple-100 text-purple-800' :
          'bg-gray-100 text-gray-800'
        }`}>
          {value}
        </span>
      )
    },
    { key: 'locationIn' as keyof InventoryLedgerRow, label: 'Location In' },
    { key: 'locationOut' as keyof InventoryLedgerRow, label: 'Location Out' },
    { 
      key: 'qtyIn' as keyof InventoryLedgerRow, 
      label: 'Qty In',
      render: (value: number) => value > 0 ? value.toFixed(2) : '-'
    },
    { 
      key: 'qtyOut' as keyof InventoryLedgerRow, 
      label: 'Qty Out',
      render: (value: number) => value > 0 ? value.toFixed(2) : '-'
    },
    { 
      key: 'net' as keyof InventoryLedgerRow, 
      label: 'Net',
      render: (value: number) => (
        <span className={value >= 0 ? 'text-green-600' : 'text-red-600'}>
          {value >= 0 ? '+' : ''}{value.toFixed(2)}
        </span>
      )
    },
    { 
      key: 'runningBalance' as keyof InventoryLedgerRow, 
      label: 'Running Balance',
      render: (value: number) => value.toFixed(2)
    },
    { key: 'user' as keyof InventoryLedgerRow, label: 'User' },
    { key: 'notes' as keyof InventoryLedgerRow, label: 'Notes' }
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
          <h3 className="text-sm font-medium text-gray-500">Total Transactions</h3>
          <p className="text-2xl font-semibold text-gray-900">{stats.totalTransactions}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <h3 className="text-sm font-medium text-gray-500">Total In</h3>
          <p className="text-2xl font-semibold text-green-600">{stats.totalIn.toFixed(2)}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <h3 className="text-sm font-medium text-gray-500">Total Out</h3>
          <p className="text-2xl font-semibold text-red-600">{stats.totalOut.toFixed(2)}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <h3 className="text-sm font-medium text-gray-500">Current Balance</h3>
          <p className="text-2xl font-semibold text-gray-900">{stats.currentBalance.toFixed(2)}</p>
        </div>
      </div>

      {/* Filters */}
      <FilterComponent
        filters={filters}
        onFiltersChange={setFilters}
        workspaceId={workspaceId}
        showFolder={true}
        showDateRange={true}
        showSku={true}
        showLocation={true}
        showMovementType={true}
        showUser={true}
      />

      {/* Export Button */}
      <div className="flex justify-end">
        <ExportButton
          onExport={handleExport}
          isLoading={isExporting}
          filename="inventory-ledger"
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
          <p className="text-gray-500">No transaction data available for the selected filters.</p>
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
