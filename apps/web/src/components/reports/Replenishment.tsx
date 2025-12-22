import { useState, useMemo, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getReplenishmentReport, exportToCSV } from '../../api/reports'
import type { ReplenishmentRow, ReportFilters } from '../../api/reports'
import { listGroups, type Group } from '../../api/products'
import { ExportButton } from './ExportButton'
import {
  MagnifyingGlassIcon,
  ExclamationTriangleIcon,
  CubeIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  FunnelIcon,
  XMarkIcon,
  ArrowPathIcon,
  ShoppingCartIcon,
  TruckIcon,
  ClockIcon,
  ShieldCheckIcon,
  CheckCircleIcon,
  BellAlertIcon,
  FolderIcon,
  BuildingStorefrontIcon
} from '@heroicons/react/24/outline'

interface ReplenishmentProps {
  workspaceId: string
}

type SortField = 'sku' | 'product' | 'suggestedQty' | 'available' | 'leadTime' | 'avgDailyDemand'
type SortDirection = 'asc' | 'desc'
type ViewTab = 'all' | 'needs-reorder' | 'critical' | 'ok'
type UrgencyLevel = 'critical' | 'urgent' | 'normal' | 'ok'

export function Replenishment({ workspaceId }: ReplenishmentProps) {
  const [activeTab, setActiveTab] = useState<ViewTab>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [sortField, setSortField] = useState<SortField>('suggestedQty')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [isExporting, setIsExporting] = useState(false)
  const [filters, setFilters] = useState<ReportFilters>({})
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [isAutoRefreshing, setIsAutoRefreshing] = useState(false)

  // Fetch groups/folders for filter
  const { data: groups = [] } = useQuery<Group[]>({
    queryKey: ['groups', workspaceId],
    queryFn: () => listGroups(workspaceId),
    enabled: !!workspaceId
  })

  const { data: reportData = [], isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ['replenishment', workspaceId, filters],
    queryFn: () => getReplenishmentReport(workspaceId, filters),
    enabled: !!workspaceId
  })

  useEffect(() => {
    if (!workspaceId) return

    const timeout = setTimeout(async () => {
      try {
        setIsAutoRefreshing(true)
        await refetch()
      } finally {
        setIsAutoRefreshing(false)
      }
    }, 2000)

    return () => clearTimeout(timeout)
  }, [workspaceId])

  useEffect(() => {
    if (reportData && reportData.length >= 0) {
      setLastUpdated(new Date())
    }
  }, [reportData])

  // Get group name by ID
  const getGroupName = (groupId: string | undefined) => {
    if (!groupId) return undefined
    const group = groups.find(g => g.id === groupId)
    return group?.name
  }

  // Calculate urgency level for each item
  const getUrgencyLevel = (row: ReplenishmentRow): UrgencyLevel => {
    if (row.suggestedQty <= 0) return 'ok'
    const daysOfStock = row.avgDailyDemand > 0 ? row.available / row.avgDailyDemand : 999
    if (daysOfStock <= 0) return 'critical' // Out of stock
    if (daysOfStock <= row.leadTime) return 'critical' // Will run out before reorder arrives
    if (daysOfStock <= row.leadTime + row.safety) return 'urgent'
    return 'normal'
  }

  // Filter and sort data
  const processedData = useMemo(() => {
    let filtered = reportData.map(row => ({
      ...row,
      urgency: getUrgencyLevel(row)
    }))

    // Apply tab filter
    switch (activeTab) {
      case 'needs-reorder':
        filtered = filtered.filter(row => row.suggestedQty > 0)
        break
      case 'critical':
        filtered = filtered.filter(row => row.urgency === 'critical' || row.urgency === 'urgent')
        break
      case 'ok':
        filtered = filtered.filter(row => row.suggestedQty <= 0)
        break
    }

    // Apply search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(row =>
        row.sku.toLowerCase().includes(term) ||
        row.product.toLowerCase().includes(term) ||
        row.supplier?.toLowerCase().includes(term)
      )
    }

    // Apply sorting
    filtered = [...filtered].sort((a, b) => {
      let aVal = a[sortField as keyof ReplenishmentRow]
      let bVal = b[sortField as keyof ReplenishmentRow]
      
      if (typeof aVal === 'string') aVal = aVal.toLowerCase()
      if (typeof bVal === 'string') bVal = bVal.toLowerCase()
      
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1
      return 0
    })

    return filtered
  }, [reportData, activeTab, searchTerm, sortField, sortDirection])

  // Calculate statistics
  const stats = useMemo(() => {
    const totalSKUs = reportData.length
    const needsReplenishment = reportData.filter(r => r.suggestedQty > 0)
    const criticalCount = reportData.filter(r => getUrgencyLevel(r) === 'critical').length
    const urgentCount = reportData.filter(r => getUrgencyLevel(r) === 'urgent').length
    const okCount = reportData.filter(r => r.suggestedQty <= 0).length
    const totalSuggestedQty = needsReplenishment.reduce((sum, r) => sum + r.suggestedQty, 0)
    const avgLeadTime = reportData.length > 0
      ? reportData.reduce((sum, r) => sum + r.leadTime, 0) / reportData.length
      : 0

    // Group by supplier
    const supplierStats = needsReplenishment.reduce((acc, row) => {
      const supplier = row.supplier || 'Unknown'
      if (!acc[supplier]) {
        acc[supplier] = { count: 0, totalQty: 0 }
      }
      acc[supplier].count++
      acc[supplier].totalQty += row.suggestedQty
      return acc
    }, {} as Record<string, { count: number; totalQty: number }>)

    return {
      totalSKUs,
      needsReplenishmentCount: needsReplenishment.length,
      criticalCount,
      urgentCount,
      okCount,
      totalSuggestedQty,
      avgLeadTime,
      supplierStats
    }
  }, [reportData])

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
  }

  const handleExport = async () => {
    setIsExporting(true)
    try {
      const columns = [
        { key: 'sku' as keyof ReplenishmentRow, label: 'SKU' },
        { key: 'product' as keyof ReplenishmentRow, label: 'Product' },
        { key: 'avgDailyDemand' as keyof ReplenishmentRow, label: 'Avg Daily Demand' },
        { key: 'leadTime' as keyof ReplenishmentRow, label: 'Lead Time (Days)' },
        { key: 'safety' as keyof ReplenishmentRow, label: 'Safety Stock' },
        { key: 'targetStock' as keyof ReplenishmentRow, label: 'Target Stock' },
        { key: 'available' as keyof ReplenishmentRow, label: 'Available' },
        { key: 'onPO' as keyof ReplenishmentRow, label: 'On PO' },
        { key: 'suggestedQty' as keyof ReplenishmentRow, label: 'Suggested Qty' },
        { key: 'moq' as keyof ReplenishmentRow, label: 'MOQ' },
        { key: 'supplier' as keyof ReplenishmentRow, label: 'Supplier' }
      ]
      exportToCSV(processedData, `replenishment-${activeTab}.csv`, columns)
    } finally {
      setIsExporting(false)
    }
  }

  const toggleRowExpand = (sku: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev)
      if (next.has(sku)) {
        next.delete(sku)
      } else {
        next.add(sku)
      }
      return next
    })
  }

  // Helper function to clean product names
  const cleanProductName = (name: string | null | undefined): string => {
    if (!name) return 'Unnamed Product'
    let cleaned = String(name)
      .replace(/\uFFFD/g, '')
      .replace(/\u0000/g, '')
      .replace(/\s+\?\s+/g, ' ')
      .replace(/\s+\?/g, '')
      .replace(/\?\s+/g, '')
      .replace(/\s+/g, ' ')
      .trim()
    return cleaned || 'Unnamed Product'
  }

  // Get urgency badge
  const getUrgencyBadge = (urgency: UrgencyLevel, suggestedQty: number) => {
    if (suggestedQty <= 0) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold text-green-800 bg-green-100 rounded-full">
          <CheckCircleIcon className="h-3 w-3" />
          OK
        </span>
      )
    }

    switch (urgency) {
      case 'critical':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-bold text-white bg-red-600 rounded-full animate-pulse">
            <ExclamationTriangleIcon className="h-3 w-3" />
            CRITICAL
          </span>
        )
      case 'urgent':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold text-orange-800 bg-orange-100 rounded-full">
            <BellAlertIcon className="h-3 w-3" />
            Urgent
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold text-yellow-800 bg-yellow-100 rounded-full">
            <ShoppingCartIcon className="h-3 w-3" />
            Reorder
          </span>
        )
    }
  }

  // Get stock level bar
  const getStockLevelBar = (row: ReplenishmentRow) => {
    const target = row.targetStock || 100
    const available = row.available || 0
    const onPO = row.onPO || 0
    const safety = row.safety || 0
    
    const availablePercent = Math.min((available / target) * 100, 100)
    const onPOPercent = Math.min((onPO / target) * 100, 100 - availablePercent)
    const safetyPercent = (safety / target) * 100

    let barColor = 'bg-green-500'
    if (available <= safety) barColor = 'bg-red-500'
    else if (available <= safety * 1.5) barColor = 'bg-orange-500'
    else if (available <= safety * 2) barColor = 'bg-yellow-500'

    return (
      <div className="relative w-full h-3 bg-gray-200 rounded-full overflow-hidden">
        {/* Safety stock marker */}
        {safetyPercent > 0 && safetyPercent < 100 && (
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-red-400 z-10"
            style={{ left: `${safetyPercent}%` }}
            title={`Safety Stock: ${safety.toFixed(0)}`}
          />
        )}
        {/* Available stock bar */}
        <div
          className={`h-full ${barColor} transition-all duration-300`}
          style={{ width: `${availablePercent}%` }}
        />
        {/* On PO bar (stacked) */}
        {onPO > 0 && (
          <div
            className="h-full bg-blue-400 transition-all duration-300 absolute top-0"
            style={{ left: `${availablePercent}%`, width: `${onPOPercent}%` }}
            title={`On PO: ${onPO.toFixed(0)}`}
          />
        )}
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
          <ExclamationTriangleIcon className="h-8 w-8 text-red-600" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Error Loading Report</h3>
        <p className="text-gray-500 mb-4">{(error as Error).message}</p>
        <button
          onClick={() => refetch()}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <ArrowPathIcon className="h-4 w-4" />
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards - Responsive Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {/* Total SKUs */}
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-xl border border-blue-200">
          <div className="flex items-center gap-2 mb-2">
            <CubeIcon className="h-5 w-5 text-blue-600" />
            <span className="text-xs font-medium text-blue-700">Total SKUs</span>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-blue-900">{stats.totalSKUs}</p>
        </div>

        {/* Needs Reorder */}
        <div className={`p-4 rounded-xl border ${stats.needsReplenishmentCount > 0 ? 'bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200' : 'bg-gray-50 border-gray-200'}`}>
          <div className="flex items-center gap-2 mb-2">
            <ShoppingCartIcon className={`h-5 w-5 ${stats.needsReplenishmentCount > 0 ? 'text-orange-600' : 'text-gray-400'}`} />
            <span className={`text-xs font-medium ${stats.needsReplenishmentCount > 0 ? 'text-orange-700' : 'text-gray-500'}`}>Need Reorder</span>
          </div>
          <p className={`text-2xl sm:text-3xl font-bold ${stats.needsReplenishmentCount > 0 ? 'text-orange-900' : 'text-gray-400'}`}>{stats.needsReplenishmentCount}</p>
        </div>

        {/* Critical */}
        <div className={`p-4 rounded-xl border ${stats.criticalCount > 0 ? 'bg-gradient-to-br from-red-50 to-red-100 border-red-200' : 'bg-gray-50 border-gray-200'}`}>
          <div className="flex items-center gap-2 mb-2">
            <ExclamationTriangleIcon className={`h-5 w-5 ${stats.criticalCount > 0 ? 'text-red-600 animate-pulse' : 'text-gray-400'}`} />
            <span className={`text-xs font-medium ${stats.criticalCount > 0 ? 'text-red-700' : 'text-gray-500'}`}>Critical</span>
          </div>
          <p className={`text-2xl sm:text-3xl font-bold ${stats.criticalCount > 0 ? 'text-red-900' : 'text-gray-400'}`}>{stats.criticalCount}</p>
        </div>

        {/* Total Qty to Order */}
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-xl border border-purple-200">
          <div className="flex items-center gap-2 mb-2">
            <TruckIcon className="h-5 w-5 text-purple-600" />
            <span className="text-xs font-medium text-purple-700">Total to Order</span>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-purple-900">{stats.totalSuggestedQty.toLocaleString('en-GB', { maximumFractionDigits: 0 })}</p>
        </div>

        {/* Avg Lead Time */}
        <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 p-4 rounded-xl border border-indigo-200">
          <div className="flex items-center gap-2 mb-2">
            <ClockIcon className="h-5 w-5 text-indigo-600" />
            <span className="text-xs font-medium text-indigo-700">Avg Lead Time</span>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-indigo-900">{stats.avgLeadTime.toFixed(0)}<span className="text-sm font-normal ml-1">days</span></p>
        </div>

        {/* OK Items */}
        <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-xl border border-green-200">
          <div className="flex items-center gap-2 mb-2">
            <ShieldCheckIcon className="h-5 w-5 text-green-600" />
            <span className="text-xs font-medium text-green-700">Stock OK</span>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-green-900">{stats.okCount}</p>
        </div>
      </div>

      {/* Priority Alert Banner */}
      {stats.criticalCount > 0 && (
        <div className="bg-red-50 border-2 border-red-300 rounded-xl p-4 sm:p-6">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
              <ExclamationTriangleIcon className="h-6 w-6 text-red-600 animate-pulse" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-red-800 mb-2">Critical Stock Alert</h3>
              <p className="text-sm text-red-700 mb-3">
                {stats.criticalCount} item{stats.criticalCount > 1 ? 's' : ''} will run out before reorder arrives. Immediate action required!
              </p>
              <div className="flex flex-wrap gap-2">
                {processedData
                  .filter(r => r.urgency === 'critical')
                  .slice(0, 5)
                  .map(item => (
                    <span key={item.sku} className="inline-flex items-center gap-1 px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm font-medium">
                      {item.sku}
                      <span className="text-red-600">({item.suggestedQty.toFixed(0)} units)</span>
                    </span>
                  ))}
                {stats.criticalCount > 5 && (
                  <span className="text-sm text-red-600 font-medium">+{stats.criticalCount - 5} more</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Supplier Summary */}
      {Object.keys(stats.supplierStats).length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <BuildingStorefrontIcon className="h-5 w-5 text-gray-600" />
            Orders by Supplier
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Object.entries(stats.supplierStats)
              .sort((a, b) => b[1].totalQty - a[1].totalQty)
              .slice(0, 8)
              .map(([supplier, data]) => (
                <div key={supplier} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-gray-900 truncate">{supplier}</p>
                    <p className="text-xs text-gray-500">{data.count} items</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-gray-900">{data.totalQty.toLocaleString('en-GB', { maximumFractionDigits: 0 })}</p>
                    <p className="text-xs text-gray-500">units</p>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Search and Filters Bar */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by SKU, product, or supplier..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            )}
          </div>

          {/* Filter Toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
              showFilters ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            <FunnelIcon className="h-4 w-4" />
            Filters
          </button>

          {/* Refresh */}
          <button
            onClick={() => refetch()}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed"
            disabled={isLoading || isRefetching}
          >
            <ArrowPathIcon className={`h-4 w-4 ${isLoading || isRefetching ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">
              {isLoading || isRefetching ? 'Refreshing…' : 'Refresh'}
            </span>
          </button>

          {/* Export */}
          <ExportButton
            onExport={handleExport}
            isLoading={isExporting}
            filename="replenishment"
          />
        </div>

        {/* Data freshness indicator */}
        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-gray-500">
          {isAutoRefreshing && (
            <div className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
              <ArrowPathIcon className="h-3 w-3 animate-spin" />
              <span>Loading latest data…</span>
            </div>
          )}
          {lastUpdated && !isLoading && !isRefetching && (
            <span>
              Last updated:{' '}
              {lastUpdated.toLocaleTimeString(undefined, {
                hour: '2-digit',
                minute: '2-digit'
              })}
            </span>
          )}
        </div>

        {/* Expanded Filters */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-gray-200 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Folder Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <FolderIcon className="inline h-4 w-4 mr-1" />
                Folder
              </label>
              <select
                value={filters.groupId || ''}
                onChange={(e) => setFilters(prev => ({ ...prev, groupId: e.target.value || undefined }))}
                className="w-full rounded-lg border-gray-300 text-sm"
              >
                <option value="">All Folders</option>
                {groups.map(group => (
                  <option key={group.id} value={group.id}>{group.name}</option>
                ))}
              </select>
            </div>
            
            {/* Supplier Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Supplier</label>
              <select
                value={filters.supplier || ''}
                onChange={(e) => setFilters(prev => ({ ...prev, supplier: e.target.value || undefined }))}
                className="w-full rounded-lg border-gray-300 text-sm"
              >
                <option value="">All Suppliers</option>
                {[...new Set(reportData.map(r => r.supplier).filter(Boolean))].map(sup => (
                  <option key={sup} value={sup}>{sup}</option>
                ))}
              </select>
            </div>

            {/* Needs Reorder Only */}
            <div className="flex items-end">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={activeTab === 'needs-reorder'}
                  onChange={(e) => setActiveTab(e.target.checked ? 'needs-reorder' : 'all')}
                  className="w-4 h-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                />
                <span className="text-sm font-medium text-gray-700">Needs Reorder Only</span>
              </label>
            </div>

            <div className="flex items-end">
              <button
                onClick={() => {
                  setFilters({})
                  setActiveTab('all')
                }}
                className="w-full px-4 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Clear Filters
              </button>
            </div>
          </div>
        )}

        {/* Active Folder Filter Badge */}
        {filters.groupId && (
          <div className="mt-3 flex items-center gap-2">
            <span className="text-sm text-gray-500">Filtered by:</span>
            <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
              <FolderIcon className="h-4 w-4" />
              {getGroupName(filters.groupId) || 'Unknown Folder'}
              <button
                onClick={() => setFilters(prev => ({ ...prev, groupId: undefined }))}
                className="ml-1 hover:text-blue-600"
              >
                <XMarkIcon className="h-4 w-4" />
              </button>
            </span>
          </div>
        )}
      </div>

      {/* Tab Navigation */}
      <div className="flex flex-wrap gap-2">
        {[
          { 
            id: 'all' as ViewTab, 
            label: 'All Items', 
            count: reportData.length, 
            color: 'blue',
            tooltip: 'Shows all products in inventory regardless of stock status'
          },
          { 
            id: 'needs-reorder' as ViewTab, 
            label: 'Needs Reorder', 
            count: stats.needsReplenishmentCount, 
            color: 'orange',
            tooltip: 'Products where current stock + on-order is below target level. Suggested order quantity > 0'
          },
          { 
            id: 'critical' as ViewTab, 
            label: 'Critical/Urgent', 
            count: stats.criticalCount + stats.urgentCount, 
            color: 'red',
            tooltip: 'CRITICAL: Stock will run out before new order arrives (days of stock <= lead time)\nURGENT: Stock will drop below safety level before order arrives'
          },
          { 
            id: 'ok' as ViewTab, 
            label: 'Stock OK', 
            count: stats.okCount, 
            color: 'green',
            tooltip: 'Products with sufficient stock. Current level is at or above target, no reorder needed'
          },
        ].map(tab => (
          <div key={tab.id} className="relative group">
            <button
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? `bg-${tab.color}-100 text-${tab.color}-800 ring-2 ring-${tab.color}-500 ring-offset-1`
                  : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
              }`}
            >
              {tab.label}
              <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                activeTab === tab.id ? `bg-${tab.color}-200` : 'bg-gray-100'
              }`}>
                {tab.count}
              </span>
            </button>
            {/* Tooltip */}
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50 w-64 text-center whitespace-pre-line shadow-lg">
              {tab.tooltip}
              <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
            </div>
          </div>
        ))}
      </div>

      {/* Data Display */}
      {isLoading ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12">
          <div className="flex flex-col items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent mb-4"></div>
            <p className="text-gray-500 font-medium">Loading replenishment data...</p>
          </div>
        </div>
      ) : processedData.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12">
          <div className="flex flex-col items-center justify-center">
            <ShieldCheckIcon className="h-16 w-16 text-green-300 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">All Stocked Up!</h3>
            <p className="text-gray-500">No items need replenishment at this time</p>
          </div>
        </div>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="hidden md:block bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left">
                      <button
                        onClick={() => handleSort('sku')}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-gray-600 uppercase tracking-wider hover:text-gray-900"
                      >
                        SKU
                        {sortField === 'sku' && (sortDirection === 'asc' ? <ChevronUpIcon className="h-3 w-3" /> : <ChevronDownIcon className="h-3 w-3" />)}
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left">
                      <button
                        onClick={() => handleSort('product')}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-gray-600 uppercase tracking-wider hover:text-gray-900"
                      >
                        Product
                        {sortField === 'product' && (sortDirection === 'asc' ? <ChevronUpIcon className="h-3 w-3" /> : <ChevronDownIcon className="h-3 w-3" />)}
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Stock Level</th>
                    <th className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleSort('available')}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-gray-600 uppercase tracking-wider hover:text-gray-900"
                      >
                        Available
                        {sortField === 'available' && (sortDirection === 'asc' ? <ChevronUpIcon className="h-3 w-3" /> : <ChevronDownIcon className="h-3 w-3" />)}
                      </button>
                    </th>
                    <th className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleSort('suggestedQty')}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-gray-600 uppercase tracking-wider hover:text-gray-900"
                      >
                        Order Qty
                        {sortField === 'suggestedQty' && (sortDirection === 'asc' ? <ChevronUpIcon className="h-3 w-3" /> : <ChevronDownIcon className="h-3 w-3" />)}
                      </button>
                    </th>
                    <th className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleSort('leadTime')}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-gray-600 uppercase tracking-wider hover:text-gray-900"
                      >
                        Lead Time
                        {sortField === 'leadTime' && (sortDirection === 'asc' ? <ChevronUpIcon className="h-3 w-3" /> : <ChevronDownIcon className="h-3 w-3" />)}
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Supplier</th>
                    <th className="px-4 py-3 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {processedData.map((row) => (
                    <>
                      <tr
                        key={row.sku}
                        className={`hover:bg-gray-50 cursor-pointer transition-colors ${
                          row.urgency === 'critical' ? 'bg-red-50/50' :
                          row.urgency === 'urgent' ? 'bg-orange-50/30' : ''
                        }`}
                        onClick={() => toggleRowExpand(row.sku)}
                      >
                        <td className="px-4 py-3">
                          <span className="font-mono text-sm text-gray-900">{row.sku}</span>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm font-medium text-gray-900 truncate max-w-xs">{cleanProductName(row.product)}</p>
                        </td>
                        <td className="px-4 py-3">{getUrgencyBadge(row.urgency, row.suggestedQty)}</td>
                        <td className="px-4 py-3 min-w-[180px]">
                          <div className="space-y-1">
                            {getStockLevelBar(row)}
                            <div className="flex justify-between text-xs text-gray-500">
                              <span>0</span>
                              <span className="font-medium text-gray-700">{row.available.toFixed(0)} avail{row.onPO > 0 && <span className="text-blue-600"> +{row.onPO.toFixed(0)} PO</span>}</span>
                              <span>{row.targetStock.toFixed(0)}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={`text-sm font-medium ${row.available <= row.safety ? 'text-red-600' : 'text-gray-900'}`}>
                            {row.available.toFixed(0)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {row.suggestedQty > 0 ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-800 rounded-lg text-sm font-bold">
                              <ShoppingCartIcon className="h-4 w-4" />
                              {row.suggestedQty.toFixed(0)}
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-sm text-gray-600">{row.leadTime}d</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-gray-600 truncate max-w-[120px] block">{row.supplier || '-'}</span>
                        </td>
                        <td className="px-4 py-3">
                          <ChevronDownIcon className={`h-4 w-4 text-gray-400 transition-transform ${expandedRows.has(row.sku) ? 'rotate-180' : ''}`} />
                        </td>
                      </tr>
                      {/* Expanded Details Row */}
                      {expandedRows.has(row.sku) && (
                        <tr className="bg-gray-50">
                          <td colSpan={9} className="px-4 py-4">
                            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">
                              <div>
                                <p className="text-xs text-gray-500 mb-1">Avg Daily Demand</p>
                                <p className="text-sm font-medium">{row.avgDailyDemand.toFixed(2)}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500 mb-1">Safety Stock</p>
                                <p className="text-sm font-medium">{row.safety.toFixed(0)}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500 mb-1">Target Stock</p>
                                <p className="text-sm font-medium">{row.targetStock.toFixed(0)}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500 mb-1">On PO</p>
                                <p className="text-sm font-medium">{row.onPO.toFixed(0)}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500 mb-1">MOQ</p>
                                <p className="text-sm font-medium">{row.moq || '-'}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500 mb-1">Case Pack</p>
                                <p className="text-sm font-medium">{row.casePack || '-'}</p>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden space-y-3">
            {processedData.map((row) => (
              <div
                key={row.sku}
                className={`bg-white rounded-xl border overflow-hidden ${
                  row.urgency === 'critical' ? 'border-red-300 ring-2 ring-red-100' :
                  row.urgency === 'urgent' ? 'border-orange-200' :
                  row.suggestedQty > 0 ? 'border-yellow-200' :
                  'border-gray-200'
                }`}
              >
                {/* Critical Banner */}
                {row.urgency === 'critical' && (
                  <div className="bg-red-500 text-white px-4 py-2 text-sm font-bold flex items-center gap-2">
                    <ExclamationTriangleIcon className="h-4 w-4" />
                    CRITICAL - Order immediately!
                  </div>
                )}

                <div className="p-4">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-mono text-xs text-gray-500 mb-1">{row.sku}</p>
                      <h3 className="text-base font-semibold text-gray-900 leading-tight">{cleanProductName(row.product)}</h3>
                      {row.supplier && <p className="text-xs text-gray-500 mt-1">{row.supplier}</p>}
                    </div>
                    {getUrgencyBadge(row.urgency, row.suggestedQty)}
                  </div>

                  {/* Stock Level Bar */}
                  <div className="mb-4">
                    {getStockLevelBar(row)}
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>Safety: {row.safety.toFixed(0)}</span>
                      <span className="font-bold text-gray-800">{row.available.toFixed(0)} available</span>
                      <span>Target: {row.targetStock.toFixed(0)}</span>
                    </div>
                  </div>

                  {/* Key Metrics Grid */}
                  <div className="grid grid-cols-3 gap-3 p-3 bg-gray-50 rounded-lg">
                    <div className="text-center">
                      <p className="text-xs text-gray-500">Order Qty</p>
                      <p className={`text-lg font-bold ${row.suggestedQty > 0 ? 'text-orange-600' : 'text-gray-400'}`}>
                        {row.suggestedQty > 0 ? row.suggestedQty.toFixed(0) : '-'}
                      </p>
                    </div>
                    <div className="text-center border-x border-gray-200">
                      <p className="text-xs text-gray-500">Lead Time</p>
                      <p className="text-lg font-bold text-gray-900">{row.leadTime}d</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-gray-500">On PO</p>
                      <p className={`text-lg font-bold ${row.onPO > 0 ? 'text-blue-600' : 'text-gray-400'}`}>
                        {row.onPO > 0 ? row.onPO.toFixed(0) : '-'}
                      </p>
                    </div>
                  </div>

                  {/* Expandable Details */}
                  <button
                    onClick={() => toggleRowExpand(row.sku)}
                    className="w-full mt-3 flex items-center justify-center gap-2 text-sm text-gray-600 hover:text-gray-900"
                  >
                    {expandedRows.has(row.sku) ? 'Hide Details' : 'Show Details'}
                    <ChevronDownIcon className={`h-4 w-4 transition-transform ${expandedRows.has(row.sku) ? 'rotate-180' : ''}`} />
                  </button>

                  {expandedRows.has(row.sku) && (
                    <div className="mt-3 pt-3 border-t border-gray-200 grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-xs text-gray-500">Avg Daily Demand</p>
                        <p className="font-medium">{row.avgDailyDemand.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Review Period</p>
                        <p className="font-medium">{row.reviewPeriod} days</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">MOQ</p>
                        <p className="font-medium">{row.moq || '-'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Case Pack</p>
                        <p className="font-medium">{row.casePack || '-'}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Results Summary */}
          <div className="text-center text-sm text-gray-500">
            Showing {processedData.length} of {reportData.length} items
            {stats.needsReplenishmentCount > 0 && (
              <span className="ml-2 text-orange-600">
                • {stats.needsReplenishmentCount} items need reorder ({stats.totalSuggestedQty.toLocaleString('en-GB', { maximumFractionDigits: 0 })} total units)
              </span>
            )}
          </div>
        </>
      )}
    </div>
  )
}
