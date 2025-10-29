import { useState, type FC } from 'react'
import { 
  Job, 
  Workflow, 
  Workcenter, 
  Resource,
  listJobs,
  listWorkflows,
  listWorkcenters,
  listResources,
  moveJobToStage,
  setJobStatus
} from '../api/production-jobs'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { 
  PlayIcon,
  PauseIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  UserGroupIcon,
  CubeIcon,
  TruckIcon
} from '@heroicons/react/24/outline'

interface ProductionBoardProps {
  workspaceId: string
  onJobClick?: (job: Job) => void
}

interface StageColumn {
  id: string
  name: string
  color: string
  wipLimit?: number
  currentCount: number
  jobs: Job[]
}

export function ProductionBoard({ workspaceId, onJobClick }: ProductionBoardProps) {
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [swimlane, setSwimlane] = useState<'workcenter' | 'assignee' | 'priority'>('workcenter')
  const queryClient = useQueryClient()

  // Fetch data
  const { data: jobs = [], isLoading: jobsLoading } = useQuery({
    queryKey: ['jobs', workspaceId],
    queryFn: () => listJobs(workspaceId).then(r => r.jobs),
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

  // Mutations
  const moveJobMutation = useMutation({
    mutationFn: ({ jobId, newStageId }: { jobId: string; newStageId: string }) =>
      moveJobToStage(workspaceId, jobId, newStageId, 'current-user'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs', workspaceId] })
    },
  })

  const statusMutation = useMutation({
    mutationFn: ({ jobId, status, blockReason }: { jobId: string; status: Job['status']; blockReason?: string }) =>
      setJobStatus(workspaceId, jobId, status, blockReason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs', workspaceId] })
    },
  })

  // Get default workflow stages
  const defaultWorkflow = workflows.find(w => w.isDefault) || workflows[0]
  const stages = defaultWorkflow?.stages || []

  // Group jobs by stage
  const stageColumns: StageColumn[] = stages.map(stage => {
    const stageJobs = jobs.filter(job => job.currentStageId === stage.id)
    return {
      id: stage.id,
      name: stage.name,
      color: stage.color,
      wipLimit: stage.wipLimit,
      currentCount: stageJobs.length,
      jobs: stageJobs
    }
  })

  const handleJobMove = (jobId: string, newStageId: string) => {
    moveJobMutation.mutate({ jobId, newStageId })
  }

  const handleStatusChange = (jobId: string, status: Job['status'], blockReason?: string) => {
    statusMutation.mutate({ jobId, status, blockReason })
  }

  const getRiskColor = (risk?: string) => {
    switch (risk) {
      case 'overdue': return 'text-red-600'
      case 'warning': return 'text-yellow-600'
      default: return 'text-green-600'
    }
  }

  const getPriorityColor = (priority: number) => {
    switch (priority) {
      case 1: return 'bg-red-100 text-red-800'
      case 2: return 'bg-orange-100 text-orange-800'
      case 3: return 'bg-yellow-100 text-yellow-800'
      case 4: return 'bg-blue-100 text-blue-800'
      case 5: return 'bg-green-100 text-green-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getSwimlaneValue = (job: Job) => {
    switch (swimlane) {
      case 'workcenter':
        return workcenters.find(wc => wc.id === job.workcenterId)?.name || 'Unassigned'
      case 'assignee':
        return job.assignees.length > 0 
          ? resources.filter(r => job.assignees.includes(r.id)).map(r => r.name).join(', ')
          : 'Unassigned'
      case 'priority':
        return `Priority ${job.priority}`
      default:
        return ''
    }
  }

  if (jobsLoading) {
    return (
      <div className="p-4">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header Controls */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div className="flex items-center space-x-4">
          <h2 className="text-lg font-semibold text-gray-900">Production Board</h2>
          <div className="flex rounded-md shadow-sm" role="group">
            {(['workcenter', 'assignee', 'priority'] as const).map((option) => (
              <button
                key={option}
                onClick={() => setSwimlane(option)}
                className={`px-3 py-1 text-sm font-medium rounded-md ${
                  swimlane === option
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                }`}
              >
                {option.charAt(0).toUpperCase() + option.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <div className="text-sm text-gray-500">
          {jobs.length} jobs total
        </div>
      </div>

      {/* Board */}
      <div className="flex-1 overflow-x-auto p-4">
        <div className="flex space-x-4 min-w-max">
          {stageColumns.map((column) => (
            <div key={column.id} className="flex-shrink-0 w-80">
              {/* Column Header */}
              <div className={`${column.color} rounded-lg p-4 mb-4`}>
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900">{column.name}</h3>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-600">
                      {column.currentCount}
                      {column.wipLimit && ` / ${column.wipLimit}`}
                    </span>
                    {column.wipLimit && column.currentCount > column.wipLimit && (
                      <ExclamationTriangleIcon className="h-4 w-4 text-red-500" />
                    )}
                  </div>
                </div>
                {column.wipLimit && (
                  <div className="mt-2">
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${
                          column.currentCount > column.wipLimit ? 'bg-red-500' : 'bg-blue-500'
                        }`}
                        style={{ width: `${Math.min((column.currentCount / column.wipLimit) * 100, 100)}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Jobs */}
              <div className="space-y-3">
                {column.jobs.map((job) => (
                  <JobCard
                    key={job.id}
                    job={job}
                    onMove={handleJobMove}
                    onStatusChange={handleStatusChange}
                    onClick={() => onJobClick?.(job)}
                    swimlaneValue={getSwimlaneValue(job)}
                    getPriorityColor={getPriorityColor}
                    getRiskColor={getRiskColor}
                    workcenters={workcenters}
                    resources={resources}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

interface JobCardProps {
  job: Job
  onMove: (jobId: string, newStageId: string) => void
  onStatusChange: (jobId: string, status: Job['status'], blockReason?: string) => void
  onClick: () => void
  swimlaneValue: string
  getPriorityColor: (priority: number) => string
  getRiskColor: (risk?: string) => string
  workcenters: Workcenter[]
  resources: Resource[]
}

const JobCard: FC<JobCardProps> = ({
  job,
  onMove,
  onStatusChange,
  onClick,
  swimlaneValue,
  getPriorityColor,
  getRiskColor,
  workcenters,
  resources
}) => {
  const [showActions, setShowActions] = useState(false)

  const assigneeNames = job.assignees
    .map(id => resources.find(r => r.id === id)?.name)
    .filter(Boolean)
    .join(', ')

  const workcenterName = workcenters.find(wc => wc.id === job.workcenterId)?.name

  const totalConsumed = job.bom.reduce((sum, item) => sum + item.consumed, 0)
  const totalRequired = job.bom.reduce((sum, item) => sum + item.qtyRequired, 0)
  const consumptionPercent = totalRequired > 0 ? (totalConsumed / totalRequired) * 100 : 0

  const totalProduced = job.output.reduce((sum, item) => sum + item.qtyProduced, 0)
  const totalPlanned = job.output.reduce((sum, item) => sum + item.qtyPlanned, 0)
  const productionPercent = totalPlanned > 0 ? (totalProduced / totalPlanned) * 100 : 0

  const plannedBoxes = job.packaging?.plannedBoxes || 0
  const actualBoxes = job.packaging?.actualBoxes || 0
  const plannedPallets = job.packaging?.plannedPallets || 0
  const actualPallets = job.packaging?.actualPallets || 0

  return (
    <div
      className="bg-white rounded-lg border border-gray-200 p-4 cursor-pointer hover:shadow-md transition-shadow"
      onClick={onClick}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <div className="flex items-center space-x-2">
            <span className="font-medium text-sm text-gray-900">{job.code}</span>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(job.priority)}`}>
              P{job.priority}
            </span>
          </div>
          <p className="text-sm text-gray-600 mt-1">{job.sku} • {job.quantity} {job.unit}</p>
        </div>
        {showActions && (
          <div className="flex space-x-1">
            <button
              onClick={(e) => {
                e.stopPropagation()
                onStatusChange(job.id, 'in_progress')
              }}
              className="p-1 text-green-600 hover:bg-green-50 rounded"
              title="Start"
            >
              <PlayIcon className="h-4 w-4" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                onStatusChange(job.id, 'blocked', 'Manual block')
              }}
              className="p-1 text-red-600 hover:bg-red-50 rounded"
              title="Block"
            >
              <PauseIcon className="h-4 w-4" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                onStatusChange(job.id, 'done')
              }}
              className="p-1 text-blue-600 hover:bg-blue-50 rounded"
              title="Complete"
            >
              <CheckCircleIcon className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* Customer & Due Date */}
      <div className="mb-2">
        <p className="text-sm font-medium text-gray-900">{job.customer.name}</p>
        <div className="flex items-center space-x-2 text-sm">
          <ClockIcon className="h-4 w-4 text-gray-400" />
          <span className={`${getRiskColor(job.risk)}`}>
            {new Date(job.dueDate).toLocaleDateString()}
          </span>
        </div>
      </div>

      {/* Swimlane Value */}
      <div className="mb-2">
        <p className="text-xs text-gray-500">{swimlaneValue}</p>
      </div>

      {/* Progress Indicators */}
      <div className="space-y-2">
        {/* Material Consumption */}
        <div>
          <div className="flex justify-between text-xs text-gray-600 mb-1">
            <span>Materials</span>
            <span>{totalConsumed.toFixed(1)} / {totalRequired.toFixed(1)}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-1.5">
            <div
              className="bg-blue-500 h-1.5 rounded-full"
              style={{ width: `${Math.min(consumptionPercent, 100)}%` }}
            />
          </div>
        </div>

        {/* Production Output */}
        <div>
          <div className="flex justify-between text-xs text-gray-600 mb-1">
            <span>Output</span>
            <span>{totalProduced} / {totalPlanned} {job.unit}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-1.5">
            <div
              className="bg-green-500 h-1.5 rounded-full"
              style={{ width: `${Math.min(productionPercent, 100)}%` }}
            />
          </div>
        </div>

        {/* Packaging */}
        {(plannedBoxes > 0 || actualBoxes > 0) && (
          <div className="flex items-center space-x-2 text-xs text-gray-600">
            <CubeIcon className="h-3 w-3" />
            <span>Boxes: {actualBoxes}/{plannedBoxes}</span>
            {(plannedPallets > 0 || actualPallets > 0) && (
              <>
                <TruckIcon className="h-3 w-3" />
                <span>Pallets: {actualPallets}/{plannedPallets}</span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Assignees */}
      {assigneeNames && (
        <div className="mt-2 flex items-center space-x-1">
          <UserGroupIcon className="h-3 w-3 text-gray-400" />
          <span className="text-xs text-gray-600">{assigneeNames}</span>
        </div>
      )}

      {/* Workcenter */}
      {workcenterName && (
        <div className="mt-1">
          <span className="text-xs text-gray-500">{workcenterName}</span>
        </div>
      )}

      {/* Acceptance Status */}
      {(job.qaAcceptedAt || job.customerAcceptedAt) && (
        <div className="mt-2 flex items-center space-x-2">
          {job.qaAcceptedAt && (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
              QA ✓
            </span>
          )}
          {job.customerAcceptedAt && (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              Customer ✓
            </span>
          )}
        </div>
      )}
    </div>
  )
}