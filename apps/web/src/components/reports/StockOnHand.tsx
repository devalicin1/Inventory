import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getStockOnHandReport, exportToCSV } from '../../api/reports'
import type { StockOnHandRow, ReportFilters } from '../../api/reports'
import { listGroups, type Group } from '../../api/products'
import { ExportButton } from './ExportButton'
import {
  MagnifyingGlassIcon,
  ExclamationTriangleIcon,
  ArrowTrendingUpIcon,
  CubeIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  FunnelIcon,
  XMarkIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  ClockIcon,
  FolderIcon
} from '@heroicons/react/24/outline'

interface StockOnHandProps {
  workspaceId: string
}

type SortField = 'sku' | 'productName' | 'soh' | 'available' | 'daysOfCover' | 'reorderPoint'
type SortDirection = 'asc' | 'desc'
type ViewTab = 'all' | 'low-stock' | 'over-stock' | 'healthy'

export function StockOnHand({ workspaceId }: StockOnHandProps) {
  const [activeTab, setActiveTab] = useState<ViewTab>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [sortField, setSortField] = useState<SortField>('soh')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [isExporting, setIsExporting] = useState(false)
  const [filters, setFilters] = useState<ReportFilters>({})
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())

  // Fetch groups/folders for filter
  const { data: groups = [] } = useQuery<Group[]>({
    queryKey: ['groups', workspaceId],
    queryFn: () => listGroups(workspaceId),
    enabled: !!workspaceId
  })

  const { data: reportData = [], isLoading, error, refetch } = useQuery({
    queryKey: ['stock-on-hand', workspaceId, filters],
    queryFn: () => getStockOnHandReport(workspaceId, filters),
    enabled: !!workspaceId
  })

  // Get group name by ID
  const getGroupName = (groupId: string | undefined) => {
    if (!groupId) return undefined
    const group = groups.find(g => g.id === groupId)
    return group?.name
  }

  // Filter and sort data
  const processedData = useMemo(() => {
    let filtered = reportData

    // Apply tab filter
    switch (activeTab) {
      case 'low-stock':
        filtered = filtered.filter(row => row.lowStock)
        break
      case 'over-stock':
        filtered = filtered.filter(row => row.overStock)
        break
      case 'healthy':
        filtered = filtered.filter(row => !row.lowStock && !row.overStock)
        break
    }

    // Apply search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(row =>
        row.sku.toLowerCase().includes(term) ||
        row.productName.toLowerCase().includes(term) ||
        row.category?.toLowerCase().includes(term)
      )
    }

    // Apply sorting
    filtered = [...filtered].sort((a, b) => {
      let aVal = a[sortField]
      let bVal = b[sortField]
      
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
    const lowStockCount = reportData.filter(r => r.lowStock).length
    const overStockCount = reportData.filter(r => r.overStock).length
    const healthyCount = reportData.filter(r => !r.lowStock && !r.overStock).length
    const totalValue = reportData.reduce((sum, row) => sum + (row.soh * 10), 0) // Mock unit cost
    const avgDaysOfCover = reportData.length > 0
      ? reportData.reduce((sum, row) => sum + Math.min(row.daysOfCover, 999), 0) / reportData.length
      : 0
    const criticalItems = reportData.filter(r => r.soh === 0 && r.min > 0).length

    return {
      totalSKUs,
      lowStockCount,
      overStockCount,
      healthyCount,
      totalValue,
      avgDaysOfCover,
      criticalItems
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
        { key: 'sku' as keyof StockOnHandRow, label: 'SKU' },
        { key: 'productName' as keyof StockOnHandRow, label: 'Product Name' },
        { key: 'location' as keyof StockOnHandRow, label: 'Location' },
        { key: 'soh' as keyof StockOnHandRow, label: 'Stock On Hand' },
        { key: 'allocated' as keyof StockOnHandRow, label: 'Allocated' },
        { key: 'available' as keyof StockOnHandRow, label: 'Available' },
        { key: 'onPO' as keyof StockOnHandRow, label: 'On PO' },
        { key: 'min' as keyof StockOnHandRow, label: 'Min Stock' },
        { key: 'max' as keyof StockOnHandRow, label: 'Max Stock' },
        { key: 'safety' as keyof StockOnHandRow, label: 'Safety Stock' },
        { key: 'reorderPoint' as keyof StockOnHandRow, label: 'Reorder Point' },
        { key: 'daysOfCover' as keyof StockOnHandRow, label: 'Days of Cover' }
      ]
      exportToCSV(processedData, `stock-on-hand-${activeTab}.csv`, columns)
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

  // Get status badge
  const getStatusBadge = (row: StockOnHandRow) => {
    if (row.soh === 0 && row.min > 0) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-bold text-white bg-red-600 rounded-full animate-pulse">
          <ExclamationTriangleIcon className="h-3 w-3" />
          OUT OF STOCK
        </span>
      )
    }
    if (row.lowStock) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold text-orange-800 bg-orange-100 rounded-full">
          <ExclamationTriangleIcon className="h-3 w-3" />
          Low Stock
        </span>
      )
    }
    if (row.overStock) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold text-amber-800 bg-amber-100 rounded-full">
          <ArrowTrendingUpIcon className="h-3 w-3" />
          Over Stock
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold text-green-800 bg-green-100 rounded-full">
        <CheckCircleIcon className="h-3 w-3" />
        Healthy
      </span>
    )
  }

  // Get stock level visual bar
  const getStockLevelBar = (row: StockOnHandRow) => {
    const max = row.max || row.min * 3 || 100
    const percentage = Math.min((row.soh / max) * 100, 100)
    const reorderPercentage = max > 0 ? (row.reorderPoint / max) * 100 : 0

    let barColor = 'bg-green-500'
    if (row.lowStock) barColor = 'bg-orange-500'
    if (row.soh === 0) barColor = 'bg-red-500'
    if (row.overStock) barColor = 'bg-amber-500'

    return (
      <div className="relative w-full h-3 bg-gray-200 rounded-full overflow-hidden">
        {/* Reorder point marker */}
        {reorderPercentage > 0 && reorderPercentage < 100 && (
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-red-400 z-10"
            style={{ left: `${reorderPercentage}%` }}
            title={`Reorder Point: ${row.reorderPoint.toFixed(0)}`}
          />
        )}
        {/* Stock level bar */}
        <div
          className={`h-full ${barColor} transition-all duration-300`}
          style={{ width: `${percentage}%` }}
        />
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

        {/* Critical (Out of Stock) */}
        <div className={`p-4 rounded-xl border ${stats.criticalItems > 0 ? 'bg-gradient-to-br from-red-50 to-red-100 border-red-200' : 'bg-gray-50 border-gray-200'}`}>
          <div className="flex items-center gap-2 mb-2">
            <ExclamationTriangleIcon className={`h-5 w-5 ${stats.criticalItems > 0 ? 'text-red-600' : 'text-gray-400'}`} />
            <span className={`text-xs font-medium ${stats.criticalItems > 0 ? 'text-red-700' : 'text-gray-500'}`}>Out of Stock</span>
          </div>
          <p className={`text-2xl sm:text-3xl font-bold ${stats.criticalItems > 0 ? 'text-red-900' : 'text-gray-400'}`}>{stats.criticalItems}</p>
        </div>

        {/* Low Stock */}
        <div className={`p-4 rounded-xl border ${stats.lowStockCount > 0 ? 'bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200' : 'bg-gray-50 border-gray-200'}`}>
          <div className="flex items-center gap-2 mb-2">
            <ExclamationTriangleIcon className={`h-5 w-5 ${stats.lowStockCount > 0 ? 'text-orange-600' : 'text-gray-400'}`} />
            <span className={`text-xs font-medium ${stats.lowStockCount > 0 ? 'text-orange-700' : 'text-gray-500'}`}>Low Stock</span>
          </div>
          <p className={`text-2xl sm:text-3xl font-bold ${stats.lowStockCount > 0 ? 'text-orange-900' : 'text-gray-400'}`}>{stats.lowStockCount}</p>
        </div>

        {/* Over Stock */}
        <div className={`p-4 rounded-xl border ${stats.overStockCount > 0 ? 'bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200' : 'bg-gray-50 border-gray-200'}`}>
          <div className="flex items-center gap-2 mb-2">
            <ArrowTrendingUpIcon className={`h-5 w-5 ${stats.overStockCount > 0 ? 'text-amber-600' : 'text-gray-400'}`} />
            <span className={`text-xs font-medium ${stats.overStockCount > 0 ? 'text-amber-700' : 'text-gray-500'}`}>Over Stock</span>
          </div>
          <p className={`text-2xl sm:text-3xl font-bold ${stats.overStockCount > 0 ? 'text-amber-900' : 'text-gray-400'}`}>{stats.overStockCount}</p>
        </div>

        {/* Healthy */}
        <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-xl border border-green-200">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircleIcon className="h-5 w-5 text-green-600" />
            <span className="text-xs font-medium text-green-700">Healthy</span>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-green-900">{stats.healthyCount}</p>
        </div>

        {/* Avg Days of Cover */}
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-xl border border-purple-200">
          <div className="flex items-center gap-2 mb-2">
            <ClockIcon className="h-5 w-5 text-purple-600" />
            <span className="text-xs font-medium text-purple-700">Avg Cover</span>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-purple-900">{stats.avgDaysOfCover.toFixed(0)}<span className="text-sm font-normal ml-1">days</span></p>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by SKU, product name, or category..."
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
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 text-sm font-medium"
          >
            <ArrowPathIcon className="h-4 w-4" />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          {/* Export */}
          <ExportButton
            onExport={handleExport}
            isLoading={isExporting}
            filename="stock-on-hand"
          />
        </div>

        {/* Expanded Filters */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-gray-200 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Folder/Group Filter - Primary */}
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
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select
                value={filters.category || ''}
                onChange={(e) => setFilters(prev => ({ ...prev, category: e.target.value || undefined }))}
                className="w-full rounded-lg border-gray-300 text-sm"
              >
                <option value="">All Categories</option>
                {[...new Set(reportData.map(r => r.category).filter(Boolean))].map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
              <select
                value={filters.location || ''}
                onChange={(e) => setFilters(prev => ({ ...prev, location: e.target.value || undefined }))}
                className="w-full rounded-lg border-gray-300 text-sm"
              >
                <option value="">All Locations</option>
                {[...new Set(reportData.map(r => r.location))].map(loc => (
                  <option key={loc} value={loc}>{loc}</option>
                ))}
              </select>
            </div>
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
            <div className="flex items-end">
              <button
                onClick={() => setFilters({})}
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
            id: 'low-stock' as ViewTab, 
            label: 'Low Stock', 
            count: stats.lowStockCount, 
            color: 'orange',
            tooltip: 'Stock level is at or below reorder point. These items need to be reordered soon to avoid stockouts.'
          },
          { 
            id: 'over-stock' as ViewTab, 
            label: 'Over Stock', 
            count: stats.overStockCount, 
            color: 'amber',
            tooltip: 'Stock level exceeds maximum stock level. Capital is tied up unnecessarily. Consider reducing future orders.'
          },
          { 
            id: 'healthy' as ViewTab, 
            label: 'Healthy', 
            count: stats.healthyCount, 
            color: 'green',
            tooltip: 'Stock level is between reorder point and maximum. Optimal inventory position - no action needed.'
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
            <p className="text-gray-500 font-medium">Loading stock data...</p>
          </div>
        </div>
      ) : processedData.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12">
          <div className="flex flex-col items-center justify-center">
            <CubeIcon className="h-16 w-16 text-gray-300 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Items Found</h3>
            <p className="text-gray-500">Try adjusting your search or filters</p>
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
                        onClick={() => handleSort('productName')}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-gray-600 uppercase tracking-wider hover:text-gray-900"
                      >
                        Product
                        {sortField === 'productName' && (sortDirection === 'asc' ? <ChevronUpIcon className="h-3 w-3" /> : <ChevronDownIcon className="h-3 w-3" />)}
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 text-left">
                      <button
                        onClick={() => handleSort('soh')}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-gray-600 uppercase tracking-wider hover:text-gray-900"
                      >
                        Stock Level
                        {sortField === 'soh' && (sortDirection === 'asc' ? <ChevronUpIcon className="h-3 w-3" /> : <ChevronDownIcon className="h-3 w-3" />)}
                      </button>
                    </th>
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
                        onClick={() => handleSort('reorderPoint')}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-gray-600 uppercase tracking-wider hover:text-gray-900"
                      >
                        Reorder Pt
                        {sortField === 'reorderPoint' && (sortDirection === 'asc' ? <ChevronUpIcon className="h-3 w-3" /> : <ChevronDownIcon className="h-3 w-3" />)}
                      </button>
                    </th>
                    <th className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleSort('daysOfCover')}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-gray-600 uppercase tracking-wider hover:text-gray-900"
                      >
                        Days Cover
                        {sortField === 'daysOfCover' && (sortDirection === 'asc' ? <ChevronUpIcon className="h-3 w-3" /> : <ChevronDownIcon className="h-3 w-3" />)}
                      </button>
                    </th>
                    <th className="px-4 py-3 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {processedData.map((row) => (
                    <>
                      <tr
                        key={row.sku}
                        className={`hover:bg-gray-50 cursor-pointer transition-colors ${row.lowStock ? 'bg-orange-50/50' : row.overStock ? 'bg-amber-50/50' : ''}`}
                        onClick={() => toggleRowExpand(row.sku)}
                      >
                        <td className="px-4 py-3">
                          <span className="font-mono text-sm text-gray-900">{row.sku}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="max-w-xs">
                            <p className="text-sm font-medium text-gray-900 truncate">{cleanProductName(row.productName)}</p>
                            {row.category && <p className="text-xs text-gray-500">{row.category}</p>}
                          </div>
                        </td>
                        <td className="px-4 py-3">{getStatusBadge(row)}</td>
                        <td className="px-4 py-3 min-w-[200px]">
                          <div className="space-y-1">
                            {getStockLevelBar(row)}
                            <div className="flex justify-between text-xs text-gray-500">
                              <span>0</span>
                              <span className="font-medium text-gray-700">{row.soh.toFixed(0)} on hand</span>
                              <span>{(row.max || row.min * 3 || 100).toFixed(0)}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={`text-sm font-semibold ${row.available <= 0 ? 'text-red-600' : 'text-gray-900'}`}>
                            {row.available.toFixed(0)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-sm text-gray-600">{row.reorderPoint.toFixed(0)}</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={`text-sm font-medium ${
                            row.daysOfCover < 7 ? 'text-red-600' :
                            row.daysOfCover < 14 ? 'text-orange-600' :
                            row.daysOfCover > 90 ? 'text-amber-600' :
                            'text-green-600'
                          }`}>
                            {row.daysOfCover > 999 ? '999+' : row.daysOfCover.toFixed(0)}d
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <ChevronDownIcon className={`h-4 w-4 text-gray-400 transition-transform ${expandedRows.has(row.sku) ? 'rotate-180' : ''}`} />
                        </td>
                      </tr>
                      {/* Expanded Details Row */}
                      {expandedRows.has(row.sku) && (
                        <tr className="bg-gray-50">
                          <td colSpan={8} className="px-4 py-4">
                            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">
                              <div>
                                <p className="text-xs text-gray-500 mb-1">Location</p>
                                <p className="text-sm font-medium">{row.location}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500 mb-1">Allocated</p>
                                <p className="text-sm font-medium">{row.allocated.toFixed(0)}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500 mb-1">On PO</p>
                                <p className="text-sm font-medium">{row.onPO.toFixed(0)}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500 mb-1">Min Stock</p>
                                <p className="text-sm font-medium">{row.min.toFixed(0)}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500 mb-1">Max Stock</p>
                                <p className="text-sm font-medium">{row.max.toFixed(0)}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500 mb-1">Safety Stock</p>
                                <p className="text-sm font-medium">{row.safety.toFixed(0)}</p>
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
                  row.soh === 0 && row.min > 0 ? 'border-red-300 ring-2 ring-red-100' :
                  row.lowStock ? 'border-orange-200' :
                  row.overStock ? 'border-amber-200' :
                  'border-gray-200'
                }`}
              >
                {/* Status Banner for critical items */}
                {row.soh === 0 && row.min > 0 && (
                  <div className="bg-red-500 text-white px-4 py-2 text-sm font-bold flex items-center gap-2">
                    <ExclamationTriangleIcon className="h-4 w-4" />
                    OUT OF STOCK - Reorder Now!
                  </div>
                )}

                <div className="p-4">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-mono text-xs text-gray-500 mb-1">{row.sku}</p>
                      <h3 className="text-base font-semibold text-gray-900 leading-tight">{cleanProductName(row.productName)}</h3>
                      {row.category && <p className="text-xs text-gray-500 mt-1">{row.category}</p>}
                    </div>
                    {getStatusBadge(row)}
                  </div>

                  {/* Stock Level Bar */}
                  <div className="mb-4">
                    {getStockLevelBar(row)}
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>Min: {row.min.toFixed(0)}</span>
                      <span className="font-bold text-gray-800">{row.soh.toFixed(0)} on hand</span>
                      <span>Max: {(row.max || '-')}</span>
                    </div>
                  </div>

                  {/* Key Metrics Grid */}
                  <div className="grid grid-cols-3 gap-3 p-3 bg-gray-50 rounded-lg">
                    <div className="text-center">
                      <p className="text-xs text-gray-500">Available</p>
                      <p className={`text-lg font-bold ${row.available <= 0 ? 'text-red-600' : 'text-gray-900'}`}>
                        {row.available.toFixed(0)}
                      </p>
                    </div>
                    <div className="text-center border-x border-gray-200">
                      <p className="text-xs text-gray-500">Reorder Pt</p>
                      <p className="text-lg font-bold text-gray-900">{row.reorderPoint.toFixed(0)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-gray-500">Days Cover</p>
                      <p className={`text-lg font-bold ${
                        row.daysOfCover < 7 ? 'text-red-600' :
                        row.daysOfCover < 14 ? 'text-orange-600' :
                        row.daysOfCover > 90 ? 'text-amber-600' :
                        'text-green-600'
                      }`}>
                        {row.daysOfCover > 999 ? '999+' : row.daysOfCover.toFixed(0)}
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
                        <p className="text-xs text-gray-500">Location</p>
                        <p className="font-medium">{row.location}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Allocated</p>
                        <p className="font-medium">{row.allocated.toFixed(0)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">On PO</p>
                        <p className="font-medium">{row.onPO.toFixed(0)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Safety Stock</p>
                        <p className="font-medium">{row.safety.toFixed(0)}</p>
                      </div>
                      {row.supplier && (
                        <div className="col-span-2">
                          <p className="text-xs text-gray-500">Supplier</p>
                          <p className="font-medium">{row.supplier}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Results Summary */}
          <div className="text-center text-sm text-gray-500">
            Showing {processedData.length} of {reportData.length} items
          </div>
        </>
      )}
    </div>
  )
}
