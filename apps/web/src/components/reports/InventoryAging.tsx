import { useState, useMemo, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getInventoryAgingReport, exportToCSV } from '../../api/reports'
import type { InventoryAgingRow, ReportFilters } from '../../api/reports'
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
  ClockIcon,
  CurrencyPoundIcon,
  ArchiveBoxXMarkIcon,
  CalendarDaysIcon,
  FolderIcon
} from '@heroicons/react/24/outline'

interface InventoryAgingProps {
  workspaceId: string
}

type SortField = 'sku' | 'product' | 'daysOnHand' | 'quantity' | 'value'
type SortDirection = 'asc' | 'desc'
type ViewTab = 'all' | '0-30' | '31-60' | '61-90' | '90+' | 'dead-stock'

const agingBuckets = [
  { id: '0-30', name: '0-30 Days', shortName: 'Fresh', color: 'green', bgClass: 'bg-green-100', textClass: 'text-green-800', borderClass: 'border-green-200' },
  { id: '31-60', name: '31-60 Days', shortName: 'Aging', color: 'yellow', bgClass: 'bg-yellow-100', textClass: 'text-yellow-800', borderClass: 'border-yellow-200' },
  { id: '61-90', name: '61-90 Days', shortName: 'Old', color: 'orange', bgClass: 'bg-orange-100', textClass: 'text-orange-800', borderClass: 'border-orange-200' },
  { id: '90+', name: '90+ Days', shortName: 'Critical', color: 'red', bgClass: 'bg-red-100', textClass: 'text-red-800', borderClass: 'border-red-200' }
]

export function InventoryAging({ workspaceId }: InventoryAgingProps) {
  const [activeTab, setActiveTab] = useState<ViewTab>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [sortField, setSortField] = useState<SortField>('daysOnHand')
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
    queryKey: ['inventory-aging', workspaceId, filters],
    queryFn: () => getInventoryAgingReport(workspaceId, filters),
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

  // Filter and sort data
  const processedData = useMemo(() => {
    let filtered = reportData

    // Apply tab filter
    switch (activeTab) {
      case '0-30':
      case '31-60':
      case '61-90':
      case '90+':
        filtered = filtered.filter(row => row.agingBucket === activeTab)
        break
      case 'dead-stock':
        filtered = filtered.filter(row => row.deadStock)
        break
    }

    // Apply search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(row =>
        row.sku.toLowerCase().includes(term) ||
        row.product.toLowerCase().includes(term)
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
    const totalValue = reportData.reduce((sum, row) => sum + row.value, 0)
    const totalQty = reportData.reduce((sum, row) => sum + row.quantity, 0)
    const deadStockCount = reportData.filter(r => r.deadStock).length
    const deadStockValue = reportData.filter(r => r.deadStock).reduce((sum, row) => sum + row.value, 0)
    const avgDaysOnHand = reportData.length > 0
      ? reportData.reduce((sum, row) => sum + row.daysOnHand, 0) / reportData.length
      : 0

    // Bucket stats
    const bucketStats = agingBuckets.map(bucket => {
      const items = reportData.filter(row => row.agingBucket === bucket.id)
      return {
        ...bucket,
        count: items.length,
        qty: items.reduce((sum, row) => sum + row.quantity, 0),
        value: items.reduce((sum, row) => sum + row.value, 0),
        percentage: totalSKUs > 0 ? (items.length / totalSKUs) * 100 : 0
      }
    })

    return {
      totalSKUs,
      totalValue,
      totalQty,
      deadStockCount,
      deadStockValue,
      avgDaysOnHand,
      bucketStats
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
        { key: 'sku' as keyof InventoryAgingRow, label: 'SKU' },
        { key: 'product' as keyof InventoryAgingRow, label: 'Product' },
        { key: 'firstReceiptDate' as keyof InventoryAgingRow, label: 'First Receipt Date' },
        { key: 'daysOnHand' as keyof InventoryAgingRow, label: 'Days On-Hand' },
        { key: 'agingBucket' as keyof InventoryAgingRow, label: 'Aging Bucket' },
        { key: 'quantity' as keyof InventoryAgingRow, label: 'Quantity' },
        { key: 'unitCost' as keyof InventoryAgingRow, label: 'Unit Cost' },
        { key: 'value' as keyof InventoryAgingRow, label: 'Value (£)' }
      ]
      exportToCSV(processedData, `inventory-aging-${activeTab}.csv`, columns)
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

  // Get aging badge
  const getAgingBadge = (row: InventoryAgingRow) => {
    const bucket = agingBuckets.find(b => b.id === row.agingBucket)
    if (!bucket) return null

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-full ${bucket.bgClass} ${bucket.textClass}`}>
        <ClockIcon className="h-3 w-3" />
        {bucket.name}
      </span>
    )
  }

  // Get aging progress bar
  const getAgingBar = (daysOnHand: number) => {
    const maxDays = 120
    const percentage = Math.min((daysOnHand / maxDays) * 100, 100)
    
    let barColor = 'bg-green-500'
    if (daysOnHand > 90) barColor = 'bg-red-500'
    else if (daysOnHand > 60) barColor = 'bg-orange-500'
    else if (daysOnHand > 30) barColor = 'bg-yellow-500'

    return (
      <div className="relative w-full h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full ${barColor} transition-all duration-300`}
          style={{ width: `${percentage}%` }}
        />
        {/* Markers at 30, 60, 90 days */}
        <div className="absolute top-0 bottom-0 w-px bg-gray-400" style={{ left: '25%' }} />
        <div className="absolute top-0 bottom-0 w-px bg-gray-400" style={{ left: '50%' }} />
        <div className="absolute top-0 bottom-0 w-px bg-gray-400" style={{ left: '75%' }} />
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

        {/* Total Value */}
        <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 p-4 rounded-xl border border-emerald-200">
          <div className="flex items-center gap-2 mb-2">
            <CurrencyPoundIcon className="h-5 w-5 text-emerald-600" />
            <span className="text-xs font-medium text-emerald-700">Total Value</span>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-emerald-900">£{stats.totalValue.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
        </div>

        {/* Dead Stock */}
        <div className={`p-4 rounded-xl border ${stats.deadStockCount > 0 ? 'bg-gradient-to-br from-red-50 to-red-100 border-red-200' : 'bg-gray-50 border-gray-200'}`}>
          <div className="flex items-center gap-2 mb-2">
            <ArchiveBoxXMarkIcon className={`h-5 w-5 ${stats.deadStockCount > 0 ? 'text-red-600' : 'text-gray-400'}`} />
            <span className={`text-xs font-medium ${stats.deadStockCount > 0 ? 'text-red-700' : 'text-gray-500'}`}>Dead Stock</span>
          </div>
          <p className={`text-2xl sm:text-3xl font-bold ${stats.deadStockCount > 0 ? 'text-red-900' : 'text-gray-400'}`}>{stats.deadStockCount}</p>
          {stats.deadStockCount > 0 && (
            <p className="text-xs text-red-600 mt-1">£{stats.deadStockValue.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} at risk</p>
          )}
        </div>

        {/* Avg Days */}
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-xl border border-purple-200">
          <div className="flex items-center gap-2 mb-2">
            <ClockIcon className="h-5 w-5 text-purple-600" />
            <span className="text-xs font-medium text-purple-700">Avg Age</span>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-purple-900">{stats.avgDaysOnHand.toFixed(0)}<span className="text-sm font-normal ml-1">days</span></p>
        </div>

        {/* 90+ Days Items */}
        <div className={`p-4 rounded-xl border ${stats.bucketStats[3].count > 0 ? 'bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200' : 'bg-gray-50 border-gray-200'}`}>
          <div className="flex items-center gap-2 mb-2">
            <ExclamationTriangleIcon className={`h-5 w-5 ${stats.bucketStats[3].count > 0 ? 'text-orange-600' : 'text-gray-400'}`} />
            <span className={`text-xs font-medium ${stats.bucketStats[3].count > 0 ? 'text-orange-700' : 'text-gray-500'}`}>90+ Days</span>
          </div>
          <p className={`text-2xl sm:text-3xl font-bold ${stats.bucketStats[3].count > 0 ? 'text-orange-900' : 'text-gray-400'}`}>{stats.bucketStats[3].count}</p>
        </div>

        {/* Fresh Stock (0-30) */}
        <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-xl border border-green-200">
          <div className="flex items-center gap-2 mb-2">
            <CalendarDaysIcon className="h-5 w-5 text-green-600" />
            <span className="text-xs font-medium text-green-700">Fresh (0-30d)</span>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-green-900">{stats.bucketStats[0].count}</p>
        </div>
      </div>

      {/* Aging Distribution Visual */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Aging Distribution</h3>
        
        {/* Visual Bar Chart */}
        <div className="space-y-3">
          {stats.bucketStats.map(bucket => (
            <div key={bucket.id} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${bucket.bgClass} ${bucket.textClass}`}>
                    {bucket.name}
                  </span>
                  <span className="text-gray-600">{bucket.count} items</span>
                </div>
                <div className="text-right">
                  <span className="font-medium text-gray-900">£{bucket.value.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                  <span className="text-gray-500 ml-2">({bucket.percentage.toFixed(1)}%)</span>
                </div>
              </div>
              <div className="h-4 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ${
                    bucket.id === '0-30' ? 'bg-green-500' :
                    bucket.id === '31-60' ? 'bg-yellow-500' :
                    bucket.id === '61-90' ? 'bg-orange-500' :
                    'bg-red-500'
                  }`}
                  style={{ width: `${bucket.percentage}%` }}
                />
              </div>
            </div>
          ))}
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
              placeholder="Search by SKU or product name..."
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
            filename="inventory-aging"
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
            
            {/* Aging Bucket Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Aging Bucket</label>
              <select
                value={filters.agingBucket || ''}
                onChange={(e) => setFilters(prev => ({ ...prev, agingBucket: e.target.value || undefined }))}
                className="w-full rounded-lg border-gray-300 text-sm"
              >
                <option value="">All Buckets</option>
                {agingBuckets.map(bucket => (
                  <option key={bucket.id} value={bucket.id}>{bucket.name}</option>
                ))}
              </select>
            </div>

            {/* Dead Stock Only */}
            <div className="flex items-end">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={activeTab === 'dead-stock'}
                  onChange={(e) => setActiveTab(e.target.checked ? 'dead-stock' : 'all')}
                  className="w-4 h-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
                />
                <span className="text-sm font-medium text-gray-700">Dead Stock Only</span>
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
            tooltip: 'Shows all products in inventory regardless of age'
          },
          { 
            id: '0-30' as ViewTab, 
            label: '0-30 Days', 
            count: stats.bucketStats[0].count, 
            color: 'green',
            tooltip: 'Fresh stock - Items received within the last 30 days. Ideal inventory turnover.'
          },
          { 
            id: '31-60' as ViewTab, 
            label: '31-60 Days', 
            count: stats.bucketStats[1].count, 
            color: 'yellow',
            tooltip: 'Aging stock - Items in inventory for 31-60 days. Consider promotions to move faster.'
          },
          { 
            id: '61-90' as ViewTab, 
            label: '61-90 Days', 
            count: stats.bucketStats[2].count, 
            color: 'orange',
            tooltip: 'Old stock - Items sitting for 61-90 days. High risk of becoming dead stock. Action recommended.'
          },
          { 
            id: '90+' as ViewTab, 
            label: '90+ Days', 
            count: stats.bucketStats[3].count, 
            color: 'red',
            tooltip: 'Critical aging - Items over 90 days old. Significant capital tied up. Consider clearance pricing.'
          },
          { 
            id: 'dead-stock' as ViewTab, 
            label: 'Dead Stock', 
            count: stats.deadStockCount, 
            color: 'red',
            tooltip: 'No sales in 30+ days. These items are not moving and may need to be written off or heavily discounted.'
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
            <p className="text-gray-500 font-medium">Loading aging data...</p>
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
                        onClick={() => handleSort('product')}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-gray-600 uppercase tracking-wider hover:text-gray-900"
                      >
                        Product
                        {sortField === 'product' && (sortDirection === 'asc' ? <ChevronUpIcon className="h-3 w-3" /> : <ChevronDownIcon className="h-3 w-3" />)}
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Aging</th>
                    <th className="px-4 py-3 text-left">
                      <button
                        onClick={() => handleSort('daysOnHand')}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-gray-600 uppercase tracking-wider hover:text-gray-900"
                      >
                        Days On Hand
                        {sortField === 'daysOnHand' && (sortDirection === 'asc' ? <ChevronUpIcon className="h-3 w-3" /> : <ChevronDownIcon className="h-3 w-3" />)}
                      </button>
                    </th>
                    <th className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleSort('quantity')}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-gray-600 uppercase tracking-wider hover:text-gray-900"
                      >
                        Qty
                        {sortField === 'quantity' && (sortDirection === 'asc' ? <ChevronUpIcon className="h-3 w-3" /> : <ChevronDownIcon className="h-3 w-3" />)}
                      </button>
                    </th>
                    <th className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleSort('value')}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-gray-600 uppercase tracking-wider hover:text-gray-900"
                      >
                        Value
                        {sortField === 'value' && (sortDirection === 'asc' ? <ChevronUpIcon className="h-3 w-3" /> : <ChevronDownIcon className="h-3 w-3" />)}
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {processedData.map((row) => (
                    <>
                      <tr
                        key={row.sku}
                        className={`hover:bg-gray-50 cursor-pointer transition-colors ${
                          row.deadStock ? 'bg-red-50/50' : 
                          row.agingBucket === '90+' ? 'bg-orange-50/30' : ''
                        }`}
                        onClick={() => toggleRowExpand(row.sku)}
                      >
                        <td className="px-4 py-3">
                          <span className="font-mono text-sm text-gray-900">{row.sku}</span>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm font-medium text-gray-900 truncate max-w-xs">{cleanProductName(row.product)}</p>
                        </td>
                        <td className="px-4 py-3">{getAgingBadge(row)}</td>
                        <td className="px-4 py-3 min-w-[180px]">
                          <div className="space-y-1">
                            {getAgingBar(row.daysOnHand)}
                            <div className="flex justify-between text-xs text-gray-500">
                              <span>0</span>
                              <span className={`font-bold ${
                                row.daysOnHand > 90 ? 'text-red-600' :
                                row.daysOnHand > 60 ? 'text-orange-600' :
                                row.daysOnHand > 30 ? 'text-yellow-600' :
                                'text-green-600'
                              }`}>{row.daysOnHand} days</span>
                              <span>120+</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-sm font-medium text-gray-900">{row.quantity.toFixed(0)}</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-sm font-semibold text-gray-900">£{row.value.toFixed(2)}</span>
                        </td>
                        <td className="px-4 py-3">
                          {row.deadStock && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-bold text-white bg-red-600 rounded-full">
                              <ArchiveBoxXMarkIcon className="h-3 w-3" />
                              Dead
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <ChevronDownIcon className={`h-4 w-4 text-gray-400 transition-transform ${expandedRows.has(row.sku) ? 'rotate-180' : ''}`} />
                        </td>
                      </tr>
                      {/* Expanded Details Row */}
                      {expandedRows.has(row.sku) && (
                        <tr className="bg-gray-50">
                          <td colSpan={8} className="px-4 py-4">
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                              <div>
                                <p className="text-xs text-gray-500 mb-1">First Receipt</p>
                                <p className="text-sm font-medium">{row.firstReceiptDate}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500 mb-1">Unit Cost</p>
                                <p className="text-sm font-medium">£{row.unitCost.toFixed(2)}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500 mb-1">Total Value</p>
                                <p className="text-sm font-medium">£{row.value.toFixed(2)}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500 mb-1">Aging Bucket</p>
                                <p className="text-sm font-medium">{row.agingBucket}</p>
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
            {processedData.map((row) => {
              const bucket = agingBuckets.find(b => b.id === row.agingBucket)
              
              return (
                <div
                  key={row.sku}
                  className={`bg-white rounded-xl border overflow-hidden ${
                    row.deadStock ? 'border-red-300 ring-2 ring-red-100' :
                    row.agingBucket === '90+' ? 'border-orange-200' :
                    'border-gray-200'
                  }`}
                >
                  {/* Dead Stock Banner */}
                  {row.deadStock && (
                    <div className="bg-red-500 text-white px-4 py-2 text-sm font-bold flex items-center gap-2">
                      <ArchiveBoxXMarkIcon className="h-4 w-4" />
                      DEAD STOCK - No sales in 30+ days
                    </div>
                  )}

                  <div className="p-4">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-mono text-xs text-gray-500 mb-1">{row.sku}</p>
                        <h3 className="text-base font-semibold text-gray-900 leading-tight">{cleanProductName(row.product)}</h3>
                      </div>
                      {getAgingBadge(row)}
                    </div>

                    {/* Aging Bar */}
                    <div className="mb-4">
                      {getAgingBar(row.daysOnHand)}
                      <div className="flex justify-between text-xs text-gray-500 mt-1">
                        <span>0 days</span>
                        <span className={`font-bold ${
                          row.daysOnHand > 90 ? 'text-red-600' :
                          row.daysOnHand > 60 ? 'text-orange-600' :
                          row.daysOnHand > 30 ? 'text-yellow-600' :
                          'text-green-600'
                        }`}>{row.daysOnHand} days old</span>
                        <span>120+ days</span>
                      </div>
                    </div>

                    {/* Key Metrics Grid */}
                    <div className="grid grid-cols-3 gap-3 p-3 bg-gray-50 rounded-lg">
                      <div className="text-center">
                        <p className="text-xs text-gray-500">Quantity</p>
                        <p className="text-lg font-bold text-gray-900">{row.quantity.toFixed(0)}</p>
                      </div>
                      <div className="text-center border-x border-gray-200">
                        <p className="text-xs text-gray-500">Unit Cost</p>
                        <p className="text-lg font-bold text-gray-900">£{row.unitCost.toFixed(2)}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-gray-500">Value</p>
                        <p className={`text-lg font-bold ${row.deadStock ? 'text-red-600' : 'text-gray-900'}`}>£{row.value.toFixed(0)}</p>
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
                          <p className="text-xs text-gray-500">First Receipt</p>
                          <p className="font-medium">{row.firstReceiptDate}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Aging Bucket</p>
                          <p className="font-medium">{bucket?.name || row.agingBucket}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Results Summary */}
          <div className="text-center text-sm text-gray-500">
            Showing {processedData.length} of {reportData.length} items
            {stats.deadStockCount > 0 && (
              <span className="ml-2 text-red-600">
                • {stats.deadStockCount} dead stock items (£{stats.deadStockValue.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} at risk)
              </span>
            )}
          </div>
        </>
      )}
    </div>
  )
}
