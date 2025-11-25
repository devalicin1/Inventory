import { type FC } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  CubeIcon,
  ExclamationTriangleIcon,
  UserGroupIcon,
  ChartBarIcon,
  BuildingStorefrontIcon,
  CalendarIcon,
  ChevronRightIcon
} from '@heroicons/react/24/outline'
import type { Job, HistoryEvent, Workflow } from '../../../api/production-jobs'
import { updateJob } from '../../../api/production-jobs'

interface OverviewTabProps {
  job: Job
  getRiskColor: (risk?: string) => string
  getPriorityColor: (priority: number) => string
  workcenters: Array<{ id: string; name: string }>
  resources: Array<{ id: string; name: string }>
  workflows?: Workflow[]
  history?: HistoryEvent[]
  workspaceId: string
  allRuns?: any[]
}

export const OverviewTab: FC<OverviewTabProps> = ({
  job,
  getRiskColor,
  getPriorityColor,
  workcenters,
  resources,
  workflows = [],
  history = [],
  workspaceId,
  allRuns = []
}) => {
  const queryClient = useQueryClient()
  // Helper function to safely convert dates
  const formatDate = (date: any) => {
    if (!date) return '-'
    try {
      // Handle Firebase Timestamp
      if (date.seconds) {
        return new Date(date.seconds * 1000).toLocaleDateString()
      }
      // Handle regular Date object
      return new Date(date).toLocaleDateString()
    } catch {
      return 'Invalid Date'
    }
  }

  // Helper function to get workcenter name
  const getWorkcenterName = (id?: string) => {
    if (!id) return 'Unassigned'
    const wc = workcenters.find(w => w.id === id)
    return wc?.name || id
  }

  // Helper function to get resource names
  const getAssigneeNames = (ids: string[]) => {
    if (ids.length === 0) return 'Unassigned'
    return ids.map(id => {
      const resource = resources.find(r => r.id === id)
      return resource?.name || id
    }).join(', ')
  }

  const stageName = (id?: string | null) => {
    if (!id) return '-'
    for (const wf of workflows) {
      const s = wf.stages?.find(st => st.id === id)
      if (s) return s.name
    }
    return id
  }

  const getFinishDate = () => {
    if (job.status === 'done') {
      // Prefer updatedAt; fallback to acceptance dates
      return job.updatedAt || (job as any).customerAcceptedAt || (job as any).qaAcceptedAt
    }
    return null
  }

  const calculateProgress = () => {
    if (!job.output || job.output.length === 0) return 0
    const item = job.output[0]
    const qtyProduced = Number(item.qtyProduced || 0)
    const qtyPlanned = Number(item.qtyPlanned || 0)
    
    // Safety checks
    if (qtyPlanned <= 0) return 0
    if (qtyProduced < 0) return 0
    
    // Calculate percentage
    // If qtyProduced > qtyPlanned, it means either:
    // 1. More was produced than planned (overproduction)
    // 2. Units don't match (UOM mismatch - e.g., planned in boxes, produced in cartoons)
    // 3. Data error (qtyPlanned is wrong)
    const percentage = (qtyProduced / qtyPlanned) * 100
    
    // Log warning if percentage exceeds 100% significantly (likely data issue)
    if (percentage > 150) {
      console.warn(`Progress calculation warning for job ${job.code}:`, {
        qtyProduced,
        qtyPlanned,
        percentage: `${percentage.toFixed(2)}%`,
        producedUOM: item.uom || job.unit,
        plannedUOM: item.uom || job.unit,
        message: 'Progress exceeds 150%. Possible UOM mismatch or data error.'
      })
    }
    
    // Cap at 100% for display (overproduction still shows as 100%)
    return Math.min(Math.max(percentage, 0), 100)
  }

  const progress = calculateProgress()

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                <CubeIcon className="h-5 w-5 text-blue-600" />
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Progress</p>
              <p className="text-2xl font-semibold text-gray-900">
                {Math.round(progress)}%
              </p>
            </div>
          </div>
          <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center">
                <ExclamationTriangleIcon className="h-5 w-5 text-amber-600" />
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Priority</p>
              <p className={`text-2xl font-semibold ${getPriorityColor(job.priority).split(' ')[0]}`}>
                P{job.priority}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                <UserGroupIcon className="h-5 w-5 text-green-600" />
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Assignees</p>
              <p className="text-2xl font-semibold text-gray-900">{job.assignees.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
          <div className="flex items-center">
            <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${job.risk === 'overdue' ? 'bg-red-100' :
              job.risk === 'warning' ? 'bg-amber-100' : 'bg-green-100'
              }`}>
              <ChartBarIcon className={`h-5 w-5 ${job.risk === 'overdue' ? 'text-red-600' :
                job.risk === 'warning' ? 'text-amber-600' : 'text-green-600'
                }`} />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Risk Level</p>
              <p className={`text-2xl font-semibold ${job.risk === 'overdue' ? 'text-red-600' :
                job.risk === 'warning' ? 'text-amber-600' : 'text-green-600'
                }`}>
                {job.risk?.toUpperCase() || 'LOW'}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column */}
        <div className="space-y-6">
          {/* Customer Information */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                <BuildingStorefrontIcon className="h-5 w-5 mr-2 text-gray-400" />
                Customer Information
              </h3>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-600">Customer Name</span>
                <span className="text-sm text-gray-900">{job.customer.name}</span>
              </div>
              {job.customer.orderNo && (
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-600">Order Number</span>
                  <span className="text-sm text-gray-900">{job.customer.orderNo}</span>
                </div>
              )}
            </div>
          </div>

          {/* Dates */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                <CalendarIcon className="h-5 w-5 mr-2 text-gray-400" />
                Important Dates
              </h3>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-600">Due Date</span>
                <span className={`text-sm font-medium ${getRiskColor(job.risk).split(' ')[0]}`}>
                  {formatDate(job.dueDate)}
                </span>
              </div>
              {job.plannedStart && (
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-600">Planned Start</span>
                  <span className="text-sm text-gray-900">{formatDate(job.plannedStart)}</span>
                </div>
              )}
              {job.plannedEnd && (
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-600">Planned End</span>
                  <span className="text-sm text-gray-900">{formatDate(job.plannedEnd)}</span>
                </div>
              )}
              {job.status === 'done' && (
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-600">Finish Date</span>
                  <span className="text-sm text-green-600">{formatDate(getFinishDate())}</span>
                </div>
              )}
              {job.qaAcceptedAt && (
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-600">QA Accepted</span>
                  <span className="text-sm text-green-600">{formatDate(job.qaAcceptedAt)}</span>
                </div>
              )}
              {job.customerAcceptedAt && (
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-600">Customer Accepted</span>
                  <span className="text-sm text-blue-600">{formatDate(job.customerAcceptedAt)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Job References & Flags */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Job References & Flags</h3>
            </div>
            <div className="p-6 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-600">Repeat</span>
                <span className="text-sm text-gray-900">{(job as any).isRepeat ? 'Yes' : 'No'}</span>
              </div>
              {(job as any).tams && (
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-600">TAMS</span>
                  <span className="text-sm text-gray-900">{(job as any).tams}</span>
                </div>
              )}
              {(job as any).rsOrderRef && (
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-600">RS / Order Ref</span>
                  <span className="text-sm text-gray-900">{(job as any).rsOrderRef}</span>
                </div>
              )}
              {((job as any).outerType || (job as any).outerCode) && (
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-600">Outer</span>
                  <span className="text-sm text-gray-900">{((job as any).outerType || '-') + ((job as any).outerCode ? ` • ${String((job as any).outerCode)}` : '')}</span>
                </div>
              )}
              {(job as any).deliveryMethod && (
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-600">Delivery Method</span>
                  <span className="text-sm text-gray-900">{(job as any).deliveryMethod}</span>
                </div>
              )}
              {(job as any).deliveryAddress && (
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-600">Delivery Address</span>
                  <span className="text-sm text-gray-900 text-right max-w-[60%] truncate" title={(job as any).deliveryAddress}>{(job as any).deliveryAddress}</span>
                </div>
              )}
              {typeof (job as any).weightPerBox !== 'undefined' && (job as any).weightPerBox !== null && (
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-600">Weight per Box</span>
                  <span className="text-sm text-gray-900">{(job as any).weightPerBox} kg</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Assignment */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                <UserGroupIcon className="h-5 w-5 mr-2 text-gray-400" />
                Assignment
              </h3>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-600">Assignees</span>
                <span className="text-sm text-gray-900 text-right">
                  {getAssigneeNames(job.assignees)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-600">Workcenter</span>
                <span className="text-sm text-gray-900">{getWorkcenterName(job.workcenterId)}</span>
              </div>
            </div>
          </div>

          {/* Workflow Path */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Workflow Path</h3>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  className="rounded border-gray-300"
                  checked={((job as any).requireOutputToAdvance !== false)}
                  onChange={async (e) => {
                    try {
                      await updateJob(workspaceId, job.id, { requireOutputToAdvance: e.target.checked } as any)
                      queryClient.invalidateQueries({ queryKey: ['job', workspaceId, job.id] })
                    } catch {
                      // best-effort; parent will re-fetch
                    }
                  }}
                />
                Require output to advance
              </label>
            </div>
            <div className="p-6">
              {Array.isArray((job as any).plannedStageIds) && (job as any).plannedStageIds.length > 0 ? (
                <>
                  {/* Chips */}
                  <div className="flex flex-wrap gap-2 mb-4">
                    {(() => {
                      const planned: string[] = (job as any).plannedStageIds
                      const visited = new Set<string>(history.filter(h => h.type === 'stage_change').map(h => String((h as any).payload?.newStageId)))
                      const currentStageIndex = job.currentStageId ? planned.indexOf(job.currentStageId) : -1

                      // Helper to check if threshold is met for a stage (simplified version)
                      const isThresholdMetForStage = (stageId: string): boolean => {
                        if (!stageId || !allRuns || allRuns.length === 0) return false
                        const stageRuns = allRuns.filter((r: any) => r.stageId === stageId)
                        if (stageRuns.length === 0) return false

                        // Get stage info
                        const workflow = workflows.find((w: any) => w.id === job.workflowId)
                        const stageInfo = workflow?.stages?.find((s: any) => s.id === stageId)
                        const stageOutputUOM = (stageInfo as any)?.outputUOM || ''

                        // Calculate planned quantity (simplified - same logic as timeline)
                        const plannedStages: string[] = (job as any).plannedStageIds || []
                        const stageIndex = plannedStages.indexOf(stageId)
                        const previousStageId = stageIndex > 0 ? plannedStages[stageIndex - 1] : null

                        let plannedQty: number
                        if (previousStageId) {
                          const previousStageRuns = allRuns.filter((r: any) => r.stageId === previousStageId)
                          const previousStageTotalOutput = previousStageRuns.reduce((sum: number, r: any) => sum + Number(r.qtyGood || 0), 0)
                          plannedQty = previousStageTotalOutput > 0 ? previousStageTotalOutput : 0
                        } else {
                          // First stage
                          if (stageOutputUOM === 'cartoon') {
                            const boxQty = job.packaging?.plannedBoxes || 0
                            const pcsPerBox = job.packaging?.pcsPerBox || 1
                            plannedQty = boxQty * pcsPerBox
                          } else {
                            const bom = Array.isArray(job.bom) ? job.bom : []
                            const sheetItem = bom.find((item: any) => {
                              const uom = String(item.uom || '').toLowerCase()
                              return ['sht', 'sheet', 'sheets'].includes(uom)
                            })
                            plannedQty = sheetItem ? Number(sheetItem.qtyRequired || 0) : (job.output?.[0]?.qtyPlanned || Number((job as any).quantity || 0))
                          }
                        }

                        const WASTAGE_THRESHOLD_LOWER = 400
                        const WASTAGE_THRESHOLD_UPPER = 500
                        const completionThreshold = Math.max(0, plannedQty - WASTAGE_THRESHOLD_LOWER)
                        const completionThresholdUpper = plannedQty + WASTAGE_THRESHOLD_UPPER
                        const totalProduced = stageRuns.reduce((sum, r) => sum + Number(r.qtyGood || 0), 0)
                        // Threshold met: alt sınır ile üst sınır arasında olmalı
                        const isMet = plannedQty > 0 && totalProduced >= completionThreshold && totalProduced <= completionThresholdUpper

                        // Debug log for ETERNA stage
                        if (stageId === job.currentStageId && stageInfo?.name === 'ETERNA') {
                          console.log('🔍 ETERNA Threshold Check:', {
                            stageId,
                            plannedQty,
                            totalProduced,
                            completionThreshold,
                            completionThresholdUpper,
                            isMet,
                            stageRuns: stageRuns.length,
                            allRuns: allRuns.length
                          })
                        }

                        return isMet
                      }

                      return planned.map((id: string, index: number) => {
                        const isCurrentStage = job.status !== 'done' && job.status !== 'draft' && id === job.currentStageId
                        const thresholdMet = isThresholdMetForStage(id)

                        // A stage is done if:
                        // 1. Job is done, OR
                        // 2. Stage was visited and is not current, OR
                        // 3. Stage comes before the current stage in the workflow (even if not explicitly visited), OR
                        // 4. Threshold is met for this stage (even if stage hasn't been moved yet - including current stage)
                        const isDone = job.status === 'done' ||
                          (visited.has(id) && !isCurrentStage) ||
                          (currentStageIndex >= 0 && index < currentStageIndex) ||
                          thresholdMet

                        // If threshold is met, show as "Done" even if it's current stage
                        // (stage is completed but not yet moved to next)
                        const isCurrent = isCurrentStage && !thresholdMet

                        const base = 'px-3 py-2 rounded-lg text-sm font-medium border'
                        const cls = isCurrent
                          ? `${base} bg-blue-100 text-blue-700 border-blue-300`
                          : isDone
                            ? `${base} bg-green-50 text-green-700 border-green-200`
                            : `${base} bg-gray-100 text-gray-700 border-gray-300`
                        return (
                          <div key={id} className="flex items-center">
                            <span className={cls}>
                              {stageName(id)}
                              {isCurrent && (
                                <span className="ml-2 text-xs bg-blue-500 text-white px-1.5 py-0.5 rounded-full">Current</span>
                              )}
                              {isDone && !isCurrent && (
                                <span className="ml-2 text-xs bg-green-500 text-white px-1.5 py-0.5 rounded-full">Done</span>
                              )}
                            </span>
                            {index < planned.length - 1 && (
                              <ChevronRightIcon className="h-4 w-4 text-gray-400 mx-2" />
                            )}
                          </div>
                        )
                      })
                    })()}
                  </div>
                  {/* Timeline table */}
                  <div className="bg-gray-50 border border-gray-200 rounded-md p-3">
                    <h4 className="text-sm font-semibold text-gray-900 mb-2">Stage Timeline</h4>
                    {(() => {
                      // Use production runs from component scope - ensure it's defined
                      const runs = (typeof allRuns !== 'undefined' ? allRuns : []) || []

                      const stageChanges = history
                        .filter(h => h.type === 'stage_change')
                        .slice()
                        .sort((a: any, b: any) => a.at.seconds - b.at.seconds)

                      // Helper function to calculate threshold met date for any stage
                      // This function should be defined before it's used in the stageChanges forEach
                      const calculateCurrentStageThresholdMetAt = (stageId: string, runs: any[]): number | null => {
                        if (!stageId || !runs || runs.length === 0) return null

                        const stageRuns = runs.filter((r: any) => r.stageId === stageId).sort((a: any, b: any) => {
                          const aTime = a.at?.seconds || (a.at ? Math.floor(new Date(a.at).getTime() / 1000) : 0)
                          const bTime = b.at?.seconds || (b.at ? Math.floor(new Date(b.at).getTime() / 1000) : 0)
                          return aTime - bTime
                        })

                        if (stageRuns.length === 0) return null

                        // Get stage info
                        const workflow = workflows.find((w: any) => w.id === job.workflowId)
                        const stageInfo = workflow?.stages?.find((s: any) => s.id === stageId)
                        const stageInputUOM = (stageInfo as any)?.inputUOM || ''
                        const stageOutputUOM = (stageInfo as any)?.outputUOM || ''
                        const numberUp = job.productionSpecs?.numberUp || 1

                        // Find previous stage
                        const planned: string[] = (job as any).plannedStageIds || []
                        const currentStageIndex = planned.indexOf(stageId)
                        const previousStageId = currentStageIndex > 0 ? planned[currentStageIndex - 1] : null

                        // Calculate planned quantity
                        let plannedQty: number
                        if (previousStageId) {
                          const previousStageRuns = runs.filter((r: any) => r.stageId === previousStageId)
                          const previousStageTotalOutput = previousStageRuns.reduce((sum: number, r: any) => sum + Number(r.qtyGood || 0), 0)

                          if (previousStageTotalOutput > 0) {
                            const previousStageInfo = workflow?.stages?.find((s: any) => s.id === previousStageId)
                            const previousStageOutputUOM = (previousStageInfo as any)?.outputUOM || ''

                            // Convert previous output to current input UOM
                            let currentInput: number
                            if (previousStageOutputUOM === stageInputUOM) {
                              currentInput = previousStageTotalOutput
                            } else if (previousStageOutputUOM === 'cartoon' && stageInputUOM === 'sheets' && numberUp > 0) {
                              currentInput = previousStageTotalOutput / numberUp
                            } else if (previousStageOutputUOM === 'sheets' && stageInputUOM === 'cartoon' && numberUp > 0) {
                              currentInput = previousStageTotalOutput * numberUp
                            } else {
                              currentInput = previousStageTotalOutput
                            }

                            // Convert current input to output UOM
                            if (stageInputUOM === stageOutputUOM) {
                              plannedQty = currentInput
                            } else if (stageInputUOM === 'sheets' && stageOutputUOM === 'cartoon' && numberUp > 0) {
                              plannedQty = currentInput * numberUp
                            } else if (stageInputUOM === 'cartoon' && stageOutputUOM === 'sheets' && numberUp > 0) {
                              plannedQty = currentInput / numberUp
                            } else {
                              plannedQty = currentInput
                            }
                          } else {
                            plannedQty = 0
                          }
                        } else {
                          // First stage
                          if (stageOutputUOM === 'cartoon') {
                            const boxQty = job.packaging?.plannedBoxes || 0
                            const pcsPerBox = job.packaging?.pcsPerBox || 1
                            plannedQty = boxQty * pcsPerBox
                          } else {
                            const bom = Array.isArray(job.bom) ? job.bom : []
                            const sheetItem = bom.find((item: any) => {
                              const uom = String(item.uom || '').toLowerCase()
                              return ['sht', 'sheet', 'sheets'].includes(uom)
                            })
                            plannedQty = sheetItem ? Number(sheetItem.qtyRequired || 0) : (job.output?.[0]?.qtyPlanned || Number((job as any).quantity || 0))
                          }
                        }

                        const WASTAGE_THRESHOLD_LOWER = 400
                        const completionThreshold = Math.max(0, plannedQty - WASTAGE_THRESHOLD_LOWER)

                        // Find when threshold was met
                        let cumulativeTotal = 0
                        for (const run of stageRuns) {
                          const qtyGood = Number(run.qtyGood || 0) // Already in output UOM
                          cumulativeTotal += qtyGood

                          if (cumulativeTotal >= completionThreshold) {
                            const runAt = run.at
                            if (runAt?.seconds) {
                              return runAt.seconds
                            } else if (runAt) {
                              return Math.floor(new Date(runAt).getTime() / 1000)
                            }
                          }
                        }

                        return null
                      }

                      // Map when a stage was COMPLETED (i.e., when the job moved to the next stage)
                      const completedAtByStage = new Map<string, number>()
                      // Map when a stage was STARTED (i.e., when the job moved into the stage)
                      const startedAtByStage = new Map<string, number>()
                      stageChanges.forEach((h: any) => {
                        const prevId = String(h.payload?.previousStageId)
                        const newId = String(h.payload?.newStageId)

                        // Set start time for new stage first
                        if (newId) {
                          // keep first occurrence as start
                          if (!startedAtByStage.has(newId)) {
                            startedAtByStage.set(newId, h.at.seconds)
                          }
                        }

                        // Set finish time for previous stage
                        if (prevId && !completedAtByStage.has(prevId)) {
                          // Use threshold met timestamp if available, otherwise calculate it from production runs
                          let thresholdMetAt = h.payload?.previousStageThresholdMetAt

                          // If threshold met timestamp not in history, calculate it from production runs
                          if (!thresholdMetAt) {
                            thresholdMetAt = calculateCurrentStageThresholdMetAt(prevId, runs)
                          }

                          const stageStartTime = startedAtByStage.get(prevId) || h.at.seconds

                          // Finished time should not be before started time
                          if (thresholdMetAt && thresholdMetAt >= stageStartTime) {
                            completedAtByStage.set(prevId, thresholdMetAt)
                          } else {
                            // Use stage change time, but ensure it's not before start time
                            completedAtByStage.set(prevId, Math.max(h.at.seconds, stageStartTime))
                          }
                        }
                      })

                      // Check threshold met date for ALL stages (not just last stage)
                      // If threshold is met but stage hasn't been moved yet, still show "Finished" time
                      const planned: string[] = (job as any).plannedStageIds || []

                      // For each stage, check if threshold is met (even if stage hasn't been moved yet)
                      for (const stageId of planned) {
                        // Skip if already completed (from history)
                        if (completedAtByStage.has(stageId)) continue

                        // Calculate threshold met date for this stage (including current stage for timeline display)
                        const thresholdMetAt = calculateCurrentStageThresholdMetAt(stageId, runs)
                        if (thresholdMetAt) {
                          const stageStartTime = startedAtByStage.get(stageId)
                          // Use threshold met date if it's after start time (or if no start time)
                          if (!stageStartTime || thresholdMetAt >= stageStartTime) {
                            completedAtByStage.set(stageId, thresholdMetAt)
                          }
                        }
                      }

                      // Note: Current stage threshold met date is set for timeline "Finished" column display
                      // But status will still show as "Current" (not "Done") until stage is moved
                      // NEVER use job finished date for stage finished times - always use threshold met date from production runs
                      // Job finished date is only used for "Job Finished" row, not for stage finished times
                      // If threshold met date was not found, we still don't use job finished date
                      // (this means threshold was not met, so stage should not show as finished)

                      const rows = planned.map((sid) => {
                        const tsFinish = completedAtByStage.get(sid)
                        const tsStart = startedAtByStage.get(sid)
                        const started = tsStart ? new Date(tsStart * 1000).toLocaleString('tr-TR') : '-'
                        const finished = tsFinish ? new Date(tsFinish * 1000).toLocaleString('tr-TR') : '-'
                        let status: 'Done' | 'Current' | '-' = '-'
                        if (job.status === 'done') {
                          status = 'Done'
                        } else if (tsFinish) {
                          // If threshold is met (finished time exists), show as "Done" even if it's current stage
                          // This means the stage is completed (threshold met) but not yet moved to next stage
                          status = 'Done'
                        } else if (sid === job.currentStageId) {
                          // Only show "Current" if threshold is not yet met
                          status = 'Current'
                        }
                        return { stage: stageName(sid), started, finished, status, key: sid }
                      })
                      if (job.status === 'done') {
                        const f = getFinishDate()
                        rows.push({ stage: 'Job Finished', started: f ? new Date((f as any).seconds ? (f as any).seconds * 1000 : f).toLocaleString('tr-TR') : '-', finished: f ? new Date((f as any).seconds ? (f as any).seconds * 1000 : f).toLocaleString('tr-TR') : '-', status: 'Done', key: '__finished__' })
                      }
                      if (rows.length === 0) return <p className="text-sm text-gray-500">No movements recorded yet.</p>
                      return (
                        <div className="overflow-x-auto">
                          <table className="min-w-full text-sm">
                            <thead>
                              <tr className="text-left bg-white">
                                <th className="px-3 py-2 font-medium text-gray-700">Stage</th>
                                <th className="px-3 py-2 font-medium text-gray-700">Started</th>
                                <th className="px-3 py-2 font-medium text-gray-700">Finished</th>
                                <th className="px-3 py-2 font-medium text-gray-700">Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {rows.map(r => (
                                <tr key={r.key} className="border-t border-gray-200">
                                  <td className="px-3 py-2 text-gray-900">{r.stage}</td>
                                  <td className="px-3 py-2 text-gray-900">{r.started}</td>
                                  <td className="px-3 py-2 text-gray-900">{r.finished}</td>
                                  <td className="px-3 py-2">
                                    {r.status === 'Done' && <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 border border-green-200">Done</span>}
                                    {r.status === 'Current' && <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 border border-blue-200">Current</span>}
                                    {r.status === '-' && <span className="text-gray-500">-</span>}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )
                    })()}
                  </div>
                </>
              ) : (
                <p className="text-sm text-gray-600">No specific path defined for this job.</p>
              )}
            </div>
          </div>

          {/* Technical Specifications */}
          {((job as any).productionSpecs) && (
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">Technical Specifications</h3>
              </div>
              {(() => {
                const specs: any = (job as any).productionSpecs || {}
                const formatDim = (obj?: any) => obj && (obj.width || obj.length || obj.height)
                  ? [obj.width, obj.length, obj.height].filter(v => typeof v !== 'undefined').join(' × ')
                  : '-'
                return (
                  <div className="p-6 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="flex items-center justify-between"><span className="text-sm font-medium text-gray-600">Style</span><span className="text-sm text-gray-900">{specs.style || '-'}</span></div>
                      <div className="flex items-center justify-between"><span className="text-sm font-medium text-gray-600">Number Up</span><span className="text-sm text-gray-900">{typeof specs.numberUp === 'number' ? specs.numberUp : '-'}</span></div>
                      <div className="flex items-center justify-between"><span className="text-sm font-medium text-gray-600">Printed Colors</span><span className="text-sm text-gray-900">{typeof specs.printedColors === 'number' ? specs.printedColors : '-'}</span></div>
                      <div className="flex items-center justify-between"><span className="text-sm font-medium text-gray-600">Varnish</span><span className="text-sm text-gray-900">{specs.varnish || '-'}</span></div>
                      <div className="flex items-center justify-between"><span className="text-sm font-medium text-gray-600">Microns</span><span className="text-sm text-gray-900">{typeof specs.microns === 'number' ? specs.microns : '-'}</span></div>
                      <div className="flex items-center justify-between"><span className="text-sm font-medium text-gray-600">Board</span><span className="text-sm text-gray-900">{specs.board || '-'}</span></div>
                      <div className="flex items-center justify-between"><span className="text-sm font-medium text-gray-600">Yield per Sheet</span><span className="text-sm text-gray-900">{typeof specs.yieldPerSheet === 'number' ? specs.yieldPerSheet : '-'}</span></div>
                      <div className="flex items-center justify-between"><span className="text-sm font-medium text-gray-600">Label No</span><span className="text-sm text-gray-900">{typeof specs.labelNo === 'number' ? specs.labelNo : '-'}</span></div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="flex items-center justify-between"><span className="text-sm font-medium text-gray-600">Size (W × L × H)</span><span className="text-sm text-gray-900">{formatDim(specs.size)}</span></div>
                      <div className="flex items-center justify-between"><span className="text-sm font-medium text-gray-600">Forme (W × L)</span><span className="text-sm text-gray-900">{formatDim(specs.forme)}</span></div>
                      <div className="flex items-center justify-between"><span className="text-sm font-medium text-gray-600">Sheet (W × L)</span><span className="text-sm text-gray-900">{formatDim(specs.sheet)}</span></div>
                      <div className="flex items-center justify-between"><span className="text-sm font-medium text-gray-600">Cut To (W × L)</span><span className="text-sm text-gray-900">{formatDim(specs.cutTo)}</span></div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="flex items-center justify-between"><span className="text-sm font-medium text-gray-600">Overs %</span><span className="text-sm text-gray-900">{typeof specs.oversPct === 'number' ? `${specs.oversPct}%` : '-'}</span></div>
                      <div className="flex items-center justify-between"><span className="text-sm font-medium text-gray-600">Sheet Wastage</span><span className="text-sm text-gray-900">{typeof specs.sheetWastage === 'number' ? specs.sheetWastage : '-'}</span></div>
                    </div>
                  </div>
                )
              })()}
            </div>
          )}

          {/* Packaging Summary */}
          {((job as any).packaging) && (
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">Packaging Summary</h3>
              </div>
              {(() => {
                const p: any = (job as any).packaging || {}
                return (
                  <div className="p-6 space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="flex items-center justify-between"><span className="text-sm font-medium text-gray-600">Pieces per Box</span><span className="text-sm text-gray-900">{typeof p.pcsPerBox === 'number' ? p.pcsPerBox : '-'}</span></div>
                      <div className="flex items-center justify-between"><span className="text-sm font-medium text-gray-600">Boxes per Pallet</span><span className="text-sm text-gray-900">{typeof p.boxesPerPallet === 'number' ? p.boxesPerPallet : '-'}</span></div>
                      <div className="flex items-center justify-between"><span className="text-sm font-medium text-gray-600">Planned Pallets</span><span className="text-sm text-gray-900">{typeof p.plannedPallets === 'number' ? p.plannedPallets : '-'}</span></div>
                      <div className="flex items-center justify-between"><span className="text-sm font-medium text-gray-600">Actual Pallets</span><span className="text-sm text-gray-900">{typeof p.actualPallets === 'number' ? p.actualPallets : '-'}</span></div>
                    </div>
                  </div>
                )
              })()}
            </div>
          )}

          {/* Special Components */}
          {Array.isArray((job as any).specialComponents) && (job as any).specialComponents.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">Special Components</h3>
              </div>
              <div className="p-6">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-left bg-gray-50">
                        <th className="px-3 py-2 font-medium text-gray-700">Name</th>
                        <th className="px-3 py-2 font-medium text-gray-700">Type</th>
                        <th className="px-3 py-2 font-medium text-gray-700">Quantity</th>
                        <th className="px-3 py-2 font-medium text-gray-700">Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {((job as any).specialComponents as any[]).map((c, idx) => (
                        <tr key={idx} className="border-t border-gray-200">
                          <td className="px-3 py-2 text-gray-900">{c.name || '-'}</td>
                          <td className="px-3 py-2 text-gray-900">{c.type || '-'}</td>
                          <td className="px-3 py-2 text-gray-900">{typeof c.qty === 'number' ? c.qty : '-'}</td>
                          <td className="px-3 py-2 text-gray-900">{c.notes || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Stage Progress (per stage) */}
          {Array.isArray((job as any).stageProgress) && (job as any).stageProgress.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">Stage Progress</h3>
              </div>
              <div className="p-6">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-left bg-gray-50">
                        <th className="px-3 py-2 font-medium text-gray-700">Stage</th>
                        <th className="px-3 py-2 font-medium text-gray-700">Planned</th>
                        <th className="px-3 py-2 font-medium text-gray-700">Produced</th>
                        <th className="px-3 py-2 font-medium text-gray-700">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {((job as any).stageProgress as any[]).map((sp, idx) => (
                        <tr key={idx} className="border-t border-gray-200">
                          <td className="px-3 py-2 text-gray-900">{typeof sp.stageId === 'string' ? stageName(sp.stageId) : '-'}</td>
                          <td className="px-3 py-2 text-gray-900">{typeof sp.qtyPlanned === 'number' ? sp.qtyPlanned : '-'}</td>
                          <td className="px-3 py-2 text-gray-900">{typeof sp.qtyProduced === 'number' ? sp.qtyProduced : '-'}</td>
                          <td className="px-3 py-2">
                            {sp.status ? (
                              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200">{String(sp.status).replace('_', ' ').toUpperCase()}</span>
                            ) : (
                              <span className="text-gray-500">-</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Notes */}
          {job.notes && (
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">Notes</h3>
              </div>
              <div className="p-6">
                <p className="text-sm text-gray-900">{job.notes}</p>
              </div>
            </div>
          )}

          {/* Block Reason */}
          {job.status === 'blocked' && job.blockReason && (
            <div className="bg-red-50 rounded-lg border border-red-200 shadow-sm">
              <div className="px-6 py-4 border-b border-red-200">
                <h3 className="text-lg font-semibold text-red-900 flex items-center">
                  <ExclamationTriangleIcon className="h-5 w-5 mr-2" />
                  Block Reason
                </h3>
              </div>
              <div className="p-6">
                <p className="text-sm text-red-900">{job.blockReason}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

