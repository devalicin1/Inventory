import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSessionStore } from '../state/sessionStore'
import {
  CubeIcon,
  CogIcon,
  ChartBarIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PlusIcon,
  MinusIcon,
  ArrowPathIcon,
  ArrowDownTrayIcon,
  ArrowUpTrayIcon
} from '@heroicons/react/24/outline'
import { Card } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Link } from 'react-router-dom'
import { listProducts, listAllStockTxns, getProductOnHand } from '../api/inventory'
import { listJobs, subscribeToJobs, listWorkflows } from '../api/production-jobs'
import { subscribeToProducts, listGroups, type Group } from '../api/products'
import { getDoc, doc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useMemo, useState, useEffect } from 'react'
import { PageShell } from '../components/layout/PageShell'
import { ConfigurationBanner } from '../components/onboarding/ConfigurationBanner'
import { Skeleton, SkeletonCard } from '../components/ui/Skeleton'

export function Dashboard() {
  const { workspaceId } = useSessionStore()
  const [showKPIs, setShowKPIs] = useState(false)
  const [txnCurrentPage, setTxnCurrentPage] = useState(1)
  const queryClient = useQueryClient()
  const TXNS_PER_PAGE = 5

  // Fetch products (initial load)
  const { data: products = [], isLoading: productsLoading } = useQuery({
    queryKey: ['products', workspaceId],
    queryFn: async () => {
      const productsList = await listProducts(workspaceId!)
      // Ensure qtyOnHand is recalculated from transactions for accuracy
      const productsWithStock = await Promise.all(
        productsList.map(async (product) => {
          const onHand = await getProductOnHand(workspaceId!, product.id)
          return {
            ...product,
            qtyOnHand: onHand,
          }
        })
      )
      return productsWithStock
    },
    enabled: !!workspaceId,
    staleTime: 30000, // 30 seconds - allow refetch to get updated stock
  })

  // Fetch jobs (initial load)
  const { data: jobsData, isLoading: jobsLoading } = useQuery({
    queryKey: ['jobs', workspaceId],
    queryFn: () => listJobs(workspaceId!),
    enabled: !!workspaceId,
    staleTime: Infinity, // Don't refetch - we use real-time subscription
  })
  const jobs = jobsData?.jobs || []

  // Fetch workflows for stage names
  const { data: workflows = [] } = useQuery({
    queryKey: ['workflows', workspaceId],
    queryFn: () => listWorkflows(workspaceId!),
    enabled: !!workspaceId,
    staleTime: 60000, // 1 minute
  })

  // Fetch groups for organizing inventory alerts
  const { data: groups = [] } = useQuery<Group[]>({
    queryKey: ['groups', workspaceId],
    queryFn: () => listGroups(workspaceId!),
    enabled: !!workspaceId,
  })

  // Fetch recent stock transactions
  const { data: stockTxns = [], isLoading: txnsLoading } = useQuery({
    queryKey: ['stockTxns', workspaceId],
    queryFn: () => listAllStockTxns(workspaceId!, 50),
    enabled: !!workspaceId,
    staleTime: 30000, // 30 seconds
    refetchInterval: 10000, // Refetch every 10 seconds to catch new transactions
  })

  // Paginate transactions
  const paginatedTxns = useMemo(() => {
    const startIndex = (txnCurrentPage - 1) * TXNS_PER_PAGE
    const endIndex = startIndex + TXNS_PER_PAGE
    return stockTxns.slice(startIndex, endIndex)
  }, [stockTxns, txnCurrentPage])

  const totalTxnPages = Math.ceil(stockTxns.length / TXNS_PER_PAGE)

  // Reset to page 1 when transactions change
  useEffect(() => {
    if (txnCurrentPage > totalTxnPages && totalTxnPages > 0) {
      setTxnCurrentPage(1)
    }
  }, [stockTxns.length, txnCurrentPage, totalTxnPages])

  // When stock transactions change, invalidate products to recalculate qtyOnHand
  useEffect(() => {
    if (stockTxns.length > 0) {
      queryClient.invalidateQueries({ queryKey: ['products', workspaceId] })
    }
  }, [stockTxns.length, workspaceId, queryClient])

  // Fetch user names for transactions
  const userIds = useMemo(() => {
    const uniqueUserIds = [...new Set(stockTxns.map(t => t.userId).filter(Boolean))]
    return uniqueUserIds
  }, [stockTxns])

  const { data: userNames = {} } = useQuery({
    queryKey: ['userNames', workspaceId, userIds],
    queryFn: async () => {
      const names: Record<string, string> = {}
      for (const userId of userIds) {
        if (!userId || userId === 'system' || userId === 'anonymous') {
          names[userId] = userId === 'system' ? 'System' : 'Anonymous'
          continue
        }
        try {
          const userDoc = await getDoc(doc(db, 'users', userId))
          if (userDoc.exists()) {
            const userData = userDoc.data()
            names[userId] = userData.displayName || userData.email || userId
          } else {
            names[userId] = userId
          }
        } catch (error) {
          console.error(`Error fetching user ${userId}:`, error)
          names[userId] = userId
        }
      }
      return names
    },
    enabled: userIds.length > 0 && !!workspaceId,
  })

  // Real-time subscription for products
  useEffect(() => {
    if (!workspaceId) return
    const unsubscribe = subscribeToProducts(
      workspaceId,
      async (updatedProducts) => {
        // Recalculate qtyOnHand for all products when products change
        const productsWithUpdatedStock = await Promise.all(
          updatedProducts.map(async (product) => {
            const onHand = await getProductOnHand(workspaceId, product.id)
            return {
              ...product,
              qtyOnHand: onHand,
            }
          })
        )
        queryClient.setQueryData(['products', workspaceId], productsWithUpdatedStock)
      }
    )
    return () => unsubscribe()
  }, [workspaceId, queryClient])

  // Real-time subscription for jobs
  useEffect(() => {
    if (!workspaceId) return
    const unsubscribe = subscribeToJobs(
      workspaceId,
      (updatedJobs) => {
        queryClient.setQueryData(['jobs', workspaceId], { jobs: updatedJobs })
      }
    )
    return () => unsubscribe()
  }, [workspaceId, queryClient])

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
        lowStockByGroup: {},
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

    // Group low stock products by folder (group)
    const lowStockProductsList = products.filter(p => {
      const qty = p.qtyOnHand || 0
      const reorderPoint = p.reorderPoint || 0
      return reorderPoint > 0 && qty <= reorderPoint
    }).sort((a, b) => (a.qtyOnHand || 0) - (b.qtyOnHand || 0))

    // Group by folder and take top 5 from each
    const lowStockByGroup: Record<string, typeof lowStockProductsList> = {}
    lowStockProductsList.forEach(product => {
      const groupId = (product as any).groupId || 'unassigned'
      if (!lowStockByGroup[groupId]) {
        lowStockByGroup[groupId] = []
      }
      if (lowStockByGroup[groupId].length < 5) {
        lowStockByGroup[groupId].push(product)
      }
    })

    const recentLowStock = lowStockProductsList.slice(0, 5) // Keep for backward compatibility

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
        lowStockByGroup,
        topValueProducts,
        onTimeRate,
      }
    }, [products, jobs, workspaceId])

  const isLoading = productsLoading || jobsLoading

  // Format currency with compact notation for large numbers
  const formatCurrency = (value: number) => {
    if (value >= 1000000000) {
      // Billions
      const billions = value / 1000000000
      return `$${(billions).toFixed(1)}B`
    } else if (value >= 1000000) {
      // Millions
      const millions = value / 1000000
      return `$${(millions).toFixed(1)}M`
    } else if (value >= 1000) {
      // Thousands
      const thousands = value / 1000
      return `$${(thousands).toFixed(1)}K`
    } else {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(value)
    }
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

  return (
    <PageShell
      title="Dashboard"
      subtitle="Overview of your inventory performance and daily operations."
      actions={
        <div className="flex flex-row items-center gap-2 sm:gap-3 no-print">
          <Link to="/production" className="flex-1 sm:flex-none">
            <Button variant="secondary" size="md" className="w-full sm:w-auto">
              View Production
            </Button>
          </Link>
          <Link to="/inventory" className="flex-1 sm:flex-none">
            <Button variant="secondary" size="md" className="w-full sm:w-auto">
              Manage Inventory
            </Button>
          </Link>
        </div>
      }
    >
      {/* Onboarding Banner */}
      <ConfigurationBanner showOnlyCritical={false} />

      {/* Primary Stats Grid */}
      <div>
        {/* Mobile KPI Toggle Button */}
        <div className="sm:hidden">
          <button
            onClick={() => setShowKPIs(!showKPIs)}
            className="w-full flex items-center justify-between p-3 bg-white rounded-[14px] border border-gray-200 hover:bg-gray-50 transition-colors h-11"
          >
            <span className="text-sm font-medium text-gray-700">View KPIs</span>
            <ChevronDownIcon className={`h-5 w-5 text-gray-500 transition-transform ${showKPIs ? 'rotate-180' : ''}`} />
          </button>
        </div>
        
        {/* KPI Cards - more compact on mobile */}
        <div
          className={`mt-3 grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4 ${
            showKPIs ? '' : 'hidden sm:grid'
          }`}
        >
        {/* Total Products */}
        <Card className="relative overflow-hidden border-l-4 border-l-primary-500">
          <div className="p-2.5 sm:p-4">
            <div className="flex items-center justify-between gap-1">
              <p className="truncate text-[11px] sm:text-sm font-medium text-gray-500">Total Products</p>
              <div className="rounded-md bg-primary-50 p-1.5 sm:p-2 shrink-0">
                <CubeIcon className="h-4 w-4 sm:h-5 sm:w-5 text-primary-600" aria-hidden="true" />
              </div>
            </div>
            <div className="mt-2 sm:mt-3 flex items-baseline">
              {isLoading ? (
                <Skeleton height={32} width={64} />
              ) : (
                <p className="text-xl sm:text-3xl font-semibold text-gray-900">{stats.totalProducts}</p>
              )}
            </div>
            <div className="mt-1 hidden sm:block">
              <p className="text-xs text-gray-500">Active SKUs in catalog</p>
            </div>
          </div>
        </Card>

        {/* Low Stock */}
        <Card className={`relative overflow-hidden border-l-4 ${stats.lowStockProducts > 0 ? 'border-l-amber-500' : 'border-l-green-500'}`}>
          <div className="p-2.5 sm:p-4">
            <div className="flex items-center justify-between gap-1">
              <p className="truncate text-[11px] sm:text-sm font-medium text-gray-500">Low Stock Items</p>
              <div className={`rounded-md p-1.5 sm:p-2 shrink-0 ${stats.lowStockProducts > 0 ? 'bg-amber-50' : 'bg-green-50'}`}>
                <ExclamationTriangleIcon className={`h-4 w-4 sm:h-5 sm:w-5 ${stats.lowStockProducts > 0 ? 'text-amber-600' : 'text-green-600'}`} aria-hidden="true" />
              </div>
            </div>
            <div className="mt-2 sm:mt-3 flex items-baseline">
              {isLoading ? (
                <div className="h-6 sm:h-8 w-14 sm:w-16 animate-pulse bg-gray-200 rounded" />
              ) : (
                <>
                  <p className="text-xl sm:text-3xl font-semibold text-gray-900">{stats.lowStockProducts}</p>
                  {stats.outOfStockProducts > 0 && (
                    <span className="ml-1.5 text-[11px] sm:text-sm font-medium text-red-600">
                      ({stats.outOfStockProducts} out)
                    </span>
                  )}
                </>
              )}
            </div>
            <div className="mt-1 hidden sm:block">
              <p className="text-xs text-gray-500">Items below reorder point</p>
            </div>
          </div>
        </Card>

        {/* Active Jobs */}
        <Card className="relative overflow-hidden border-l-4 border-l-blue-500">
          <div className="p-2.5 sm:p-4">
            <div className="flex items-center justify-between gap-1">
              <p className="truncate text-[11px] sm:text-sm font-medium text-gray-500">Active Jobs</p>
              <div className="rounded-md bg-blue-50 p-1.5 sm:p-2 shrink-0">
                <CogIcon className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" aria-hidden="true" />
              </div>
            </div>
            <div className="mt-2 sm:mt-3 flex items-baseline">
              {isLoading ? (
                <div className="h-6 sm:h-8 w-14 sm:w-16 animate-pulse bg-gray-200 rounded" />
              ) : (
                <>
                  <p className="text-xl sm:text-3xl font-semibold text-gray-900">{stats.activeJobs}</p>
                  {stats.delayedJobs > 0 && (
                    <span className="ml-1.5 text-[11px] sm:text-sm font-medium text-red-600">
                      ({stats.delayedJobs} delayed)
                    </span>
                  )}
                </>
              )}
            </div>
            <div className="mt-1 hidden sm:block">
              <p className="text-xs text-gray-500">In progress & released</p>
            </div>
          </div>
        </Card>

        {/* Total Value */}
        <Card className="relative overflow-hidden border-l-4 border-l-emerald-500">
          <div className="p-2.5 sm:p-4">
            <div className="flex items-center justify-between gap-1">
              <p className="truncate text-[11px] sm:text-sm font-medium text-gray-500">Inventory Value</p>
              <div className="rounded-md bg-emerald-50 p-1.5 sm:p-2 shrink-0">
                <ChartBarIcon className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-600" aria-hidden="true" />
              </div>
            </div>
            <div className="mt-2 sm:mt-3 flex items-baseline min-w-0">
              {isLoading ? (
                <div className="h-6 sm:h-8 w-20 sm:w-24 animate-pulse bg-gray-200 rounded" />
              ) : (
                <p className="text-base sm:text-2xl lg:text-3xl font-semibold text-gray-900 truncate break-words leading-tight">{formatCurrency(stats.totalStockValue)}</p>
              )}
            </div>
            <div className="mt-1 hidden sm:block">
              <p className="text-xs text-gray-500">Total asset value</p>
            </div>
          </div>
        </Card>
        </div>
      </div>

      {/* Recent Activity & Transaction Summary */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main Content Area - 2/3 width */}
        <div className="lg:col-span-2 space-y-6">
          {/* Recent Activity Table - Desktop */}
          <Card noPadding className="overflow-hidden hidden md:block">
            <div className="border-b border-gray-200 px-4 sm:px-6 h-11 flex items-center justify-between bg-gray-50/50">
              <h3 className="text-sm sm:text-base font-semibold leading-6 text-gray-900">Recent Production Activity</h3>
              <Link to="/production" className="text-xs sm:text-sm font-medium text-primary-600 hover:text-primary-700 no-print">
                View All
              </Link>
            </div>
            {isLoading ? (
              <div className="p-4 sm:p-6 space-y-4">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="h-12 animate-pulse bg-gray-100 rounded" />
                ))}
              </div>
            ) : stats.recentJobs.length === 0 ? (
              <div className="p-8 sm:p-12 text-center text-gray-500">
                <p className="text-sm">No recent activity found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-4 sm:px-6 h-11 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Job / Product</th>
                      <th scope="col" className="px-4 sm:px-6 h-11 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stage</th>
                      <th scope="col" className="px-4 sm:px-6 h-11 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th scope="col" className="px-4 sm:px-6 h-11 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Updated</th>
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

                      // Get stage name
                      const getStageName = (stageId: string | undefined) => {
                        if (!stageId) return '-'
                        for (const wf of workflows) {
                          const stage = wf.stages?.find((s: any) => s.id === stageId)
                          if (stage) return stage.name
                        }
                        return stageId
                      }
                      const stageName = job.status === 'draft' ? 'Draft' : 
                                       job.status === 'done' ? 'Done' : 
                                       getStageName((job as any).currentStageId)

                      return (
                        <tr key={job.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                            <div className="flex flex-col">
                              <span className="text-sm font-medium text-gray-900">{jobTitle}</span>
                              {jobSubtitle && <span className="text-xs text-gray-500">{jobSubtitle}</span>}
                            </div>
                          </td>
                          <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            {stageName}
                          </td>
                          <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                            <Badge variant={statusColor as any} size="sm">
                              {job.status.replace('_', ' ')}
                            </Badge>
                          </td>
                          <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-right text-sm text-gray-500">
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

          {/* Recent Activity Cards - Mobile */}
          <Card noPadding className="overflow-hidden md:hidden">
            <div className="border-b border-gray-200 px-4 h-11 flex items-center justify-between bg-gray-50/50">
              <h3 className="text-sm font-semibold leading-6 text-gray-900">Recent Production Activity</h3>
              <Link to="/production" className="text-xs font-medium text-primary-600 hover:text-primary-700 no-print">
                View All
              </Link>
            </div>
            {isLoading ? (
              <div className="p-4 space-y-3">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="h-20 animate-pulse bg-gray-100 rounded" />
                ))}
              </div>
            ) : stats.recentJobs.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <p className="text-sm">No recent activity found</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {stats.recentJobs.map((job) => {
                  const updatedAt = (job as any).updatedAt
                  const statusColor = job.status === 'done' ? 'success' :
                    job.status === 'blocked' ? 'warning' :
                      job.status === 'in_progress' ? 'primary' :
                        job.status === 'released' ? 'neutral' : 'neutral'

                  const jobTitle = job.productName || job.code || `Job ${job.id.slice(0, 8)}`
                  const jobSubtitle = job.code && job.productName ? job.code : job.customer?.name || ''

                  // Get stage name
                  const getStageName = (stageId: string | undefined) => {
                    if (!stageId) return '-'
                    for (const wf of workflows) {
                      const stage = wf.stages?.find((s: any) => s.id === stageId)
                      if (stage) return stage.name
                    }
                    return stageId
                  }
                  const stageName = job.status === 'draft' ? 'Draft' : 
                                   job.status === 'done' ? 'Done' : 
                                   getStageName((job as any).currentStageId)

                  return (
                    <div key={job.id} className="p-4 hover:bg-gray-50 transition-colors">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-gray-900 truncate">{jobTitle}</span>
                            {jobSubtitle && <span className="text-xs text-gray-500 mt-0.5">{jobSubtitle}</span>}
                            <span className="text-xs text-gray-400 mt-0.5">Stage: {stageName}</span>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <Badge variant={statusColor as any} size="sm">
                            {job.status.replace('_', ' ')}
                          </Badge>
                          <span className="text-xs text-gray-500">{timeAgo(updatedAt)}</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </Card>

          {/* Transaction Summary */}
          <Card noPadding className="overflow-hidden">
            <div className="border-b border-gray-200 px-4 sm:px-6 h-11 flex items-center justify-between bg-gray-50/50">
              <h3 className="text-sm sm:text-base font-semibold leading-6 text-gray-900">Transaction Summary</h3>
            </div>
            {txnsLoading ? (
              <div className="p-4 sm:p-6 space-y-4">
                {[1, 2, 3, 4, 5].map(i => (
                  <div key={i} className="h-12 animate-pulse bg-gray-100 rounded" />
                ))}
              </div>
            ) : stockTxns.length === 0 ? (
              <div className="p-8 sm:p-12 text-center text-gray-500">
                <p className="text-sm">No recent transactions</p>
              </div>
            ) : (
              <>
                {/* Mobile Card View */}
                <div className="md:hidden p-4 space-y-3">
                  {paginatedTxns.map((txn) => {
                    const txnDate = txn.timestamp?.toDate ? txn.timestamp.toDate() : new Date(txn.timestamp)
                    const userName = userNames[txn.userId || ''] || txn.userId || 'Unknown'
                    
                    // Get product name
                    const product = products.find(p => p.id === txn.productId)
                    const productName = product?.name || product?.sku || txn.productId?.substring(0, 8) || 'Unknown Product'
                    const productSku = product?.sku || ''
                    
                    // Determine transaction type and styling
                    const isIn = ['Produce', 'Receive', 'Adjust+'].includes(txn.type)
                    const isOut = ['Consume', 'Ship', 'Adjust-'].includes(txn.type)
                    const isTransfer = txn.type === 'Transfer'
                    const qty = Math.abs(txn.qty || 0)
                    
                    // Get icon and colors
                    const getTransactionIcon = () => {
                      if (isIn) return <PlusIcon className="w-5 h-5 text-emerald-600" />
                      if (isOut) return <MinusIcon className="w-5 h-5 text-red-600" />
                      if (isTransfer) return <ArrowPathIcon className="w-5 h-5 text-blue-600" />
                      if (txn.type === 'Receive') return <ArrowDownTrayIcon className="w-5 h-5 text-emerald-600" />
                      if (txn.type === 'Ship') return <ArrowUpTrayIcon className="w-5 h-5 text-red-600" />
                      return <ArrowPathIcon className="w-5 h-5 text-gray-600" />
                    }
                    
                    const getBorderColor = () => {
                      if (isIn) return 'border-l-emerald-500'
                      if (isOut) return 'border-l-red-500'
                      if (isTransfer) return 'border-l-blue-500'
                      return 'border-l-gray-400'
                    }
                    
                    const getIconBg = () => {
                      if (isIn) return 'bg-emerald-100'
                      if (isOut) return 'bg-red-100'
                      if (isTransfer) return 'bg-blue-100'
                      return 'bg-gray-100'
                    }
                    
                    const getQtyColor = () => {
                      if (isIn) return 'text-emerald-600'
                      if (isOut) return 'text-red-600'
                      return 'text-gray-600'
                    }
                    
                    // Format transaction type
                    const getActionLabel = (type: string, qty: number) => {
                      const absQty = Math.abs(qty)
                      switch (type) {
                        case 'Produce':
                          return `Produced ${absQty} units`
                        case 'Consume':
                          return `Consumed ${absQty} units`
                        case 'Receive':
                          return `Received ${absQty} units`
                        case 'Ship':
                          return `Shipped ${absQty} units`
                        case 'Adjust+':
                          return `Stock increased by ${absQty} units`
                        case 'Adjust-':
                          return `Stock decreased by ${absQty} units`
                        case 'Transfer':
                          return `Transferred ${absQty} units`
                        case 'Count':
                          return `Stock count: ${absQty} units`
                        default:
                          return `${type} ${absQty} units`
                      }
                    }

                    const actionType = getActionLabel(txn.type, txn.qty || 0)

                    const handleCardClick = () => {
                      if (!txn.productId) return
                      window.location.href = `/inventory?productId=${txn.productId}`
                    }

                    return (
                      <div
                        key={txn.id}
                        onClick={handleCardClick}
                        className={`bg-white rounded-xl border-2 border-l-4 ${getBorderColor()} border-gray-100 overflow-hidden shadow-sm hover:shadow-md transition-all cursor-pointer active:scale-[0.98]`}
                      >
                        <div className="p-4">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <div className={`p-2 rounded-xl ${getIconBg()} flex-shrink-0`}>
                                {getTransactionIcon()}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className={`text-xl font-bold ${getQtyColor()}`}>
                                    {isIn ? '+' : isOut ? '-' : ''}{qty}
                                  </span>
                                  <span className="text-xs text-gray-500">units</span>
                                </div>
                                <p className="text-sm font-semibold text-gray-900 truncate">{productName}</p>
                                {productSku && (
                                  <p className="text-xs text-gray-500 truncate">{productSku}</p>
                                )}
                              </div>
                            </div>
                            <div className="text-right flex-shrink-0 ml-2">
                              <div className="text-xs font-semibold text-gray-900">
                                {txnDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                              </div>
                              <div className="text-xs text-gray-400">
                                {txnDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                              </div>
                            </div>
                          </div>

                          <div className="space-y-2 pt-2 border-t border-gray-100">
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-gray-500 font-medium">Action</span>
                              <span className="text-xs text-gray-700 font-semibold text-right">{actionType}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-gray-500 font-medium">User</span>
                              <span className="text-xs text-gray-700 font-semibold">{userName}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Desktop Table View */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th scope="col" className="px-4 sm:px-6 h-11 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                        <th scope="col" className="px-4 sm:px-6 h-11 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date & Time</th>
                        <th scope="col" className="px-4 sm:px-6 h-11 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {paginatedTxns.map((txn) => {
                        const txnDate = txn.timestamp?.toDate ? txn.timestamp.toDate() : new Date(txn.timestamp)
                        const userName = userNames[txn.userId || ''] || txn.userId || 'Unknown'
                        
                        // Get product name
                        const product = products.find(p => p.id === txn.productId)
                        const productName = product?.name || product?.sku || txn.productId?.substring(0, 8) || 'Unknown Product'
                        
                        // Format transaction type
                        const getActionLabel = (type: string, qty: number) => {
                          const absQty = Math.abs(qty)
                          switch (type) {
                            case 'Produce':
                              return `Produced ${absQty} units`
                            case 'Consume':
                              return `Consumed ${absQty} units`
                            case 'Receive':
                              return `Received ${absQty} units`
                            case 'Ship':
                              return `Shipped ${absQty} units`
                            case 'Adjust+':
                              return `Stock increased by ${absQty} units`
                            case 'Adjust-':
                              return `Stock decreased by ${absQty} units`
                            case 'Transfer':
                              return `Transferred ${absQty} units`
                            case 'Count':
                              return `Stock count: ${absQty} units`
                            default:
                              return `${type} ${absQty} units`
                          }
                        }

                        const actionType = getActionLabel(txn.type, txn.qty || 0)

                        const handleRowClick = () => {
                          if (!txn.productId) return
                          // Navigate to inventory with productId so that ProductDetails modal opens
                          window.location.href = `/inventory?productId=${txn.productId}`
                        }

                        return (
                          <tr
                            key={txn.id}
                            className="hover:bg-gray-50 transition-colors cursor-pointer"
                            onClick={handleRowClick}
                          >
                            <td className="px-4 sm:px-6 py-4">
                              <div className="flex flex-col">
                                <span className="text-sm font-medium text-gray-900">{productName}</span>
                                <span className="text-xs text-gray-500 mt-0.5">{actionType}</span>
                              </div>
                            </td>
                            <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {txnDate.toLocaleString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </td>
                            <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {userName}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                {/* Pagination */}
                {stockTxns.length > TXNS_PER_PAGE && (
                <div className="px-4 sm:px-6 py-3 border-t border-gray-200 flex items-center justify-between bg-gray-50/50">
                  <p className="text-xs sm:text-sm text-gray-500">
                    Showing <span className="font-medium text-gray-900">{(txnCurrentPage - 1) * TXNS_PER_PAGE + 1}</span> to <span className="font-medium text-gray-900">{Math.min(txnCurrentPage * TXNS_PER_PAGE, stockTxns.length)}</span> of <span className="font-medium text-gray-900">{stockTxns.length}</span> transactions
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setTxnCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={txnCurrentPage === 1}
                      className="px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                    >
                      <ChevronLeftIcon className="w-3 h-3 sm:w-4 sm:h-4" />
                      <span className="hidden sm:inline">Previous</span>
                    </button>

                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(5, totalTxnPages) }, (_, i) => {
                        let pageNum: number
                        if (totalTxnPages <= 5) {
                          pageNum = i + 1
                        } else if (txnCurrentPage <= 3) {
                          pageNum = i + 1
                        } else if (txnCurrentPage >= totalTxnPages - 2) {
                          pageNum = totalTxnPages - 4 + i
                        } else {
                          pageNum = txnCurrentPage - 2 + i
                        }

                        return (
                          <button
                            key={pageNum}
                            onClick={() => setTxnCurrentPage(pageNum)}
                            className={`px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm font-medium rounded-md ${txnCurrentPage === pageNum
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
                      onClick={() => setTxnCurrentPage(prev => Math.min(totalTxnPages, prev + 1))}
                      disabled={txnCurrentPage === totalTxnPages}
                      className="px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                    >
                      <span className="hidden sm:inline">Next</span>
                      <ChevronRightIcon className="w-3 h-3 sm:w-4 sm:h-4" />
                    </button>
                  </div>
                </div>
              )}
              </>
            )}
          </Card>
        </div>

        {/* Sidebar Area - 1/3 width */}
        <div>
          {/* Low Stock Widget */}
          <Card noPadding className="flex flex-col">
            <div className="border-b border-gray-200 px-4 sm:px-6 h-11 flex items-center bg-gray-50/50">
              <h3 className="text-sm sm:text-base font-semibold leading-6 text-gray-900">Inventory Alerts</h3>
            </div>
            <div className="flex-1 min-h-0">
              {isLoading ? (
                <div className="p-4 sm:p-6 space-y-3 sm:space-y-4">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-10 animate-pulse bg-gray-100 rounded" />
                  ))}
                </div>
              ) : Object.keys(stats.lowStockByGroup).length === 0 ? (
                <div className="p-6 sm:p-8 text-center text-gray-500 flex flex-col items-center justify-center h-full">
                  <CheckCircleIcon className="h-8 w-8 sm:h-10 sm:w-10 text-green-400 mb-2" />
                  <p className="text-xs sm:text-sm">Stock levels are healthy</p>
                </div>
              ) : (
                <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 400px)' }}>
                  {Object.entries(stats.lowStockByGroup).map(([groupId, groupProducts], groupIndex) => {
                    const group = groups.find(g => g.id === groupId)
                    const groupName = group?.name || (groupId === 'unassigned' ? 'Unassigned' : 'Unknown Folder')
                    const totalInGroup = products.filter(p => {
                      const qty = p.qtyOnHand || 0
                      const reorderPoint = p.reorderPoint || 0
                      return reorderPoint > 0 && qty <= reorderPoint && ((p as any).groupId || 'unassigned') === groupId
                    }).length

                    return (
                      <div 
                        key={groupId} 
                        className={`${groupIndex > 0 ? 'border-t-2 border-gray-300 mt-4 pt-4' : ''}`}
                      >
                        {/* Folder Header */}
                        <div className="px-4 sm:px-6 mb-3 bg-gray-50 py-2 rounded-lg">
                          <div className="flex items-center justify-between">
                            <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                              {groupName}
                            </h4>
                            <span className="text-xs font-medium text-gray-600 bg-white px-2 py-1 rounded">
                              {groupProducts.length}{totalInGroup > groupProducts.length ? ` of ${totalInGroup}` : ''}
                            </span>
                          </div>
                        </div>
                        {/* Products in this folder */}
                        <ul className="space-y-1 px-4 sm:px-6">
                          {groupProducts.map((product) => {
                            const qty = product.qtyOnHand || 0
                            const isOutOfStock = qty <= 0
                            const uom = product.uom || 'units'
                            const formattedQty = qty.toLocaleString('en-US', { 
                              maximumFractionDigits: 2,
                              minimumFractionDigits: qty % 1 !== 0 ? 2 : 0
                            })

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
                              <li key={product.id} className="px-4 sm:px-6 py-2 hover:bg-gray-50 transition-colors">
                                <div className="flex items-center justify-between gap-2">
                                  <div className="min-w-0 flex-1">
                                    <p className="text-xs sm:text-sm font-medium text-gray-900 truncate">{productName}</p>
                                    <p className={`text-xs ${qty < 0 ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                                      {qty < 0 ? (
                                        <>Shortage: {Math.abs(qty).toLocaleString('en-US', { maximumFractionDigits: 2, minimumFractionDigits: qty % 1 !== 0 ? 2 : 0 })} {uom}</>
                                      ) : qty === 0 ? (
                                        <>0 {uom} on hand</>
                                      ) : (
                                        <>{formattedQty} {uom} on hand</>
                                      )}
                                    </p>
                                  </div>
                                  <Badge variant={isOutOfStock ? 'danger' : 'warning'} size="sm" className="ml-2 flex-shrink-0">
                                    {isOutOfStock ? 'Empty' : 'Low'}
                                  </Badge>
                                </div>
                              </li>
                            )
                          })}
                        </ul>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
            <div className="border-t border-gray-200 p-3 sm:p-4 bg-gray-50/50">
              <Link to="/inventory" className="text-xs sm:text-sm font-medium text-primary-600 hover:text-primary-700 flex items-center justify-center no-print">
                View Inventory Report
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </PageShell>
  )
}
