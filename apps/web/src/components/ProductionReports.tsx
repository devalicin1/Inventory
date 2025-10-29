import { useState, type FC } from 'react'
import { useQuery } from '@tanstack/react-query'
import { 
  Job, 
  listJobs, 
  listWorkflows, 
  listWorkcenters, 
  listResources 
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

interface ProductionReportsProps {
  workspaceId: string
}

type ReportType = 'wip' | 'throughput' | 'onTime' | 'cycleTime' | 'bottleneck' | 'utilization' | 'materialUsage' | 'output' | 'deadlines'

export function ProductionReports({ workspaceId }: ProductionReportsProps) {
  const [selectedReport, setSelectedReport] = useState<ReportType>('wip')
  const [dateRange, setDateRange] = useState({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days ago
    end: new Date().toISOString().split('T')[0] // today
  })

  // Fetch data
  const { data: jobsData } = useQuery({
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

  const { data: resources = [] } = useQuery({
    queryKey: ['resources', workspaceId],
    queryFn: () => listResources(workspaceId),
  })

  const jobs = jobsData?.jobs || []
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
  ]

  // Calculate WIP by Stage
  const wipByStage = () => {
    const stageCounts: { [key: string]: number } = {}
    jobs.forEach(job => {
      stageCounts[job.currentStageId] = (stageCounts[job.currentStageId] || 0) + 1
    })
    return Object.entries(stageCounts).map(([stage, count]) => ({ stage, count }))
  }

  // Calculate Throughput
  const throughput = () => {
    const completedJobs = filteredJobs.filter(job => job.status === 'done')
    const dailyCounts: { [key: string]: number } = {}
    
    completedJobs.forEach(job => {
      const date = new Date(job.updatedAt?.seconds ? job.updatedAt.seconds * 1000 : job.updatedAt).toISOString().split('T')[0]
      dailyCounts[date] = (dailyCounts[date] || 0) + 1
    })
    
    return Object.entries(dailyCounts)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, count }))
  }

  // Calculate On-Time Delivery
  const onTimeDelivery = () => {
    const completedJobs = filteredJobs.filter(job => job.status === 'done')
    const onTimeJobs = completedJobs.filter(job => {
      const completedDate = new Date(job.updatedAt?.seconds ? job.updatedAt.seconds * 1000 : job.updatedAt)
      const dueDate = new Date(job.dueDate)
      return completedDate <= dueDate
    })
    
    return {
      total: completedJobs.length,
      onTime: onTimeJobs.length,
      percentage: completedJobs.length > 0 ? (onTimeJobs.length / completedJobs.length) * 100 : 0
    }
  }

  // Calculate Cycle Time
  const cycleTime = () => {
    const completedJobs = filteredJobs.filter(job => job.status === 'done')
    const cycleTimes = completedJobs.map(job => {
      const startDate = new Date(job.createdAt?.seconds ? job.createdAt.seconds * 1000 : job.createdAt)
      const endDate = new Date(job.updatedAt?.seconds ? job.updatedAt.seconds * 1000 : job.updatedAt)
      return (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24) // days
    })
    
    const average = cycleTimes.length > 0 ? cycleTimes.reduce((sum, time) => sum + time, 0) / cycleTimes.length : 0
    return { average, cycleTimes }
  }

  // Calculate Resource Utilization
  const resourceUtilization = () => {
    const utilization: { [key: string]: { assigned: number; total: number } } = {}
    
    resources.forEach(resource => {
      utilization[resource.id] = { assigned: 0, total: 1 }
    })
    
    jobs.forEach(job => {
      job.assignees.forEach(assigneeId => {
        if (utilization[assigneeId]) {
          utilization[assigneeId].assigned += 1
        }
      })
    })
    
    return Object.entries(utilization).map(([resourceId, data]) => {
      const resource = resources.find(r => r.id === resourceId)
      return {
        resourceId,
        resourceName: resource?.name || 'Unknown',
        assigned: data.assigned,
        total: data.total,
        utilization: (data.assigned / data.total) * 100
      }
    })
  }

  // Calculate Material Usage
  const materialUsage = () => {
    const materialData: { [key: string]: { required: number; consumed: number; variance: number } } = {}
    
    jobs.forEach(job => {
      job.bom.forEach(item => {
        if (!materialData[item.sku]) {
          materialData[item.sku] = { required: 0, consumed: 0, variance: 0 }
        }
        materialData[item.sku].required += item.qtyRequired
        materialData[item.sku].consumed += item.consumed
      })
    })
    
    Object.keys(materialData).forEach(sku => {
      materialData[sku].variance = materialData[sku].consumed - materialData[sku].required
    })
    
    return Object.entries(materialData).map(([sku, data]) => ({
      sku,
      ...data,
      variancePercentage: data.required > 0 ? (data.variance / data.required) * 100 : 0
    }))
  }

  // Calculate Output & Palletization
  const outputPalletization = () => {
    const outputData = jobs.map(job => {
      const totalPlanned = job.output.reduce((sum, item) => sum + item.qtyPlanned, 0)
      const totalProduced = job.output.reduce((sum, item) => sum + item.qtyProduced, 0)
      const plannedBoxes = job.packaging?.plannedBoxes || 0
      const actualBoxes = job.packaging?.actualBoxes || 0
      const plannedPallets = job.packaging?.plannedPallets || 0
      const actualPallets = job.packaging?.actualPallets || 0
      
      return {
        jobCode: job.code,
        sku: job.sku,
        totalPlanned,
        totalProduced,
        productionPercentage: totalPlanned > 0 ? (totalProduced / totalPlanned) * 100 : 0,
        plannedBoxes,
        actualBoxes,
        boxVariance: actualBoxes - plannedBoxes,
        plannedPallets,
        actualPallets,
        palletVariance: actualPallets - plannedPallets
      }
    })
    
    return outputData
  }

  // Calculate Deadlines & Acceptance
  const deadlinesAcceptance = () => {
    const upcomingDeadlines = jobs
      .filter(job => job.status !== 'done' && job.status !== 'cancelled')
      .map(job => ({
        jobCode: job.code,
        productName: job.productName,
        dueDate: new Date(job.dueDate),
        status: job.status,
        daysUntilDue: Math.ceil((new Date(job.dueDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)),
        qaAccepted: !!job.qaAcceptedAt,
        customerAccepted: !!job.customerAcceptedAt
      }))
      .sort((a, b) => a.daysUntilDue - b.daysUntilDue)
    
    const acceptanceStats = {
      totalJobs: jobs.length,
      qaAccepted: jobs.filter(job => job.qaAcceptedAt).length,
      customerAccepted: jobs.filter(job => job.customerAcceptedAt).length,
      qaAcceptanceRate: jobs.length > 0 ? (jobs.filter(job => job.qaAcceptedAt).length / jobs.length) * 100 : 0,
      customerAcceptanceRate: jobs.length > 0 ? (jobs.filter(job => job.customerAcceptedAt).length / jobs.length) * 100 : 0
    }
    
    return { upcomingDeadlines, acceptanceStats }
  }

  const renderReport = () => {
    switch (selectedReport) {
      case 'wip':
        return <WIPReport data={wipByStage()} />
      case 'throughput':
        return <ThroughputReport data={throughput()} />
      case 'onTime':
        return <OnTimeReport data={onTimeDelivery()} />
      case 'cycleTime':
        return <CycleTimeReport data={cycleTime()} />
      case 'bottleneck':
        return <BottleneckReport data={wipByStage()} />
      case 'utilization':
        return <UtilizationReport data={resourceUtilization()} />
      case 'materialUsage':
        return <MaterialUsageReport data={materialUsage()} />
      case 'output':
        return <OutputReport data={outputPalletization()} />
      case 'deadlines':
        return <DeadlinesReport data={deadlinesAcceptance()} />
      default:
        return null
    }
  }

  const exportReport = () => {
    let exportData: any[] = []
    let filename = ''

    switch (selectedReport) {
      case 'wip':
        exportData = wipByStage()
        filename = 'wip_by_stage.csv'
        break
      case 'throughput':
        exportData = throughput()
        filename = 'throughput.csv'
        break
      case 'materialUsage':
        exportData = materialUsage()
        filename = 'material_usage.csv'
        break
      case 'output':
        exportData = outputPalletization()
        filename = 'output_palletization.csv'
        break
      case 'deadlines':
        exportData = deadlinesAcceptance().upcomingDeadlines
        filename = 'deadlines_acceptance.csv'
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
              onChange={(e) => setDateRange({...dateRange, start: e.target.value})}
              className="px-3 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-500">to</span>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange({...dateRange, end: e.target.value})}
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
              className={`p-4 rounded-lg border text-left transition-colors ${
                selectedReport === report.id
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

// Report Components
const WIPReport: FC<{ data: { stage: string; count: number }[] }> = ({ data }) => {
  const total = data.reduce((sum, item) => sum + item.count, 0)
  
  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Work in Progress by Stage</h3>
      <div className="space-y-3">
        {data.map((item) => (
          <div key={item.stage} className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">{item.stage}</span>
            <div className="flex items-center space-x-3">
              <div className="w-32 bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-500 h-2 rounded-full"
                  style={{ width: `${total > 0 ? (item.count / total) * 100 : 0}%` }}
                />
              </div>
              <span className="text-sm text-gray-900 w-8">{item.count}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="flex justify-between text-sm font-medium text-gray-900">
          <span>Total WIP</span>
          <span>{total}</span>
        </div>
      </div>
    </div>
  )
}

const ThroughputReport: FC<{ data: { date: string; count: number }[] }> = ({ data }) => {
  const total = data.reduce((sum, item) => sum + item.count, 0)
  const average = data.length > 0 ? total / data.length : 0
  
  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Throughput Analysis</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-blue-50 rounded-lg p-4">
          <div className="text-2xl font-bold text-blue-900">{total}</div>
          <div className="text-sm text-blue-700">Total Completed</div>
        </div>
        <div className="bg-green-50 rounded-lg p-4">
          <div className="text-2xl font-bold text-green-900">{average.toFixed(1)}</div>
          <div className="text-sm text-green-700">Average per Day</div>
        </div>
        <div className="bg-purple-50 rounded-lg p-4">
          <div className="text-2xl font-bold text-purple-900">{data.length}</div>
          <div className="text-sm text-purple-700">Active Days</div>
        </div>
      </div>
      <div className="space-y-2">
        {data.slice(-10).map((item) => (
          <div key={item.date} className="flex items-center justify-between py-2 border-b border-gray-100">
            <span className="text-sm text-gray-700">{new Date(item.date).toLocaleDateString()}</span>
            <span className="text-sm font-medium text-gray-900">{item.count} jobs</span>
          </div>
        ))}
      </div>
    </div>
  )
}

const OnTimeReport: FC<{ data: { total: number; onTime: number; percentage: number } }> = ({ data }) => {
  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-900 mb-4">On-Time Delivery Performance</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-blue-50 rounded-lg p-4">
          <div className="text-2xl font-bold text-blue-900">{data.total}</div>
          <div className="text-sm text-blue-700">Total Completed</div>
        </div>
        <div className="bg-green-50 rounded-lg p-4">
          <div className="text-2xl font-bold text-green-900">{data.onTime}</div>
          <div className="text-sm text-green-700">On Time</div>
        </div>
        <div className="bg-purple-50 rounded-lg p-4">
          <div className="text-2xl font-bold text-purple-900">{data.percentage.toFixed(1)}%</div>
          <div className="text-sm text-purple-700">On-Time Rate</div>
        </div>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-4">
        <div
          className="bg-green-500 h-4 rounded-full"
          style={{ width: `${data.percentage}%` }}
        />
      </div>
    </div>
  )
}

const CycleTimeReport: FC<{ data: { average: number; cycleTimes: number[] } }> = ({ data }) => {
  const min = Math.min(...data.cycleTimes)
  const max = Math.max(...data.cycleTimes)
  
  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Cycle Time Analysis</h3>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-blue-50 rounded-lg p-4">
          <div className="text-2xl font-bold text-blue-900">{data.average.toFixed(1)}</div>
          <div className="text-sm text-blue-700">Average (days)</div>
        </div>
        <div className="bg-green-50 rounded-lg p-4">
          <div className="text-2xl font-bold text-green-900">{min.toFixed(1)}</div>
          <div className="text-sm text-green-700">Minimum (days)</div>
        </div>
        <div className="bg-red-50 rounded-lg p-4">
          <div className="text-2xl font-bold text-red-900">{max.toFixed(1)}</div>
          <div className="text-sm text-red-700">Maximum (days)</div>
        </div>
        <div className="bg-purple-50 rounded-lg p-4">
          <div className="text-2xl font-bold text-purple-900">{data.cycleTimes.length}</div>
          <div className="text-sm text-purple-700">Sample Size</div>
        </div>
      </div>
    </div>
  )
}

const BottleneckReport: FC<{ data: { stage: string; count: number }[] }> = ({ data }) => {
  const sortedData = [...data].sort((a, b) => b.count - a.count)
  const maxCount = Math.max(...data.map(item => item.count))
  
  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Bottleneck Analysis</h3>
      <div className="space-y-3">
        {sortedData.map((item, index) => (
          <div key={item.stage} className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <span className="text-sm font-medium text-gray-700 w-8">#{index + 1}</span>
              <span className="text-sm text-gray-900">{item.stage}</span>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-32 bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${
                    index === 0 ? 'bg-red-500' : index === 1 ? 'bg-yellow-500' : 'bg-blue-500'
                  }`}
                  style={{ width: `${maxCount > 0 ? (item.count / maxCount) * 100 : 0}%` }}
                />
              </div>
              <span className="text-sm text-gray-900 w-8">{item.count}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

const UtilizationReport: FC<{ data: { resourceId: string; resourceName: string; assigned: number; total: number; utilization: number }[] }> = ({ data }) => {
  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Resource Utilization</h3>
      <div className="space-y-3">
        {data.map((item) => (
          <div key={item.resourceId} className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">{item.resourceName}</span>
            <div className="flex items-center space-x-3">
              <div className="w-32 bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${
                    item.utilization > 80 ? 'bg-red-500' : 
                    item.utilization > 60 ? 'bg-yellow-500' : 'bg-green-500'
                  }`}
                  style={{ width: `${Math.min(item.utilization, 100)}%` }}
                />
              </div>
              <span className="text-sm text-gray-900 w-16">{item.utilization.toFixed(1)}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

const MaterialUsageReport: FC<{ data: { sku: string; required: number; consumed: number; variance: number; variancePercentage: number }[] }> = ({ data }) => {
  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Material Usage Analysis</h3>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SKU</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Required</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Consumed</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Variance</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Variance %</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {data.map((item) => (
              <tr key={item.sku}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{item.sku}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.required.toFixed(2)}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.consumed.toFixed(2)}</td>
                <td className={`px-6 py-4 whitespace-nowrap text-sm ${
                  item.variance > 0 ? 'text-red-600' : item.variance < 0 ? 'text-green-600' : 'text-gray-900'
                }`}>
                  {item.variance > 0 ? '+' : ''}{item.variance.toFixed(2)}
                </td>
                <td className={`px-6 py-4 whitespace-nowrap text-sm ${
                  item.variancePercentage > 0 ? 'text-red-600' : item.variancePercentage < 0 ? 'text-green-600' : 'text-gray-900'
                }`}>
                  {item.variancePercentage > 0 ? '+' : ''}{item.variancePercentage.toFixed(1)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const OutputReport: FC<{ data: { jobCode: string; sku: string; totalPlanned: number; totalProduced: number; productionPercentage: number; plannedBoxes: number; actualBoxes: number; boxVariance: number; plannedPallets: number; actualPallets: number; palletVariance: number }[] }> = ({ data }) => {
  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Output & Palletization Analysis</h3>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Job Code</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SKU</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Production %</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Boxes</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Box Variance</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pallets</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pallet Variance</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {data.map((item) => (
              <tr key={item.jobCode}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{item.jobCode}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.sku}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.productionPercentage.toFixed(1)}%</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.actualBoxes}/{item.plannedBoxes}</td>
                <td className={`px-6 py-4 whitespace-nowrap text-sm ${
                  item.boxVariance > 0 ? 'text-red-600' : item.boxVariance < 0 ? 'text-green-600' : 'text-gray-900'
                }`}>
                  {item.boxVariance > 0 ? '+' : ''}{item.boxVariance}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.actualPallets}/{item.plannedPallets}</td>
                <td className={`px-6 py-4 whitespace-nowrap text-sm ${
                  item.palletVariance > 0 ? 'text-red-600' : item.palletVariance < 0 ? 'text-green-600' : 'text-gray-900'
                }`}>
                  {item.palletVariance > 0 ? '+' : ''}{item.palletVariance}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const DeadlinesReport: FC<{ data: { upcomingDeadlines: any[]; acceptanceStats: any } }> = ({ data }) => {
  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Deadlines & Acceptance Tracking</h3>
      
      {/* Acceptance Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-blue-50 rounded-lg p-4">
          <div className="text-2xl font-bold text-blue-900">{data.acceptanceStats.totalJobs}</div>
          <div className="text-sm text-blue-700">Total Jobs</div>
        </div>
        <div className="bg-green-50 rounded-lg p-4">
          <div className="text-2xl font-bold text-green-900">{data.acceptanceStats.qaAccepted}</div>
          <div className="text-sm text-green-700">QA Accepted</div>
        </div>
        <div className="bg-purple-50 rounded-lg p-4">
          <div className="text-2xl font-bold text-purple-900">{data.acceptanceStats.customerAccepted}</div>
          <div className="text-sm text-purple-700">Customer Accepted</div>
        </div>
        <div className="bg-yellow-50 rounded-lg p-4">
          <div className="text-2xl font-bold text-yellow-900">{data.acceptanceStats.qaAcceptanceRate.toFixed(1)}%</div>
          <div className="text-sm text-yellow-700">QA Acceptance Rate</div>
        </div>
      </div>

      {/* Upcoming Deadlines */}
      <div>
        <h4 className="text-md font-semibold text-gray-900 mb-3">Upcoming Deadlines</h4>
        <div className="space-y-2">
          {data.upcomingDeadlines.slice(0, 10).map((deadline) => (
            <div key={deadline.jobCode} className="flex items-center justify-between py-2 border-b border-gray-100">
              <div className="flex items-center space-x-3">
                <span className="text-sm font-medium text-gray-900">{deadline.jobCode}</span>
                <span className="text-sm text-gray-600">{deadline.productName}</span>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  deadline.daysUntilDue < 0 ? 'bg-red-100 text-red-800' :
                  deadline.daysUntilDue <= 3 ? 'bg-yellow-100 text-yellow-800' :
                  'bg-green-100 text-green-800'
                }`}>
                  {deadline.daysUntilDue < 0 ? 'Overdue' : `${deadline.daysUntilDue} days`}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                {deadline.qaAccepted && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    QA ✓
                  </span>
                )}
                {deadline.customerAccepted && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    Customer ✓
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}