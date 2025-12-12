import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  listJobs,
  listWorkflows,
  listWorkcenters,
  listJobProductionRuns,
  type ProductionRun
} from '../../api/production-jobs'
import {
  ChartBarIcon,
  PresentationChartLineIcon,
  ArrowTrendingUpIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  CubeIcon,
  ClockIcon,
  ListBulletIcon,
  FunnelIcon,
  ChevronLeftIcon
} from '@heroicons/react/24/outline'
import { ProductionReportsTab } from '../job-detail/tabs/ProductionReportsTab'
import { StuckJobsReport } from './StuckJobsReport'
import { WIPInventoryReport } from './WIPInventoryReport'
import {
  detectStuckJobs,
  calculateWIPInventoryBetweenStages,
  type StuckJobData,
  type WIPInventoryData
} from './utils'

interface ProductionReportsBoardProps {
  workspaceId: string
  onJobClick?: (jobId: string) => void
}

type ReportType = 
  | 'overview' 
  | 'distribution' 
  | 'trends' 
  | 'performance' 
  | 'analysis'
  | 'stuckJobs'
  | 'wipInventory'
  | 'list'

export function ProductionReportsBoard({ workspaceId, onJobClick }: ProductionReportsBoardProps) {
  const [selectedReport, setSelectedReport] = useState<ReportType | null>(null)

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

  const allJobs = jobsData?.jobs || []
  const productionJobs = useMemo(() => {
    return allJobs.filter(job => 
      job.status !== 'draft' && job.status !== 'cancelled'
    )
  }, [allJobs])

  // Fetch production runs for all production jobs
  const productionJobIds = useMemo(() => {
    return productionJobs.map(job => job.id).sort()
  }, [productionJobs])

  const { data: allRunsData } = useQuery({
    queryKey: ['production-runs', workspaceId, productionJobIds.length],
    queryFn: async () => {
      if (productionJobIds.length === 0) return {}
      
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
      
      const grouped: { [jobId: string]: ProductionRun[] } = {}
      runsResults.forEach(({ jobId, runs }) => {
        grouped[jobId] = runs
      })
      
      return grouped
    },
    enabled: productionJobIds.length > 0 && (selectedReport === 'stuckJobs' || selectedReport === 'wipInventory'),
  })

  const stuckJobsData = useMemo(() => {
    if (!allRunsData) return []
    return detectStuckJobs(productionJobs, allRunsData, workflows, workcenters)
  }, [productionJobs, allRunsData, workflows, workcenters])

  const wipInventoryData = useMemo(() => {
    if (!allRunsData) return []
    return calculateWIPInventoryBetweenStages(productionJobs, allRunsData, workflows)
  }, [productionJobs, allRunsData, workflows])

  const reports = [
    {
      id: 'overview' as ReportType,
      name: 'Overview',
      description: 'Key metrics and KPIs overview',
      icon: PresentationChartLineIcon,
      color: 'blue'
    },
    {
      id: 'distribution' as ReportType,
      name: 'Distribution',
      description: 'Status and stage distribution analysis',
      icon: ChartBarIcon,
      color: 'indigo'
    },
    {
      id: 'trends' as ReportType,
      name: 'Trends',
      description: 'Production volume and throughput trends',
      icon: ArrowTrendingUpIcon,
      color: 'green'
    },
    {
      id: 'performance' as ReportType,
      name: 'Performance',
      description: 'Cycle time and delivery performance',
      icon: CheckCircleIcon,
      color: 'emerald'
    },
    {
      id: 'analysis' as ReportType,
      name: 'Analysis',
      description: 'Bottlenecks and risk analysis',
      icon: FunnelIcon,
      color: 'amber'
    },
    {
      id: 'stuckJobs' as ReportType,
      name: 'Stuck Jobs',
      description: `${stuckJobsData.length} jobs stuck between stages`,
      icon: ExclamationTriangleIcon,
      color: 'red',
      badge: stuckJobsData.length
    },
    {
      id: 'wipInventory' as ReportType,
      name: 'WIP Inventory',
      description: 'Work in progress inventory between stages',
      icon: CubeIcon,
      color: 'purple'
    },
    {
      id: 'list' as ReportType,
      name: 'Job List',
      description: 'Detailed job data and filtering',
      icon: ListBulletIcon,
      color: 'gray'
    }
  ]

  const handleJobClick = (jobId: string) => {
    if (onJobClick) {
      onJobClick(jobId)
    }
  }

  if (jobsLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="h-20 bg-gray-100 animate-pulse rounded-lg" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1,2,3,4,5,6,7,8].map(i => <div key={i} className="h-32 bg-gray-100 animate-pulse rounded-xl" />)}
        </div>
      </div>
    )
  }

  // If a report is selected, show its content
  if (selectedReport) {
    if (selectedReport === 'stuckJobs') {
      return (
        <div className="space-y-4">
          <button
            onClick={() => setSelectedReport(null)}
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-4"
          >
            <ChevronLeftIcon className="h-4 w-4" />
            Back to Reports
          </button>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <StuckJobsReport 
              data={stuckJobsData} 
              onJobClick={handleJobClick}
            />
          </div>
        </div>
      )
    }

    if (selectedReport === 'wipInventory') {
      return (
        <div className="space-y-4">
          <button
            onClick={() => setSelectedReport(null)}
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-4"
          >
            <ChevronLeftIcon className="h-4 w-4" />
            Back to Reports
          </button>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <WIPInventoryReport 
              data={wipInventoryData}
              onJobClick={handleJobClick}
            />
          </div>
        </div>
      )
    }

    // For other reports, use the ProductionReportsTab with the specific category
    return (
      <div className="space-y-4">
        <button
          onClick={() => setSelectedReport(null)}
          className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-4"
        >
          <ChevronLeftIcon className="h-4 w-4" />
          Back to Reports
        </button>
        <ProductionReportsTab 
          workspaceId={workspaceId}
          initialCategory={selectedReport}
        />
      </div>
    )
  }

  // Show report cards
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Production Reports</h2>
        <p className="text-sm text-gray-500 mt-1">Analytics and insights for production management</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {reports.map((report) => {
          const Icon = report.icon
          const colorClasses = {
            blue: 'border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700',
            indigo: 'border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700',
            green: 'border-green-200 bg-green-50 hover:bg-green-100 text-green-700',
            emerald: 'border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-700',
            amber: 'border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-700',
            red: 'border-red-200 bg-red-50 hover:bg-red-100 text-red-700',
            purple: 'border-purple-200 bg-purple-50 hover:bg-purple-100 text-purple-700',
            gray: 'border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-700'
          }

          return (
            <button
              key={report.id}
              onClick={() => setSelectedReport(report.id)}
              className={`p-6 rounded-xl border-2 text-left transition-all hover:shadow-md ${colorClasses[report.color as keyof typeof colorClasses]}`}
            >
              <div className="flex items-start justify-between mb-3">
                <Icon className="h-8 w-8" />
                {report.badge !== undefined && report.badge > 0 && (
                  <span className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                    {report.badge}
                  </span>
                )}
              </div>
              <h3 className="text-lg font-semibold mb-1">{report.name}</h3>
              <p className="text-sm opacity-80">{report.description}</p>
            </button>
          )
        })}
      </div>
    </div>
  )
}
