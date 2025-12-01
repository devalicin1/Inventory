
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
              
              // Stop camera immediately after successful scan
              if (reader.current) {
                try {
                  reader.current.reset()
                } catch (e) {
                  console.warn('Error resetting scanner:', e)
                }
              }
              
              // Stop all video tracks to ensure camera is fully closed
              if (videoRef.current) {
                const stream = videoRef.current.srcObject as MediaStream
                if (stream) {
                  stream.getTracks().forEach(track => {
                    track.stop()
                  })
                  videoRef.current.srcObject = null
                }
              }
              
              setIsScanning(false)
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
      
      // Stop all video tracks to ensure camera is fully closed
      if (videoRef.current) {
        const stream = videoRef.current.srcObject as MediaStream
        if (stream) {
          stream.getTracks().forEach(track => {
            track.stop()
          })
          videoRef.current.srcObject = null
        }
      }
      
      setIsScanning(false)
      setCameraError(null)
    }
  }, [scanMode]) // Re-run when scanMode changes

  // --- Render Helpers ---

  const renderHeader = () => (
    <div className="flex items-center justify-between px-1">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/25">
          <QrCodeIcon className="h-7 w-7 text-white" />
        </div>
        <div>
          <h1 className="text-2xl sm:text-2xl font-bold tracking-tight text-gray-900">Scanner</h1>
          <p className="text-sm text-gray-500">Scan jobs or products</p>
        </div>
      </div>
      {onClose && (
        <button
          onClick={onClose}
          className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center active:bg-gray-200 transition-colors"
        >
          <XMarkIcon className="h-6 w-6 text-gray-600" />
        </button>
      )}
    </div>
  )

  const renderScannerArea = () => (
    <div className="space-y-4">
      {/* Camera View - Full Width, Larger for Mobile */}
      <div className="bg-gray-900 rounded-3xl overflow-hidden shadow-2xl aspect-[3/4] sm:aspect-[4/3] relative flex flex-col items-center justify-center text-white">
        {scanMode === 'camera' ? (
          <>
            {cameraError ? (
              <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center p-6 z-20">
                <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mb-6">
                  <ExclamationTriangleIcon className="h-10 w-10 text-red-400" />
                </div>
                <p className="text-base text-red-300 text-center mb-2 font-medium">{cameraError}</p>
                <p className="text-sm text-gray-400 text-center mb-6">Grant camera permission or use manual entry</p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setScanMode('manual')}
                    className="px-6 py-3.5 bg-gray-700 text-white rounded-xl font-semibold text-base active:bg-gray-600"
                  >
                    Manual Entry
                  </button>
                  <button
                    onClick={async () => {
                      setCameraError(null)
                      if (videoRef.current && reader.current) {
                        try {
                          reader.current.reset()
                          reader.current = null
                          await new Promise(resolve => setTimeout(resolve, 500))
                          setScanMode('manual')
                          setTimeout(() => setScanMode('camera'), 100)
                        } catch (e) {
                          console.error('Error restarting camera:', e)
                        }
                      }
                    }}
                    className="px-6 py-3.5 bg-blue-600 text-white rounded-xl font-semibold text-base active:bg-blue-700"
                  >
                    Retry
                  </button>
                </div>
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
                {/* Scan Frame Overlay */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                  {/* Dark overlay outside scan area */}
                  <div className="absolute inset-0 bg-black/40" />
                  
                  {/* Scan area */}
                  <div className={`w-[75%] max-w-[280px] aspect-square relative z-10 transition-all duration-300 ${
                    scanAttempts > 10 ? 'animate-pulse' : ''
                  }`}>
                    {/* Clear center */}
                    <div className="absolute inset-0 bg-transparent rounded-2xl" style={{ 
                      boxShadow: '0 0 0 9999px rgba(0,0,0,0.5)' 
                    }} />
                    
                    {/* Corner brackets */}
                    <div className={`absolute -top-1 -left-1 w-10 h-10 border-t-4 border-l-4 rounded-tl-xl transition-colors duration-300 ${
                      scanAttempts > 10 ? 'border-yellow-400' : 'border-blue-400'
                    }`} />
                    <div className={`absolute -top-1 -right-1 w-10 h-10 border-t-4 border-r-4 rounded-tr-xl transition-colors duration-300 ${
                      scanAttempts > 10 ? 'border-yellow-400' : 'border-blue-400'
                    }`} />
                    <div className={`absolute -bottom-1 -left-1 w-10 h-10 border-b-4 border-l-4 rounded-bl-xl transition-colors duration-300 ${
                      scanAttempts > 10 ? 'border-yellow-400' : 'border-blue-400'
                    }`} />
                    <div className={`absolute -bottom-1 -right-1 w-10 h-10 border-b-4 border-r-4 rounded-br-xl transition-colors duration-300 ${
                      scanAttempts > 10 ? 'border-yellow-400' : 'border-blue-400'
                    }`} />
                    
                    {/* Scanning line animation */}
                    {isScanning && scanAttempts <= 10 && (
                      <div className="absolute inset-x-2 top-1/2 h-0.5 bg-gradient-to-r from-transparent via-blue-400 to-transparent animate-pulse" />
                    )}
                  </div>
                </div>
                
                {/* Scanning status - Bottom */}
                <div className="absolute bottom-0 left-0 right-0 z-20 p-4">
                  {scanAttempts > 10 ? (
                    <div className="bg-yellow-500 px-5 py-4 rounded-2xl shadow-lg">
                      <div className="flex items-start gap-3">
                        <InformationCircleIcon className="h-6 w-6 text-yellow-900 flex-shrink-0 mt-0.5" />
                        <div className="flex-1 text-left">
                          <p className="text-sm font-bold text-yellow-900 mb-2">QR code not found</p>
                          <ul className="text-xs text-yellow-800 space-y-1">
                            <li>• Move code closer to camera</li>
                            <li>• Ensure good lighting</li>
                            <li>• Hold steady</li>
                          </ul>
                          <button
                            onClick={() => setScanMode('manual')}
                            className="mt-3 w-full py-2.5 bg-yellow-900/20 rounded-xl text-sm font-bold text-yellow-900 active:bg-yellow-900/30"
                          >
                            Use Manual Entry
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : scanAttempts > 5 ? (
                    <div className="bg-orange-500/95 backdrop-blur px-5 py-3 rounded-2xl">
                      <p className="text-sm text-white text-center font-medium">
                        🔍 Searching... Hold steady
                      </p>
                    </div>
                  ) : (
                    <div className="bg-black/70 backdrop-blur px-5 py-3 rounded-2xl">
                      <p className="text-sm text-white text-center font-medium">
                        📷 Align QR code or barcode in frame
                      </p>
                    </div>
                  )}
                </div>
              </>
            )}
          </>
        ) : (
          <div className="text-center p-8 flex flex-col items-center justify-center h-full">
            <div className="w-24 h-24 bg-gray-800 rounded-3xl flex items-center justify-center mb-4">
              <QrCodeIcon className="h-14 w-14 text-gray-500" />
            </div>
            <p className="text-gray-400 text-lg font-medium mb-2">Manual Entry Mode</p>
            <p className="text-gray-500 text-sm">Type code in the field below</p>
          </div>
        )}

        {/* Mode Toggle Button */}
        <button
          onClick={() => {
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
          className="absolute top-4 right-4 bg-white/20 backdrop-blur-md p-4 rounded-2xl active:bg-white/30 z-20 transition-all"
          title={scanMode === 'camera' ? 'Switch to manual entry' : 'Switch to camera'}
          aria-label={scanMode === 'camera' ? 'Switch to manual entry' : 'Switch to camera'}
        >
          {scanMode === 'camera' ? (
            <MagnifyingGlassIcon className="h-6 w-6 text-white" />
          ) : (
            <QrCodeIcon className="h-6 w-6 text-white" />
          )}
        </button>
      </div>

      {/* Manual Input - Large & Touch Friendly */}
      <form onSubmit={handleManualSubmit} className="space-y-3">
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-5 top-1/2 -translate-y-1/2 h-6 w-6 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={manualCode}
            onChange={e => setManualCode(e.target.value)}
            placeholder="Enter job code or SKU..."
            className="w-full pl-14 pr-5 py-5 border-2 border-gray-200 rounded-2xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-lg font-medium placeholder:text-gray-400 bg-white shadow-sm"
            autoComplete="off"
          />
        </div>
        <button
          type="submit"
          disabled={!manualCode.trim()}
          className="w-full bg-gradient-to-r from-blue-500 to-blue-600 text-white py-5 rounded-2xl font-bold text-lg shadow-lg shadow-blue-500/30 active:scale-[0.98] transition-all disabled:opacity-50 disabled:shadow-none disabled:active:scale-100"
        >
          <div className="flex items-center justify-center gap-3">
            <MagnifyingGlassIcon className="h-6 w-6" />
            <span>Search</span>
          </div>
        </button>
      </form>
    </div>
  )

  const renderRecentScans = () => (
    <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="p-5 border-b border-gray-100">
        <h3 className="text-base font-bold text-gray-900">Recent Scans</h3>
      </div>
      <div className="divide-y divide-gray-100 max-h-[400px] overflow-y-auto">
        {recentScans.length === 0 && (
          <div className="p-8 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <ClockIcon className="h-8 w-8 text-gray-400" />
            </div>
            <p className="text-gray-500 font-medium">No scans yet</p>
            <p className="text-gray-400 text-sm mt-1">Scans will appear here</p>
          </div>
        )}
        {recentScans.map((scan, i) => (
          <div
            key={i}
            onClick={() => scan.type !== 'none' && handleScan(scan.code)}
            className={`p-4 flex items-center gap-4 transition-colors ${
              scan.type === 'none' 
                ? 'bg-red-50 cursor-default' 
                : 'active:bg-gray-50 cursor-pointer'
            }`}
          >
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 ${
              scan.type === 'job' 
                ? 'bg-blue-100' 
                : scan.type === 'product'
                ? 'bg-green-100'
                : 'bg-red-100'
            }`}>
              {scan.type === 'job' ? (
                <ClockIcon className="h-7 w-7 text-blue-600" />
              ) : scan.type === 'product' ? (
                <CubeIcon className="h-7 w-7 text-green-600" />
              ) : (
                <ExclamationTriangleIcon className="h-7 w-7 text-red-600" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-gray-900 text-base truncate">{scan.code}</p>
              <p className={`text-sm ${
                scan.type === 'none' ? 'text-red-600 font-medium' : 'text-gray-500'
              }`}>
                {scan.type === 'none' ? 'Not Found' : scan.type === 'job' ? 'Job' : 'Product'} • {scan.timestamp.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
            {scan.type !== 'none' && (
              <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <ArrowPathIcon className="h-5 w-5 text-gray-500" />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
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

    const getStatusLabel = (status: string) => {
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

    return (
      <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center pointer-events-none">
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm pointer-events-auto" onClick={resetSelection} />
        <div className="bg-white w-full max-w-lg rounded-t-[2rem] sm:rounded-3xl shadow-2xl pointer-events-auto max-h-[95vh] sm:max-h-[90vh] overflow-y-auto flex flex-col relative z-10">
          {/* Handle bar for mobile */}
          <div className="w-full flex justify-center pt-3 pb-1 sm:hidden sticky top-0 bg-white z-10 rounded-t-[2rem]">
            <div className="w-14 h-1.5 bg-gray-300 rounded-full" />
          </div>

          <div className="p-5 sm:p-6 border-b border-gray-100">
            <div className="flex justify-between items-start">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <span className="inline-flex items-center px-3 py-1.5 rounded-xl text-xs font-bold bg-blue-100 text-blue-700">
                    JOB
                  </span>
                  <span className={`inline-flex items-center px-3 py-1.5 rounded-xl text-xs font-bold ${getStatusColor(selectedJob.status)}`}>
                    {getStatusLabel(selectedJob.status)}
                  </span>
                  {selectedJob.priority && selectedJob.priority <= 2 && (
                    <span className="inline-flex items-center px-3 py-1.5 rounded-xl text-xs font-bold bg-red-100 text-red-700">
                      🔥 Priority
                    </span>
                  )}
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-1">{selectedJob.code}</h2>
                <p className="text-base text-gray-600 line-clamp-2">{selectedJob.productName}</p>
              </div>
              <button 
                onClick={resetSelection} 
                className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center active:bg-gray-200 flex-shrink-0 ml-3"
              >
                <XMarkIcon className="h-6 w-6 text-gray-600" />
              </button>
            </div>

            {/* Job Info Grid - Larger for Mobile */}
            <div className="grid grid-cols-2 gap-3 mt-4">
              <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-4 rounded-2xl">
                <p className="text-xs text-gray-500 mb-1 font-medium">Quantity</p>
                <p className="font-bold text-gray-900 text-xl">{selectedJob.quantity?.toLocaleString()}</p>
                <p className="text-sm text-gray-600">{selectedJob.unit}</p>
              </div>
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-2xl">
                <p className="text-xs text-blue-600 mb-1 font-medium">Current Stage</p>
                <p className="font-bold text-blue-900 text-lg truncate">{currentStageName}</p>
              </div>
            </div>

            {/* Customer & Due Date */}
            <div className="grid grid-cols-2 gap-3 mt-3">
              {selectedJob.customer && (
                <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 p-4 rounded-2xl">
                  <div className="flex items-center gap-2 mb-1">
                    <BuildingStorefrontIcon className="h-4 w-4 text-indigo-600" />
                    <p className="text-xs text-indigo-600 font-medium">Customer</p>
                  </div>
                  <p className="font-bold text-indigo-900 truncate">{selectedJob.customer.name}</p>
                  {selectedJob.customer.orderNo && (
                    <p className="text-xs text-indigo-600 mt-1 truncate">Order: {selectedJob.customer.orderNo}</p>
                  )}
                </div>
              )}
              {selectedJob.dueDate && (
                <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-4 rounded-2xl">
                  <div className="flex items-center gap-2 mb-1">
                    <CalendarIcon className="h-4 w-4 text-orange-600" />
                    <p className="text-xs text-orange-600 font-medium">Due Date</p>
                  </div>
                  <p className="font-bold text-orange-900">
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

          <div className="p-5 sm:p-6 space-y-4">
            {!activeAction ? (
              <>
                {/* Primary Action - Large, Prominent Button */}
                {!isDone && (
                  <div className="space-y-3">
                    {!isReleased && !isInProgress && (
                      <button
                        onClick={() => {
                          if (confirm('Release this job to start production?')) {
                            statusMutation.mutate({ jobId: selectedJob.id, status: 'released' })
                          }
                        }}
                        className="w-full py-5 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-2xl font-bold shadow-lg shadow-blue-500/30 active:scale-[0.98] transition-all flex items-center justify-center gap-3"
                      >
                        <PlayIcon className="h-7 w-7" />
                        <span className="text-lg">Release Job</span>
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
                        className="w-full py-5 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-2xl font-bold shadow-lg shadow-green-500/30 active:scale-[0.98] transition-all flex items-center justify-center gap-3"
                      >
                        <PlayIcon className="h-7 w-7" />
                        <span className="text-lg">Start Production</span>
                      </button>
                    )}

                    {isBlocked && (
                      <button
                        onClick={() => {
                          statusMutation.mutate({ jobId: selectedJob.id, status: 'in_progress' })
                        }}
                        className="w-full py-5 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-2xl font-bold shadow-lg shadow-green-500/30 active:scale-[0.98] transition-all flex items-center justify-center gap-3"
                      >
                        <PlayIcon className="h-7 w-7" />
                        <span className="text-lg">Resume Job</span>
                      </button>
                    )}
                  </div>
                )}

                {/* Next Stage Button */}
                {nextStage && (isInProgress || isReleased) && !isBlocked && (() => {
                  const currentStageSummary = calculateProductionSummary(selectedJob)
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
                          alert(`⚠️ Cannot proceed: Production quantity below threshold.\n\nRequired: ${completionThreshold.toLocaleString()}+ ${currentStageOutputUOM || 'units'}\nCurrent: ${totalProducedInStage.toLocaleString()} ${currentStageOutputUOM || 'units'}\n\nPlease complete production before moving to next stage.`)
                          return
                        }
                        
                        if (confirm(`Move from ${currentStageName} to ${nextStage.name}?`)) {
                          moveStageMutation.mutate({ jobId: selectedJob.id, newStageId: nextStage.id })
                        }
                      }}
                      disabled={moveStageMutation.isPending || (requireOutput && isIncomplete)}
                      className={`w-full py-5 rounded-2xl font-bold shadow-lg disabled:opacity-50 disabled:shadow-none flex items-center justify-center gap-3 transition-all ${
                        requireOutput && isIncomplete
                          ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                          : 'bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-purple-500/30 active:scale-[0.98]'
                      }`}
                    >
                      <ArrowRightIcon className="h-7 w-7" />
                      <span className="text-lg">Move to {nextStage.name}</span>
                    </button>
                  )
                })()}

                {/* Production Actions - Large Touch Targets */}
                {isInProgress && !isBlocked && (
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setActiveAction('consume')}
                      className="py-6 bg-gradient-to-br from-orange-50 to-orange-100 border-2 border-orange-200 text-orange-700 rounded-2xl font-bold active:scale-[0.98] transition-all flex flex-col items-center justify-center gap-2"
                    >
                      <div className="w-14 h-14 bg-orange-500 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-500/30">
                        <CubeIcon className="h-8 w-8 text-white" />
                      </div>
                      <span className="text-sm mt-1">Consume Material</span>
                    </button>
                    <button
                      onClick={() => setActiveAction('produce')}
                      className="py-6 bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-200 text-blue-700 rounded-2xl font-bold active:scale-[0.98] transition-all flex flex-col items-center justify-center gap-2"
                    >
                      <div className="w-14 h-14 bg-blue-500 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/30">
                        <CheckCircleIcon className="h-8 w-8 text-white" />
                      </div>
                      <span className="text-sm mt-1">Record Output</span>
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
                    className="w-full py-4 bg-red-50 border-2 border-red-200 text-red-600 rounded-2xl font-semibold active:bg-red-100 transition-colors flex items-center justify-center gap-2"
                  >
                    <PauseIcon className="h-5 w-5" />
                    <span>Block Job</span>
                  </button>
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
                  className="w-full py-4 bg-gray-100 text-gray-700 rounded-2xl font-semibold active:bg-gray-200 transition-colors flex items-center justify-center gap-2"
                >
                  <InformationCircleIcon className="h-5 w-5" />
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
            <h3 className="font-bold text-gray-900 text-lg">Record Consumption</h3>
            <button 
              onClick={() => { setActiveAction(null); setActionData({}) }} 
              className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center active:bg-gray-200"
            >
              <XMarkIcon className="h-5 w-5 text-gray-600" />
            </button>
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
                <div className="mt-2 p-3 bg-gray-50 rounded-xl text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Required:</span>
                    <span className="font-medium">{selectedBomItem.qtyRequired.toLocaleString()} {selectedBomItem.uom}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Consumed:</span>
                    <span className="font-medium">{(selectedBomItem.consumed || 0).toLocaleString()} {selectedBomItem.uom}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Remaining:</span>
                    <span className="font-bold text-orange-600">{remainingRequired.toLocaleString()} {selectedBomItem.uom}</span>
                  </div>
                  {availableStock !== null && (
                    <div className={`flex justify-between mt-1 pt-1 border-t ${availableStock < remainingRequired ? 'text-red-600' : 'text-green-600'}`}>
                      <span>Stock:</span>
                      <span className="font-bold">{availableStock.toLocaleString()} {selectedBomItem.uom}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

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
              autoFocus={actionData.bomItemIndex === undefined}
            />
            {actionData.bomItemIndex !== undefined && (
              <p className="mt-2 text-sm text-gray-500">From BOM: {actionData.name || actionData.sku}</p>
            )}
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-sm font-bold text-gray-700 mb-2">Quantity *</label>
              <input
                type="number"
                step="0.01"
                placeholder={selectedBomItem ? `${remainingRequired?.toLocaleString() || 0}` : "0"}
                className="w-full p-4 border-2 border-gray-200 rounded-2xl focus:ring-4 focus:ring-orange-500/20 focus:border-orange-500 text-xl font-bold text-center"
                value={actionData.qtyUsed || ''}
                onChange={e => setActionData({ ...actionData, qtyUsed: Number(e.target.value) })}
              />
              {availableStock !== null && (
                <p className={`mt-2 text-sm font-medium ${isInsufficientStock ? 'text-red-600' : 'text-gray-600'}`}>
                  Stock: {availableStock.toLocaleString()} {actionData.uom || 'units'}
                  {isInsufficientStock && <span className="ml-2">⚠️ Insufficient!</span>}
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
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Notes (Optional)</label>
            <input
              placeholder="Additional notes"
              className="w-full p-4 border-2 border-gray-200 rounded-2xl focus:ring-4 focus:ring-orange-500/20 focus:border-orange-500 text-base"
              value={actionData.notes || ''}
              onChange={e => setActionData({ ...actionData, notes: e.target.value })}
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button
              onClick={() => { setActiveAction(null); setActionData({}) }}
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
              className={`flex-1 py-4 rounded-2xl font-bold shadow-lg transition-all disabled:opacity-50 disabled:shadow-none active:scale-[0.98] ${
                isInsufficientStock 
                  ? 'bg-gradient-to-r from-red-500 to-red-600 text-white shadow-red-500/30' 
                  : 'bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-orange-500/30'
              }`}
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
            <h3 className="font-bold text-gray-900 text-lg">Record Production Output</h3>
            <button 
              onClick={() => { setActiveAction(null); setActionData({}) }} 
              className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center active:bg-gray-200"
            >
              <XMarkIcon className="h-5 w-5 text-gray-600" />
            </button>
          </div>

          {/* Production Summary */}
          {plannedQty > 0 && (
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl p-4">
              <p className="text-sm font-bold text-blue-800 mb-3">Production Summary</p>
              <div className="grid grid-cols-3 gap-3 mb-3">
                <div className="bg-white rounded-xl p-3 text-center">
                  <span className="text-xs text-gray-500 block">Planned</span>
                  <div className="font-bold text-gray-900">{plannedQty.toLocaleString()}</div>
                  <span className="text-xs text-gray-500">{plannedUOM}</span>
                </div>
                <div className="bg-white rounded-xl p-3 text-center">
                  <span className="text-xs text-gray-500 block">Produced</span>
                  <div className="font-bold text-blue-600">{totalProducedInStage.toLocaleString()}</div>
                  <span className="text-xs text-gray-500">{currentStageOutputUOM || 'units'}</span>
                </div>
                <div className="bg-white rounded-xl p-3 text-center">
                  <span className="text-xs text-gray-500 block">Remaining</span>
                  <div className="font-bold text-orange-600">{Math.max(0, remaining).toLocaleString()}</div>
                  <span className="text-xs text-gray-500">{currentStageOutputUOM || 'units'}</span>
                </div>
              </div>
              {isIncomplete && (
                <div className="bg-amber-100 border border-amber-200 rounded-xl px-4 py-2 text-sm text-amber-800">
                  <span className="font-bold">⚠️ Incomplete:</span> {completionThreshold.toLocaleString()}+ {currentStageOutputUOM || 'units'} required
                </div>
              )}
              {isOverLimit && (
                <div className="bg-red-100 border border-red-200 rounded-xl px-4 py-2 text-sm text-red-800">
                  <span className="font-bold">⚠️ Over Limit:</span> Maximum {completionThresholdUpper.toLocaleString()} {currentStageOutputUOM || 'units'}
                </div>
              )}
              {!isIncomplete && !isOverLimit && totalAfterThisEntry > 0 && (
                <div className="bg-green-100 border border-green-200 rounded-xl px-4 py-2 text-sm text-green-800">
                  <span className="font-bold">✓ Within acceptable range</span>
                </div>
              )}
            </div>
          )}

          {/* Stage Info */}
          <div className="bg-gray-50 rounded-2xl p-4">
            <label className="block text-xs font-bold text-gray-500 mb-1">STAGE</label>
            <p className="text-base font-semibold text-gray-900">{getStageName(selectedJob?.currentStageId, selectedJob?.status)}</p>
          </div>

          {/* Input Fields - Large for Mobile */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                Good Qty ({currentStageInputUOM || 'units'})
                {currentStageInputUOM && currentStageOutputUOM && currentStageInputUOM !== currentStageOutputUOM && numberUp > 0 && (
                  <span className="text-xs text-blue-600 block mt-1">
                    → {convertToOutputUOM(qtyGood || 0).toFixed(0)} {currentStageOutputUOM}
                  </span>
                )}
              </label>
              <input
                type="number"
                min={0}
                step="1"
                placeholder="0"
                className="w-full p-4 border-2 border-gray-200 rounded-2xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 text-2xl font-bold text-center"
                value={qtyGood || ''}
                onChange={e => setActionData({ ...actionData, qtyGood: Number(e.target.value) })}
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                Scrap ({currentStageInputUOM || 'units'})
              </label>
              <input
                type="number"
                min={0}
                step="1"
                placeholder="0"
                className="w-full p-4 border-2 border-gray-200 rounded-2xl focus:ring-4 focus:ring-gray-500/20 focus:border-gray-400 text-2xl font-bold text-center text-gray-600"
                value={qtyScrap || ''}
                onChange={e => setActionData({ ...actionData, qtyScrap: Number(e.target.value) })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Date & Time</label>
              <input
                type="datetime-local"
                value={actionData.runDateTime || ''}
                onChange={e => setActionData({ ...actionData, runDateTime: e.target.value })}
                className="w-full p-4 border-2 border-gray-200 rounded-2xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 text-base"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Workcenter</label>
              <select
                value={actionData.workcenterId || selectedJob?.workcenterId || ''}
                onChange={e => setActionData({ ...actionData, workcenterId: e.target.value || undefined })}
                className="w-full p-4 border-2 border-gray-200 rounded-2xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 text-base bg-white"
              >
                <option value="">Unspecified</option>
                {workcenters.map(w => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Lot Number</label>
            <input
              type="text"
              placeholder="Optional"
              className="w-full p-4 border-2 border-gray-200 rounded-2xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 text-base"
              value={actionData.lot || ''}
              onChange={e => setActionData({ ...actionData, lot: e.target.value })}
            />
          </div>

          {/* Conversion Info */}
          {currentStageInputUOM && currentStageOutputUOM && currentStageInputUOM !== currentStageOutputUOM && numberUp > 0 && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-800">
              <span className="font-bold">Conversion:</span> {currentStageInputUOM} → {currentStageOutputUOM} (Number Up: {numberUp})
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Notes (Optional)</label>
            <textarea
              placeholder="Add notes..."
              rows={2}
              className="w-full p-4 border-2 border-gray-200 rounded-2xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 resize-none text-base"
              value={actionData.notes || ''}
              onChange={e => setActionData({ ...actionData, notes: e.target.value })}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={() => { setActiveAction(null); setActionData({}) }}
              className="flex-1 py-4 bg-gray-100 rounded-2xl font-bold text-gray-700 active:bg-gray-200 transition-colors"
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
              className={`flex-1 py-4 rounded-2xl font-bold shadow-lg transition-all disabled:opacity-50 disabled:shadow-none active:scale-[0.98] ${
                isOverLimit
                  ? 'bg-gradient-to-r from-red-500 to-red-600 text-white shadow-red-500/30 cursor-not-allowed opacity-50'
                  : 'bg-gradient-to-r from-green-500 to-green-600 text-white shadow-green-500/30'
              }`}
            >
              {productionMutation.isPending ? 'Recording...' : isOverLimit ? 'Over Limit' : 'Save'}
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
    const isAdjust = activeAction === 'adjustment'
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

  // Debug info
  if (jobsError) {
    console.error('Jobs query error:', jobsError)
  }

  return (
    <div className="space-y-6 pb-24 sm:pb-6">
      {renderHeader()}
      <div className="max-w-xl mx-auto space-y-6">
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