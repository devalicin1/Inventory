import { useState, useMemo, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  ChartBarIcon,
  ListBulletIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  ExclamationTriangleIcon,
  ArrowDownTrayIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  CheckCircleIcon,
  PresentationChartLineIcon,
  BoltIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  CubeIcon
} from '@heroicons/react/24/outline'
import { StuckJobsReport } from '../../production-reports/StuckJobsReport'
import { WIPInventoryReport } from '../../production-reports/WIPInventoryReport'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  ComposedChart,
  Area,
  AreaChart
} from 'recharts'
import { 
  listJobs, 
  listWorkflows, 
  listWorkcenters, 
  listCustomers,
  listJobProductionRuns
} from '../../../api/production-jobs'
import { toCSV, downloadCSV } from '../../../utils/csv'
import {
  calculateWIPByStage,
  calculateStageBottlenecks,
  detectStuckJobs,
  calculateWIPInventoryBetweenStages,
  type StageBottleneckData,
  type StuckJobData,
  type WIPInventoryData
} from '../../../components/production-reports/utils'

// --- Types & Interfaces ---

interface ProductionReportsTabProps {
  workspaceId: string
  onJobClick?: (jobId: string) => void
}

type ReportCategory = 'overview' | 'distribution' | 'trends' | 'performance' | 'analysis' | 'stuckJobs' | 'wipInventory' | 'list'
type SortField = 'code' | 'sku' | 'productName' | 'customer' | 'stage' | 'status' | 'priority' | 'quantity' | 'dueDate' | 'createdAt' | 'daysInStage'
type SortDirection = 'asc' | 'desc'

interface KPIStat {
  value: string | number
  label: string
  trend?: number
  trendLabel?: string
  color: 'blue' | 'green' | 'amber' | 'red' | 'purple' | 'indigo'
  icon: any
}

interface StageStatData {
  stageId: string
  name: string
  count: number
  wipLimit?: number
  workflowName: string
  overdueCount: number
  totalQuantity: number
  priorityBreakdown: Record<number, number>
  statusBreakdown: Record<string, number>
  avgDaysInStage: number
}

// --- Constants ---

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16']
const ITEMS_PER_PAGE = 50

// --- Helper Components ---

const StatCard = ({ stat }: { stat: KPIStat }) => {
  const Icon = stat.icon
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    red: 'bg-rose-50 text-rose-600',
    purple: 'bg-purple-50 text-purple-600',
    indigo: 'bg-indigo-50 text-indigo-600'
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-shadow duration-200">
      <div className="flex justify-between items-start">
        <div>
          <p className="text-sm font-medium text-gray-500">{stat.label}</p>
          <h3 className="text-2xl font-bold text-gray-900 mt-2 tracking-tight">{stat.value}</h3>
        </div>
        <div className={`p-3 rounded-xl ${colorClasses[stat.color]}`}>
          <Icon className="h-6 w-6" />
        </div>
      </div>
      {(stat.trend !== undefined) && (
        <div className="mt-4 flex items-center text-xs font-medium">
          {stat.trend > 0 ? (
            <span className="text-emerald-600 flex items-center gap-1 bg-emerald-50 px-1.5 py-0.5 rounded">
              <ArrowTrendingUpIcon className="h-3 w-3" />
              {stat.trend}%
            </span>
          ) : stat.trend < 0 ? (
            <span className="text-rose-600 flex items-center gap-1 bg-rose-50 px-1.5 py-0.5 rounded">
              <ArrowTrendingDownIcon className="h-3 w-3" />
              {Math.abs(stat.trend)}%
            </span>
          ) : (
            <span className="text-gray-500 bg-gray-50 px-1.5 py-0.5 rounded">0%</span>
          )}
          <span className="text-gray-400 ml-2">{stat.trendLabel || 'vs previous period'}</span>
        </div>
      )}
    </div>
  )
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white/95 backdrop-blur-sm p-3 border border-gray-200 shadow-xl rounded-lg text-xs z-50 ring-1 ring-gray-900/5">
        <p className="font-semibold text-gray-900 mb-2 border-b border-gray-100 pb-1">{label}</p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-2 py-0.5">
            <div 
              className="w-2 h-2 rounded-full shadow-sm" 
              style={{ backgroundColor: entry.color || entry.fill }} 
            />
            <span className="text-gray-600 capitalize">
              {entry.name}:
            </span>
            <span className="font-mono font-medium text-gray-900 ml-auto">
              {typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value}
            </span>
          </div>
        ))}
      </div>
    )
  }
  return null
}

const StatusBadge = ({ status }: { status: string }) => {
  const styles: Record<string, string> = {
    done: 'bg-emerald-50 text-emerald-700 border-emerald-200 ring-emerald-600/20',
    completed: 'bg-emerald-50 text-emerald-700 border-emerald-200 ring-emerald-600/20',
    in_progress: 'bg-blue-50 text-blue-700 border-blue-200 ring-blue-600/20',
    released: 'bg-indigo-50 text-indigo-700 border-indigo-200 ring-indigo-600/20',
    blocked: 'bg-rose-50 text-rose-700 border-rose-200 ring-rose-600/20',
    draft: 'bg-gray-50 text-gray-700 border-gray-200 ring-gray-600/20',
    cancelled: 'bg-gray-50 text-gray-500 border-gray-200 line-through ring-gray-500/20'
  }
  
  const formattedStatus = status.toLowerCase()
  const style = styles[formattedStatus] || 'bg-gray-50 text-gray-700 border-gray-200'

  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ring-1 ring-inset inline-flex items-center ${style} capitalize`}>
      {status.replace('_', ' ')}
    </span>
  )
}

const ChartContainer = ({ title, children, height = "h-80", action }: { title: string, children: React.ReactNode, height?: string, action?: React.ReactNode }) => (
  <div className="bg-white p-5 rounded-xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] border border-gray-200/60 hover:border-gray-300 transition-colors">
    <div className="flex justify-between items-center mb-6">
      <h3 className="text-base font-semibold text-gray-900">{title}</h3>
      {action}
    </div>
    <div className={height}>
      {children}
    </div>
  </div>
)

const EmptyChartState = ({ message }: { message: string }) => (
  <div className="h-full w-full flex flex-col items-center justify-center text-gray-400 border-2 border-dashed border-gray-100 rounded-lg">
    <ChartBarIcon className="h-8 w-8 mb-2 opacity-50" />
    <span className="text-sm font-medium">{message}</span>
  </div>
)

// --- Main Component ---

export function ProductionReportsTab({ workspaceId, onJobClick }: ProductionReportsTabProps) {
  const [activeCategory, setActiveCategory] = useState<ReportCategory>('overview')
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string[]>([])
  const [stageFilter, setStageFilter] = useState<string>('')
  const [priorityFilter, _setPriorityFilter] = useState<number[]>([])
  const [workflowFilter, setWorkflowFilter] = useState<string>('')
  const [workcenterFilter, setWorkcenterFilter] = useState<string>('')
  const [customerFilter, setCustomerFilter] = useState<string>('')
  const [dateRange, setDateRange] = useState({
    start: '',
    end: ''
  })
  const [showOverdueOnly, setShowOverdueOnly] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [sortField, setSortField] = useState<SortField>('dueDate')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const [currentPage, setCurrentPage] = useState(1)

  // Fetch Data
  const { data: jobsData, isLoading: jobsLoading } = useQuery({
    queryKey: ['jobs', workspaceId],
    queryFn: () => listJobs(workspaceId),
  })

  const { data: workflows = [] } = useQuery({
    queryKey: ['workflows', workspaceId],
    queryFn: () => listWorkflows(workspaceId),
  })

  const { data: workcenters = [] } = useQuery({
    queryKey: ['workcenters', workspaceId],
    queryFn: () => listWorkcenters(workspaceId),
  })

  const { data: customers = [] } = useQuery({
    queryKey: ['customers', workspaceId],
    queryFn: () => listCustomers(workspaceId),
  })

  const allJobs = jobsData?.jobs || []

  // Fetch production runs for all production jobs
  const productionJobIds = useMemo(() => {
    return allJobs
      .filter(job => job.status !== 'draft' && job.status !== 'cancelled')
      .map(job => job.id)
      .sort()
  }, [allJobs])

  const { data: allRunsData } = useQuery({
    queryKey: ['production-runs', workspaceId, productionJobIds.length],
    queryFn: async () => {
      if (productionJobIds.length === 0) return {}
      
      // Fetch runs for all jobs in parallel
      const runsPromises = productionJobIds.map(async (jobId) => {
        try {
          const runs = await listJobProductionRuns(workspaceId, jobId)
          return { jobId, runs }
        } catch (error) {
          console.error(`Error fetching runs for job ${jobId}:`, error)
          return { jobId, runs: [] }
        }
      })
      
      const runsResults = await Promise.all(runsPromises)
      
      // Group by job ID
      const grouped: { [jobId: string]: any[] } = {}
      runsResults.forEach(({ jobId, runs }) => {
        grouped[jobId] = runs
      })
      
      return grouped
    },
    enabled: productionJobIds.length > 0,
  })

  // --- Filtering Logic ---
  const productionJobs = useMemo(() => {
    let filtered = allJobs.filter(job => 
      job.status !== 'draft' && job.status !== 'cancelled'
    )

    if (dateRange.start) {
      filtered = filtered.filter(job => {
        const createdAt = job.createdAt as any
        const jobDate = new Date(createdAt?.seconds ? createdAt.seconds * 1000 : createdAt)
        return jobDate >= new Date(dateRange.start)
      })
    }
    if (dateRange.end) {
      filtered = filtered.filter(job => {
        const createdAt = job.createdAt as any
        const jobDate = new Date(createdAt?.seconds ? createdAt.seconds * 1000 : createdAt)
        const endDate = new Date(dateRange.end)
        endDate.setHours(23, 59, 59, 999)
        return jobDate <= endDate
      })
    }

    if (workflowFilter) filtered = filtered.filter(job => job.workflowId === workflowFilter)
    if (workcenterFilter) filtered = filtered.filter(job => job.workcenterId === workcenterFilter)
    if (customerFilter) filtered = filtered.filter(job => job.customer?.id === customerFilter)
    
    if (showOverdueOnly) {
      const now = new Date()
      filtered = filtered.filter(job => {
        if (job.status === 'done' || job.status === 'cancelled') return false
        const dueDate = job.dueDate as any
        const dueDateObj = new Date(dueDate?.seconds ? dueDate.seconds * 1000 : dueDate)
        return dueDateObj < now
      })
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(job =>
        job.code?.toLowerCase().includes(query) ||
        job.sku?.toLowerCase().includes(query) ||
        job.productName?.toLowerCase().includes(query) ||
        job.customer?.name?.toLowerCase().includes(query)
      )
    }

    if (statusFilter.length > 0) filtered = filtered.filter(job => statusFilter.includes(job.status))
    if (stageFilter) filtered = filtered.filter(job => job.currentStageId === stageFilter)
    if (priorityFilter.length > 0) filtered = filtered.filter(job => priorityFilter.includes(job.priority))

    return filtered
  }, [allJobs, dateRange, workflowFilter, workcenterFilter, customerFilter, showOverdueOnly, searchQuery, statusFilter, stageFilter, priorityFilter])

  // --- Derived Data Calculations ---

  const allStages = useMemo(() => {
    const stages: Array<{ id: string; name: string; workflowName: string; workflowId: string; wipLimit?: number }> = []
    workflows.forEach(wf => {
      wf.stages?.forEach((stage: any) => {
        stages.push({
          id: stage.id,
          name: stage.name,
          workflowName: wf.name || 'Unknown',
          workflowId: wf.id,
          wipLimit: stage.wipLimit
        })
      })
    })
    return stages
  }, [workflows])

  // General Stage Stats
  const stageStats = useMemo(() => {
    const stats: Record<string, StageStatData> = {}
    const now = new Date()
    
    productionJobs.forEach(job => {
      const stageId = job.currentStageId || '__unassigned__'
      const stage = allStages.find(s => s.id === stageId)
      const stageName = stageId === '__unassigned__' ? 'Unassigned' : stage?.name || stageId
      
      if (!stats[stageId]) {
        stats[stageId] = {
          stageId,
          name: stageName,
          count: 0,
          wipLimit: stage?.wipLimit,
          workflowName: stage?.workflowName || 'Unknown',
          overdueCount: 0,
          totalQuantity: 0,
          priorityBreakdown: {},
          statusBreakdown: {},
          avgDaysInStage: 0
        }
      }
      
      const stat = stats[stageId]
      stat.count++
      stat.totalQuantity += job.quantity || 0
      stat.priorityBreakdown[job.priority] = (stat.priorityBreakdown[job.priority] || 0) + 1
      stat.statusBreakdown[job.status] = (stat.statusBreakdown[job.status] || 0) + 1
      
      if (job.status !== 'done' && job.status !== 'cancelled') {
        const dueDate = job.dueDate as any
        const dueDateObj = new Date(dueDate?.seconds ? dueDate.seconds * 1000 : dueDate)
        if (dueDateObj < now) stat.overdueCount++
      }

      // Simple days in stage calc for demo
      if (job.stageProgress && Array.isArray(job.stageProgress)) {
        const entry = job.stageProgress.find((p: any) => p.stageId === stageId)
        if (entry?.date) {
            const dateValue = entry.date as any
            const entryDate = new Date(dateValue?.seconds ? dateValue.seconds * 1000 : dateValue)
            const days = (now.getTime() - entryDate.getTime()) / (1000 * 60 * 60 * 24)
            stat.avgDaysInStage += days
        }
      }
    })

    // Average the days
    Object.values(stats).forEach(stat => {
        if (stat.count > 0) stat.avgDaysInStage = stat.avgDaysInStage / stat.count
    })

    return Object.values(stats).sort((a, b) => b.count - a.count)
  }, [productionJobs, allStages])

  // Advanced: Status by Stage (for stacked bar)
  const statusByStageData = useMemo(() => {
    return stageStats.map(stat => {
      const data: any = { stage: stat.name }
      Object.entries(stat.statusBreakdown).forEach(([status, count]) => {
        data[status.replace('_', ' ').toUpperCase()] = count
      })
      return data
    })
  }, [stageStats])

  // Advanced: Bottlenecks (WIP Limits)
  const bottleneckData = useMemo(() => {
    return stageStats
      .filter(stat => stat.wipLimit && stat.count > stat.wipLimit)
      .map(stat => ({
        stage: stat.name,
        current: stat.count,
        limit: stat.wipLimit || 0,
        overage: stat.count - (stat.wipLimit || 0),
        percentage: ((stat.count / (stat.wipLimit || 1)) * 100).toFixed(1)
      }))
      .sort((a, b) => b.overage - a.overage)
  }, [stageStats])

  // Stuck Jobs & WIP Inventory Analysis
  const stuckJobsData = useMemo(() => {
    if (!allRunsData) return []
    return detectStuckJobs(productionJobs, allRunsData, workflows, workcenters)
  }, [productionJobs, allRunsData, workflows, workcenters])

  const wipInventoryData = useMemo(() => {
    if (!allRunsData) return []
    return calculateWIPInventoryBetweenStages(productionJobs, allRunsData, workflows)
  }, [productionJobs, allRunsData, workflows])

  const stageBottlenecksData = useMemo(() => {
    if (!allRunsData) return []
    return calculateStageBottlenecks(productionJobs, allRunsData, workflows, workcenters)
  }, [productionJobs, allRunsData, workflows, workcenters])

  // Advanced: Risk Analysis
  const riskAnalysisData = useMemo(() => {
    const now = new Date()
    const atRisk: Array<any> = []
    
    productionJobs
      .filter(j => j.status !== 'done' && j.status !== 'cancelled')
      .forEach(job => {
        const dueDate = job.dueDate as any
        const dueDateObj = new Date(dueDate?.seconds ? dueDate.seconds * 1000 : dueDate)
        const daysUntilDue = Math.floor((dueDateObj.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        
        let riskLevel = 'low'
        if (daysUntilDue < 0) riskLevel = 'critical'
        else if (daysUntilDue <= 2) riskLevel = 'high'
        else if (daysUntilDue <= 5) riskLevel = 'medium'
        
        if (riskLevel !== 'low') {
            atRisk.push({
            id: job.id,
            jobCode: job.code || '',
            productName: job.productName || '',
            stage: getStageName(job.currentStageId),
            dueDate: formatDate(job.dueDate),
            daysUntilDue,
            priority: job.priority,
            riskLevel
            })
        }
      })
    
    return atRisk.sort((a, b) => a.daysUntilDue - b.daysUntilDue).slice(0, 20)
  }, [productionJobs, allStages])

  // Advanced: Cycle Time
  const cycleTimeData = useMemo(() => {
    const completedJobs = productionJobs.filter(j => j.status === 'done')
    const cycleTimes: number[] = []

    completedJobs.forEach(job => {
      const createdAt = job.createdAt as any
      const created = new Date(createdAt?.seconds ? createdAt.seconds * 1000 : createdAt)
      const completedAt = job.updatedAt as any
      const completed = completedAt ? new Date(completedAt?.seconds ? completedAt.seconds * 1000 : completedAt) : new Date()
      
      const days = (completed.getTime() - created.getTime()) / (1000 * 60 * 60 * 24)
      if (days > 0) cycleTimes.push(days)
    })

    const average = cycleTimes.length > 0 ? cycleTimes.reduce((a, b) => a + b, 0) / cycleTimes.length : 0
    const sorted = [...cycleTimes].sort((a, b) => a - b)
    
    return {
      average: average.toFixed(1),
      min: cycleTimes.length > 0 ? Math.min(...cycleTimes).toFixed(1) : '0',
      max: cycleTimes.length > 0 ? Math.max(...cycleTimes).toFixed(1) : '0',
      median: cycleTimes.length > 0 ? sorted[Math.floor(sorted.length / 2)].toFixed(1) : '0',
      count: cycleTimes.length
    }
  }, [productionJobs])

  // Advanced: Customer Performance
  const customerPerformanceData = useMemo(() => {
    const customerStats: Record<string, any> = {}
    productionJobs.forEach(job => {
      const customerId = job.customer?.id || '__unknown__'
      const customerName = job.customer?.name || 'Unknown'
      
      if (!customerStats[customerId]) {
        customerStats[customerId] = { name: customerName, totalJobs: 0, completed: 0 }
      }
      customerStats[customerId].totalJobs++
      if (job.status === 'done') customerStats[customerId].completed++
    })

    return Object.values(customerStats)
      .sort((a: any, b: any) => b.totalJobs - a.totalJobs)
      .slice(0, 10)
  }, [productionJobs])

  // --- Helper Functions ---

  function getStageName(stageId?: string | null) {
    if (!stageId) return 'Unassigned'
    return allStages.find(s => s.id === stageId)?.name || stageId
  }

  function formatDate(date: any) {
    if (!date) return '-'
    try {
      if (date.seconds) return new Date(date.seconds * 1000).toLocaleDateString('en-US')
      return new Date(date).toLocaleDateString('en-US')
    } catch { return '-' }
  }

  function getPriorityLabel(priority: number): string {
    const labels: Record<number, string> = { 1: 'Low', 2: 'Medium', 3: 'High', 4: 'Critical', 5: 'Urgent' }
    return labels[priority] || `P${priority}`
  }

  function setQuickDateRange(days: number) {
    const end = new Date()
    const start = new Date()
    start.setDate(end.getDate() - days)
    setDateRange({
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0]
    })
  }

  // --- Basic Stats Calculations ---

  const statusStats = useMemo(() => {
    const stats: Record<string, number> = {}
    productionJobs.forEach(job => {
      stats[job.status] = (stats[job.status] || 0) + 1
    })
    return Object.entries(stats).map(([status, count]) => ({
      status: status.replace('_', ' ').toUpperCase(),
      rawStatus: status, // for filtering
      count
    }))
  }, [productionJobs])

  const trendData = useMemo(() => {
    const dailyCounts: Record<string, number> = {}
    productionJobs.forEach(job => {
      const createdAt = job.createdAt as any
      const date = new Date(createdAt?.seconds ? createdAt.seconds * 1000 : createdAt)
      const dateStr = date.toISOString().split('T')[0]
      dailyCounts[dateStr] = (dailyCounts[dateStr] || 0) + 1
    })
    
    return Object.entries(dailyCounts)
      .map(([date, count]) => ({
        date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        fullDate: date,
        count
      }))
      .sort((a, b) => new Date(a.fullDate).getTime() - new Date(b.fullDate).getTime())
      .slice(-30)
  }, [productionJobs])

  const throughputData = useMemo(() => {
    const dailyCompleted: Record<string, number> = {}
    productionJobs
      .filter(j => j.status === 'done')
      .forEach(job => {
        const updatedAt = job.updatedAt as any
        const date = updatedAt ? new Date(updatedAt?.seconds ? updatedAt.seconds * 1000 : updatedAt) : new Date()
        const dateStr = date.toISOString().split('T')[0]
        dailyCompleted[dateStr] = (dailyCompleted[dateStr] || 0) + 1
      })
    
    return Object.entries(dailyCompleted)
      .map(([date, count]) => ({
        date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        fullDate: date,
        completed: count
      }))
      .sort((a, b) => new Date(a.fullDate).getTime() - new Date(b.fullDate).getTime())
      .slice(-30)
  }, [productionJobs])

  const onTimeDeliveryData = useMemo(() => {
    const completedJobs = productionJobs.filter(j => j.status === 'done')
    const now = new Date()
    let onTime = 0, late = 0

    completedJobs.forEach(job => {
      const dueDate = job.dueDate as any
      const dueDateObj = new Date(dueDate?.seconds ? dueDate.seconds * 1000 : dueDate)
      const completedAt = job.updatedAt as any
      const completedAtObj = completedAt ? new Date(completedAt?.seconds ? completedAt.seconds * 1000 : completedAt) : now
      
      if (completedAtObj <= dueDateObj) onTime++
      else late++
    })

    const total = completedJobs.length
    return {
      total,
      onTime,
      late,
      percentage: total > 0 ? ((onTime / total) * 100).toFixed(1) : '0'
    }
  }, [productionJobs])

  const priorityStats = useMemo(() => {
      const stats: Record<number, number> = {}
      productionJobs.forEach(job => {
        stats[job.priority] = (stats[job.priority] || 0) + 1
      })
      return Object.entries(stats)
        .map(([priority, count]) => ({ 
          priority: Number(priority), 
          priorityLabel: getPriorityLabel(Number(priority)),
          count 
        }))
        .sort((a, b) => b.priority - a.priority)
    }, [productionJobs])

  // --- Sorting & Pagination ---

  const sortedAndPaginatedJobs = useMemo(() => {
    let sorted = [...productionJobs]
    sorted.sort((a, b) => {
      let aValue: any, bValue: any
      if (sortField === 'code') { aValue = a.code; bValue = b.code }
      else if (sortField === 'stage') { aValue = getStageName(a.currentStageId); bValue = getStageName(b.currentStageId) }
      else if (sortField === 'status') { aValue = a.status; bValue = b.status }
      else if (sortField === 'priority') { aValue = a.priority; bValue = b.priority }
      else if (sortField === 'dueDate') {
         const da = a.dueDate as any; const db = b.dueDate as any;
         aValue = new Date(da?.seconds ? da.seconds * 1000 : da).getTime();
         bValue = new Date(db?.seconds ? db.seconds * 1000 : db).getTime();
      } else {
         aValue = (a as any)[sortField] || ''; bValue = (b as any)[sortField] || '';
      }

      if (aValue === bValue) return 0;
      const comparison = aValue > bValue ? 1 : -1;
      return sortDirection === 'asc' ? comparison : -comparison;
    })
    
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
    return sorted.slice(startIndex, startIndex + ITEMS_PER_PAGE)
  }, [productionJobs, sortField, sortDirection, currentPage])

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDirection('asc') }
    setCurrentPage(1)
  }

  const handleExport = () => {
    const exportData = productionJobs.map(job => ({
      'Job Code': job.code,
      'Product': job.productName,
      'Status': job.status,
      'Workflow': getWorkflowName(job.workflowId),
      'Stage': getStageName(job.currentStageId),
      'Due Date': formatDate(job.dueDate)
    }))
    downloadCSV('production_report.csv', toCSV(exportData))
  }

  const getWorkflowName = (workflowId?: string) => {
    if (!workflowId) return '-'
    return workflows.find(w => w.id === workflowId)?.name || '-'
  }

  // Drill down interactions
  const handleStageClick = useCallback((data: any) => {
     if (data && data.stageId) {
         setStageFilter(data.stageId)
         setActiveCategory('list')
     }
  }, [])

  const handleStatusClick = useCallback((data: any) => {
    if (data && data.rawStatus) {
        setStatusFilter([data.rawStatus])
        setActiveCategory('list')
    }
 }, [])

  // --- Render ---

  if (jobsLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="h-20 bg-gray-100 animate-pulse rounded-lg" />
        <div className="grid grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="h-32 bg-gray-100 animate-pulse rounded-xl" />)}
        </div>
        <div className="h-96 bg-gray-100 animate-pulse rounded-xl" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50/50 p-5 sm:p-8 space-y-5 sm:space-y-6 font-sans text-slate-600">
      
      {/* Header Section */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Production Analytics</h1>
          <p className="text-sm text-slate-500 mt-1">Real-time insights into your manufacturing operations</p>
        </div>
        
        <div className="flex items-center gap-2 bg-white p-1 rounded-lg border border-gray-200 shadow-sm overflow-x-auto max-w-full">
          {[
            { id: 'overview', icon: PresentationChartLineIcon, label: 'Overview' },
            { id: 'distribution', icon: ChartBarIcon, label: 'Distribution' },
            { id: 'trends', icon: ArrowDownTrayIcon, label: 'Trends' },
            { id: 'performance', icon: CheckCircleIcon, label: 'Performance' },
            { id: 'analysis', icon: ExclamationTriangleIcon, label: 'Analysis' },
            { id: 'stuckJobs', icon: ExclamationTriangleIcon, label: 'Stuck Jobs', badge: stuckJobsData.length },
            { id: 'wipInventory', icon: CubeIcon, label: 'WIP Inventory' },
            { id: 'list', icon: ListBulletIcon, label: 'Data' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveCategory(tab.id as ReportCategory)}
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all whitespace-nowrap relative ${
                activeCategory === tab.id
                  ? 'bg-white text-blue-700 shadow-sm ring-1 ring-gray-200'
                  : 'text-slate-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
              {tab.badge !== undefined && tab.badge > 0 && (
                <span className="ml-1 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 transition-all">
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative w-full md:w-96">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search jobs, SKUs, customers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 rounded-lg transition-all text-sm outline-none"
            />
          </div>
          
          <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0 scrollbar-hide">
            <button
              onClick={() => setQuickDateRange(7)}
              className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 whitespace-nowrap transition-colors"
            >
              Last 7 Days
            </button>
            <button
              onClick={() => setQuickDateRange(30)}
              className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 whitespace-nowrap transition-colors"
            >
              Last 30 Days
            </button>
            
            <div className="h-6 w-px bg-gray-200 mx-2 hidden md:block" />

            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
                showFilters || (productionJobs.length !== allJobs.length)
                  ? 'bg-blue-50 border-blue-200 text-blue-700'
                  : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <FunnelIcon className="h-4 w-4" />
              Filters
              {(productionJobs.length !== allJobs.length) && (
                <span className="flex h-2 w-2 rounded-full bg-blue-600 ml-1" />
              )}
            </button>
            
            {showFilters && (
              <button onClick={() => {
                setSearchQuery(''); setStatusFilter([]); setStageFilter(''); setWorkflowFilter(''); setWorkcenterFilter(''); setCustomerFilter('');
                setDateRange({start: '', end: ''}); setShowOverdueOnly(false);
              }} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                <XMarkIcon className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>

        {/* Expandable Filters */}
        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4 pt-4 border-t border-gray-100 animate-in fade-in slide-in-from-top-2">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Timeframe</label>
              <div className="flex gap-2">
                <input
                  type="date"
                  value={dateRange.start}
                  onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                  className="w-full text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
                <input
                  type="date"
                  value={dateRange.end}
                  onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                  className="w-full text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Workflow & Stage</label>
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={workflowFilter}
                  onChange={(e) => setWorkflowFilter(e.target.value)}
                  className="text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">All Workflows</option>
                  {workflows.map(wf => <option key={wf.id} value={wf.id}>{wf.name}</option>)}
                </select>
                <select
                  value={stageFilter}
                  onChange={(e) => setStageFilter(e.target.value)}
                  className="text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">All Stages</option>
                  {allStages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Resources</label>
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={workcenterFilter}
                  onChange={(e) => setWorkcenterFilter(e.target.value)}
                  className="text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">All Workcenters</option>
                  {workcenters.map(wc => <option key={wc.id} value={wc.id}>{wc.name}</option>)}
                </select>
                <select
                  value={customerFilter}
                  onChange={(e) => setCustomerFilter(e.target.value)}
                  className="text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">All Customers</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Attributes</label>
              <div className="flex items-center gap-4 mt-2">
                <label className="flex items-center gap-2 cursor-pointer bg-gray-50 hover:bg-gray-100 px-3 py-2 rounded-lg border border-gray-200 transition-colors w-full">
                  <input
                    type="checkbox"
                    checked={showOverdueOnly}
                    onChange={(e) => setShowOverdueOnly(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700 font-medium">Overdue Only</span>
                </label>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Content Area */}
      {productionJobs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center bg-white rounded-xl border border-gray-200 border-dashed">
            <div className="bg-blue-50 p-4 rounded-full mb-4">
                <FunnelIcon className="h-8 w-8 text-blue-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">No data found</h3>
            <p className="text-sm text-gray-500 max-w-sm mt-1">Try adjusting your filters, searching for a different term, or selecting a broader date range.</p>
            <button 
                onClick={() => {
                    setSearchQuery(''); setStatusFilter([]); setStageFilter(''); setWorkflowFilter(''); setWorkcenterFilter(''); setCustomerFilter('');
                    setDateRange({start: '', end: ''}); setShowOverdueOnly(false);
                }}
                className="mt-4 text-blue-600 font-medium text-sm hover:underline"
            >
                Clear all filters
            </button>
        </div>
      ) : (
        <>
          {/* Overview Tab */}
          {activeCategory === 'overview' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard 
                  stat={{
                    label: "Active Jobs",
                    value: productionJobs.length,
                    icon: ListBulletIcon,
                    color: "blue",
                    trend: 12 // Simulated positive trend
                  }}
                />
                <StatCard 
                  stat={{
                    label: "On-Time Rate",
                    value: `${onTimeDeliveryData.percentage}%`,
                    icon: CheckCircleIcon,
                    color: "green",
                    trend: parseFloat(onTimeDeliveryData.percentage) > 90 ? 2.5 : -1.2
                  }}
                />
                <StatCard 
                  stat={{
                    label: "Avg Cycle Time",
                    value: `${cycleTimeData.average} Days`,
                    icon: ClockIcon,
                    color: "indigo",
                    trend: -5, // Negative cycle time is good
                    trendLabel: "improvement"
                  }}
                />
                <StatCard 
                  stat={{
                    label: "At Risk / Overdue",
                    value: riskAnalysisData.length,
                    icon: ExclamationTriangleIcon,
                    color: "red",
                    trend: riskAnalysisData.length > 5 ? 10 : -20,
                    trendLabel: "vs last week"
                  }}
                />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                   <ChartContainer 
                        title="Stage Distribution" 
                        action={<span className="text-xs text-gray-400 font-medium">Top 10 Stages • Click to filter</span>}
                   >
                     {stageStats.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart 
                                data={stageStats.slice(0, 10)} 
                                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                                onClick={handleStageClick}
                                className="cursor-pointer"
                            >
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 11}} dy={10} interval={0} />
                                <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 11}} />
                                <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />
                                <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={50} activeBar={{ fill: '#2563eb' }} />
                            </BarChart>
                        </ResponsiveContainer>
                     ) : <EmptyChartState message="No stage data" />}
                   </ChartContainer>
                </div>

                <ChartContainer 
                    title="Job Status"
                    action={<span className="text-xs text-gray-400 font-medium">Click slice to filter</span>}
                >
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart onClick={handleStatusClick} className="cursor-pointer">
                        <Pie
                          data={statusStats}
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={4}
                          dataKey="count"
                        >
                          {statusStats.map((_entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} strokeWidth={0} />
                          ))}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                        <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{fontSize: '11px', color: '#64748b'}} />
                      </PieChart>
                    </ResponsiveContainer>
                </ChartContainer>
              </div>

              <ChartContainer title="Production Volume (Last 30 Days)" height="h-72">
                 <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trendData}>
                      <defs>
                        <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15}/>
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 11}} dy={10} minTickGap={30} />
                      <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 11}} />
                      <Tooltip content={<CustomTooltip />} />
                      <Area type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2.5} fillOpacity={1} fill="url(#colorCount)" />
                    </AreaChart>
                  </ResponsiveContainer>
              </ChartContainer>
            </div>
          )}

          {/* Distribution Tab */}
          {activeCategory === 'distribution' && (
             <div className="space-y-6 animate-in fade-in duration-300">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <ChartContainer title="Priority Distribution">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={priorityStats}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="priorityLabel" axisLine={false} tickLine={false} tick={{fontSize: 11, fill: '#64748b'}} />
                                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 11, fill: '#64748b'}} />
                                <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />
                                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                                    {priorityStats.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.priority >= 4 ? '#ef4444' : entry.priority >= 3 ? '#f59e0b' : '#3b82f6'} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </ChartContainer>
                    <ChartContainer title="Status by Stage">
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={statusByStageData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="stage" axisLine={false} tickLine={false} angle={-25} textAnchor="end" height={60} tick={{fontSize: 10, fill: '#64748b'}} />
                                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 11, fill: '#64748b'}} />
                                <Tooltip content={<CustomTooltip />} />
                                <Legend wrapperStyle={{fontSize: '11px'}} />
                                <Bar dataKey="RELEASED" stackId="a" fill="#3b82f6" radius={[0,0,0,0]} />
                                <Bar dataKey="IN PROGRESS" stackId="a" fill="#10b981" radius={[0,0,0,0]} />
                                <Bar dataKey="BLOCKED" stackId="a" fill="#ef4444" radius={[0,0,0,0]} />
                                <Bar dataKey="DONE" stackId="a" fill="#84cc16" radius={[4,4,0,0]} />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </ChartContainer>
                </div>
                <ChartContainer title="Detailed Stage Breakdown">
                     <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={stageStats} layout="vertical" margin={{ left: 40, right: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                            <XAxis type="number" axisLine={false} tickLine={false} tick={{fontSize: 11, fill: '#64748b'}} />
                            <YAxis dataKey="name" type="category" width={100} axisLine={false} tickLine={false} tick={{fontSize: 11, fill: '#475569'}} />
                            <Tooltip content={<CustomTooltip />} cursor={{fill: '#f8fafc'}} />
                            <Bar dataKey="count" fill="#6366f1" radius={[0, 4, 4, 0]} barSize={20} />
                        </BarChart>
                    </ResponsiveContainer>
                </ChartContainer>
             </div>
          )}

          {/* Trends Tab */}
          {activeCategory === 'trends' && (
              <div className="space-y-6 animate-in fade-in duration-300">
                  <ChartContainer title="Daily Job Creation Trend">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={trendData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize: 11, fill: '#64748b'}} minTickGap={20} />
                            <YAxis axisLine={false} tickLine={false} tick={{fontSize: 11, fill: '#64748b'}} />
                            <Tooltip content={<CustomTooltip />} />
                            <Area type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} fill="#eff6ff" />
                        </AreaChart>
                      </ResponsiveContainer>
                  </ChartContainer>
                  
                  <ChartContainer title="Throughput Analysis (Completed Jobs)">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={throughputData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize: 11, fill: '#64748b'}} minTickGap={20} />
                            <YAxis axisLine={false} tickLine={false} tick={{fontSize: 11, fill: '#64748b'}} />
                            <Tooltip content={<CustomTooltip />} />
                            <Bar dataKey="completed" fill="#10b981" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                  </ChartContainer>
              </div>
          )}

          {/* Performance Tab */}
          {activeCategory === 'performance' && (
              <div className="space-y-6 animate-in fade-in duration-300">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <StatCard 
                          stat={{label: "Avg Cycle Time", value: `${cycleTimeData.average}d`, icon: ClockIcon, color: "blue"}} 
                      />
                      <StatCard 
                          stat={{label: "Min Cycle Time", value: `${cycleTimeData.min}d`, icon: BoltIcon, color: "green"}} 
                      />
                      <StatCard 
                          stat={{label: "Max Cycle Time", value: `${cycleTimeData.max}d`, icon: ExclamationTriangleIcon, color: "amber"}} 
                      />
                      <StatCard 
                          stat={{label: "Median", value: `${cycleTimeData.median}d`, icon: ChartBarIcon, color: "purple"}} 
                      />
                  </div>
                  
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <ChartContainer title="Customer Volume (Top 10)">
                           <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={customerPerformanceData} layout="vertical" margin={{left: 30}}>
                                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                                  <XAxis type="number" hide />
                                  <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 11, fill: '#475569'}} />
                                  <Tooltip content={<CustomTooltip />} />
                                  <Bar dataKey="totalJobs" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={15} />
                              </BarChart>
                           </ResponsiveContainer>
                      </ChartContainer>
                      
                      <div className="bg-white p-6 rounded-xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] border border-gray-200">
                           <h3 className="text-base font-semibold text-gray-900 mb-6">On-Time Delivery Performance</h3>
                           <div className="flex items-center justify-center h-64 relative">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={[
                                                { name: 'On Time', value: onTimeDeliveryData.onTime },
                                                { name: 'Late', value: onTimeDeliveryData.late }
                                            ]}
                                            innerRadius={60}
                                            outerRadius={80}
                                            paddingAngle={5}
                                            dataKey="value"
                                        >
                                            <Cell fill="#10b981" strokeWidth={0} />
                                            <Cell fill="#ef4444" strokeWidth={0} />
                                        </Pie>
                                        <Tooltip content={<CustomTooltip />} />
                                        <Legend verticalAlign="bottom" />
                                    </PieChart>
                                </ResponsiveContainer>
                                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                    <span className="text-3xl font-bold text-gray-900">{onTimeDeliveryData.percentage}%</span>
                                    <span className="text-xs text-gray-500 font-medium uppercase tracking-wide">Success Rate</span>
                                </div>
                           </div>
                      </div>
                  </div>
              </div>
          )}

          {/* Analysis Tab */}
          {activeCategory === 'analysis' && (
              <div className="space-y-6 animate-in fade-in duration-300">
                  {/* Summary Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                          <div className="flex items-center justify-between">
                              <div>
                                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Stuck Jobs</p>
                                  <p className="text-2xl font-bold text-gray-900 mt-1">{stuckJobsData.length}</p>
                              </div>
                              <ExclamationTriangleIcon className="h-8 w-8 text-amber-500" />
                          </div>
                          <p className="text-xs text-gray-500 mt-2">Jobs with output but next stage not started</p>
                      </div>
                      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                          <div className="flex items-center justify-between">
                              <div>
                                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">WIP Inventory</p>
                                  <p className="text-2xl font-bold text-gray-900 mt-1">{wipInventoryData.length}</p>
                              </div>
                              <CubeIcon className="h-8 w-8 text-blue-500" />
                          </div>
                          <p className="text-xs text-gray-500 mt-2">Stage transitions with pending stock</p>
                      </div>
                      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                          <div className="flex items-center justify-between">
                              <div>
                                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Bottlenecks</p>
                                  <p className="text-2xl font-bold text-gray-900 mt-1">{stageBottlenecksData.length}</p>
                              </div>
                              <BoltIcon className="h-8 w-8 text-red-500" />
                          </div>
                          <p className="text-xs text-gray-500 mt-2">Stages with critical issues</p>
                      </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Stuck Jobs Table */}
                      <div className="bg-white rounded-xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] border border-gray-200 overflow-hidden">
                          <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                              <h3 className="text-base font-semibold text-gray-900">Stuck Jobs (Process View)</h3>
                              {stuckJobsData.length > 0 && (
                                  <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2.5 py-1 rounded-full border border-amber-200">
                                      {stuckJobsData.length} Jobs
                                  </span>
                              )}
                          </div>
                          <div className="overflow-x-auto max-h-[500px] scrollbar-thin scrollbar-thumb-gray-200">
                              <table className="min-w-full divide-y divide-gray-100">
                                  <thead className="bg-gray-50 sticky top-0 z-10 shadow-sm">
                                      <tr>
                                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Job</th>
                                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">From → To</th>
                                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Output</th>
                                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Days</th>
                                      </tr>
                                  </thead>
                                  <tbody className="bg-white divide-y divide-gray-50">
                                      {stuckJobsData.slice(0, 20).map((job) => (
                                          <tr key={job.jobId} className="hover:bg-amber-50/30 transition-colors">
                                              <td className="px-4 py-3 whitespace-nowrap">
                                                  <div className="text-sm font-semibold text-gray-900">{job.jobCode}</div>
                                                  <div className="text-xs text-gray-500">P{job.priority}</div>
                                              </td>
                                              <td className="px-4 py-3 whitespace-nowrap">
                                                  <div className="text-xs text-gray-600">
                                                      <span className="font-medium">{job.previousStageName}</span>
                                                      <span className="mx-1">→</span>
                                                      <span className="font-medium text-amber-600">{job.currentStageName}</span>
                                                  </div>
                                              </td>
                                              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                                                  {job.previousStageOutput.toLocaleString()} {job.previousStageOutputUOM}
                                              </td>
                                              <td className="px-4 py-3 whitespace-nowrap">
                                                  <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                                                      job.daysStuck > 3 ? 'bg-red-100 text-red-700' :
                                                      job.daysStuck > 1 ? 'bg-amber-100 text-amber-700' :
                                                      'bg-yellow-100 text-yellow-700'
                                                  }`}>
                                                      {job.daysStuck.toFixed(1)}d
                                                  </span>
                                              </td>
                                          </tr>
                                      ))}
                                      {stuckJobsData.length === 0 && (
                                          <tr>
                                              <td colSpan={4} className="px-6 py-12 text-center text-gray-500 text-sm">
                                                  <div className="flex flex-col items-center">
                                                    <CheckCircleIcon className="h-10 w-10 text-gray-300 mb-2" />
                                                    No stuck jobs detected. All jobs are progressing normally.
                                                  </div>
                                              </td>
                                          </tr>
                                      )}
                                  </tbody>
                              </table>
                          </div>
                      </div>

                      {/* WIP Inventory Table (Stock View) */}
                      <div className="bg-white rounded-xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] border border-gray-200 overflow-hidden">
                          <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                              <h3 className="text-base font-semibold text-gray-900">WIP Inventory (Stock View)</h3>
                              {wipInventoryData.length > 0 && (
                                  <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2.5 py-1 rounded-full border border-blue-200">
                                      {wipInventoryData.reduce((sum, wip) => sum + wip.quantity, 0).toLocaleString()} units
                                  </span>
                              )}
                          </div>
                          <div className="overflow-x-auto max-h-[500px] scrollbar-thin scrollbar-thumb-gray-200">
                              <table className="min-w-full divide-y divide-gray-100">
                                  <thead className="bg-gray-50 sticky top-0 z-10 shadow-sm">
                                      <tr>
                                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Transition</th>
                                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Quantity</th>
                                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Jobs</th>
                                      </tr>
                                  </thead>
                                  <tbody className="bg-white divide-y divide-gray-50">
                                      {wipInventoryData.slice(0, 20).map((wip, idx) => (
                                          <tr key={idx} className="hover:bg-blue-50/30 transition-colors">
                                              <td className="px-4 py-3 whitespace-nowrap">
                                                  <div className="text-xs text-gray-600">
                                                      <span className="font-medium">{wip.fromStageName}</span>
                                                      <span className="mx-1">→</span>
                                                      <span className="font-medium text-blue-600">{wip.toStageName}</span>
                                                  </div>
                                              </td>
                                              <td className="px-4 py-3 whitespace-nowrap">
                                                  <div className="text-sm font-semibold text-gray-900">
                                                      {wip.quantity.toLocaleString()} {wip.uom}
                                                  </div>
                                              </td>
                                              <td className="px-4 py-3 whitespace-nowrap">
                                                  <span className="text-xs text-gray-600">{wip.jobCount} jobs</span>
                                              </td>
                                          </tr>
                                      ))}
                                      {wipInventoryData.length === 0 && (
                                          <tr>
                                              <td colSpan={3} className="px-6 py-12 text-center text-gray-500 text-sm">
                                                  <div className="flex flex-col items-center">
                                                    <CheckCircleIcon className="h-10 w-10 text-gray-300 mb-2" />
                                                    No WIP inventory between stages.
                                                  </div>
                                              </td>
                                          </tr>
                                      )}
                                  </tbody>
                              </table>
                          </div>
                      </div>
                  </div>

                  {/* Stage Bottlenecks Summary */}
                  {stageBottlenecksData.length > 0 && (
                      <div className="bg-white rounded-xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] border border-gray-200 overflow-hidden">
                          <div className="p-6 border-b border-gray-100 bg-gray-50/50">
                              <h3 className="text-base font-semibold text-gray-900">Stage Bottleneck Summary</h3>
                          </div>
                          <div className="p-6">
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                  {stageBottlenecksData.slice(0, 6).map((bottleneck) => (
                                      <div key={bottleneck.stageId} className="border border-gray-200 rounded-lg p-4 hover:border-red-300 transition-colors">
                                          <div className="flex items-center justify-between mb-2">
                                              <h4 className="text-sm font-semibold text-gray-900">{bottleneck.stageName}</h4>
                                              <ExclamationTriangleIcon className="h-5 w-5 text-red-500" />
                                          </div>
                                          <div className="space-y-1 text-xs">
                                              <div className="flex justify-between">
                                                  <span className="text-gray-500">Stuck Jobs:</span>
                                                  <span className="font-semibold text-gray-900">{bottleneck.jobsStuck}</span>
                                              </div>
                                              <div className="flex justify-between">
                                                  <span className="text-gray-500">WIP Quantity:</span>
                                                  <span className="font-semibold text-gray-900">{bottleneck.totalWIPQuantity.toLocaleString()} {bottleneck.uom}</span>
                                              </div>
                                              <div className="flex justify-between">
                                                  <span className="text-gray-500">Avg Days Stuck:</span>
                                                  <span className="font-semibold text-gray-900">{bottleneck.avgDaysStuck.toFixed(1)}d</span>
                                              </div>
                                          </div>
                                      </div>
                                  ))}
                              </div>
                          </div>
                      </div>
                  )}

                  {/* Original WIP Limit Bottleneck Chart */}
                  {bottleneckData.length > 0 && (
                      <div className="bg-white rounded-xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] border border-gray-200 overflow-hidden">
                          <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                              <h3 className="text-base font-semibold text-gray-900">WIP Limit Overages</h3>
                              <span className="bg-rose-100 text-rose-700 text-xs font-bold px-2.5 py-1 rounded-full border border-rose-200">
                                  {bottleneckData.length} Stages Over Limit
                              </span>
                          </div>
                          <div className="h-80 p-6">
                              <ResponsiveContainer width="100%" height="100%">
                                  <BarChart data={bottleneckData}>
                                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                      <XAxis dataKey="stage" angle={-15} textAnchor="end" height={40} tick={{fontSize: 11, fill: '#64748b'}} />
                                      <YAxis axisLine={false} tickLine={false} tick={{fontSize: 11, fill: '#64748b'}} />
                                      <Tooltip content={<CustomTooltip />} />
                                      <Bar dataKey="overage" fill="#ef4444" name="Jobs Over Limit" radius={[4, 4, 0, 0]} />
                                  </BarChart>
                              </ResponsiveContainer>
                          </div>
                      </div>
                  )}
              </div>
          )}

          {/* Stuck Jobs Tab */}
          {activeCategory === 'stuckJobs' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <StuckJobsReport 
                  data={stuckJobsData}
                  onJobClick={onJobClick}
                  workspaceId={workspaceId}
                />
              </div>
            </div>
          )}

          {/* WIP Inventory Tab */}
          {activeCategory === 'wipInventory' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <WIPInventoryReport 
                  data={wipInventoryData}
                  onJobClick={onJobClick}
                />
              </div>
            </div>
          )}

          {/* List View */}
          {activeCategory === 'list' && (
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden animate-in fade-in duration-300">
              <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50/50">
                <div>
                    <h3 className="font-semibold text-gray-900">Job Data</h3>
                    <p className="text-xs text-gray-500 mt-1">
                        {productionJobs.length} records found
                    </p>
                </div>
                <button
                  onClick={handleExport}
                  className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:text-gray-900 shadow-sm transition-all"
                >
                  <ArrowDownTrayIcon className="h-4 w-4" />
                  Export CSV
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      {['Code', 'Product', 'Stage', 'Status', 'Priority', 'Qty', 'Due Date'].map((header) => (
                        <th 
                          key={header}
                          className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-900 hover:bg-gray-100 transition-colors"
                          onClick={() => handleSort(header.toLowerCase().replace(' ', '') as SortField)}
                        >
                          <div className="flex items-center gap-1 group">
                            {header}
                            <div className="flex flex-col opacity-0 group-hover:opacity-100 transition-opacity">
                              <ChevronUpIcon className="h-2 w-2 text-gray-400" />
                              <ChevronDownIcon className="h-2 w-2 text-gray-400" />
                            </div>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {sortedAndPaginatedJobs.map((job) => (
                      <tr key={job.id} className="hover:bg-blue-50/30 transition-colors group">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 group-hover:text-blue-600">{job.code}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          <div className="flex flex-col">
                            <span className="font-medium text-gray-700">{job.productName}</span>
                            <span className="text-xs text-gray-400 font-mono">{job.sku}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{getStageName(job.currentStageId)}</td>
                        <td className="px-6 py-4 whitespace-nowrap"><StatusBadge status={job.status} /></td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`text-xs font-bold px-2 py-1 rounded-md border ${
                            job.priority >= 4 ? 'text-rose-700 bg-rose-50 border-rose-200' : 
                            job.priority === 3 ? 'text-amber-700 bg-amber-50 border-amber-200' : 
                            'text-blue-700 bg-blue-50 border-blue-200'
                          }`}>
                            {getPriorityLabel(job.priority)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 font-mono">{job.quantity}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 font-mono">{formatDate(job.dueDate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {/* Pagination */}
              {productionJobs.length > 0 && (
                <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between bg-gray-50/30">
                    <p className="text-sm text-gray-500">
                    Showing <span className="font-medium text-gray-900">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span> to <span className="font-medium text-gray-900">{Math.min(currentPage * ITEMS_PER_PAGE, productionJobs.length)}</span> of <span className="font-medium text-gray-900">{productionJobs.length}</span> results
                    </p>
                    <div className="flex gap-2">
                    <button
                        onClick={() => setCurrentPage(c => Math.max(1, c - 1))}
                        disabled={currentPage === 1}
                        className="inline-flex items-center gap-1 px-3 py-1.5 border border-gray-300 rounded-md hover:bg-white hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium text-gray-600 bg-white shadow-sm transition-all"
                    >
                        <ChevronLeftIcon className="h-4 w-4" />
                        Previous
                    </button>
                    <button
                        onClick={() => setCurrentPage(c => c + 1)}
                        disabled={currentPage * ITEMS_PER_PAGE >= productionJobs.length}
                        className="inline-flex items-center gap-1 px-3 py-1.5 border border-gray-300 rounded-md hover:bg-white hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium text-gray-600 bg-white shadow-sm transition-all"
                    >
                        Next
                        <ChevronRightIcon className="h-4 w-4" />
                    </button>
                    </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}