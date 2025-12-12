import type { Job } from '../../../api/production-jobs'
import type { StageProgress } from '../types'

export const getStatusColor = (status: Job['status']): string => {
  switch (status) {
    case 'draft': return 'bg-gray-100 text-gray-800'
    case 'released': return 'bg-blue-100 text-blue-800'
    case 'in_progress': return 'bg-green-100 text-green-800'
    case 'blocked': return 'bg-red-100 text-red-800'
    case 'done': return 'bg-purple-100 text-purple-800'
    case 'cancelled': return 'bg-gray-100 text-gray-800'
    default: return 'bg-gray-100 text-gray-800'
  }
}

export const getStatusLabel = (status: string): string => {
  switch (status) {
    case 'draft': return 'Draft'
    case 'released': return 'Released'
    case 'in_progress': return 'In Progress'
    case 'blocked': return 'Blocked'
    case 'done': return 'Completed'
    case 'cancelled': return 'Cancelled'
    default: return status
  }
}

export const getNextStage = (
  job: Job,
  workflows: any[]
): { id: string; name: string } | null => {
  if (!job.plannedStageIds || job.plannedStageIds.length === 0) return null
  const currentIndex = job.plannedStageIds.indexOf(job.currentStageId || '')
  if (currentIndex === -1 || currentIndex >= job.plannedStageIds.length - 1) return null
  const nextStageId = job.plannedStageIds[currentIndex + 1]
  const workflow = workflows.find(w => w.stages?.some((s: any) => s.id === nextStageId))
  const nextStage = workflow?.stages?.find((s: any) => s.id === nextStageId)
  if (!nextStage) return null
  return { id: nextStageId, name: nextStage.name }
}

export const getStageName = (
  stageId: string | undefined,
  workflows: any[],
  jobStatus?: Job['status']
): string => {
  // If job is done, show "Completed" instead of the actual stage
  if (jobStatus === 'done') {
    return 'Completed'
  }
  if (!stageId) return 'Unassigned'
  for (const wf of workflows) {
    const stage = wf.stages?.find((s: any) => s.id === stageId)
    if (stage) return stage.name
  }
  return stageId
}

export const getStageInfo = (stageId: string | undefined, workflows: any[]) => {
  if (!stageId) return null
  for (const workflow of workflows) {
    const stage = workflow.stages?.find((s: any) => s.id === stageId)
    if (stage) return stage
  }
  return null
}

