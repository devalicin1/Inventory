import { useState, useMemo, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getInventoryLedgerReport, exportToCSV } from '../../api/reports'
import type { InventoryLedgerRow, ReportFilters } from '../../api/reports'
import { listGroups, type Group } from '../../api/products'
import { ExportButton } from './ExportButton'
import {
  MagnifyingGlassIcon,
  ExclamationTriangleIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  FunnelIcon,
  XMarkIcon,
  ArrowPathIcon,
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  ArrowsRightLeftIcon,
  DocumentTextIcon,
  CalendarDaysIcon,
  UserIcon,
  MapPinIcon,
  ClockIcon,
  CubeIcon,
  AdjustmentsHorizontalIcon,
  FolderIcon
} from '@heroicons/react/24/outline'
import { 
  ArrowTrendingUpIcon, 
  ArrowTrendingDownIcon 
} from '@heroicons/react/24/solid'

interface InventoryLedgerProps {
  workspaceId: string
}

type SortField = 'dateTime' | 'sku' | 'productName' | 'movementType' | 'qtyIn' | 'qtyOut' | 'net' | 'runningBalance'
type SortDirection = 'asc' | 'desc'
type ViewTab = 'all' | 'in' | 'out' | 'adjustments' | 'transfers'

const movementTypeConfig: Record<string, { label: string; color: string; bgClass: string; textClass: string; icon: React.ReactNode }> = {
  'Receive': { 
    label: 'Receive', 
    color: 'green',
    bgClass: 'bg-green-100', 
    textClass: 'text-green-800',
    icon: <ArrowDownTrayIcon className="h-4 w-4" />
  },
  'Ship': { 
    label: 'Ship', 
    color: 'blue',
    bgClass: 'bg-blue-100', 
    textClass: 'text-blue-800',
    icon: <ArrowUpTrayIcon className="h-4 w-4" />
  },
  'Transfer': { 
    label: 'Transfer', 
    color: 'yellow',
    bgClass: 'bg-yellow-100', 
    textClass: 'text-yellow-800',
    icon: <ArrowsRightLeftIcon className="h-4 w-4" />
  },
  'Adjust': { 
    label: 'Adjustment', 
    color: 'purple',
    bgClass: 'bg-purple-100', 
    textClass: 'text-purple-800',
    icon: <AdjustmentsHorizontalIcon className="h-4 w-4" />
  },
  'AdjustUp': { 
    label: 'Adjust Up', 
    color: 'emerald',
    bgClass: 'bg-emerald-100', 
    textClass: 'text-emerald-800',
    icon: <ArrowTrendingUpIcon className="h-4 w-4" />
  },
  'AdjustDown': { 
    label: 'Adjust Down', 
    color: 'red',
    bgClass: 'bg-red-100', 
    textClass: 'text-red-800',
    icon: <ArrowTrendingDownIcon className="h-4 w-4" />
  },
  'Production': { 
    label: 'Production', 
    color: 'indigo',
    bgClass: 'bg-indigo-100', 
    textClass: 'text-indigo-800',
    icon: <CubeIcon className="h-4 w-4" />
  },
  'Consume': { 
    label: 'Consume', 
    color: 'orange',
    bgClass: 'bg-orange-100', 
    textClass: 'text-orange-800',
    icon: <CubeIcon className="h-4 w-4" />
  }
}

export function InventoryLedger({ workspaceId }: InventoryLedgerProps) {
  const [activeTab, setActiveTab] = useState<ViewTab>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [sortField, setSortField] = useState<SortField>('dateTime')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [isExporting, setIsExporting] = useState(false)
  const [filters, setFilters] = useState<ReportFilters>({})
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set())
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(50)

  // Fetch groups/folders for filter
  const { data: groups = [] } = useQuery<Group[]>({
    queryKey: ['groups', workspaceId],
    queryFn: () => listGroups(workspaceId),
    enabled: !!workspaceId
  })

  const { data: reportData = [], isLoading, error, refetch } = useQuery({
    queryKey: ['inventory-ledger', workspaceId, filters],
    queryFn: () => getInventoryLedgerReport(workspaceId, filters),
    enabled: !!workspaceId
  })

  // Filter and sort data
  const processedData = useMemo(() => {
    let filtered = reportData

    // Apply tab filter
    if (activeTab === 'in') {
      filtered = filtered.filter(row => row.qtyIn > 0)
    } else if (activeTab === 'out') {
      filtered = filtered.filter(row => row.qtyOut > 0)
    } else if (activeTab === 'adjustments') {
      filtered = filtered.filter(row => 
        row.movementType.includes('Adjust') || 
        row.movementType === 'Adjust'
      )
    } else if (activeTab === 'transfers') {
      filtered = filtered.filter(row => row.movementType === 'Transfer')
    }

    // Apply search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(row =>
        row.sku.toLowerCase().includes(term) ||
        row.productName.toLowerCase().includes(term) ||
        row.movementType.toLowerCase().includes(term) ||
        row.user?.toLowerCase().includes(term) ||
        row.notes?.toLowerCase().includes(term) ||
        row.locationIn?.toLowerCase().includes(term) ||
        row.locationOut?.toLowerCase().includes(term)
      )
    }

    // Apply sorting
    filtered = [...filtered].sort((a, b) => {
      let aVal: any = a[sortField as keyof InventoryLedgerRow]
      let bVal: any = b[sortField as keyof InventoryLedgerRow]
      
      if (sortField === 'dateTime') {
        aVal = new Date(aVal).getTime()
        bVal = new Date(bVal).getTime()
      } else if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase()
        bVal = bVal?.toLowerCase() || ''
      }
      
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1
      return 0
    })

    return filtered
  }, [reportData, activeTab, searchTerm, sortField, sortDirection])

  // Pagination calculations
  const totalPages = Math.ceil(processedData.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedData = useMemo(() => {
    return processedData.slice(startIndex, endIndex)
  }, [processedData, startIndex, endIndex])

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [activeTab, searchTerm, sortField, sortDirection, filters])

  // Calculate statistics
  const stats = useMemo(() => {
    const totalTransactions = reportData.length
    const totalIn = reportData.reduce((sum, row) => sum + row.qtyIn, 0)
    const totalOut = reportData.reduce((sum, row) => sum + row.qtyOut, 0)
    const netMovement = reportData.reduce((sum, row) => sum + row.net, 0)
    const currentBalance = reportData.length > 0 ? reportData[reportData.length - 1]?.runningBalance || 0 : 0

    // Movement type breakdown
    const movementBreakdown: Record<string, { count: number; qtyIn: number; qtyOut: number }> = {}
    reportData.forEach(row => {
      const type = row.movementType
      if (!movementBreakdown[type]) {
        movementBreakdown[type] = { count: 0, qtyIn: 0, qtyOut: 0 }
      }
      movementBreakdown[type].count++
      movementBreakdown[type].qtyIn += row.qtyIn
      movementBreakdown[type].qtyOut += row.qtyOut
    })

    // Daily activity (last 7 days)
    const today = new Date()
    const dailyActivity: { date: string; in: number; out: number }[] = []
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today)
      date.setDate(date.getDate() - i)
      const dateStr = date.toISOString().split('T')[0]
      const dayData = reportData.filter(row => row.dateTime.startsWith(dateStr))
      dailyActivity.push({
        date: dateStr,
        in: dayData.reduce((sum, r) => sum + r.qtyIn, 0),
        out: dayData.reduce((sum, r) => sum + r.qtyOut, 0)
      })
    }

    // Unique users
    const uniqueUsers = new Set(reportData.map(r => r.user).filter(Boolean)).size

    // Unique locations
    const locations = new Set([
      ...reportData.map(r => r.locationIn).filter(Boolean),
      ...reportData.map(r => r.locationOut).filter(Boolean)
    ])

    return {
      totalTransactions,
      totalIn,
      totalOut,
      netMovement,
      currentBalance,
      movementBreakdown,
      dailyActivity,
      uniqueUsers,
      uniqueLocations: locations.size
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
        { key: 'dateTime' as keyof InventoryLedgerRow, label: 'Date/Time' },
        { key: 'sku' as keyof InventoryLedgerRow, label: 'SKU' },
        { key: 'productName' as keyof InventoryLedgerRow, label: 'Product' },
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
      exportToCSV(processedData, `inventory-ledger-${activeTab}.csv`, columns)
    } finally {
      setIsExporting(false)
    }
  }

  const toggleRowExpand = (index: number) => {
    setExpandedRows(prev => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      return next
    })
  }

  // Get movement type badge
  const getMovementBadge = (type: string) => {
    const config = movementTypeConfig[type] || {
      label: type,
      bgClass: 'bg-gray-100',
      textClass: 'text-gray-800',
      icon: <DocumentTextIcon className="h-4 w-4" />
    }

    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full ${config.bgClass} ${config.textClass}`}>
        {config.icon}
        {config.label}
        </span>
      )
  }

  // Format date
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return {
      date: date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      time: date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    }
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
        {/* Total Transactions */}
        <div className="bg-gradient-to-br from-slate-50 to-slate-100 p-4 rounded-xl border border-slate-200">
          <div className="flex items-center gap-2 mb-2">
            <DocumentTextIcon className="h-5 w-5 text-slate-600" />
            <span className="text-xs font-medium text-slate-700">Transactions</span>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-slate-900">{stats.totalTransactions}</p>
        </div>

        {/* Total In */}
        <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-xl border border-green-200">
          <div className="flex items-center gap-2 mb-2">
            <ArrowDownTrayIcon className="h-5 w-5 text-green-600" />
            <span className="text-xs font-medium text-green-700">Total In</span>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-green-900">+{stats.totalIn.toLocaleString('en-GB', { maximumFractionDigits: 0 })}</p>
        </div>

        {/* Total Out */}
        <div className="bg-gradient-to-br from-red-50 to-red-100 p-4 rounded-xl border border-red-200">
          <div className="flex items-center gap-2 mb-2">
            <ArrowUpTrayIcon className="h-5 w-5 text-red-600" />
            <span className="text-xs font-medium text-red-700">Total Out</span>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-red-900">-{stats.totalOut.toLocaleString('en-GB', { maximumFractionDigits: 0 })}</p>
        </div>

        {/* Net Movement */}
        <div className={`bg-gradient-to-br p-4 rounded-xl border ${
          stats.netMovement >= 0 
            ? 'from-emerald-50 to-emerald-100 border-emerald-200' 
            : 'from-orange-50 to-orange-100 border-orange-200'
        }`}>
          <div className="flex items-center gap-2 mb-2">
            <ArrowsRightLeftIcon className={`h-5 w-5 ${stats.netMovement >= 0 ? 'text-emerald-600' : 'text-orange-600'}`} />
            <span className={`text-xs font-medium ${stats.netMovement >= 0 ? 'text-emerald-700' : 'text-orange-700'}`}>Net Movement</span>
          </div>
          <p className={`text-2xl sm:text-3xl font-bold ${stats.netMovement >= 0 ? 'text-emerald-900' : 'text-orange-900'}`}>
            {stats.netMovement >= 0 ? '+' : ''}{stats.netMovement.toLocaleString('en-GB', { maximumFractionDigits: 0 })}
          </p>
        </div>

        {/* Users */}
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-xl border border-blue-200">
          <div className="flex items-center gap-2 mb-2">
            <UserIcon className="h-5 w-5 text-blue-600" />
            <span className="text-xs font-medium text-blue-700">Users</span>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-blue-900">{stats.uniqueUsers}</p>
        </div>

        {/* Locations */}
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-xl border border-purple-200">
          <div className="flex items-center gap-2 mb-2">
            <MapPinIcon className="h-5 w-5 text-purple-600" />
            <span className="text-xs font-medium text-purple-700">Locations</span>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-purple-900">{stats.uniqueLocations}</p>
        </div>
      </div>

      {/* Movement Type Breakdown */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <AdjustmentsHorizontalIcon className="h-5 w-5 text-gray-500" />
          Movement Type Breakdown
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {Object.entries(stats.movementBreakdown).map(([type, data]) => {
            const config = movementTypeConfig[type] || { bgClass: 'bg-gray-100', textClass: 'text-gray-800' }
            return (
              <div key={type} className={`p-3 rounded-lg ${config.bgClass}`}>
                <div className="flex items-center justify-between mb-2">
                  {getMovementBadge(type)}
        </div>
                <p className={`text-xl font-bold ${config.textClass}`}>{data.count}</p>
                <div className="flex justify-between text-xs mt-1">
                  <span className="text-green-600">+{data.qtyIn.toFixed(0)}</span>
                  <span className="text-red-600">-{data.qtyOut.toFixed(0)}</span>
        </div>
        </div>
            )
          })}
        </div>
      </div>

      {/* Daily Activity Chart (Simple) */}
      {stats.dailyActivity.some(d => d.in > 0 || d.out > 0) && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <CalendarDaysIcon className="h-5 w-5 text-gray-500" />
            Last 7 Days Activity
          </h3>
          <div className="flex items-end justify-between gap-2 h-32">
            {stats.dailyActivity.map((day, index) => {
              const maxVal = Math.max(...stats.dailyActivity.map(d => Math.max(d.in, d.out)), 1)
              const inHeight = (day.in / maxVal) * 100
              const outHeight = (day.out / maxVal) * 100
              const date = new Date(day.date)
              const dayName = date.toLocaleDateString('en-GB', { weekday: 'short' })
              
              return (
                <div key={index} className="flex-1 flex flex-col items-center gap-1">
                  <div className="flex-1 w-full flex items-end justify-center gap-1">
                    <div 
                      className="w-3 bg-green-400 rounded-t transition-all duration-300"
                      style={{ height: `${inHeight}%`, minHeight: day.in > 0 ? '4px' : '0' }}
                      title={`In: ${day.in}`}
                    />
                    <div 
                      className="w-3 bg-red-400 rounded-t transition-all duration-300"
                      style={{ height: `${outHeight}%`, minHeight: day.out > 0 ? '4px' : '0' }}
                      title={`Out: ${day.out}`}
                    />
                  </div>
                  <span className="text-xs text-gray-500">{dayName}</span>
                </div>
              )
            })}
          </div>
          <div className="flex justify-center gap-6 mt-4">
            <div className="flex items-center gap-2 text-sm">
              <div className="w-3 h-3 bg-green-400 rounded" />
              <span className="text-gray-600">Stock In</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <div className="w-3 h-3 bg-red-400 rounded" />
              <span className="text-gray-600">Stock Out</span>
            </div>
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
              placeholder="Search by SKU, product, user, notes..."
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
          filename="inventory-ledger"
        />
      </div>

        {/* Expanded Filters */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-gray-200 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Date From */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <CalendarDaysIcon className="inline h-4 w-4 mr-1" />
                From Date
              </label>
              <input
                type="date"
                value={filters.dateFrom || ''}
                onChange={(e) => setFilters(prev => ({ ...prev, dateFrom: e.target.value || undefined }))}
                className="w-full rounded-lg border-gray-300 text-sm"
              />
            </div>

            {/* Date To */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <CalendarDaysIcon className="inline h-4 w-4 mr-1" />
                To Date
              </label>
              <input
                type="date"
                value={filters.dateTo || ''}
                onChange={(e) => setFilters(prev => ({ ...prev, dateTo: e.target.value || undefined }))}
                className="w-full rounded-lg border-gray-300 text-sm"
              />
            </div>

            {/* Movement Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Movement Type</label>
              <select
                value={filters.movementType || ''}
                onChange={(e) => setFilters(prev => ({ ...prev, movementType: e.target.value || undefined }))}
                className="w-full rounded-lg border-gray-300 text-sm"
              >
                <option value="">All Types</option>
                <option value="Receive">Receive</option>
                <option value="Ship">Ship</option>
                <option value="Transfer">Transfer</option>
                <option value="Adjust">Adjustment</option>
                <option value="Production">Production</option>
                <option value="Consume">Consume</option>
              </select>
            </div>

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
      </div>

      {/* Tab Navigation */}
      <div className="flex flex-wrap gap-2">
        {[
          { 
            id: 'all' as ViewTab, 
            label: 'All Transactions', 
            count: reportData.length, 
            color: 'blue',
            tooltip: 'All inventory movements'
          },
          { 
            id: 'in' as ViewTab, 
            label: 'Stock In', 
            count: reportData.filter(r => r.qtyIn > 0).length, 
            color: 'green',
            tooltip: 'Receive, Production, and positive adjustments'
          },
          { 
            id: 'out' as ViewTab, 
            label: 'Stock Out', 
            count: reportData.filter(r => r.qtyOut > 0).length, 
            color: 'red',
            tooltip: 'Ship, Consume, and negative adjustments'
          },
          { 
            id: 'adjustments' as ViewTab, 
            label: 'Adjustments', 
            count: reportData.filter(r => r.movementType.includes('Adjust')).length, 
            color: 'purple',
            tooltip: 'Manual stock adjustments (up or down)'
          },
          { 
            id: 'transfers' as ViewTab, 
            label: 'Transfers', 
            count: reportData.filter(r => r.movementType === 'Transfer').length, 
            color: 'yellow',
            tooltip: 'Stock movements between locations'
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
              {tab.id === 'in' && <ArrowDownTrayIcon className="h-4 w-4" />}
              {tab.id === 'out' && <ArrowUpTrayIcon className="h-4 w-4" />}
              {tab.id === 'adjustments' && <AdjustmentsHorizontalIcon className="h-4 w-4" />}
              {tab.id === 'transfers' && <ArrowsRightLeftIcon className="h-4 w-4" />}
              {tab.label}
              <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                activeTab === tab.id ? `bg-${tab.color}-200` : 'bg-gray-100'
              }`}>
                {tab.count}
              </span>
            </button>
            {/* Tooltip */}
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50 w-48 text-center whitespace-pre-line shadow-lg">
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
            <p className="text-gray-500 font-medium">Loading ledger data...</p>
          </div>
        </div>
      ) : processedData.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12">
          <div className="flex flex-col items-center justify-center">
            <DocumentTextIcon className="h-16 w-16 text-gray-300 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Transactions Found</h3>
            <p className="text-gray-500">No transaction data available for the selected filters</p>
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
                        onClick={() => handleSort('dateTime')}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-gray-600 uppercase tracking-wider hover:text-gray-900"
                      >
                        Date/Time
                        {sortField === 'dateTime' && (sortDirection === 'asc' ? <ChevronUpIcon className="h-3 w-3" /> : <ChevronDownIcon className="h-3 w-3" />)}
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
                    <th className="px-4 py-3 text-left">
                      <button
                        onClick={() => handleSort('movementType')}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-gray-600 uppercase tracking-wider hover:text-gray-900"
                      >
                        Type
                        {sortField === 'movementType' && (sortDirection === 'asc' ? <ChevronUpIcon className="h-3 w-3" /> : <ChevronDownIcon className="h-3 w-3" />)}
                      </button>
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Location</th>
                    <th className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleSort('qtyIn')}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-gray-600 uppercase tracking-wider hover:text-gray-900"
                      >
                        In
                        {sortField === 'qtyIn' && (sortDirection === 'asc' ? <ChevronUpIcon className="h-3 w-3" /> : <ChevronDownIcon className="h-3 w-3" />)}
                      </button>
                    </th>
                    <th className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleSort('qtyOut')}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-gray-600 uppercase tracking-wider hover:text-gray-900"
                      >
                        Out
                        {sortField === 'qtyOut' && (sortDirection === 'asc' ? <ChevronUpIcon className="h-3 w-3" /> : <ChevronDownIcon className="h-3 w-3" />)}
                      </button>
                    </th>
                    <th className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleSort('runningBalance')}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-gray-600 uppercase tracking-wider hover:text-gray-900"
                      >
                        Balance
                        {sortField === 'runningBalance' && (sortDirection === 'asc' ? <ChevronUpIcon className="h-3 w-3" /> : <ChevronDownIcon className="h-3 w-3" />)}
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">User</th>
                    <th className="px-4 py-3 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paginatedData.map((row, index) => {
                    const actualIndex = startIndex + index
                    const { date, time } = formatDate(row.dateTime)
                    return (
                      <>
                        <tr
                          key={`row-${actualIndex}`}
                          className="hover:bg-gray-50 cursor-pointer transition-colors"
                          onClick={() => toggleRowExpand(actualIndex)}
                        >
                          <td className="px-4 py-3">
                            <div>
                              <p className="text-sm font-medium text-gray-900">{date}</p>
                              <p className="text-xs text-gray-500 flex items-center gap-1">
                                <ClockIcon className="h-3 w-3" />
                                {time}
                              </p>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div>
                              <p className="text-sm font-medium text-gray-900 truncate max-w-[200px]">{row.productName}</p>
                              <p className="text-xs text-gray-500 font-mono">{row.sku}</p>
                            </div>
                          </td>
                          <td className="px-4 py-3">{getMovementBadge(row.movementType)}</td>
                          <td className="px-4 py-3 text-center">
                            <div className="text-sm">
                              {row.locationIn && (
                                <span className="text-green-600">→ {row.locationIn}</span>
                              )}
                              {row.locationIn && row.locationOut && <br />}
                              {row.locationOut && (
                                <span className="text-red-600">{row.locationOut} →</span>
                              )}
                              {!row.locationIn && !row.locationOut && '-'}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right">
                            {row.qtyIn > 0 ? (
                              <span className="text-green-600 font-semibold">+{row.qtyIn.toFixed(0)}</span>
                            ) : (
                              <span className="text-gray-300">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {row.qtyOut > 0 ? (
                              <span className="text-red-600 font-semibold">-{row.qtyOut.toFixed(0)}</span>
                            ) : (
                              <span className="text-gray-300">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="text-sm font-bold text-gray-900">{row.runningBalance.toFixed(0)}</span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center">
                                <UserIcon className="h-3 w-3 text-gray-500" />
                              </div>
                              <span className="text-sm text-gray-600 truncate max-w-[100px]">{row.user || '-'}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <ChevronDownIcon className={`h-4 w-4 text-gray-400 transition-transform ${expandedRows.has(actualIndex) ? 'rotate-180' : ''}`} />
                          </td>
                        </tr>
                        {/* Expanded Details Row */}
                        {expandedRows.has(actualIndex) && (
                          <tr className="bg-gray-50">
                            <td colSpan={9} className="px-4 py-4">
                              <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                                <div>
                                  <p className="text-xs text-gray-500 mb-1">Full Product Name</p>
                                  <p className="text-sm font-medium">{row.productName}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-gray-500 mb-1">Net Change</p>
                                  <p className={`text-sm font-semibold ${row.net >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {row.net >= 0 ? '+' : ''}{row.net.toFixed(2)}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-xs text-gray-500 mb-1">Location In</p>
                                  <p className="text-sm font-medium">{row.locationIn || '-'}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-gray-500 mb-1">Location Out</p>
                                  <p className="text-sm font-medium">{row.locationOut || '-'}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-gray-500 mb-1">Notes / Reason</p>
                                  <p className="text-sm font-medium">{row.notes || '-'}</p>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden space-y-3">
            {paginatedData.map((row, index) => {
              const actualIndex = startIndex + index
              const { date, time } = formatDate(row.dateTime)
              const config = movementTypeConfig[row.movementType] || { bgClass: 'bg-gray-100', textClass: 'text-gray-800' }
              
              return (
                <div
                  key={`mobile-${actualIndex}`}
                  className={`bg-white rounded-xl border overflow-hidden ${
                    row.qtyIn > 0 ? 'border-green-200' :
                    row.qtyOut > 0 ? 'border-red-200' :
                    'border-gray-200'
                  }`}
                >
                  {/* Header with movement type */}
                  <div className={`px-4 py-2 flex items-center justify-between ${config.bgClass}`}>
                    {getMovementBadge(row.movementType)}
                    <span className="text-xs text-gray-600">{date} {time}</span>
                  </div>

                  <div className="p-4">
                    {/* Product and User */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0 mr-3">
                        <p className="text-sm font-semibold text-gray-900 truncate">{row.productName}</p>
                        <p className="text-xs text-gray-500 font-mono">{row.sku}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-xs text-gray-500">User</p>
                        <p className="text-sm font-medium">{row.user || '-'}</p>
                      </div>
                    </div>

                    {/* Qty In/Out Grid */}
                    <div className="grid grid-cols-3 gap-3 p-3 bg-gray-50 rounded-lg">
                      <div className="text-center">
                        <p className="text-xs text-gray-500">In</p>
                        <p className={`text-lg font-bold ${row.qtyIn > 0 ? 'text-green-600' : 'text-gray-300'}`}>
                          {row.qtyIn > 0 ? `+${row.qtyIn.toFixed(0)}` : '-'}
                        </p>
                      </div>
                      <div className="text-center border-x border-gray-200">
                        <p className="text-xs text-gray-500">Out</p>
                        <p className={`text-lg font-bold ${row.qtyOut > 0 ? 'text-red-600' : 'text-gray-300'}`}>
                          {row.qtyOut > 0 ? `-${row.qtyOut.toFixed(0)}` : '-'}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-gray-500">Balance</p>
                        <p className="text-lg font-bold text-gray-900">{row.runningBalance.toFixed(0)}</p>
                      </div>
                    </div>

                    {/* Locations */}
                    {(row.locationIn || row.locationOut) && (
                      <div className="mt-3 flex items-center gap-2 text-sm">
                        <MapPinIcon className="h-4 w-4 text-gray-400" />
                        {row.locationOut && <span className="text-red-600">{row.locationOut}</span>}
                        {row.locationIn && row.locationOut && <span className="text-gray-400">→</span>}
                        {row.locationIn && <span className="text-green-600">{row.locationIn}</span>}
                      </div>
                    )}

                    {/* Notes */}
                    {row.notes && (
                      <div className="mt-3 text-sm text-gray-600 bg-gray-50 p-2 rounded">
                        <span className="text-xs text-gray-400">Notes: </span>
                        {row.notes}
        </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Pagination Controls */}
          {processedData.length > itemsPerPage && (
            <div className="bg-white rounded-xl border border-gray-200 px-4 py-4 sm:px-6">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                {/* Items per page selector */}
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-700">Show:</span>
                  <select
                    value={itemsPerPage}
                    onChange={(e) => {
                      setItemsPerPage(Number(e.target.value))
                      setCurrentPage(1)
                    }}
                    className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                    <option value={200}>200</option>
                  </select>
                  <span className="text-sm text-gray-700">per page</span>
                </div>

                {/* Page info */}
                <div className="text-sm text-gray-700">
                  Showing <span className="font-medium text-gray-900">{startIndex + 1}</span> to{' '}
                  <span className="font-medium text-gray-900">{Math.min(endIndex, processedData.length)}</span> of{' '}
                  <span className="font-medium text-gray-900">{processedData.length.toLocaleString()}</span> transactions
                </div>

                {/* Pagination buttons */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                  >
                    <ChevronLeftIcon className="h-4 w-4" />
                    <span className="hidden sm:inline">Previous</span>
                  </button>

                  {/* Page numbers */}
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum: number
                      if (totalPages <= 5) {
                        pageNum = i + 1
                      } else if (currentPage <= 3) {
                        pageNum = i + 1
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i
                      } else {
                        pageNum = currentPage - 2 + i
                      }

                      return (
                        <button
                          key={pageNum}
                          onClick={() => setCurrentPage(pageNum)}
                          className={`px-3 py-1.5 text-sm font-medium rounded-md ${
                            currentPage === pageNum
                              ? 'bg-blue-600 text-white'
                              : 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          {pageNum}
                        </button>
                      )
                    })}
                  </div>

                  <button
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                  >
                    <span className="hidden sm:inline">Next</span>
                    <ChevronRightIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
