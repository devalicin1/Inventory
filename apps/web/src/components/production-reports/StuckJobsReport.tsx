import { useState, type FC } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { StuckJobData } from './utils'
import { ExclamationTriangleIcon, ClockIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { listJobProductionRuns, listWorkflows } from '../../api/production-jobs'
import type { ProductionRun } from '../../api/production-jobs'

interface StuckJobsReportProps {
  data: StuckJobData[]
  onJobClick?: (jobId: string) => void
  workspaceId?: string
}

export const StuckJobsReport: FC<StuckJobsReportProps> = ({ data, onJobClick, workspaceId }) => {
  const [selectedJob, setSelectedJob] = useState<StuckJobData | null>(null)
  const totalStuck = data.length
  const criticalStuck = data.filter(job => job.daysStuck > 3).length
  const highPriorityStuck = data.filter(job => job.priority >= 4).length
  const totalWIPQuantity = data.reduce((sum, job) => sum + job.previousStageOutput, 0)
  
  const sortedData = [...data].sort((a, b) => {
    // Sort by priority first, then by days stuck
    if (a.priority !== b.priority) return b.priority - a.priority
    return b.daysStuck - a.daysStuck
  })

  // Fetch workflows for stage names
  const { data: workflows = [] } = useQuery({
    queryKey: ['workflows', workspaceId],
    queryFn: () => workspaceId ? listWorkflows(workspaceId) : Promise.resolve([]),
    enabled: !!workspaceId && !!selectedJob
  })

  // Fetch production runs for selected job
  const { data: productionRuns = [] } = useQuery({
    queryKey: ['production-runs', workspaceId, selectedJob?.jobId],
    queryFn: () => workspaceId && selectedJob ? listJobProductionRuns(workspaceId, selectedJob.jobId) : Promise.resolve([]),
    enabled: !!workspaceId && !!selectedJob
  })

  const getStageName = (stageId: string) => {
    for (const wf of workflows) {
      const stage = wf.stages?.find((s: any) => s.id === stageId)
      if (stage) return stage.name
    }
    return stageId
  }

  const formatDateTime = (date: any) => {
    if (!date) return '-'
    try {
      const d = date.seconds ? new Date(date.seconds * 1000) : new Date(date)
      return d.toLocaleString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      })
    } catch {
      return '-'
    }
  }

  const calculateDelay = (runDate: any, previousRunDate: any) => {
    if (!runDate || !previousRunDate) return null
    try {
      const current = runDate.seconds ? new Date(runDate.seconds * 1000) : new Date(runDate)
      const previous = previousRunDate.seconds ? new Date(previousRunDate.seconds * 1000) : new Date(previousRunDate)
      const diffMs = current.getTime() - previous.getTime()
      const diffHours = diffMs / (1000 * 60 * 60)
      const diffDays = diffHours / 24
      
      if (diffDays >= 1) {
        return `${diffDays.toFixed(1)} days`
      } else if (diffHours >= 1) {
        return `${diffHours.toFixed(1)} hours`
      } else {
        const diffMins = diffMs / (1000 * 60)
        return `${diffMins.toFixed(0)} minutes`
      }
    } catch {
      return null
    }
  }

  const sortedRuns = [...productionRuns]
    .filter(run => {
      const anyRun = run as any
      return !anyRun.transferSourceRunIds || !Array.isArray(anyRun.transferSourceRunIds) || anyRun.transferSourceRunIds.length === 0
    })
    .sort((a, b) => {
      const dateA = a.at?.seconds ? a.at.seconds * 1000 : new Date(a.at).getTime()
      const dateB = b.at?.seconds ? b.at.seconds * 1000 : new Date(b.at).getTime()
      return dateA - dateB
    })
  
  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Stuck Jobs Report (Process View)</h3>
      <p className="text-sm text-gray-600 mb-4">
        Jobs that have completed output in a previous stage but haven't started in the next stage.
      </p>
      
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold text-amber-900">{totalStuck}</div>
              <div className="text-sm text-amber-700">Total Stuck Jobs</div>
            </div>
            <ExclamationTriangleIcon className="h-8 w-8 text-amber-400" />
          </div>
        </div>
        <div className="bg-red-50 rounded-lg p-4 border border-red-200">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold text-red-900">{criticalStuck}</div>
                <div className="text-sm text-red-700">Critical (&gt;3 days)</div>
            </div>
            <ClockIcon className="h-8 w-8 text-red-400" />
          </div>
        </div>
        <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold text-orange-900">{highPriorityStuck}</div>
              <div className="text-sm text-orange-700">High Priority</div>
            </div>
            <ExclamationTriangleIcon className="h-8 w-8 text-orange-400" />
          </div>
        </div>
        <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold text-blue-900">{totalWIPQuantity.toLocaleString()}</div>
              <div className="text-sm text-blue-700">Total WIP Quantity</div>
            </div>
            <div className="h-8 w-8 rounded-full bg-blue-200 flex items-center justify-center">
              <span className="text-blue-700 font-bold text-xs">Qty</span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Stuck Jobs Table */}
      {sortedData.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Job</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Stage Transition</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Output Quantity</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Days Stuck</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Priority</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Workcenter</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sortedData.map((job) => (
                <tr 
                  key={job.jobId} 
                  onClick={() => onJobClick?.(job.jobId)}
                  className="hover:bg-amber-50 transition-colors cursor-pointer"
                >
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="text-sm font-semibold text-gray-900">{job.jobCode}</div>
                    {job.jobName && (
                      <div className="text-xs text-gray-500 mt-0.5">{job.jobName}</div>
                    )}
                    {job.boardSheetName && (
                      <div className="text-xs text-gray-400 mt-0.5 italic">{job.boardSheetName}</div>
                    )}
                    {job.customerName && (
                      <div className="text-xs text-blue-600 mt-0.5 font-medium">{job.customerName}</div>
                    )}
                  </td>
                  <td 
                    className="px-4 py-3 whitespace-nowrap"
                    onClick={(e) => {
                      e.stopPropagation()
                      if (workspaceId) {
                        setSelectedJob(job)
                      }
                    }}
                  >
                    <div className="text-xs text-gray-600 cursor-pointer hover:text-blue-600 transition-colors">
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
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`text-xs font-bold px-2 py-1 rounded-md ${
                      job.priority >= 4 ? 'bg-red-100 text-red-700' :
                      job.priority === 3 ? 'bg-amber-100 text-amber-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      P{job.priority}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                    {job.workcenterName || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
          <ExclamationTriangleIcon className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-600 font-medium">No stuck jobs detected</p>
          <p className="text-sm text-gray-500 mt-1">All jobs are progressing normally between stages.</p>
        </div>
      )}

      {/* Production Flow Modal */}
      {selectedJob && (
        <div 
          className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50" 
          onClick={() => setSelectedJob(null)}
        >
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
            <div 
              className="relative inline-block w-full max-w-7xl p-6 my-8 text-left align-middle transition-all transform bg-white shadow-xl rounded-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200">
                <div>
                  <h3 className="text-2xl font-bold text-gray-900">Production Flow - {selectedJob.jobCode}</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Transition: <span className="font-medium">{selectedJob.previousStageName}</span> → <span className="font-medium text-amber-600">{selectedJob.currentStageName}</span>
                  </p>
                  {selectedJob.jobName && (
                    <p className="text-sm text-gray-600 mt-1">{selectedJob.jobName}</p>
                  )}
                </div>
                <button
                  onClick={() => setSelectedJob(null)}
                  className="text-gray-400 hover:text-gray-600 transition-colors p-2 hover:bg-gray-100 rounded-lg"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>

              {/* Production Runs Table */}
              <div className="overflow-x-auto max-h-[70vh] border border-gray-200 rounded-lg">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50 sticky top-0 z-10">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Date & Time</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Stage</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Qty Good</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Qty Scrap</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Lot</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Delay</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Operator</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {sortedRuns.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                          No production runs found
                        </td>
                      </tr>
                    ) : (
                      sortedRuns.map((run, index) => {
                        const previousRun = index > 0 ? sortedRuns[index - 1] : null
                        const delay = index > 0 ? calculateDelay(run.at, previousRun?.at) : null
                        
                        return (
                          <tr key={run.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                              {formatDateTime(run.at)}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                              {getStageName(run.stageId)}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                              {run.qtyGood.toLocaleString()}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                              {run.qtyScrap || 0}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                              {run.lot || '-'}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm">
                              {delay ? (
                                <span className="text-amber-600 font-medium">{delay}</span>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                              {run.operatorId || '-'}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate" title={run.notes || ''}>
                              {run.notes || '-'}
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

