
import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { BrowserMultiFormatReader } from '@zxing/browser'
import {
  type Job,
  listJobs,
  setJobStatus,
  createConsumption,
  createTimeLog,
  createProductionRun,
  moveJobToStage,
  listWorkflows,
  listJobProductionRuns,
  listJobConsumptions,
  listWorkcenters,
  recalculateJobBomConsumption
} from '../api/production-jobs'
import {
  getProductByCode,
  createStockTransaction,
  getProductOnHand,
  listProducts,
  type ListedProduct
} from '../api/inventory'
import { ConfirmInventoryPostingModal } from './ConfirmInventoryPostingModal'
import { listStockReasons } from '../api/settings'
import {
  QrCodeIcon,
  PlayIcon,
  CheckCircleIcon,
  CubeIcon,
  XMarkIcon,
  ArrowPathIcon,
  MagnifyingGlassIcon,
  ClockIcon,
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
import { Card } from './ui/Card'
import { Button } from './ui/Button'

interface ProductionScannerProps {
  workspaceId: string
  onClose?: () => void
}

type ScanMode = 'camera' | 'manual'
type ScannedType = 'job' | 'product' | 'none'

export function ProductionScanner({ workspaceId, onClose }: ProductionScannerProps) {
  const [scanMode, setScanMode] = useState<ScanMode>('manual') // Default to manual for now
  const [manualCode, setManualCode] = useState('')
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [selectedProduct, setSelectedProduct] = useState<ListedProduct | null>(null)
  const [recentScans, setRecentScans] = useState<Array<{ code: string, type: ScannedType, timestamp: Date }>>([])
  const [lastScannedCode, setLastScannedCode] = useState<string | null>(null)

  // Action states
  const [activeAction, setActiveAction] = useState<string | null>(null)
  const [actionData, setActionData] = useState<any>({})
  const [showInventoryPostingModal, setShowInventoryPostingModal] = useState(false)

  // Camera scanning state
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isScanning, setIsScanning] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [scanAttempts, setScanAttempts] = useState(0) // Track scan attempts for user feedback
  const [lastScanTime, setLastScanTime] = useState<number>(0) // Track last successful scan
  const reader = useRef<BrowserMultiFormatReader | null>(null)

  const queryClient = useQueryClient()

  // Fetch stock reasons
  const { data: stockReasons = [] } = useQuery({
    queryKey: ['stockReasons', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return []
      const reasons = await listStockReasons(workspaceId)
      return reasons.filter(r => r.active)
    },
    enabled: !!workspaceId
  })

  // Fetch jobs for quick lookup (could be optimized to search API)
  const { data: jobsData, isLoading: jobsLoading, error: jobsError } = useQuery({
    queryKey: ['jobs', workspaceId],
    queryFn: () => listJobs(workspaceId),
    enabled: !!workspaceId,
    retry: 2
  })

  // Fetch workflows for stage information
  const { data: workflows = [] } = useQuery({
    queryKey: ['workflows', workspaceId],
    queryFn: () => listWorkflows(workspaceId),
    enabled: !!workspaceId
  })

  // Fetch production runs for selected job
  const { data: productionRuns = [] } = useQuery({
    queryKey: ['jobRuns', workspaceId, selectedJob?.id],
    queryFn: () => listJobProductionRuns(workspaceId, selectedJob!.id),
    enabled: !!selectedJob?.id
  })

  // Fetch consumptions for selected job
  const { data: consumptions = [] } = useQuery({
    queryKey: ['jobConsumptions', workspaceId, selectedJob?.id],
    queryFn: () => listJobConsumptions(workspaceId, selectedJob!.id),
    enabled: !!selectedJob?.id
  })

  // Fetch workcenters
  const { data: workcenters = [] } = useQuery({
    queryKey: ['workcenters', workspaceId],
    queryFn: () => listWorkcenters(workspaceId),
    enabled: !!workspaceId
  })

  // Fetch products for stock checking and inventory posting
  const { data: products = [] } = useQuery({
    queryKey: ['products', workspaceId],
    queryFn: () => listProducts(workspaceId),
    enabled: !!workspaceId
  })

  // Mutations
  const statusMutation = useMutation({
    mutationFn: ({ jobId, status, blockReason }: { jobId: string; status: Job['status']; blockReason?: string }) =>
      setJobStatus(workspaceId, jobId, status, blockReason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs', workspaceId] })
      resetSelection()
    },
  })

  const consumptionMutation = useMutation({
    mutationFn: async (data: any) => {
      // Ensure itemId is set if we have SKU but no itemId
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
    onSuccess: async () => {
      // Wait a bit for Firestore to update
      await new Promise(resolve => setTimeout(resolve, 500))
      
      // Invalidate all relevant queries to ensure UI updates
      await queryClient.invalidateQueries({ queryKey: ['jobs', workspaceId] })
      await queryClient.invalidateQueries({ queryKey: ['job', workspaceId, selectedJob!.id] })
      await queryClient.invalidateQueries({ queryKey: ['jobConsumptions', workspaceId, selectedJob!.id] })
      
      // Force refetch jobs to get updated BOM
      const updatedJobs = await queryClient.fetchQuery({ 
        queryKey: ['jobs', workspaceId],
        queryFn: () => listJobs(workspaceId),
        staleTime: 0 // Force fresh data
      })
      
      // Refresh selected job data from the updated jobs list
      if (selectedJob) {
        const updatedJob = updatedJobs?.jobs?.find(j => j.id === selectedJob.id)
        if (updatedJob) {
          console.log('[ProductionScanner] Updating selectedJob with new BOM data:', {
            oldConsumed: selectedJob.bom?.[0]?.consumed,
            newConsumed: updatedJob.bom?.[0]?.consumed
          })
          setSelectedJob(updatedJob)
        } else {
          console.warn('[ProductionScanner] Could not find updated job in jobs list')
        }
      }
      
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
    onSuccess: (_, variables) => {
      const job = selectedJob
      queryClient.invalidateQueries({ queryKey: ['jobs', workspaceId] })
      queryClient.invalidateQueries({ queryKey: ['jobRuns', workspaceId, job!.id] })
      queryClient.invalidateQueries({ queryKey: ['allJobRuns', workspaceId] })
      
      // Show success message with details
      if (job) {
        try {
          const summary = calculateProductionSummary(job)
          const qtyGood = variables.qtyGood || 0
          // If saved in output UOM (cartoon), convert back for display
          const qtyGoodDisplay = summary.currentStageInputUOM === 'sheets' && summary.currentStageOutputUOM === 'cartoon' && summary.numberUp > 0
            ? `${(qtyGood / summary.numberUp).toLocaleString()} ${summary.currentStageInputUOM} (${qtyGood.toLocaleString()} ${summary.currentStageOutputUOM})`
            : `${qtyGood.toLocaleString()} ${summary.currentStageInputUOM || 'units'}`
          alert(`✓ Production record added successfully!\n\nGood Quantity: ${qtyGoodDisplay}`)
        } catch (e) {
          alert('✓ Production output recorded!')
        }
      } else {
        alert('✓ Production output recorded!')
      }
      
      setActiveAction(null)
      setActionData({})
    },
    onError: (error: any) => {
      alert(error?.message || 'Failed to record production output')
    }
  })

  const stockTxnMutation = useMutation({
    mutationFn: (data: any) => createStockTransaction({ ...data, workspaceId }),
    onSuccess: async (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['products', workspaceId] })

      // Refresh the selected product to show updated quantity
      if (selectedProduct && variables.productId) {
        try {
          const updatedProduct = await getProductByCode(workspaceId, selectedProduct.sku || selectedProduct.id)
          if (updatedProduct) {
            setSelectedProduct(updatedProduct)
          }
        } catch (e) {
          console.error('Failed to refresh product:', e)
        }
      }

      setActiveAction(null)
      setActionData({})
      alert('Stock transaction recorded!')
    },
  })

  const timeLogMutation = useMutation({
    mutationFn: (data: any) => createTimeLog(workspaceId, selectedJob!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs', workspaceId] })
    },
  })

  const moveStageMutation = useMutation({
    mutationFn: ({ jobId, newStageId, note }: { jobId: string; newStageId: string; note?: string }) =>
      moveJobToStage(workspaceId, jobId, newStageId, 'current-user', note),
    onSuccess: async () => {
      // Invalidate queries first
      await queryClient.invalidateQueries({ queryKey: ['jobs', workspaceId] })
      await queryClient.invalidateQueries({ queryKey: ['job', workspaceId, selectedJob?.id] })
      
      // Fetch fresh data and update selected job
      if (selectedJob) {
        try {
          const updatedJobs = await queryClient.fetchQuery({ 
            queryKey: ['jobs', workspaceId],
            queryFn: () => listJobs(workspaceId)
          })
          const updatedJob = updatedJobs?.jobs?.find(j => j.id === selectedJob.id)
          if (updatedJob) {
            setSelectedJob(updatedJob)
          }
        } catch (error) {
          console.error('Failed to refresh job after stage move:', error)
          // Fallback: try to find in current jobsData if available
          const updatedJob = jobsData?.jobs?.find(j => j.id === selectedJob.id)
          if (updatedJob) setSelectedJob(updatedJob)
        }
      }
    },
    onError: (error: any) => {
      alert(error?.message || 'Failed to move job to next stage')
    }
  })

  const handleScan = async (code: string) => {
    const trimmedCode = code.trim()
    
    // Prevent duplicate scans within 2 seconds
    const now = Date.now()
    if (lastScanTime > 0 && (now - lastScanTime) < 2000) {
      // Same code scanned too quickly, ignore
      const recentScan = recentScans[0]
      if (recentScan && recentScan.code === trimmedCode) {
        console.log('Duplicate scan ignored:', trimmedCode)
        return
      }
    }
    setLastScanTime(now)
    
    // Check workspaceId
    if (!workspaceId) {
      console.error('workspaceId is null or undefined')
      return
    }
    
    // Wait for jobs to load if still loading
    if (jobsLoading) {
      console.log('Jobs still loading, please wait...')
      return
    }

    // Check for errors
    if (jobsError) {
      console.error('Jobs query error:', jobsError)
      return
    }

    // 1. Check Jobs - case-insensitive search (by code, sku, or id)
    const jobs = jobsData?.jobs || []
    console.log('Scan attempt:', { 
      code: trimmedCode, 
      workspaceId,
      jobsCount: jobs.length,
      jobCodes: jobs.map(j => j.code || j.id).slice(0, 5)
    })
    
    const job = jobs.find(j => {
      const jobCode = (j.code || '').trim().toLowerCase()
      const jobSku = (j.sku || '').trim().toLowerCase()
      const jobId = (j.id || '').trim().toLowerCase()
      const searchCode = trimmedCode.toLowerCase()
      return jobCode === searchCode || jobSku === searchCode || jobId === searchCode
    })
    
    if (job) {
      console.log('Job found:', job.code || job.id)
      setSelectedJob(job)
      addToHistory(trimmedCode, 'job')
      setScanAttempts(0) // Reset scan attempts on success
      return
    }

    // 2. Check Products - try by SKU first, then ID
    try {
      const product = await getProductByCode(workspaceId, trimmedCode)
      if (product) {
        console.log('Product found:', product.sku || product.id)
        setSelectedProduct(product)
        addToHistory(trimmedCode, 'product')
        setScanAttempts(0) // Reset scan attempts on success
        return
      }
    } catch (e) {
      console.error('Product lookup failed', e)
    }

    // 3. Not Found - log but don't spam alerts
    console.log('Scan not found:', { 
      code: trimmedCode, 
      jobsCount: jobs.length,
      sampleJobCodes: jobs.map(j => j.code || j.id).slice(0, 3)
    })
    
    // Only show alert once per unique code
    const alreadyShown = recentScans.some(s => s.code === trimmedCode && s.type === 'none')
    if (!alreadyShown) {
      addToHistory(trimmedCode, 'none')
      // Don't show alert, just log - user will see it in the UI
    }
  }

  // Helper functions for job sheet
  const getStageName = (stageId: string | undefined, jobStatus?: Job['status']): string => {
    // If job is done, show "Completed" instead of the actual stage
    if (jobStatus === 'done') {
      return 'Completed'
    }
    if (!stageId) return 'Unassigned'
    for (const wf of workflows) {
      const stage = wf.stages?.find(s => s.id === stageId)
      if (stage) return stage.name
    }
    return stageId
  }

  const getNextStage = (job: Job): { id: string; name: string } | null => {
    if (!job.plannedStageIds || job.plannedStageIds.length === 0) return null
    const currentIndex = job.plannedStageIds.indexOf(job.currentStageId || '')
    if (currentIndex === -1 || currentIndex >= job.plannedStageIds.length - 1) return null
    const nextStageId = job.plannedStageIds[currentIndex + 1]
    const workflow = workflows.find(w => w.stages?.some(s => s.id === nextStageId))
    const nextStage = workflow?.stages?.find(s => s.id === nextStageId)
    if (!nextStage) return null
    return { id: nextStageId, name: nextStage.name }
  }

  const getStatusColor = (status: Job['status']): string => {
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

  const getPriorityColor = (priority: number): string => {
    if (priority <= 2) return 'text-red-600'
    if (priority === 3) return 'text-yellow-600'
    return 'text-green-600'
  }

  const calculateProgress = (job: Job): { produced: number; planned: number; percentage: number; uom: string } => {
    const outputItem = job.output?.[0]
    
    // Use job's output data if available (this is updated by createProductionRun)
    // Otherwise calculate from production runs
    let produced: number
    let planned: number
    let uom: string
    
    if (outputItem?.qtyProduced !== undefined && outputItem?.qtyPlanned !== undefined) {
      // Use job.output data - this is the most reliable as it's updated by the API
      produced = Number(outputItem.qtyProduced || 0)
      planned = Number(outputItem.qtyPlanned || 0)
      uom = outputItem.uom || job.unit || 'units'
    } else {
      // Fallback: calculate from production runs
      // Get the last stage (final output stage) to determine UOM
      const plannedStages = job.plannedStageIds || []
      const lastStageId = plannedStages.length > 0 ? plannedStages[plannedStages.length - 1] : job.currentStageId
      const lastStageInfo = getStageInfo(lastStageId)
      const finalOutputUOM = lastStageInfo?.outputUOM || outputItem?.uom || job.unit || 'sheets'
      const numberUp = job.productionSpecs?.numberUp || 1
      
      // Sum all production runs (they're already in their stage's output UOM)
      // For final output, we need runs from the last stage that outputs in final UOM
      const allRuns = productionRuns
      let totalProduced = 0
      
      // Find the last stage with the final output UOM
      for (let i = plannedStages.length - 1; i >= 0; i--) {
        const stageId = plannedStages[i]
        const stageInfo = getStageInfo(stageId)
        if (stageInfo?.outputUOM === finalOutputUOM) {
          // This is the final output stage, sum runs from this stage
          const stageRuns = allRuns.filter((r: any) => r.stageId === stageId)
          totalProduced = stageRuns.reduce((sum: number, r: any) => sum + Number(r.qtyGood || 0), 0)
          break
        }
      }
      
      // If no runs found in final stage, sum all runs (fallback)
      if (totalProduced === 0) {
        totalProduced = allRuns.reduce((sum: number, r: any) => sum + Number(r.qtyGood || 0), 0)
      }
      
      produced = totalProduced
      
      // Calculate planned
      if (finalOutputUOM === 'cartoon' || finalOutputUOM === 'box' || finalOutputUOM === 'boxes') {
        const boxQty = job.packaging?.plannedBoxes || 0
        const pcsPerBox = job.packaging?.pcsPerBox || 1
        planned = boxQty * pcsPerBox
        uom = 'cartoon'
      } else {
        const sheetItem = Array.isArray(job.bom) ? job.bom.find((item: any) => 
          ['sht', 'sheet', 'sheets'].includes(String(item.uom || '').toLowerCase())
        ) : null
        planned = sheetItem 
          ? Number(sheetItem.qtyRequired || 0) 
          : (outputItem?.qtyPlanned as number) || Number(job.quantity || 0)
        uom = finalOutputUOM
      }
    }

    // Calculate percentage
    const percentage = planned > 0 ? Math.min(100, (produced / planned) * 100) : 0
    
    return { 
      produced, 
      planned, 
      percentage,
      uom
    }
  }

  // Helper to get stage info
  const getStageInfo = (stageId: string | undefined) => {
    if (!stageId) return null
    for (const workflow of workflows) {
      const stage = workflow.stages?.find(s => s.id === stageId)
      if (stage) return stage
    }
    return null
  }

  // Calculate progress for each stage
  const calculateStageProgress = (job: Job, stageId: string) => {
    const stageInfo = getStageInfo(stageId)
    if (!stageInfo) return null

    const stageInputUOM = stageInfo.inputUOM || ''
    const stageOutputUOM = stageInfo.outputUOM || ''
    const numberUp = job.productionSpecs?.numberUp || 1

    // Get runs for this stage
    const stageRuns = productionRuns.filter((r: any) => r.stageId === stageId)
    const totalProduced = stageRuns.reduce((sum: number, r: any) => {
      // Production runs are stored in output UOM
      return sum + Number(r.qtyGood || 0)
    }, 0)

    // Calculate planned quantity for this stage
    const plannedStages = job.plannedStageIds || []
    const stageIndex = plannedStages.indexOf(stageId)
    const previousStageId = stageIndex > 0 ? plannedStages[stageIndex - 1] : null

    let plannedQty: number
    let plannedUOM: string = stageOutputUOM || stageInputUOM || 'sheets'

    if (previousStageId) {
      // Use previous stage's output as this stage's planned input
      const previousStageInfo = getStageInfo(previousStageId)
      const previousStageOutputUOM = previousStageInfo?.outputUOM || ''
      const previousStageRuns = productionRuns.filter((r: any) => r.stageId === previousStageId)
      const previousStageTotalOutput = previousStageRuns.reduce((sum: number, r: any) => {
        return sum + Number(r.qtyGood || 0)
      }, 0)

      if (previousStageTotalOutput > 0) {
        // Convert previous stage output to current stage input UOM
        if (previousStageOutputUOM === stageInputUOM) {
          plannedQty = previousStageTotalOutput
        } else if (previousStageOutputUOM === 'cartoon' && stageInputUOM === 'sheets' && numberUp > 0) {
          plannedQty = previousStageTotalOutput / numberUp
        } else if (previousStageOutputUOM === 'sheets' && stageInputUOM === 'cartoon' && numberUp > 0) {
          plannedQty = previousStageTotalOutput * numberUp
        } else {
          plannedQty = previousStageTotalOutput
        }

        // Convert current stage input to output UOM for display
        if (stageInputUOM === stageOutputUOM) {
          // No conversion needed
        } else if (stageInputUOM === 'sheets' && stageOutputUOM === 'cartoon' && numberUp > 0) {
          plannedQty = plannedQty * numberUp
          plannedUOM = 'cartoon'
        } else if (stageInputUOM === 'cartoon' && stageOutputUOM === 'sheets' && numberUp > 0) {
          plannedQty = plannedQty / numberUp
          plannedUOM = 'sheets'
        }
      } else {
        // No previous stage output, use original plan
        if (stageOutputUOM === 'cartoon') {
          const boxQty = job.packaging?.plannedBoxes || 0
          const pcsPerBox = job.packaging?.pcsPerBox || 1
          plannedQty = boxQty * pcsPerBox
          plannedUOM = 'cartoon'
        } else {
          const sheetItem = Array.isArray(job.bom) ? job.bom.find((item: any) => 
            ['sht', 'sheet', 'sheets'].includes(String(item.uom || '').toLowerCase())
          ) : null
          plannedQty = sheetItem ? Number(sheetItem.qtyRequired || 0) : (job.output?.[0]?.qtyPlanned as number) || Number(job.quantity || 0)
          plannedUOM = 'sheets'
        }
      }
    } else {
      // First stage - use original planned quantity
      if (stageOutputUOM === 'cartoon') {
        const boxQty = job.packaging?.plannedBoxes || 0
        const pcsPerBox = job.packaging?.pcsPerBox || 1
        plannedQty = boxQty * pcsPerBox
        plannedUOM = 'cartoon'
      } else {
        const sheetItem = Array.isArray(job.bom) ? job.bom.find((item: any) => 
          ['sht', 'sheet', 'sheets'].includes(String(item.uom || '').toLowerCase())
        ) : null
        plannedQty = sheetItem ? Number(sheetItem.qtyRequired || 0) : (job.output?.[0]?.qtyPlanned as number) || Number(job.quantity || 0)
        plannedUOM = 'sheets'
      }
    }

    const percentage = plannedQty > 0 ? Math.min(100, (totalProduced / plannedQty) * 100) : 0

    return {
      stageId,
      stageName: stageInfo.name,
      produced: totalProduced,
      planned: plannedQty,
      percentage,
      uom: plannedUOM,
      isCurrent: job.currentStageId === stageId
    }
  }

  // Calculate production summary for current stage
  const calculateProductionSummary = (job: Job) => {
    const currentStageInfo = getStageInfo(job.currentStageId)
    const currentStageInputUOM = currentStageInfo?.inputUOM || ''
    const currentStageOutputUOM = currentStageInfo?.outputUOM || ''
    const numberUp = job.productionSpecs?.numberUp || 1

    // Get current stage runs
    const currentStageRuns = productionRuns.filter((r: any) => r.stageId === job.currentStageId)
    const totalProducedInStage = currentStageRuns.reduce((sum: number, r: any) => {
      return sum + Number(r.qtyGood || 0)
    }, 0)

    // Calculate planned quantity
    let plannedQty: number
    let plannedUOM: string = currentStageOutputUOM || currentStageInputUOM || 'sheets'

    if (currentStageOutputUOM === 'cartoon') {
      const boxQty = job.packaging?.plannedBoxes || 0
      const pcsPerBox = job.packaging?.pcsPerBox || 1
      plannedQty = boxQty * pcsPerBox
    } else {
      const sheetItem = Array.isArray(job.bom) ? job.bom.find((item: any) => 
        ['sht', 'sheet', 'sheets'].includes(String(item.uom || '').toLowerCase())
      ) : null
      plannedQty = sheetItem ? Number(sheetItem.qtyRequired || 0) : (job.output?.[0]?.qtyPlanned as number) || Number(job.quantity || 0)
    }

    // Convert function
    const convertToOutputUOM = (qtyInInputUOM: number): number => {
      if (currentStageInputUOM === 'sheets' && currentStageOutputUOM === 'cartoon' && numberUp > 0) {
        return qtyInInputUOM * numberUp
      }
      return qtyInInputUOM
    }

    // Calculate threshold
    const WASTAGE_THRESHOLD_LOWER = 400 // Alt sınır: planned - 400
    const WASTAGE_THRESHOLD_UPPER = 500 // Üst sınır: planned + 500
    const completionThreshold = Math.max(0, plannedQty - WASTAGE_THRESHOLD_LOWER)
    const completionThresholdUpper = plannedQty + WASTAGE_THRESHOLD_UPPER

    return {
      currentStageInputUOM,
      currentStageOutputUOM,
      numberUp,
      totalProducedInStage,
      plannedQty,
      plannedUOM,
      completionThreshold,
      completionThresholdUpper,
      convertToOutputUOM
    }
  }

  const addToHistory = (code: string, type: ScannedType) => {
    setRecentScans(prev => [{ code, type, timestamp: new Date() }, ...prev.slice(0, 9)])
  }

  const resetSelection = () => {
    setSelectedJob(null)
    setSelectedProduct(null)
    setActiveAction(null)
    setActionData({})
  }

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (manualCode.trim()) {
      handleScan(manualCode.trim())
      setManualCode('')
    }
  }

  // Camera scanning effect
  useEffect(() => {
    if (scanMode !== 'camera' || !videoRef.current) {
      // Stop scanning if mode changed or video ref not available
      if (reader.current) {
        try {
          reader.current.reset()
        } catch (e) {
          // Ignore reset errors
        }
        reader.current = null
      }
      setIsScanning(false)
      setCameraError(null)
      return
    }

    // Check HTTPS requirement for camera access
    if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
      setCameraError('Camera access requires HTTPS. Please use a secure connection.')
      setIsScanning(false)
      return
    }

    // Initialize reader with hints for better small QR code detection
    // Import hints from @zxing/library if needed, but BrowserMultiFormatReader should handle it
    reader.current = new BrowserMultiFormatReader()
    
    // Reset scan tracking
    setScanAttempts(0)
    setLastScanTime(Date.now())
    
    const startScanning = async () => {
      try {
        setIsScanning(true)
        setCameraError(null)

        // First, request camera permission explicitly for mobile devices
        // Use higher resolution for better small QR code detection while maintaining performance
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
              facingMode: 'environment', // Prefer back camera on mobile
              width: { ideal: 1280, min: 640, max: 1920 }, // Higher resolution for small QR codes
              height: { ideal: 720, min: 480, max: 1080 },
              frameRate: { ideal: 30, max: 30 } // Limit frame rate for better performance
            } 
          })
          // Stop the stream immediately - we'll use the reader's stream
          stream.getTracks().forEach(track => track.stop())
        } catch (permissionError) {
          if (permissionError instanceof Error) {
            if (permissionError.name === 'NotAllowedError' || permissionError.name === 'PermissionDeniedError') {
              throw new Error('Camera permission denied. Please allow camera access in your browser settings and try again.')
            } else if (permissionError.name === 'NotFoundError' || permissionError.name === 'DevicesNotFoundError') {
              throw new Error('No camera found on this device.')
            } else if (permissionError.name === 'NotReadableError' || permissionError.name === 'TrackStartError') {
              throw new Error('Camera is already in use by another application.')
            }
          }
          throw permissionError
        }
        
        // Wait a bit for video element to be ready
        await new Promise(resolve => setTimeout(resolve, 100))
        
        // List available video input devices
        const devices = await BrowserMultiFormatReader.listVideoInputDevices()
        
        if (devices.length === 0) {
          throw new Error('No camera found. Please check your device permissions.')
        }

        // Prefer back camera on mobile (usually the last one), otherwise use first available
        let deviceId = devices[devices.length - 1]?.deviceId
        // Try to find back camera explicitly
        const backCamera = devices.find(d => 
          d.label.toLowerCase().includes('back') || 
          d.label.toLowerCase().includes('rear') ||
          d.label.toLowerCase().includes('environment') ||
          d.label.toLowerCase().includes('facing back')
        )
        if (backCamera) {
          deviceId = backCamera.deviceId
        } else if (devices.length > 1) {
          // On mobile, back camera is often the last device
          deviceId = devices[devices.length - 1].deviceId
        } else if (devices.length > 0) {
          deviceId = devices[0].deviceId
        }

        if (!deviceId || !videoRef.current) {
          throw new Error('Camera not available')
        }

        // Ensure video element has required attributes for mobile
        if (videoRef.current) {
          videoRef.current.setAttribute('playsinline', 'true')
          videoRef.current.setAttribute('webkit-playsinline', 'true')
          videoRef.current.muted = true
          videoRef.current.autoplay = true
        }

        // Start decoding from video device with enhanced detection for small QR codes
        await reader.current!.decodeFromVideoDevice(
          deviceId, 
          videoRef.current, 
          (result, err) => {
            if (result) {
              const scannedCode = result.getText().trim()
              
              // Prevent processing the same code multiple times
              if (lastScannedCode === scannedCode) {
                return // Ignore duplicate scans
              }
              
              setLastScannedCode(scannedCode)
              setScanAttempts(0) // Reset on success
              setLastScanTime(Date.now())
              handleScan(scannedCode)
              
              // Reset lastScannedCode after 3 seconds to allow re-scanning same code
              setTimeout(() => {
                setLastScannedCode(null)
              }, 3000)
            }
            if (err) {
              if (err instanceof Error && err.name === 'NotFoundException') {
                // NotFoundException is normal when no code is detected
                // Increment attempts for user feedback
                setScanAttempts(prev => prev + 1)
              } else {
                console.error('Scan error:', err)
              }
            }
          }
        )
      } catch (err) {
        let errorMessage = 'Failed to start camera'
        
        if (err instanceof Error) {
          if (err.message.includes('permission')) {
            errorMessage = err.message
          } else if (err.message.includes('No camera')) {
            errorMessage = err.message
          } else if (err.message.includes('already in use')) {
            errorMessage = err.message
          } else if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
            errorMessage = 'Camera permission denied. Please allow camera access in your browser settings.'
          } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
            errorMessage = 'No camera found on this device.'
          } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
            errorMessage = 'Camera is already in use. Please close other applications using the camera.'
          } else {
            errorMessage = err.message || errorMessage
          }
        }
        
        setCameraError(errorMessage)
        setIsScanning(false)
        console.error('Camera error:', err)
      }
    }

    startScanning()

    // Cleanup function
    return () => {
      if (reader.current) {
        try {
          reader.current.reset()
        } catch (e) {
          // Ignore reset errors
          console.warn('Error resetting scanner:', e)
        }
        reader.current = null
      }
      setIsScanning(false)
      setCameraError(null)
    }
  }, [scanMode]) // Re-run when scanMode changes

  // --- Render Helpers ---

  const renderHeader = () => (
    <div className="flex flex-col gap-4 px-5 sm:px-0 pt-4 sm:pt-0">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900">Scanner</h1>
          <p className="mt-1.5 text-xs sm:text-sm text-gray-500">
            Scan job codes or product SKUs
          </p>
        </div>
        {onClose && (
          <Button
            variant="secondary"
            size="sm"
            onClick={onClose}
            className="flex-shrink-0"
          >
            <XMarkIcon className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Close</span>
          </Button>
        )}
      </div>
    </div>
  )

  const renderScannerArea = () => (
    <Card className="p-5 sm:p-6 space-y-5">
      {/* Camera / Manual Toggle */}
      <div className="bg-gray-900 rounded-xl overflow-hidden shadow-inner aspect-[4/3] sm:aspect-[4/3] relative flex flex-col items-center justify-center text-white">
        {scanMode === 'camera' ? (
          <>
            {cameraError ? (
              <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center p-4 z-20">
                <ExclamationTriangleIcon className="h-12 w-12 text-red-500 mb-4" />
                <p className="text-sm text-red-300 text-center mb-2">{cameraError}</p>
                <button
                  onClick={async () => {
                    setCameraError(null)
                    // Try to restart camera
                    if (videoRef.current && reader.current) {
                      try {
                        reader.current.reset()
                        reader.current = null
                        // Wait a bit before restarting
                        await new Promise(resolve => setTimeout(resolve, 500))
                        setScanMode('manual')
                        setTimeout(() => setScanMode('camera'), 100)
                      } catch (e) {
                        console.error('Error restarting camera:', e)
                      }
                    }
                  }}
                  className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                >
                  Retry
                </button>
              </div>
            ) : (
              <>
                <video
                  ref={videoRef}
                  className="absolute inset-0 w-full h-full object-cover"
                  playsInline
                  muted
                  autoPlay
                  disablePictureInPicture
                  controls={false}
                />
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                  <div className={`w-[80%] max-w-[300px] aspect-square border-2 rounded-lg relative transition-all duration-300 ${
                    scanAttempts > 10 
                      ? 'border-yellow-400 shadow-lg shadow-yellow-400/50 animate-pulse' 
                      : 'border-white/70'
                  }`}>
                    <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-blue-500 -mt-1 -ml-1"></div>
                    <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-blue-500 -mt-1 -mr-1"></div>
                    <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-blue-500 -mb-1 -ml-1"></div>
                    <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-blue-500 -mb-1 -mr-1"></div>
                  </div>
                </div>
                
                {/* Scanning status and tips */}
                {isScanning && (
                  <div className="absolute bottom-3 sm:bottom-4 left-1/2 -translate-x-1/2 z-10 w-[calc(100%-3rem)] max-w-md px-3 sm:px-4">
                    {scanAttempts > 10 ? (
                      <div className="bg-yellow-500/90 backdrop-blur-sm px-3 sm:px-4 py-2 sm:py-3 rounded-lg shadow-lg">
                        <div className="flex items-start gap-2 sm:gap-3">
                          <InformationCircleIcon className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-900 flex-shrink-0 mt-0.5" />
                          <div className="flex-1 text-left min-w-0">
                            <p className="text-xs sm:text-sm font-medium text-yellow-900 mb-1">QR kod bulunamadı</p>
                            <ul className="text-[10px] sm:text-xs text-yellow-800 space-y-0.5 sm:space-y-1">
                              <li>• QR kodu kameraya daha yakın tutun</li>
                              <li>• Işığın yeterli olduğundan emin olun</li>
                              <li>• QR kodun tamamının görünür olduğundan emin olun</li>
                              <li>• Kamerayı sabit tutun</li>
                            </ul>
                            <button
                              onClick={() => setScanMode('manual')}
                              className="mt-1.5 sm:mt-2 text-[10px] sm:text-xs font-semibold text-yellow-900 underline hover:text-yellow-950 touch-target"
                            >
                              Manuel giriş yapmak için tıklayın
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : scanAttempts > 5 ? (
                      <div className="bg-orange-500/90 backdrop-blur-sm px-3 sm:px-4 py-2 rounded-lg shadow-lg">
                        <p className="text-[10px] sm:text-xs text-orange-900 text-center leading-tight">
                          QR kod aranıyor... Kamerayı sabit tutun ve QR kodu kare içine hizalayın
                        </p>
                      </div>
                    ) : (
                      <div className="bg-black/60 backdrop-blur-sm px-3 sm:px-4 py-2 rounded-full">
                        <p className="text-[10px] sm:text-xs text-white text-center">QR kod veya barkod okutun</p>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </>
        ) : (
          <div className="text-center p-6">
            <QrCodeIcon className="h-16 w-16 mx-auto text-gray-600 mb-2" />
            <p className="text-gray-400">Manual Entry Mode</p>
          </div>
        )}

        <button
          onClick={() => {
            // Stop camera if switching away
            if (scanMode === 'camera' && reader.current) {
              try {
                reader.current.reset()
              } catch (e) {
                console.warn('Error stopping camera:', e)
              }
              reader.current = null
            }
            setScanMode(prev => prev === 'camera' ? 'manual' : 'camera')
            setCameraError(null)
          }}
          className="absolute bottom-3 right-3 sm:bottom-4 sm:right-4 bg-white/10 backdrop-blur-md p-3 sm:p-2 rounded-full hover:bg-white/20 active:bg-white/30 z-20 touch-target"
          title={scanMode === 'camera' ? 'Switch to Manual Entry' : 'Switch to Camera'}
          aria-label={scanMode === 'camera' ? 'Switch to Manual Entry' : 'Switch to Camera'}
        >
          <ArrowPathIcon className="h-5 w-5 sm:h-5 sm:w-5" />
        </button>
      </div>

      {/* Manual Input */}
      <form onSubmit={handleManualSubmit} className="flex flex-col sm:flex-row gap-3 sm:gap-2">
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="absolute left-4 sm:left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={manualCode}
            onChange={e => setManualCode(e.target.value)}
            placeholder="Enter Job Code or SKU"
            className="w-full pl-12 pr-4 py-4 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none shadow-sm text-base sm:text-lg touch-target"
            autoComplete="off"
          />
        </div>
        <button
          type="submit"
          className="bg-blue-600 text-white px-8 py-4 sm:py-3 rounded-lg font-medium hover:bg-blue-700 active:bg-blue-800 shadow-sm active:transform active:scale-95 transition-all touch-target min-h-[48px] sm:min-h-0 text-base"
        >
          Scan
        </button>
      </form>
    </Card>
  )

  const renderRecentScans = () => (
    <Card>
      <div className="p-5 sm:p-6">
        <h3 className="text-xs sm:text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4 sm:mb-4">Recent Scans</h3>
        <div className="space-y-3 max-h-[300px] sm:max-h-none overflow-y-auto">
          {recentScans.length === 0 && (
            <p className="text-sm text-gray-400 italic text-center py-4">No recent scans</p>
          )}
          {recentScans.map((scan, i) => (
            <div
              key={i}
              onClick={() => scan.type !== 'none' && handleScan(scan.code)}
              className={`p-4 sm:p-3 rounded-lg border flex items-center justify-between shadow-sm transition-colors touch-target min-h-[64px] sm:min-h-0 ${
                scan.type === 'none' 
                  ? 'bg-red-50 border-red-200 cursor-default' 
                  : 'bg-gray-50 border-gray-200 active:bg-gray-100 cursor-pointer'
              }`}
            >
            <div className="flex items-center space-x-2 sm:space-x-3 flex-1 min-w-0">
              <div className={`p-2 rounded-full flex-shrink-0 ${
                scan.type === 'job' 
                  ? 'bg-blue-100 text-blue-600' 
                  : scan.type === 'product'
                  ? 'bg-green-100 text-green-600'
                  : 'bg-red-100 text-red-600'
              }`}>
                {scan.type === 'job' ? (
                  <ClockIcon className="h-4 w-4" />
                ) : scan.type === 'product' ? (
                  <CubeIcon className="h-4 w-4" />
                ) : (
                  <ExclamationTriangleIcon className="h-4 w-4" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 text-sm sm:text-base truncate">{scan.code}</p>
                <p className={`text-xs capitalize ${
                  scan.type === 'none' ? 'text-red-600' : 'text-gray-500'
                }`}>
                  {scan.type === 'none' ? 'Not Found' : scan.type} • {scan.timestamp.toLocaleTimeString()}
                </p>
              </div>
            </div>
            {scan.type !== 'none' && <ArrowPathIcon className="h-4 w-4 text-gray-400 flex-shrink-0 ml-2" />}
          </div>
        ))}
        </div>
      </div>
    </Card>
  )

  // --- Job Action Sheet ---
  const renderJobSheet = () => {
    if (!selectedJob) return null

    const progress = calculateProgress(selectedJob)
    const nextStage = getNextStage(selectedJob)
    const currentStageName = getStageName(selectedJob.currentStageId, selectedJob.status)
    const isBlocked = selectedJob.status === 'blocked'
    const isReleased = selectedJob.status === 'released'
    const isInProgress = selectedJob.status === 'in_progress'
    const isDone = selectedJob.status === 'done'

    return (
      <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center pointer-events-none">
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm pointer-events-auto" onClick={resetSelection} />
        <div className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-2xl shadow-2xl pointer-events-auto max-h-[95vh] sm:max-h-[90vh] overflow-y-auto flex flex-col relative z-10">
          {/* Handle bar for mobile */}
          <div className="w-full flex justify-center pt-3 pb-2 sm:hidden sticky top-0 bg-white z-10">
            <div className="w-12 h-1.5 bg-gray-300 rounded-full" />
          </div>

          <div className="p-4 sm:p-5 border-b border-gray-100">
            <div className="flex justify-between items-start">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    JOB
                  </span>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(selectedJob.status)}`}>
                    {selectedJob.status.replace('_', ' ').toUpperCase()}
                  </span>
                  {selectedJob.priority && (
                    <span className={`text-xs font-semibold ${getPriorityColor(selectedJob.priority)}`}>
                      Priority {selectedJob.priority}
                    </span>
                  )}
                </div>
                <h2 className="text-lg sm:text-xl font-bold text-gray-900 truncate">{selectedJob.code}</h2>
                <p className="text-xs sm:text-sm text-gray-500 truncate">{selectedJob.productName}</p>
              </div>
              <button onClick={resetSelection} className="p-2 bg-gray-100 rounded-full active:bg-gray-200 hover:bg-gray-200 flex-shrink-0 ml-2 touch-target">
                <XMarkIcon className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            {/* Job Info Grid */}
            <div className="grid grid-cols-2 gap-2 sm:gap-3 mt-3 sm:mt-4">
              <div className="bg-gray-50 p-2.5 sm:p-3 rounded-lg">
                <p className="text-[10px] sm:text-xs text-gray-500 mb-1">Quantity</p>
                <p className="font-semibold text-gray-900 text-sm sm:text-base">{selectedJob.quantity} {selectedJob.unit}</p>
              </div>
              <div className="bg-gray-50 p-2.5 sm:p-3 rounded-lg">
                <p className="text-[10px] sm:text-xs text-gray-500 mb-1">Current Stage</p>
                <p className="font-semibold text-gray-900 truncate text-sm sm:text-base">{currentStageName}</p>
              </div>
            </div>

            {/* Customer & Due Date */}
            <div className="grid grid-cols-2 gap-2 sm:gap-3 mt-2 sm:mt-3">
              {selectedJob.customer && (
                <div className="bg-blue-50 p-2.5 sm:p-3 rounded-lg border border-blue-100">
                  <div className="flex items-center gap-1 mb-1">
                    <BuildingStorefrontIcon className="h-3 w-3 text-blue-600" />
                    <p className="text-[10px] sm:text-xs text-blue-600 font-medium">Customer</p>
                  </div>
                  <p className="font-semibold text-blue-900 truncate text-sm sm:text-base">{selectedJob.customer.name}</p>
                  {selectedJob.customer.orderNo && (
                    <p className="text-[10px] sm:text-xs text-blue-600 mt-0.5 truncate">Order: {selectedJob.customer.orderNo}</p>
                  )}
                </div>
              )}
              {selectedJob.dueDate && (
                <div className="bg-orange-50 p-2.5 sm:p-3 rounded-lg border border-orange-100">
                  <div className="flex items-center gap-1 mb-1">
                    <CalendarIcon className="h-3 w-3 text-orange-600" />
                    <p className="text-[10px] sm:text-xs text-orange-600 font-medium">Due Date</p>
                  </div>
                  <p className="font-semibold text-orange-900 text-sm sm:text-base">
                    {new Date(selectedJob.dueDate.seconds ? selectedJob.dueDate.seconds * 1000 : selectedJob.dueDate).toLocaleDateString()}
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

              const stageProgresses = plannedStages
                .map(stageId => calculateStageProgress(selectedJob, stageId))
                .filter((p): p is NonNullable<typeof p> => p !== null)

              return (
                <div className="mt-4 space-y-3">
                  <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Stage Progress</h4>
                  {stageProgresses.map((stageProgress) => (
                    <div key={stageProgress.stageId} className="space-y-1">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-medium ${stageProgress.isCurrent ? 'text-blue-600' : 'text-gray-600'}`}>
                            {stageProgress.stageName}
                            {stageProgress.isCurrent && (
                              <span className="ml-1 text-blue-600">(Current)</span>
                            )}
                          </span>
                        </div>
                        <span className="text-xs font-semibold text-gray-900">
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
                      <p className="text-xs text-gray-500">
                        {stageProgress.percentage.toFixed(1)}% complete
                        {stageProgress.isCurrent && stageProgress.percentage < 100 && (
                          <span className="ml-2 text-orange-600">• In Progress</span>
                        )}
                      </p>
                    </div>
                  ))}
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
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <p className="text-gray-500">Production Runs</p>
                  <p className="font-semibold text-gray-900">{productionRuns.length}</p>
                </div>
                <div>
                  <p className="text-gray-500">Consumptions</p>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-gray-900">{consumptions.length}</p>
                    <button
                      onClick={async () => {
                        if (!selectedJob) return
                        try {
                          await recalculateJobBomConsumption(workspaceId, selectedJob.id)
                          await queryClient.invalidateQueries({ queryKey: ['jobs', workspaceId] })
                          // Refresh selected job
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
                      className="text-xs text-blue-600 hover:text-blue-800 underline"
                      title="Manually recalculate BOM consumed values"
                    >
                      🔄 Recalc
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="p-4 sm:p-5 space-y-3">
            {!activeAction ? (
              <>
                {/* Status Management Buttons */}
                {!isDone && (
                  <div className="space-y-2">
                    {!isReleased && !isInProgress && (
                      <button
                        onClick={() => {
                          if (confirm('Release this job to start production?')) {
                            statusMutation.mutate({ jobId: selectedJob.id, status: 'released' })
                          }
                        }}
                        className="w-full py-3.5 sm:py-3 bg-blue-600 text-white rounded-xl font-semibold shadow-sm active:bg-blue-800 hover:bg-blue-700 flex items-center justify-center space-x-2 touch-target min-h-[48px]"
                      >
                        <PlayIcon className="h-5 w-5" />
                        <span className="text-base sm:text-base">Release Job</span>
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
                            notes: 'Job started via scanner'
                          })
                        }}
                        className="w-full py-3.5 sm:py-3 bg-green-600 text-white rounded-xl font-semibold shadow-sm active:bg-green-800 hover:bg-green-700 flex items-center justify-center space-x-2 touch-target min-h-[48px]"
                      >
                        <PlayIcon className="h-5 w-5" />
                        <span className="text-base sm:text-base">Start Production</span>
                      </button>
                    )}

                    {isInProgress && !isBlocked && (
                      <button
                        onClick={() => {
                          const reason = prompt('Enter block reason (e.g., "Material shortage", "Machine breakdown", "Quality issue", "Waiting for approval"):')
                          if (reason && reason.trim()) {
                            statusMutation.mutate({ jobId: selectedJob.id, status: 'blocked', blockReason: reason.trim() })
                          } else if (reason !== null) {
                            alert('Please enter a block reason to continue.')
                          }
                        }}
                        className="w-full py-3.5 sm:py-3 bg-red-600 text-white rounded-xl font-semibold shadow-sm active:bg-red-800 hover:bg-red-700 flex items-center justify-center space-x-2 touch-target min-h-[48px]"
                        title="Temporarily stop production for this job (e.g., material shortage, machine issue, quality problem)"
                      >
                        <PauseIcon className="h-5 w-5" />
                        <span className="text-base sm:text-base">Block Job</span>
                      </button>
                    )}

                    {isBlocked && (
                      <button
                        onClick={() => {
                          statusMutation.mutate({ jobId: selectedJob.id, status: 'in_progress' })
                        }}
                        className="w-full py-3.5 sm:py-3 bg-green-600 text-white rounded-xl font-semibold shadow-sm active:bg-green-800 hover:bg-green-700 flex items-center justify-center space-x-2 touch-target min-h-[48px]"
                      >
                        <PlayIcon className="h-5 w-5" />
                        <span className="text-base sm:text-base">Resume Job</span>
                      </button>
                    )}
                  </div>
                )}

                {/* Next Stage Button */}
                {nextStage && (isInProgress || isReleased) && !isBlocked && (() => {
                  // Calculate threshold for current stage
                  const currentStageSummary = calculateProductionSummary(selectedJob)
                  const {
                    totalProducedInStage,
                    plannedQty,
                    completionThreshold,
                    currentStageOutputUOM
                  } = currentStageSummary
                  
                  const isIncomplete = plannedQty > 0 && totalProducedInStage < completionThreshold
                  const thresholdAlreadyMet = plannedQty > 0 && totalProducedInStage >= completionThreshold
                  const requireOutput = (selectedJob as any).requireOutputToAdvance !== false
                  
                  return (
                    <button
                      onClick={() => {
                        // Check threshold requirements
                        if (requireOutput && isIncomplete) {
                          alert(`⚠️ Cannot proceed: Production quantity below required threshold.\n\nRequired: ${completionThreshold.toLocaleString()}+ ${currentStageOutputUOM || 'sheets'}\nCurrent: ${totalProducedInStage.toLocaleString()} ${currentStageOutputUOM || 'sheets'}\n\nPlease complete production before moving to next stage.`)
                          return
                        }
                        
                        if (confirm(`Move job from ${currentStageName} to ${nextStage.name}?`)) {
                          moveStageMutation.mutate({ jobId: selectedJob.id, newStageId: nextStage.id })
                        }
                      }}
                      disabled={moveStageMutation.isPending || (requireOutput && isIncomplete)}
                      className={`w-full py-3.5 sm:py-3 rounded-xl font-semibold shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 transition-colors touch-target min-h-[48px] sm:min-h-0 ${
                        requireOutput && isIncomplete
                          ? 'bg-gray-400 text-white cursor-not-allowed'
                          : 'bg-purple-600 text-white active:bg-purple-800 hover:bg-purple-700'
                      }`}
                      title={
                        requireOutput && isIncomplete
                          ? `Threshold not met. Required: ${completionThreshold.toLocaleString()}+ ${currentStageOutputUOM || 'sheets'}`
                          : undefined
                      }
                    >
                      <ArrowRightIcon className="h-5 w-5" />
                      <span className="text-base sm:text-base">Move to {nextStage.name}</span>
                    </button>
                  )
                })()}

                {/* Production Actions */}
                {isInProgress && !isBlocked && (
                  <div className="grid grid-cols-2 gap-2 sm:gap-3">
                    <button
                      onClick={() => setActiveAction('consume')}
                      className="py-4 sm:py-4 bg-white border-2 border-gray-200 text-gray-700 rounded-xl font-semibold active:bg-gray-100 hover:bg-gray-50 flex flex-col items-center justify-center space-y-1 touch-target min-h-[100px] sm:min-h-0"
                    >
                      <CubeIcon className="h-6 w-6 sm:h-6 sm:w-6 text-orange-500" />
                      <span className="text-xs sm:text-sm">Consume Material</span>
                    </button>
                    <button
                      onClick={() => setActiveAction('produce')}
                      className="py-4 sm:py-4 bg-white border-2 border-gray-200 text-gray-700 rounded-xl font-semibold active:bg-gray-100 hover:bg-gray-50 flex flex-col items-center justify-center space-y-1 touch-target min-h-[100px] sm:min-h-0"
                    >
                      <CheckCircleIcon className="h-6 w-6 sm:h-6 sm:w-6 text-blue-500" />
                      <span className="text-xs sm:text-sm">Record Output</span>
                    </button>
                  </div>
                )}

                {/* Complete Job Button */}
                {isInProgress && !isBlocked && (() => {
                  // Check if we're on the last stage
                  const planned: string[] = (selectedJob as any).plannedStageIds || []
                  const workflow = workflows.find(w => w.id === selectedJob.workflowId)
                  const allStages = workflow?.stages || []
                  const isLastStage = planned.length > 0
                    ? planned[planned.length - 1] === selectedJob.currentStageId
                    : (allStages.length > 0 && allStages[allStages.length - 1]?.id === selectedJob.currentStageId)
                  
                  // Calculate threshold for current stage
                  const currentStageSummary = calculateProductionSummary(selectedJob)
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
                  
                  // Check if can complete
                  const canComplete = isLastStage && (!requireOutput || thresholdMet)
                  
                  if (!canComplete) return null
                  
                  return (
                    <button
                      onClick={() => {
                        // Final validation
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
                        
                        // Ask if user wants to post to inventory first
                        setShowInventoryPostingModal(true)
                      }}
                      disabled={requireOutput && (isIncomplete || isOverLimit)}
                      className={`w-full py-3 rounded-xl font-semibold shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 transition-colors ${
                        requireOutput && (isIncomplete || isOverLimit)
                          ? 'bg-gray-400 text-white cursor-not-allowed'
                          : 'bg-emerald-600 text-white hover:bg-emerald-700'
                      }`}
                      title={
                        requireOutput && isIncomplete
                          ? `Threshold not met. Required: ${completionThreshold.toLocaleString()}+ ${currentStageOutputUOM || 'sheets'}`
                          : requireOutput && isOverLimit
                            ? `Over limit. Maximum: ${completionThresholdUpper.toLocaleString()} ${currentStageOutputUOM || 'sheets'}`
                            : !isLastStage
                              ? 'Job must be at the last stage to complete'
                              : undefined
                      }
                    >
                      <CheckCircleIcon className="h-5 w-5" />
                      <span>Complete Job</span>
                    </button>
                  )
                })()}

                {/* View Details Button */}
                <button
                  onClick={() => {
                    window.location.href = `/production?jobId=${selectedJob.id}`
                  }}
                  className="w-full py-3 sm:py-2.5 bg-gray-50 border border-gray-200 text-gray-700 rounded-xl font-medium active:bg-gray-200 hover:bg-gray-100 flex items-center justify-center space-x-2 text-sm touch-target min-h-[44px] sm:min-h-0"
                >
                  <InformationCircleIcon className="h-4 w-4" />
                  <span>View Full Details</span>
                </button>
              </>
            ) : (
              renderJobActionForm()
            )}
          </div>
        </div>
      </div>
    )
  }

  const renderJobActionForm = () => {
    if (activeAction === 'consume') {
      const bomItems = selectedJob?.bom || []
      const selectedBomItem = bomItems.find(item => item.sku === actionData.sku)
      const remainingRequired = selectedBomItem 
        ? Math.max(0, selectedBomItem.qtyRequired - (selectedBomItem.consumed || 0))
        : null

      // Find product for stock check
      const selectedProduct = actionData.itemId 
        ? products.find(p => p.id === actionData.itemId)
        : actionData.sku 
          ? products.find(p => p.sku === actionData.sku)
          : null
      
      const availableStock = selectedProduct ? (selectedProduct.qtyOnHand || 0) : null
      const requestedQty = Number(actionData.qtyUsed) || 0
      const isInsufficientStock = availableStock !== null && requestedQty > availableStock

      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 text-base sm:text-base">Record Consumption</h3>
            <button onClick={() => { setActiveAction(null); setActionData({}) }} className="text-gray-400 active:text-gray-600 hover:text-gray-600 p-2 -mr-2 touch-target">
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
          
          {/* BOM Material Selector */}
          {bomItems.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Select Material from BOM
              </label>
              <select
                className="w-full p-3.5 sm:p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-white text-base touch-target"
                value={actionData.bomItemIndex !== undefined ? String(actionData.bomItemIndex) : ''}
                onChange={async (e) => {
                  const index = e.target.value === '' ? undefined : Number(e.target.value)
                  if (index !== undefined && bomItems[index]) {
                    const item = bomItems[index]
                    // Try to find product by SKU to get itemId and stock info
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
                      // Try to get product by itemId to check stock
                      try {
                        const prod = products.find(p => p.id === itemId)
                        if (prod) product = prod
                      } catch (err) {
                        // Ignore
                      }
                    }
                    
                    const remainingQty = Math.max(0, item.qtyRequired - (item.consumed || 0))
                    const availableQty = product ? (product.qtyOnHand || 0) : null
                    // Default to remaining required, but don't exceed available stock
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
                  const status = remaining === 0 ? '✓ Complete' : remaining < item.qtyRequired ? '⚠ Partial' : ''
                  return (
                    <option key={index} value={String(index)}>
                      {item.name || item.sku} ({item.sku}) - Required: {item.qtyRequired} {item.uom} 
                      {consumed > 0 && ` | Consumed: ${consumed} ${item.uom}`}
                      {remaining > 0 && ` | Remaining: ${remaining} ${item.uom}`}
                      {status && ` [${status}]`}
                    </option>
                  )
                })}
              </select>
              {selectedBomItem && remainingRequired !== null && (
                <p className="mt-1 text-xs text-gray-600">
                  Required: {selectedBomItem.qtyRequired.toLocaleString()} {selectedBomItem.uom} | 
                  Consumed: {(selectedBomItem.consumed || 0).toLocaleString()} {selectedBomItem.uom} | 
                  Remaining: {remainingRequired.toLocaleString()} {selectedBomItem.uom}
                  {availableStock !== null && (
                    <span className={availableStock < remainingRequired ? ' text-red-600 font-semibold' : ' text-green-600'}>
                      {' | '}Stock: {availableStock.toLocaleString()} {selectedBomItem.uom}
                    </span>
                  )}
                </p>
              )}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              SKU / Material Code {actionData.bomItemIndex === undefined ? '*' : ''}
            </label>
            <input
              placeholder="Enter SKU or scan material"
              className="w-full p-3.5 sm:p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-base touch-target"
              value={actionData.sku || ''}
              onChange={e => {
                setActionData({ 
                  ...actionData, 
                  sku: e.target.value,
                  bomItemIndex: undefined // Clear BOM selection if manually entering
                })
              }}
              autoFocus={actionData.bomItemIndex === undefined}
            />
            {actionData.bomItemIndex !== undefined && (
              <p className="mt-1 text-xs text-gray-500 italic">From BOM: {actionData.name || actionData.sku}</p>
            )}
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Quantity *</label>
              <input
                type="number"
                step="0.01"
                placeholder={selectedBomItem ? `${remainingRequired?.toLocaleString() || 0}` : "0.00"}
                className="w-full p-3.5 sm:p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-base touch-target"
                value={actionData.qtyUsed || ''}
                onChange={e => setActionData({ ...actionData, qtyUsed: Number(e.target.value) })}
              />
              {selectedBomItem && remainingRequired !== null && (
                <p className="mt-1 text-xs text-gray-500">
                  Suggested: {remainingRequired.toLocaleString()} {selectedBomItem.uom} (remaining required)
                </p>
              )}
              {availableStock !== null && (
                <p className={`mt-1 text-xs font-medium ${isInsufficientStock ? 'text-red-600' : 'text-gray-600'}`}>
                  Available Stock: {availableStock.toLocaleString()} {actionData.uom || 'units'}
                  {isInsufficientStock && (
                    <span className="ml-2">⚠️ Insufficient stock!</span>
                  )}
                </p>
              )}
              {actionData.sku && !selectedProduct && (
                <p className="mt-1 text-xs text-yellow-600">
                  ⚠️ Product not found in inventory. Stock check unavailable.
                </p>
              )}
            </div>
            <div className="w-full sm:w-24">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">UOM</label>
              <input
                placeholder="UOM"
                className="w-full p-3.5 sm:p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-base touch-target"
                value={actionData.uom || ''}
                onChange={e => setActionData({ ...actionData, uom: e.target.value })}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Notes (Optional)</label>
            <input
              placeholder="Additional notes"
              className="w-full p-3.5 sm:p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-base touch-target"
              value={actionData.notes || ''}
              onChange={e => setActionData({ ...actionData, notes: e.target.value })}
            />
          </div>
          <div className="flex gap-2 pt-2">
            <button
              onClick={() => { setActiveAction(null); setActionData({}) }}
              className="flex-1 py-3 bg-gray-100 rounded-lg font-medium hover:bg-gray-200 transition-colors"
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
                      const confirm = window.confirm(
                        `⚠️ Insufficient Stock!\n\n` +
                        `Requested: ${requestedQty.toLocaleString()} ${actionData.uom || 'units'}\n` +
                        `Available: ${currentStock.toLocaleString()} ${actionData.uom || 'units'}\n` +
                        `Shortage: ${(requestedQty - currentStock).toLocaleString()} ${actionData.uom || 'units'}\n\n` +
                        `Do you want to proceed anyway?`
                      )
                      if (!confirm) return
                    }
                  } catch (err) {
                    console.warn('Stock check failed:', err)
                    // Continue anyway if stock check fails
                  }
                }

                // Ensure name is set for proper matching
                const consumptionData = {
                  ...actionData,
                  name: actionData.name || actionData.sku || '', // Ensure name is set
                  stageId: selectedJob?.currentStageId,
                  userId: 'current-user',
                  approved: true
                }
                console.log('[ProductionScanner] Creating consumption:', consumptionData)
                consumptionMutation.mutate(consumptionData)
              }}
              disabled={consumptionMutation.isPending || !actionData.sku || !actionData.qtyUsed}
              className={`flex-1 py-3.5 sm:py-3 rounded-lg font-medium transition-colors touch-target min-h-[48px] sm:min-h-0 text-base disabled:opacity-50 disabled:cursor-not-allowed ${
                isInsufficientStock 
                  ? 'bg-red-600 text-white hover:bg-red-700' 
                  : 'bg-orange-600 text-white hover:bg-orange-700'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {consumptionMutation.isPending ? 'Recording...' : isInsufficientStock ? '⚠️ Confirm (Low Stock)' : 'Confirm'}
            </button>
          </div>
        </div>
      )
    }
    if (activeAction === 'produce') {
      if (!selectedJob) return null

      const summary = calculateProductionSummary(selectedJob)
      const {
        currentStageInputUOM,
        currentStageOutputUOM,
        numberUp,
        totalProducedInStage,
        plannedQty,
        plannedUOM,
        completionThreshold,
        completionThresholdUpper,
        convertToOutputUOM
      } = summary

      const qtyGood = actionData.qtyGood || 0
      const qtyScrap = actionData.qtyScrap || 0
      const thisEntryInOutputUOM = convertToOutputUOM(qtyGood)
      const totalAfterThisEntry = totalProducedInStage + thisEntryInOutputUOM
      const remaining = plannedQty - totalAfterThisEntry
      const isIncomplete = plannedQty > 0 && totalAfterThisEntry < completionThreshold
      const isOverLimit = plannedQty > 0 && totalAfterThisEntry > completionThresholdUpper

      // Initialize runDateTime if not set
      if (!actionData.runDateTime) {
        const now = new Date()
        const off = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
        setActionData({ ...actionData, runDateTime: off.toISOString().slice(0, 16) })
      }

      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 text-base sm:text-base">Record Production Output</h3>
            <button onClick={() => { setActiveAction(null); setActionData({}) }} className="text-gray-400 active:text-gray-600 hover:text-gray-600 p-2 -mr-2 touch-target">
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>

          {/* Production Summary */}
          {plannedQty > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <p className="text-xs font-medium text-blue-800">Production Summary</p>
              </div>
              <div className="bg-white rounded border border-gray-200 p-2 text-xs">
                <div className="grid grid-cols-3 gap-2 mb-2">
                  <div>
                    <span className="text-gray-600">Planned:</span>
                    <div className="font-medium">{plannedQty.toLocaleString()} {plannedUOM}</div>
                  </div>
                  <div>
                    <span className="text-gray-600">Produced:</span>
                    <div className="font-medium">
                      {totalProducedInStage.toLocaleString()} {currentStageOutputUOM || 'sheets'}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-600">Remaining:</span>
                    <div className="font-medium">
                      {Math.max(0, remaining).toLocaleString()} {currentStageOutputUOM || 'sheets'}
                    </div>
                  </div>
                </div>
                {isIncomplete && (
                  <div className="text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                    <span className="font-medium">Incomplete:</span> {completionThreshold.toLocaleString()}+ {currentStageOutputUOM || 'sheets'} required
                  </div>
                )}
                {isOverLimit && (
                  <div className="text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1">
                    <span className="font-medium">⚠️ Over Limit:</span> Maximum {completionThresholdUpper.toLocaleString()} {currentStageOutputUOM || 'sheets'} allowed (planned: {plannedQty.toLocaleString()} + tolerance: 500)
                  </div>
                )}
                {!isIncomplete && !isOverLimit && totalAfterThisEntry > 0 && (
                  <div className="text-green-700 bg-green-50 border border-green-200 rounded px-2 py-1">
                    <span className="font-medium">✓ Within acceptable range:</span> {completionThreshold.toLocaleString()} - {completionThresholdUpper.toLocaleString()} {currentStageOutputUOM || 'sheets'}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Stage Info */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Stage</label>
            <p className="text-sm text-gray-600 bg-gray-50 p-2 rounded-lg">{getStageName(selectedJob?.currentStageId, selectedJob?.status)}</p>
          </div>

          {/* Input Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs sm:text-xs font-medium text-gray-700 mb-1.5">
                Good Qty ({currentStageInputUOM || 'sheets'})
                {currentStageInputUOM && currentStageOutputUOM && currentStageInputUOM !== currentStageOutputUOM && numberUp > 0 && (
                  <span className="text-xs text-gray-500 ml-1 block">
                    → {convertToOutputUOM(qtyGood || 0).toFixed(2)} {currentStageOutputUOM}
                  </span>
                )}
              </label>
              <input
                type="number"
                min={0}
                step="0.01"
                placeholder="0.00"
                className="w-full p-3.5 sm:p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base touch-target"
                value={qtyGood || ''}
                onChange={e => setActionData({ ...actionData, qtyGood: Number(e.target.value) })}
                autoFocus
              />
            </div>
            <div>
              <label className="block text-xs sm:text-xs font-medium text-gray-700 mb-1.5">
                Scrap Qty ({currentStageInputUOM || 'sheets'})
              </label>
              <input
                type="number"
                min={0}
                step="0.01"
                placeholder="0.00"
                className="w-full p-3.5 sm:p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base touch-target"
                value={qtyScrap || ''}
                onChange={e => setActionData({ ...actionData, qtyScrap: Number(e.target.value) })}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs sm:text-xs font-medium text-gray-700 mb-1.5">Date & Time</label>
              <input
                type="datetime-local"
                value={actionData.runDateTime || ''}
                onChange={e => setActionData({ ...actionData, runDateTime: e.target.value })}
                className="w-full p-3.5 sm:p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base touch-target"
              />
            </div>
            <div>
              <label className="block text-xs sm:text-xs font-medium text-gray-700 mb-1.5">Workcenter</label>
              <select
                value={actionData.workcenterId || selectedJob?.workcenterId || ''}
                onChange={e => setActionData({ ...actionData, workcenterId: e.target.value || undefined })}
                className="w-full p-3.5 sm:p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base touch-target bg-white"
              >
                <option value="">Unspecified</option>
                {workcenters.map(w => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs sm:text-xs font-medium text-gray-700 mb-1.5">Lot Number</label>
            <input
              type="text"
              placeholder="Optional"
              className="w-full p-3.5 sm:p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base touch-target"
              value={actionData.lot || ''}
              onChange={e => setActionData({ ...actionData, lot: e.target.value })}
            />
          </div>

          {/* Conversion Info */}
          {currentStageInputUOM && currentStageOutputUOM && currentStageInputUOM !== currentStageOutputUOM && numberUp > 0 && (
            <div className="p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-800">
              <span className="font-semibold">Conversion:</span> {currentStageInputUOM} → {currentStageOutputUOM} (Number Up: {numberUp})
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-xs sm:text-xs font-medium text-gray-700 mb-1.5">Notes (Optional)</label>
            <textarea
              placeholder="Add a reason or note for this action..."
              rows={2}
              className="w-full p-3.5 sm:p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none text-base touch-target"
              value={actionData.notes || ''}
              onChange={e => setActionData({ ...actionData, notes: e.target.value })}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            <button
              onClick={() => { setActiveAction(null); setActionData({}) }}
              className="flex-1 py-3.5 sm:py-3 bg-gray-100 rounded-lg font-medium active:bg-gray-300 hover:bg-gray-200 transition-colors touch-target min-h-[48px] sm:min-h-0 text-base"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                if (!qtyGood || qtyGood <= 0) {
                  alert('Please enter Good Quantity to add production record.')
                  return
                }

                // Check upper limit
                if (isOverLimit) {
                  alert(`⚠️ Cannot add record: Production quantity exceeds maximum limit.\n\nPlanned: ${plannedQty.toLocaleString()} ${currentStageOutputUOM || 'sheets'}\nMaximum Allowed: ${completionThresholdUpper.toLocaleString()} ${currentStageOutputUOM || 'sheets'} (planned + 500 tolerance)\nCurrent Total After Entry: ${totalAfterThisEntry.toLocaleString()} ${currentStageOutputUOM || 'sheets'}\n\nPlease reduce the quantity or contact supervisor.`)
                  return
                }

                // Convert to output UOM if needed
                const qtyGoodToSave = currentStageInputUOM === 'sheets' && currentStageOutputUOM === 'cartoon' && numberUp > 0
                  ? convertToOutputUOM(qtyGood)
                  : qtyGood
                const qtyScrapToSave = currentStageInputUOM === 'sheets' && currentStageOutputUOM === 'cartoon' && numberUp > 0 && qtyScrap > 0
                  ? convertToOutputUOM(qtyScrap)
                  : qtyScrap

                productionMutation.mutate({
                  qtyGood: qtyGoodToSave,
                  qtyScrap: qtyScrapToSave || undefined,
                  lot: actionData.lot || undefined,
                  stageId: selectedJob?.currentStageId,
                  workcenterId: actionData.workcenterId || selectedJob?.workcenterId,
                  operatorId: 'current-user',
                  at: actionData.runDateTime ? new Date(actionData.runDateTime) : undefined,
                  notes: actionData.notes || undefined
                })
              }}
              disabled={productionMutation.isPending || !qtyGood || qtyGood <= 0 || isOverLimit}
              className={`flex-1 py-3.5 sm:py-3 rounded-lg font-medium transition-colors touch-target min-h-[48px] sm:min-h-0 text-base disabled:opacity-50 disabled:cursor-not-allowed ${
                isOverLimit
                  ? 'bg-red-600 text-white active:bg-red-800 hover:bg-red-700 cursor-not-allowed opacity-50'
                  : 'bg-green-600 text-white active:bg-green-800 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed'
              }`}
            >
              {productionMutation.isPending ? 'Recording...' : isOverLimit ? 'Over Limit' : 'Add Record'}
            </button>
          </div>
        </div>
      )
    }
    return null
  }

  // --- Product Action Sheet ---
  const renderProductSheet = () => {
    if (!selectedProduct) return null

    return (
      <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center pointer-events-none">
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm pointer-events-auto" onClick={resetSelection} />
        <div className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-2xl shadow-2xl pointer-events-auto max-h-[95vh] sm:max-h-[90vh] overflow-y-auto flex flex-col relative z-10">
          <div className="w-full flex justify-center pt-3 pb-2 sm:hidden sticky top-0 bg-white z-10">
            <div className="w-12 h-1.5 bg-gray-300 rounded-full" />
          </div>

          <div className="p-4 sm:p-5 border-b border-gray-100">
            <div className="flex gap-4">
              {/* Product Image */}
              <div className="flex-shrink-0">
                <div className="w-24 h-24 bg-gray-100 rounded-lg overflow-hidden border border-gray-200">
                  {(selectedProduct as any).imageUrl ? (
                    <img
                      src={(selectedProduct as any).imageUrl}
                      alt={selectedProduct.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <CubeIcon className="w-10 h-10 text-gray-300" />
                    </div>
                  )}
                </div>
              </div>

              {/* Product Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between mb-2">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    PRODUCT
                  </span>
                  <button onClick={resetSelection} className="p-1.5 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors">
                    <XMarkIcon className="h-4 w-4 text-gray-500" />
                  </button>
                </div>
                <h2 className="text-lg font-bold text-gray-900 mb-1 line-clamp-2">{selectedProduct.name}</h2>
                <p className="text-sm text-gray-500 mb-2">SKU: {selectedProduct.sku}</p>

                {/* Category/Group if available */}
                {(selectedProduct as any).category && (
                  <p className="text-xs text-gray-400">
                    {(selectedProduct as any).category}
                    {(selectedProduct as any).subcategory && ` • ${(selectedProduct as any).subcategory}`}
                  </p>
                )}
              </div>
            </div>

            {/* Stock & Price Info */}
            <div className="grid grid-cols-2 gap-2 sm:gap-3 mt-3 sm:mt-4">
              <div className="bg-blue-50 p-2.5 sm:p-3 rounded-lg border border-blue-100">
                <p className="text-[10px] sm:text-xs text-blue-600 uppercase tracking-wide font-medium">On Hand</p>
                <p className="text-xl sm:text-2xl font-bold text-blue-900">{selectedProduct.qtyOnHand || 0}</p>
                <p className="text-[10px] sm:text-xs text-blue-600">{selectedProduct.uom || 'Units'}</p>
              </div>
              <div className="bg-gray-50 p-2.5 sm:p-3 rounded-lg border border-gray-200">
                <p className="text-[10px] sm:text-xs text-gray-500 uppercase tracking-wide font-medium">Unit Price</p>
                <p className="text-xl sm:text-2xl font-bold text-gray-900">
                  £{((selectedProduct as any).pricePerBox || 0).toFixed(2)}
                </p>
                <p className="text-[10px] sm:text-xs text-gray-500">
                  Total: £{((selectedProduct.qtyOnHand || 0) * ((selectedProduct as any).pricePerBox || 0)).toFixed(2)}
                </p>
              </div>
            </div>

            {/* View Details Button */}
            <button
              onClick={() => {
                // Navigate to product details - you'll need to implement this based on your routing
                window.location.href = `/inventory?productId=${selectedProduct.id}`
              }}
              className="w-full mt-3 py-3 sm:py-2.5 bg-gray-100 active:bg-gray-200 hover:bg-gray-200 text-gray-700 rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-2 touch-target min-h-[44px] sm:min-h-0"
            >
              <MagnifyingGlassIcon className="w-4 h-4" />
              View Full Details
            </button>
          </div>

          <div className="p-4 sm:p-5 space-y-3">
            {!activeAction ? (
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                <button
                  onClick={() => setActiveAction('in')}
                  className="py-4 sm:py-4 bg-green-50 border border-green-100 text-green-700 rounded-xl font-medium active:bg-green-100 hover:bg-green-100 flex flex-col items-center justify-center space-y-1 touch-target min-h-[100px] sm:min-h-0"
                >
                  <ArrowDownTrayIcon className="h-6 w-6 sm:h-6 sm:w-6" />
                  <span className="text-xs sm:text-sm">Receive</span>
                </button>
                <button
                  onClick={() => setActiveAction('out')}
                  className="py-4 sm:py-4 bg-red-50 border border-red-100 text-red-700 rounded-xl font-medium active:bg-red-100 hover:bg-red-100 flex flex-col items-center justify-center space-y-1 touch-target min-h-[100px] sm:min-h-0"
                >
                  <ArrowUpTrayIcon className="h-6 w-6 sm:h-6 sm:w-6" />
                  <span className="text-xs sm:text-sm">Ship/Use</span>
                </button>
                <button
                  onClick={() => setActiveAction('adjust')}
                  className="py-4 sm:py-4 bg-gray-50 border border-gray-100 text-gray-700 rounded-xl font-medium active:bg-gray-100 hover:bg-gray-100 flex flex-col items-center justify-center space-y-1 touch-target min-h-[100px] sm:min-h-0"
                >
                  <AdjustmentsHorizontalIcon className="h-6 w-6 sm:h-6 sm:w-6" />
                  <span className="text-xs sm:text-sm">Adjust</span>
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
    const isAdjust = activeAction === 'adjustment'
    const title = isReceive ? 'Receive Stock' : isShip ? 'Ship / Use Stock' : 'Adjust Stock'
    const btnColor = isReceive ? 'bg-green-600' : isShip ? 'bg-red-600' : 'bg-gray-800'

    // Filter reasons based on operation type
    const filteredReasons = stockReasons.filter(r => {
      if (isReceive) return r.operationType === 'stock_in'
      if (isShip) return r.operationType === 'stock_out'
      return r.operationType === 'adjustment'
    })

    return (
      <div className="space-y-4">
        <h3 className="font-semibold text-gray-900 text-base sm:text-base">{title}</h3>

        {/* Quantity Input */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Quantity</label>
          <input
            type="number"
            placeholder="Enter quantity"
            autoFocus
            className="w-full p-3.5 sm:p-3 border border-gray-300 rounded-lg text-base sm:text-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 touch-target"
            onChange={e => setActionData({ ...actionData, qty: Number(e.target.value) })}
          />
        </div>

        {/* Reason Dropdown */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Reason *</label>
          <select
            className="w-full p-3.5 sm:p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base touch-target bg-white"
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
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Notes / Reference</label>
          <input
            type="text"
            placeholder="Optional notes or reference"
            className="w-full p-3.5 sm:p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base touch-target"
            onChange={e => setActionData({ ...actionData, reference: e.target.value })}
          />
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 pt-2">
          <button
            onClick={() => {
              setActiveAction(null)
              setActionData({})
            }}
            className="flex-1 py-3.5 sm:py-3 bg-gray-100 rounded-lg font-medium active:bg-gray-300 hover:bg-gray-200 transition-colors touch-target min-h-[48px] sm:min-h-0 text-base"
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
            className={`flex-1 py-3.5 sm:py-3 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed touch-target min-h-[48px] sm:min-h-0 text-base ${btnColor} active:opacity-80 hover:opacity-90`}
          >
            Confirm
          </button>
        </div>
      </div>
    )
  }

  // Debug info
  if (jobsError) {
    console.error('Jobs query error:', jobsError)
  }

  return (
    <div className="space-y-5 sm:space-y-8 pb-6 sm:pb-0">
      {renderHeader()}
      <div className="max-w-2xl mx-auto space-y-5 sm:space-y-6 px-4 sm:px-0">
        {renderScannerArea()}
        {renderRecentScans()}
      </div>

      {/* Modals / Action Sheets */}
      {selectedJob && renderJobSheet()}
      {selectedProduct && renderProductSheet()}

      {/* Inventory Posting Modal */}
      {showInventoryPostingModal && selectedJob && (
        <ConfirmInventoryPostingModal
          job={selectedJob}
          workspaceId={workspaceId}
          products={products}
          onClose={() => setShowInventoryPostingModal(false)}
          onSuccess={async () => {
            // Complete the job after successful inventory posting
            await statusMutation.mutateAsync({ jobId: selectedJob.id, status: 'done' })
            setShowInventoryPostingModal(false)
            // Refresh job data
            await queryClient.invalidateQueries({ queryKey: ['jobs', workspaceId] })
            // CRITICAL: Invalidate inventory queries to refresh stock after posting
            // This ensures inventory UI shows updated quantities
            queryClient.invalidateQueries({ queryKey: ['products', workspaceId] })
            queryClient.invalidateQueries({ queryKey: ['stockTxns', workspaceId] })
            queryClient.invalidateQueries({ queryKey: ['productOnHand', workspaceId] })
            // Dispatch custom event to notify ProductDetails (for any open product)
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