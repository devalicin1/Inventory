import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getCogsGrossProfitReport, exportToCSV } from '../../api/reports'
import type { CogsGrossProfitRow, ReportFilters } from '../../api/reports'
import { ReportFilters as FilterComponent } from './ReportFilters'
import { ExportButton } from './ExportButton'
import { DataTable } from '../DataTable'

interface CogsGrossProfitProps {
  workspaceId: string
}

export function CogsGrossProfit({ workspaceId }: CogsGrossProfitProps) {
  const [filters, setFilters] = useState<ReportFilters>({})
  const [isExporting, setIsExporting] = useState(false)

  const { data: reportData = [], isLoading, error } = useQuery({
    queryKey: ['cogs-gross-profit', workspaceId, filters],
    queryFn: () => getCogsGrossProfitReport(workspaceId, filters),
    enabled: !!workspaceId
  })

  // Calculate summary statistics
  const stats = {
    totalRevenue: reportData.reduce((sum, row) => sum + row.netSales, 0),
    totalCOGS: reportData.reduce((sum, row) => sum + row.cogs, 0),
    totalGrossProfit: reportData.reduce((sum, row) => sum + row.grossProfit, 0),
    avgGrossMargin: reportData.length > 0 
      ? reportData.reduce((sum, row) => sum + row.grossMargin, 0) / reportData.length 
      : 0,
    totalReturns: reportData.reduce((sum, row) => sum + row.returnsValue, 0)
  }

  const handleExport = async () => {
    setIsExporting(true)
    try {
      const columns = [
        { key: 'date' as keyof CogsGrossProfitRow, label: 'Date' },
        { key: 'channel' as keyof CogsGrossProfitRow, label: 'Channel' },
        { key: 'sku' as keyof CogsGrossProfitRow, label: 'SKU' },
        { key: 'product' as keyof CogsGrossProfitRow, label: 'Product' },
        { key: 'netSales' as keyof CogsGrossProfitRow, label: 'Net Sales £' },
        { key: 'cogs' as keyof CogsGrossProfitRow, label: 'COGS £' },
        { key: 'grossProfit' as keyof CogsGrossProfitRow, label: 'Gross Profit £' },
        { key: 'grossMargin' as keyof CogsGrossProfitRow, label: 'Gross Margin %' },
        { key: 'returnsValue' as keyof CogsGrossProfitRow, label: 'Returns £' },
        { key: 'returnsUnits' as keyof CogsGrossProfitRow, label: 'Returns Units' }
      ]
      
      exportToCSV(reportData, 'cogs-gross-profit.csv', columns)
    } finally {
      setIsExporting(false)
    }
  }

  const columns = [
    { key: 'date' as keyof CogsGrossProfitRow, label: 'Date' },
    { key: 'channel' as keyof CogsGrossProfitRow, label: 'Channel' },
    { key: 'sku' as keyof CogsGrossProfitRow, label: 'SKU' },
    { key: 'product' as keyof CogsGrossProfitRow, label: 'Product' },
    { 
      key: 'netSales' as keyof CogsGrossProfitRow, 
      label: 'Net Sales £',
      render: (value: number) => `£${value.toFixed(2)}`
    },
    { 
      key: 'cogs' as keyof CogsGrossProfitRow, 
      label: 'COGS £',
      render: (value: number) => `£${value.toFixed(2)}`
    },
    { 
      key: 'grossProfit' as keyof CogsGrossProfitRow, 
      label: 'Gross Profit £',
      render: (value: number) => (
        <span className={value >= 0 ? 'text-green-600' : 'text-red-600'}>
          £{value.toFixed(2)}
        </span>
      )
    },
    { 
      key: 'grossMargin' as keyof CogsGrossProfitRow, 
      label: 'Gross Margin %',
      render: (value: number) => (
        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
          value >= 30 ? 'bg-green-100 text-green-800' :
          value >= 20 ? 'bg-yellow-100 text-yellow-800' :
          'bg-red-100 text-red-800'
        }`}>
          {value.toFixed(1)}%
        </span>
      )
    },
    { 
      key: 'returnsValue' as keyof CogsGrossProfitRow, 
      label: 'Returns £',
      render: (value: number) => value > 0 ? `£${value.toFixed(2)}` : '-'
    },
    { 
      key: 'returnsUnits' as keyof CogsGrossProfitRow, 
      label: 'Returns Units',
      render: (value: number) => value > 0 ? value.toFixed(0) : '-'
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
          <h3 className="text-sm font-medium text-gray-500">Total Revenue</h3>
          <p className="text-2xl font-semibold text-gray-900">£{stats.totalRevenue.toFixed(2)}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <h3 className="text-sm font-medium text-gray-500">Total COGS</h3>
          <p className="text-2xl font-semibold text-gray-900">£{stats.totalCOGS.toFixed(2)}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <h3 className="text-sm font-medium text-gray-500">Gross Profit</h3>
          <p className="text-2xl font-semibold text-green-600">£{stats.totalGrossProfit.toFixed(2)}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <h3 className="text-sm font-medium text-gray-500">Avg Gross Margin</h3>
          <p className="text-2xl font-semibold text-gray-900">{stats.avgGrossMargin.toFixed(1)}%</p>
        </div>
      </div>

      {/* Profitability Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Channel Performance</h3>
          <div className="space-y-3">
            {Object.entries(
              reportData.reduce((acc, row) => {
                if (!acc[row.channel]) {
                  acc[row.channel] = { revenue: 0, cogs: 0, profit: 0, count: 0 }
                }
                acc[row.channel].revenue += row.netSales
                acc[row.channel].cogs += row.cogs
                acc[row.channel].profit += row.grossProfit
                acc[row.channel].count += 1
                return acc
              }, {} as Record<string, { revenue: number; cogs: number; profit: number; count: number }>)
            ).map(([channel, data]) => {
              const margin = data.revenue > 0 ? (data.profit / data.revenue) * 100 : 0
              return (
                <div key={channel} className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">{channel}</span>
                  <div className="text-right">
                    <div className="text-sm font-medium">£{data.profit.toFixed(2)}</div>
                    <div className="text-xs text-gray-500">{margin.toFixed(1)}% margin</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Top Performers</h3>
          <div className="space-y-2">
            {reportData
              .sort((a, b) => b.grossProfit - a.grossProfit)
              .slice(0, 5)
              .map((item, index) => (
                <div key={`${item.sku}-${item.date}`} className="flex justify-between items-center text-sm">
                  <span className="text-gray-600">{index + 1}. {item.sku}</span>
                  <div className="text-right">
                    <span className="font-medium">£{item.grossProfit.toFixed(2)}</span>
                    <span className="text-gray-500 ml-2">({item.grossMargin.toFixed(1)}%)</span>
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
        showCategory={true}
        showSupplier={true}
      />

      {/* Export Button */}
      <div className="flex justify-end">
        <ExportButton
          onExport={handleExport}
          isLoading={isExporting}
          filename="cogs-gross-profit"
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
          <p className="text-gray-500">No COGS data available for the selected filters.</p>
          <p className="text-sm text-gray-400 mt-2">Sales transaction data needs to be implemented.</p>
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
