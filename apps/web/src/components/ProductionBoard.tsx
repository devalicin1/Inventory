import { useState, useEffect, useRef, type FC } from 'react'
import {
  type Job,
  type Workflow,
  type Workcenter,
  type Resource,
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
  fitToScreen?: boolean
  zoom?: number
}

interface StageColumn {
  id: string
  name: string
  color: string
  wipLimit?: number
  currentCount: number
  jobs: Job[]
}

export function ProductionBoard({ workspaceId, onJobClick, fitToScreen = false, zoom = 1 }: ProductionBoardProps) {
  const [swimlane, setSwimlane] = useState<'workcenter' | 'assignee' | 'priority'>('workcenter')
  const [density, setDensity] = useState<'compact' | 'standard' | 'cozy'>(() => {
    const saved = typeof window !== 'undefined' ? window.localStorage.getItem('boardDensity') : null
    return (saved as 'compact' | 'standard' | 'cozy') || 'cozy'
  })
  const queryClient = useQueryClient()
  const outerRef = useRef<HTMLDivElement | null>(null)
  const contentRef = useRef<HTMLDivElement | null>(null)
  const [fitScale, setFitScale] = useState(1)

  // Fetch data
  const { data: jobs = [], isLoading: jobsLoading } = useQuery({
    queryKey: ['jobs', workspaceId],
    queryFn: () => listJobs(workspaceId).then(r => r.jobs),
  })

  const safeJobs: Job[] = Array.isArray(jobs) ? jobs : []

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
    mutationFn: ({ jobId, newStageId, note }: { jobId: string; newStageId: string; note?: string }) =>
      moveJobToStage(workspaceId, jobId, newStageId, 'current-user', note),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['jobs', workspaceId] })
      if (variables?.jobId) {
        queryClient.invalidateQueries({ queryKey: ['job', workspaceId, variables.jobId] })
        queryClient.invalidateQueries({ queryKey: ['jobHistory', workspaceId, variables.jobId] })
      }
    },
    onError: (error: any, variables: any) => {
      console.error('Failed to move job to stage:', error)
      try {
        const message = error?.message || 'Failed to move job. Please try again.'
        if ((message || '').includes('üretim girişi')) {
          const wants = confirm(`${message}\n\nŞimdi output girişi yapmak ister misiniz?`)
          if (wants && variables?.jobId) {
            const jobToOpen = jobs.find(j => j.id === variables.jobId)
            if (jobToOpen && onJobClick) onJobClick(jobToOpen)
          }
        } else {
          // eslint-disable-next-line no-alert
          alert(message)
        }
      } catch {
        // noop
      }
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

  // Show all stages; movement will still be restricted per job's planned stages

  // Identify terminal stages and completed jobs
  const terminalIds = stages.filter(s => (s as any).isTerminal).map(s => s.id)
  const isCompleted = (job: Job) => job.status === 'done' || terminalIds.includes(job.currentStageId)

  // Group jobs by stage (exclude completed and draft from regular columns)
  const stageColumns: StageColumn[] = stages.map(stage => {
    const stageJobs = safeJobs.filter(job => job.currentStageId === stage.id && !isCompleted(job) && job.status !== 'draft')
    return {
      id: stage.id,
      name: stage.name,
      color: stage.color,
      wipLimit: stage.wipLimit,
      currentCount: stageJobs.length,
      jobs: stageJobs
    }
  })

  // Add unassigned column for jobs without a stage
  const unassignedJobs = safeJobs.filter(job => (!job.currentStageId || !stages.find(s => s.id === job.currentStageId)) && job.status !== 'draft')
  if (unassignedJobs.length > 0) {
    stageColumns.push({
      id: '__unassigned__',
      name: 'Unassigned',
      color: 'bg-gray-200',
      wipLimit: undefined,
      currentCount: unassignedJobs.length,
      jobs: unassignedJobs
    })
  }

  // Completed column (aggregates jobs marked done or in terminal stages)
  const completedJobs = safeJobs.filter(isCompleted)
  stageColumns.push({
    id: '__completed__',
    name: 'Completed',
    color: 'bg-green-100',
    wipLimit: undefined,
    currentCount: completedJobs.length,
    jobs: completedJobs,
  })

  const handleJobMove = (jobId: string, newStageId: string, note?: string) => {
    moveJobMutation.mutate({ jobId, newStageId, note })
  }

  const [confirmMove, setConfirmMove] = useState<{
    open: boolean; jobId?: string; jobCode?: string; targetStageId?: string; targetStageName?: string
  }>({ open: false })

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

  // Fit to screen calculation (must be declared before any early returns)
  useEffect(() => {
    function recompute() {
      if (!fitToScreen || !outerRef.current) { setFitScale(1); return }
      const containerWidth = outerRef.current.getBoundingClientRect().width
      const minColumnWidth = 360
      const gap = 24 // space-x-6
      const cols = stageColumns.length
      const requiredWidth = cols * minColumnWidth + Math.max(0, cols - 1) * gap
      const nextScale = Math.min(1, containerWidth / requiredWidth)
      setFitScale(nextScale)
      if (contentRef.current) {
        contentRef.current.style.width = `${requiredWidth}px`
        contentRef.current.style.transformOrigin = 'top left'
      }
    }
    recompute()
    window.addEventListener('resize', recompute)
    return () => window.removeEventListener('resize', recompute)
  }, [fitToScreen, stageColumns.length])

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
    <>
      <div ref={outerRef} className="h-full flex flex-col">
        {/* Header Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 border-b border-gray-200 gap-3 sm:gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
            <h2 className="text-base sm:text-lg font-semibold text-gray-900">Production Board</h2>
            <div className="flex rounded-md shadow-sm overflow-x-auto" role="group">
              {(['workcenter', 'assignee', 'priority'] as const).map((option) => (
                <button
                  key={option}
                  onClick={() => setSwimlane(option)}
                  className={`px-2 sm:px-3 py-1 text-xs sm:text-sm font-medium rounded-md whitespace-nowrap ${swimlane === option
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                    }`}
                >
                  {option.charAt(0).toUpperCase() + option.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between sm:justify-end space-x-2 sm:space-x-3">
            <div className="hidden sm:flex rounded-md shadow-sm" role="group">
              {(['compact', 'standard', 'cozy'] as const).map((opt) => (
                <button
                  key={opt}
                  onClick={() => {
                    setDensity(opt)
                    try { window.localStorage.setItem('boardDensity', opt) } catch { }
                  }}
                  className={`px-3 py-1 text-sm font-medium rounded-md ${density === opt
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                    }`}
                >
                  {opt.charAt(0).toUpperCase() + opt.slice(1)}
                </button>
              ))}
            </div>
            <div className="text-xs sm:text-sm text-gray-500 whitespace-nowrap">{safeJobs.length} jobs</div>
          </div>
        </div>

        {/* Board */}
        <div className="flex-1 overflow-x-auto p-3 sm:p-4 md:p-6">
          <div ref={contentRef} className="flex space-x-3 sm:space-x-4 md:space-x-6 min-w-max" style={{ transform: `scale(${(fitScale || 1) * (zoom || 1)})` }}>
            {stageColumns.map((column) => (
              <div
                key={column.id}
                className="flex-shrink-0 min-w-[280px] sm:min-w-[320px] md:min-w-[360px] 2xl:min-w-[420px] 3xl:min-w-[460px]"
                onDragOver={(e) => {
                  e.preventDefault()
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  const jobId = e.dataTransfer.getData('application/job-id')
                  if (jobId) {
                    if (column.id === '__completed__') {
                      // Do not allow dropping directly into the Completed column
                      return
                    }
                    const stageName = stages.find(s => s.id === column.id)?.name || 'this stage'
                    const job = safeJobs.find(j => j.id === jobId)
                    const planned = (job as any)?.plannedStageIds as string[] | undefined
                    if (planned && !planned.includes(column.id)) {
                      alert(`This job cannot move to ${stageName} (not in its planned stages).`)
                      return
                    }
                    setConfirmMove({ open: true, jobId, jobCode: job?.code || jobId, targetStageId: column.id, targetStageName: stageName })
                  }
                }}
              >
                {/* Column Header */}
                <div className={`${column.color} rounded-lg p-3 sm:p-4 mb-3 sm:mb-4`}>
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-sm sm:text-base text-gray-900 truncate pr-2">{column.name}</h3>
                    <div className="flex items-center space-x-1.5 sm:space-x-2 flex-shrink-0">
                      <span className="text-xs sm:text-sm text-gray-600">
                        {column.currentCount}
                        {column.wipLimit && ` / ${column.wipLimit}`}
                      </span>
                      {column.wipLimit && column.currentCount > column.wipLimit && (
                        <ExclamationTriangleIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-red-500" />
                      )}
                    </div>
                  </div>
                  {column.wipLimit && (
                    <div className="mt-2">
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${column.currentCount > column.wipLimit ? 'bg-red-500' : 'bg-blue-500'
                            }`}
                          style={{ width: `${Math.min((column.currentCount / column.wipLimit) * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Jobs */}
                <div className={`${density === 'cozy' ? 'space-y-4' : density === 'standard' ? 'space-y-3' : 'space-y-2'}`}>
                  {column.jobs.map((job) => (
                    <JobCard
                      key={job.id}
                      job={job}
                      onStatusChange={handleStatusChange}
                      onClick={() => onJobClick?.(job)}
                      swimlaneValue={getSwimlaneValue(job)}
                      getPriorityColor={getPriorityColor}
                      getRiskColor={getRiskColor}
                      workcenters={workcenters}
                      resources={resources}
                      density={density}
                      stages={stages}
                      onRequestMove={(targetStageId, targetStageName) => setConfirmMove({ open: true, jobId: job.id, jobCode: job.code, targetStageId, targetStageName })}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      {confirmMove.open && (
        <ConfirmMoveModal
          jobCode={confirmMove.jobCode || ''}
          targetStageName={confirmMove.targetStageName || ''}
          onCancel={() => setConfirmMove({ open: false })}
          onConfirm={(note) => {
            if (confirmMove.jobId && confirmMove.targetStageId) {
              handleJobMove(confirmMove.jobId, confirmMove.targetStageId, note)
            }
            setConfirmMove({ open: false })
          }}
        />
      )}
    </>
  )
}

interface JobCardProps {
  job: Job
  onStatusChange: (jobId: string, status: Job['status'], blockReason?: string) => void
  onClick: () => void
  swimlaneValue: string
  getPriorityColor: (priority: number) => string
  getRiskColor: (risk?: string) => string
  workcenters: Workcenter[]
  resources: Resource[]
  density: 'compact' | 'standard' | 'cozy'
  stages: Workflow['stages'] | undefined
  onRequestMove: (targetStageId: string, targetStageName: string) => void
}

const JobCard: FC<JobCardProps> = ({
  job,
  onStatusChange,
  onClick,
  swimlaneValue,
  getPriorityColor,
  getRiskColor,
  workcenters,
  resources,
  density,
  stages,
  onRequestMove
}) => {
  const [showActions, setShowActions] = useState(false)
  const [openMove, setOpenMove] = useState(false)

  const assigneeNames = job.assignees
    .map(id => resources.find(r => r.id === id)?.name)
    .filter(Boolean)
    .join(', ')

  const workcenterName = workcenters.find(wc => wc.id === job.workcenterId)?.name

  // Helper function to format dates safely
  const formatDate = (value: any) => {
    if (!value) return 'Not set'
    try {
      if (value.seconds) {
        return new Date(value.seconds * 1000).toLocaleDateString()
      }
      return new Date(value).toLocaleDateString()
    } catch {
      return 'Invalid Date'
    }
  }

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

  const densityClasses =
    density === 'cozy'
      ? 'p-3 sm:p-4 md:p-5 text-sm sm:text-[15px]'
      : density === 'standard'
        ? 'p-2.5 sm:p-3 md:p-4 text-xs sm:text-sm md:text-[14px]'
        : 'p-2 sm:p-2.5 md:p-3 text-xs sm:text-[13px]'

  const currentIndex = stages?.findIndex(s => s.id === job.currentStageId) ?? -1
  const nextStage = currentIndex >= 0 && stages && currentIndex + 1 < stages.length ? stages[currentIndex + 1] : undefined

  return (
    <div
      className={`bg-white rounded-xl border border-gray-200 cursor-pointer shadow-sm hover:shadow-md transition-all ${densityClasses} relative group`}
      draggable={!openMove}
      onDragStart={(e) => {
        if (openMove) return
        e.dataTransfer.setData('application/job-id', job.id)
        e.dataTransfer.effectAllowed = 'move'
      }}
      onClick={onClick}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-2 gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-1.5 sm:space-x-2 flex-wrap">
            <span className="font-medium text-xs sm:text-sm text-gray-900 truncate">{job.code}</span>
            <span className={`px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full text-xs font-medium ${getPriorityColor(job.priority)} flex-shrink-0`}>
              P{job.priority}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-gray-600 mt-0.5 sm:mt-1 truncate">{job.sku} • {job.quantity} {job.unit}</p>
        </div>
        {showActions && (
          <div className="flex space-x-1">
            {job.status === 'draft' && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onStatusChange(job.id, 'released')
                }}
                className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                title="Release"
              >
                R
              </button>
            )}
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
            {/* Move menu trigger */}
            <button
              onClick={(e) => {
                e.stopPropagation()
                setOpenMove(v => !v)
              }}
              className="p-1 text-gray-600 hover:bg-gray-50 rounded"
              title="Move to…"
            >
              ⋯
            </button>
          </div>
        )}
      </div>
      {openMove && (
        <div
          className="absolute z-20 mt-1 right-2 top-10 bg-white border border-gray-200 rounded shadow-md p-2 space-y-1"
          onClick={(e) => e.stopPropagation()}
        >
          {nextStage && (!((job as any).plannedStageIds) || (job as any).plannedStageIds.includes(nextStage.id)) &&
            // Note: Threshold check is handled in ConfirmMoveModal/ConfirmStageChangeModal
            // For now, show Next stage button - actual threshold validation happens when moving
            (
              <button
                className="w-full text-left px-3 py-1.5 text-sm rounded hover:bg-gray-50"
                onClick={() => onRequestMove(nextStage.id, nextStage.name)}
              >
                Next stage → {nextStage.name}
              </button>
            )}
          {stages
            ?.filter(s => s.id !== job.currentStageId)
            .filter(s => !((job as any).plannedStageIds) || (job as any).plannedStageIds.includes(s.id))
            .map(s => (
              <button
                key={s.id}
                className="w-full text-left px-3 py-1.5 text-sm rounded hover:bg-gray-50"
                onClick={() => onRequestMove(s.id, s.name)}
              >
                Move to {s.name}
              </button>
            ))}
        </div>
      )}

      {/* Customer & Due Date */}
      <div className="mb-2">
        <p className="text-sm font-medium text-gray-900">{job.customer.name}</p>
        <div className="flex items-center space-x-2 text-sm">
          <ClockIcon className="h-4 w-4 text-gray-400" />
          <span className={`${getRiskColor(job.risk)}`}>
            {formatDate(job.dueDate)}
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

interface ConfirmMoveModalProps {
  jobCode: string
  targetStageName: string
  onCancel: () => void
  onConfirm: (note?: string) => void
}

const ConfirmMoveModal: FC<ConfirmMoveModalProps> = ({ jobCode, targetStageName, onCancel, onConfirm }) => {
  const [note, setNote] = useState('')
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="px-5 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Confirm Stage Change</h3>
        </div>
        <div className="p-5 space-y-3">
          <p className="text-sm text-gray-700">Move <span className="font-medium">{jobCode}</span> to <span className="font-medium">{targetStageName}</span>?</p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Note (optional)</label>
            <textarea
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add a reason or note for this move"
            />
          </div>
        </div>
        <div className="px-5 py-4 border-t border-gray-200 flex justify-end gap-2">
          <button onClick={onCancel} className="px-4 py-2 rounded bg-gray-100 text-gray-700 hover:bg-gray-200">Cancel</button>
          <button onClick={() => onConfirm(note || undefined)} className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700">Confirm</button>
        </div>
      </div>
    </div>
  )
}