import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { listJobProductionRuns, listJobConsumptions, subscribeToJobProductionRuns, subscribeToJobConsumptions, subscribeToJob } from '../../../api/production-jobs'
import type { Job } from '../../../api/production-jobs'

export function useProductionRuns(workspaceId: string, selectedJob: Job | null) {
  const [productionRuns, setProductionRuns] = useState<any[]>([])
  const [consumptions, setConsumptions] = useState<any[]>([])

  // Fetch initial production runs when job is selected
  const { data: initialProductionRuns, refetch: refetchProductionRuns, isLoading: isLoadingProductionRuns } = useQuery({
    queryKey: ['jobRuns', workspaceId, selectedJob?.id],
    queryFn: () => selectedJob ? listJobProductionRuns(workspaceId, selectedJob.id) : [],
    enabled: !!workspaceId && !!selectedJob?.id,
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: false
  })

  // Fetch initial consumptions when job is selected
  const { data: initialConsumptions } = useQuery({
    queryKey: ['jobConsumptions', workspaceId, selectedJob?.id],
    queryFn: () => selectedJob ? listJobConsumptions(workspaceId, selectedJob.id) : [],
    enabled: !!workspaceId && !!selectedJob?.id,
    staleTime: 0
  })

  // Real-time subscription for selected job
  useEffect(() => {
    if (!workspaceId || !selectedJob?.id) return

    const unsubscribe = subscribeToJob(
      workspaceId,
      selectedJob.id,
      (updatedJob) => {
        // This will be handled by parent component
      },
      (error) => {
        console.error('[ProductionScanner] Job subscription error:', error)
      }
    )

    return () => {
      unsubscribe()
    }
  }, [workspaceId, selectedJob?.id])

  // Real-time subscription for production runs
  useEffect(() => {
    if (!workspaceId || !selectedJob?.id) {
      setProductionRuns([])
      return
    }

    if (initialProductionRuns && initialProductionRuns.length > 0) {
      setProductionRuns(initialProductionRuns)
    }

    const unsubscribe = subscribeToJobProductionRuns(
      workspaceId,
      selectedJob.id,
      (runs) => {
        console.log('[ProductionScanner] Real-time subscription update:', runs.length, 'runs')
        setProductionRuns(runs)
      }
    )

    return () => unsubscribe()
  }, [workspaceId, selectedJob?.id, initialProductionRuns])

  // Initialize consumptions from query, then update via real-time subscription
  useEffect(() => {
    if (!workspaceId || !selectedJob?.id) {
      setConsumptions([])
      return
    }

    if (initialConsumptions && initialConsumptions.length > 0) {
      setConsumptions(initialConsumptions)
    }

    const unsubscribe = subscribeToJobConsumptions(
      workspaceId,
      selectedJob.id,
      (consumptions) => {
        setConsumptions(consumptions)
      }
    )

    return () => unsubscribe()
  }, [workspaceId, selectedJob?.id, initialConsumptions])

  return {
    productionRuns,
    setProductionRuns,
    consumptions,
    setConsumptions,
    initialProductionRuns,
    refetchProductionRuns,
    isLoadingProductionRuns,
  }
}

