import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getSkuVelocityReport, exportToCSV } from '../../api/reports'
import type { SkuVelocityRow, ReportFilters } from '../../api/reports'
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
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  CurrencyPoundIcon,
  ChartBarIcon,
  StarIcon,
  BoltIcon,
  FolderIcon,
  ArrowsRightLeftIcon
} from '@heroicons/react/24/outline'
import { StarIcon as StarSolidIcon } from '@heroicons/react/24/solid'

interface SkuVelocityProps {
  workspaceId: string
}

type SortField = 'sku' | 'product' | 'netRevenue' | 'unitsSoldPerDay' | 'turnoverRatio' | 'sellThroughPercent'
type SortDirection = 'asc' | 'desc'
type ViewTab = 'all' | 'A' | 'B' | 'C'

const abcConfig = {
  A: { 
    name: 'A Class', 
    description: 'Top performers - 80% of revenue',
    color: 'green',
    bgClass: 'bg-green-100',
    textClass: 'text-green-800',
    borderClass: 'border-green-200',
    gradientFrom: 'from-green-50',
    gradientTo: 'to-green-100'
  },
  B: { 
    name: 'B Class', 
    description: 'Moderate performers - 15% of revenue',
    color: 'yellow',
    bgClass: 'bg-yellow-100',
    textClass: 'text-yellow-800',
    borderClass: 'border-yellow-200',
    gradientFrom: 'from-yellow-50',
    gradientTo: 'to-yellow-100'
  },
  C: { 
    name: 'C Class', 
    description: 'Low performers - 5% of revenue',
    color: 'gray',
    bgClass: 'bg-gray-100',
    textClass: 'text-gray-800',
    borderClass: 'border-gray-200',
    gradientFrom: 'from-gray-50',
    gradientTo: 'to-gray-100'
  }
}

export function SkuVelocity({ workspaceId }: SkuVelocityProps) {
  const [activeTab, setActiveTab] = useState<ViewTab>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [sortField, setSortField] = useState<SortField>('netRevenue')
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
    queryKey: ['sku-velocity', workspaceId, filters],
    queryFn: () => getSkuVelocityReport(workspaceId, filters),
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
    if (activeTab !== 'all') {
      filtered = filtered.filter(row => row.abcClass === activeTab)
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
      let aVal = a[sortField as keyof SkuVelocityRow]
      let bVal = b[sortField as keyof SkuVelocityRow]
      
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
    const totalRevenue = reportData.reduce((sum, row) => sum + row.netRevenue, 0)
    const totalUnits = reportData.reduce((sum, row) => sum + row.netUnits, 0)
    const avgVelocity = reportData.length > 0
      ? reportData.reduce((sum, row) => sum + row.unitsSoldPerDay, 0) / reportData.length
      : 0
    const avgTurnover = reportData.length > 0
      ? reportData.reduce((sum, row) => sum + row.turnoverRatio, 0) / reportData.length
      : 0
    const avgSellThrough = reportData.length > 0
      ? reportData.reduce((sum, row) => sum + row.sellThroughPercent, 0) / reportData.length
      : 0

    // ABC breakdown
    const abcStats = {
      A: {
        count: reportData.filter(r => r.abcClass === 'A').length,
        revenue: reportData.filter(r => r.abcClass === 'A').reduce((s, r) => s + r.netRevenue, 0),
        units: reportData.filter(r => r.abcClass === 'A').reduce((s, r) => s + r.netUnits, 0)
      },
      B: {
        count: reportData.filter(r => r.abcClass === 'B').length,
        revenue: reportData.filter(r => r.abcClass === 'B').reduce((s, r) => s + r.netRevenue, 0),
        units: reportData.filter(r => r.abcClass === 'B').reduce((s, r) => s + r.netUnits, 0)
      },
      C: {
        count: reportData.filter(r => r.abcClass === 'C').length,
        revenue: reportData.filter(r => r.abcClass === 'C').reduce((s, r) => s + r.netRevenue, 0),
        units: reportData.filter(r => r.abcClass === 'C').reduce((s, r) => s + r.netUnits, 0)
      }
    }

    // Top performers
    const topByRevenue = [...reportData].sort((a, b) => b.netRevenue - a.netRevenue).slice(0, 5)
    const topByVelocity = [...reportData].sort((a, b) => b.unitsSoldPerDay - a.unitsSoldPerDay).slice(0, 5)
    const bottomPerformers = [...reportData].sort((a, b) => a.netRevenue - b.netRevenue).slice(0, 5)

    return {
      totalSKUs,
      totalRevenue,
      totalUnits,
      avgVelocity,
      avgTurnover,
      avgSellThrough,
      abcStats,
      topByRevenue,
      topByVelocity,
      bottomPerformers
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
        { key: 'sku' as keyof SkuVelocityRow, label: 'SKU' },
        { key: 'product' as keyof SkuVelocityRow, label: 'Product' },
        { key: 'unitsSoldPerDay' as keyof SkuVelocityRow, label: 'Units Sold/Day' },
        { key: 'revenuePerDay' as keyof SkuVelocityRow, label: 'Revenue/Day' },
        { key: 'netUnits' as keyof SkuVelocityRow, label: 'Net Units' },
        { key: 'netRevenue' as keyof SkuVelocityRow, label: 'Net Revenue' },
        { key: 'turnoverRatio' as keyof SkuVelocityRow, label: 'Turnover Ratio' },
        { key: 'sellThroughPercent' as keyof SkuVelocityRow, label: 'Sell-through %' },
        { key: 'abcClass' as keyof SkuVelocityRow, label: 'ABC Class' }
      ]
      exportToCSV(processedData, `sku-velocity-${activeTab}.csv`, columns)
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

  // Get ABC badge
  const getAbcBadge = (abcClass: string) => {
    const config = abcConfig[abcClass as keyof typeof abcConfig]
    if (!config) return null

    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-full ${config.bgClass} ${config.textClass}`}>
        {abcClass === 'A' && <StarSolidIcon className="h-3 w-3" />}
        {abcClass}
      </span>
    )
  }

  // Get velocity indicator
  const getVelocityIndicator = (velocity: number, avgVelocity: number) => {
    if (velocity > avgVelocity * 1.5) {
      return <ArrowTrendingUpIcon className="h-4 w-4 text-green-500" />
    } else if (velocity < avgVelocity * 0.5) {
      return <ArrowTrendingDownIcon className="h-4 w-4 text-red-500" />
    }
    return null
  }

  // Get revenue bar
  const getRevenueBar = (revenue: number, maxRevenue: number) => {
    const percentage = maxRevenue > 0 ? (revenue / maxRevenue) * 100 : 0
    return (
      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-blue-400 to-blue-600 transition-all duration-300"
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

  const maxRevenue = Math.max(...reportData.map(r => r.netRevenue), 1)

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

        {/* Total Revenue */}
        <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 p-4 rounded-xl border border-emerald-200">
          <div className="flex items-center gap-2 mb-2">
            <CurrencyPoundIcon className="h-5 w-5 text-emerald-600" />
            <span className="text-xs font-medium text-emerald-700">Total Revenue</span>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-emerald-900">£{stats.totalRevenue.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
        </div>

        {/* Total Units */}
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-xl border border-purple-200">
          <div className="flex items-center gap-2 mb-2">
            <ChartBarIcon className="h-5 w-5 text-purple-600" />
            <span className="text-xs font-medium text-purple-700">Units Sold</span>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-purple-900">{stats.totalUnits.toLocaleString('en-GB', { maximumFractionDigits: 0 })}</p>
        </div>

        {/* Avg Velocity */}
        <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-4 rounded-xl border border-orange-200">
          <div className="flex items-center gap-2 mb-2">
            <BoltIcon className="h-5 w-5 text-orange-600" />
            <span className="text-xs font-medium text-orange-700">Avg Velocity</span>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-orange-900">{stats.avgVelocity.toFixed(1)}<span className="text-sm font-normal ml-1">/day</span></p>
        </div>

        {/* Avg Turnover */}
        <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 p-4 rounded-xl border border-indigo-200">
          <div className="flex items-center gap-2 mb-2">
            <ArrowsRightLeftIcon className="h-5 w-5 text-indigo-600" />
            <span className="text-xs font-medium text-indigo-700">Avg Turnover</span>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-indigo-900">{stats.avgTurnover.toFixed(1)}<span className="text-sm font-normal ml-1">x</span></p>
        </div>

        {/* Sell-Through */}
        <div className="bg-gradient-to-br from-pink-50 to-pink-100 p-4 rounded-xl border border-pink-200">
          <div className="flex items-center gap-2 mb-2">
            <ArrowTrendingUpIcon className="h-5 w-5 text-pink-600" />
            <span className="text-xs font-medium text-pink-700">Sell-Through</span>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-pink-900">{stats.avgSellThrough.toFixed(0)}<span className="text-sm font-normal ml-1">%</span></p>
        </div>
      </div>

      {/* ABC Classification Visual */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <StarIcon className="h-5 w-5 text-yellow-500" />
          ABC Classification (Pareto Analysis)
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {(['A', 'B', 'C'] as const).map(cls => {
            const config = abcConfig[cls]
            const data = stats.abcStats[cls]
            const revenuePercent = stats.totalRevenue > 0 ? (data.revenue / stats.totalRevenue) * 100 : 0
            const skuPercent = stats.totalSKUs > 0 ? (data.count / stats.totalSKUs) * 100 : 0
            
            return (
              <div 
                key={cls}
                className={`bg-gradient-to-br ${config.gradientFrom} ${config.gradientTo} p-5 rounded-xl border ${config.borderClass}`}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold ${config.bgClass} ${config.textClass}`}>
                    {cls === 'A' && <StarSolidIcon className="h-4 w-4" />}
                    {config.name}
                  </span>
                  <span className="text-sm text-gray-500">{data.count} SKUs</span>
                </div>
                
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">Revenue</span>
                      <span className="font-semibold">£{data.revenue.toLocaleString('en-GB', { maximumFractionDigits: 0 })}</span>
                    </div>
                    <div className="h-2 bg-white/50 rounded-full overflow-hidden">
                      <div 
                        className={`h-full ${cls === 'A' ? 'bg-green-500' : cls === 'B' ? 'bg-yellow-500' : 'bg-gray-400'}`}
                        style={{ width: `${revenuePercent}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{revenuePercent.toFixed(1)}% of total revenue</p>
                  </div>
                  
                  <div className="pt-2 border-t border-gray-200/50">
                    <p className="text-xs text-gray-500">{config.description}</p>
                    <p className="text-xs text-gray-400 mt-1">{skuPercent.toFixed(0)}% of SKUs</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Top Performers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top Revenue */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6">
          <h3 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <CurrencyPoundIcon className="h-5 w-5 text-emerald-500" />
            Top Revenue Generators
          </h3>
          <div className="space-y-3">
            {stats.topByRevenue.map((item, index) => (
              <div key={`rev-${item.sku}-${index}`} className="flex items-center gap-3">
                <span className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  index === 0 ? 'bg-yellow-100 text-yellow-700' :
                  index === 1 ? 'bg-gray-100 text-gray-600' :
                  index === 2 ? 'bg-orange-100 text-orange-700' :
                  'bg-gray-50 text-gray-500'
                }`}>
                  {index + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{cleanProductName(item.product)}</p>
                  <p className="text-xs text-gray-500">{item.sku}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-gray-900">£{item.netRevenue.toLocaleString('en-GB', { maximumFractionDigits: 0 })}</p>
                  {getAbcBadge(item.abcClass)}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Highest Velocity */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6">
          <h3 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <BoltIcon className="h-5 w-5 text-orange-500" />
            Highest Velocity SKUs
          </h3>
          <div className="space-y-3">
            {stats.topByVelocity.map((item, index) => (
              <div key={`vel-${item.sku}-${index}`} className="flex items-center gap-3">
                <span className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  index === 0 ? 'bg-orange-100 text-orange-700' :
                  index === 1 ? 'bg-orange-50 text-orange-600' :
                  'bg-gray-50 text-gray-500'
                }`}>
                  {index + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{cleanProductName(item.product)}</p>
                  <p className="text-xs text-gray-500">{item.sku}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-gray-900">{item.unitsSoldPerDay.toFixed(1)} <span className="text-xs font-normal text-gray-500">/day</span></p>
                  {getAbcBadge(item.abcClass)}
                </div>
              </div>
            ))}
          </div>
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
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 text-sm font-medium"
          >
            <ArrowPathIcon className="h-4 w-4" />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          {/* Export */}
          <ExportButton
            onExport={handleExport}
            isLoading={isExporting}
            filename="sku-velocity"
          />
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
            
            {/* ABC Class Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ABC Class</label>
              <select
                value={filters.abcClass || ''}
                onChange={(e) => setFilters(prev => ({ ...prev, abcClass: e.target.value || undefined }))}
                className="w-full rounded-lg border-gray-300 text-sm"
              >
                <option value="">All Classes</option>
                <option value="A">A Class (Top 80%)</option>
                <option value="B">B Class (Next 15%)</option>
                <option value="C">C Class (Bottom 5%)</option>
              </select>
            </div>

            {/* Channel Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Channel</label>
              <select
                value={filters.channel || ''}
                onChange={(e) => setFilters(prev => ({ ...prev, channel: e.target.value || undefined }))}
                className="w-full rounded-lg border-gray-300 text-sm"
              >
                <option value="">All Channels</option>
                <option value="Manual">Manual</option>
                <option value="Online">Online</option>
                <option value="Wholesale">Wholesale</option>
              </select>
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
            label: 'All SKUs', 
            count: reportData.length, 
            color: 'blue',
            tooltip: 'Shows all products regardless of ABC classification'
          },
          { 
            id: 'A' as ViewTab, 
            label: 'A Class', 
            count: stats.abcStats.A.count, 
            color: 'green',
            tooltip: 'Top performers generating 80% of revenue. These are your star products - protect their availability.'
          },
          { 
            id: 'B' as ViewTab, 
            label: 'B Class', 
            count: stats.abcStats.B.count, 
            color: 'yellow',
            tooltip: 'Moderate performers generating 15% of revenue. These have potential - consider promotions to move to A class.'
          },
          { 
            id: 'C' as ViewTab, 
            label: 'C Class', 
            count: stats.abcStats.C.count, 
            color: 'gray',
            tooltip: 'Low performers generating 5% of revenue. Review for discontinuation or reduced stock levels.'
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
              {tab.id === 'A' && <StarSolidIcon className="h-4 w-4 text-yellow-500" />}
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
            <p className="text-gray-500 font-medium">Loading velocity data...</p>
          </div>
        </div>
      ) : processedData.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12">
          <div className="flex flex-col items-center justify-center">
            <ChartBarIcon className="h-16 w-16 text-gray-300 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Data Found</h3>
            <p className="text-gray-500">No velocity data available for the selected filters</p>
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
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">ABC</th>
                    <th className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleSort('netRevenue')}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-gray-600 uppercase tracking-wider hover:text-gray-900"
                      >
                        Revenue
                        {sortField === 'netRevenue' && (sortDirection === 'asc' ? <ChevronUpIcon className="h-3 w-3" /> : <ChevronDownIcon className="h-3 w-3" />)}
                      </button>
                    </th>
                    <th className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleSort('unitsSoldPerDay')}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-gray-600 uppercase tracking-wider hover:text-gray-900"
                      >
                        Velocity
                        {sortField === 'unitsSoldPerDay' && (sortDirection === 'asc' ? <ChevronUpIcon className="h-3 w-3" /> : <ChevronDownIcon className="h-3 w-3" />)}
                      </button>
                    </th>
                    <th className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleSort('turnoverRatio')}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-gray-600 uppercase tracking-wider hover:text-gray-900"
                      >
                        Turnover
                        {sortField === 'turnoverRatio' && (sortDirection === 'asc' ? <ChevronUpIcon className="h-3 w-3" /> : <ChevronDownIcon className="h-3 w-3" />)}
                      </button>
                    </th>
                    <th className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleSort('sellThroughPercent')}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-gray-600 uppercase tracking-wider hover:text-gray-900"
                      >
                        Sell-Through
                        {sortField === 'sellThroughPercent' && (sortDirection === 'asc' ? <ChevronUpIcon className="h-3 w-3" /> : <ChevronDownIcon className="h-3 w-3" />)}
                      </button>
                    </th>
                    <th className="px-4 py-3 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {processedData.map((row, index) => (
                    <>
                      <tr
                        key={`${row.sku}-${index}`}
                        className={`hover:bg-gray-50 cursor-pointer transition-colors ${
                          row.abcClass === 'A' ? 'bg-green-50/30' : ''
                        }`}
                        onClick={() => toggleRowExpand(row.sku)}
                      >
                        <td className="px-4 py-3">
                          <span className="font-mono text-sm text-gray-900">{row.sku}</span>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm font-medium text-gray-900 truncate max-w-xs">{cleanProductName(row.product)}</p>
                        </td>
                        <td className="px-4 py-3 text-center">{getAbcBadge(row.abcClass)}</td>
                        <td className="px-4 py-3">
                          <div className="text-right">
                            <p className="text-sm font-semibold text-gray-900">£{row.netRevenue.toLocaleString('en-GB', { maximumFractionDigits: 0 })}</p>
                            <div className="mt-1">{getRevenueBar(row.netRevenue, maxRevenue)}</div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <span className="text-sm font-medium text-gray-900">{row.unitsSoldPerDay.toFixed(1)}</span>
                            <span className="text-xs text-gray-500">/day</span>
                            {getVelocityIndicator(row.unitsSoldPerDay, stats.avgVelocity)}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-sm font-medium text-gray-900">{row.turnoverRatio.toFixed(1)}x</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={`text-sm font-medium ${
                            row.sellThroughPercent >= 80 ? 'text-green-600' :
                            row.sellThroughPercent >= 50 ? 'text-yellow-600' :
                            'text-red-600'
                          }`}>{row.sellThroughPercent.toFixed(0)}%</span>
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
                                <p className="text-xs text-gray-500 mb-1">Net Units</p>
                                <p className="text-sm font-medium">{row.netUnits.toFixed(0)}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500 mb-1">Revenue/Day</p>
                                <p className="text-sm font-medium">£{row.revenuePerDay.toFixed(2)}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500 mb-1">Channel</p>
                                <p className="text-sm font-medium">{row.channel || 'Manual'}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500 mb-1">ABC Class</p>
                                <p className="text-sm font-medium">{abcConfig[row.abcClass as keyof typeof abcConfig]?.name || row.abcClass}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500 mb-1">Turnover Ratio</p>
                                <p className="text-sm font-medium">{row.turnoverRatio.toFixed(2)}x annually</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500 mb-1">Sell-Through</p>
                                <p className="text-sm font-medium">{row.sellThroughPercent.toFixed(1)}%</p>
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
            {processedData.map((row, index) => {
              const config = abcConfig[row.abcClass as keyof typeof abcConfig]
              
              return (
                <div
                  key={`mobile-${row.sku}-${index}`}
                  className={`bg-white rounded-xl border overflow-hidden ${
                    row.abcClass === 'A' ? 'border-green-200 ring-1 ring-green-100' :
                    row.abcClass === 'B' ? 'border-yellow-200' :
                    'border-gray-200'
                  }`}
                >
                  {/* A Class Banner */}
                  {row.abcClass === 'A' && (
                    <div className="bg-gradient-to-r from-green-500 to-emerald-500 text-white px-4 py-2 text-sm font-bold flex items-center gap-2">
                      <StarSolidIcon className="h-4 w-4" />
                      TOP PERFORMER
                    </div>
                  )}

                  <div className="p-4">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-mono text-xs text-gray-500 mb-1">{row.sku}</p>
                        <h3 className="text-base font-semibold text-gray-900 leading-tight">{cleanProductName(row.product)}</h3>
                      </div>
                      {getAbcBadge(row.abcClass)}
                    </div>

                    {/* Revenue Bar */}
                    <div className="mb-4">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-500">Revenue</span>
                        <span className="font-bold text-gray-900">£{row.netRevenue.toLocaleString('en-GB', { maximumFractionDigits: 0 })}</span>
                      </div>
                      {getRevenueBar(row.netRevenue, maxRevenue)}
                    </div>

                    {/* Key Metrics Grid */}
                    <div className="grid grid-cols-3 gap-3 p-3 bg-gray-50 rounded-lg">
                      <div className="text-center">
                        <p className="text-xs text-gray-500">Velocity</p>
                        <p className="text-lg font-bold text-gray-900">{row.unitsSoldPerDay.toFixed(1)}</p>
                        <p className="text-xs text-gray-400">/day</p>
                      </div>
                      <div className="text-center border-x border-gray-200">
                        <p className="text-xs text-gray-500">Turnover</p>
                        <p className="text-lg font-bold text-gray-900">{row.turnoverRatio.toFixed(1)}x</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-gray-500">Sell-Through</p>
                        <p className={`text-lg font-bold ${
                          row.sellThroughPercent >= 80 ? 'text-green-600' :
                          row.sellThroughPercent >= 50 ? 'text-yellow-600' :
                          'text-red-600'
                        }`}>{row.sellThroughPercent.toFixed(0)}%</p>
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
                          <p className="text-xs text-gray-500">Net Units</p>
                          <p className="font-medium">{row.netUnits.toFixed(0)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Revenue/Day</p>
                          <p className="font-medium">£{row.revenuePerDay.toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Channel</p>
                          <p className="font-medium">{row.channel || 'Manual'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Classification</p>
                          <p className="font-medium">{config?.description || row.abcClass}</p>
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
            Showing {processedData.length} of {reportData.length} SKUs
            {activeTab !== 'all' && (
              <span className="ml-2">
                • {activeTab} Class: £{stats.abcStats[activeTab as 'A' | 'B' | 'C'].revenue.toLocaleString('en-GB', { maximumFractionDigits: 0 })} revenue
              </span>
            )}
          </div>
        </>
      )}
    </div>
  )
}
