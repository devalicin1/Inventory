import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  listJobs,
  listWorkflows,
  listWorkcenters,
  listResources,
  listJobProductionRuns,
  type ProductionRun,
  type Job
} from '../api/production-jobs'
import {
  ChartBarIcon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  CubeIcon,
  TruckIcon,
  UserGroupIcon,
  CalendarIcon,
  ArrowDownTrayIcon
} from '@heroicons/react/24/outline'
import { toCSV, downloadCSV } from '../utils/csv'
import {
  WIPReport,
  ThroughputReport,
  OnTimeReport,
  CycleTimeReport,
  BottleneckReport,
  UtilizationReport,
  MaterialUsageReport,
  OutputReport,
  StageOutputReport,
  DeadlinesReport,
  EfficiencyReport,
  QualityReport,
  WorkcenterPerformanceReport,
  JobStatusReport,
  StageTimeReport
} from './production-reports'
import {
  calculateWIPByStage,
  calculateThroughput,
  calculateOnTimeDelivery,
  calculateCycleTime,
  calculateResourceUtilization,
  calculateMaterialUsage,
  calculateOutputPalletization,
  calculateStageOutput,
  calculateDeadlinesAcceptance,
  calculateEfficiency,
  calculateQualityMetrics,
  calculateWorkcenterPerformance,
  calculateJobStatusSummary,
  calculateStageTimeAnalysis
} from './production-reports/utils'

interface ProductionReportsProps {
  workspaceId: string
  jobs?: Job[]
}

type ReportType = 'wip' | 'throughput' | 'onTime' | 'cycleTime' | 'bottleneck' | 'utilization' | 'materialUsage' | 'output' | 'deadlines' | 'stageOutput' | 'efficiency' | 'quality' | 'workcenterPerformance' | 'jobStatus' | 'stageTime'

export function ProductionReports({ workspaceId, jobs: externalJobs }: ProductionReportsProps) {
  const [selectedReport, setSelectedReport] = useState<ReportType>('wip')
  const [dateRange, setDateRange] = useState({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days ago
    end: new Date().toISOString().split('T')[0] // today
  })

  // Fetch data
  const { data: jobsData } = useQuery({
    queryKey: ['jobs', workspaceId],
    queryFn: () => listJobs(workspaceId),
    enabled: !externalJobs
  })

  const { data: workflows = [] } = useQuery({
    queryKey: ['workflows', workspaceId],
    queryFn: () => listWorkflows(workspaceId),
  })

  const { data: workcenters = [] } = useQuery({
    queryKey: ['workcenters', workspaceId],
    queryFn: () => listWorkcenters(workspaceId),
  })

  const { data: resources = [] } = useQuery({
    queryKey: ['resources', workspaceId],
    queryFn: () => listResources(workspaceId),
  })

  const jobs = externalJobs || jobsData?.jobs || []
  const filteredJobs = jobs.filter(job => {
    const jobDate = new Date(job.createdAt?.seconds ? job.createdAt.seconds * 1000 : job.createdAt)
    return jobDate >= new Date(dateRange.start) && jobDate <= new Date(dateRange.end)
  })

  const reports = [
    { id: 'wip', name: 'WIP by Stage', icon: ChartBarIcon, description: 'Work in progress distribution across stages' },
    { id: 'throughput', name: 'Throughput', icon: CheckCircleIcon, description: 'Jobs completed over time' },
    { id: 'onTime', name: 'On-Time Delivery', icon: ClockIcon, description: 'Percentage of jobs delivered on time' },
    { id: 'cycleTime', name: 'Cycle Time', icon: ClockIcon, description: 'Average time to complete jobs' },
    { id: 'bottleneck', name: 'Bottleneck Analysis', icon: ExclamationTriangleIcon, description: 'Identify production bottlenecks' },
    { id: 'utilization', name: 'Resource Utilization', icon: UserGroupIcon, description: 'Resource and workcenter utilization' },
    { id: 'materialUsage', name: 'Material Usage', icon: CubeIcon, description: 'Material consumption analysis' },
    { id: 'output', name: 'Output & Palletization', icon: TruckIcon, description: 'Production output and packaging metrics' },
    { id: 'deadlines', name: 'Deadlines & Acceptance', icon: CalendarIcon, description: 'Deadline tracking and acceptance rates' },
    { id: 'stageOutput', name: 'Stage Output Report', icon: CheckCircleIcon, description: 'Output results by job and stage' },
    { id: 'efficiency', name: 'Production Efficiency', icon: ChartBarIcon, description: 'Overall production efficiency metrics' },
    { id: 'quality', name: 'Quality Metrics', icon: CheckCircleIcon, description: 'Scrap rate, rework, and quality analysis' },
    { id: 'workcenterPerformance', name: 'Workcenter Performance', icon: UserGroupIcon, description: 'Performance metrics by workcenter' },
    { id: 'jobStatus', name: 'Job Status Summary', icon: ChartBarIcon, description: 'Summary of jobs by status' },
    { id: 'stageTime', name: 'Stage Time Analysis', icon: ClockIcon, description: 'Time spent in each production stage' },
  ]

  // Fetch production runs for all filtered jobs
  const { data: allRunsData } = useQuery({
    queryKey: ['allProductionRuns', workspaceId, filteredJobs.map(j => j.id).join(',')],
    queryFn: async () => {
      const runsMap: { [jobId: string]: ProductionRun[] } = {}
      await Promise.all(
        filteredJobs.map(async (job) => {
          try {
            const runs = await listJobProductionRuns(workspaceId, job.id)
            runsMap[job.id] = runs
          } catch (error) {
            console.error(`Error fetching runs for job ${job.id}:`, error)
            runsMap[job.id] = []
          }
        })
      )
      return runsMap
    },
    enabled: filteredJobs.length > 0 && (selectedReport === 'stageOutput' || selectedReport === 'quality' || selectedReport === 'workcenterPerformance'),
  })

  // Calculate report data
  const wipData = calculateWIPByStage(filteredJobs, workflows)
  const throughputData = calculateThroughput(filteredJobs)
  const onTimeData = calculateOnTimeDelivery(filteredJobs)
  const cycleTimeData = calculateCycleTime(filteredJobs)
  const utilizationData = calculateResourceUtilization(filteredJobs, resources)
  const materialUsageData = calculateMaterialUsage(filteredJobs)
  const outputData = calculateOutputPalletization(filteredJobs)
  const stageOutputData = calculateStageOutput(filteredJobs, allRunsData, workflows, workcenters)
  const deadlinesData = calculateDeadlinesAcceptance(jobs)
  const efficiencyData = calculateEfficiency(filteredJobs, cycleTimeData, onTimeData)
  const qualityData = calculateQualityMetrics(filteredJobs, allRunsData)
  const workcenterData = calculateWorkcenterPerformance(filteredJobs, allRunsData, workcenters)
  const jobStatusData = calculateJobStatusSummary(jobs)
  const stageTimeData = calculateStageTimeAnalysis(filteredJobs, workflows)

  const renderReport = () => {
    switch (selectedReport) {
      case 'wip':
        return <WIPReport data={wipData} />
      case 'throughput':
        return <ThroughputReport data={throughputData} />
      case 'onTime':
        return <OnTimeReport data={onTimeData} />
      case 'cycleTime':
        return <CycleTimeReport data={cycleTimeData} />
      case 'bottleneck':
        return <BottleneckReport data={wipData} />
      case 'utilization':
        return <UtilizationReport data={utilizationData} />
      case 'materialUsage':
        return <MaterialUsageReport data={materialUsageData} />
      case 'output':
        return <OutputReport data={outputData} />
      case 'deadlines':
        return <DeadlinesReport data={deadlinesData} />
      case 'stageOutput':
        return <StageOutputReport data={stageOutputData} />
      case 'efficiency':
        return <EfficiencyReport data={efficiencyData} />
      case 'quality':
        return <QualityReport data={qualityData} />
      case 'workcenterPerformance':
        return <WorkcenterPerformanceReport data={workcenterData} />
      case 'jobStatus':
        return <JobStatusReport data={jobStatusData} />
      case 'stageTime':
        return <StageTimeReport data={stageTimeData} />
      default:
        return null
    }
  }

  const exportReport = () => {
    let exportData: any[] = []
    let filename = ''

    switch (selectedReport) {
      case 'wip':
        exportData = wipData
        filename = 'wip_by_stage.csv'
        break
      case 'throughput':
        exportData = throughputData
        filename = 'throughput.csv'
        break
      case 'materialUsage':
        exportData = materialUsageData
        filename = 'material_usage.csv'
        break
      case 'output':
        exportData = outputData
        filename = 'output_palletization.csv'
        break
      case 'deadlines':
        exportData = deadlinesData.upcomingDeadlines
        filename = 'deadlines_acceptance.csv'
        break
      case 'stageOutput':
        exportData = stageOutputData
        filename = 'stage_output_report.csv'
        break
      case 'efficiency':
        exportData = [efficiencyData]
        filename = 'production_efficiency.csv'
        break
      case 'quality':
        exportData = qualityData.jobs
        filename = 'quality_metrics.csv'
        break
      case 'workcenterPerformance':
        exportData = workcenterData
        filename = 'workcenter_performance.csv'
        break
      case 'jobStatus':
        exportData = jobStatusData
        filename = 'job_status_summary.csv'
        break
      case 'stageTime':
        exportData = stageTimeData
        filename = 'stage_time_analysis.csv'
        break
      default:
        return
    }

    downloadCSV(filename, toCSV(exportData))
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Production Reports</h2>
          <p className="text-sm text-gray-600">Analytics and insights for production management</p>
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium text-gray-700">Date Range:</label>
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
              className="px-3 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-500">to</span>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
              className="px-3 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            onClick={exportReport}
            className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
          >
            <ArrowDownTrayIcon className="h-4 w-4 mr-1" />
            Export
          </button>
        </div>
      </div>

      {/* Report Selection */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {reports.map((report) => {
          const Icon = report.icon
          return (
            <button
              key={report.id}
              onClick={() => setSelectedReport(report.id as ReportType)}
              className={`p-4 rounded-lg border text-left transition-colors ${selectedReport === report.id
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
            >
              <Icon className="h-6 w-6 text-gray-600 mb-2" />
              <h3 className="text-sm font-medium text-gray-900">{report.name}</h3>
              <p className="text-xs text-gray-600 mt-1">{report.description}</p>
            </button>
          )
        })}
      </div>

      {/* Report Content */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        {renderReport()}
      </div>
    </div>
  )
}
