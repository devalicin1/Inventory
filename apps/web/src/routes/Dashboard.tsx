import { useQuery } from '@tanstack/react-query'
import { useSessionStore } from '../state/sessionStore'
import {
  CubeIcon,
  CogIcon,
  ChartBarIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  CalendarIcon,
  ArrowDownTrayIcon,
  ChevronDownIcon
} from '@heroicons/react/24/outline'
import { Card } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Link } from 'react-router-dom'
import { listProducts } from '../api/inventory'
import { listJobs } from '../api/production-jobs'
import { useMemo, useState } from 'react'
import { DashboardCharts } from '../components/dashboard/DashboardCharts'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'

export function Dashboard() {
  const { workspaceId } = useSessionStore()
  const [isExporting, setIsExporting] = useState(false)
  const [showKPIs, setShowKPIs] = useState(false)

  // Fetch products
  const { data: products = [], isLoading: productsLoading } = useQuery({
    queryKey: ['products', workspaceId],
    queryFn: () => listProducts(workspaceId!),
    enabled: !!workspaceId,
  })

  // Fetch jobs
  const { data: jobsData, isLoading: jobsLoading } = useQuery({
    queryKey: ['jobs', workspaceId],
    queryFn: () => listJobs(workspaceId!),
    enabled: !!workspaceId,
  })
  const jobs = jobsData?.jobs || []

  // Calculate statistics
  const stats = useMemo(() => {
    if (!workspaceId) {
      return {
        totalProducts: 0,
        lowStockProducts: 0,
        outOfStockProducts: 0,
        activeJobs: 0,
        completedToday: 0,
        delayedJobs: 0,
        totalStockValue: 0,
        jobsByStatus: { active: 0, in_progress: 0, done: 0, blocked: 0 },
        recentJobs: [],
        recentLowStock: [],
        topValueProducts: [],
        onTimeRate: 100,
      }
    }

    const totalProducts = products.length
    // Low stock: qtyOnHand <= reorderPoint (but reorderPoint must be > 0)
    const lowStockProducts = products.filter(p => {
      const qty = p.qtyOnHand || 0
      const reorderPoint = p.reorderPoint || 0
      return reorderPoint > 0 && qty <= reorderPoint
    }).length
    const outOfStockProducts = products.filter(p => (p.qtyOnHand || 0) <= 0).length

    // Active jobs: in_progress or released (not done, blocked, or cancelled)
    const activeJobs = jobs.filter(j =>
      j.status === 'in_progress' || j.status === 'released'
    ).length

    const completedToday = jobs.filter(j => {
      if (j.status !== 'done') return false
      const completedAt = (j as any).completedAt
      if (!completedAt) return false
      try {
        const completedDate = completedAt.toDate ? completedAt.toDate() : new Date(completedAt)
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        completedDate.setHours(0, 0, 0, 0)
        return completedDate.getTime() === today.getTime()
      } catch {
        return false
      }
    }).length

    const delayedJobs = jobs.filter(j => {
      if (j.status === 'done' || j.status === 'cancelled') return false
      const dueDate = (j as any).dueDate
      if (!dueDate) return false
      try {
        const due = dueDate.toDate ? dueDate.toDate() : new Date(dueDate)
        const now = new Date()
        now.setHours(0, 0, 0, 0)
        due.setHours(0, 0, 0, 0)
        return due < now
      } catch {
        return false
      }
    }).length

    const totalStockValue = products.reduce((sum, p) => {
      const qty = p.qtyOnHand || 0
      const cost = (p as any).pricePerBox || 0
      return sum + (qty * cost)
    }, 0)

    const jobsByStatus = {
      active: jobs.filter(j => j.status === 'released').length,
      in_progress: jobs.filter(j => j.status === 'in_progress').length,
      done: jobs.filter(j => j.status === 'done').length,
      blocked: jobs.filter(j => j.status === 'blocked').length,
    }

    // Recent activity - get recent jobs sorted by updatedAt
    const recentJobs = [...jobs]
      .filter(j => j.updatedAt) // Only jobs with updatedAt
      .sort((a, b) => {
        try {
          const aTime = (a as any).updatedAt?.toDate ? (a as any).updatedAt.toDate().getTime() :
            (a as any).updatedAt?.seconds ? (a as any).updatedAt.seconds * 1000 : 0
          const bTime = (b as any).updatedAt?.toDate ? (b as any).updatedAt.toDate().getTime() :
            (b as any).updatedAt?.seconds ? (b as any).updatedAt.seconds * 1000 : 0
          return bTime - aTime
        } catch {
          return 0
        }
      })
      .slice(0, 5)

    const recentLowStock = products
      .filter(p => {
        const qty = p.qtyOnHand || 0
        const reorderPoint = p.reorderPoint || 0
        return reorderPoint > 0 && qty <= reorderPoint
      })
      .sort((a, b) => (a.qtyOnHand || 0) - (b.qtyOnHand || 0))
      .slice(0, 5)

    const topValueProducts = products
      .map(p => ({
        ...p,
        totalValue: (p.qtyOnHand || 0) * ((p as any).pricePerBox || 0)
      }))
      .sort((a, b) => b.totalValue - a.totalValue)
      .slice(0, 5)

    const completedJobs = jobs.filter(j => j.status === 'done')
    const onTimeJobs = completedJobs.filter(j => {
      const completedAt = (j as any).completedAt
      const dueDate = (j as any).dueDate
      if (!completedAt || !dueDate) return true
      try {
        const c = completedAt.toDate ? completedAt.toDate() : new Date(completedAt)
        const d = dueDate.toDate ? dueDate.toDate() : new Date(dueDate)
        // Compare dates (ignoring time for due date usually, but let's keep it simple)
        return c.getTime() <= d.getTime()
      } catch { return true }
    })
    const onTimeRate = completedJobs.length > 0 ? Math.round((onTimeJobs.length / completedJobs.length) * 100) : 100

    return {
      totalProducts,
      lowStockProducts,
      outOfStockProducts,
      activeJobs,
      completedToday,
      delayedJobs,
      totalStockValue,
      jobsByStatus,
      recentJobs,
      recentLowStock,
      topValueProducts,
      onTimeRate,
    }
  }, [products, jobs, workspaceId])

  const isLoading = productsLoading || jobsLoading

  // Format currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  }

  // Format time ago
  const timeAgo = (date: Date | any) => {
    if (!date) return 'Unknown'
    const d = date.toDate ? date.toDate() : new Date(date)
    const now = new Date()
    const diff = now.getTime() - d.getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)

    if (minutes < 1) return 'Just now'
    if (minutes < 60) return `${minutes}m ago`
    if (hours < 24) return `${hours}h ago`
    if (days < 7) return `${days}d ago`
    return d.toLocaleDateString()
  }

  const handleExportPDF = async () => {
    setIsExporting(true)
    const dashboardElement = document.getElementById('dashboard-content')

    if (dashboardElement) {
      try {
        const canvas = await html2canvas(dashboardElement, {
          scale: 2, // Higher resolution
          backgroundColor: '#f9fafb', // Match bg-gray-50
          ignoreElements: (element) => element.classList.contains('no-print') // Ignore elements with no-print class
        })

        const imgData = canvas.toDataURL('image/png')
        const pdf = new jsPDF('p', 'mm', 'a4')
        const pdfWidth = pdf.internal.pageSize.getWidth()
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width

        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight)
        pdf.save(`dashboard-report-${new Date().toISOString().split('T')[0]}.pdf`)
      } catch (error) {
        console.error('Failed to export PDF', error)
      }
    }
    setIsExporting(false)
  }

  return (
    <div className="space-y-8" id="dashboard-content">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500">
            Overview of your inventory performance and daily operations.
          </p>
        </div>
        <div className="flex items-center gap-3 no-print">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleExportPDF}
            disabled={isExporting}
          >
            <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
            {isExporting ? 'Exporting...' : 'Export Report'}
          </Button>
          <Link to="/production">
            <Button variant="secondary" size="sm">
              View Production
            </Button>
          </Link>
          <Link to="/inventory">
            <Button variant="primary" size="sm">
              Manage Inventory
            </Button>
          </Link>
        </div>
      </div>

      {/* Primary Stats Grid */}
      <div className="space-y-4">
        {/* Mobile KPI Toggle Button */}
        <div className="sm:hidden">
          <button
            onClick={() => setShowKPIs(!showKPIs)}
            className="w-full flex items-center justify-between p-4 bg-white rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            <span className="text-sm font-medium text-gray-700">View KPIs</span>
            <ChevronDownIcon className={`h-5 w-5 text-gray-500 transition-transform ${showKPIs ? 'rotate-180' : ''}`} />
          </button>
        </div>
        
        {/* KPI Cards - Hidden on mobile by default */}
        <div className={`grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 ${showKPIs ? '' : 'hidden sm:grid'}`}>
        {/* Total Products */}
        <Card className="relative overflow-hidden border-l-4 border-l-primary-500">
          <div className="p-1">
            <div className="flex items-center justify-between">
              <p className="truncate text-sm font-medium text-gray-500">Total Products</p>
              <div className="rounded-md bg-primary-50 p-2">
                <CubeIcon className="h-5 w-5 text-primary-600" aria-hidden="true" />
              </div>
            </div>
            <div className="mt-4 flex items-baseline">
              {isLoading ? (
                <div className="h-8 w-16 animate-pulse bg-gray-200 rounded" />
              ) : (
                <p className="text-3xl font-semibold text-gray-900">{stats.totalProducts}</p>
              )}
            </div>
            <div className="mt-1">
              <p className="text-xs text-gray-500">Active SKUs in catalog</p>
            </div>
          </div>
        </Card>

        {/* Low Stock */}
        <Card className={`relative overflow-hidden border-l-4 ${stats.lowStockProducts > 0 ? 'border-l-amber-500' : 'border-l-green-500'}`}>
          <div className="p-1">
            <div className="flex items-center justify-between">
              <p className="truncate text-sm font-medium text-gray-500">Low Stock Items</p>
              <div className={`rounded-md p-2 ${stats.lowStockProducts > 0 ? 'bg-amber-50' : 'bg-green-50'}`}>
                <ExclamationTriangleIcon className={`h-5 w-5 ${stats.lowStockProducts > 0 ? 'text-amber-600' : 'text-green-600'}`} aria-hidden="true" />
              </div>
            </div>
            <div className="mt-4 flex items-baseline">
              {isLoading ? (
                <div className="h-8 w-16 animate-pulse bg-gray-200 rounded" />
              ) : (
                <>
                  <p className="text-3xl font-semibold text-gray-900">{stats.lowStockProducts}</p>
                  {stats.outOfStockProducts > 0 && (
                    <span className="ml-2 text-sm font-medium text-red-600">
                      ({stats.outOfStockProducts} out)
                    </span>
                  )}
                </>
              )}
            </div>
            <div className="mt-1">
              <p className="text-xs text-gray-500">Items below reorder point</p>
            </div>
          </div>
        </Card>

        {/* Active Jobs */}
        <Card className="relative overflow-hidden border-l-4 border-l-blue-500">
          <div className="p-1">
            <div className="flex items-center justify-between">
              <p className="truncate text-sm font-medium text-gray-500">Active Jobs</p>
              <div className="rounded-md bg-blue-50 p-2">
                <CogIcon className="h-5 w-5 text-blue-600" aria-hidden="true" />
              </div>
            </div>
            <div className="mt-4 flex items-baseline">
              {isLoading ? (
                <div className="h-8 w-16 animate-pulse bg-gray-200 rounded" />
              ) : (
                <>
                  <p className="text-3xl font-semibold text-gray-900">{stats.activeJobs}</p>
                  {stats.delayedJobs > 0 && (
                    <span className="ml-2 text-sm font-medium text-red-600">
                      ({stats.delayedJobs} delayed)
                    </span>
                  )}
                </>
              )}
            </div>
            <div className="mt-1">
              <p className="text-xs text-gray-500">In progress & released</p>
            </div>
          </div>
        </Card>

        {/* Total Value */}
        <Card className="relative overflow-hidden border-l-4 border-l-emerald-500">
          <div className="p-1">
            <div className="flex items-center justify-between">
              <p className="truncate text-sm font-medium text-gray-500">Inventory Value</p>
              <div className="rounded-md bg-emerald-50 p-2">
                <ChartBarIcon className="h-5 w-5 text-emerald-600" aria-hidden="true" />
              </div>
            </div>
            <div className="mt-4 flex items-baseline">
              {isLoading ? (
                <div className="h-8 w-24 animate-pulse bg-gray-200 rounded" />
              ) : (
                <p className="text-3xl font-semibold text-gray-900">{formatCurrency(stats.totalStockValue)}</p>
              )}
            </div>
            <div className="mt-1">
              <p className="text-xs text-gray-500">Total asset value</p>
            </div>
          </div>
        </Card>
        </div>
      </div>

      {/* Charts Section */}
      <DashboardCharts jobs={jobs} isLoading={isLoading} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main Content Area - 2/3 width */}
        <div className="lg:col-span-2 space-y-6">
          {/* Recent Activity Table */}
          <Card noPadding className="overflow-hidden">
            <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between bg-gray-50/50">
              <h3 className="text-base font-semibold leading-6 text-gray-900">Recent Production Activity</h3>
              <Link to="/production" className="text-sm font-medium text-primary-600 hover:text-primary-700 no-print">
                View All
              </Link>
            </div>
            {isLoading ? (
              <div className="p-6 space-y-4">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="h-12 animate-pulse bg-gray-100 rounded" />
                ))}
              </div>
            ) : stats.recentJobs.length === 0 ? (
              <div className="p-12 text-center text-gray-500">
                <p>No recent activity found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Job / Product</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Updated</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {stats.recentJobs.map((job) => {
                      const updatedAt = (job as any).updatedAt
                      const statusColor = job.status === 'done' ? 'success' :
                        job.status === 'blocked' ? 'warning' :
                          job.status === 'in_progress' ? 'primary' :
                            job.status === 'released' ? 'neutral' : 'neutral'

                      const jobTitle = job.productName || job.code || `Job ${job.id.slice(0, 8)}`
                      const jobSubtitle = job.code && job.productName ? job.code : job.customer?.name || ''

                      return (
                        <tr key={job.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex flex-col">
                              <span className="text-sm font-medium text-gray-900">{jobTitle}</span>
                              {jobSubtitle && <span className="text-xs text-gray-500">{jobSubtitle}</span>}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <Badge variant={statusColor as any} size="sm">
                              {job.status.replace('_', ' ')}
                            </Badge>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-500">
                            {timeAgo(updatedAt)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* Top Value Products */}
          <Card noPadding className="overflow-hidden">
            <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between bg-gray-50/50">
              <h3 className="text-base font-semibold leading-6 text-gray-900">Top Value Products</h3>
              <Link to="/inventory" className="text-sm font-medium text-primary-600 hover:text-primary-700 no-print">
                View Inventory
              </Link>
            </div>
            {isLoading ? (
              <div className="p-6 space-y-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-12 animate-pulse bg-gray-100 rounded" />
                ))}
              </div>
            ) : stats.topValueProducts.length === 0 ? (
              <div className="p-12 text-center text-gray-500">
                <p>No products found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                      <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Qty</th>
                      <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total Value</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {stats.topValueProducts.map((product) => {
                      // Clean product name to fix encoding issues (question marks)
                      let productName = product.name || product.sku || 'Unknown Product'
                      productName = productName
                        .replace(/\uFFFD/g, "'")
                        .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
                        .replace(/'/g, "'")
                        .replace(/"/g, '"')
                        .replace(/"/g, '"')
                        .replace(/–/g, '-')
                        .replace(/—/g, '-')
                        .trim()

                      return (
                        <tr key={product.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex flex-col">
                              <span className="text-sm font-medium text-gray-900">{productName}</span>
                              <span className="text-xs text-gray-500">{product.sku}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-500">
                            {product.qtyOnHand} {product.uom}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-gray-900">
                            {formatCurrency(product.totalValue)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* Quick Actions Bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 no-print">
            <Link to="/production?action=new" className="group">
              <div className="flex flex-col items-center justify-center p-4 bg-white rounded-xl border border-gray-200 shadow-sm hover:border-primary-300 hover:shadow-md transition-all cursor-pointer h-full">
                <div className="p-2 rounded-full bg-primary-50 group-hover:bg-primary-100 transition-colors mb-3">
                  <CogIcon className="h-6 w-6 text-primary-600" />
                </div>
                <span className="text-sm font-medium text-gray-900">New Job</span>
              </div>
            </Link>
            <Link to="/inventory?action=new" className="group">
              <div className="flex flex-col items-center justify-center p-4 bg-white rounded-xl border border-gray-200 shadow-sm hover:border-primary-300 hover:shadow-md transition-all cursor-pointer h-full">
                <div className="p-2 rounded-full bg-blue-50 group-hover:bg-blue-100 transition-colors mb-3">
                  <CubeIcon className="h-6 w-6 text-blue-600" />
                </div>
                <span className="text-sm font-medium text-gray-900">Add Product</span>
              </div>
            </Link>
            <Link to="/production/calendar" className="group">
              <div className="flex flex-col items-center justify-center p-4 bg-white rounded-xl border border-gray-200 shadow-sm hover:border-primary-300 hover:shadow-md transition-all cursor-pointer h-full">
                <div className="p-2 rounded-full bg-purple-50 group-hover:bg-purple-100 transition-colors mb-3">
                  <CalendarIcon className="h-6 w-6 text-purple-600" />
                </div>
                <span className="text-sm font-medium text-gray-900">Schedule</span>
              </div>
            </Link>
            <Link to="/reports" className="group">
              <div className="flex flex-col items-center justify-center p-4 bg-white rounded-xl border border-gray-200 shadow-sm hover:border-primary-300 hover:shadow-md transition-all cursor-pointer h-full">
                <div className="p-2 rounded-full bg-emerald-50 group-hover:bg-emerald-100 transition-colors mb-3">
                  <ChartBarIcon className="h-6 w-6 text-emerald-600" />
                </div>
                <span className="text-sm font-medium text-gray-900">Analytics</span>
              </div>
            </Link>
          </div>
        </div>

        {/* Sidebar Area - 1/3 width */}
        <div className="space-y-6">
          {/* Performance Metrics */}
          <Card className="bg-white">
            <h3 className="text-base font-semibold text-gray-900 mb-4">Performance Metrics</h3>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-500">On-Time Delivery</span>
                  <span className={`font-medium ${stats.onTimeRate >= 90 ? 'text-green-600' : stats.onTimeRate >= 75 ? 'text-amber-600' : 'text-red-600'}`}>
                    {stats.onTimeRate}%
                  </span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${stats.onTimeRate >= 90 ? 'bg-green-500' : stats.onTimeRate >= 75 ? 'bg-amber-500' : 'bg-red-500'}`}
                    style={{ width: `${stats.onTimeRate}%` }}
                  ></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-500">Jobs Completed Today</span>
                  <span className="font-medium text-gray-900">{stats.completedToday}</span>
                </div>
              </div>
            </div>
          </Card>

          {/* Low Stock Widget */}
          <Card noPadding className="h-full flex flex-col">
            <div className="border-b border-gray-200 px-6 py-4 bg-gray-50/50">
              <h3 className="text-base font-semibold leading-6 text-gray-900">Inventory Alerts</h3>
            </div>
            <div className="flex-1">
              {isLoading ? (
                <div className="p-6 space-y-4">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-10 animate-pulse bg-gray-100 rounded" />
                  ))}
                </div>
              ) : stats.recentLowStock.length === 0 ? (
                <div className="p-8 text-center text-gray-500 flex flex-col items-center justify-center h-full">
                  <CheckCircleIcon className="h-10 w-10 text-green-400 mb-2" />
                  <p className="text-sm">Stock levels are healthy</p>
                </div>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {stats.recentLowStock.map((product) => {
                    const qty = product.qtyOnHand || 0
                    const isOutOfStock = qty <= 0

                    let productName = product.name || product.sku || 'Unknown Product'
                    productName = productName
                      .replace(/\uFFFD/g, "'")
                      .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
                      .replace(/'/g, "'")
                      .replace(/"/g, '"')
                      .replace(/"/g, '"')
                      .replace(/–/g, '-')
                      .replace(/—/g, '-')
                      .trim()

                    return (
                      <li key={product.id} className="px-6 py-3 hover:bg-gray-50 transition-colors">
                        <div className="flex items-center justify-between">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-gray-900 truncate">{productName}</p>
                            <p className="text-xs text-gray-500">
                              {qty} {product.uom} remaining
                            </p>
                          </div>
                          <Badge variant={isOutOfStock ? 'danger' : 'warning'} size="sm" className="ml-2">
                            {isOutOfStock ? 'Empty' : 'Low'}
                          </Badge>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
            <div className="border-t border-gray-200 p-4 bg-gray-50/50">
              <Link to="/inventory" className="text-sm font-medium text-primary-600 hover:text-primary-700 flex items-center justify-center no-print">
                View Inventory Report
              </Link>
            </div>
          </Card>

          {/* Job Status Summary */}
          <Card className="bg-gradient-to-br from-primary-900 to-primary-800 text-white border-none">
            <h3 className="text-base font-semibold text-white mb-4">Job Status Overview</h3>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-primary-100">Active</span>
                  <span className="font-medium">{stats.jobsByStatus.active}</span>
                </div>
                <div className="w-full bg-primary-950/50 rounded-full h-2">
                  <div className="bg-blue-400 h-2 rounded-full" style={{ width: `${Math.min((stats.jobsByStatus.active / (jobs.length || 1)) * 100, 100)}%` }}></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-primary-100">In Progress</span>
                  <span className="font-medium">{stats.jobsByStatus.in_progress}</span>
                </div>
                <div className="w-full bg-primary-950/50 rounded-full h-2">
                  <div className="bg-primary-400 h-2 rounded-full" style={{ width: `${Math.min((stats.jobsByStatus.in_progress / (jobs.length || 1)) * 100, 100)}%` }}></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-primary-100">Completed</span>
                  <span className="font-medium">{stats.jobsByStatus.done}</span>
                </div>
                <div className="w-full bg-primary-950/50 rounded-full h-2">
                  <div className="bg-emerald-400 h-2 rounded-full" style={{ width: `${Math.min((stats.jobsByStatus.done / (jobs.length || 1)) * 100, 100)}%` }}></div>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
