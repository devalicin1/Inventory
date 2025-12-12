import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  setJobStatus,
  createConsumption,
  createTimeLog,
  createProductionRun,
  moveJobToStage,
  listJobProductionRuns,
  getJob,
  listJobs,
} from '../../../api/production-jobs'
import { getProductByCode } from '../../../api/inventory'
import { createStockTransaction } from '../../../api/inventory'
import type { Job } from '../../../api/production-jobs'

export function useJobMutations(
  workspaceId: string,
  selectedJob: Job | null,
  setSelectedJob: (job: Job | null) => void,
  setProductionRuns: (runs: any[]) => void,
  setConsumptions: (consumptions: any[]) => void,
  setActiveAction: (action: string | null) => void,
  setActionData: (data: any) => void,
  workflows: any[]
) {
  const queryClient = useQueryClient()

  const statusMutation = useMutation({
    mutationFn: ({ jobId, status, blockReason }: { jobId: string; status: Job['status']; blockReason?: string }) =>
      setJobStatus(workspaceId, jobId, status, blockReason),
    onSuccess: async (_, variables) => {
      if (selectedJob && selectedJob.id === variables.jobId) {
        setSelectedJob({
          ...selectedJob,
          status: variables.status,
          ...(variables.blockReason && { blockReason: variables.blockReason }),
          updatedAt: new Date() as any
        })
      }
      
      await queryClient.invalidateQueries({ queryKey: ['jobs', workspaceId], exact: false })
      await queryClient.invalidateQueries({ queryKey: ['job', workspaceId, variables.jobId] })
    },
  })

  const consumptionMutation = useMutation({
    mutationFn: async (data: any) => {
      if (!data.itemId && data.sku) {
        try {
          const product = await getProductByCode(workspaceId, data.sku)
          if (product) {
            data.itemId = product.id
          }
        } catch (err) {
          console.warn('Could not find product for SKU during consumption:', data.sku)
        }
      }
      return createConsumption(workspaceId, selectedJob!.id, data)
    },
    onSuccess: async (_, variables) => {
      if (selectedJob && variables) {
        const newConsumption = {
          id: `temp-${Date.now()}`,
          jobId: selectedJob.id,
          itemId: variables.itemId,
          sku: variables.sku,
          name: variables.name,
          qty: variables.qty || 0,
          uom: variables.uom,
          at: new Date(),
          ...variables
        }
        setConsumptions(prev => [newConsumption, ...prev])
      }
      
      await queryClient.invalidateQueries({ queryKey: ['jobs', workspaceId], exact: false })
      await queryClient.invalidateQueries({ queryKey: ['job', workspaceId, selectedJob!.id] })
      await queryClient.invalidateQueries({ queryKey: ['jobConsumptions', workspaceId, selectedJob!.id] })
      
      setActiveAction(null)
      setActionData({})
      alert('Consumption recorded!')
    },
    onError: (error: any) => {
      alert(error?.message || 'Failed to record consumption')
    }
  })

  const productionMutation = useMutation({
    mutationFn: (data: any) => createProductionRun(workspaceId, selectedJob!.id, data),
    onSuccess: async (_, variables) => {
      const job = selectedJob
      
      if (job && variables) {
        const newRun = {
          id: `temp-${Date.now()}`,
          jobId: job.id,
          stageId: variables.stageId || job.currentStageId,
          qtyGood: variables.qtyGood || 0,
          qtyScrap: variables.qtyScrap || 0,
          lot: variables.lot,
          workcenterId: variables.workcenterId || job.workcenterId,
          at: new Date(),
          ...variables
        }
        setProductionRuns(prev => [newRun, ...prev])
      }
      
      await queryClient.invalidateQueries({ queryKey: ['jobs', workspaceId], exact: false })
      await queryClient.invalidateQueries({ queryKey: ['jobRuns', workspaceId, job!.id] })
      await queryClient.invalidateQueries({ queryKey: ['allJobRuns', workspaceId] })
      
      alert('✓ Production output recorded!')
      
      setActiveAction(null)
      setActionData({})
    },
    onError: (error: any) => {
      alert(error?.message || 'Failed to record production output')
    }
  })

  const stockTxnMutation = useMutation({
    mutationFn: (data: any) => createStockTransaction({ ...data, workspaceId }),
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['products', workspaceId] })
      setActiveAction(null)
      setActionData({})
      alert('Stock transaction recorded!')
    },
  })

  const timeLogMutation = useMutation({
    mutationFn: (data: any) => createTimeLog(workspaceId, selectedJob!.id, data),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['jobs', workspaceId], exact: false })
    },
  })

  const moveStageMutation = useMutation({
    mutationFn: ({ jobId, newStageId, previousStageId, note }: { jobId: string; newStageId: string; previousStageId?: string; note?: string }) => {
      console.log(`[Move to] Moving job ${jobId} from ${previousStageId} to ${newStageId}`)
      return moveJobToStage(workspaceId, jobId, newStageId, 'current-user', note)
    },
    onSuccess: async (_, variables) => {
      console.log(`[Move to] onSuccess called with variables:`, variables)
      
      if (selectedJob && selectedJob.id === variables.jobId) {
        const previousStageId = variables.previousStageId || selectedJob.currentStageId
        const newStageId = variables.newStageId
        
        if (previousStageId && previousStageId !== newStageId) {
          try {
            const allRuns = await listJobProductionRuns(workspaceId, variables.jobId)
            const previousStageRuns = allRuns.filter((r: any) => {
              if (r.stageId !== previousStageId) return false
              if (r.transferSourceRunIds && Array.isArray(r.transferSourceRunIds) && r.transferSourceRunIds.length > 0) {
                return false
              }
              return true
            })
            
            if (previousStageRuns.length > 0) {
              const workflow = workflows.find(w => w.id === selectedJob.workflowId)
              const previousStageInfo = workflow?.stages?.find((s: any) => s.id === previousStageId) as any
              const newStageInfo = workflow?.stages?.find((s: any) => s.id === newStageId) as any
              const previousStageOutputUOM = previousStageInfo?.outputUOM || previousStageInfo?.inputUOM || ''
              const newStageInputUOM = newStageInfo?.inputUOM || ''
              const newStageOutputUOM = newStageInfo?.outputUOM || ''
              const numberUp = selectedJob.productionSpecs?.numberUp || 1
              
              const runsByLot = new Map<string, typeof previousStageRuns>()
              const runsWithoutLot: typeof previousStageRuns = []
              
              previousStageRuns.forEach((run: any) => {
                const lot = run.lot || ''
                if (lot) {
                  if (!runsByLot.has(lot)) {
                    runsByLot.set(lot, [])
                  }
                  runsByLot.get(lot)!.push(run)
                } else {
                  runsWithoutLot.push(run)
                }
              })
              
              const generateLotId = () => {
                const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '')
                const random = Math.random().toString(36).substring(2, 6).toUpperCase()
                return `${selectedJob.code || selectedJob.id}-${timestamp}-${random}`
              }
              
              for (const [lot, runs] of runsByLot.entries()) {
                const totalQty = runs.reduce((sum: number, r: any) => sum + Number(r.qtyGood || 0), 0)
                const sourceRunIds = runs.map((r: any) => r.id)
                
                let transferQty = totalQty
                if (previousStageOutputUOM !== newStageInputUOM) {
                  if (previousStageOutputUOM === 'cartoon' && newStageInputUOM === 'sheets' && numberUp > 0) {
                    transferQty = totalQty / numberUp
                  } else if (previousStageOutputUOM === 'sheets' && newStageInputUOM === 'cartoon' && numberUp > 0) {
                    transferQty = totalQty * numberUp
                  }
                }
                
                if (newStageInputUOM !== newStageOutputUOM) {
                  if (newStageInputUOM === 'sheets' && newStageOutputUOM === 'cartoon' && numberUp > 0) {
                    transferQty = transferQty * numberUp
                  } else if (newStageInputUOM === 'cartoon' && newStageOutputUOM === 'sheets' && numberUp > 0) {
                    transferQty = transferQty / numberUp
                  }
                }
                
                if (transferQty > 0) {
                  await createProductionRun(workspaceId, variables.jobId, {
                    stageId: newStageId,
                    qtyGood: transferQty,
                    qtyScrap: 0,
                    lot: lot,
                    operatorId: 'current-user',
                    at: new Date(),
                    transferSourceRunIds: sourceRunIds,
                    notes: `Auto-transferred from ${previousStageInfo?.name || previousStageId} via "Move to" button`
                  } as any)
                }
              }
              
              if (runsWithoutLot.length > 0) {
                const totalQty = runsWithoutLot.reduce((sum: number, r: any) => sum + Number(r.qtyGood || 0), 0)
                const sourceRunIds = runsWithoutLot.map((r: any) => r.id)
                const transferLotId = generateLotId()
                
                let transferQty = totalQty
                if (previousStageOutputUOM !== newStageInputUOM) {
                  if (previousStageOutputUOM === 'cartoon' && newStageInputUOM === 'sheets' && numberUp > 0) {
                    transferQty = totalQty / numberUp
                  } else if (previousStageOutputUOM === 'sheets' && newStageInputUOM === 'cartoon' && numberUp > 0) {
                    transferQty = totalQty * numberUp
                  }
                }
                
                if (newStageInputUOM !== newStageOutputUOM) {
                  if (newStageInputUOM === 'sheets' && newStageOutputUOM === 'cartoon' && numberUp > 0) {
                    transferQty = transferQty * numberUp
                  } else if (newStageInputUOM === 'cartoon' && newStageOutputUOM === 'sheets' && numberUp > 0) {
                    transferQty = transferQty / numberUp
                  }
                }
                
                if (transferQty > 0) {
                  await createProductionRun(workspaceId, variables.jobId, {
                    stageId: newStageId,
                    qtyGood: transferQty,
                    qtyScrap: 0,
                    lot: transferLotId,
                    operatorId: 'current-user',
                    at: new Date(),
                    transferSourceRunIds: sourceRunIds,
                    notes: `Auto-transferred from ${previousStageInfo?.name || previousStageId} via "Move to" button`
                  } as any)
                }
              }
              
              queryClient.invalidateQueries({ queryKey: ['jobRuns', workspaceId, variables.jobId] })
            }
          } catch (e) {
            console.error('[ProductionScanner] Failed to auto-transfer outputs after stage move:', e)
          }
        }
      }

      if (selectedJob && selectedJob.id === variables.jobId) {
        setSelectedJob({
          ...selectedJob,
          currentStageId: variables.newStageId,
          updatedAt: new Date() as any
        })
      }

      await queryClient.invalidateQueries({ queryKey: ['jobs', workspaceId], exact: false })
      await queryClient.invalidateQueries({ queryKey: ['job', workspaceId, selectedJob?.id] })

      try {
        const freshJob = await getJob(workspaceId, variables.jobId)
        if (freshJob) {
          setSelectedJob(freshJob)
        }
      } catch (e) {
        console.warn('[ProductionScanner] Failed to refresh job after stage move:', e)
      }

      setActiveAction(null)
      setActionData({})
    },
    onError: (error: any) => {
      alert(error?.message || 'Failed to move job to next stage')
    }
  })

  return {
    statusMutation,
    consumptionMutation,
    productionMutation,
    stockTxnMutation,
    timeLogMutation,
    moveStageMutation,
  }
}

