import { useMemo, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { getJob, listJobs, listJobProductionRuns, subscribeToJob, recalculateJobBomConsumption, recordJobOutput } from '../../api/production-jobs'
import { getProductByCode, getProductOnHand, type ListedProduct } from '../../api/inventory'
import { ConfirmInventoryPostingModal } from '../ConfirmInventoryPostingModal'
import { useScannerState } from './hooks/useScannerState'
import { useJobQueries } from './hooks/useJobQueries'
import { useProductionRuns } from './hooks/useProductionRuns'
import { useJobMutations } from './hooks/useJobMutations'
import { useCameraScanner } from './hooks/useCameraScanner'
import { ScannerHeader } from './components/ScannerHeader'
import { ScannerArea } from './components/ScannerArea'
import { RecentScans } from './components/RecentScans'
import { handleScan } from './utils/scanHandler'
import { getStageName, getStageInfo, getNextStage, getStatusColor, getStatusLabel } from './utils/jobHelpers'
import { calculateProgress, calculateStageProgress, calculateProductionSummary, calculateToleranceThresholds } from './utils/productionCalculations'
import type { ProductionScannerProps } from './types'
import {
  PlayIcon,
  CheckCircleIcon,
  CubeIcon,
  XMarkIcon,
  MagnifyingGlassIcon,
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  AdjustmentsHorizontalIcon,
  ExclamationTriangleIcon,
  ArrowRightIcon,
  PauseIcon,
  CalendarIcon,
  BuildingStorefrontIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline'

// Import large components (we'll create these next)
// import { JobSheet } from './components/JobSheet'
// import { ProductSheet } from './components/ProductSheet'
// import { ConsumeMaterialDialog } from './components/ConsumeMaterialDialog'
// import { RecordOutputDialog } from './components/RecordOutputDialog'
// import { StageOutputModal } from './components/StageOutputModal'
// import { BatchTransferModal } from './components/BatchTransferModal'
// import { LotInventoryPostingModal } from './components/LotInventoryPostingModal'

export function ProductionScanner({ workspaceId, onClose }: ProductionScannerProps) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  
  // State management
  const scannerState = useScannerState()
  const {
    scanMode,
    setScanMode,
    manualCode,
    setManualCode,
    selectedJob,
    setSelectedJob,
    selectedProduct,
    setSelectedProduct,
    recentScans,
    addToHistory,
    lastScannedCode,
    setLastScannedCode,
    activeAction,
    setActiveAction,
    actionData,
    setActionData,
    showInventoryPostingModal,
    setShowInventoryPostingModal,
    showLotInventoryPostingModal,
    setShowLotInventoryPostingModal,
    selectedLotForPosting,
    setSelectedLotForPosting,
    showConsumeDialog,
    setShowConsumeDialog,
    showProduceDialog,
    setShowProduceDialog,
    dialogProductionRuns,
    setDialogProductionRuns,
    isLoadingDialogRuns,
    setIsLoadingDialogRuns,
    batches,
    setBatches,
    showBatchTransferModal,
    setShowBatchTransferModal,
    batchTransferData,
    setBatchTransferData,
    showStageOutputModal,
    setShowStageOutputModal,
    selectedStageForOutput,
    setSelectedStageForOutput,
    freshRunsForModal,
    setFreshRunsForModal,
    isLoadingFreshRuns,
    setIsLoadingFreshRuns,
    selectedOutputIds,
    setSelectedOutputIds,
    selectedOutputStageId,
    setSelectedOutputStageId,
    videoRef,
    isScanning,
    setIsScanning,
    cameraError,
    setCameraError,
    scanAttempts,
    setScanAttempts,
    lastScanTime,
    setLastScanTime,
    dismissedCode,
    resetSelectionDismissed,
  } = scannerState

  // Alias for backward compatibility
  const resetSelection = resetSelectionDismissed

  // Queries
  const { jobs, jobsLoading, jobsError, workflows, products, workcenters, stockReasons } = useJobQueries(workspaceId)

  // Production runs
  const {
    productionRuns,
    setProductionRuns,
    consumptions,
    setConsumptions,
    initialProductionRuns,
  } = useProductionRuns(workspaceId, selectedJob)

  // Mutations
  const {
    statusMutation,
    consumptionMutation,
    productionMutation,
    stockTxnMutation,
    timeLogMutation,
    moveStageMutation,
  } = useJobMutations(
    workspaceId,
    selectedJob,
    setSelectedJob,
    setProductionRuns,
    setConsumptions,
    setActiveAction,
    setActionData,
    workflows
  )

  // Real-time subscription for selected job
  useEffect(() => {
    if (!workspaceId || !selectedJob?.id) return

    const unsubscribe = subscribeToJob(
      workspaceId,
      selectedJob.id,
      (updatedJob) => {
        if (updatedJob) {
          setSelectedJob(updatedJob)
        } else {
          setSelectedJob(null)
        }
      },
      (error) => {
        console.error('[ProductionScanner] Job subscription error:', error)
      }
    )

    return () => {
      unsubscribe()
    }
  }, [workspaceId, selectedJob?.id, setSelectedJob])

  // Camera scanner
  useCameraScanner({
    scanMode,
    videoRef,
    setIsScanning,
    setCameraError,
    setScanAttempts,
    setLastScanTime,
    setLastScannedCode,
    lastScannedCode,
    onScanSuccess: (code) => {
      handleScanCode(code)
    },
  })

  // Fetch dialog production runs when dialog opens
  useEffect(() => {
    if (showProduceDialog && selectedJob?.id && workspaceId) {
      setIsLoadingDialogRuns(true)
      const fetchRuns = async () => {
        try {
          const runs = await listJobProductionRuns(workspaceId, selectedJob.id)
          setDialogProductionRuns(runs)
          setProductionRuns(runs)
          setIsLoadingDialogRuns(false)
          
          if (selectedJob && !selectedOutputStageId) {
            const plannedStages = selectedJob.plannedStageIds || []
            for (let i = plannedStages.length - 1; i >= 0; i--) {
              const stageId = plannedStages[i]
              const stageRuns = runs.filter((r: any) => r.stageId === stageId)
              const hasTransferredLots = stageRuns.some((r: any) => 
                r.transferSourceRunIds && Array.isArray(r.transferSourceRunIds) && r.transferSourceRunIds.length > 0
              )
              if (hasTransferredLots) {
                setSelectedOutputStageId(stageId)
                break
              }
            }
            if (!selectedOutputStageId) {
              setSelectedOutputStageId(selectedJob.currentStageId || null)
            }
          }
        } catch (error) {
          console.error('[ProductionScanner] Error fetching production runs:', error)
          setIsLoadingDialogRuns(false)
        }
      }
      fetchRuns()
    } else {
      setDialogProductionRuns([])
      setIsLoadingDialogRuns(false)
      setSelectedOutputStageId(null)
    }
  }, [showProduceDialog, selectedJob?.id, workspaceId, selectedOutputStageId, setIsLoadingDialogRuns, setDialogProductionRuns, setProductionRuns, setSelectedOutputStageId])

  // Auto-fill lot number when stage changes or dialog opens (FIFO)
  useEffect(() => {
    if (!showProduceDialog || !selectedJob || !selectedOutputStageId) return
   
    const effectiveRuns = dialogProductionRuns.length > 0
      ? dialogProductionRuns
      : (productionRuns.length > 0 ? productionRuns : (initialProductionRuns || []))
   
    const outputStageId = selectedOutputStageId
    const transferredRuns = effectiveRuns.filter((r: any) => {
      if (r.stageId !== outputStageId) return false
      return r.transferSourceRunIds && Array.isArray(r.transferSourceRunIds) && r.transferSourceRunIds.length > 0
    })
   
    if (transferredRuns.length === 0) return
   
    // Find the previous stage ID
    const plannedStages = selectedJob.plannedStageIds || []
    const currentStageIndex = plannedStages.indexOf(outputStageId)
    const previousStageId = currentStageIndex > 0 ? plannedStages[currentStageIndex - 1] : null
    
    // Get source run IDs from transfer runs
    const sourceRunIds = new Set<string>()
    transferredRuns.forEach((transferRun: any) => {
      if (Array.isArray(transferRun.transferSourceRunIds)) {
        transferRun.transferSourceRunIds.forEach((id: string) => sourceRunIds.add(String(id)))
      }
    })
    
    // Find all source runs from the previous stage only
    const previousStageSourceRuns = effectiveRuns.filter((r: any) => {
      if (previousStageId && r.stageId !== previousStageId) return false
      return sourceRunIds.has(String(r.id))
    })
   
    // Group source runs by lot to calculate transferred quantities per lot
    const lotMap = new Map<string, { transferredQty: number; processedQty: number; transferDate: Date }>()
    
    previousStageSourceRuns.forEach((sourceRun: any) => {
      const lot = sourceRun.lot || ''
      if (!lot) return
      
      const transferredQty = Number(sourceRun.qtyGood || 0)
      const runDate = sourceRun.at
        ? (typeof sourceRun.at === 'string' ? new Date(sourceRun.at) : new Date((sourceRun.at as any).seconds * 1000))
        : new Date()
      
      // Normalize lot numbers for comparison (trim and case-insensitive)
      const normalizedLot = String(lot || '').trim()
      const processedRuns = effectiveRuns.filter((r: any) => {
        const runLot = String(r.lot || '').trim()
        return r.stageId === outputStageId &&
          runLot === normalizedLot &&
          runLot !== '' &&
          !(r.transferSourceRunIds && Array.isArray(r.transferSourceRunIds) && r.transferSourceRunIds.length > 0)
      })
      const processedQty = processedRuns.reduce((sum: number, r: any) => sum + Number(r.qtyGood || 0), 0)
     
      if (lotMap.has(lot)) {
        const existing = lotMap.get(lot)!
        existing.transferredQty += transferredQty
        existing.processedQty += processedQty
        if (runDate < existing.transferDate) {
          existing.transferDate = runDate
        }
      } else {
        lotMap.set(lot, { transferredQty, processedQty, transferDate: runDate })
      }
    })
   
    // Find FIFO lot (oldest with remaining quantity)
    const lotAvailability = Array.from(lotMap.entries())
      .map(([lot, info]) => ({
        lot,
        remainingQty: info.transferredQty - info.processedQty,
        transferDate: info.transferDate
      }))
      .filter(l => l.remainingQty > 0)
      .sort((a, b) => a.transferDate.getTime() - b.transferDate.getTime())
   
    // Auto-fill if no lot is manually set
    if (lotAvailability.length > 0 && !actionData.lot) {
      setActionData((prev: any) => ({ ...prev, lot: lotAvailability[0].lot }))
    }
  }, [showProduceDialog, selectedOutputStageId, dialogProductionRuns.length, productionRuns.length, initialProductionRuns?.length, selectedJob?.id, selectedJob?.plannedStageIds, actionData.lot, setActionData])

  // Handle scan
  const handleScanCode = async (code: string) => {
    await handleScan({
      code,
      workspaceId,
      jobs,
      jobsLoading,
      jobsError,
      recentScans,
      lastScanTime,
      dismissedCode: dismissedCode.current,
      selectedJob,
      onJobFound: (job) => {
        setSelectedJob(job)
        setActiveAction('produce')
        setActionData({
          qtyGood: 0,
          qtyScrap: 0,
          lot: '',
          workcenterId: job.workcenterId ?? undefined
        })
        setShowProduceDialog(true)
      },
      onProductFound: (product) => {
        setSelectedProduct(product)
      },
      onPOFound: (poId: string) => {
        // Navigate to PO scanner with the PO ID
        navigate(`/scan/po?poId=${poId}`)
      },
      onNotFound: (code) => {
        addToHistory(code, 'none')
      },
      onBatchPayload: (batchPayload, rule) => {
        if (selectedJob) {
          setBatches((prev: Record<string, { qty: number; unit: string; stageId: string }>) => ({
            ...prev,
            [batchPayload.batchId]: {
              qty: batchPayload.qty,
              unit: batchPayload.unit,
              stageId: batchPayload.sourceStageId
          }}))

          if (rule && rule.minQtyToStartNextStage && !rule.allowPartial) {
            if (batchPayload.qty < rule.minQtyToStartNextStage) {
              alert(
                `This batch has ${batchPayload.qty} ${batchPayload.unit}, but at least ${rule.minQtyToStartNextStage} ${rule.unit} are required before starting the next stage.`
              )
              return
            }
          }

          const lotId = `${selectedJob.code || selectedJob.id}-${batchPayload.batchId}`
          const sourceStageName = getStageName(batchPayload.sourceStageId, workflows)
          const targetStageName = getStageName(batchPayload.targetStageId, workflows)

          setBatchTransferData({
            batchPayload,
            rule,
            lotId,
            sourceStageName,
            targetStageName
          })
          setShowBatchTransferModal(true)
        }
      },
      addToHistory,
      setLastScanTime,
      setScanAttempts,
      workflows,
    })
  }

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (manualCode.trim()) {
      handleScanCode(manualCode.trim())
      setManualCode('')
    }
  }

  // Memoized calculations
  const stageProgressesMemo = useMemo(() => {
    if (!selectedJob) return []
    const plannedStages = selectedJob.plannedStageIds || []
    return plannedStages
      .map(stageId => calculateStageProgress(selectedJob, stageId, productionRuns, workflows))
      .filter((p): p is NonNullable<typeof p> => p !== null)
  }, [selectedJob, productionRuns, workflows])

  const productionSummaryMemo = useMemo(() => {
    if (!selectedJob) return null
    return calculateProductionSummary(selectedJob, productionRuns, workflows)
  }, [selectedJob, productionRuns, workflows, selectedJob?.currentStageId, selectedJob?.bom, selectedJob?.packaging, selectedJob?.productionSpecs])

  const progress = useMemo(() => {
    if (!selectedJob) return null
    return calculateProgress(selectedJob, productionRuns, workflows)
  }, [selectedJob, productionRuns, workflows])

  // REMOVED: Auto-close inventory posting modal check
  // This was causing the modal to close immediately after opening because productionRuns state
  // might not be updated yet. The validation is now done in the Complete Job button click handler
  // using fresh data from the backend, so this useEffect is no longer needed.
  // The Complete Job button now validates with fresh data before opening the modal.

  // --- Job Action Sheet ---
  const renderJobSheet = () => {
    if (!selectedJob || !progress) return null

    const nextStage = getNextStage(selectedJob, workflows)
    const currentStageName = getStageName(selectedJob.currentStageId, workflows, selectedJob.status)
    const isBlocked = selectedJob.status === 'blocked'
    const isReleased = selectedJob.status === 'released'
    const isInProgress = selectedJob.status === 'in_progress'
    const isDone = selectedJob.status === 'done'

    return (
      <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center pointer-events-none">
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm pointer-events-auto" onClick={resetSelection} />
        <div className="bg-white w-full max-w-lg rounded-t-[2rem] sm:rounded-3xl shadow-2xl pointer-events-auto max-h-[95vh] sm:max-h-[90vh] overflow-y-auto flex flex-col relative z-10">
          {/* Handle bar for mobile */}
          <div className="w-full flex justify-center pt-3 pb-1 sm:hidden sticky top-0 bg-white z-10 rounded-t-[2rem]">
            <div className="w-14 h-1.5 bg-gray-300 rounded-full" />
          </div>

          <div className="p-4 sm:p-6 border-b border-gray-100">
            <div className="flex justify-between items-start gap-2 sm:gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-2 sm:mb-3">
                  <span className="inline-flex items-center px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg sm:rounded-xl text-xs font-bold bg-blue-100 text-blue-700">
                    JOB
                  </span>
                  <span className={`inline-flex items-center px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg sm:rounded-xl text-xs font-bold ${getStatusColor(selectedJob.status)}`}>
                    {getStatusLabel(selectedJob.status)}
                  </span>
                  {selectedJob.priority && selectedJob.priority <= 2 && (
                    <span className="inline-flex items-center px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg sm:rounded-xl text-xs font-bold bg-red-100 text-red-700">
                      🔥 Priority
                    </span>
                  )}
                </div>
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-1 break-words">{selectedJob.code}</h2>
                <p className="text-sm sm:text-base text-gray-600 line-clamp-2 break-words">{selectedJob.productName}</p>
              </div>
              <button
                onClick={resetSelection}
                className="w-10 h-10 sm:w-12 sm:h-12 bg-gray-100 rounded-xl sm:rounded-2xl flex items-center justify-center active:bg-gray-200 flex-shrink-0 touch-manipulation"
              >
                <XMarkIcon className="h-5 w-5 sm:h-6 sm:w-6 text-gray-600" />
              </button>
            </div>

            {/* Job Info Grid - Larger for Mobile */}
            <div className="grid grid-cols-2 gap-2 sm:gap-3 mt-3 sm:mt-4">
              <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-3 sm:p-4 rounded-xl sm:rounded-2xl">
                <p className="text-xs text-gray-500 mb-1 font-medium">Quantity</p>
                <p className="font-bold text-gray-900 text-lg sm:text-xl break-words">{selectedJob.quantity?.toLocaleString()}</p>
                <p className="text-xs sm:text-sm text-gray-600 break-words">{selectedJob.unit}</p>
              </div>
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-3 sm:p-4 rounded-xl sm:rounded-2xl min-w-0">
                <p className="text-xs text-blue-600 mb-1 font-medium">Current Stage</p>
                <p className="font-bold text-blue-900 text-base sm:text-lg break-words leading-tight">{currentStageName}</p>
              </div>
            </div>

            {/* Customer & Due Date */}
            <div className="grid grid-cols-2 gap-2 sm:gap-3 mt-2 sm:mt-3">
              {selectedJob.customer && (
                <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 p-3 sm:p-4 rounded-xl sm:rounded-2xl min-w-0">
                  <div className="flex items-center gap-1.5 sm:gap-2 mb-1">
                    <BuildingStorefrontIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-indigo-600 flex-shrink-0" />
                    <p className="text-xs text-indigo-600 font-medium">Customer</p>
                  </div>
                  <p className="font-bold text-sm sm:text-base text-indigo-900 break-words leading-tight">{selectedJob.customer.name}</p>
                  {selectedJob.customer.orderNo && (
                    <p className="text-xs text-indigo-600 mt-1 break-words">Order: {selectedJob.customer.orderNo}</p>
                  )}
                </div>
              )}
              {selectedJob.dueDate && (
                <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-3 sm:p-4 rounded-xl sm:rounded-2xl min-w-0">
                  <div className="flex items-center gap-1.5 sm:gap-2 mb-1">
                    <CalendarIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-orange-600 flex-shrink-0" />
                    <p className="text-xs text-orange-600 font-medium">Due Date</p>
                  </div>
                  <p className="font-bold text-sm sm:text-base text-orange-900 break-words">
                    {(() => {
                      const raw = selectedJob.dueDate as any
                      if (raw && typeof raw.seconds === 'number') {
                        return new Date(raw.seconds * 1000).toLocaleDateString()
                      }
                      return new Date(raw).toLocaleDateString()
                    })()}
                  </p>
                </div>
              )}
            </div>

            {/* Stage Progress Bars */}
            {!isDone && (() => {
              const plannedStages = selectedJob.plannedStageIds || []
              if (plannedStages.length === 0) {
                // Fallback to overall progress if no planned stages
                return (
                  <div className="mt-4">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs font-medium text-gray-600">Production Progress</span>
                      <span className="text-xs font-semibold text-gray-900">
                        {progress.produced.toLocaleString()} / {progress.planned.toLocaleString()} {progress.uom || selectedJob.unit}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                      <div
                        className="bg-blue-600 h-2.5 rounded-full transition-all"
                        style={{ width: `${progress.percentage}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{progress.percentage.toFixed(1)}% complete</p>
                  </div>
                )
              }

              const stageProgresses = stageProgressesMemo

              return (
                <div className="mt-3 sm:mt-4 space-y-2 sm:space-y-3">
                  <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Stage Progress</h4>
                  {stageProgresses.map((stageProgress) => {
                    // Find next stage
                    const plannedStages = selectedJob.plannedStageIds || []
                    const currentIndex = plannedStages.indexOf(stageProgress.stageId)
                    const nextStageId = currentIndex >= 0 && currentIndex < plannedStages.length - 1
                      ? plannedStages[currentIndex + 1]
                      : undefined
                    const nextStage = nextStageId
                      ? workflows.find(w => w.stages?.some(s => s.id === nextStageId))?.stages?.find(s => s.id === nextStageId)
                      : undefined
                   
                    // Check if this is the last stage
                    const workflow = workflows.find(w => w.id === selectedJob.workflowId)
                    const allStages = workflow?.stages || []
                    const isLastStage = plannedStages.length > 0
                      ? plannedStages[plannedStages.length - 1] === stageProgress.stageId
                      : (allStages.length > 0 && allStages[allStages.length - 1]?.id === stageProgress.stageId)
                   
                    // Get production runs for this stage
                    const stageRuns = productionRuns.filter(r => r.stageId === stageProgress.stageId)
                    // Only count actual production runs (exclude transfer runs)
                    const actualProductionRuns = stageRuns.filter((r: any) => {
                      return !(r.transferSourceRunIds && Array.isArray(r.transferSourceRunIds) && r.transferSourceRunIds.length > 0)
                    })
                    const hasOutputs = actualProductionRuns.length > 0
                   
                    // Check if "Move to" button is active for current stage
                    let canUseTapToTransfer = (hasOutputs && nextStageId) || (hasOutputs && isLastStage)
                    if (stageProgress.isCurrent && productionSummaryMemo) {
                      const currentStageSummary = productionSummaryMemo
                      const {
                        totalProducedInStage,
                        plannedQty,
                        completionThreshold
                      } = currentStageSummary
                      const isIncomplete = plannedQty > 0 && totalProducedInStage < completionThreshold
                      const requireOutput = (selectedJob as any).requireOutputToAdvance !== false
                     
                      if (!isIncomplete && requireOutput && !isLastStage) {
                        canUseTapToTransfer = false
                      }
                    }
                   
                    return (
                      <div
                        key={stageProgress.stageId}
                        className={`space-y-1 ${canUseTapToTransfer ? 'cursor-pointer hover:bg-gray-50 -mx-2 px-2 py-1 rounded-lg transition-colors' : ''}`}
                        onClick={async () => {
                          if (canUseTapToTransfer) {
                            if (isLastStage) {
                              // Check if there's anything to post before opening modal
                              // Fetch fresh data to ensure we have the latest production runs
                              try {
                                const freshRuns = await listJobProductionRuns(workspaceId, selectedJob.id)
                                const freshLastStageRuns = freshRuns.filter((r: any) => {
                                  if (r.stageId !== stageProgress.stageId) return false
                                  // Exclude transfer runs
                                  if (r.transferSourceRunIds && Array.isArray(r.transferSourceRunIds) && r.transferSourceRunIds.length > 0) {
                                    return false
                                  }
                                  return true
                                })
                                const freshTotalQty = freshLastStageRuns.reduce((sum: number, r: any) => sum + Number(r.qtyGood || 0), 0)
                                
                                if (freshTotalQty <= 0) {
                                  // Show user-friendly message instead of opening modal
                                  alert('No output processed yet.\n\nPlease record production output in this stage before posting to inventory.')
                                  return
                                }
                              } catch (error) {
                                console.error('Failed to fetch fresh production runs:', error)
                                // Fallback: check productionRuns state
                                const lastStageRuns = productionRuns.filter((r: any) => {
                                  if (r.stageId !== stageProgress.stageId) return false
                                  if (r.transferSourceRunIds && Array.isArray(r.transferSourceRunIds) && r.transferSourceRunIds.length > 0) {
                                    return false
                                  }
                                  return true
                                })
                                const totalQty = lastStageRuns.reduce((sum: number, r: any) => sum + Number(r.qtyGood || 0), 0)
                                if (totalQty <= 0) {
                                  alert('No output processed yet.\n\nPlease record production output in this stage before posting to inventory.')
                                  return
                                }
                              }
                              
                              setShowInventoryPostingModal(true)
                            } else {
                              setSelectedStageForOutput({
                                stageId: stageProgress.stageId,
                                stageName: stageProgress.stageName,
                                nextStageId,
                                nextStageName: nextStage?.name
                              })
                              setSelectedOutputIds(new Set())
                              setShowStageOutputModal(true)
                            }
                          }
                        }}
                      >
                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 sm:gap-2">
                          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1">
                            <span className={`text-xs font-medium break-words ${stageProgress.isCurrent ? 'text-blue-600' : 'text-gray-600'}`}>
                              {stageProgress.stageName}
                              {stageProgress.isCurrent && (
                                <span className="ml-1 text-blue-600 whitespace-nowrap">(Current)</span>
                              )}
                            </span>
                            {canUseTapToTransfer && (
                              <span className="text-xs text-gray-400 whitespace-nowrap flex-shrink-0">
                                • Tap to {isLastStage ? 'transfer to inventory' : 'transfer'}
                              </span>
                            )}
                          </div>
                          <span className="text-xs font-semibold text-gray-900 whitespace-nowrap flex-shrink-0">
                            {stageProgress.produced.toLocaleString()} / {stageProgress.planned.toLocaleString()} {stageProgress.uom}
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all ${
                              stageProgress.isCurrent
                                ? 'bg-blue-600'
                                : stageProgress.percentage >= 100
                                  ? 'bg-green-500'
                                  : 'bg-gray-400'
                            }`}
                            style={{ width: `${Math.min(100, stageProgress.percentage)}%` }}
                          />
                        </div>
                        <p className="text-xs text-gray-500 break-words">
                          {stageProgress.percentage.toFixed(1)}% complete
                          {stageProgress.isCurrent && stageProgress.percentage < 100 && (
                            <span className="ml-1 sm:ml-2 text-orange-600 whitespace-nowrap">• In Progress</span>
                          )}
                          {hasOutputs && (
                            <span className="ml-1 sm:ml-2 text-blue-600 whitespace-nowrap">• {stageRuns.length} output{stageRuns.length > 1 ? 's' : ''}</span>
                          )}
                        </p>
                      </div>
                    )
                  })}
                </div>
              )
            })()}

            {/* Block Reason */}
            {isBlocked && selectedJob.blockReason && (
              <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <ExclamationTriangleIcon className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-red-800 mb-1">⚠️ Job Blocked</p>
                    <p className="text-sm text-red-900 font-medium">{selectedJob.blockReason}</p>
                    <p className="text-xs text-red-700 mt-1">Production is paused. Use "Resume Job" to continue.</p>
                  </div>
                </div>
              </div>
            )}

            {/* Recent Activity Summary */}
            <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-gray-200">
              <div className="grid grid-cols-2 gap-2 sm:gap-3 text-xs">
                <div>
                  <p className="text-gray-500 mb-0.5 sm:mb-1">Production Runs</p>
                  <p className="font-semibold text-sm sm:text-base text-gray-900 break-words">{productionRuns.length}</p>
                </div>
                <div>
                  <p className="text-gray-500 mb-0.5 sm:mb-1">Consumptions</p>
                  <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                    <p className="font-semibold text-sm sm:text-base text-gray-900 break-words">{consumptions.length}</p>
                    <button
                      onClick={async () => {
                        if (!selectedJob) return
                        try {
                          await recalculateJobBomConsumption(workspaceId, selectedJob.id)
                          await queryClient.invalidateQueries({ queryKey: ['jobs', workspaceId] })
                          const updatedJobs = await queryClient.fetchQuery({
                            queryKey: ['jobs', workspaceId],
                            queryFn: () => listJobs(workspaceId)
                          })
                          const updatedJob = updatedJobs?.jobs?.find(j => j.id === selectedJob.id)
                          if (updatedJob) {
                            setSelectedJob(updatedJob)
                          }
                          alert('BOM consumed values recalculated!')
                        } catch (err: any) {
                          alert(`Failed to recalculate: ${err?.message || 'Unknown error'}`)
                        }
                      }}
                      className="text-xs text-blue-600 hover:text-blue-800 underline touch-manipulation whitespace-nowrap"
                      title="Manually recalculate BOM consumed values"
                    >
                      🔄 Recalc
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="p-4 sm:p-5 sm:p-6 space-y-3 sm:space-y-4">
            {/* Always show action buttons - dialogs are separate now */}
            <>
              {/* Primary Action - Large, Prominent Button */}
                {!isDone && (
                  <div className="space-y-2 sm:space-y-3">
                    {!isReleased && !isInProgress && (
                      <button
                        onClick={() => {
                          if (confirm('Release this job to start production?')) {
                            statusMutation.mutate({ jobId: selectedJob.id, status: 'released' })
                          }
                        }}
                        className="w-full py-4 sm:py-5 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl sm:rounded-2xl font-bold text-base sm:text-lg shadow-lg shadow-blue-500/30 active:scale-[0.98] transition-all flex items-center justify-center gap-2 sm:gap-3 touch-manipulation"
                      >
                        <PlayIcon className="h-6 w-6 sm:h-7 sm:w-7" />
                        <span>Release Job</span>
                      </button>
                    )}

                    {isReleased && !isInProgress && (
                      <button
                        onClick={() => {
                          statusMutation.mutate({ jobId: selectedJob.id, status: 'in_progress' })
                          timeLogMutation.mutate({
                            stageId: selectedJob.currentStageId,
                            resourceId: 'current-user',
                            startedAt: new Date(),
                            notes: 'Started via scanner'
                          })
                        }}
                        className="w-full py-4 sm:py-5 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl sm:rounded-2xl font-bold text-base sm:text-lg shadow-lg shadow-green-500/30 active:scale-[0.98] transition-all flex items-center justify-center gap-2 sm:gap-3 touch-manipulation"
                      >
                        <PlayIcon className="h-6 w-6 sm:h-7 sm:w-7" />
                        <span>Start Production</span>
                      </button>
                    )}

                    {isBlocked && (
                      <button
                        onClick={() => {
                          statusMutation.mutate({ jobId: selectedJob.id, status: 'in_progress' })
                        }}
                        className="w-full py-4 sm:py-5 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl sm:rounded-2xl font-bold text-base sm:text-lg shadow-lg shadow-green-500/30 active:scale-[0.98] transition-all flex items-center justify-center gap-2 sm:gap-3 touch-manipulation"
                      >
                        <PlayIcon className="h-6 w-6 sm:h-7 sm:w-7" />
                        <span>Resume Job</span>
                      </button>
                    )}
                  </div>
                )}

                {/* Next Stage Button */}
                {nextStage && (isInProgress || isReleased) && !isBlocked && productionSummaryMemo && (() => {
                  const currentStageSummary = productionSummaryMemo
                  const {
                    totalProducedInStage,
                    plannedQty,
                    completionThreshold,
                    currentStageOutputUOM
                  } = currentStageSummary
                 
                  const isIncomplete = plannedQty > 0 && totalProducedInStage < completionThreshold
                  const requireOutput = (selectedJob as any).requireOutputToAdvance !== false
                 
                  return (
                    <button
                      onClick={() => {
                        if (requireOutput && isIncomplete) {
                          const remainingNeeded = Math.max(0, completionThreshold - totalProducedInStage)
                          alert(`⚠️ Cannot proceed: Production quantity below threshold.\n\nRequired: ${completionThreshold.toLocaleString()}+ ${currentStageOutputUOM || 'units'}\nCurrent: ${totalProducedInStage.toLocaleString()} ${currentStageOutputUOM || 'units'}\nRemaining needed: ${remainingNeeded.toLocaleString()} ${currentStageOutputUOM || 'units'}\n\nPlease complete production before moving to next stage.`)
                          return
                        }
                       
                        if (confirm(`Move from ${currentStageName} to ${nextStage.name}?`)) {
                          const previousStageId = selectedJob.currentStageId
                          moveStageMutation.mutate({
                            jobId: selectedJob.id,
                            newStageId: nextStage.id,
                            previousStageId: previousStageId
                          })
                        }
                      }}
                      disabled={moveStageMutation.isPending || (requireOutput && isIncomplete)}
                      className={`w-full py-4 sm:py-5 rounded-xl sm:rounded-2xl font-bold text-base sm:text-lg shadow-lg disabled:opacity-50 disabled:shadow-none flex items-center justify-center gap-2 sm:gap-3 transition-all touch-manipulation ${
                        requireOutput && isIncomplete
                          ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                          : 'bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-purple-500/30 active:scale-[0.98]'
                      }`}
                    >
                      <ArrowRightIcon className="h-6 w-6 sm:h-7 sm:w-7" />
                      <span className="break-words">{nextStage.name}</span>
                    </button>
                  )
                })()}

                {/* Production Actions - Large Touch Targets */}
                {isInProgress && !isBlocked && (
                  <div className="grid grid-cols-2 gap-2 sm:gap-3">
                    <button
                      onClick={() => {
                        setActionData({})
                        setShowConsumeDialog(true)
                      }}
                      className="py-4 sm:py-6 bg-gradient-to-br from-orange-50 to-orange-100 border-2 border-orange-200 text-orange-700 rounded-xl sm:rounded-2xl font-bold text-xs sm:text-sm active:scale-[0.98] transition-all flex flex-col items-center justify-center gap-1.5 sm:gap-2 touch-manipulation"
                    >
                      <div className="w-12 h-12 sm:w-14 sm:h-14 bg-orange-500 rounded-xl sm:rounded-2xl flex items-center justify-center shadow-lg shadow-orange-500/30">
                        <CubeIcon className="h-6 w-6 sm:h-8 sm:w-8 text-white" />
                      </div>
                      <span className="mt-0.5 sm:mt-1 break-words text-center">Consume Material</span>
                    </button>
                    <button
                      onClick={() => {
                        setActionData({})
                        setShowProduceDialog(true)
                      }}
                      className="py-4 sm:py-6 bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-200 text-blue-700 rounded-xl sm:rounded-2xl font-bold text-xs sm:text-sm active:scale-[0.98] transition-all flex flex-col items-center justify-center gap-1.5 sm:gap-2 touch-manipulation"
                    >
                      <div className="w-12 h-12 sm:w-14 sm:h-14 bg-blue-500 rounded-xl sm:rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/30">
                        <CheckCircleIcon className="h-6 w-6 sm:h-8 sm:w-8 text-white" />
                      </div>
                      <span className="mt-0.5 sm:mt-1 break-words text-center">Record Output</span>
                    </button>
                  </div>
                )}

                {/* Block Job Button - Less Prominent */}
                {isInProgress && !isBlocked && (
                  <button
                    onClick={() => {
                      const reason = prompt('Enter block reason (e.g., "Material shortage", "Machine breakdown", "Quality issue"):')
                      if (reason && reason.trim()) {
                        statusMutation.mutate({ jobId: selectedJob.id, status: 'blocked', blockReason: reason.trim() })
                      } else if (reason !== null) {
                        alert('Please enter a block reason to continue.')
                      }
                    }}
                    className="w-full py-3 sm:py-4 bg-red-50 border-2 border-red-200 text-red-600 rounded-xl sm:rounded-2xl font-semibold text-sm sm:text-base active:bg-red-100 transition-colors flex items-center justify-center gap-2 touch-manipulation"
                  >
                    <PauseIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                    <span>Block Job</span>
                  </button>
                )}

                {/* Complete Job Button */}
                {isInProgress && !isBlocked && productionSummaryMemo && (() => {
                  const planned: string[] = (selectedJob as any).plannedStageIds || []
                  const workflow = workflows.find(w => w.id === selectedJob.workflowId)
                  const allStages = workflow?.stages || []
                  const isLastStage = planned.length > 0
                    ? planned[planned.length - 1] === selectedJob.currentStageId
                    : (allStages.length > 0 && allStages[allStages.length - 1]?.id === selectedJob.currentStageId)
                 
                  const currentStageSummary = productionSummaryMemo
                  const {
                    totalProducedInStage,
                    plannedQty,
                    completionThreshold,
                    completionThresholdUpper,
                    currentStageOutputUOM
                  } = currentStageSummary
                 
                  const isIncomplete = plannedQty > 0 && totalProducedInStage < completionThreshold
                  const isOverLimit = plannedQty > 0 && totalProducedInStage > completionThresholdUpper
                  const thresholdMet = plannedQty > 0 && totalProducedInStage >= completionThreshold && totalProducedInStage <= completionThresholdUpper
                  const requireOutput = (selectedJob as any).requireOutputToAdvance !== false
                  
                  const canComplete = isLastStage && (!requireOutput || thresholdMet)
                  
                  // Debug log for Complete Job button state
                  console.log('[Complete Job Button] State check:', {
                    isLastStage,
                    requireOutput,
                    thresholdMet,
                    canComplete,
                    isIncomplete,
                    isOverLimit,
                    totalProducedInStage,
                    plannedQty,
                    completionThreshold,
                    completionThresholdUpper
                  })
                  
                  if (!canComplete) {
                    console.log('[Complete Job Button] Not rendering - canComplete is false')
                    return null
                  }
                  
                  const isDisabled = requireOutput && (isIncomplete || isOverLimit)
                  console.log('[Complete Job Button] Rendering button, disabled:', isDisabled)
                  
                  return (
                    <button
                      onClick={async () => {
                        console.log('[Complete Job Button] Clicked!')
                        if (requireOutput) {
                          if (isIncomplete) {
                            alert(`⚠️ Cannot complete: Production quantity below required threshold.\n\nRequired: ${completionThreshold.toLocaleString()}+ ${currentStageOutputUOM || 'sheets'}\nCurrent: ${totalProducedInStage.toLocaleString()} ${currentStageOutputUOM || 'sheets'}\n\nPlease complete production before finishing the job.`)
                            return
                          }
                          if (isOverLimit) {
                            alert(`⚠️ Cannot complete: Production quantity exceeds upper limit.\n\nPlanned: ${plannedQty.toLocaleString()} ${currentStageOutputUOM || 'sheets'}\nMaximum Allowed: ${completionThresholdUpper.toLocaleString()} ${currentStageOutputUOM || 'sheets'}\nCurrent: ${totalProducedInStage.toLocaleString()} ${currentStageOutputUOM || 'sheets'}\n\nPlease adjust the quantity or consult a supervisor.`)
                            return
                          }
                        }
                       
                        // Check if there's anything to post before opening modal
                        // Fetch fresh data to ensure we have the latest production runs
                        try {
                          const freshRuns = await listJobProductionRuns(workspaceId, selectedJob.id)
                          console.log('[Complete Job] Fresh runs fetched:', freshRuns.length)
                          console.log('[Complete Job] Current stage ID:', selectedJob.currentStageId)
                          
                          const freshLastStageRuns = freshRuns.filter((r: any) => {
                            if (r.stageId !== selectedJob.currentStageId) return false
                            // Exclude transfer runs
                            if (r.transferSourceRunIds && Array.isArray(r.transferSourceRunIds) && r.transferSourceRunIds.length > 0) {
                              return false
                            }
                            return true
                          })
                          
                          console.log('[Complete Job] Last stage runs (excluding transfers):', freshLastStageRuns.length)
                          console.log('[Complete Job] Last stage runs details:', freshLastStageRuns.map((r: any) => ({
                            id: r.id,
                            stageId: r.stageId,
                            qtyGood: r.qtyGood,
                            lot: r.lot,
                            hasTransferSource: !!(r.transferSourceRunIds && Array.isArray(r.transferSourceRunIds) && r.transferSourceRunIds.length > 0)
                          })))
                          
                          const freshTotalQty = freshLastStageRuns.reduce((sum: number, r: any) => sum + Number(r.qtyGood || 0), 0)
                          console.log('[Complete Job] Fresh total quantity:', freshTotalQty)
                          console.log('[Complete Job] ProductionSummaryMemo totalProducedInStage:', totalProducedInStage)
                          
                          if (freshTotalQty <= 0) {
                            // Show user-friendly message with detailed debug info
                            const allRunsInStage = freshRuns.filter((r: any) => r.stageId === selectedJob.currentStageId)
                            const transferRunsInStage = allRunsInStage.filter((r: any) => 
                              r.transferSourceRunIds && Array.isArray(r.transferSourceRunIds) && r.transferSourceRunIds.length > 0
                            )
                            console.error('[Complete Job] No valid runs found. All runs in stage:', allRunsInStage.map((r: any) => ({
                              id: r.id,
                              stageId: r.stageId,
                              qtyGood: r.qtyGood,
                              lot: r.lot,
                              transferSourceRunIds: r.transferSourceRunIds
                            })))
                            alert(
                              `No output processed yet.\n\n` +
                              `Please record production output in this stage before posting to inventory.\n\n` +
                              `Debug Info:\n` +
                              `- Current Stage ID: ${selectedJob.currentStageId}\n` +
                              `- Total runs in stage: ${allRunsInStage.length}\n` +
                              `- Transfer runs: ${transferRunsInStage.length}\n` +
                              `- Valid production runs: ${freshLastStageRuns.length}\n` +
                              `- Total quantity: ${freshTotalQty}`
                            )
                            return
                          }
                          
                          // Update productionRuns state with fresh data to keep UI in sync
                          setProductionRuns(freshRuns)
                        } catch (error) {
                          console.error('[Complete Job] Failed to fetch fresh production runs:', error)
                          // Fallback to using productionSummaryMemo value
                          console.log('[Complete Job] Using fallback - totalProducedInStage:', totalProducedInStage)
                          if (totalProducedInStage <= 0) {
                            alert('No output processed yet.\n\nPlease record production output in this stage before posting to inventory.')
                            return
                          }
                        }
                        
                        // Always open modal if we reach here (validation passed)
                        console.log('[Complete Job] About to open inventory posting modal')
                        console.log('[Complete Job] showInventoryPostingModal state before:', showInventoryPostingModal)
                        console.log('[Complete Job] selectedJob:', selectedJob?.id)
                        console.log('[Complete Job] products available:', products?.length || 0)
                        
                        // Ensure selectedJob is still available
                        if (!selectedJob) {
                          console.error('[Complete Job] selectedJob is null, cannot open modal')
                          alert('Job information is missing. Please try again.')
                          return
                        }
                        
                        // Open modal directly
                        console.log('[Complete Job] Calling setShowInventoryPostingModal(true)')
                        setShowInventoryPostingModal(true)
                        console.log('[Complete Job] setShowInventoryPostingModal(true) called')
                      }}
                      disabled={requireOutput && (isIncomplete || isOverLimit)}
                      className={`w-full py-4 sm:py-5 rounded-xl sm:rounded-2xl font-bold text-base sm:text-lg shadow-lg disabled:opacity-50 disabled:shadow-none disabled:cursor-not-allowed flex items-center justify-center gap-2 sm:gap-3 transition-all active:scale-[0.98] touch-manipulation ${
                        requireOutput && (isIncomplete || isOverLimit)
                          ? 'bg-gray-400 text-white cursor-not-allowed'
                          : 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-emerald-500/30'
                      }`}
                      title={
                        requireOutput && isIncomplete
                          ? `Threshold not met. Need ${Math.max(0, completionThreshold - totalProducedInStage).toLocaleString()} more ${currentStageOutputUOM || 'sheets'} (minimum total: ${completionThreshold.toLocaleString()}+)`
                          : requireOutput && isOverLimit
                            ? `Over limit. Maximum: ${completionThresholdUpper.toLocaleString()} ${currentStageOutputUOM || 'sheets'}`
                            : !isLastStage
                              ? 'Job must be at the last stage to complete'
                              : undefined
                      }
                    >
                      <CheckCircleIcon className="h-6 w-6 sm:h-7 sm:w-7" />
                      <span>Complete Job</span>
                    </button>
                  )
                })()}

                {/* View Details Button */}
                <button
                  onClick={() => {
                    window.location.href = `/production?jobId=${selectedJob.id}`
                  }}
                  className="w-full py-3 sm:py-4 bg-gray-100 text-gray-700 rounded-xl sm:rounded-2xl font-semibold text-sm sm:text-base active:bg-gray-200 transition-colors flex items-center justify-center gap-2 touch-manipulation"
                >
                  <InformationCircleIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                  <span>View Full Details</span>
                </button>
              </>
          </div>
        </div>
      </div>
    )
  }

  // --- Product Action Sheet ---
  const renderProductSheet = () => {
    if (!selectedProduct) return null

    return (
      <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center pointer-events-none">
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm pointer-events-auto" onClick={resetSelection} />
        <div className="bg-white w-full max-w-lg rounded-t-[2rem] sm:rounded-3xl shadow-2xl pointer-events-auto max-h-[95vh] sm:max-h-[90vh] overflow-y-auto flex flex-col relative z-10">
          <div className="w-full flex justify-center pt-3 pb-1 sm:hidden sticky top-0 bg-white z-10 rounded-t-[2rem]">
            <div className="w-14 h-1.5 bg-gray-300 rounded-full" />
          </div>

          <div className="p-5 sm:p-6 border-b border-gray-100">
            <div className="flex gap-4">
              {/* Product Image */}
              <div className="flex-shrink-0">
                <div className="w-24 h-24 bg-gradient-to-br from-gray-100 to-gray-200 rounded-2xl overflow-hidden border border-gray-200 shadow-sm">
                  {(selectedProduct as any).imageUrl ? (
                    <img
                      src={(selectedProduct as any).imageUrl}
                      alt={selectedProduct.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <CubeIcon className="w-12 h-12 text-gray-400" />
                    </div>
                  )}
                </div>
              </div>

              {/* Product Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between mb-2">
                  <span className="inline-flex items-center px-3 py-1.5 rounded-xl text-xs font-bold bg-green-100 text-green-700">
                    PRODUCT
                  </span>
                  <button
                    onClick={resetSelection}
                    className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center active:bg-gray-200"
                  >
                    <XMarkIcon className="h-5 w-5 text-gray-600" />
                  </button>
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-1 line-clamp-2">{selectedProduct.name}</h2>
                <p className="text-sm text-gray-500 font-medium">SKU: {selectedProduct.sku}</p>

                {(selectedProduct as any).category && (
                  <p className="text-xs text-gray-400 mt-1">
                    {(selectedProduct as any).category}
                    {(selectedProduct as any).subcategory && ` • ${(selectedProduct as any).subcategory}`}
                  </p>
                )}
              </div>
            </div>

            {/* Stock & Price Info */}
            <div className="grid grid-cols-2 gap-3 mt-4">
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-2xl">
                <p className="text-xs text-blue-600 uppercase tracking-wide font-bold mb-1">On Hand</p>
                <p className="text-3xl font-bold text-blue-900">{(selectedProduct.qtyOnHand || 0).toLocaleString()}</p>
                <p className="text-sm text-blue-600 font-medium">{selectedProduct.uom || 'Units'}</p>
              </div>
              <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-4 rounded-2xl">
                <p className="text-xs text-gray-500 uppercase tracking-wide font-bold mb-1">Unit Price</p>
                <p className="text-3xl font-bold text-gray-900">
                  £{((selectedProduct as any).pricePerBox || 0).toFixed(2)}
                </p>
                <p className="text-sm text-gray-500 font-medium">
                  Total: £{((selectedProduct.qtyOnHand || 0) * ((selectedProduct as any).pricePerBox || 0)).toFixed(2)}
                </p>
              </div>
            </div>

            {/* View Details Button */}
            <button
              onClick={() => {
                window.location.href = `/inventory?productId=${selectedProduct.id}`
              }}
              className="w-full mt-4 py-4 bg-gray-100 text-gray-700 rounded-2xl font-semibold active:bg-gray-200 transition-colors flex items-center justify-center gap-2"
            >
              <MagnifyingGlassIcon className="w-5 h-5" />
              View Full Details
            </button>
          </div>

          <div className="p-5 sm:p-6 space-y-4">
            {!activeAction ? (
              <div className="grid grid-cols-3 gap-3">
                <button
                  onClick={() => setActiveAction('in')}
                  className="py-6 bg-gradient-to-br from-green-50 to-green-100 border-2 border-green-200 text-green-700 rounded-2xl font-bold active:scale-[0.98] transition-all flex flex-col items-center justify-center gap-2"
                >
                  <div className="w-12 h-12 bg-green-500 rounded-xl flex items-center justify-center shadow-lg shadow-green-500/30">
                    <ArrowDownTrayIcon className="h-6 w-6 text-white" />
                  </div>
                  <span className="text-xs">Receive</span>
                </button>
                <button
                  onClick={() => setActiveAction('out')}
                  className="py-6 bg-gradient-to-br from-red-50 to-red-100 border-2 border-red-200 text-red-700 rounded-2xl font-bold active:scale-[0.98] transition-all flex flex-col items-center justify-center gap-2"
                >
                  <div className="w-12 h-12 bg-red-500 rounded-xl flex items-center justify-center shadow-lg shadow-red-500/30">
                    <ArrowUpTrayIcon className="h-6 w-6 text-white" />
                  </div>
                  <span className="text-xs">Ship/Use</span>
                </button>
                <button
                  onClick={() => setActiveAction('adjust')}
                  className="py-6 bg-gradient-to-br from-gray-50 to-gray-100 border-2 border-gray-200 text-gray-700 rounded-2xl font-bold active:scale-[0.98] transition-all flex flex-col items-center justify-center gap-2"
                >
                  <div className="w-12 h-12 bg-gray-500 rounded-xl flex items-center justify-center shadow-lg shadow-gray-500/30">
                    <AdjustmentsHorizontalIcon className="h-6 w-6 text-white" />
                  </div>
                  <span className="text-xs">Adjust</span>
                </button>
              </div>
            ) : (
              renderProductActionForm()
            )}
          </div>
        </div>
      </div>
    )
  }

  const renderProductActionForm = () => {
    const isReceive = activeAction === 'in'
    const isShip = activeAction === 'out'
    const title = isReceive ? 'Receive Stock' : isShip ? 'Ship / Use Stock' : 'Adjust Stock'
    const btnGradient = isReceive
      ? 'bg-gradient-to-r from-green-500 to-green-600 shadow-green-500/30'
      : isShip
      ? 'bg-gradient-to-r from-red-500 to-red-600 shadow-red-500/30'
      : 'bg-gradient-to-r from-gray-600 to-gray-700 shadow-gray-600/30'

    // Filter reasons based on operation type
    const filteredReasons = stockReasons.filter(r => {
      if (isReceive) return r.operationType === 'stock_in'
      if (isShip) return r.operationType === 'stock_out'
      return r.operationType === 'adjustment'
    })

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-gray-900 text-lg">{title}</h3>
          <button
            onClick={() => { setActiveAction(null); setActionData({}) }}
            className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center active:bg-gray-200"
          >
            <XMarkIcon className="h-5 w-5 text-gray-600" />
          </button>
        </div>

        {/* Quantity Input - Large */}
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">Quantity</label>
          <input
            type="number"
            placeholder="0"
            autoFocus
            className="w-full p-5 border-2 border-gray-200 rounded-2xl text-2xl font-bold text-center focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500"
            onChange={e => setActionData({ ...actionData, qty: Number(e.target.value) })}
          />
        </div>

        {/* Reason Dropdown */}
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">Reason *</label>
          <select
            className="w-full p-4 border-2 border-gray-200 rounded-2xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 text-base bg-white font-medium"
            onChange={e => setActionData({ ...actionData, reason: e.target.value })}
            value={actionData.reason || ''}
          >
            <option value="">Select a reason...</option>
            {filteredReasons.map(r => (
              <option key={r.id} value={r.name}>{r.name}</option>
            ))}
          </select>
        </div>

        {/* Notes / Reference */}
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">Notes / Reference</label>
          <input
            type="text"
            placeholder="Optional notes or reference"
            className="w-full p-4 border-2 border-gray-200 rounded-2xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 text-base"
            onChange={e => setActionData({ ...actionData, reference: e.target.value })}
          />
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-2">
          <button
            onClick={() => {
              setActiveAction(null)
              setActionData({})
            }}
            className="flex-1 py-4 bg-gray-100 rounded-2xl font-bold text-gray-700 active:bg-gray-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              if (!actionData.qty || !actionData.reason) {
                alert('Please enter quantity and select a reason')
                return
              }
              stockTxnMutation.mutate({
                productId: selectedProduct?.id,
                type: activeAction === 'in' ? 'in' : activeAction === 'out' ? 'out' : 'adjustment',
                qty: actionData.qty,
                reason: actionData.reason,
                reference: actionData.reference
              })
            }}
            disabled={!actionData.qty || !actionData.reason}
            className={`flex-1 py-4 text-white rounded-2xl font-bold shadow-lg transition-all disabled:opacity-50 disabled:shadow-none active:scale-[0.98] ${btnGradient}`}
          >
            Confirm
          </button>
        </div>
      </div>
    )
  }

  // --- Consume Material Full-Screen Dialog ---
  const renderConsumeMaterialDialog = () => {
    if (!selectedJob) return null

    const bomItems = selectedJob.bom || []
    const selectedBomItem = bomItems.find(item => item.sku === actionData.sku)
    const remainingRequired = selectedBomItem
      ? Math.max(0, selectedBomItem.qtyRequired - (selectedBomItem.consumed || 0))
      : null

    // Find product for stock check
    const selectedProductForStock = actionData.itemId
      ? products.find(p => p.id === actionData.itemId)
      : actionData.sku
        ? products.find(p => p.sku === actionData.sku)
        : null
   
    const availableStock = selectedProductForStock ? (selectedProductForStock.qtyOnHand || 0) : null
    const requestedQty = Number(actionData.qtyUsed) || 0
    const isInsufficientStock = availableStock !== null && requestedQty > availableStock

    const handleClose = () => {
      setShowConsumeDialog(false)
      setActionData({})
    }

    return (
      <div className="fixed inset-0 z-[60] flex flex-col bg-white">
        {/* Header */}
        <div className="flex-shrink-0 bg-gradient-to-r from-orange-500 to-orange-600 text-white px-4 py-4 safe-area-inset-top">
          <div className="flex items-center justify-between">
            <button
              onClick={handleClose}
              className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center active:bg-white/30"
            >
              <XMarkIcon className="h-6 w-6 text-white" />
            </button>
            <div className="text-center flex-1">
              <h2 className="text-lg font-bold">Consume Material</h2>
              <p className="text-sm text-orange-100">{selectedJob.code}</p>
            </div>
            <div className="w-10" /> {/* Spacer for centering */}
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Job Info Card */}
          <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-2xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-orange-500 rounded-xl flex items-center justify-center">
                <CubeIcon className="h-6 w-6 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-gray-900 truncate">{selectedJob.productName}</p>
                <p className="text-sm text-orange-600">Stage: {getStageName(selectedJob.currentStageId, workflows, selectedJob.status)}</p>
              </div>
            </div>
          </div>

          {/* BOM Material Selector */}
          {bomItems.length > 0 && (
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                Select Material from BOM
              </label>
              <select
                className="w-full p-4 border-2 border-gray-200 rounded-2xl focus:ring-4 focus:ring-orange-500/20 focus:border-orange-500 bg-white text-base"
                value={actionData.bomItemIndex !== undefined ? String(actionData.bomItemIndex) : ''}
                onChange={async (e) => {
                  const index = e.target.value === '' ? undefined : Number(e.target.value)
                  if (index !== undefined && bomItems[index]) {
                    const item = bomItems[index]
                    let itemId = item.itemId
                    let product: ListedProduct | null = null
                    if (!itemId && item.sku) {
                      try {
                        product = await getProductByCode(workspaceId, item.sku)
                        if (product) {
                          itemId = product.id
                        }
                      } catch (err) {
                        console.warn('Could not find product for SKU:', item.sku)
                      }
                    } else if (itemId) {
                      const prod = products.find(p => p.id === itemId)
                      if (prod) product = prod
                    }
                   
                    const remainingQty = Math.max(0, item.qtyRequired - (item.consumed || 0))
                    const availableQty = product ? (product.qtyOnHand || 0) : null
                    const defaultQty = availableQty !== null
                      ? Math.min(remainingQty, availableQty)
                      : remainingQty
                   
                    setActionData({
                      ...actionData,
                      bomItemIndex: index,
                      sku: item.sku,
                      name: item.name,
                      qtyUsed: defaultQty,
                      uom: item.uom,
                      itemId: itemId
                    })
                  } else {
                    setActionData({
                      ...actionData,
                      bomItemIndex: undefined,
                      sku: '',
                      name: '',
                      qtyUsed: '',
                      uom: '',
                      itemId: ''
                    })
                  }
                }}
              >
                <option value="">-- Select from BOM or enter manually --</option>
                {bomItems.map((item, index) => {
                  const consumed = item.consumed || 0
                  const remaining = Math.max(0, item.qtyRequired - consumed)
                  const status = remaining === 0 ? '✓' : remaining < item.qtyRequired ? '⚠' : ''
                  return (
                    <option key={index} value={String(index)}>
                      {status} {item.name || item.sku} - Remaining: {remaining} {item.uom}
                    </option>
                  )
                })}
              </select>
            </div>
          )}

          {/* Selected Material Info */}
          {selectedBomItem && remainingRequired !== null && (
            <div className="bg-white border-2 border-orange-200 rounded-2xl p-4">
              <h4 className="font-bold text-gray-900 mb-3">{selectedBomItem.name || selectedBomItem.sku}</h4>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-gray-50 rounded-xl p-3">
                  <span className="text-xs text-gray-500 block">Required</span>
                  <div className="font-bold text-gray-900">
                    {Number(selectedBomItem.qtyRequired || 0).toLocaleString()}
                  </div>
                  <span className="text-xs text-gray-500">{selectedBomItem.uom}</span>
                </div>
                <div className="bg-blue-50 rounded-xl p-3">
                  <span className="text-xs text-blue-600 block">Consumed</span>
                  <div className="font-bold text-blue-600">{(selectedBomItem.consumed || 0).toLocaleString()}</div>
                  <span className="text-xs text-blue-600">{selectedBomItem.uom}</span>
                </div>
                <div className="bg-orange-50 rounded-xl p-3">
                  <span className="text-xs text-orange-600 block">Remaining</span>
                  <div className="font-bold text-orange-600">{remainingRequired.toLocaleString()}</div>
                  <span className="text-xs text-orange-600">{selectedBomItem.uom}</span>
                </div>
              </div>
              {availableStock !== null && (
                <div className={`mt-3 p-3 rounded-xl ${availableStock < remainingRequired ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'}`}>
                  <div className="flex justify-between items-center">
                    <span className={`text-sm font-medium ${availableStock < remainingRequired ? 'text-red-700' : 'text-green-700'}`}>
                      Available Stock
                    </span>
                    <span className={`font-bold ${availableStock < remainingRequired ? 'text-red-700' : 'text-green-700'}`}>
                      {availableStock.toLocaleString()} {selectedBomItem.uom}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Manual SKU Entry */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              SKU / Material Code {actionData.bomItemIndex === undefined ? '*' : ''}
            </label>
            <input
              placeholder="Enter SKU or scan material"
              className="w-full p-4 border-2 border-gray-200 rounded-2xl focus:ring-4 focus:ring-orange-500/20 focus:border-orange-500 text-base"
              value={actionData.sku || ''}
              onChange={e => {
                setActionData({
                  ...actionData,
                  sku: e.target.value,
                  bomItemIndex: undefined
                })
              }}
              autoFocus={bomItems.length === 0}
            />
          </div>

          {/* Quantity & UOM */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-sm font-bold text-gray-700 mb-2">Quantity *</label>
              <input
                type="number"
                step="0.01"
                placeholder={selectedBomItem ? `${remainingRequired?.toLocaleString() || 0}` : "0"}
                className="w-full p-4 border-2 border-gray-200 rounded-2xl focus:ring-4 focus:ring-orange-500/20 focus:border-orange-500 text-2xl font-bold text-center"
                value={actionData.qtyUsed || ''}
                onChange={e => setActionData({ ...actionData, qtyUsed: Number(e.target.value) })}
              />
              {availableStock !== null && (
                <p className={`mt-2 text-sm font-medium ${isInsufficientStock ? 'text-red-600' : 'text-gray-600'}`}>
                  {isInsufficientStock && '⚠️ '} Stock: {availableStock.toLocaleString()} {actionData.uom || 'units'}
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">UOM</label>
              <input
                placeholder="UOM"
                className="w-full p-4 border-2 border-gray-200 rounded-2xl focus:ring-4 focus:ring-orange-500/20 focus:border-orange-500 text-base text-center"
                value={actionData.uom || ''}
                onChange={e => setActionData({ ...actionData, uom: e.target.value })}
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Notes (Optional)</label>
            <input
              placeholder="Additional notes"
              className="w-full p-4 border-2 border-gray-200 rounded-2xl focus:ring-4 focus:ring-orange-500/20 focus:border-orange-500 text-base"
              value={actionData.notes || ''}
              onChange={e => setActionData({ ...actionData, notes: e.target.value })}
            />
          </div>
        </div>

        {/* Fixed Bottom Action Buttons */}
        <div className="flex-shrink-0 p-4 bg-white border-t border-gray-200 safe-area-inset-bottom">
          <div className="flex gap-3">
            <button
              onClick={handleClose}
              className="flex-1 py-4 bg-gray-100 rounded-2xl font-bold text-gray-700 active:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={async () => {
                if (!actionData.sku || !actionData.qtyUsed) {
                  alert('Please enter SKU and quantity')
                  return
                }

                // Final stock check before submission
                if (actionData.itemId) {
                  try {
                    const currentStock = await getProductOnHand(workspaceId, actionData.itemId)
                    if (requestedQty > currentStock) {
                      const confirmAction = window.confirm(
                        `⚠️ Insufficient Stock!\n\n` +
                        `Requested: ${requestedQty.toLocaleString()} ${actionData.uom || 'units'}\n` +
                        `Available: ${currentStock.toLocaleString()} ${actionData.uom || 'units'}\n` +
                        `Shortage: ${(requestedQty - currentStock).toLocaleString()} ${actionData.uom || 'units'}\n\n` +
                        `Do you want to proceed anyway?`
                      )
                      if (!confirmAction) return
                    }
                  } catch (err) {
                    console.warn('Stock check failed:', err)
                  }
                }

                const consumptionData = {
                  ...actionData,
                  name: actionData.name || actionData.sku || '',
                  stageId: selectedJob?.currentStageId,
                  userId: 'current-user',
                  approved: true
                }
                consumptionMutation.mutate(consumptionData, {
                  onSuccess: () => {
                    handleClose()
                  }
                })
              }}
              disabled={consumptionMutation.isPending || !actionData.sku || !actionData.qtyUsed}
              className={`flex-1 py-4 rounded-2xl font-bold shadow-lg transition-all disabled:opacity-50 disabled:shadow-none active:scale-[0.98] ${
                isInsufficientStock
                  ? 'bg-gradient-to-r from-red-500 to-red-600 text-white shadow-red-500/30'
                  : 'bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-orange-500/30'
              }`}
            >
              {consumptionMutation.isPending ? 'Recording...' : isInsufficientStock ? '⚠️ Confirm' : 'Confirm'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // --- Record Output Full-Screen Dialog ---
  const renderRecordOutputDialog = () => {
    if (!selectedJob) return null

    // Priority order: dialogProductionRuns (freshly fetched) > productionRuns (state) > initialProductionRuns (query cache)
    const effectiveProductionRuns = dialogProductionRuns.length > 0
      ? dialogProductionRuns
      : (productionRuns.length > 0
        ? productionRuns
        : (initialProductionRuns || []))

    // Show loading state if data is being fetched
    if (isLoadingDialogRuns && effectiveProductionRuns.length === 0) {
      return (
        <div className="fixed inset-0 z-[60] flex flex-col bg-white">
          <div className="flex-shrink-0 bg-gradient-to-r from-blue-500 to-blue-600 text-white px-4 py-4 safe-area-inset-top">
            <div className="flex items-center justify-between">
              <button
                onClick={() => setShowProduceDialog(false)}
                className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center active:bg-white/30"
              >
                <XMarkIcon className="h-6 w-6 text-white" />
              </button>
              <div className="text-center flex-1">
                <h2 className="text-lg font-bold">Record Output</h2>
                <p className="text-sm text-blue-100">{selectedJob.code}</p>
              </div>
              <div className="w-10" />
            </div>
          </div>
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-600 font-medium">Loading production data...</p>
            </div>
          </div>
        </div>
      )
    }

    // Determine which stage to show output for
    const outputStageId = selectedOutputStageId || selectedJob.currentStageId || ''
   
    // Get stage info for selected stage
    const outputStageInfo = getStageInfo(outputStageId, workflows) as any
   
    // Get production runs for the selected stage (not current stage)
    // IMPORTANT: Exclude transfer runs (those with transferSourceRunIds) to avoid double-counting
    const outputStageRuns = effectiveProductionRuns.filter((r: any) => {
      if (r.stageId !== outputStageId) return false
      if (r.transferSourceRunIds && Array.isArray(r.transferSourceRunIds) && r.transferSourceRunIds.length > 0) {
        return false
      }
      return true
    })
    
    // Debug: Log all output stage runs to verify filtering
    console.log(`[Record Output Dialog] Stage ${outputStageId} - Total outputStageRuns (excluding transfers):`, outputStageRuns.length)
    console.log(`[Record Output Dialog] Output stage runs:`, outputStageRuns.map((r: any) => ({
      id: r.id,
      stageId: r.stageId,
      qtyGood: r.qtyGood,
      lot: r.lot,
      hasTransferSource: !!(r.transferSourceRunIds && Array.isArray(r.transferSourceRunIds) && r.transferSourceRunIds.length > 0)
    })))
   
    // Calculate summary for the selected stage
    const stageInputUOM = outputStageInfo?.inputUOM || ''
    const stageOutputUOM = outputStageInfo?.outputUOM || ''
    const numberUp = selectedJob.productionSpecs?.numberUp || 1
   
    // Calculate total produced in selected stage
    const totalProducedInStage = outputStageRuns.reduce((sum: number, r: any) => {
      return sum + Number(r.qtyGood || 0)
    }, 0)
   
    // Calculate planned quantity for selected stage
    let plannedQty: number
    let plannedUOM: string = stageOutputUOM || stageInputUOM || 'sheets'
   
    if (stageOutputUOM === 'cartoon') {
      const boxQty = selectedJob.packaging?.plannedBoxes || 0
      const pcsPerBox = selectedJob.packaging?.pcsPerBox || 1
      if (boxQty > 0 && pcsPerBox > 0) {
        plannedQty = boxQty * pcsPerBox
        plannedUOM = 'cartoon'
      } else {
        const plannedSheets = (selectedJob.output?.[0]?.qtyPlanned as number) || Number(selectedJob.quantity || 0)
        if (numberUp > 0) {
          plannedQty = plannedSheets * numberUp
          plannedUOM = 'cartoon'
        } else {
          plannedQty = plannedSheets
          plannedUOM = 'cartoon'
        }
      }
    } else {
      const bom = Array.isArray(selectedJob.bom) ? selectedJob.bom : []
      const sheetItem = bom.find((item: any) => {
        const uom = String(item.uom || '').toLowerCase()
        return ['sht', 'sheet', 'sheets'].includes(uom)
      })
      const plannedSheets = sheetItem
        ? Number(sheetItem.qtyRequired || 0)
        : ((selectedJob.output?.[0]?.qtyPlanned as number) || Number(selectedJob.quantity || 0))
      plannedQty = plannedSheets
      plannedUOM = 'sheets'
    }
   
    // Calculate threshold based on order quantity
    const tolerance = calculateToleranceThresholds(plannedQty)
    const completionThreshold = Math.max(0, plannedQty - tolerance.lower)
    const completionThresholdUpper = plannedQty + tolerance.upper
   
    const convertToOutputUOM = (qtyInInputUOM: number): number => {
      if (stageInputUOM === 'sheets' && stageOutputUOM === 'cartoon' && numberUp > 0) {
        return qtyInInputUOM * numberUp
      }
      return qtyInInputUOM
    }
   
    const currentStageInputUOM = stageInputUOM
    const currentStageOutputUOM = stageOutputUOM

    // Calculate transferred quantity (WIP from previous stages)
    // IMPORTANT: Calculate based on source runs from previous stages, not transfer run quantities
    // This prevents double-counting and shows the actual quantity transferred
    const transferredRuns = effectiveProductionRuns.filter((r: any) => {
      if (r.stageId !== outputStageId) return false
      if (r.transferSourceRunIds && Array.isArray(r.transferSourceRunIds) && r.transferSourceRunIds.length > 0) {
        return true
      }
      return false
    })
    
    // Find the previous stage ID
    const plannedStages = selectedJob.plannedStageIds || []
    const currentStageIndex = plannedStages.indexOf(outputStageId)
    const previousStageId = currentStageIndex > 0 ? plannedStages[currentStageIndex - 1] : null
    
    // Calculate total transferred by summing source run quantities from previous stage
    // This prevents double-counting if the same output is transferred multiple times
    const sourceRunIds = new Set<string>()
    transferredRuns.forEach((transferRun: any) => {
      if (Array.isArray(transferRun.transferSourceRunIds)) {
        transferRun.transferSourceRunIds.forEach((id: string) => sourceRunIds.add(String(id)))
      }
    })
    
    // Find all source runs from the previous stage only
    const previousStageSourceRuns = effectiveProductionRuns.filter((r: any) => {
      // Only count runs from the previous stage
      if (previousStageId && r.stageId !== previousStageId) return false
      // Must be a source run (referenced by transferSourceRunIds)
      return sourceRunIds.has(String(r.id))
    })
    
    // Debug: Log previous stage source runs
    console.log(`[Record Output Dialog] Previous stage (${previousStageId}) source runs:`, previousStageSourceRuns.map((r: any) => ({
      id: r.id,
      stageId: r.stageId,
      qtyGood: r.qtyGood,
      lot: r.lot
    })))
    
    // Calculate total transferred based on source runs from previous stage
    // This gives us the actual quantity that was transferred from previous stage
    // IMPORTANT: This is in the previous stage's output unit (which is current stage's input unit)
    const totalTransferred = previousStageSourceRuns.reduce((sum: number, r: any) => {
      return sum + Number(r.qtyGood || 0)
    }, 0)
    
    // Calculate transferred in output unit if different from input unit
    const totalTransferredInOutputUOM = convertToOutputUOM(totalTransferred)
    const showTransferredConversion = currentStageInputUOM !== currentStageOutputUOM && numberUp > 1

    // Group transferred runs by lot number and calculate FIFO availability
    // IMPORTANT: Use source runs from previous stage, not transfer run quantities
    // This ensures accurate lot availability based on actual transferred quantities
    const lotAvailability: Array<{
      lot: string
      transferredQty: number
      processedQty: number
      remainingQty: number
      transferDate: Date
    }> = []
   
    // Group source runs by lot to calculate transferred quantities per lot
    const lotTransferredMap = new Map<string, { qty: number; date: Date }>()
    
    previousStageSourceRuns.forEach((sourceRun: any) => {
      const lot = sourceRun.lot || ''
      if (!lot) return
      
      const qty = Number(sourceRun.qtyGood || 0)
      const runDate = sourceRun.at
        ? (typeof sourceRun.at === 'string' ? new Date(sourceRun.at) : new Date((sourceRun.at as any).seconds * 1000))
        : new Date()
      
      const existing = lotTransferredMap.get(lot)
      if (existing) {
        existing.qty += qty
        // Use earliest date for FIFO
        if (runDate < existing.date) {
          existing.date = runDate
        }
      } else {
        lotTransferredMap.set(lot, { qty, date: runDate })
      }
    })
    
    // Calculate total processed in this stage (all lots combined)
    // This is needed when only one lot is transferred but user records output with different lot numbers
    const totalProcessedInStage = outputStageRuns.reduce((sum: number, r: any) => {
      return sum + Number(r.qtyGood || 0)
    }, 0)
    
    // Now calculate availability for each lot
    // IMPORTANT: If only one lot is transferred, use total processed in stage (not lot-specific)
    // This handles cases where user records output with a different lot number
    // If multiple lots are transferred, use lot-specific processed quantity
    lotTransferredMap.forEach((transferredInfo, lot) => {
      const transferredQty = transferredInfo.qty
      const transferDate = transferredInfo.date
     
      // Find processed quantity for this lot in current stage
      // Normalize lot numbers for comparison (trim and case-insensitive)
      const normalizedLot = String(lot || '').trim()
      const processedRuns = outputStageRuns.filter((r: any) => {
        const runLot = String(r.lot || '').trim()
        const matches = runLot === normalizedLot && runLot !== ''
        if (matches) {
          console.log(`[Lot Availability] Found matching processed run for lot ${lot}:`, {
            runId: r.id,
            runLot: r.lot,
            qtyGood: r.qtyGood,
            stageId: r.stageId
          })
        }
        return matches
      })
      const processedQtyForThisLot = processedRuns.reduce((sum: number, r: any) => {
        return sum + Number(r.qtyGood || 0)
      }, 0)
     
      // If only one lot is transferred, use total processed in stage (all lots)
      // Otherwise, use lot-specific processed quantity
      let processedQty = processedQtyForThisLot
      if (lotTransferredMap.size === 1 && totalProcessedInStage > 0) {
        // Only one lot transferred, so all processed output (regardless of lot number) 
        // should be deducted from this transferred lot
        processedQty = totalProcessedInStage
        console.log(`[Lot Availability] Single lot transferred (${lot}), using total processed in stage (${totalProcessedInStage}) instead of lot-specific (${processedQtyForThisLot})`)
      }
     
      const remainingQty = Math.max(0, transferredQty - processedQty)
     
      // Debug log for lot availability calculation
      console.log(`[Lot Availability] Lot ${lot}: transferred=${transferredQty}, processed=${processedQty} (lot-specific: ${processedQtyForThisLot}, total in stage: ${totalProcessedInStage}), remaining=${remainingQty}`)
      if (processedRuns.length === 0 && outputStageRuns.length > 0 && lotTransferredMap.size > 1) {
        console.log(`[Lot Availability] WARNING: No processed runs found for lot ${lot}, but there are ${outputStageRuns.length} runs in this stage. Available lots in stage:`, 
          [...new Set(outputStageRuns.map((r: any) => r.lot).filter(Boolean))])
      }
      if (processedRuns.length > 0) {
        console.log(`[Lot Availability] Processed runs for lot ${lot}:`, processedRuns.map((r: any) => ({
          id: r.id,
          qtyGood: r.qtyGood,
          lot: r.lot,
          stageId: r.stageId
        })))
      }
     
      lotAvailability.push({
        lot,
        transferredQty,
        processedQty,
        remainingQty,
        transferDate
      })
    })
   
    // Sort by transfer date (FIFO - oldest first)
    lotAvailability.sort((a, b) => a.transferDate.getTime() - b.transferDate.getTime())
   
    // Find the first lot with remaining quantity (FIFO)
    const nextAvailableLot = lotAvailability.find(l => l.remainingQty > 0)
   
    // Check if we're on the last stage and find completed lots
    const planned: string[] = (selectedJob as any).plannedStageIds || []
    const workflow = workflows.find(w => w.id === selectedJob.workflowId)
    const allStages = workflow?.stages || []
    const isLastStage = planned.length > 0
      ? planned[planned.length - 1] === outputStageId
      : (allStages.length > 0 && allStages[allStages.length - 1]?.id === outputStageId)
   
    const completedLots = lotAvailability.filter(l => l.remainingQty <= 0 && l.processedQty > 0)

    const qtyGood = actionData.qtyGood || 0
    const qtyScrap = actionData.qtyScrap || 0
    const thisEntryInOutputUOM = convertToOutputUOM(qtyGood)
    const totalAfterThisEntry = totalProducedInStage + thisEntryInOutputUOM
    
    // Convert produced quantity from output unit to input unit for remaining calculation
    // when we have transferred material (which is in input unit)
    const convertFromOutputUOM = (qtyInOutputUOM: number): number => {
      if (currentStageInputUOM === 'sheets' && currentStageOutputUOM === 'cartoon' && numberUp > 0) {
        return qtyInOutputUOM / numberUp
      }
      return qtyInOutputUOM
    }
    
    // Remaining should be based on transferred quantity (if available) or planned quantity
    // If there's transferred material, remaining = transferred (input) - produced (input'e çevrilmiş)
    // If no transferred material, remaining = planned (output) - produced (output)
    const remaining = totalTransferred > 0 
      ? Math.max(0, totalTransferred - convertFromOutputUOM(totalAfterThisEntry))
      : Math.max(0, plannedQty - totalAfterThisEntry)
    
    // Calculate remaining in output unit if different from input unit (for transferred case)
    const remainingInOutputUOM = totalTransferred > 0 ? convertToOutputUOM(remaining) : remaining
    const showRemainingConversion = totalTransferred > 0 && currentStageInputUOM !== currentStageOutputUOM && numberUp > 1
    const isIncomplete = plannedQty > 0 && totalAfterThisEntry < completionThreshold
    const isOverLimit = plannedQty > 0 && totalAfterThisEntry > completionThresholdUpper

    // Initialize runDateTime if not set
    if (!actionData.runDateTime) {
      const now = new Date()
      const off = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
      setActionData({ ...actionData, runDateTime: off.toISOString().slice(0, 16) })
    }

    const handleClose = () => {
      setShowProduceDialog(false)
      setActionData({})
      setSelectedOutputStageId(null)
    }

    return (
      <div className="fixed inset-0 z-[60] flex flex-col bg-white">
        {/* Header */}
        <div className="flex-shrink-0 bg-gradient-to-r from-blue-500 to-blue-600 text-white px-3 sm:px-4 py-3 sm:py-4 safe-area-inset-top">
          <div className="flex items-center justify-between">
            <button
              onClick={handleClose}
              className="w-9 h-9 sm:w-10 sm:h-10 bg-white/20 rounded-lg sm:rounded-xl flex items-center justify-center active:bg-white/30 touch-manipulation"
            >
              <XMarkIcon className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
            </button>
            <div className="text-center flex-1 min-w-0 px-2">
              <h2 className="text-base sm:text-lg font-bold truncate">Record Output</h2>
              <p className="text-xs sm:text-sm text-blue-100 truncate">{selectedJob.code}</p>
            </div>
            <div className="w-9 sm:w-10" />
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Job Info Card */}
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl sm:rounded-2xl p-3 sm:p-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-500 rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0">
                <CheckCircleIcon className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm sm:text-base text-gray-900 truncate">{selectedJob.productName}</p>
                <p className="text-xs sm:text-sm text-blue-600 truncate">Job Stage: {getStageName(selectedJob.currentStageId, workflows, selectedJob.status)}</p>
              </div>
            </div>
          </div>

          {/* Stage Selector */}
          <div>
            <label className="block text-xs sm:text-sm font-bold text-gray-700 mb-1 sm:mb-2">
              Record Output For Stage
            </label>
            <select
              value={outputStageId}
              onChange={e => setSelectedOutputStageId(e.target.value || null)}
              className="w-full p-3 sm:p-4 border-2 border-blue-200 rounded-xl sm:rounded-2xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 text-sm sm:text-base bg-white font-semibold"
            >
              {selectedJob.plannedStageIds?.map((stageId: string) => {
                const stage = workflows.find(w => w.stages?.some(s => s.id === stageId))?.stages?.find(s => s.id === stageId)
                const stageName = stage?.name || stageId
                const isCurrent = stageId === selectedJob.currentStageId
                const stageRuns = effectiveProductionRuns.filter((r: any) => r.stageId === stageId)
                const hasTransferredLots = stageRuns.some((r: any) => r.transferSourceRunIds && Array.isArray(r.transferSourceRunIds) && r.transferSourceRunIds.length > 0)
               
                return (
                  <option key={stageId} value={stageId}>
                    {stageName} {isCurrent ? '(Current)' : ''} {hasTransferredLots ? '• Has transferred lots' : ''}
                  </option>
                )
              }) || (
                <option value={selectedJob.currentStageId || ''}>
                  {getStageName(selectedJob.currentStageId, workflows, selectedJob.status)}
                </option>
              )}
            </select>
            {outputStageId !== selectedJob.currentStageId && (
              <p className="text-xs text-amber-600 mt-2">
                ⚠️ Recording output to a different stage than job's current stage
              </p>
            )}
          </div>

          {/* Production Summary */}
          {plannedQty > 0 && (
            <div className="bg-white border-2 border-blue-200 rounded-xl sm:rounded-2xl p-3 sm:p-4">
              <h4 className="font-bold text-gray-900 mb-2 sm:mb-3 text-sm sm:text-base">Production Progress</h4>
              <div className="grid grid-cols-2 gap-2 sm:gap-3 text-center mb-2 sm:mb-3">
                <div className="bg-gray-50 rounded-xl p-3">
                  <span className="text-xs text-gray-500 block">Planned</span>
                  <div className="font-bold text-gray-900">{plannedQty.toLocaleString()}</div>
                  <span className="text-xs text-gray-500">{plannedUOM}</span>
                </div>
                <div className="bg-purple-50 rounded-xl p-3">
                  <span className="text-xs text-purple-600 block">Transferred</span>
                  <div className="font-bold text-purple-600">
                    {totalTransferred.toLocaleString()} {currentStageInputUOM || 'sheets'}
                    {showTransferredConversion && (
                      <span className="text-xs font-normal text-purple-500 ml-1">
                        (×{numberUp} = {totalTransferredInOutputUOM.toLocaleString()} {currentStageOutputUOM})
                      </span>
                    )}
                  </div>
                  {!showTransferredConversion && (
                    <span className="text-xs text-purple-600">{currentStageInputUOM || 'sheets'}</span>
                  )}
                </div>
                <div className="bg-blue-50 rounded-xl p-3">
                  <span className="text-xs text-blue-600 block">Produced</span>
                  <div className="font-bold text-blue-600">{totalProducedInStage.toLocaleString()}</div>
                  <span className="text-xs text-blue-600">{currentStageOutputUOM || 'units'}</span>
                </div>
                <div className="bg-orange-50 rounded-xl p-3">
                  <span className="text-xs text-orange-600 block">Remaining</span>
                  <div className="font-bold text-orange-600">
                    {Math.max(0, remaining).toLocaleString()} {totalTransferred > 0 ? (currentStageInputUOM || 'sheets') : (currentStageOutputUOM || 'units')}
                    {showRemainingConversion && (
                      <span className="text-xs font-normal text-orange-500 ml-1">
                        (×{numberUp} = {remainingInOutputUOM.toLocaleString()} {currentStageOutputUOM})
                      </span>
                    )}
                  </div>
                  {!showRemainingConversion && (
                    <span className="text-xs text-orange-600">{totalTransferred > 0 ? (currentStageInputUOM || 'sheets') : (currentStageOutputUOM || 'units')}</span>
                  )}
                </div>
              </div>
             
              {/* Progress Bar */}
              <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
                <div
                  className={`h-3 rounded-full transition-all ${
                    isOverLimit ? 'bg-red-500' : isIncomplete ? 'bg-amber-500' : 'bg-green-500'
                  }`}
                  style={{ width: `${Math.min(100, (totalProducedInStage / plannedQty) * 100)}%` }}
                />
              </div>
             
              {isIncomplete && (
                <div className="bg-amber-100 border border-amber-200 rounded-lg sm:rounded-xl px-3 sm:px-4 py-2 text-xs sm:text-sm text-amber-800 break-words">
                  <span className="font-bold">⚠️ Incomplete:</span> Need {Math.max(0, completionThreshold - totalAfterThisEntry).toLocaleString()} more {currentStageOutputUOM || 'units'} (minimum total: {completionThreshold.toLocaleString()}+)
                </div>
              )}
              {isOverLimit && (
                <div className="bg-red-100 border border-red-200 rounded-lg sm:rounded-xl px-3 sm:px-4 py-2 text-xs sm:text-sm text-red-800 break-words">
                  <span className="font-bold">⚠️ Over Limit:</span> Maximum allowed is {completionThresholdUpper.toLocaleString()} {currentStageOutputUOM || 'units'}, but total will be {totalAfterThisEntry.toLocaleString()} {currentStageOutputUOM || 'units'}. Please reduce by {(totalAfterThisEntry - completionThresholdUpper).toLocaleString()} {currentStageOutputUOM || 'units'}.
                </div>
              )}
              {!isIncomplete && !isOverLimit && totalAfterThisEntry > 0 && (
                <div className="bg-green-100 border border-green-200 rounded-lg sm:rounded-xl px-3 sm:px-4 py-2 text-xs sm:text-sm text-green-800 break-words">
                  <span className="font-bold">✓ Within acceptable range</span>
                </div>
              )}
            </div>
          )}

          {/* Quantity Inputs - Large */}
          <div className="flex flex-col sm:grid sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className="block text-xs sm:text-sm font-bold text-gray-700 mb-1 sm:mb-2">
                Good Qty ({currentStageInputUOM || 'units'})
              </label>
              <input
                type="number"
                min={0}
                step="1"
                placeholder="0"
                className="w-full p-3 sm:p-4 border-2 border-green-200 rounded-xl sm:rounded-2xl focus:ring-4 focus:ring-green-500/20 focus:border-green-500 text-2xl sm:text-3xl font-bold text-center text-green-600"
                value={qtyGood || ''}
                onChange={e => setActionData({ ...actionData, qtyGood: Number(e.target.value) })}
                autoFocus
              />
              {currentStageInputUOM && currentStageOutputUOM && currentStageInputUOM !== currentStageOutputUOM && numberUp > 0 && (
                <p className="text-center text-xs sm:text-sm text-blue-600 mt-1 sm:mt-2 font-medium">
                  = {convertToOutputUOM(qtyGood || 0).toFixed(0)} {currentStageOutputUOM}
                </p>
              )}
            </div>
            <div>
              <label className="block text-xs sm:text-sm font-bold text-gray-700 mb-1 sm:mb-2">
                Scrap ({currentStageInputUOM || 'units'})
              </label>
              <input
                type="number"
                min={0}
                step="1"
                placeholder="0"
                className="w-full p-3 sm:p-4 border-2 border-gray-200 rounded-xl sm:rounded-2xl focus:ring-4 focus:ring-gray-500/20 focus:border-gray-400 text-2xl sm:text-3xl font-bold text-center text-gray-500"
                value={qtyScrap || ''}
                onChange={e => setActionData({ ...actionData, qtyScrap: Number(e.target.value) })}
              />
            </div>
          </div>

          {/* Conversion Info */}
          {currentStageInputUOM && currentStageOutputUOM && currentStageInputUOM !== currentStageOutputUOM && numberUp > 0 && (
            <div className="p-2 sm:p-3 bg-blue-50 border border-blue-200 rounded-lg sm:rounded-xl text-xs sm:text-sm text-blue-800 text-center break-words">
              <span className="font-bold">Conversion:</span> {currentStageInputUOM} → {currentStageOutputUOM} (×{numberUp})
            </div>
          )}

          {/* Date & Workcenter */}
          <div className="flex flex-col sm:grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs sm:text-sm font-bold text-gray-700 mb-1 sm:mb-2">Date & Time</label>
              <input
                type="datetime-local"
                value={actionData.runDateTime || ''}
                onChange={e => setActionData({ ...actionData, runDateTime: e.target.value })}
                className="w-full p-3 sm:p-4 border-2 border-gray-200 rounded-xl sm:rounded-2xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 text-sm sm:text-base"
              />
            </div>
            <div>
              <label className="block text-xs sm:text-sm font-bold text-gray-700 mb-1 sm:mb-2">Workcenter</label>
              <select
                value={actionData.workcenterId || selectedJob?.workcenterId || ''}
                onChange={e => setActionData({ ...actionData, workcenterId: e.target.value || undefined })}
                className="w-full p-3 sm:p-4 border-2 border-gray-200 rounded-xl sm:rounded-2xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 text-sm sm:text-base bg-white"
              >
                <option value="">Unspecified</option>
                {workcenters.map(w => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Lot Number */}
          <div>
            <label className="block text-xs sm:text-sm font-bold text-gray-700 mb-1 sm:mb-2">
              Lot Number {totalTransferred > 0 ? '(Required - Select from transferred lots)' : '(Auto-generated if empty)'}
            </label>
            {totalTransferred > 0 && lotAvailability.length > 0 ? (
              <select
                className="w-full p-3 sm:p-4 border-2 border-blue-200 rounded-xl sm:rounded-2xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 text-sm sm:text-base bg-white font-semibold break-words"
                value={actionData.lot || nextAvailableLot?.lot || ''}
                onChange={e => setActionData({ ...actionData, lot: e.target.value })}
              >
                <option value="">Select a lot...</option>
                {lotAvailability.map((lotInfo) => {
                  // Show remainingQty in input unit, and convert to output unit if different
                  const remainingInOutputUOM = convertToOutputUOM(lotInfo.remainingQty)
                  const showLotConversion = currentStageInputUOM !== currentStageOutputUOM && numberUp > 1
                  
                  return (
                    <option
                      key={lotInfo.lot}
                      value={lotInfo.lot}
                      disabled={lotInfo.remainingQty <= 0}
                      className="break-words"
                    >
                      {lotInfo.lot} - Available: {lotInfo.remainingQty.toLocaleString()} {currentStageInputUOM || 'sheets'}
                      {showLotConversion && ` (×${numberUp} = ${remainingInOutputUOM.toLocaleString()} ${currentStageOutputUOM})`}
                      {lotInfo.remainingQty <= 0 ? ' (Fully processed)' : ''}
                      {lotInfo.lot === nextAvailableLot?.lot ? ' (Recommended - FIFO)' : ''}
                    </option>
                  )
                })}
              </select>
            ) : (
              <input
                type="text"
                placeholder="Leave empty for auto-generation"
                className="w-full p-3 sm:p-4 border-2 border-gray-200 rounded-xl sm:rounded-2xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 text-sm sm:text-base break-words"
                value={actionData.lot || ''}
                onChange={e => setActionData({ ...actionData, lot: e.target.value })}
              />
            )}
            {totalTransferred > 0 && nextAvailableLot && (() => {
              const remainingInOutputUOM = convertToOutputUOM(nextAvailableLot.remainingQty)
              const showLotConversion = currentStageInputUOM !== currentStageOutputUOM && numberUp > 1
              
              return (
                <p className="text-xs text-blue-600 mt-1 sm:mt-2 break-words">
                  💡 Recommended: {nextAvailableLot.lot} ({nextAvailableLot.remainingQty.toLocaleString()} {currentStageInputUOM || 'sheets'}
                  {showLotConversion && ` ×${numberUp} = ${remainingInOutputUOM.toLocaleString()} ${currentStageOutputUOM}`} available - FIFO)
                </p>
              )
            })()}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs sm:text-sm font-bold text-gray-700 mb-1 sm:mb-2">Notes (Optional)</label>
            <textarea
              placeholder="Add notes..."
              rows={3}
              className="w-full p-3 sm:p-4 border-2 border-gray-200 rounded-xl sm:rounded-2xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 resize-none text-sm sm:text-base"
              value={actionData.notes || ''}
              onChange={e => setActionData({ ...actionData, notes: e.target.value })}
            />
          </div>

          {/* Completed Lots - Post to Inventory */}
          {isLastStage && completedLots.length > 0 && (
            <div className="bg-emerald-50 border-2 border-emerald-200 rounded-xl sm:rounded-2xl p-3 sm:p-4">
              <h4 className="font-bold text-sm sm:text-base text-emerald-900 mb-2 sm:mb-3 flex items-center gap-2">
                <CheckCircleIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                Completed Lots - Ready for Inventory
              </h4>
              <div className="space-y-2">
                {completedLots.map((lotInfo) => (
                  <div key={lotInfo.lot} className="bg-white rounded-lg sm:rounded-xl p-2 sm:p-3 border border-emerald-200">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0 mb-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-xs sm:text-sm text-gray-900 break-words">{lotInfo.lot}</p>
                        <p className="text-xs sm:text-sm text-gray-600">
                          Processed: {lotInfo.processedQty.toLocaleString()} {currentStageOutputUOM || 'units'}
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          setSelectedLotForPosting({ lot: lotInfo.lot, qty: lotInfo.processedQty })
                          setShowLotInventoryPostingModal(true)
                        }}
                        className="w-full sm:w-auto px-3 sm:px-4 py-2 bg-emerald-600 text-white rounded-lg sm:rounded-xl text-xs sm:text-sm font-semibold hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2 touch-manipulation"
                      >
                        <ArrowUpTrayIcon className="h-3 w-3 sm:h-4 sm:w-4" />
                        Post to Inventory
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Fixed Bottom Action Buttons */}
        <div className="flex-shrink-0 p-4 bg-white border-t border-gray-200 safe-area-inset-bottom">
          <div className="flex gap-3">
            <button
              onClick={handleClose}
              className="flex-1 py-4 bg-gray-100 rounded-2xl font-bold text-gray-700 active:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={async () => {
                if (!qtyGood || qtyGood <= 0) {
                  alert('Please enter Good Quantity to add production record.')
                  return
                }

                // Strong validation using fresh runs from backend
                let lotAllocations: Array<{ lot: string; qty: number }> = []
                
                try {
                  const freshRuns = await listJobProductionRuns(workspaceId, selectedJob.id)
                  const freshStageRuns = freshRuns.filter((r: any) => r.stageId === outputStageId)
                  const freshTransferRuns = freshStageRuns.filter((r: any) =>
                    r.transferSourceRunIds && Array.isArray(r.transferSourceRunIds) && r.transferSourceRunIds.length > 0
                  )
                  const freshProductionRuns = freshStageRuns.filter((r: any) =>
                    !r.transferSourceRunIds || !Array.isArray(r.transferSourceRunIds) || r.transferSourceRunIds.length === 0
                  )

                  // Find the previous stage ID
                  const plannedStages = (selectedJob as any).plannedStageIds || []
                  const currentStageIndex = plannedStages.indexOf(outputStageId)
                  const previousStageId = currentStageIndex > 0 ? plannedStages[currentStageIndex - 1] : null

                  // Get source run IDs from transfer runs
                  const sourceRunIds = new Set<string>()
                  freshTransferRuns.forEach((transferRun: any) => {
                    if (Array.isArray(transferRun.transferSourceRunIds)) {
                      transferRun.transferSourceRunIds.forEach((id: string) => sourceRunIds.add(String(id)))
                    }
                  })

                  // Find all source runs from the previous stage (these have the actual transferred quantities in input unit)
                  const previousStageSourceRuns = freshRuns.filter((r: any) => {
                    // Only count runs from the previous stage
                    if (previousStageId && r.stageId !== previousStageId) return false
                    // Must be a source run (referenced by transferSourceRunIds)
                    return sourceRunIds.has(String(r.id))
                  })

                  // Calculate total transferred from previous stage source runs (in input unit)
                  const freshTotalTransferredInInput = previousStageSourceRuns.reduce((sum: number, r: any) => sum + Number(r.qtyGood || 0), 0)
                  const freshTotalTransferred = convertToOutputUOM(freshTotalTransferredInInput)
                  const freshTotalProduced = freshProductionRuns.reduce((sum: number, r: any) => sum + Number(r.qtyGood || 0), 0)

                  if (freshTotalTransferredInInput > 0) {

                    // Calculate remaining quantity per lot (in input unit) from previous stage source runs
                    const lotRemainingMap = new Map<string, number>()
                    previousStageSourceRuns.forEach((r: any) => {
                      const lot = r.lot || ''
                      if (!lot) return
                      // Source run qtyGood is in previous stage's output unit (which is current stage's input unit)
                      const existing = lotRemainingMap.get(lot) || 0
                      lotRemainingMap.set(lot, existing + Number(r.qtyGood || 0))
                    })
                    
                    // Subtract what has been produced in current stage (convert from output to input unit)
                    freshProductionRuns.forEach((r: any) => {
                      const lot = r.lot || ''
                      if (!lot) return
                      const existing = lotRemainingMap.get(lot) || 0
                      // Convert produced from output unit to input unit
                      const producedInInput = convertFromOutputUOM(Number(r.qtyGood || 0))
                      lotRemainingMap.set(lot, Math.max(0, existing - producedInInput))
                    })

                    // Get lot transfer dates for FIFO ordering from previous stage source runs
                    const lotTransferDates = new Map<string, Date>()
                    previousStageSourceRuns.forEach((r: any) => {
                      const lot = r.lot || ''
                      if (!lot) return
                      const runDate = r.at
                        ? (typeof r.at === 'string' ? new Date(r.at) : new Date((r.at as any).seconds * 1000))
                        : new Date()
                      const existing = lotTransferDates.get(lot)
                      if (!existing || runDate < existing) {
                        lotTransferDates.set(lot, runDate)
                      }
                    })

                    // Sort lots by transfer date (FIFO - oldest first)
                    const sortedLots = Array.from(lotRemainingMap.entries())
                      .map(([lot, remaining]) => ({
                        lot,
                        remaining,
                        date: lotTransferDates.get(lot) || new Date()
                      }))
                      .filter(l => l.remaining > 0)
                      .sort((a, b) => a.date.getTime() - b.date.getTime())

                    const qtyNeededInInput = qtyGood // Already in input unit

                    // FIFO allocation: distribute quantity across lots starting from oldest
                    let remainingNeeded = qtyNeededInInput
                    lotAllocations = []

                    for (const lotInfo of sortedLots) {
                      if (remainingNeeded <= 0) break
                      
                      const lotRemaining = lotInfo.remaining
                      if (lotRemaining <= 0) continue

                      const qtyToUse = Math.min(remainingNeeded, lotRemaining)
                      lotAllocations.push({
                        lot: lotInfo.lot,
                        qty: qtyToUse
                      })
                      remainingNeeded -= qtyToUse
                    }

                    // Check if we have enough total transferred material
                    if (remainingNeeded > 0) {
                      const totalRemaining = Array.from(lotRemainingMap.values()).reduce((sum, qty) => sum + qty, 0)
                      alert(
                        `⚠️ Insufficient transferred quantity!\n\n` +
                        `Needed: ${qtyNeededInInput.toLocaleString()} ${currentStageInputUOM || 'sheets'}\n` +
                        `Total Available: ${totalRemaining.toLocaleString()} ${currentStageInputUOM || 'sheets'}\n` +
                        `Shortage: ${remainingNeeded.toLocaleString()} ${currentStageInputUOM || 'sheets'}`
                      )
                      return
                    }

                    // Check overall limit
                    const qtyInOutputUOM = convertToOutputUOM(qtyGood)
                    if (freshTotalProduced + qtyInOutputUOM > freshTotalTransferred) {
                      alert(
                        `⚠️ Cannot process more than transferred quantity!\n\n` +
                        `Total Transferred: ${freshTotalTransferred.toLocaleString()} ${currentStageOutputUOM || 'units'}\n` +
                        `Already Produced: ${freshTotalProduced.toLocaleString()} ${currentStageOutputUOM || 'units'}\n` +
                        `This Entry: ${qtyInOutputUOM.toLocaleString()} ${currentStageOutputUOM || 'units'}\n` +
                        `Maximum allowed: ${freshTotalTransferred.toLocaleString()} ${currentStageOutputUOM || 'units'}`
                      )
                      return
                    }

                    // If allocation uses multiple lots, show confirmation
                    if (lotAllocations.length > 1) {
                      const allocationText = lotAllocations.map(a => 
                        `${a.lot}: ${a.qty.toLocaleString()} ${currentStageInputUOM || 'sheets'}`
                      ).join('\n')
                      const confirmed = confirm(
                        `📦 FIFO Allocation:\n\n` +
                        `Total: ${qtyNeededInInput.toLocaleString()} ${currentStageInputUOM || 'sheets'}\n\n` +
                        `Will be allocated across ${lotAllocations.length} lots:\n${allocationText}\n\n` +
                        `Continue?`
                      )
                      if (!confirmed) return
                    }
                  }
                } catch (e) {
                  console.error('Failed to validate against fresh production runs:', e)
                  alert('Failed to validate production quantity. Please try again.')
                  return
                }

                if (isOverLimit) {
                  const excess = totalAfterThisEntry - completionThresholdUpper
                  alert(`⚠️ Cannot add record: Production quantity exceeds maximum limit.\n\nPlanned: ${plannedQty.toLocaleString()} ${currentStageOutputUOM || 'units'}\nMaximum Allowed: ${completionThresholdUpper.toLocaleString()} ${currentStageOutputUOM || 'units'}\nCurrent Total After Entry: ${totalAfterThisEntry.toLocaleString()} ${currentStageOutputUOM || 'units'}\nExcess: ${excess.toLocaleString()} ${currentStageOutputUOM || 'units'}\n\nPlease reduce the quantity by at least ${excess.toLocaleString()} ${currentStageOutputUOM || 'units'}.`)
                  return
                }

                const generateLotId = () => {
                  const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '')
                  const random = Math.random().toString(36).substring(2, 6).toUpperCase()
                  return `${selectedJob.code || selectedJob.id}-${timestamp}-${random}`
                }

                // If we have lot allocations from FIFO, create multiple runs
                if (lotAllocations.length > 0) {
                  const runDateTime = actionData.runDateTime ? new Date(actionData.runDateTime) : undefined
                  const workcenterId = actionData.workcenterId || selectedJob?.workcenterId
                  const operatorId = 'current-user'
                  const notes = actionData.notes || undefined

                  // Calculate scrap per lot (proportional to good quantity)
                  const totalGood = lotAllocations.reduce((sum, a) => sum + a.qty, 0)
                  const scrapPerUnit = qtyScrap > 0 && totalGood > 0 ? qtyScrap / totalGood : 0

                  // Create production runs for each lot allocation
                  let completedRuns = 0
                  const totalRuns = lotAllocations.length

                  for (const allocation of lotAllocations) {
                    const qtyGoodInInput = allocation.qty
                    const qtyScrapForLot = scrapPerUnit > 0 ? Math.round(qtyGoodInInput * scrapPerUnit) : 0

                    const qtyGoodToSave = currentStageInputUOM === 'sheets' && currentStageOutputUOM === 'cartoon' && numberUp > 0
                      ? Math.round(convertToOutputUOM(qtyGoodInInput))
                      : Math.round(qtyGoodInInput)
                    const qtyScrapToSave = currentStageInputUOM === 'sheets' && currentStageOutputUOM === 'cartoon' && numberUp > 0 && qtyScrapForLot > 0
                      ? Math.round(convertToOutputUOM(qtyScrapForLot))
                      : Math.round(qtyScrapForLot)

                    try {
                      await productionMutation.mutateAsync({
                        qtyGood: qtyGoodToSave,
                        qtyScrap: qtyScrapToSave || undefined,
                        lot: allocation.lot,
                        stageId: outputStageId,
                        workcenterId,
                        operatorId,
                        at: runDateTime,
                        notes: notes ? `${notes} (Part ${completedRuns + 1}/${totalRuns})` : `(Part ${completedRuns + 1}/${totalRuns})`
                      })
                      completedRuns++
                    } catch (error) {
                      console.error(`Failed to create run for lot ${allocation.lot}:`, error)
                      alert(`Failed to create production run for lot ${allocation.lot}. Please try again.`)
                      return
                    }
                  }

                  if (completedRuns === totalRuns) {
                    handleClose()
                    setSelectedOutputStageId(null)
                  }
                } else {
                  // Single run (no lot allocations or no transferred material)
                  const qtyGoodToSave = currentStageInputUOM === 'sheets' && currentStageOutputUOM === 'cartoon' && numberUp > 0
                    ? Math.round(convertToOutputUOM(qtyGood))
                    : Math.round(qtyGood)
                  const qtyScrapToSave = currentStageInputUOM === 'sheets' && currentStageOutputUOM === 'cartoon' && numberUp > 0 && qtyScrap > 0
                    ? Math.round(convertToOutputUOM(qtyScrap))
                    : Math.round(qtyScrap)

                  const lotNumber = actionData.lot || generateLotId()

                  productionMutation.mutate({
                    qtyGood: qtyGoodToSave,
                    qtyScrap: qtyScrapToSave || undefined,
                    lot: lotNumber,
                    stageId: outputStageId,
                    workcenterId: actionData.workcenterId || selectedJob?.workcenterId,
                    operatorId: 'current-user',
                    at: actionData.runDateTime ? new Date(actionData.runDateTime) : undefined,
                    notes: actionData.notes || undefined
                  }, {
                    onSuccess: () => {
                      handleClose()
                      setSelectedOutputStageId(null)
                    }
                  })
                }
              }}
              disabled={productionMutation.isPending || !qtyGood || qtyGood <= 0 || isOverLimit}
              className={`flex-1 py-3 sm:py-4 rounded-xl sm:rounded-2xl font-bold text-sm sm:text-base shadow-lg transition-all disabled:opacity-50 disabled:shadow-none active:scale-[0.98] touch-manipulation ${
                isOverLimit
                  ? 'bg-gradient-to-r from-red-500 to-red-600 text-white shadow-red-500/30 cursor-not-allowed'
                  : 'bg-gradient-to-r from-green-500 to-green-600 text-white shadow-green-500/30'
              }`}
            >
              {productionMutation.isPending ? 'Recording...' : isOverLimit ? 'Over Limit' : 'Save Output'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Fetch fresh production runs when modal opens
  useEffect(() => {
    if (showStageOutputModal && selectedJob?.id) {
      setIsLoadingFreshRuns(true)
      listJobProductionRuns(workspaceId, selectedJob.id)
        .then(runs => {
          setFreshRunsForModal(runs)
          setIsLoadingFreshRuns(false)
        })
        .catch(err => {
          console.error('Failed to fetch fresh runs for modal:', err)
          setFreshRunsForModal(productionRuns)
          setIsLoadingFreshRuns(false)
        })
    } else {
      setFreshRunsForModal([])
      setIsLoadingFreshRuns(false)
    }
  }, [showStageOutputModal, selectedJob?.id, workspaceId])

  // --- Stage Output Selection Modal ---
  const renderStageOutputModal = () => {
    if (!showStageOutputModal || !selectedStageForOutput || !selectedJob) return null

    const { stageId, stageName, nextStageId, nextStageName } = selectedStageForOutput
   
    // Check if this is the last stage
    const planned: string[] = (selectedJob as any).plannedStageIds || []
    const workflow = workflows.find(w => w.id === selectedJob.workflowId)
    const allStages = workflow?.stages || []
    const isLastStage = planned.length > 0
      ? planned[planned.length - 1] === stageId
      : (allStages.length > 0 && allStages[allStages.length - 1]?.id === stageId)
   
    // Show loading state while fetching fresh data
    if (isLoadingFreshRuns) {
      return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-2 sm:p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl sm:rounded-2xl shadow-2xl w-full max-w-md mx-2 sm:mx-4 p-6">
            <div className="flex flex-col items-center justify-center">
              <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
              <p className="text-gray-600 font-medium text-sm sm:text-base">Loading production data...</p>
            </div>
          </div>
        </div>
      )
    }
   
    // Use fresh runs if available, otherwise fallback to productionRuns
    const runsToUse = freshRunsForModal.length > 0 ? freshRunsForModal : productionRuns
   
    // Get production runs for this stage
    const stageRuns = runsToUse.filter(r => {
      if (r.stageId !== stageId) return false
      const run = r as any
      return !(run.transferSourceRunIds && Array.isArray(run.transferSourceRunIds) && run.transferSourceRunIds.length > 0)
    })

    // Determine which runs have already been transferred to the next stage
    const allNextStageRuns = runsToUse.filter(r => r.stageId === nextStageId)
    const nextStageLotNumbers = new Set<string>(
      allNextStageRuns
        .map(r => r.lot)
        .filter((lot): lot is string => !!lot)
    )
   
    const isRunAlreadyTransferred = (run: any) => {
      const transferredRunIds = new Set<string>(
        allNextStageRuns
          .filter(r => Array.isArray((r as any).transferSourceRunIds))
          .flatMap(r => (r as any).transferSourceRunIds as string[])
      )
      if (transferredRunIds.has(String(run.id))) {
        return true
      }
     
      if (run.lot && nextStageLotNumbers.has(run.lot)) {
        return true
      }
     
      return false
    }

    // Determine display unit based on stage output UOM or job unit
    const workflowForStage = workflows.find(w => w.stages?.some(s => s.id === stageId))
    const stageInfo = workflowForStage?.stages?.find(s => s.id === stageId) as any | undefined
    const displayUnit =
      (stageInfo?.outputUOM as string | undefined)
      || (stageInfo?.inputUOM as string | undefined)
      || (selectedJob.unit as string | undefined)
      || 'units'
   
    if (stageRuns.length === 0) {
      return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-2 sm:p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl sm:rounded-2xl shadow-2xl w-full max-w-md mx-2 sm:mx-4">
            <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 bg-gradient-to-r from-blue-500 to-blue-600 rounded-t-xl sm:rounded-t-2xl">
              <div className="flex items-center justify-between">
                <h3 className="text-base sm:text-lg font-semibold text-white">No Outputs</h3>
                <button
                  onClick={() => {
                    setShowStageOutputModal(false)
                    setSelectedStageForOutput(null)
                    setSelectedOutputIds(new Set())
                  }}
                  className="w-10 h-10 sm:w-8 sm:h-8 bg-white/20 rounded-lg flex items-center justify-center hover:bg-white/30 active:bg-white/40 transition-colors"
                >
                  <XMarkIcon className="h-6 w-6 sm:h-5 sm:w-5 text-white" />
                </button>
              </div>
            </div>
            <div className="p-4 sm:p-6">
              <p className="text-gray-600 text-center mb-4 text-sm sm:text-base">No production outputs found for this stage.</p>
              <button
                onClick={() => {
                  setShowStageOutputModal(false)
                  setSelectedStageForOutput(null)
                  setSelectedOutputIds(new Set())
                }}
                className="w-full px-4 py-4 sm:py-3 rounded-xl bg-gray-100 text-gray-700 font-semibold hover:bg-gray-200 active:bg-gray-300 transition-colors touch-manipulation text-base"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )
    }

    const toggleOutputSelection = (runId: string) => {
      const run = stageRuns.find(r => r.id === runId)
      if (!run || isRunAlreadyTransferred(run)) return

      setSelectedOutputIds(prev => {
        const newSet = new Set(prev)
        if (newSet.has(runId)) {
          newSet.delete(runId)
        } else {
          newSet.add(runId)
        }
        return newSet
      })
    }

    const toggleAll = () => {
      const selectableRuns = stageRuns.filter(r => !isRunAlreadyTransferred(r))
      if (selectedOutputIds.size === selectableRuns.length) {
        setSelectedOutputIds(new Set())
      } else {
        setSelectedOutputIds(new Set(selectableRuns.map(r => r.id)))
      }
    }

    const selectedRuns = stageRuns.filter(r => selectedOutputIds.has(r.id) && !isRunAlreadyTransferred(r))
    const totalQty = selectedRuns.reduce((sum, r) => sum + (r.qtyGood || 0), 0)
   
    const generateLotId = () => {
      const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '')
      const random = Math.random().toString(36).substring(2, 6).toUpperCase()
      return `${selectedJob.code || selectedJob.id}-${timestamp}-${random}`
    }

    const handleMoveToNextStage = async () => {
      if (selectedRuns.length === 0) {
        alert('Please select at least one output to transfer.')
        return
      }

      if (isLastStage) {
        // Check if there's anything to post before opening modal
        const lastStageRuns = productionRuns.filter((r: any) => {
          if (r.stageId !== selectedStageForOutput.stageId) return false
          // Exclude transfer runs
          if (r.transferSourceRunIds && Array.isArray(r.transferSourceRunIds) && r.transferSourceRunIds.length > 0) {
            return false
          }
          return true
        })
        const totalQty = lastStageRuns.reduce((sum: number, r: any) => sum + Number(r.qtyGood || 0), 0)
        
        if (totalQty <= 0) {
          // Show user-friendly message instead of opening modal
          alert('No output processed yet.\n\nPlease record production output in this stage before posting to inventory.')
          setShowStageOutputModal(false)
          setSelectedStageForOutput(null)
          setSelectedOutputIds(new Set())
          return
        }
        
        setShowStageOutputModal(false)
        setSelectedStageForOutput(null)
        setSelectedOutputIds(new Set())
        setShowInventoryPostingModal(true)
        return
      }

      if (!nextStageId) {
        alert('No next stage available.')
        return
      }

      try {
        const lotId = generateLotId()
        const sourceRunIds = selectedRuns.map(r => String(r.id))

        await productionMutation.mutateAsync({
          stageId: nextStageId,
          qtyGood: totalQty,
          lot: lotId,
          workcenterId: selectedJob.workcenterId,
          at: new Date(),
          transferSourceRunIds: sourceRunIds,
        } as any)

        setIsLoadingFreshRuns(true)
        listJobProductionRuns(workspaceId, selectedJob.id)
          .then(runs => {
            setFreshRunsForModal(runs)
            setIsLoadingFreshRuns(false)
          })
          .catch(err => {
            console.error('Failed to refresh fresh runs after transfer:', err)
            setIsLoadingFreshRuns(false)
          })

        setShowStageOutputModal(false)
        setSelectedStageForOutput(null)
        setSelectedOutputIds(new Set())
       
        alert(
          `✓ Outputs moved to next stage as lot!\n\n` +
          `Job: ${selectedJob.code || selectedJob.id}\n` +
          `Lot: ${lotId}\n` +
          `From: ${stageName}\n` +
          `To: ${nextStageName || 'Next Stage'}\n` +
          `Quantity: ${totalQty.toLocaleString()} ${displayUnit}\n` +
          `Outputs: ${selectedRuns.length}`
        )
      } catch (error: any) {
        alert(error?.message || 'Failed to move outputs to next stage')
      }
    }

    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-2 sm:p-4 bg-black/50 backdrop-blur-sm">
        <div className="bg-white rounded-xl sm:rounded-2xl shadow-2xl w-full max-w-lg mx-2 sm:mx-4 max-h-[95vh] sm:max-h-[90vh] flex flex-col">
          <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 bg-gradient-to-r from-blue-500 to-blue-600 rounded-t-xl sm:rounded-t-2xl flex-shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0 pr-2">
                <h3 className="text-base sm:text-lg font-semibold text-white">
                  {isLastStage ? 'Select Outputs to Transfer to Inventory' : 'Select Outputs to Transfer'}
                </h3>
                <p className="text-xs sm:text-sm text-blue-100 mt-0.5 sm:mt-1 truncate">
                  {isLastStage ? `${stageName} → Inventory` : `${stageName} → ${nextStageName || 'Next Stage'}`}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowStageOutputModal(false)
                  setSelectedStageForOutput(null)
                  setSelectedOutputIds(new Set())
                }}
                className="w-10 h-10 sm:w-8 sm:h-8 bg-white/20 rounded-lg flex items-center justify-center hover:bg-white/30 active:bg-white/40 transition-colors flex-shrink-0"
              >
                <XMarkIcon className="h-6 w-6 sm:h-5 sm:w-5 text-white" />
              </button>
            </div>
          </div>
         
          <div className="flex-1 overflow-y-auto p-4 sm:p-6">
            {/* Select All */}
            <div className="mb-4 pb-4 border-b border-gray-200">
              <label className="flex items-center gap-3 cursor-pointer touch-manipulation">
                <input
                  type="checkbox"
                  checked={(() => {
                    const selectableRuns = stageRuns.filter(r => !isRunAlreadyTransferred(r))
                    return selectedOutputIds.size > 0 && selectedOutputIds.size === selectableRuns.length
                  })()}
                  onChange={toggleAll}
                  className="w-6 h-6 sm:w-5 sm:h-5 text-blue-600 rounded border-gray-300 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                />
                <span className="font-semibold text-gray-900 text-base sm:text-base">
                  Select All ({stageRuns.length} outputs)
                </span>
              </label>
            </div>

            {/* Output List */}
            <div className="space-y-3 sm:space-y-3">
              {stageRuns.map((run) => {
                const alreadyTransferred = isRunAlreadyTransferred(run)
                const isSelected = selectedOutputIds.has(run.id) && !alreadyTransferred
                const runDate = run.at ? (typeof run.at === 'string' ? new Date(run.at) : new Date((run.at as any).seconds * 1000)) : new Date()
               
                return (
                  <div
                    key={run.id}
                    className={`border-2 rounded-xl p-4 sm:p-4 transition-all cursor-pointer touch-manipulation ${
                      alreadyTransferred
                        ? 'border-gray-200 bg-gray-50 opacity-60 cursor-not-allowed'
                        : isSelected
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 bg-white active:border-gray-300 active:bg-gray-50'
                    }`}
                    onClick={() => {
                      if (!alreadyTransferred) {
                        toggleOutputSelection(run.id)
                      }
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        disabled={alreadyTransferred}
                        onChange={() => !alreadyTransferred && toggleOutputSelection(run.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="w-6 h-6 sm:w-5 sm:h-5 text-blue-600 rounded border-gray-300 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 mt-0.5 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0 mb-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-gray-900 text-base sm:text-base">
                              {run.qtyGood?.toLocaleString() || 0} {displayUnit}
                            </span>
                            {run.lot && (
                              <span className="text-xs sm:text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded break-all">
                                Lot: {run.lot}
                              </span>
                            )}
                            {alreadyTransferred && (
                              <span className="text-xs sm:text-[11px] text-green-700 bg-green-50 border border-green-200 px-2 py-1 rounded whitespace-nowrap">
                                Already transferred
                              </span>
                            )}
                          </div>
                          {run.workcenterId && (
                            <span className="text-xs sm:text-xs text-gray-500 truncate">
                              {workcenters.find(w => w.id === run.workcenterId)?.name || run.workcenterId}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs sm:text-xs text-gray-500">
                          <span>{runDate.toLocaleDateString()}</span>
                          <span>{runDate.toLocaleTimeString()}</span>
                          {run.qtyScrap && run.qtyScrap > 0 && (
                            <span className="text-red-600">Scrap: {run.qtyScrap}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Footer with Summary and Action */}
          <div className="px-4 sm:px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-xl sm:rounded-b-2xl flex-shrink-0">
            {selectedRuns.length > 0 && (
              <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 sm:gap-0 text-sm">
                  <span className="text-gray-600">Selected:</span>
                  <span className="font-semibold text-blue-900">
                    {selectedRuns.length} output{selectedRuns.length > 1 ? 's' : ''} • {totalQty.toLocaleString()} units
                  </span>
                </div>
              </div>
            )}
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => {
                  setShowStageOutputModal(false)
                  setSelectedStageForOutput(null)
                  setSelectedOutputIds(new Set())
                }}
                className="w-full sm:flex-1 px-4 py-4 sm:py-3 rounded-xl bg-white border-2 border-gray-300 text-gray-700 font-semibold hover:bg-gray-50 active:bg-gray-100 transition-colors touch-manipulation text-base"
              >
                Cancel
              </button>
              {(() => {
                const isDisabled = productionMutation.isPending || selectedRuns.length === 0
                return (
                  <button
                    onClick={handleMoveToNextStage}
                    disabled={isDisabled}
                    className={`w-full sm:flex-1 px-4 py-4 sm:py-3 rounded-xl font-semibold shadow-lg transition-all touch-manipulation text-base ${
                      isDisabled
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed shadow-none'
                        : 'bg-gradient-to-r from-green-500 to-green-600 active:from-green-600 active:to-green-700 text-white'
                    }`}
                  >
                    {productionMutation.isPending
                      ? (isLastStage ? 'Transferring...' : 'Moving...')
                      : (isLastStage ? 'Transfer to Inventory' : `Move to ${nextStageName || 'Next Stage'}`)}
                  </button>
                )
              })()}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // --- Batch Transfer Confirmation Modal ---
  const renderBatchTransferModal = () => {
    if (!showBatchTransferModal || !batchTransferData || !selectedJob) return null

    const { batchPayload, rule, lotId, sourceStageName, targetStageName } = batchTransferData

    const handleConfirm = async () => {
      try {
        await productionMutation.mutateAsync({
          stageId: batchPayload.targetStageId,
          qtyGood: batchPayload.qty,
          lot: lotId,
          workcenterId: selectedJob.workcenterId,
          at: new Date(),
        })

        setShowBatchTransferModal(false)
        setBatchTransferData(null)
       
        alert(
          `✓ Batch moved to next stage as lot!\n\n` +
          `Job: ${selectedJob.code || selectedJob.id}\n` +
          `Lot: ${lotId}\n` +
          `From: ${sourceStageName}\n` +
          `To: ${targetStageName}\n` +
          `Quantity: ${batchPayload.qty.toLocaleString()} ${batchPayload.unit}`
        )
      } catch (error: any) {
        alert(error?.message || 'Failed to move batch to next stage')
      }
    }

    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4">
          <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-500 to-blue-600 rounded-t-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Move Batch to Next Stage</h3>
              <button
                onClick={() => {
                  setShowBatchTransferModal(false)
                  setBatchTransferData(null)
                }}
                className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center hover:bg-white/30 transition-colors"
              >
                <XMarkIcon className="h-5 w-5 text-white" />
              </button>
            </div>
          </div>
         
          <div className="p-6 space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-gray-700 mb-3">
                Move this batch to the next stage as a <span className="font-semibold text-blue-600">lot</span>?
              </p>
             
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Job:</span>
                  <span className="font-medium text-gray-900">{selectedJob.code || selectedJob.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Lot ID:</span>
                  <span className="font-medium text-blue-600">{lotId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">From Stage:</span>
                  <span className="font-medium text-gray-900">{sourceStageName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">To Stage:</span>
                  <span className="font-medium text-green-600">{targetStageName}</span>
                </div>
                <div className="flex justify-between border-t pt-2 mt-2">
                  <span className="text-gray-600">Quantity:</span>
                  <span className="font-bold text-gray-900">
                    {batchPayload.qty.toLocaleString()} {batchPayload.unit}
                  </span>
                </div>
              </div>
            </div>

            {rule && rule.minQtyToStartNextStage && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <InformationCircleIcon className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="text-xs text-amber-800">
                    <p className="font-semibold mb-1">Minimum Quantity Required:</p>
                    <p>
                      {batchPayload.qty >= rule.minQtyToStartNextStage ? (
                        <span className="text-green-700">✓ Meets minimum requirement ({rule.minQtyToStartNextStage} {rule.unit})</span>
                      ) : (
                        <span className="text-red-700">⚠️ Below minimum requirement ({rule.minQtyToStartNextStage} {rule.unit})</span>
                      )}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => {
                  setShowBatchTransferModal(false)
                  setBatchTransferData(null)
                }}
                className="flex-1 px-4 py-3 rounded-xl bg-white border-2 border-gray-300 text-gray-700 font-semibold hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={productionMutation.isPending}
                className={`flex-1 px-4 py-3 rounded-xl font-semibold text-white shadow-lg transition-all disabled:opacity-50 disabled:shadow-none ${
                  productionMutation.isPending
                    ? 'bg-gray-400'
                    : 'bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700'
                }`}
              >
                {productionMutation.isPending ? 'Moving...' : 'Confirm & Move'}
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // --- Lot Inventory Posting Modal ---
  const renderLotInventoryPostingModal = () => {
    if (!selectedJob || !selectedLotForPosting) return null

    const outputStageId = selectedOutputStageId || selectedJob.currentStageId || ''
    const outputStageInfo = getStageInfo(outputStageId, workflows) as any
    const currentStageOutputUOM = outputStageInfo?.outputUOM || outputStageInfo?.inputUOM || 'units'
       
    return (
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
          <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-t-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Post Lot to Inventory</h3>
              <button
                onClick={() => {
                  setShowLotInventoryPostingModal(false)
                  setSelectedLotForPosting(null)
                }}
                className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center hover:bg-white/30 transition-colors"
              >
                <XMarkIcon className="h-5 w-5 text-white" />
              </button>
            </div>
          </div>
          <div className="p-6">
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">Lot Number:</p>
              <p className="font-bold text-gray-900 text-lg">{selectedLotForPosting.lot}</p>
            </div>
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">Quantity to Post:</p>
              <p className="font-bold text-gray-900 text-lg">
                {selectedLotForPosting.qty.toLocaleString()} {currentStageOutputUOM}
              </p>
            </div>
            <div className="mb-6">
              <p className="text-sm text-gray-600">
                This will post the completed lot to inventory. The job will remain active for other lots.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowLotInventoryPostingModal(false)
                  setSelectedLotForPosting(null)
                }}
                className="flex-1 px-4 py-3 rounded-xl bg-gray-100 text-gray-700 font-semibold hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  try {
                    const outputStageId = selectedOutputStageId || selectedJob.currentStageId || ''
                    await recordJobOutput(workspaceId, selectedJob.id, {
                      qtyOutput: selectedLotForPosting.qty,
                      autoConsumeMaterials: false,
                      completeJob: false,
                      stageId: outputStageId,
                      lot: selectedLotForPosting.lot,
                      notes: `Lot ${selectedLotForPosting.lot} posted to inventory (partial completion)`
                    })
                   
                    queryClient.invalidateQueries({ queryKey: ['jobs', workspaceId] })
                    queryClient.invalidateQueries({ queryKey: ['jobRuns', workspaceId, selectedJob.id] })
                    queryClient.invalidateQueries({ queryKey: ['products', workspaceId] })
                    queryClient.invalidateQueries({ queryKey: ['stockTxns', workspaceId] })
                    queryClient.invalidateQueries({ queryKey: ['productOnHand', workspaceId] })
                   
                    const freshRuns = await listJobProductionRuns(workspaceId, selectedJob.id)
                    setProductionRuns(freshRuns)
                    setDialogProductionRuns(freshRuns)
                   
                    const updatedJob = await getJob(workspaceId, selectedJob.id)
                    if (updatedJob) {
                      setSelectedJob(updatedJob)
                    }
                   
                    if (selectedJob.sku) {
                      try {
                        const product = await getProductByCode(workspaceId, selectedJob.sku)
                        if (product) {
                          queryClient.invalidateQueries({ queryKey: ['stockTxns', workspaceId, product.id] })
                          queryClient.invalidateQueries({ queryKey: ['productOnHand', workspaceId, product.id] })
                          window.dispatchEvent(new CustomEvent('stockTransactionCreated', { detail: { productId: product.id } }))
                        }
                      } catch (e) {
                        console.error('Failed to refresh product:', e)
                      }
                    }
                   
                    alert(`✅ Lot ${selectedLotForPosting.lot} (${selectedLotForPosting.qty.toLocaleString()} ${currentStageOutputUOM}) posted to inventory successfully!`)
                   
                    setShowLotInventoryPostingModal(false)
                    setSelectedLotForPosting(null)
                  } catch (error: any) {
                    console.error('Failed to post lot to inventory:', error)
                    alert(`❌ Failed to post lot to inventory: ${error.message || 'Unknown error'}`)
                  }
                }}
                className="flex-1 px-4 py-3 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2"
              >
                <ArrowUpTrayIcon className="h-5 w-5" />
                Post to Inventory
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6 pb-20 sm:pb-6 px-4 sm:px-0">
      <ScannerHeader onClose={onClose} />
      <div className="max-w-xl mx-auto space-y-4 sm:space-y-6">
        <ScannerArea
          scanMode={scanMode}
          setScanMode={setScanMode}
          manualCode={manualCode}
          setManualCode={setManualCode}
          onManualSubmit={handleManualSubmit}
          videoRef={videoRef}
          isScanning={isScanning}
          cameraError={cameraError}
          scanAttempts={scanAttempts}
          onRetryCamera={() => {
            setCameraError(null)
            if (videoRef.current && scannerState.reader.current) {
              try {
                ;(scannerState.reader.current as any).reset()
                scannerState.reader.current = null
                setTimeout(() => {
                  setScanMode('manual')
                  setTimeout(() => setScanMode('camera'), 100)
                }, 500)
              } catch (e) {
                console.error('Error restarting camera:', e)
              }
            }
          }}
        />
        <RecentScans
          recentScans={recentScans}
          onScanClick={handleScanCode}
        />
      </div>

      {/* Modals / Action Sheets */}
      {selectedJob && renderJobSheet()}
      {selectedProduct && renderProductSheet()}
     
      {/* Consume Material Full-Screen Dialog */}
      {showConsumeDialog && selectedJob && renderConsumeMaterialDialog()}
     
      {/* Record Output Full-Screen Dialog */}
      {showProduceDialog && selectedJob && renderRecordOutputDialog()}

      {/* Stage Output Selection Modal */}
      {showStageOutputModal && renderStageOutputModal()}

      {/* Batch Transfer Confirmation Modal */}
      {showBatchTransferModal && renderBatchTransferModal()}

      {/* Lot Inventory Posting Modal */}
      {showLotInventoryPostingModal && selectedJob && selectedLotForPosting && renderLotInventoryPostingModal()}

      {/* Inventory Posting Modal */}
      {showInventoryPostingModal && selectedJob && (
        <ConfirmInventoryPostingModal
          job={selectedJob}
          workspaceId={workspaceId}
          products={products}
          onClose={() => setShowInventoryPostingModal(false)}
          onSuccess={async () => {
            await queryClient.invalidateQueries({ queryKey: ['jobs', workspaceId] })
            await queryClient.invalidateQueries({ queryKey: ['jobRuns', workspaceId, selectedJob.id] })
            
            const freshJob = await getJob(workspaceId, selectedJob.id)
            if (!freshJob) {
              console.error('Failed to fetch fresh job data after inventory posting')
              setShowInventoryPostingModal(false)
              return
            }
            
            const freshRuns = await listJobProductionRuns(workspaceId, selectedJob.id)
            
            const planned: string[] = (freshJob as any).plannedStageIds || []
            const workflow = workflows.find(w => w.id === freshJob.workflowId)
            const allStages = workflow?.stages || []
            const isLastStage = planned.length > 0
              ? planned[planned.length - 1] === freshJob.currentStageId
              : (allStages.length > 0 && allStages[allStages.length - 1]?.id === freshJob.currentStageId)
            
            if (isLastStage) {
              const currentStageRuns = freshRuns.filter((r: any) => {
                if (r.stageId !== freshJob.currentStageId) return false
                return !(r.transferSourceRunIds && Array.isArray(r.transferSourceRunIds) && r.transferSourceRunIds.length > 0)
              })
              
              const totalProducedInStage = currentStageRuns.reduce((sum: number, r: any) => {
                return sum + Number(r.qtyGood || 0)
              }, 0)
              
              const stageInfo = allStages.find((s: any) => s.id === freshJob.currentStageId) as any
              const stageOutputUOM = stageInfo?.outputUOM || stageInfo?.inputUOM || ''
              const numberUp = freshJob.productionSpecs?.numberUp || 1
              
              let plannedQty: number
              if (stageOutputUOM === 'cartoon') {
                const boxQty = freshJob.packaging?.plannedBoxes || 0
                const pcsPerBox = freshJob.packaging?.pcsPerBox || 1
                if (boxQty > 0 && pcsPerBox > 0) {
                  plannedQty = boxQty * pcsPerBox
                } else {
                  const plannedSheets = (freshJob.output?.[0]?.qtyPlanned as number) || Number(freshJob.quantity || 0)
                  plannedQty = numberUp > 0 ? plannedSheets * numberUp : plannedSheets
                }
              } else {
                const bom = Array.isArray(freshJob.bom) ? freshJob.bom : []
                const sheetItem = bom.find((item: any) => {
                  const uom = String(item.uom || '').toLowerCase()
                  return ['sht', 'sheet', 'sheets'].includes(uom)
                })
                plannedQty = sheetItem 
                  ? Number(sheetItem.qtyRequired || 0) 
                  : ((freshJob.output?.[0]?.qtyPlanned as number) || Number(freshJob.quantity || 0))
              }
              
              const tolerance = calculateToleranceThresholds(plannedQty)
              const completionThreshold = Math.max(0, plannedQty - tolerance.lower)
              const completionThresholdUpper = plannedQty + tolerance.upper
              
              const isIncomplete = plannedQty > 0 && totalProducedInStage < completionThreshold
              const isOverLimit = plannedQty > 0 && totalProducedInStage > completionThresholdUpper
              const thresholdMet = plannedQty > 0 && totalProducedInStage >= completionThreshold && totalProducedInStage <= completionThresholdUpper
              const requireOutput = (freshJob as any).requireOutputToAdvance !== false
              
              const isAlreadyDone = freshJob.status === 'done'
              
              if (requireOutput && thresholdMet) {
                if (!isAlreadyDone) {
                  await statusMutation.mutateAsync({ jobId: selectedJob.id, status: 'done' })
                }
              } else if (requireOutput && isIncomplete) {
                if (isAlreadyDone) {
                  await statusMutation.mutateAsync({ jobId: selectedJob.id, status: 'in_progress' })
                  alert(
                    `⚠️ Job status reverted to "In Progress".\n\n` +
                    `Inventory posted successfully, but job cannot remain completed.\n\n` +
                    `Required: ${completionThreshold.toLocaleString()}+ ${stageOutputUOM || 'units'}\n` +
                    `Current: ${totalProducedInStage.toLocaleString()} ${stageOutputUOM || 'units'}\n` +
                    `Planned: ${plannedQty.toLocaleString()} ${stageOutputUOM || 'units'}\n\n` +
                    `Please complete production to meet minimum tolerance before finishing the job.`
                  )
                } else {
                  alert(
                    `⚠️ Inventory posted successfully, but job cannot be completed.\n\n` +
                    `Required: ${completionThreshold.toLocaleString()}+ ${stageOutputUOM || 'units'}\n` +
                    `Current: ${totalProducedInStage.toLocaleString()} ${stageOutputUOM || 'units'}\n` +
                    `Planned: ${plannedQty.toLocaleString()} ${stageOutputUOM || 'units'}\n\n` +
                    `Please complete production to meet minimum tolerance before finishing the job.`
                  )
                }
              } else if (requireOutput && isOverLimit) {
                if (isAlreadyDone) {
                  await statusMutation.mutateAsync({ jobId: selectedJob.id, status: 'in_progress' })
                  alert(
                    `⚠️ Job status reverted to "In Progress".\n\n` +
                    `Inventory posted successfully, but job cannot remain completed.\n\n` +
                    `Maximum Allowed: ${completionThresholdUpper.toLocaleString()} ${stageOutputUOM || 'units'}\n` +
                    `Current: ${totalProducedInStage.toLocaleString()} ${stageOutputUOM || 'units'}\n` +
                    `Planned: ${plannedQty.toLocaleString()} ${stageOutputUOM || 'units'}\n\n` +
                    `Please adjust the quantity or consult a supervisor.`
                  )
                } else {
                  alert(
                    `⚠️ Inventory posted successfully, but job cannot be completed.\n\n` +
                    `Maximum Allowed: ${completionThresholdUpper.toLocaleString()} ${stageOutputUOM || 'units'}\n` +
                    `Current: ${totalProducedInStage.toLocaleString()} ${stageOutputUOM || 'units'}\n` +
                    `Planned: ${plannedQty.toLocaleString()} ${stageOutputUOM || 'units'}\n\n` +
                    `Please adjust the quantity or consult a supervisor.`
                  )
                }
              } else if (!requireOutput) {
                if (!isAlreadyDone) {
                  await statusMutation.mutateAsync({ jobId: selectedJob.id, status: 'done' })
                }
              }
            }
            
            setShowInventoryPostingModal(false)
            
            queryClient.invalidateQueries({ queryKey: ['products', workspaceId] })
            queryClient.invalidateQueries({ queryKey: ['stockTxns', workspaceId] })
            queryClient.invalidateQueries({ queryKey: ['productOnHand', workspaceId] })
            
            if (selectedJob.sku) {
              try {
                const product = await getProductByCode(workspaceId, selectedJob.sku)
                if (product) {
                  queryClient.invalidateQueries({ queryKey: ['stockTxns', workspaceId, product.id] })
                  queryClient.invalidateQueries({ queryKey: ['productOnHand', workspaceId, product.id] })
                  window.dispatchEvent(new CustomEvent('stockTransactionCreated', { detail: { productId: product.id } }))
                }
              } catch (e) {
                console.error('Failed to refresh product after job completion:', e)
              }
            }
            
            const updatedJobs = await queryClient.fetchQuery({ 
              queryKey: ['jobs', workspaceId],
              queryFn: () => listJobs(workspaceId)
            })
            const updatedJob = updatedJobs?.jobs?.find(j => j.id === selectedJob.id)
            if (updatedJob) {
              setSelectedJob(updatedJob)
            }
          }}
        />
      )}
    </div>
  )
}

