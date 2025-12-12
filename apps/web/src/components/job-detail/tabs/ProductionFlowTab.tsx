import { useMemo, useState, type FC, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import type { Job, ProductionRun, Workflow } from '../../../api/production-jobs'
import { useQuery } from '@tanstack/react-query'
import { collection, query, where, orderBy, getDocs, limit } from 'firebase/firestore'
import { db } from '../../../lib/firebase'
import type { StockTxn } from '../../../api/inventory'
import { getProductByCode } from '../../../api/inventory'
import { 
  CubeIcon, 
  ClockIcon,
  TagIcon,
  BuildingOffice2Icon,
  DocumentTextIcon,
  CheckCircleIcon,
  ArrowPathIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  MagnifyingGlassIcon,
  AdjustmentsHorizontalIcon,
  InformationCircleIcon,
  ArrowsPointingOutIcon,
  ArrowsPointingInIcon,
  MagnifyingGlassPlusIcon,
  MagnifyingGlassMinusIcon,
  CalendarIcon,
  ChartBarIcon,
  FunnelIcon,
  PrinterIcon,
  ArrowDownTrayIcon,
  EyeIcon,
  EyeSlashIcon,
  PlayCircleIcon,
  PauseCircleIcon,
  BoltIcon,
  ExclamationTriangleIcon,
  CpuChipIcon,
  TruckIcon,
  CogIcon,
  SignalIcon,
  LightBulbIcon,
  UsersIcon,
  MapIcon,
  ShareIcon,
  ChatBubbleLeftRightIcon,
  BellIcon,
  CloudArrowDownIcon,
  CommandLineIcon,
  Square3Stack3DIcon,
  XMarkIcon
} from '@heroicons/react/24/outline'

interface ProductionFlowTabProps {
  job: Job
  allRuns: ProductionRun[]
  workflows: Workflow[]
  workcenters: Array<{ id: string; name: string }>
  workspaceId: string
  onRunSelect?: (runId: string) => void
  onStageSelect?: (stageId: string) => void
  realTimeUpdates?: boolean
}

interface TimelineStep {
  id: string
  when: Date
  stage: string
  stageId: string
  good: number
  unit: string
  lot: string
  machine: string
  run: ProductionRun
  details?: string
  status?: 'completed' | 'in-progress' | 'pending'
  efficiency?: number
  qualityScore?: number
}

interface LotColor {
  lot: string
  color: string
  gradient: string
  shortCode: string
}

interface PerformanceInsight {
  type: 'warning' | 'info' | 'success' | 'critical'
  message: string
  details: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  action?: {
    label: string
    handler: () => void
  }
}

interface ForecastData {
  stage: string
  predictedQuantity: number
  confidence: number
  estimatedCompletion: Date
  recommendedActions: string[]
}

interface MachineUtilization {
  machine: string
  utilization: number
  efficiency: number
  totalRuns: number
}

interface AIRecommendation {
  type: 'optimization' | 'quality' | 'efficiency' | 'maintenance'
  title: string
  description: string
  impact: 'low' | 'medium' | 'high'
  implementation: 'low' | 'medium' | 'high'
}

export const ProductionFlowTab: FC<ProductionFlowTabProps> = ({
  job,
  allRuns,
  workflows,
  workcenters,
  workspaceId,
  onRunSelect,
  onStageSelect,
  realTimeUpdates = false
}) => {
  // State declarations
  const [hoveredStep, setHoveredStep] = useState<string | null>(null)
  const [selectedLot, setSelectedLot] = useState<string | null>(null)
  const [timeScale, setTimeScale] = useState<'hours' | 'days' | 'weeks'>('days')
  const [showLegend, setShowLegend] = useState(true)
  const [showMetrics, setShowMetrics] = useState(true)
  const [showStageDetails, setShowStageDetails] = useState(false)
  const [containerWidth, setContainerWidth] = useState(1200)
  const [zoomLevel, setZoomLevel] = useState(1)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showFullscreenModal, setShowFullscreenModal] = useState(false)
  const [selectedStage, setSelectedStage] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [animationPaused, setAnimationPaused] = useState(false)
  const [showPerformanceOverlay, setShowPerformanceOverlay] = useState(false)
  const [activeStepIndex, setActiveStepIndex] = useState<number | null>(null)
  const [viewMode, setViewMode] = useState<'flow' | 'gantt' | 'matrix'>('flow')
  const [groupingMode, setGroupingMode] = useState<'lot' | 'stage' | 'machine'>('lot')
  const [showForecast, setShowForecast] = useState(false)
  const [showPredictiveAnalytics, setShowPredictiveAnalytics] = useState(false)
  const [showMachineUtilization, setShowMachineUtilization] = useState(false)
  const [collaborationMode, setCollaborationMode] = useState(false)
  const [selectedTimeRange, setSelectedTimeRange] = useState<{start: Date, end: Date} | null>(null)
  const [highlightEfficiency, setHighlightEfficiency] = useState(false)
  const [showExportMenu, setShowExportMenu] = useState(false)
  
  // Refs
  const containerRef = useRef<HTMLDivElement>(null)
  const timelineContainerRef = useRef<HTMLDivElement>(null)
  const svgContainerRef = useRef<HTMLDivElement>(null)
  const legendRef = useRef<HTMLDivElement>(null)
  const animationRef = useRef<number | undefined>(undefined)
  const webSocketRef = useRef<WebSocket | null>(null)
  const autoSaveRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Fetch stock transactions for this job (inventory postings)
  const { data: stockTxns = [], isLoading: isLoadingStockTxns } = useQuery<StockTxn[]>({
    queryKey: ['jobStockTxns', workspaceId, job.id, job.code],
    queryFn: async () => {
      try {
        console.log('[ProductionFlowTab] Fetching stock transactions for job:', { jobCode: job.code, jobId: job.id, sku: job.sku })
        
        // Find product by SKU first
        const product = await getProductByCode(workspaceId, job.sku)
        if (!product) {
          console.log('[ProductionFlowTab] Product not found for SKU:', job.sku)
          return []
        }

        console.log('[ProductionFlowTab] Found product:', { productId: product.id, sku: product.sku })

        // Query stock transactions by productId and jobCode
        // Use simpler query first - just by productId, then filter in code
        const txnsCol = collection(db, 'workspaces', workspaceId, 'stockTxns')
        let q = query(
          txnsCol,
          where('productId', '==', product.id),
          orderBy('timestamp', 'desc'),
          limit(500) // Get more to filter by jobCode
        )
        
        try {
          const snap = await getDocs(q)
          const allTxns = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as StockTxn[]
          
          // Filter by jobCode and type in code (to avoid composite index requirement)
          const filteredTxns = allTxns.filter(txn => {
            const matchesJobCode = txn.refs?.jobCode === job.code
            const isReceiveType = txn.type === 'Receive' || txn.type === 'in'
            const matches = matchesJobCode && isReceiveType
            if (matches) {
              console.log('[ProductionFlowTab] Found matching stock transaction:', {
                id: txn.id,
                qty: txn.qty,
                type: txn.type,
                jobCode: txn.refs?.jobCode,
                timestamp: txn.timestamp
              })
            }
            return matches
          })
          
          console.log('[ProductionFlowTab] Stock transactions found:', {
            total: allTxns.length,
            filtered: filteredTxns.length
          })
          
          return filteredTxns
        } catch (queryError: any) {
          // If composite index error, try without orderBy
          console.warn('[ProductionFlowTab] Query with orderBy failed, trying without:', queryError)
          q = query(
            txnsCol,
            where('productId', '==', product.id),
            limit(500)
          )
          const snap = await getDocs(q)
          const allTxns = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as StockTxn[]
          const filteredTxns = allTxns.filter(txn => {
            const matchesJobCode = txn.refs?.jobCode === job.code
            const isReceiveType = txn.type === 'Receive' || txn.type === 'in'
            return matchesJobCode && isReceiveType
          }).sort((a, b) => {
            const timeA = a.timestamp?.toDate?.() || new Date(a.timestamp || 0)
            const timeB = b.timestamp?.toDate?.() || new Date(b.timestamp || 0)
            return timeB.getTime() - timeA.getTime()
          })
          
          console.log('[ProductionFlowTab] Stock transactions found (fallback query):', filteredTxns.length)
          return filteredTxns
        }
      } catch (error) {
        console.error('[ProductionFlowTab] Error fetching stock transactions:', error)
        return []
      }
    },
    enabled: !!workspaceId && !!job.id && !!job.sku && !!job.code,
    staleTime: 30000, // Cache for 30 seconds
  })

  // WebSocket for real-time updates
  useEffect(() => {
    if (realTimeUpdates && !webSocketRef.current) {
      const wsUrl = `wss://api.yourdomain.com/production/updates?jobId=${(job as any).id}`
      webSocketRef.current = new WebSocket(wsUrl)
      
      webSocketRef.current.onmessage = (event) => {
        const data = JSON.parse(event.data)
        if (data.type === 'new_run') {
          console.log('New production run:', data.run)
        } else if (data.type === 'run_updated') {
          console.log('Run updated:', data.run)
        }
      }
      
      return () => {
        if (webSocketRef.current) {
          webSocketRef.current.close()
        }
      }
    }
  }, [realTimeUpdates, job])

  // Auto-save view state
  useEffect(() => {
    autoSaveRef.current = setInterval(() => {
      const viewState = {
        selectedLot,
        timeScale,
        zoomLevel,
        viewMode,
        groupingMode,
        selectedTimeRange
      }
      localStorage.setItem(`production-flow-state-${(job as any).id}`, JSON.stringify(viewState))
    }, 30000)

    return () => {
      if (autoSaveRef.current) {
        clearInterval(autoSaveRef.current)
      }
    }
  }, [selectedLot, timeScale, zoomLevel, viewMode, groupingMode, selectedTimeRange, job])

  // Load saved view state
  useEffect(() => {
    const savedState = localStorage.getItem(`production-flow-state-${(job as any).id}`)
    if (savedState) {
      const state = JSON.parse(savedState)
      setSelectedLot(state.selectedLot)
      setTimeScale(state.timeScale)
      setZoomLevel(state.zoomLevel)
      setViewMode(state.viewMode)
      setGroupingMode(state.groupingMode)
      setSelectedTimeRange(state.selectedTimeRange)
    }
  }, [job])

  // Fullscreen Modal
  const toggleFullscreen = useCallback((e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }
    setShowFullscreenModal(prev => !prev)
  }, [])

  // Picture-in-picture mode
  const togglePictureInPicture = useCallback(async () => {
    if (document.pictureInPictureElement) {
      await document.exitPictureInPicture()
    } else if (svgContainerRef.current) {
      await svgContainerRef.current.requestPictureInPicture()
    }
  }, [])

  // Transform production runs into timeline steps
  const timelineSteps = useMemo(() => {
    const getStageName = (stageId: string): string => {
      for (const wf of workflows) {
        const stage = wf.stages?.find(s => s.id === stageId)
        if (stage) return stage.name
      }
      return stageId
    }

    const getStageOutputUOM = (stageId: string): string => {
      for (const wf of workflows) {
        const stage = wf.stages?.find(s => s.id === stageId) as any
        if (stage?.outputUOM) return stage.outputUOM
        if (stage?.inputUOM) return stage.inputUOM
      }
      return 'units'
    }

    const getStatus = (run: ProductionRun): 'completed' | 'in-progress' | 'pending' => {
      if (run.at) return 'completed'
      const anyRun = run as any
      if (anyRun.completedAt) return 'completed'
      if (anyRun.startedAt) return 'in-progress'
      return 'completed'
    }

    // Calculate planned quantity for a stage (standard method: Planned vs Actual)
    const getPlannedQtyForStage = (stageId: string): number => {
      const stageInfo = workflows
        .flatMap(wf => wf.stages || [])
        .find(s => s.id === stageId) as any
      
      if (!stageInfo) return 0
      
      const stageOutputUOM = stageInfo.outputUOM || stageInfo.inputUOM || 'sheets'
      const numberUp = (job as any).productionSpecs?.numberUp || 1
      
      // Check if there's a previous stage with output
      const wf = workflows.find(w => w.id === (job as any).workflowId)
      const plannedIds: string[] = Array.isArray((job as any).plannedStageIds) 
        ? (job as any).plannedStageIds 
        : []
      const stageOrder = (wf?.stages || [])
        .filter(s => plannedIds.length === 0 || plannedIds.includes(s.id))
        .sort((a, b) => a.order - b.order)
      
      const currentStageIndex = stageOrder.findIndex(s => s.id === stageId)
      if (currentStageIndex > 0) {
        // Use previous stage's total output as planned input
        const previousStageId = stageOrder[currentStageIndex - 1].id
        const previousStageRuns = allRuns.filter(r => (r as any).stageId === previousStageId)
        const previousTotal = previousStageRuns.reduce((sum, r) => sum + (r.qtyGood || 0), 0)
        if (previousTotal > 0) {
          // Convert between UOMs if needed
          const previousStageInfo = stageOrder[currentStageIndex - 1] as any
          const previousOutputUOM = previousStageInfo.outputUOM || previousStageInfo.inputUOM || 'sheets'
          if (previousOutputUOM === 'sheets' && stageOutputUOM === 'cartoon' && numberUp > 0) {
            return previousTotal * numberUp
          } else if (previousOutputUOM === 'cartoon' && stageOutputUOM === 'sheets' && numberUp > 0) {
            return previousTotal / numberUp
          }
          return previousTotal
        }
      }
      
      // First stage: use original planned quantity
      if (stageOutputUOM === 'cartoon') {
        const boxQty = (job as any).packaging?.plannedBoxes || 0
        const pcsPerBox = (job as any).packaging?.pcsPerBox || 1
        if (boxQty > 0 && pcsPerBox > 0) {
          return boxQty * pcsPerBox
        } else {
          const plannedSheets = ((job as any).output?.[0]?.qtyPlanned as number) || Number((job as any).quantity || 0)
          return numberUp > 0 ? plannedSheets * numberUp : plannedSheets
        }
      } else {
        const bom = Array.isArray((job as any).bom) ? (job as any).bom : []
        const sheetItem = bom.find((item: any) => {
          const uom = String(item.uom || '').toLowerCase()
          return ['sht', 'sheet', 'sheets'].includes(uom)
        })
        return sheetItem 
          ? Number(sheetItem.qtyRequired || 0) 
          : (((job as any).output?.[0]?.qtyPlanned as number) || Number((job as any).quantity || 0))
      }
    }

    // Standard efficiency calculation: Actual / Planned
    const calculateEfficiency = (run: any, stageId: string): number => {
      const plannedQty = getPlannedQtyForStage(stageId)
      if (plannedQty <= 0) return 1.0
      
      const actualQty = run.qtyGood || 0
      // Efficiency as ratio: actual / planned
      // For individual runs, compare to expected average per run
      const stageRuns = allRuns.filter(r => (r as any).stageId === stageId && !((r as any).transferSourceRunIds && Array.isArray((r as any).transferSourceRunIds) && (r as any).transferSourceRunIds.length > 0))
      
      if (stageRuns.length === 0) return 1.0
      
      // Expected average per run
      const expectedPerRun = plannedQty / stageRuns.length
      // Efficiency = actual / expected
      const efficiency = expectedPerRun > 0 ? actualQty / expectedPerRun : 1.0
      
      // Normalize to reasonable range (0.5 to 1.5)
      return Math.min(Math.max(efficiency, 0.5), 1.5)
    }

    const displayRuns = allRuns.filter(r => {
      const anyRun = r as any
      return !anyRun.transferSourceRunIds || !Array.isArray(anyRun.transferSourceRunIds) || anyRun.transferSourceRunIds.length === 0
    })

    const runSteps = displayRuns.map(run => {
      const when = run.at?.seconds 
        ? new Date(run.at.seconds * 1000)
        : new Date(run.at)
      
      const anyRun = run as any
      let details: string | undefined
      if (anyRun.transferSourceRunIds && Array.isArray(anyRun.transferSourceRunIds) && anyRun.transferSourceRunIds.length > 0) {
        details = 'Transferred'
      } else if (anyRun.isTransfer) {
        details = 'Transfer run'
      }
      
      const efficiency = calculateEfficiency(run, run.stageId)
      const qualityScore = anyRun.qualityScore || Math.random() * 0.2 + 0.8
      
      return {
        id: run.id,
        when,
        stage: getStageName(run.stageId),
        stageId: run.stageId,
        good: run.qtyGood || 0,
        unit: getStageOutputUOM(run.stageId),
        lot: run.lot || '',
        machine: getStageName(run.stageId),
        run,
        details,
        status: getStatus(run),
        efficiency,
        qualityScore
      } as TimelineStep
    })

    // Add inventory posting steps from stock transactions
    console.log('[ProductionFlowTab] Creating inventory steps from stockTxns:', {
      stockTxnsCount: stockTxns?.length || 0,
      stockTxns: stockTxns?.map(t => ({ 
        id: t.id, 
        qty: t.qty, 
        type: t.type, 
        jobCode: t.refs?.jobCode,
        timestamp: t.timestamp 
      }))
    })
    
    const inventorySteps: TimelineStep[] = (stockTxns || []).map(txn => {
      // Parse timestamp correctly - handle both Firestore Timestamp and Date objects
      let when: Date
      if (txn.timestamp) {
        if (txn.timestamp.toDate && typeof txn.timestamp.toDate === 'function') {
          // Firestore Timestamp
          when = txn.timestamp.toDate()
        } else if (txn.timestamp.seconds) {
          // Firestore Timestamp object with seconds
          when = new Date(txn.timestamp.seconds * 1000)
        } else if (txn.timestamp instanceof Date) {
          // Already a Date object
          when = txn.timestamp
        } else if (typeof txn.timestamp === 'number') {
          // Unix timestamp in milliseconds
          when = new Date(txn.timestamp)
        } else if (typeof txn.timestamp === 'string') {
          // ISO string
          when = new Date(txn.timestamp)
        } else {
          // Fallback to current time if parsing fails
          console.warn('[ProductionFlowTab] Could not parse timestamp:', txn.timestamp)
          when = new Date()
        }
      } else {
        // No timestamp - use current time
        when = new Date()
      }
      
      console.log('[ProductionFlowTab] Inventory step timestamp:', {
        txnId: txn.id,
        originalTimestamp: txn.timestamp,
        parsedWhen: when,
        whenISO: when.toISOString()
      })
      
      // Get UOM from job output or default
      const outputUOM = ((job as any).output?.[0]?.uom) || 'units'
      
      return {
        id: `inventory-${txn.id}`,
        when,
        stage: 'Inventory', // Simple "Inventory" stage name
        stageId: 'inventory', // Use fixed stageId for inventory
        good: txn.qty || 0,
        unit: outputUOM,
        lot: txn.refs?.lot || '',
        machine: 'Inventory Posted',
        run: null as any, // No production run for inventory posting
        details: 'Posted to Inventory',
        status: 'completed' as const,
        efficiency: 1.0,
        qualityScore: 1.0,
        // Add a flag to identify inventory steps for styling
        isInventoryPosting: true
      } as TimelineStep & { isInventoryPosting?: boolean }
    })

    // Combine and sort all steps
    const combinedSteps = [...runSteps, ...inventorySteps].sort((a, b) => a.when.getTime() - b.when.getTime())
    
    console.log('[ProductionFlowTab] Combined timeline steps:', {
      runStepsCount: runSteps.length,
      inventoryStepsCount: inventorySteps.length,
      totalSteps: combinedSteps.length,
      inventoryStepIds: inventorySteps.map(s => s.id)
    })
    
    return combinedSteps
  }, [allRuns, workflows, stockTxns, job])

  // Animation effect
  useEffect(() => {
    if (animationPaused || timelineSteps.length === 0) return

    let currentIndex = 0
    const interval = 1000

    const animate = () => {
      setActiveStepIndex(currentIndex)
      currentIndex = (currentIndex + 1) % timelineSteps.length
      animationRef.current = window.setTimeout(animate, interval)
    }

    animationRef.current = window.setTimeout(animate, interval)

    return () => {
      if (animationRef.current) {
        clearTimeout(animationRef.current)
      }
    }
  }, [animationPaused, timelineSteps])

  // Get unique stages sorted by workflow order
  const uniqueStages = useMemo(() => {
    const wf = workflows.find(w => w.id === (job as any).workflowId)
    const plannedIds: string[] = Array.isArray((job as any).plannedStageIds) 
      ? (job as any).plannedStageIds 
      : []
    
    const stageNames = new Set<string>()
    const stageIdToName = new Map<string, string>()
    timelineSteps.forEach(step => {
      stageNames.add(step.stage)
      stageIdToName.set(step.stageId, step.stage)
    })
    
    if (wf && wf.stages) {
      const orderedStages = (wf.stages || [])
        .filter(s => plannedIds.length === 0 || plannedIds.includes(s.id))
        .sort((a, b) => a.order - b.order)
        .map(s => stageIdToName.get(s.id))
        .filter((name): name is string => name !== undefined && stageNames.has(name))
      
      // Add Inventory stage at the end if it exists
      const remainingStages = Array.from(stageNames).filter(name => !orderedStages.includes(name) && name !== 'Inventory')
      const inventoryStage = stageNames.has('Inventory') ? ['Inventory'] : []
      
      return [...orderedStages, ...remainingStages.sort(), ...inventoryStage]
    }
    
    // Ensure Inventory is at the end
    const stageArray = Array.from(stageNames).sort()
    const inventoryIndex = stageArray.indexOf('Inventory')
    if (inventoryIndex > -1) {
      stageArray.splice(inventoryIndex, 1)
      stageArray.push('Inventory')
    }
    
    return stageArray
  }, [timelineSteps, workflows, job])

  const uniqueLots = useMemo(() => {
    const lots = new Set<string>()
    timelineSteps.forEach(step => {
      if (step.lot) lots.add(step.lot)
    })
    return Array.from(lots)
  }, [timelineSteps])

  // Generate short codes for lots
  const lotColors: LotColor[] = useMemo(() => {
    const professionalColors = [
      { base: '#0ea5e9', gradient: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)' },
      { base: '#10b981', gradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' },
      { base: '#8b5cf6', gradient: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)' },
      { base: '#ef4444', gradient: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' },
      { base: '#f97316', gradient: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)' },
      { base: '#06b6d4', gradient: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)' },
      { base: '#ec4899', gradient: 'linear-gradient(135deg, #ec4899 0%, #db2777 100%)' },
      { base: '#eab308', gradient: 'linear-gradient(135deg, #eab308 0%, #ca8a04 100%)' },
    ]
    
    return uniqueLots.map((lot, index) => ({
      lot,
      color: professionalColors[index % professionalColors.length].base,
      gradient: professionalColors[index % professionalColors.length].gradient,
      shortCode: `L${String(index + 1).padStart(2, '0')}`
    }))
  }, [uniqueLots])

  const getLotColor = (lot: string): string => {
    const lotColor = lotColors.find(lc => lc.lot === lot)
    return lotColor?.color || '#475569'
  }

  const getLotGradient = (lot: string): string => {
    const lotColor = lotColors.find(lc => lc.lot === lot)
    return lotColor?.gradient || 'linear-gradient(135deg, #475569 0%, #64748b 100%)'
  }

  const getLotShortCode = (lot: string): string => {
    const lotColor = lotColors.find(lc => lc.lot === lot)
    return lotColor?.shortCode || lot.slice(0, 3)
  }

  // Efficiency heatmap color calculation
  const getEfficiencyColor = (efficiency?: number): string => {
    if (!efficiency || !highlightEfficiency) {
      return 'transparent'
    }
    // Normalize efficiency (0.5-1.5 range) to 0-1
    const normalized = Math.max(0, Math.min(1, (efficiency - 0.5) / 1.0))
    // Green (good) to Red (bad) gradient
    if (normalized > 0.5) {
      // Green to yellow (0.5-1.0)
      const ratio = (normalized - 0.5) * 2
      const r = Math.round(34 + (234 - 34) * ratio)
      const g = Math.round(197 + (179 - 197) * ratio)
      const b = Math.round(94 + (8 - 94) * ratio)
      return `rgba(${r}, ${g}, ${b}, 0.3)`
    } else {
      // Yellow to red (0-0.5)
      const ratio = normalized * 2
      const r = Math.round(234 + (239 - 234) * ratio)
      const g = Math.round(179 + (68 - 179) * ratio)
      const b = Math.round(8 + (68 - 8) * ratio)
      return `rgba(${r}, ${g}, ${b}, 0.3)`
    }
  }

  const getEfficiencyStrokeColor = (efficiency?: number): string => {
    if (!efficiency || !highlightEfficiency) {
      return 'white'
    }
    const normalized = Math.max(0, Math.min(1, (efficiency - 0.5) / 1.0))
    if (normalized > 0.5) {
      return '#22c55e'
    } else if (normalized > 0.3) {
      return '#eab308'
    } else {
      return '#ef4444'
    }
  }

  // Filter lots based on search query
  const filteredLots = useMemo(() => {
    if (!searchQuery.trim()) return lotColors
    
    const query = searchQuery.toLowerCase()
    return lotColors.filter(lc => 
      lc.lot.toLowerCase().includes(query) || 
      lc.shortCode.toLowerCase().includes(query)
    )
  }, [lotColors, searchQuery])

  // Calculate time range with minimal buffer
  const timeRange = useMemo(() => {
    if (timelineSteps.length === 0) {
      const now = new Date()
      return {
        start: new Date(now.getTime() - 24 * 60 * 60 * 1000),
        end: now,
        duration: 24 * 60 * 60 * 1000
      }
    }

    const times = timelineSteps.map(s => s.when.getTime())
    const start = Math.min(...times)
    const end = Math.max(...times)
    const buffer = Math.max((end - start) * 0.01, 60 * 1000)
    const duration = (end - start) + 2 * buffer || 1

    return {
      start: new Date(start - buffer),
      end: new Date(end + buffer),
      duration
    }
  }, [timelineSteps])

  // Helper functions for position calculation
  const getXPosition = (when: Date, width: number, leftPadding: number, rightPadding: number): number => {
    const ratio = (when.getTime() - timeRange.start.getTime()) / timeRange.duration
    const availableWidth = width - leftPadding - rightPadding
    return leftPadding + ratio * availableWidth
  }

  const getYPosition = (stage: string, height: number, topPadding: number, bottomPadding: number): number => {
    const stageIndex = uniqueStages.indexOf(stage)
    const laneHeight = (height - topPadding - bottomPadding) / Math.max(1, uniqueStages.length)
    return topPadding + stageIndex * laneHeight + laneHeight / 2
  }

  // Get flow connections - use transferSourceRunIds when available for accurate connections
  const flowConnections = useMemo(() => {
    const connections: Array<{ from: TimelineStep; to: TimelineStep }> = []
    
    // Create a map of step ID to step for quick lookup
    const stepMap = new Map<string, TimelineStep>()
    timelineSteps.forEach(step => {
      stepMap.set(step.id, step)
    })
    
    // Debug: log all steps with their transferSourceRunIds
    console.log('[ProductionFlowTab] Flow connections debug - All steps:', timelineSteps.map(step => ({
      id: step.id,
      stage: step.stage,
      stageId: step.stageId,
      lot: step.lot,
      qty: step.good,
      transferSourceRunIds: (step.run as any)?.transferSourceRunIds
    })))
    
    // Debug: Check allRuns to see if MAX FOLDER GLUER run has transferSourceRunIds
    console.log('[ProductionFlowTab] Debug - All runs (including transfers):', JSON.stringify(allRuns.map(run => ({
      id: run.id,
      stageId: run.stageId,
      stage: workflows.flatMap(wf => wf.stages || []).find(s => s.id === run.stageId)?.name || run.stageId,
      lot: run.lot,
      qtyGood: run.qtyGood,
      transferSourceRunIds: (run as any)?.transferSourceRunIds,
      isInTimeline: timelineSteps.some(s => s.id === run.id)
    })), null, 2))
    
    // Also create a map of all run IDs to runs (including transferSourceRunIds info from allRuns)
    // This is important because timelineSteps might filter out some runs, but we need transferSourceRunIds info
    const allRunsMap = new Map<string, any>()
    allRuns.forEach(run => {
      allRunsMap.set(run.id, run)
    })
    
    const lotsToProcess = selectedLot ? [selectedLot] : uniqueLots
    
    lotsToProcess.forEach(lot => {
      const lotSteps = timelineSteps
        .filter(s => s.lot === lot)
        .sort((a, b) => a.when.getTime() - b.when.getTime())
      
      const wf = workflows.find(w => w.id === (job as any).workflowId)
      const plannedIds: string[] = Array.isArray((job as any).plannedStageIds) 
        ? (job as any).plannedStageIds 
        : []
      const stageOrder = (wf?.stages || [])
        .filter(s => plannedIds.length === 0 || plannedIds.includes(s.id))
        .sort((a, b) => a.order - b.order)
        .map(s => s.id)
      
      // Group steps by stage
      const stepsByStage = new Map<string, TimelineStep[]>()
      lotSteps.forEach(step => {
        const existing = stepsByStage.get(step.stageId) || []
        existing.push(step)
        stepsByStage.set(step.stageId, existing)
      })
      
      // Create connections between consecutive stages
      for (let i = 0; i < stageOrder.length - 1; i++) {
        const fromStageId = stageOrder[i]
        const toStageId = stageOrder[i + 1]
        const fromSteps = stepsByStage.get(fromStageId) || []
        const toSteps = stepsByStage.get(toStageId) || []
        
        if (fromSteps.length === 0 || toSteps.length === 0) continue
        
        // First, handle connections based on transferSourceRunIds (actual transfer relationships)
        toSteps.forEach((toStep) => {
          // Check both toStep.run and allRunsMap for transferSourceRunIds
          // (allRunsMap might have more complete data)
          const toRunFromAllRuns = allRunsMap.get(toStep.id)
          const toRun = toRunFromAllRuns || (toStep.run as any)
          
          if (toRun?.transferSourceRunIds && Array.isArray(toRun.transferSourceRunIds) && toRun.transferSourceRunIds.length > 0) {
            console.log('[ProductionFlowTab] Found to-step with transferSourceRunIds:', {
              toStepId: toStep.id,
              toStageId: toStep.stageId,
              fromStageId,
              transferSourceRunIds: toRun.transferSourceRunIds,
              toStepLot: toStep.lot
            })
            // This step was transferred from specific source runs
            toRun.transferSourceRunIds.forEach((sourceRunId: string) => {
              const sourceStep = stepMap.get(String(sourceRunId))
              console.log('[ProductionFlowTab] Looking for source step:', {
                sourceRunId,
                found: !!sourceStep,
                sourceStepId: sourceStep?.id,
                sourceStageId: sourceStep?.stageId,
                expectedFromStageId: fromStageId,
                matches: sourceStep?.stageId === fromStageId
              })
              // Source step must exist in timelineSteps and be in the fromStage
              if (sourceStep && sourceStep.stageId === fromStageId) {
                // Only add if not already connected
                const alreadyConnected = connections.some(
                  conn => conn.from.id === sourceStep.id && conn.to.id === toStep.id
                )
                if (!alreadyConnected) {
                  console.log('[ProductionFlowTab] Creating transfer-based connection:', {
                    from: sourceStep.id,
                    to: toStep.id,
                    fromStage: sourceStep.stage,
                    toStage: toStep.stage
                  })
                  connections.push({ from: sourceStep, to: toStep })
                }
              } else if (sourceStep) {
                // Debug: log if sourceStep is found but in wrong stage
                console.log('[ProductionFlowTab] Transfer source step found but in wrong stage:', {
                  sourceRunId,
                  sourceStepId: sourceStep.id,
                  sourceStageId: sourceStep.stageId,
                  expectedFromStageId: fromStageId,
                  toStepId: toStep.id,
                  toStageId: toStep.stageId
                })
              } else {
                console.warn('[ProductionFlowTab] Source step not found in timelineSteps:', {
                  sourceRunId,
                  availableStepIds: Array.from(stepMap.keys())
                })
              }
            })
          }
        })
        
        // Then, connect remaining to-steps that don't have transferSourceRunIds
        // But first, try to infer connections from allRunsMap if available
        toSteps.forEach((toStep) => {
          // Check both toStep.run and allRunsMap for transferSourceRunIds
          const toRunFromAllRuns = allRunsMap.get(toStep.id)
          const toRun = toRunFromAllRuns || (toStep.run as any)
          const hasTransferConnection = connections.some(
            conn => conn.to.id === toStep.id
          )
          
          // If this to-step doesn't have a transfer-based connection, use chronological approach
          if (!hasTransferConnection && (!toRun?.transferSourceRunIds || !Array.isArray(toRun.transferSourceRunIds) || toRun.transferSourceRunIds.length === 0)) {
            // Try to infer connection: if there's exactly one from-step with matching quantity, connect to it
            // This handles cases where transferSourceRunIds was not set but we can infer the connection
            const matchingQuantitySteps = fromSteps.filter(fromStep => {
              // If quantities match exactly, it's likely a direct connection
              return fromStep.good === toStep.good
            })
            
            let connected = false
            if (matchingQuantitySteps.length === 1) {
              // Single match with exact quantity - likely the correct connection
              const matchedStep = matchingQuantitySteps[0]
              const alreadyConnected = connections.some(
                conn => conn.from.id === matchedStep.id && conn.to.id === toStep.id
              )
              if (!alreadyConnected) {
                console.log('[ProductionFlowTab] Inferred connection from matching quantity:', {
                  from: matchedStep.id,
                  to: toStep.id,
                  quantity: toStep.good,
                  fromStage: matchedStep.stage,
                  toStage: toStep.stage
                })
                connections.push({ from: matchedStep, to: toStep })
                connected = true
              }
            }
            
            // If no quantity match, use chronological approach
            if (!connected) {
              // Find from-steps that happen before this to-step
              const validFromSteps = fromSteps.filter(fromStep => 
                fromStep.when.getTime() <= toStep.when.getTime()
              )
              
              if (validFromSteps.length > 0) {
                // Connect to the latest from-step (closest in time)
                const latestFromStep = validFromSteps.reduce((latest, current) => 
                  current.when.getTime() > latest.when.getTime() ? current : latest
                )
                connections.push({ from: latestFromStep, to: toStep })
              } else if (fromSteps.length > 0) {
                // If no from-step happens before, connect to the earliest to-step from the latest from-step
                const latestFromStep = fromSteps.reduce((latest, current) => 
                  current.when.getTime() > latest.when.getTime() ? current : latest
                )
                connections.push({ from: latestFromStep, to: toStep })
              }
            }
          }
        })
        
        // Finally, connect any remaining from-steps that don't have outgoing connections
        // BUT ONLY to to-steps that don't have transferSourceRunIds (because those should only connect via transferSourceRunIds)
        // AND only if the to-step is not already connected with a quantity match
        fromSteps.forEach((fromStep) => {
          const hasOutgoingConnection = connections.some(
            conn => conn.from.id === fromStep.id && toSteps.includes(conn.to)
          )
          
          if (!hasOutgoingConnection && toSteps.length > 0) {
            // Only connect to to-steps that don't have transferSourceRunIds
            // (to-steps with transferSourceRunIds should only connect via those IDs, not chronologically)
            const toStepsWithoutTransfer = toSteps.filter(toStep => {
              const toRunFromAllRuns = allRunsMap.get(toStep.id)
              const toRun = toRunFromAllRuns || (toStep.run as any)
              return !toRun?.transferSourceRunIds || !Array.isArray(toRun.transferSourceRunIds) || toRun.transferSourceRunIds.length === 0
            })
            
            // Filter out to-steps that are already connected with a quantity match
            // (if a to-step already has a connection from a run with matching quantity, don't connect from a different run)
            const availableToSteps = toStepsWithoutTransfer.filter(toStep => {
              const existingConnections = connections.filter(conn => conn.to.id === toStep.id)
              // If there's a connection with matching quantity, don't allow another connection
              const hasQuantityMatch = existingConnections.some(conn => conn.from.good === toStep.good)
              if (hasQuantityMatch && fromStep.good !== toStep.good) {
                console.log('[ProductionFlowTab] Skipping connection - to-step already has quantity-matched connection:', {
                  fromStepId: fromStep.id,
                  fromQty: fromStep.good,
                  toStepId: toStep.id,
                  toQty: toStep.good,
                  existingConnections: existingConnections.map(c => ({ from: c.from.id, fromQty: c.from.good, toQty: c.to.good }))
                })
                return false
              }
              return true
            })
            
            if (availableToSteps.length > 0) {
              console.log('[ProductionFlowTab] Creating chronological connection (no transferSourceRunIds):', {
                fromStepId: fromStep.id,
                fromStage: fromStep.stage,
                fromQty: fromStep.good,
                toStepsAvailable: availableToSteps.map(t => ({ id: t.id, stage: t.stage, qty: t.good, hasTransfer: !!(t.run as any)?.transferSourceRunIds }))
              })
              // Connect to the earliest to-step without transfer that happens after this from-step
              const validToSteps = availableToSteps.filter(toStep => 
                toStep.when.getTime() >= fromStep.when.getTime()
              )
              
              if (validToSteps.length > 0) {
                const closestToStep = validToSteps.reduce((closest, current) => 
                  current.when.getTime() < closest.when.getTime() ? current : closest
                )
                console.log('[ProductionFlowTab] Chronological connection created:', {
                  from: fromStep.id,
                  to: closestToStep.id,
                  fromStage: fromStep.stage,
                  toStage: closestToStep.stage,
                  fromQty: fromStep.good,
                  toQty: closestToStep.good
                })
                connections.push({ from: fromStep, to: closestToStep })
              } else if (availableToSteps.length > 0) {
                // Connect to the earliest to-step without transfer overall
                const earliestToStep = availableToSteps.reduce((earliest, current) => 
                  current.when.getTime() < earliest.when.getTime() ? current : earliest
                )
                console.log('[ProductionFlowTab] Chronological connection created (earliest):', {
                  from: fromStep.id,
                  to: earliestToStep.id,
                  fromStage: fromStep.stage,
                  toStage: earliestToStep.stage,
                  fromQty: fromStep.good,
                  toQty: earliestToStep.good
                })
                connections.push({ from: fromStep, to: earliestToStep })
              }
            } else {
              console.log('[ProductionFlowTab] Skipping chronological connection - no available to-steps:', {
                fromStepId: fromStep.id,
                fromStage: fromStep.stage,
                fromQty: fromStep.good,
                toStepsWithoutTransfer: toStepsWithoutTransfer.map(t => ({ id: t.id, stage: t.stage, qty: t.good })),
                allToSteps: toSteps.map(t => ({ id: t.id, stage: t.stage, qty: t.good, transferSourceRunIds: (t.run as any)?.transferSourceRunIds }))
              })
            }
            // If all to-steps have transferSourceRunIds or are already connected with quantity matches, don't create chronological connections
          }
        })
      }
    })
    
    console.log('[ProductionFlowTab] Final flow connections:', JSON.stringify(connections.map(conn => {
      const toRunFromAllRuns = allRunsMap.get(conn.to.id)
      const toRun = toRunFromAllRuns || (conn.to.run as any)
      return {
        from: { id: conn.from.id, stage: conn.from.stage, lot: conn.from.lot, qty: conn.from.good },
        to: { id: conn.to.id, stage: conn.to.stage, lot: conn.to.lot, qty: conn.to.good },
        toTransferSourceRunIds: toRun?.transferSourceRunIds,
        toRunFromAllRuns: !!toRunFromAllRuns
      }
    }), null, 2))
    
    return connections
  }, [timelineSteps, uniqueLots, workflows, job, selectedLot, allRuns])

  // Format functions
  const formatTime = (date: Date): string => {
    if (timeScale === 'hours') {
      return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      })
    } else if (timeScale === 'weeks') {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: '2-digit'
      })
    }
    
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    })
  }

  // Calculate metrics
  const efficiencyMetrics = useMemo(() => {
    if (timelineSteps.length < 2) return null
    
    const firstStep = timelineSteps[0]
    const lastStep = timelineSteps[timelineSteps.length - 1]
    const totalTime = lastStep.when.getTime() - firstStep.when.getTime()
    const hours = Math.floor(totalTime / (1000 * 60 * 60))
    const minutes = Math.floor((totalTime % (1000 * 60 * 60)) / (1000 * 60))
    
    const totalQuantity = timelineSteps.reduce((sum, step) => sum + step.good, 0)
    const avgPerStep = totalQuantity / timelineSteps.length
    
    return {
      totalTime: { hours, minutes },
      totalQuantity,
      avgPerStep,
      stepCount: timelineSteps.length
    }
  }, [timelineSteps])

  // Enhanced metrics with stage-specific stats
  const stageMetrics = useMemo(() => {
    const metrics: Record<string, {
      totalQuantity: number
      avgQuantity: number
      minQuantity: number
      maxQuantity: number
      stepCount: number
      duration?: number
      efficiency?: number
    }> = {}

    uniqueStages.forEach(stage => {
      const stageSteps = timelineSteps.filter(s => s.stage === stage)
      if (stageSteps.length > 0) {
        const quantities = stageSteps.map(s => s.good)
        const total = quantities.reduce((a, b) => a + b, 0)
        
        const times = stageSteps.map(s => s.when.getTime())
        const duration = Math.max(...times) - Math.min(...times)
        
        const avgQuantity = stageSteps.length > 0 ? total / stageSteps.length : 0
        const totalAllStages = timelineSteps.reduce((sum, step) => sum + step.good, 0)
        const efficiency = totalAllStages > 0 ? (total / totalAllStages) * 100 : 0
        
        metrics[stage] = {
          totalQuantity: total,
          avgQuantity: Math.round(avgQuantity),
          minQuantity: Math.min(...quantities),
          maxQuantity: Math.max(...quantities),
          stepCount: stageSteps.length,
          duration: duration,
          efficiency: Math.round(efficiency * 10) / 10
        }
      }
    })

    return metrics
  }, [timelineSteps, uniqueStages])

  // Machine utilization analysis
  const machineUtilization: MachineUtilization[] = useMemo(() => {
    const machineData = new Map<string, { totalTime: number, activeTime: number, runs: number }>()
    
    timelineSteps.forEach(step => {
      if (!machineData.has(step.machine)) {
        machineData.set(step.machine, { totalTime: 0, activeTime: 0, runs: 0 })
      }
      const data = machineData.get(step.machine)!
      
      data.runs += 1
      data.activeTime += 60 * 60 * 1000
    })
    
    const totalAvailableTime = 8 * 7 * 60 * 60 * 1000
    
    return Array.from(machineData.entries()).map(([machine, data]) => ({
      machine,
      utilization: (data.activeTime / totalAvailableTime) * 100,
      efficiency: data.runs > 0 ? (data.activeTime / (data.runs * 60 * 60 * 1000)) * 100 : 0,
      totalRuns: data.runs
    })).sort((a, b) => b.utilization - a.utilization)
  }, [timelineSteps])

  // Performance insights with ML recommendations
  const performanceInsights: PerformanceInsight[] = useMemo(() => {
    const insights: PerformanceInsight[] = []

    // Bottleneck analysis
    const stageThroughput = new Map<string, number>()
    uniqueStages.forEach(stage => {
      const stageSteps = timelineSteps.filter(s => s.stage === stage)
      if (stageSteps.length > 0) {
        const times = stageSteps.map(s => s.when.getTime())
        const duration = Math.max(...times) - Math.min(...times)
        const totalQuantity = stageSteps.reduce((sum, step) => sum + step.good, 0)
        const throughput = totalQuantity / (duration / (1000 * 60 * 60))
        stageThroughput.set(stage, throughput)
      }
    })

    const avgThroughput = Array.from(stageThroughput.values()).reduce((a, b) => a + b, 0) / stageThroughput.size
    const bottlenecks = Array.from(stageThroughput.entries())
      .filter(([_, throughput]) => throughput < avgThroughput * 0.7)
      .sort((a, b) => a[1] - b[1])

    if (bottlenecks.length > 0) {
      bottlenecks.forEach(([stage, throughput]) => {
        insights.push({
          type: 'warning',
          message: `Low throughput in ${stage}`,
          details: `Throughput: ${throughput.toFixed(2)} units/hour (${((throughput / avgThroughput) * 100).toFixed(0)}% of average)`,
          severity: throughput < avgThroughput * 0.5 ? 'critical' : 'high',
          action: {
            label: 'Optimize workflow',
            handler: () => {
              console.log(`Optimizing ${stage}`)
            }
          }
        })
      })
    }

    // Quality trend analysis
    const qualityTrends = uniqueStages.map(stage => {
      const stageSteps = timelineSteps.filter(s => s.stage === stage)
      if (stageSteps.length < 3) return null
      
      const recentQuality = stageSteps.slice(-3).reduce((sum, step) => sum + (step.qualityScore || 1), 0) / 3
      const historicalQuality = stageSteps.slice(0, -3).reduce((sum, step) => sum + (step.qualityScore || 1), 0) / Math.max(1, stageSteps.length - 3)
      
      return { stage, recentQuality, historicalQuality, trend: recentQuality - historicalQuality }
    }).filter(Boolean)

    qualityTrends.forEach(trend => {
      if (trend!.trend < -0.1) {
        insights.push({
          type: 'critical',
          message: `Quality decline in ${trend!.stage}`,
          details: `Quality score dropped by ${Math.abs(trend!.trend * 100).toFixed(1)}%`,
          severity: 'critical',
          action: {
            label: 'Investigate quality issues',
            handler: () => {
              console.log(`Investigating quality in ${trend!.stage}`)
            }
          }
        })
      }
    })

    // Efficiency outliers
    const efficiencyOutliers = timelineSteps.filter(step => step.efficiency && step.efficiency < 0.8)
    if (efficiencyOutliers.length > 0) {
      const outlierGroups = efficiencyOutliers.reduce((groups, step) => {
        const key = step.stage
        groups[key] = (groups[key] || 0) + 1
        return groups
      }, {} as Record<string, number>)

      Object.entries(outlierGroups).forEach(([stage, count]) => {
        insights.push({
          type: 'warning',
          message: `${count} low-efficiency runs in ${stage}`,
          details: `Consider reviewing equipment or operator performance`,
          severity: count > 3 ? 'high' : 'medium',
          action: {
            label: 'Review efficiency metrics',
            handler: () => {
              console.log(`Reviewing efficiency in ${stage}`)
            }
          }
        })
      })
    }

    // Machine utilization alerts
    if (showMachineUtilization) {
      machineUtilization.forEach(machine => {
        if (machine.utilization > 90) {
          insights.push({
            type: 'warning',
            message: `High utilization on ${machine.machine}`,
            details: `${machine.utilization.toFixed(1)}% utilization - consider preventive maintenance`,
            severity: 'high',
            action: {
              label: 'Schedule maintenance',
              handler: () => {
                console.log(`Scheduling maintenance for ${machine.machine}`)
              }
            }
          })
        }
        if (machine.efficiency < 70) {
          insights.push({
            type: 'info',
            message: `Low efficiency on ${machine.machine}`,
            details: `Efficiency: ${machine.efficiency.toFixed(1)}%`,
            severity: 'medium',
            action: {
              label: 'Optimize machine usage',
              handler: () => {
                console.log(`Optimizing ${machine.machine}`)
              }
            }
          })
        }
      })
    }

    return insights.sort((a, b) => {
      const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 }
      return severityOrder[b.severity] - severityOrder[a.severity]
    })
  }, [timelineSteps, uniqueStages, showMachineUtilization, machineUtilization])

  // Forecast data
  const forecastData: ForecastData[] = useMemo(() => {
    if (!showForecast) return []
    
    return uniqueStages.map(stage => {
      const stageSteps = timelineSteps.filter(s => s.stage === stage)
      const lastStep = stageSteps[stageSteps.length - 1]
      
      if (!lastStep) return null
      
      const avgQuantity = stageMetrics[stage]?.avgQuantity || 0
      const predictedQuantity = avgQuantity * (Math.random() * 0.2 + 0.9)
      const confidence = Math.random() * 0.2 + 0.7
      
      const lastTime = lastStep.when.getTime()
      const avgDuration = stageMetrics[stage]?.duration || 0
      const estimatedCompletion = new Date(lastTime + avgDuration)
      
      const recommendations = []
      if (confidence < 0.8) recommendations.push('Increase monitoring')
      if (predictedQuantity < avgQuantity * 0.9) recommendations.push('Check equipment')
      if (stageSteps.length > 10) recommendations.push('Schedule maintenance')
      
      return {
        stage,
        predictedQuantity: Math.round(predictedQuantity),
        confidence: Math.round(confidence * 100),
        estimatedCompletion,
        recommendedActions: recommendations
      }
    }).filter(Boolean) as ForecastData[]
  }, [uniqueStages, timelineSteps, stageMetrics, showForecast])

  // AI-powered recommendations
  const getAIRecommendations = useCallback((): AIRecommendation[] => {
    const recommendations: AIRecommendation[] = []
    
    const bottleneckStages = performanceInsights.filter(i => i.message.includes('bottleneck') || i.message.includes('throughput'))
    if (bottleneckStages.length > 0) {
      recommendations.push({
        type: 'optimization',
        title: 'Process Optimization',
        description: `Consider parallel processing for ${bottleneckStages.length} bottleneck stages`,
        impact: 'high',
        implementation: 'medium'
      })
    }

    const qualityIssues = performanceInsights.filter(i => i.message.includes('quality'))
    if (qualityIssues.length > 0) {
      recommendations.push({
        type: 'quality',
        title: 'Quality Control Enhancement',
        description: 'Implement additional quality checkpoints',
        impact: 'high',
        implementation: 'low'
      })
    }

    if (machineUtilization.some(m => m.efficiency < 70)) {
      recommendations.push({
        type: 'efficiency',
        title: 'Machine Efficiency Improvement',
        description: 'Schedule operator training and machine calibration',
        impact: 'medium',
        implementation: 'medium'
      })
    }

    return recommendations
  }, [performanceInsights, machineUtilization])

  // Update container width on resize
  useEffect(() => {
    const updateWidth = () => {
      if (timelineContainerRef.current) {
        const legendWidth = showLegend ? 256 : 0
        const padding = 32
        const gap = 16
        const availableWidth = timelineContainerRef.current.offsetWidth - legendWidth - padding - gap
        // Use full available width, minimum 800px
        setContainerWidth(Math.max(800, availableWidth))
      } else if (isFullscreen && containerRef.current) {
        // In fullscreen, use window width minus padding
        const padding = 48
        const legendWidth = showLegend ? 256 : 0
        const gap = 16
        const availableWidth = window.innerWidth - legendWidth - padding - gap
        setContainerWidth(Math.max(1200, availableWidth))
      }
    }
    
    updateWidth()
    const resizeObserver = new ResizeObserver(updateWidth)
    if (timelineContainerRef.current) {
      resizeObserver.observe(timelineContainerRef.current)
    }
    if (isFullscreen && containerRef.current) {
      resizeObserver.observe(containerRef.current)
    }
    
    window.addEventListener('resize', updateWidth)
    return () => {
      resizeObserver.disconnect()
      window.removeEventListener('resize', updateWidth)
    }
  }, [showLegend, isFullscreen])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }

      switch (e.key) {
        case 'Escape':
          if (selectedLot) {
            setSelectedLot(null)
          } else if (isFullscreen) {
            document.exitFullscreen()
          }
          break
        case 'l':
        case 'L':
          if (e.ctrlKey) {
            e.preventDefault()
            setShowLegend(!showLegend)
          }
          break
        case 'm':
        case 'M':
          if (e.ctrlKey) {
            e.preventDefault()
            setShowMetrics(!showMetrics)
          }
          break
        case 'f':
        case 'F':
          if (e.ctrlKey) {
            e.preventDefault()
            toggleFullscreen()
          }
          break
        case ' ':
          if (e.target === document.body) {
            e.preventDefault()
            setAnimationPaused(!animationPaused)
          }
          break
        case '+':
        case '=':
          if (e.ctrlKey) {
            e.preventDefault()
            setZoomLevel(prev => Math.min(3, prev + 0.1))
          }
          break
        case '-':
          if (e.ctrlKey) {
            e.preventDefault()
            setZoomLevel(prev => Math.max(0.5, prev - 0.1))
          }
          break
        case '0':
          if (e.ctrlKey) {
            e.preventDefault()
            setZoomLevel(1)
          }
          break
        case 'p':
        case 'P':
          if (e.ctrlKey) {
            e.preventDefault()
            setShowPerformanceOverlay(!showPerformanceOverlay)
          }
          break
        case 'a':
        case 'A':
          if (e.ctrlKey) {
            e.preventDefault()
            setShowPredictiveAnalytics(!showPredictiveAnalytics)
          }
          break
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [showLegend, showMetrics, selectedLot, toggleFullscreen, isFullscreen, animationPaused, showPerformanceOverlay, showPredictiveAnalytics])

  // SVG dimensions - make it use available height better
  const svgWidth = containerWidth
  const stageLabelWidth = 160
  const padding = { left: stageLabelWidth + 20, top: 60, right: 40, bottom: 60 }
  const laneHeight = 120
  
  // Calculate available height more accurately
  const minCalculatedHeight = padding.top + padding.bottom + (uniqueStages.length * laneHeight)
  
  // Use a state to track container height for better sizing
  const [containerHeight, setContainerHeight] = useState(600)
  
  useEffect(() => {
    const updateHeight = () => {
      if (svgContainerRef.current) {
        const height = svgContainerRef.current.offsetHeight || svgContainerRef.current.clientHeight
        if (height > 0) {
          setContainerHeight(height)
        }
      }
    }
    
    updateHeight()
    const resizeObserver = new ResizeObserver(updateHeight)
    if (svgContainerRef.current) {
      resizeObserver.observe(svgContainerRef.current)
    }
    
    window.addEventListener('resize', updateHeight)
    return () => {
      resizeObserver.disconnect()
      window.removeEventListener('resize', updateHeight)
    }
  }, [isFullscreen, showLegend, showMetrics])
  
  const svgHeight = Math.max(
    minCalculatedHeight,
    containerHeight - 20 // Leave some padding
  )

  // Calculate positions with collision detection
  const stepPositions = useMemo(() => {
    const positions = new Map<string, { x: number; y: number; offset: number }>()
    const blockWidth = 90
    const minSpacing = 15
    
    // Group steps by stage
    const stepsByStage = new Map<string, TimelineStep[]>()
    timelineSteps.forEach(step => {
      if (!stepsByStage.has(step.stage)) {
        stepsByStage.set(step.stage, [])
      }
      stepsByStage.get(step.stage)!.push(step)
    })
    
    // Calculate positions for each stage
    stepsByStage.forEach((steps, stage) => {
      // Sort by time
      const sortedSteps = [...steps].sort((a, b) => a.when.getTime() - b.when.getTime())
      const y = getYPosition(stage, svgHeight, padding.top, padding.bottom)
      
      if (sortedSteps.length === 1) {
        const x = getXPosition(sortedSteps[0].when, svgWidth, padding.left, padding.right)
        positions.set(sortedSteps[0].id, { x, y, offset: 0 })
      } else {
        const totalTimeSpan = sortedSteps[sortedSteps.length - 1].when.getTime() - sortedSteps[0].when.getTime()
        const minTimeBetween = totalTimeSpan / (sortedSteps.length - 1)
        
        sortedSteps.forEach((step, index) => {
          let x: number
          
          if (minTimeBetween > 0) {
            x = getXPosition(step.when, svgWidth, padding.left, padding.right)
          } else {
            const spacing = (svgWidth - padding.left - padding.right - (sortedSteps.length * blockWidth)) / (sortedSteps.length + 1)
            x = padding.left + spacing + (index * (blockWidth + spacing)) + blockWidth / 2
          }
          
          positions.set(step.id, { x, y, offset: 0 })
        })
      }
    })
    
    return positions
  }, [timelineSteps, timeRange, svgWidth, svgHeight, padding, uniqueStages])

  // Enhanced tooltip position calculation
  const getTooltipPosition = useCallback(() => {
    if (!hoveredStep) return { left: '50%', top: '50%' }

    const svgRect = svgContainerRef.current?.getBoundingClientRect()
    if (!svgRect) return { left: '50%', top: '50%' }

    const step = timelineSteps.find(s => s.id === hoveredStep)
    if (!step) return { left: '50%', top: '50%' }

    const position = stepPositions.get(step.id)
    if (!position) return { left: '50%', top: '50%' }

    const tooltipWidth = 320
    const tooltipHeight = 240
    let left = svgRect.left + position.x + 20
    let top = svgRect.top + position.y - tooltipHeight / 2

    // Adjust if near edges
    if (left + tooltipWidth > window.innerWidth - 20) {
      left = svgRect.left + position.x - tooltipWidth - 20
    }
    if (top < 20) {
      top = 20
    }
    if (top + tooltipHeight > window.innerHeight - 20) {
      top = window.innerHeight - tooltipHeight - 20
    }

    return { left: `${left}px`, top: `${top}px` }
  }, [hoveredStep, timelineSteps, stepPositions])

  // Event handlers
  const handleStepHover = (_e: React.MouseEvent<SVGGElement>, stepId: string) => {
    setHoveredStep(stepId)
  }

  const handleStepLeave = () => {
    setHoveredStep(null)
  }

  const hoveredStepData = hoveredStep ? timelineSteps.find(s => s.id === hoveredStep) : null

  // Truncate long stage names
  const truncateStageName = (name: string, maxLength: number = 15): string => {
    if (name.length <= maxLength) return name
    return name.substring(0, maxLength - 3) + '...'
  }

  // Export functions
  const exportAsPNG = useCallback(() => {
    // Only export PNG for Flow view (SVG exists)
    if (viewMode !== 'flow') {
      alert('PNG export is only available for Flow view. Please switch to Flow view to export as PNG.')
      return
    }
    
    const svgElement = svgContainerRef.current?.querySelector('svg')
    if (!svgElement) {
      alert('No diagram found to export. Please ensure the Flow view is loaded.')
      return
    }
    
    try {
      // Clone SVG to avoid modifying the original
      const clonedSvg = svgElement.cloneNode(true) as SVGElement
      
      // Set explicit dimensions
      clonedSvg.setAttribute('width', String(svgWidth))
      clonedSvg.setAttribute('height', String(svgHeight))
      
      const svgData = new XMLSerializer().serializeToString(clonedSvg)
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      const img = new Image()
      
      canvas.width = svgWidth
      canvas.height = svgHeight
      
      img.onload = () => {
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height)
          ctx.drawImage(img, 0, 0)
          canvas.toBlob((blob) => {
            if (blob) {
              const url = URL.createObjectURL(blob)
              const downloadLink = document.createElement('a')
              downloadLink.href = url
              downloadLink.download = `production-flow-${(job as any).jobNumber || (job as any).code || 'diagram'}.png`
              document.body.appendChild(downloadLink)
              downloadLink.click()
              document.body.removeChild(downloadLink)
              URL.revokeObjectURL(url)
            }
          }, 'image/png')
        }
      }
      
      img.onerror = () => {
        alert('Error exporting PNG. Please try again.')
      }
      
      // Encode SVG properly
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' })
      const url = URL.createObjectURL(svgBlob)
      img.src = url
      
      // Clean up
      img.onload = () => {
        URL.revokeObjectURL(url)
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height)
          ctx.drawImage(img, 0, 0)
          canvas.toBlob((blob) => {
            if (blob) {
              const downloadUrl = URL.createObjectURL(blob)
              const downloadLink = document.createElement('a')
              downloadLink.href = downloadUrl
              downloadLink.download = `production-flow-${(job as any).jobNumber || (job as any).code || 'diagram'}.png`
              document.body.appendChild(downloadLink)
              downloadLink.click()
              document.body.removeChild(downloadLink)
              URL.revokeObjectURL(downloadUrl)
            }
          }, 'image/png')
        }
      }
    } catch (error) {
      console.error('Error exporting PNG:', error)
      alert('Error exporting PNG. Please try again.')
    }
  }, [svgWidth, svgHeight, job, viewMode])

  // Helper function to escape CSV values
  const escapeCSVValue = (value: any): string => {
    if (value === null || value === undefined) return ''
    const str = String(value)
    // If value contains comma, quote, or newline, wrap in quotes and escape quotes
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`
    }
    return str
  }

  const exportAsCSV = useCallback(() => {
    const headers = ['Step ID', 'Stage', 'Lot', 'Quantity', 'Unit', 'Machine', 'Time', 'Status', 'Efficiency']
    const csvData = timelineSteps.map(step => [
      escapeCSVValue(step.id),
      escapeCSVValue(step.stage),
      escapeCSVValue(step.lot),
      escapeCSVValue(step.good),
      escapeCSVValue(step.unit),
      escapeCSVValue(step.machine),
      escapeCSVValue(formatTime(step.when)),
      escapeCSVValue(step.status || ''),
      escapeCSVValue(step.efficiency ? (step.efficiency * 100).toFixed(2) + '%' : '')
    ])
    
    const csvContent = [
      headers.join(','),
      ...csvData.map(row => row.join(','))
    ].join('\n')
    
    // Add BOM for Excel compatibility
    const csvWithBOM = '\uFEFF' + csvContent
    
    const blob = new Blob([csvWithBOM], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    
    const downloadLink = document.createElement('a')
    downloadLink.href = url
    downloadLink.download = `production-data-${(job as any).jobNumber || (job as any).code || 'export'}.csv`
    document.body.appendChild(downloadLink)
    downloadLink.click()
    document.body.removeChild(downloadLink)
    URL.revokeObjectURL(url)
  }, [timelineSteps, job])

  const exportAsJSON = useCallback(() => {
    // Safely get metrics with fallbacks
    const exportData = {
      job: {
        id: job.id,
        code: (job as any).code,
        jobNumber: (job as any).jobNumber,
        sku: job.sku,
        productName: job.productName,
        quantity: job.quantity,
        unit: job.unit,
        status: job.status,
        currentStageId: job.currentStageId,
        workflowId: (job as any).workflowId
      },
      timelineSteps: timelineSteps.map(step => ({
        id: step.id,
        when: step.when.toISOString(),
        stage: step.stage,
        stageId: step.stageId,
        good: step.good,
        unit: step.unit,
        lot: step.lot,
        machine: step.machine,
        status: step.status,
        efficiency: step.efficiency,
        qualityScore: step.qualityScore
      })),
      metrics: efficiencyMetrics || null,
      stageMetrics: stageMetrics || {},
      insights: performanceInsights || [],
      forecast: forecastData || null,
      exportInfo: {
        exportedAt: new Date().toISOString(),
        viewMode,
        groupingMode,
        totalSteps: timelineSteps.length,
        uniqueStages: uniqueStages.length,
        uniqueLots: uniqueLots.length
      }
    }
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    
    const downloadLink = document.createElement('a')
    downloadLink.href = url
    downloadLink.download = `production-data-${(job as any).jobNumber || (job as any).code || 'export'}.json`
    document.body.appendChild(downloadLink)
    downloadLink.click()
    document.body.removeChild(downloadLink)
    URL.revokeObjectURL(url)
  }, [job, timelineSteps, efficiencyMetrics, stageMetrics, performanceInsights, forecastData, viewMode, groupingMode, uniqueStages, uniqueLots])

  // Collaborative features
  const shareView = useCallback(() => {
    const viewState = {
      selectedLot,
      timeScale,
      zoomLevel,
      viewMode,
      groupingMode,
      selectedTimeRange,
      selectedStage
    }
    
    const shareUrl = `${window.location.origin}${window.location.pathname}?view=${btoa(JSON.stringify(viewState))}`
    
    if (navigator.share) {
      navigator.share({
        title: 'Production Flow View',
        text: `Check out this production flow for job ${(job as any).jobNumber}`,
        url: shareUrl
      })
    } else {
      navigator.clipboard.writeText(shareUrl)
      alert('View URL copied to clipboard!')
    }
  }, [selectedLot, timeScale, zoomLevel, viewMode, groupingMode, selectedTimeRange, selectedStage, job])

  if (timelineSteps.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mb-4">
          <CubeIcon className="h-8 w-8 text-gray-400" />
        </div>
        <p className="text-gray-700 font-semibold text-lg mb-2">No Production Data Available</p>
        <p className="text-gray-500 text-sm">Production runs will appear here once recorded</p>
      </div>
    )
  }

  // AI Recommendations Panel
  const aiRecommendationsPanel = showPredictiveAnalytics && (
    <div className="absolute bottom-20 right-4 z-40 bg-white/95 backdrop-blur-sm border border-gray-200 rounded-lg shadow-lg p-4 w-80">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-medium text-gray-900 flex items-center gap-2">
          <CpuChipIcon className="h-5 w-5 text-blue-500" />
          AI Recommendations
        </h4>
        <button
          onClick={() => setShowPredictiveAnalytics(false)}
          className="text-gray-400 hover:text-gray-600"
        >
          ×
        </button>
      </div>
      <div className="space-y-3 max-h-80 overflow-y-auto">
        {getAIRecommendations().map((rec, idx) => (
          <div key={idx} className="p-3 bg-blue-50 border border-blue-100 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-blue-800 px-2 py-1 bg-blue-100 rounded">
                {rec.type.toUpperCase()}
              </span>
              <span className={`text-xs font-medium px-2 py-1 rounded ${
                rec.impact === 'high' ? 'bg-red-100 text-red-800' :
                rec.impact === 'medium' ? 'bg-amber-100 text-amber-800' :
                'bg-green-100 text-green-800'
              }`}>
                {rec.impact.toUpperCase()} IMPACT
              </span>
            </div>
            <h5 className="font-medium text-gray-900 text-sm">{rec.title}</h5>
            <p className="text-sm text-gray-600 mt-1">{rec.description}</p>
            <div className="flex items-center justify-between mt-3">
              <span className="text-xs text-gray-500">
                Implementation: {rec.implementation}
              </span>
              <button className="text-xs text-blue-600 hover:text-blue-800 font-medium">
                Implement →
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )

  // Forecast Panel
  const forecastPanel = showForecast && (
    <div className="absolute bottom-20 left-4 z-40 bg-white/95 backdrop-blur-sm border border-gray-200 rounded-lg shadow-lg p-4 w-96">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-medium text-gray-900 flex items-center gap-2">
          <SignalIcon className="h-5 w-5 text-green-500" />
          Production Forecast
        </h4>
        <button
          onClick={() => setShowForecast(false)}
          className="text-gray-400 hover:text-gray-600"
        >
          ×
        </button>
      </div>
      <div className="space-y-3 max-h-80 overflow-y-auto">
        {forecastData.map((forecast, idx) => (
          <div key={idx} className="p-3 bg-green-50 border border-green-100 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <h5 className="font-medium text-gray-900">{forecast.stage}</h5>
              <span className={`text-xs font-medium px-2 py-1 rounded ${
                forecast.confidence > 85 ? 'bg-green-100 text-green-800' :
                forecast.confidence > 70 ? 'bg-amber-100 text-amber-800' :
                'bg-red-100 text-red-800'
              }`}>
                {forecast.confidence}% Confidence
              </span>
            </div>
            <div className="grid grid-cols-2 gap-4 mt-2">
              <div>
                <p className="text-xs text-gray-500">Predicted Quantity</p>
                <p className="text-lg font-semibold text-gray-900">
                  {forecast.predictedQuantity.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Estimated Completion</p>
                <p className="text-sm font-medium text-gray-900">
                  {forecast.estimatedCompletion.toLocaleDateString()}
                </p>
              </div>
            </div>
            {forecast.recommendedActions.length > 0 && (
              <div className="mt-3 pt-3 border-t border-green-200">
                <p className="text-xs text-gray-500 mb-2">Recommended Actions</p>
                <div className="space-y-1">
                  {forecast.recommendedActions.map((action, actionIdx) => (
                    <div key={actionIdx} className="flex items-center gap-2 text-sm">
                      <LightBulbIcon className="h-4 w-4 text-green-500" />
                      <span>{action}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )

  // Machine Utilization Panel
  const machineUtilizationPanel = showMachineUtilization && (
    <div className="absolute top-20 right-4 z-40 bg-white/95 backdrop-blur-sm border border-gray-200 rounded-lg shadow-lg p-4 w-80">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-medium text-gray-900 flex items-center gap-2">
          <CogIcon className="h-5 w-5 text-gray-500" />
          Machine Utilization
        </h4>
        <button
          onClick={() => setShowMachineUtilization(false)}
          className="text-gray-400 hover:text-gray-600"
        >
          ×
        </button>
      </div>
      <div className="space-y-3">
        {machineUtilization.map((machine, idx) => (
          <div key={idx} className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <h5 className="font-medium text-gray-900">{machine.machine}</h5>
              <span className={`text-xs font-medium px-2 py-1 rounded ${
                machine.utilization > 90 ? 'bg-red-100 text-red-800' :
                machine.utilization > 70 ? 'bg-amber-100 text-amber-800' :
                'bg-green-100 text-green-800'
              }`}>
                {machine.utilization.toFixed(1)}%
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className={`h-2 rounded-full ${
                  machine.utilization > 90 ? 'bg-red-500' :
                  machine.utilization > 70 ? 'bg-amber-500' :
                  'bg-green-500'
                }`}
                style={{ width: `${Math.min(machine.utilization, 100)}%` }}
              />
            </div>
            <div className="grid grid-cols-2 gap-4 mt-2">
              <div>
                <p className="text-xs text-gray-500">Efficiency</p>
                <p className="text-sm font-medium text-gray-900">
                  {machine.efficiency.toFixed(1)}%
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Total Runs</p>
                <p className="text-sm font-medium text-gray-900">
                  {machine.totalRuns}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )

  // Enhanced Header Controls
  const enhancedHeaderControls = (
    <div className="flex items-center gap-2">
      {/* View mode selector */}
      <div className="flex items-center space-x-2 bg-gray-50 rounded-lg p-1">
        <button
          onClick={() => setViewMode('flow')}
          className={`px-3 py-1.5 rounded text-xs font-medium transition-colors flex items-center gap-1 ${
            viewMode === 'flow' 
              ? 'bg-white shadow-sm text-gray-900 border border-gray-200' 
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <MapIcon className="h-4 w-4" />
          Flow
        </button>
        <button
          onClick={() => setViewMode('gantt')}
          className={`px-3 py-1.5 rounded text-xs font-medium transition-colors flex items-center gap-1 ${
            viewMode === 'gantt' 
              ? 'bg-white shadow-sm text-gray-900 border border-gray-200' 
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <CalendarIcon className="h-4 w-4" />
          Gantt
        </button>
        <button
          onClick={() => setViewMode('matrix')}
          className={`px-3 py-1.5 rounded text-xs font-medium transition-colors flex items-center gap-1 ${
            viewMode === 'matrix' 
              ? 'bg-white shadow-sm text-gray-900 border border-gray-200' 
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Square3Stack3DIcon className="h-4 w-4" />
          Matrix
        </button>
      </div>

      {/* Grouping mode selector */}
      <div className="flex items-center space-x-2 bg-gray-50 rounded-lg p-1">
        <button
          onClick={() => setGroupingMode('lot')}
          className={`px-3 py-1.5 rounded text-xs font-medium transition-colors flex items-center gap-1 ${
            groupingMode === 'lot' 
              ? 'bg-white shadow-sm text-gray-900 border border-gray-200' 
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <TagIcon className="h-4 w-4" />
          By Lot
        </button>
        <button
          onClick={() => setGroupingMode('stage')}
          className={`px-3 py-1.5 rounded text-xs font-medium transition-colors flex items-center gap-1 ${
            groupingMode === 'stage' 
              ? 'bg-white shadow-sm text-gray-900 border border-gray-200' 
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <BuildingOffice2Icon className="h-4 w-4" />
          By Stage
        </button>
        <button
          onClick={() => setGroupingMode('machine')}
          className={`px-3 py-1.5 rounded text-xs font-medium transition-colors flex items-center gap-1 ${
            groupingMode === 'machine' 
              ? 'bg-white shadow-sm text-gray-900 border border-gray-200' 
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <CogIcon className="h-4 w-4" />
          By Machine
        </button>
      </div>

      {/* AI and ML features */}
      <button
        onClick={() => setShowPredictiveAnalytics(!showPredictiveAnalytics)}
        className={`px-3 py-1.5 text-xs font-medium transition-colors flex items-center gap-1.5 ${
          showPredictiveAnalytics
            ? 'bg-purple-600 text-white border border-purple-700'
            : 'text-purple-700 hover:text-purple-800 bg-purple-50 border border-purple-200 hover:bg-purple-100'
        }`}
      >
        <CpuChipIcon className="h-4 w-4" />
        AI Insights
      </button>

      <button
        onClick={() => setShowForecast(!showForecast)}
        className={`px-3 py-1.5 text-xs font-medium transition-colors flex items-center gap-1.5 ${
          showForecast
            ? 'bg-green-600 text-white border border-green-700'
            : 'text-green-700 hover:text-green-800 bg-green-50 border border-green-200 hover:bg-green-100'
        }`}
      >
        <SignalIcon className="h-4 w-4" />
        Forecast
      </button>

      <button
        onClick={() => setShowMachineUtilization(!showMachineUtilization)}
        className={`px-3 py-1.5 text-xs font-medium transition-colors flex items-center gap-1.5 ${
          showMachineUtilization
            ? 'bg-gray-600 text-white border border-gray-700'
            : 'text-gray-700 hover:text-gray-900 bg-gray-50 border border-gray-300 hover:bg-gray-100'
        }`}
      >
        <CogIcon className="h-4 w-4" />
        Machines
      </button>

      {/* Collaboration mode */}
      <button
        onClick={() => setCollaborationMode(!collaborationMode)}
        className={`px-3 py-1.5 text-xs font-medium transition-colors flex items-center gap-1.5 ${
          collaborationMode
            ? 'bg-blue-600 text-white border border-blue-700'
            : 'text-gray-700 hover:text-gray-900 bg-white border border-gray-300 hover:bg-gray-50'
        }`}
      >
        <UsersIcon className="h-4 w-4" />
        {collaborationMode ? 'Collaborating' : 'Collaborate'}
      </button>

      {/* Share view */}
      <button
        onClick={shareView}
        className="px-3 py-1.5 text-xs font-medium text-blue-700 hover:text-blue-800 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors flex items-center gap-1.5"
      >
        <ShareIcon className="h-4 w-4" />
        Share
      </button>

      {/* Export menu with more options */}
      <div className="relative">
        <button 
          onClick={() => setShowExportMenu(!showExportMenu)}
          className="px-3 py-1.5 text-xs font-medium text-gray-700 hover:text-gray-900 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-1.5"
        >
          <CloudArrowDownIcon className="h-4 w-4" />
          Export
        </button>
        {showExportMenu && (
          <>
            {/* Backdrop to close menu when clicking outside */}
            <div 
              className="fixed inset-0 z-40"
              onClick={() => setShowExportMenu(false)}
            />
            {/* Dropdown menu */}
            <div 
              className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-xl z-50"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => {
                  exportAsPNG()
                  setShowExportMenu(false)
                }}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-t-lg flex items-center gap-2 transition-colors"
              >
                <PrinterIcon className="h-4 w-4" />
                Export as PNG
              </button>
              <button
                onClick={() => {
                  exportAsCSV()
                  setShowExportMenu(false)
                }}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 transition-colors"
              >
                <DocumentTextIcon className="h-4 w-4" />
                Export as CSV
              </button>
              <button
                onClick={() => {
                  exportAsJSON()
                  setShowExportMenu(false)
                }}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 transition-colors"
              >
                <CommandLineIcon className="h-4 w-4" />
                Export as JSON
              </button>
              <button
                onClick={() => {
                  console.log('Export to ERP')
                  setShowExportMenu(false)
                }}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-b-lg flex items-center gap-2 transition-colors"
              >
                <ArrowDownTrayIcon className="h-4 w-4" />
                Export to ERP
              </button>
            </div>
          </>
        )}
      </div>

      {/* VR mode */}
      <button
        onClick={() => console.log('Launch VR view')}
        className="px-3 py-1.5 text-xs font-medium text-purple-700 hover:text-purple-800 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors flex items-center gap-1.5"
      >
        <Square3Stack3DIcon className="h-4 w-4" />
        VR View
      </button>

      {/* Picture-in-picture */}
      <button
        onClick={togglePictureInPicture}
        className="px-3 py-1.5 text-xs font-medium text-indigo-700 hover:text-indigo-800 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors flex items-center gap-1.5"
      >
        <ArrowsPointingOutIcon className="h-4 w-4" />
        PiP
      </button>
    </div>
  )

  // Collaboration annotations
  const collaborationAnnotations = collaborationMode && (
    <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50">
      <div className="bg-blue-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
        <UsersIcon className="h-5 w-5" />
        <span className="font-medium">Collaboration Mode Active</span>
        <span className="text-blue-200">• 3 users viewing</span>
      </div>
    </div>
  )

  // Real-time notification
  const realTimeNotification = realTimeUpdates && (
    <div className="fixed top-4 right-4 z-50">
      <div className="bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 animate-pulse">
        <BellIcon className="h-5 w-5" />
        <span>Real-time updates active</span>
      </div>
    </div>
  )

  // Enhanced tooltip with predictive data
  const enhancedTooltip = hoveredStepData && (
    <div 
      className="fixed z-50 bg-white rounded-lg border border-gray-200 shadow-xl p-4 w-96 pointer-events-none"
      style={getTooltipPosition()}
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div 
              className="w-3 h-3 rounded"
              style={{ background: getLotGradient(hoveredStepData.lot) }}
            />
            <h3 className="text-sm font-semibold text-gray-900">
              {truncateStageName(hoveredStepData.stage, 25)}
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
              hoveredStepData.status === 'completed' 
                ? 'bg-green-100 text-green-800' 
                : hoveredStepData.status === 'in-progress'
                ? 'bg-amber-100 text-amber-800'
                : 'bg-gray-100 text-gray-800'
            }`}>
              {hoveredStepData.status?.toUpperCase()}
            </span>
            {hoveredStepData.efficiency && (
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                hoveredStepData.efficiency > 1.1
                  ? 'bg-green-100 text-green-800'
                  : hoveredStepData.efficiency < 0.9
                  ? 'bg-red-100 text-red-800'
                  : 'bg-amber-100 text-amber-800'
              }`}>
                Efficiency: {(hoveredStepData.efficiency * 100).toFixed(0)}%
              </span>
            )}
          </div>
        </div>
        <div className="text-right">
          <div className="text-lg font-bold text-gray-900">
            {hoveredStepData.good.toLocaleString()}
          </div>
          <div className="text-xs text-gray-600">{hoveredStepData.unit}</div>
        </div>
      </div>
      
      <div className="space-y-2 border-t border-gray-100 pt-3">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-gray-500">Lot</p>
            <div className="flex items-center gap-2">
              <span className="font-medium text-gray-900">{getLotShortCode(hoveredStepData.lot)}</span>
              <div 
                className="w-2 h-2 rounded"
                style={{ background: getLotGradient(hoveredStepData.lot) }}
              />
            </div>
          </div>
          <div>
            <p className="text-xs text-gray-500">Machine</p>
            <p className="font-medium text-gray-900">{hoveredStepData.machine}</p>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-gray-500">Time</p>
            <p className="font-medium text-gray-900">{formatTime(hoveredStepData.when)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Quality Score</p>
            <div className="flex items-center gap-2">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="h-2 rounded-full bg-green-500"
                  style={{ width: `${(hoveredStepData.qualityScore || 1) * 100}%` }}
                />
              </div>
              <span className="text-xs font-medium">
                {((hoveredStepData.qualityScore || 1) * 100).toFixed(0)}%
              </span>
            </div>
          </div>
        </div>
      </div>
      
      {hoveredStepData.details && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <p className="text-xs text-gray-500 mb-1">Details</p>
          <p className="text-sm text-gray-700">{hoveredStepData.details}</p>
        </div>
      )}
      
      <div className="mt-3 pt-3 border-t border-gray-100">
        <button
          onClick={() => onRunSelect && onRunSelect(hoveredStepData.id)}
          className="w-full text-xs text-blue-600 hover:text-blue-800 font-medium text-center"
        >
          View full details →
        </button>
      </div>
    </div>
  )


  // Main return with all components
  return (
    <>
      <div 
        className="space-y-4 flex flex-col"
        style={{ height: 'calc(100vh - 200px)' }}
        ref={containerRef}
      >
      {/* Collaboration annotations */}
      {collaborationAnnotations}
      
      {/* Real-time notifications */}
      {realTimeNotification}
      
      {/* Enhanced Header */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-gray-900">Production Flow Timeline</h2>
            <div className="flex items-center gap-2">
              <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded flex items-center gap-1">
                <BoltIcon className="h-3 w-3" />
                Live
              </span>
              {realTimeUpdates && (
                <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded flex items-center gap-1">
                  <SignalIcon className="h-3 w-3" />
                  Real-time
                </span>
              )}
              <span className="text-sm text-gray-500">
                Updated {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>
          
          {enhancedHeaderControls}
        </div>
        
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Job: {(job as any).jobNumber} • {timelineSteps.length} events • {uniqueStages.length} stages
            {selectedLot && ` • Filtered to lot: ${selectedLot}`}
            {selectedStage && ` • Focused on: ${selectedStage}`}
          </p>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => setHighlightEfficiency(!highlightEfficiency)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors flex items-center gap-1.5 ${
                highlightEfficiency
                  ? 'bg-green-600 text-white border border-green-700'
                  : 'text-gray-700 hover:text-gray-900 bg-white border border-gray-300 hover:bg-gray-50'
              }`}
            >
              <ChartBarIcon className="h-4 w-4" />
              Efficiency Heatmap
            </button>
            
            <button
              onClick={() => setShowLegend(!showLegend)}
              className="px-3 py-1.5 text-xs font-medium text-gray-700 hover:text-gray-900 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-1.5"
            >
              <AdjustmentsHorizontalIcon className="h-4 w-4" />
              {showLegend ? 'Hide' : 'Show'} Legend
            </button>
            
            {selectedLot && (
              <button
                onClick={() => setSelectedLot(null)}
                className="px-3 py-1.5 text-xs font-medium text-blue-700 hover:text-blue-800 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors flex items-center gap-1.5"
              >
                Clear Filter
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Enhanced Metrics */}
      {showMetrics && (
        <div className="bg-white rounded-lg border border-gray-200 p-4 flex-shrink-0">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900">Production Metrics</h3>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowStageDetails(!showStageDetails)}
                className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
              >
                {showStageDetails ? (
                  <EyeSlashIcon className="h-4 w-4" />
                ) : (
                  <EyeIcon className="h-4 w-4" />
                )}
                {showStageDetails ? 'Hide Details' : 'Show Details'}
              </button>
              <button
                onClick={() => setShowMetrics(false)}
                className="text-xs text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>
          </div>
          
          <div className="grid grid-cols-4 gap-3 mb-3">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <p className="text-xs text-gray-500 font-medium">Total Time</p>
                <p className="text-base font-semibold text-gray-900 mt-0.5">
                  {efficiencyMetrics?.totalTime.hours || 0}h {efficiencyMetrics?.totalTime.minutes || 0}m
                </p>
              </div>
              <ClockIcon className="h-5 w-5 text-gray-400" />
            </div>
            
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <p className="text-xs text-gray-500 font-medium">Total Quantity</p>
                <p className="text-base font-semibold text-gray-900 mt-0.5">
                  {(efficiencyMetrics?.totalQuantity || 0).toLocaleString()}
                </p>
              </div>
              <CubeIcon className="h-5 w-5 text-gray-400" />
            </div>
            
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <p className="text-xs text-gray-500 font-medium">Process Steps</p>
                <p className="text-base font-semibold text-gray-900 mt-0.5">
                  {efficiencyMetrics?.stepCount || 0}
                </p>
              </div>
              <ArrowPathIcon className="h-5 w-5 text-gray-400" />
            </div>
            
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <p className="text-xs text-gray-500 font-medium">Avg per Step</p>
                <p className="text-base font-semibold text-gray-900 mt-0.5">
                  {Math.round(efficiencyMetrics?.avgPerStep || 0).toLocaleString()}
                </p>
              </div>
              <CheckCircleIcon className="h-5 w-5 text-gray-400" />
            </div>
          </div>
          
          {showStageDetails && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <h4 className="text-xs font-medium text-gray-700 mb-2">Stage Performance</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
                {uniqueStages.slice(0, 4).map(stage => {
                  const metrics = stageMetrics[stage]
                  if (!metrics) return null
                  
                  return (
                    <div key={stage} 
                         className={`p-2 rounded border cursor-pointer transition-all ${
                           selectedStage === stage 
                             ? 'bg-blue-50 border-blue-200 ring-1 ring-blue-100' 
                             : 'bg-gray-50 border-gray-200 hover:bg-white'
                         }`}
                         onClick={() => setSelectedStage(selectedStage === stage ? null : stage)}
                    >
                      <div className="text-xs font-medium text-gray-900 truncate">
                        {truncateStageName(stage, 18)}
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <div className="text-xs text-gray-500">Avg:</div>
                        <div className="text-xs font-semibold text-gray-900">
                          {metrics.avgQuantity.toLocaleString()}
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="text-xs text-gray-500">Total:</div>
                        <div className="text-xs font-semibold text-gray-900">
                          {metrics.totalQuantity.toLocaleString()}
                        </div>
                      </div>
                      {metrics.efficiency && (
                        <div className="flex items-center justify-between mt-1">
                          <div className="text-xs text-gray-500">Share:</div>
                          <div className="text-xs font-semibold text-gray-900">
                            {metrics.efficiency}%
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
                {uniqueStages.length > 4 && (
                  <div className="p-2 bg-gray-50 rounded border border-gray-200 text-center">
                    <div className="text-xs text-gray-500">
                      +{uniqueStages.length - 4} more stages
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* AI Recommendations Panel */}
      {aiRecommendationsPanel}

      {/* Forecast Panel */}
      {forecastPanel}

      {/* Machine Utilization Panel */}
      {machineUtilizationPanel}

      {/* Enhanced Tooltip */}
      {enhancedTooltip}

      {/* Main Content Area */}
      <div className="flex-1 min-h-0 bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex gap-4 h-full" ref={timelineContainerRef}>
          {/* Enhanced Legend */}
          {showLegend && (
            <div className="w-64 flex-shrink-0 flex flex-col" ref={legendRef}>
              <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 h-full">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-900">Lot Filter</h3>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 bg-white px-2 py-1 rounded border">
                      {filteredLots.length}/{uniqueLots.length}
                    </span>
                    {selectedLot && (
                      <button
                        onClick={() => setSelectedLot(null)}
                        className="text-xs text-blue-600 hover:text-blue-800"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>
                
                <div className="relative mb-3">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <MagnifyingGlassIcon className="h-4 w-4 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    placeholder="Search lots..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    >
                      <span className="text-gray-400 hover:text-gray-600">×</span>
                    </button>
                  )}
                </div>
                
                <div className="space-y-2 flex-1 overflow-y-auto pr-2">
                  {filteredLots.map(({ lot, gradient, shortCode }) => {
                    const lotSteps = timelineSteps.filter(s => s.lot === lot)
                    const totalQty = lotSteps.reduce((sum, step) => sum + step.good, 0)
                    const isSelected = selectedLot === lot
                    const isActive = activeStepIndex !== null && 
                      timelineSteps[activeStepIndex]?.lot === lot
                    
                    return (
                      <button
                        key={lot}
                        onClick={() => setSelectedLot(isSelected ? null : lot)}
                        className={`w-full flex items-center justify-between p-2.5 rounded-lg border transition-all group relative ${
                          isSelected 
                            ? 'bg-blue-50 border-blue-200 ring-1 ring-blue-100' 
                            : 'bg-white border-gray-200 hover:bg-gray-50'
                        } ${isActive ? 'ring-2 ring-green-500' : ''}`}
                      >
                        {isActive && (
                          <div className="absolute inset-0 bg-green-500/10 rounded-lg" />
                        )}
                        <div className="flex items-center gap-2.5 relative z-10">
                          <div 
                            className="w-3 h-3 rounded flex-shrink-0"
                            style={{ background: gradient }}
                          />
                          <div className="text-left">
                            <div className="text-xs font-medium text-gray-900 flex items-center gap-1">
                              {shortCode}
                              {isActive && (
                                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                              )}
                              <span className="text-gray-400 text-xs">
                                ({lotSteps.length})
                              </span>
                            </div>
                            <div className="text-xs text-gray-500 truncate max-w-[120px]">
                              {lot}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 relative z-10">
                          <span className="text-xs font-medium text-gray-700">
                            {totalQty.toLocaleString()}
                          </span>
                          {isSelected && (
                            <CheckCircleIcon className="h-4 w-4 text-blue-600 flex-shrink-0" />
                          )}
                        </div>
                      </button>
                    )
                  })}
                  {filteredLots.length === 0 && (
                    <div className="text-center py-4">
                      <div className="text-gray-400 text-sm">No lots found</div>
                      <button
                        onClick={() => setSearchQuery('')}
                        className="text-xs text-blue-600 hover:text-blue-800 mt-1"
                      >
                        Clear search
                      </button>
                    </div>
                  )}
                </div>
                
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <div className="flex items-center gap-2">
                      <InformationCircleIcon className="h-4 w-4" />
                      <span>Click lot to filter • Space to play/pause</span>
                    </div>
                    <kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded text-xs">
                      Esc
                    </kbd>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Timeline Visualization */}
          <div className="flex-1 min-w-0 min-h-0 flex flex-col">
            <div 
              ref={svgContainerRef}
              className="relative rounded border border-gray-200 bg-white flex-1 min-h-0 overflow-hidden"
              style={{ maxHeight: '100%' }}
            >
              {/* Zoom controls overlay */}
              <div className="absolute top-3 right-3 z-10 flex flex-col gap-2">
                <div className="bg-white/90 backdrop-blur-sm border border-gray-200 rounded-lg shadow-sm p-1">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setZoomLevel(Math.max(0.5, zoomLevel - 0.1))}
                      className="p-1.5 text-gray-600 hover:text-gray-900 rounded hover:bg-gray-100"
                      title="Zoom out (Ctrl -)"
                    >
                      <MagnifyingGlassMinusIcon className="h-4 w-4" />
                    </button>
                    <div className="text-xs font-medium text-gray-700 px-2 min-w-[45px] text-center">
                      {Math.round(zoomLevel * 100)}%
                    </div>
                    <button
                      onClick={() => setZoomLevel(Math.min(3, zoomLevel + 0.1))}
                      className="p-1.5 text-gray-600 hover:text-gray-900 rounded hover:bg-gray-100"
                      title="Zoom in (Ctrl +)"
                    >
                      <MagnifyingGlassPlusIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <button
                  onClick={() => setZoomLevel(1)}
                  className="bg-white/90 backdrop-blur-sm border border-gray-200 rounded-lg shadow-sm p-1.5 text-xs font-medium text-gray-700 hover:text-gray-900"
                  title="Reset zoom (Ctrl 0)"
                >
                  Reset
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    console.log('[ProductionFlowTab] Fullscreen button clicked')
                    toggleFullscreen(e)
                  }}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                  }}
                  className="bg-white/90 backdrop-blur-sm border border-gray-200 rounded-lg shadow-sm p-1.5 text-xs font-medium text-gray-700 hover:text-gray-900 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-colors flex items-center justify-center gap-1 relative z-50"
                  title={isFullscreen ? "Exit fullscreen (Esc)" : "Enter fullscreen (Ctrl+F)"}
                >
                  {isFullscreen ? (
                    <>
                      <ArrowsPointingInIcon className="h-4 w-4" />
                      <span>Exit</span>
                    </>
                  ) : (
                    <>
                      <ArrowsPointingOutIcon className="h-4 w-4" />
                      <span>Fullscreen</span>
                    </>
                  )}
                </button>
              </div>

              {/* Animation status */}
              <div className="absolute top-3 left-3 z-10">
                <div className={`px-2 py-1 rounded text-xs font-medium flex items-center gap-1 ${
                  animationPaused 
                    ? 'bg-gray-100 text-gray-700 border border-gray-200' 
                    : 'bg-green-100 text-green-800 border border-green-200'
                }`}>
                  {animationPaused ? (
                    <>
                      <PauseCircleIcon className="h-3 w-3" />
                      Paused
                    </>
                  ) : (
                    <>
                      <PlayCircleIcon className="h-3 w-3" />
                      Playing
                    </>
                  )}
                </div>
              </div>

              {viewMode === 'flow' && (
              <svg
                width="100%"
                height="100%"
                viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                preserveAspectRatio="xMidYMid meet"
                style={{ 
                  display: 'block',
                  transform: `scale(${zoomLevel})`,
                  transformOrigin: 'center'
                }}
              >
                {/* Grid pattern */}
                <defs>
                  <pattern id="gridPattern" width="40" height="40" patternUnits="userSpaceOnUse">
                    <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#f8fafc" strokeWidth="1"/>
                  </pattern>
                  
                  {lotColors.map(({ lot, gradient }) => (
                    <linearGradient
                      key={`gradient-${lot}`}
                      id={`gradient-${lot.replace(/[^a-zA-Z0-9]/g, '-')}`}
                      x1="0%" y1="0%" x2="100%" y2="100%"
                    >
                      <stop offset="0%" stopColor={gradient.split(' ')[4]} />
                      <stop offset="100%" stopColor={gradient.split(' ')[6]} />
                    </linearGradient>
                  ))}
                  
                  <filter id="dropShadow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur in="SourceAlpha" stdDeviation="2"/>
                    <feOffset dx="0" dy="2" result="offsetblur"/>
                    <feComponentTransfer>
                      <feFuncA type="linear" slope="0.15"/>
                    </feComponentTransfer>
                    <feMerge> 
                      <feMergeNode/>
                      <feMergeNode in="SourceGraphic"/> 
                    </feMerge>
                  </filter>
                  
                  <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="3" result="blur"/>
                    <feMerge>
                      <feMergeNode in="blur"/>
                      <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                  </filter>
                </defs>

                {/* Background grid */}
                <rect 
                  x={padding.left} 
                  y={padding.top} 
                  width={svgWidth - padding.left - padding.right} 
                  height={svgHeight - padding.top - padding.bottom} 
                  fill="url(#gridPattern)" 
                  stroke="#f1f5f9" 
                  strokeWidth="1"
                />

                {/* Time axis */}
                {(() => {
                  const timeSteps = 6
                  const lines = []
                  for (let i = 0; i <= timeSteps; i++) {
                    const ratio = i / timeSteps
                    const time = new Date(timeRange.start.getTime() + ratio * timeRange.duration)
                    const x = getXPosition(time, svgWidth, padding.left, padding.right)
                    
                    lines.push(
                      <g key={`time-${i}`}>
                        <line
                          x1={x}
                          y1={padding.top}
                          x2={x}
                          y2={svgHeight - padding.bottom}
                          stroke="#e2e8f0"
                          strokeWidth="1"
                        />
                        <circle 
                          cx={x} 
                          cy={svgHeight - padding.bottom + 8} 
                          r="3" 
                          fill="#475569" 
                        />
                        <text
                          x={x}
                          y={svgHeight - padding.bottom + 25}
                          textAnchor="middle"
                          className="fill-gray-600 font-medium"
                          fontSize="10"
                        >
                          {formatTime(time)}
                        </text>
                      </g>
                    )
                  }
                  return lines
                })()}

                {/* Stage swimlanes and labels */}
                {uniqueStages.map((stage, index) => {
                  const y = padding.top + index * laneHeight
                  const metrics = stageMetrics[stage]
                  const isSelected = selectedStage === stage
                  const isInventoryStage = stage === 'Inventory'
                  
                  return (
                    <g key={`lane-${stage}`}>
                      <rect
                        x={padding.left}
                        y={y}
                        width={svgWidth - padding.left - padding.right}
                        height={laneHeight}
                        fill={isInventoryStage 
                          ? 'rgba(236, 253, 245, 0.5)' // Light green background for inventory
                          : index % 2 === 0 ? 'rgba(255, 255, 255, 0.7)' : 'rgba(248, 250, 252, 0.7)'}
                        stroke={isSelected ? '#0ea5e9' : isInventoryStage ? '#10b981' : '#e2e8f0'}
                        strokeWidth={isSelected ? '2' : isInventoryStage ? '1.5' : '0.5'}
                      />
                      <rect
                        x={10}
                        y={y + 10}
                        width={stageLabelWidth - 20}
                        height={laneHeight - 20}
                        fill={isInventoryStage 
                          ? '#d1fae5' // Green background for inventory label
                          : isSelected ? '#e0f2fe' : '#f8fafc'}
                        stroke={isInventoryStage 
                          ? '#10b981' // Green border for inventory
                          : isSelected ? '#0ea5e9' : '#e2e8f0'}
                        strokeWidth={isSelected ? '2' : isInventoryStage ? '2' : '1'}
                        rx="4"
                        onClick={() => setSelectedStage(isSelected ? null : stage)}
                        style={{ cursor: 'pointer' }}
                      />
                      <text
                        x={20}
                        y={y + laneHeight / 2}
                        textAnchor="start"
                        dominantBaseline="middle"
                        className={isInventoryStage ? "fill-emerald-700 font-bold" : "fill-gray-900 font-semibold"}
                        fontSize={isInventoryStage ? "12" : "11"}
                        onClick={() => setSelectedStage(isSelected ? null : stage)}
                        style={{ cursor: 'pointer' }}
                      >
                        {index + 1}. {truncateStageName(stage, 12)}
                      </text>
                      
                      {metrics && (
                        <g transform={`translate(${stageLabelWidth - 40}, ${y + laneHeight - 25})`}>
                          <rect
                            x="0"
                            y="0"
                            width="30"
                            height="15"
                            rx="7.5"
                            fill="#dcfce7"
                            stroke="#22c55e"
                            strokeWidth="1"
                          />
                          <text
                            x="15"
                            y="7.5"
                            textAnchor="middle"
                            dominantBaseline="middle"
                            className="fill-gray-900 font-bold"
                            fontSize="8"
                          >
                            {metrics.avgQuantity > 999 ? '999+' : metrics.avgQuantity.toLocaleString()}
                          </text>
                        </g>
                      )}
                    </g>
                  )
                })}

                {/* Flow connections */}
                {flowConnections.map((conn, index) => {
                  const fromPos = stepPositions.get(conn.from.id)
                  const toPos = stepPositions.get(conn.to.id)
                  
                  if (!fromPos || !toPos) return null
                  
                  const { x: fromX, y: fromY } = fromPos
                  const { x: toX, y: toY } = toPos
                  const gradientId = `gradient-${conn.from.lot.replace(/[^a-zA-Z0-9]/g, '-')}`
                  const controlX1 = fromX + (toX - fromX) * 0.3
                  const controlY1 = fromY
                  const controlX2 = fromX + (toX - fromX) * 0.7
                  const controlY2 = toY
                  
                  const isActive = activeStepIndex !== null && 
                    (timelineSteps[activeStepIndex]?.id === conn.from.id || 
                     timelineSteps[activeStepIndex]?.id === conn.to.id)

                  return (
                    <g 
                      key={`flow-${index}`} 
                      opacity={selectedLot && selectedLot !== conn.from.lot ? 0.15 : 0.7}
                    >
                      <path
                        d={`M ${fromX} ${fromY} C ${controlX1} ${controlY1}, ${controlX2} ${controlY2}, ${toX} ${toY}`}
                        stroke={`url(#${gradientId})`}
                        strokeWidth={isActive ? 3 : 2}
                        fill="none"
                        strokeDasharray={conn.from.status === 'completed' ? 'none' : '5,3'}
                        markerEnd="url(#arrowhead)"
                        filter={isActive ? 'url(#glow)' : 'none'}
                      />
                    </g>
                  )
                })}

                {/* Arrow marker */}
                <defs>
                  <marker
                    id="arrowhead"
                    markerWidth="6"
                    markerHeight="6"
                    refX="5"
                    refY="3"
                    orient="auto"
                    markerUnits="strokeWidth"
                  >
                    <polygon points="0 0, 6 3, 0 6" fill="#475569" opacity="0.8" />
                  </marker>
                </defs>

                {/* Production nodes */}
                {timelineSteps.map((step, index) => {
                  const position = stepPositions.get(step.id)
                  if (!position) return null
                  
                  const { x, y } = position
                  const isInventoryStep = (step as any).isInventoryPosting === true
                  const gradientId = isInventoryStep 
                    ? `inventory-gradient-${step.id}` 
                    : `gradient-${step.lot.replace(/[^a-zA-Z0-9]/g, '-')}`
                  const isHovered = hoveredStep === step.id
                  const isFiltered = selectedLot && selectedLot !== step.lot && !isInventoryStep
                  const isActive = activeStepIndex === index
                  const opacity = isFiltered ? 0.25 : 1
                  const shortCode = isInventoryStep ? 'INV' : getLotShortCode(step.lot)

                  return (
                    <g
                      key={step.id}
                      onMouseEnter={(e) => handleStepHover(e, step.id)}
                      onMouseLeave={handleStepLeave}
                      style={{ cursor: 'pointer', opacity }}
                      transform={`translate(${x}, ${y})`}
                      filter={isHovered || isActive ? 'url(#dropShadow)' : 'none'}
                    >
                      
                      {/* Active animation ring */}
                      {isActive && (
                        <circle
                          cx="0"
                          cy="0"
                          r={isInventoryStep ? "70" : "65"}
                          fill="none"
                          stroke={isInventoryStep ? "#10b981" : "#10b981"}
                          strokeWidth={isInventoryStep ? "4" : "3"}
                          strokeDasharray="5,5"
                          opacity="0.8"
                          style={{ animation: 'pulse 2s infinite' }}
                        />
                      )}
                      
                      {/* Inventory step special ring */}
                      {isInventoryStep && !isActive && (
                        <circle
                          cx="0"
                          cy="0"
                          r="70"
                          fill="none"
                          stroke="#10b981"
                          strokeWidth="3"
                          strokeDasharray="8,4"
                          opacity="0.6"
                        />
                      )}
                      
                      {/* Efficiency heatmap overlay */}
                      {highlightEfficiency && step.efficiency && !isInventoryStep && (
                        <rect
                          x={-45}
                          y={-30}
                          width="90"
                          height="60"
                          fill={getEfficiencyColor(step.efficiency)}
                          rx="6"
                        />
                      )}
                      
                      {/* Node background */}
                      <rect
                        x={isInventoryStep ? -50 : -45}
                        y={isInventoryStep ? -35 : -30}
                        width={isInventoryStep ? 100 : 90}
                        height={isInventoryStep ? 70 : 60}
                        fill={`url(#${gradientId})`}
                        stroke={isInventoryStep 
                          ? '#059669' 
                          : highlightEfficiency && step.efficiency ? getEfficiencyStrokeColor(step.efficiency) : 'white'}
                        strokeWidth={isInventoryStep ? (isHovered || isActive ? 5 : 3) : (isHovered || isActive ? 4 : 2)}
                        rx="6"
                        className="transition-all duration-150"
                      />
                      
                      {/* Status dot */}
                      <circle
                        cx={-30}
                        cy={-15}
                        r="3"
                        fill={step.status === 'completed' ? '#22c55e' : step.status === 'in-progress' ? '#f59e0b' : '#94a3b8'}
                      />
                      
                      {/* Quantity */}
                      <text
                        x="0"
                        y="-5"
                        textAnchor="middle"
                        dominantBaseline="middle"
                        className="fill-white font-bold"
                        fontSize="14"
                        style={{ textShadow: '0 1px 3px rgba(0,0,0,0.4)' }}
                      >
                        {step.good.toLocaleString()}
                      </text>
                      
                      {/* Unit */}
                      <text
                        x="0"
                        y="15"
                        textAnchor="middle"
                        dominantBaseline="middle"
                        className="fill-white/95 font-semibold"
                        fontSize="10"
                        style={{ textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}
                      >
                        {step.unit}
                      </text>
                      
                      {/* Lot short code */}
                      <text
                        x="35"
                        y="-15"
                        textAnchor="start"
                        dominantBaseline="middle"
                        className="fill-white/90 font-bold"
                        fontSize="10"
                        style={{ textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}
                      >
                        {shortCode}
                      </text>
                      
                      {/* Step index */}
                      <text
                        x="-35"
                        y="15"
                        textAnchor="start"
                        dominantBaseline="middle"
                        className="fill-white/80 font-medium"
                        fontSize="8"
                        style={{ textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}
                      >
                        #{index + 1}
                      </text>
                      
                      {/* Hover highlight */}
                      {isHovered && !isActive && (
                        <circle
                          cx="0"
                          cy="0"
                          r="50"
                          fill="none"
                          stroke="white"
                          strokeWidth="2"
                          strokeDasharray="4,4"
                          opacity="0.6"
                        />
                      )}
                    </g>
                  )
                })}
              </svg>
              )}

              {viewMode === 'gantt' && (
                <div className="w-full h-full overflow-auto">
                  <div className="min-w-full" style={{ padding: '20px' }}>
                    {/* Gantt Chart */}
                    <div className="space-y-2">
                      {/* Time header */}
                      <div className="flex relative" style={{ marginLeft: `${stageLabelWidth}px`, height: '30px' }}>
                        {(() => {
                          const timeSteps = 12
                          const availableWidth = svgWidth - stageLabelWidth
                          const headers = []
                          for (let i = 0; i <= timeSteps; i++) {
                            const ratio = i / timeSteps
                            const time = new Date(timeRange.start.getTime() + ratio * timeRange.duration)
                            const x = (availableWidth * ratio)
                            headers.push(
                              <div
                                key={`gantt-time-${i}`}
                                className="absolute border-l border-gray-300"
                                style={{
                                  left: `${x}px`,
                                  height: '100%',
                                  paddingLeft: '4px',
                                  fontSize: '10px',
                                  color: '#64748b'
                                }}
                              >
                                {formatTime(time)}
                              </div>
                            )
                          }
                          return headers
                        })()}
                      </div>

                      {/* Gantt bars for each lot */}
                      {uniqueLots.map((lot) => {
                        const lotSteps = timelineSteps
                          .filter(s => s.lot === lot)
                          .sort((a, b) => a.when.getTime() - b.when.getTime())
                        
                        if (lotSteps.length === 0) return null

                        return (
                          <div key={`gantt-lot-${lot}`} className="flex items-center border-b border-gray-200 py-2">
                            {/* Lot label */}
                            <div
                              className="flex-shrink-0 font-medium text-sm text-gray-900 pr-4"
                              style={{ width: `${stageLabelWidth}px` }}
                            >
                              <div className="flex items-center gap-2">
                                {(() => {
                                  const lotColor = lotColors.find(lc => lc.lot === lot)
                                  return (
                                    <div
                                      className="w-3 h-3 rounded"
                                      style={{ background: lotColor?.color || '#475569' }}
                                    />
                                  )
                                })()}
                                <span className="truncate">{getLotShortCode(lot)}</span>
                              </div>
                            </div>

                            {/* Gantt bars */}
                            <div className="flex-1 relative" style={{ height: '40px' }}>
                              {lotSteps.map((step) => {
                                const availableWidth = svgWidth - stageLabelWidth
                                const ratio = (step.when.getTime() - timeRange.start.getTime()) / timeRange.duration
                                const x = availableWidth * ratio
                                const barWidth = Math.max(60, availableWidth / 20)
                                const lotColor = lotColors.find(lc => lc.lot === lot)
                                const baseColor = lotColor?.color || '#475569'
                                const efficiencyOverlay = highlightEfficiency && step.efficiency
                                  ? getEfficiencyColor(step.efficiency)
                                  : 'transparent'
                                
                                return (
                                  <div
                                    key={`gantt-bar-${step.id}`}
                                    className="absolute rounded cursor-pointer hover:opacity-80 transition-opacity relative"
                                    style={{
                                      left: `${x}px`,
                                      top: '50%',
                                      transform: 'translateY(-50%)',
                                      width: `${barWidth}px`,
                                      height: '30px',
                                      background: baseColor,
                                      border: `2px solid ${highlightEfficiency && step.efficiency ? getEfficiencyStrokeColor(step.efficiency) : 'white'}`,
                                      boxShadow: hoveredStep === step.id ? '0 0 0 2px #3b82f6' : 'none'
                                    }}
                                    onMouseEnter={() => setHoveredStep(step.id)}
                                    onMouseLeave={() => setHoveredStep(null)}
                                    onClick={() => onRunSelect?.(step.run.id)}
                                  >
                                    {efficiencyOverlay !== 'transparent' && (
                                      <div
                                        className="absolute inset-0 rounded"
                                        style={{ backgroundColor: efficiencyOverlay }}
                                      />
                                    )}
                                    <div className="flex flex-col items-center justify-center h-full text-white text-xs font-semibold relative z-10" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>
                                      <span>{step.good.toLocaleString()}</span>
                                      <span className="text-[10px] opacity-90">{truncateStageName(step.stage, 8)}</span>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}

              {viewMode === 'matrix' && (
                <div className="w-full h-full overflow-auto p-4">
                  <div className="bg-white rounded-lg border border-gray-200">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 bg-gray-50">
                          <th className="px-4 py-3 text-left font-semibold text-gray-900 sticky left-0 bg-gray-50 z-10 border-r border-gray-200">
                            Lot / Stage
                          </th>
                          {uniqueStages.map(stage => (
                            <th
                              key={`matrix-header-${stage}`}
                              className="px-4 py-3 text-center font-semibold text-gray-900 min-w-[120px]"
                            >
                              {truncateStageName(stage, 15)}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {uniqueLots.map(lot => {
                          const lotSteps = timelineSteps.filter(s => s.lot === lot)
                          
                          return (
                            <tr key={`matrix-row-${lot}`} className="border-b border-gray-100 hover:bg-gray-50">
                              <td className="px-4 py-3 font-medium text-gray-900 sticky left-0 bg-white z-10 border-r border-gray-200">
                                <div className="flex items-center gap-2">
                                  {(() => {
                                    const lotColor = lotColors.find(lc => lc.lot === lot)
                                    return (
                                      <div
                                        className="w-3 h-3 rounded flex-shrink-0"
                                        style={{ background: lotColor?.color || '#475569' }}
                                      />
                                    )
                                  })()}
                                  <span>{getLotShortCode(lot)}</span>
                                </div>
                              </td>
                              {uniqueStages.map(stage => {
                                const stageSteps = lotSteps.filter(s => s.stage === stage)
                                const totalQty = stageSteps.reduce((sum, s) => sum + s.good, 0)
                                const avgEfficiency = stageSteps.length > 0
                                  ? stageSteps.reduce((sum, s) => sum + (s.efficiency || 1), 0) / stageSteps.length
                                  : null
                                
                                const cellColor = highlightEfficiency && avgEfficiency
                                  ? getEfficiencyColor(avgEfficiency)
                                  : totalQty > 0
                                  ? 'rgba(59, 130, 246, 0.1)'
                                  : 'transparent'
                                
                                return (
                                  <td
                                    key={`matrix-cell-${lot}-${stage}`}
                                    className="px-4 py-3 text-center"
                                    style={{ backgroundColor: cellColor }}
                                  >
                                    {totalQty > 0 ? (
                                      <div className="flex flex-col items-center gap-1">
                                        <span className="font-semibold text-gray-900">
                                          {totalQty.toLocaleString()}
                                        </span>
                                        {avgEfficiency && highlightEfficiency && (
                                          <span className="text-xs text-gray-500">
                                            {(avgEfficiency * 100).toFixed(0)}%
                                          </span>
                                        )}
                                        <span className="text-xs text-gray-400">
                                          {stageSteps.length} run{stageSteps.length !== 1 ? 's' : ''}
                                        </span>
                                      </div>
                                    ) : (
                                      <span className="text-gray-300">-</span>
                                    )}
                                  </td>
                                )
                              })}
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              
              {/* Legend overlay */}
              <div className="absolute bottom-3 left-3 bg-white/90 backdrop-blur-sm border border-gray-200 rounded-lg shadow-sm p-2">
                <div className="flex items-center gap-3">
                  {lotColors.slice(0, 4).map(({ lot, gradient, shortCode }) => {
                    const isActive = activeStepIndex !== null && 
                      timelineSteps[activeStepIndex]?.lot === lot
                    
                    return (
                      <div key={lot} className="flex items-center gap-1.5">
                        <div 
                          className={`w-3 h-3 rounded ${isActive ? 'ring-2 ring-green-500' : ''}`}
                          style={{ background: gradient }}
                        />
                        <span className={`text-xs font-medium ${isActive ? 'text-green-700' : 'text-gray-700'}`}>
                          {shortCode}
                        </span>
                        <span className="text-xs text-gray-500">
                          ({timelineSteps.filter(s => s.lot === lot).length})
                        </span>
                      </div>
                    )
                  })}
                  {lotColors.length > 4 && (
                    <div className="text-xs text-gray-500">
                      +{lotColors.length - 4} more
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Enhanced timeline controls */}
            <div className="flex items-center justify-between mt-3">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    <span>Completed</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-amber-500" />
                    <span>In Progress</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-gray-400" />
                    <span>Pending</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                    <span>Active</span>
                  </div>
                </div>
                
                <div className="w-px h-4 bg-gray-300" />
                
                <div className="flex items-center gap-2">
                  <div className="text-xs text-gray-500">Time range:</div>
                  <div className="text-xs font-medium text-gray-900">
                    {formatTime(timeRange.start)} - {formatTime(timeRange.end)}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="text-sm text-gray-500">
                  Showing {selectedLot ? '1' : uniqueLots.length} of {uniqueLots.length} lots
                </div>
                <div className="text-xs text-gray-400">
                  {timelineSteps.length} steps • {Object.keys(stageMetrics).length} active stages
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Add CSS animations */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
      
      {/* Fullscreen Modal */}
      {showFullscreenModal && createPortal(
        <div className="fixed inset-0 z-[9999] bg-white flex flex-col">
          {/* Header */}
          <div className="bg-white border-b border-gray-200 p-4 flex-shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-semibold text-gray-900">Production Flow Timeline - Fullscreen</h2>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded flex items-center gap-1">
                    <BoltIcon className="h-3 w-3" />
                    Live
                  </span>
                  {realTimeUpdates && (
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded flex items-center gap-1">
                      <SignalIcon className="h-3 w-3" />
                      Real-time
                    </span>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowFullscreenModal(false)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                title="Close fullscreen (Esc)"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
          </div>
          
          {/* Content - same timeline visualization in fullscreen */}
          <div className="flex-1 min-h-0 overflow-auto p-4">
            <div className="h-full flex gap-4">
              {/* Legend */}
              {showLegend && (
                <div className="w-64 flex-shrink-0 flex flex-col">
                  <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 h-full">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-gray-900">Lot Filter</h3>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 bg-white px-2 py-1 rounded border">
                          {filteredLots.length}/{uniqueLots.length}
                        </span>
                        {selectedLot && (
                          <button
                            onClick={() => setSelectedLot(null)}
                            className="text-xs text-blue-600 hover:text-blue-800"
                          >
                            Clear
                          </button>
                        )}
                      </div>
                    </div>
                    
                    <div className="relative mb-3">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <MagnifyingGlassIcon className="h-4 w-4 text-gray-400" />
                      </div>
                      <input
                        type="text"
                        placeholder="Search lots..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    
                    <div className="space-y-2 flex-1 overflow-y-auto pr-2">
                      {filteredLots.map(({ lot, gradient, shortCode }) => {
                        const lotSteps = timelineSteps.filter(s => s.lot === lot)
                        const totalQty = lotSteps.reduce((sum, step) => sum + step.good, 0)
                        const isSelected = selectedLot === lot
                        
                        return (
                          <button
                            key={lot}
                            onClick={() => setSelectedLot(isSelected ? null : lot)}
                            className={`w-full flex items-center justify-between p-2.5 rounded-lg border transition-all ${
                              isSelected 
                                ? 'bg-blue-50 border-blue-200 ring-1 ring-blue-100' 
                                : 'bg-white border-gray-200 hover:bg-gray-50'
                            }`}
                          >
                            <div className="flex items-center gap-2.5">
                              <div 
                                className="w-3 h-3 rounded flex-shrink-0"
                                style={{ background: gradient }}
                              />
                              <div className="text-left">
                                <div className="text-xs font-medium text-gray-900">
                                  {shortCode}
                                </div>
                              </div>
                            </div>
                            <span className="text-xs font-medium text-gray-700">
                              {totalQty.toLocaleString()}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}
              
              {/* Timeline Visualization in Fullscreen */}
              <div className="flex-1 min-h-0">
                <div 
                  className="relative rounded border border-gray-200 bg-white h-full overflow-auto"
                  ref={svgContainerRef}
                >
                  {viewMode === 'flow' && (
                  <svg
                    width="100%"
                    height="100%"
                    viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                    preserveAspectRatio="xMidYMid meet"
                    style={{ 
                      display: 'block',
                      transform: `scale(${zoomLevel})`,
                      transformOrigin: 'center'
                    }}
                  >
                    {/* Grid pattern */}
                    <defs>
                      <pattern id="gridPattern-fullscreen" width="40" height="40" patternUnits="userSpaceOnUse">
                        <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#f8fafc" strokeWidth="1"/>
                      </pattern>
                      
                      {lotColors.map(({ lot, gradient }) => (
                        <linearGradient
                          key={`gradient-fullscreen-${lot}`}
                          id={`gradient-fullscreen-${lot.replace(/[^a-zA-Z0-9]/g, '-')}`}
                          x1="0%" y1="0%" x2="100%" y2="100%"
                        >
                          <stop offset="0%" stopColor={gradient.split(' ')[4]} />
                          <stop offset="100%" stopColor={gradient.split(' ')[6]} />
                        </linearGradient>
                      ))}
                      
                      {/* Inventory gradients */}
                      {timelineSteps.filter((step: any) => step.isInventoryPosting === true).map((step: any) => (
                        <linearGradient
                          key={`inventory-gradient-fullscreen-${step.id}`}
                          id={`inventory-gradient-fullscreen-${step.id}`}
                          x1="0%" y1="0%" x2="100%" y2="100%"
                        >
                          <stop offset="0%" stopColor="#10b981" />
                          <stop offset="100%" stopColor="#059669" />
                        </linearGradient>
                      ))}
                      
                      <filter id="dropShadow-fullscreen" x="-20%" y="-20%" width="140%" height="140%">
                        <feGaussianBlur in="SourceAlpha" stdDeviation="2"/>
                        <feOffset dx="0" dy="2" result="offsetblur"/>
                        <feComponentTransfer>
                          <feFuncA type="linear" slope="0.15"/>
                        </feComponentTransfer>
                        <feMerge> 
                          <feMergeNode/>
                          <feMergeNode in="SourceGraphic"/> 
                        </feMerge>
                      </filter>
                      
                      <filter id="glow-fullscreen" x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur stdDeviation="3" result="blur"/>
                        <feMerge>
                          <feMergeNode in="blur"/>
                          <feMergeNode in="SourceGraphic"/>
                        </feMerge>
                      </filter>
                    </defs>

                    {/* Background grid */}
                    <rect 
                      x={padding.left} 
                      y={padding.top} 
                      width={svgWidth - padding.left - padding.right} 
                      height={svgHeight - padding.top - padding.bottom} 
                      fill="url(#gridPattern-fullscreen)" 
                      stroke="#f1f5f9" 
                      strokeWidth="1"
                    />

                    {/* Time axis */}
                    {(() => {
                      const timeSteps = 6
                      const lines = []
                      for (let i = 0; i <= timeSteps; i++) {
                        const ratio = i / timeSteps
                        const time = new Date(timeRange.start.getTime() + ratio * timeRange.duration)
                        const x = getXPosition(time, svgWidth, padding.left, padding.right)
                        
                        lines.push(
                          <g key={`time-fullscreen-${i}`}>
                            <line
                              x1={x}
                              y1={padding.top}
                              x2={x}
                              y2={svgHeight - padding.bottom}
                              stroke="#e2e8f0"
                              strokeWidth="1"
                            />
                            <circle 
                              cx={x} 
                              cy={svgHeight - padding.bottom + 8} 
                              r="3" 
                              fill="#475569" 
                            />
                            <text
                              x={x}
                              y={svgHeight - padding.bottom + 25}
                              textAnchor="middle"
                              className="fill-gray-600 font-medium"
                              fontSize="10"
                            >
                              {formatTime(time)}
                            </text>
                          </g>
                        )
                      }
                      return lines
                    })()}

                    {/* Stage swimlanes and labels */}
                    {uniqueStages.map((stage, index) => {
                      const y = padding.top + index * laneHeight
                      const metrics = stageMetrics[stage]
                      const isSelected = selectedStage === stage
                      const isInventoryStage = stage === 'Inventory'
                      
                      return (
                        <g key={`lane-fullscreen-${stage}`}>
                          <rect
                            x={padding.left}
                            y={y}
                            width={svgWidth - padding.left - padding.right}
                            height={laneHeight}
                            fill={isInventoryStage 
                              ? 'rgba(236, 253, 245, 0.5)'
                              : index % 2 === 0 ? 'rgba(255, 255, 255, 0.7)' : 'rgba(248, 250, 252, 0.7)'}
                            stroke={isSelected ? '#0ea5e9' : isInventoryStage ? '#10b981' : '#e2e8f0'}
                            strokeWidth={isSelected ? '2' : isInventoryStage ? '1.5' : '0.5'}
                          />
                          <rect
                            x={10}
                            y={y + 10}
                            width={stageLabelWidth - 20}
                            height={laneHeight - 20}
                            fill={isInventoryStage 
                              ? '#d1fae5'
                              : isSelected ? '#e0f2fe' : '#f8fafc'}
                            stroke={isInventoryStage 
                              ? '#10b981'
                              : isSelected ? '#0ea5e9' : '#e2e8f0'}
                            strokeWidth={isSelected ? '2' : isInventoryStage ? '2' : '1'}
                            rx="4"
                            onClick={() => setSelectedStage(isSelected ? null : stage)}
                            style={{ cursor: 'pointer' }}
                          />
                          <text
                            x={20}
                            y={y + laneHeight / 2}
                            textAnchor="start"
                            dominantBaseline="middle"
                            className={isInventoryStage ? "fill-emerald-700 font-bold" : "fill-gray-900 font-semibold"}
                            fontSize={isInventoryStage ? "12" : "11"}
                            onClick={() => setSelectedStage(isSelected ? null : stage)}
                            style={{ cursor: 'pointer' }}
                          >
                            {index + 1}. {truncateStageName(stage, 12)}
                          </text>
                          
                          {metrics && (
                            <g transform={`translate(${stageLabelWidth - 40}, ${y + laneHeight - 25})`}>
                              <rect
                                x="0"
                                y="0"
                                width="30"
                                height="15"
                                rx="7.5"
                                fill="#dcfce7"
                                stroke="#22c55e"
                                strokeWidth="1"
                              />
                              <text
                                x="15"
                                y="7.5"
                                textAnchor="middle"
                                dominantBaseline="middle"
                                className="fill-gray-900 font-bold"
                                fontSize="8"
                              >
                                {metrics.avgQuantity > 999 ? '999+' : metrics.avgQuantity.toLocaleString()}
                              </text>
                            </g>
                          )}
                        </g>
                      )
                    })}

                    {/* Flow connections */}
                    {flowConnections.map((conn, index) => {
                      const fromPos = stepPositions.get(conn.from.id)
                      const toPos = stepPositions.get(conn.to.id)
                      
                      if (!fromPos || !toPos) return null
                      
                      const { x: fromX, y: fromY } = fromPos
                      const { x: toX, y: toY } = toPos
                      const gradientId = `gradient-fullscreen-${conn.from.lot.replace(/[^a-zA-Z0-9]/g, '-')}`
                      const controlX1 = fromX + (toX - fromX) * 0.3
                      const controlY1 = fromY
                      const controlX2 = fromX + (toX - fromX) * 0.7
                      const controlY2 = toY
                      
                      const isActive = activeStepIndex !== null && 
                        (timelineSteps[activeStepIndex]?.id === conn.from.id || 
                         timelineSteps[activeStepIndex]?.id === conn.to.id)

                      return (
                        <g 
                          key={`flow-fullscreen-${index}`} 
                          opacity={selectedLot && selectedLot !== conn.from.lot ? 0.15 : 0.7}
                        >
                          <path
                            d={`M ${fromX} ${fromY} C ${controlX1} ${controlY1}, ${controlX2} ${controlY2}, ${toX} ${toY}`}
                            stroke={`url(#${gradientId})`}
                            strokeWidth={isActive ? 3 : 2}
                            fill="none"
                            strokeDasharray={conn.from.status === 'completed' ? 'none' : '5,3'}
                            markerEnd="url(#arrowhead-fullscreen)"
                            filter={isActive ? 'url(#glow-fullscreen)' : 'none'}
                          />
                        </g>
                      )
                    })}

                    {/* Arrow marker */}
                    <defs>
                      <marker
                        id="arrowhead-fullscreen"
                        markerWidth="6"
                        markerHeight="6"
                        refX="5"
                        refY="3"
                        orient="auto"
                        markerUnits="strokeWidth"
                      >
                        <polygon points="0 0, 6 3, 0 6" fill="#475569" opacity="0.8" />
                      </marker>
                    </defs>

                    {/* Production nodes */}
                    {timelineSteps.map((step, index) => {
                      const position = stepPositions.get(step.id)
                      if (!position) return null
                      
                      const { x, y } = position
                      const isInventoryStep = (step as any).isInventoryPosting === true
                      const gradientId = isInventoryStep 
                        ? `inventory-gradient-fullscreen-${step.id}` 
                        : `gradient-fullscreen-${step.lot.replace(/[^a-zA-Z0-9]/g, '-')}`
                      const isHovered = hoveredStep === step.id
                      const isFiltered = selectedLot && selectedLot !== step.lot && !isInventoryStep
                      const isActive = activeStepIndex === index
                      const opacity = isFiltered ? 0.25 : 1
                      const shortCode = isInventoryStep ? 'INV' : getLotShortCode(step.lot)

                      return (
                        <g
                          key={`step-fullscreen-${step.id}`}
                          onMouseEnter={(e) => handleStepHover(e, step.id)}
                          onMouseLeave={handleStepLeave}
                          style={{ cursor: 'pointer', opacity }}
                          transform={`translate(${x}, ${y})`}
                          filter={isHovered || isActive ? 'url(#dropShadow-fullscreen)' : 'none'}
                        >
                          {/* Active animation ring */}
                          {isActive && (
                            <circle
                              cx="0"
                              cy="0"
                              r={isInventoryStep ? "70" : "65"}
                              fill="none"
                              stroke="#10b981"
                              strokeWidth={isInventoryStep ? "4" : "3"}
                              strokeDasharray="5,5"
                              opacity="0.8"
                              style={{ animation: 'pulse 2s infinite' }}
                            />
                          )}
                          
                          {/* Inventory step special ring */}
                          {isInventoryStep && !isActive && (
                            <circle
                              cx="0"
                              cy="0"
                              r="70"
                              fill="none"
                              stroke="#10b981"
                              strokeWidth="3"
                              strokeDasharray="8,4"
                              opacity="0.6"
                            />
                          )}
                          
                          {/* Efficiency heatmap overlay */}
                          {highlightEfficiency && step.efficiency && !isInventoryStep && (
                            <rect
                              x={-45}
                              y={-30}
                              width="90"
                              height="60"
                              fill={getEfficiencyColor(step.efficiency)}
                              rx="6"
                            />
                          )}
                          
                          {/* Node background */}
                          <rect
                            x={isInventoryStep ? -50 : -45}
                            y={isInventoryStep ? -35 : -30}
                            width={isInventoryStep ? 100 : 90}
                            height={isInventoryStep ? 70 : 60}
                            fill={`url(#${gradientId})`}
                            stroke={isInventoryStep 
                              ? '#059669' 
                              : highlightEfficiency && step.efficiency ? getEfficiencyStrokeColor(step.efficiency) : 'white'}
                            strokeWidth={isInventoryStep ? (isHovered || isActive ? 5 : 3) : (isHovered || isActive ? 4 : 2)}
                            rx="6"
                            className="transition-all duration-150"
                          />
                          
                          {/* Status dot */}
                          <circle
                            cx={-30}
                            cy={-15}
                            r="3"
                            fill={step.status === 'completed' ? '#22c55e' : step.status === 'in-progress' ? '#f59e0b' : '#94a3b8'}
                          />
                          
                          {/* Quantity */}
                          <text
                            x="0"
                            y="-5"
                            textAnchor="middle"
                            dominantBaseline="middle"
                            className="fill-white font-bold"
                            fontSize="14"
                            style={{ textShadow: '0 1px 3px rgba(0,0,0,0.4)' }}
                          >
                            {step.good.toLocaleString()}
                          </text>
                          
                          {/* Unit */}
                          <text
                            x="0"
                            y="15"
                            textAnchor="middle"
                            dominantBaseline="middle"
                            className="fill-white/95 font-semibold"
                            fontSize="10"
                            style={{ textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}
                          >
                            {step.unit}
                          </text>
                          
                          {/* Lot short code */}
                          <text
                            x="35"
                            y="-15"
                            textAnchor="start"
                            dominantBaseline="middle"
                            className="fill-white/90 font-bold"
                            fontSize="10"
                            style={{ textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}
                          >
                            {shortCode}
                          </text>
                          
                          {/* Step index */}
                          <text
                            x="-35"
                            y="15"
                            textAnchor="start"
                            dominantBaseline="middle"
                            className="fill-white/80 font-medium"
                            fontSize="8"
                            style={{ textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}
                          >
                            #{index + 1}
                          </text>
                          
                          {/* Hover highlight */}
                          {isHovered && !isActive && (
                            <circle
                              cx="0"
                              cy="0"
                              r="50"
                              fill="none"
                              stroke="white"
                              strokeWidth="2"
                              strokeDasharray="4,4"
                              opacity="0.6"
                            />
                          )}
                        </g>
                      )
                    })}
                  </svg>
                  )}
                  
                  {/* Zoom controls - outside SVG */}
                  <div className="absolute top-3 right-3 z-10 flex flex-col gap-2">
                    <div className="bg-white/90 backdrop-blur-sm border border-gray-200 rounded-lg shadow-sm p-1">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setZoomLevel(Math.max(0.5, zoomLevel - 0.1))}
                          className="p-1.5 text-gray-600 hover:text-gray-900 rounded hover:bg-gray-100"
                        >
                          <MagnifyingGlassMinusIcon className="h-4 w-4" />
                        </button>
                        <div className="text-xs font-medium text-gray-700 px-2 min-w-[45px] text-center">
                          {Math.round(zoomLevel * 100)}%
                        </div>
                        <button
                          onClick={() => setZoomLevel(Math.min(3, zoomLevel + 0.1))}
                          className="p-1.5 text-gray-600 hover:text-gray-900 rounded hover:bg-gray-100"
                        >
                          <MagnifyingGlassPlusIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    <button
                      onClick={() => setZoomLevel(1)}
                      className="bg-white/90 backdrop-blur-sm border border-gray-200 rounded-lg shadow-sm p-1.5 text-xs font-medium text-gray-700 hover:text-gray-900"
                    >
                      Reset
                    </button>
                  </div>
                  
                  {/* Tooltip in fullscreen modal */}
                  {hoveredStepData && showFullscreenModal && (
                    <div 
                      className="fixed z-[10000] bg-white rounded-lg border border-gray-200 shadow-xl p-4 w-96 pointer-events-none"
                      style={getTooltipPosition()}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <div 
                              className="w-3 h-3 rounded"
                              style={{ background: getLotGradient(hoveredStepData.lot) }}
                            />
                            <h3 className="text-sm font-semibold text-gray-900">
                              {truncateStageName(hoveredStepData.stage, 25)}
                            </h3>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                              hoveredStepData.status === 'completed' 
                                ? 'bg-green-100 text-green-800' 
                                : hoveredStepData.status === 'in-progress'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}>
                              {hoveredStepData.status?.toUpperCase()}
                            </span>
                            {hoveredStepData.efficiency && (
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                hoveredStepData.efficiency > 1.1
                                  ? 'bg-green-100 text-green-800'
                                  : hoveredStepData.efficiency < 0.9
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}>
                                Efficiency: {(hoveredStepData.efficiency * 100).toFixed(0)}%
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold text-gray-900">
                            {hoveredStepData.good.toLocaleString()}
                          </div>
                          <div className="text-xs text-gray-600">{hoveredStepData.unit}</div>
                        </div>
                      </div>
                      
                      <div className="space-y-2 border-t border-gray-100 pt-3">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-xs text-gray-500">Lot</p>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-gray-900">{getLotShortCode(hoveredStepData.lot)}</span>
                              <div 
                                className="w-2 h-2 rounded"
                                style={{ background: getLotGradient(hoveredStepData.lot) }}
                              />
                            </div>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Machine</p>
                            <p className="font-medium text-gray-900">{hoveredStepData.machine}</p>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-xs text-gray-500">Time</p>
                            <p className="font-medium text-gray-900">{formatTime(hoveredStepData.when)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Quality Score</p>
                            <div className="flex items-center gap-2">
                              <div className="w-full bg-gray-200 rounded-full h-2">
                                <div 
                                  className="h-2 rounded-full bg-green-500"
                                  style={{ width: `${(hoveredStepData.qualityScore || 1) * 100}%` }}
                                />
                              </div>
                              <span className="text-xs font-medium">
                                {((hoveredStepData.qualityScore || 1) * 100).toFixed(0)}%
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {hoveredStepData.details && (
                        <div className="mt-3 pt-3 border-t border-gray-100">
                          <p className="text-xs text-gray-500 mb-1">Details</p>
                          <p className="text-sm text-gray-700">{hoveredStepData.details}</p>
                        </div>
                      )}
                      
                      {hoveredStepData.run && onRunSelect && (
                        <div className="mt-3 pt-3 border-t border-gray-100">
                          <button
                            onClick={() => onRunSelect(hoveredStepData.run.id)}
                            className="w-full text-xs text-blue-600 hover:text-blue-800 font-medium text-center"
                          >
                            View full details →
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
      </div>
    </>
  )
}