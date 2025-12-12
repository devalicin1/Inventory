import { useState, useRef } from 'react'
import type { Job } from '../../../api/production-jobs'
import type { ListedProduct } from '../../../api/inventory'
import type { ScanMode, ScannedType, RecentScan, BatchTransferData, SelectedStageForOutput, SelectedLotForPosting } from '../types'

export function useScannerState() {
  const [scanMode, setScanMode] = useState<ScanMode>('manual')
  const [manualCode, setManualCode] = useState('')
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [selectedProduct, setSelectedProduct] = useState<ListedProduct | null>(null)
  const [recentScans, setRecentScans] = useState<RecentScan[]>([])
  const [lastScannedCode, setLastScannedCode] = useState<string | null>(null)

  // Action states
  const [activeAction, setActiveAction] = useState<string | null>(null)
  const [actionData, setActionData] = useState<any>({})
  const [showInventoryPostingModal, setShowInventoryPostingModal] = useState(false)
  const [showLotInventoryPostingModal, setShowLotInventoryPostingModal] = useState(false)
  const [selectedLotForPosting, setSelectedLotForPosting] = useState<SelectedLotForPosting | null>(null)
  
  // Dialog states
  const [showConsumeDialog, setShowConsumeDialog] = useState(false)
  const [showProduceDialog, setShowProduceDialog] = useState(false)
  
  // Local state for dialog production runs
  const [dialogProductionRuns, setDialogProductionRuns] = useState<any[]>([])
  const [isLoadingDialogRuns, setIsLoadingDialogRuns] = useState(false)
  
  // Local batch tracking
  const [batches, setBatches] = useState<Record<string, { qty: number; unit: string; stageId: string }>>({})
  
  // Batch transfer modal state
  const [showBatchTransferModal, setShowBatchTransferModal] = useState(false)
  const [batchTransferData, setBatchTransferData] = useState<BatchTransferData | null>(null)
  
  // Stage output selection modal state
  const [showStageOutputModal, setShowStageOutputModal] = useState(false)
  const [selectedStageForOutput, setSelectedStageForOutput] = useState<SelectedStageForOutput | null>(null)
  const [freshRunsForModal, setFreshRunsForModal] = useState<any[]>([])
  const [isLoadingFreshRuns, setIsLoadingFreshRuns] = useState(false)
  const [selectedOutputIds, setSelectedOutputIds] = useState<Set<string>>(new Set())
  
  // Selected stage for Record Output dialog
  const [selectedOutputStageId, setSelectedOutputStageId] = useState<string | null>(null)

  // Camera scanning state
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isScanning, setIsScanning] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [scanAttempts, setScanAttempts] = useState(0)
  const [lastScanTime, setLastScanTime] = useState<number>(0)
  const reader = useRef<any>(null)
  const hasProcessedScan = useRef(false)
  const dismissedCode = useRef<string | null>(null)

  const addToHistory = (code: string, type: ScannedType) => {
    setRecentScans(prev => [{ code, type, timestamp: new Date() }, ...prev.slice(0, 9)])
  }

  const resetSelectionAfterAction = () => {
    dismissedCode.current = null
    setSelectedJob(null)
    setSelectedProduct(null)
    setActiveAction(null)
    setActionData({})
    setLastScannedCode(null)
  }

  const resetSelectionDismissed = () => {
    if (selectedJob) {
      dismissedCode.current = selectedJob.code || selectedJob.sku || selectedJob.id
    } else if (selectedProduct) {
      dismissedCode.current = selectedProduct.sku || selectedProduct.id
    }
    
    setSelectedJob(null)
    setSelectedProduct(null)
    setActiveAction(null)
    setActionData({})
    setLastScannedCode(null)
  }

  return {
    // Scan state
    scanMode,
    setScanMode,
    manualCode,
    setManualCode,
    selectedJob,
    setSelectedJob,
    selectedProduct,
    setSelectedProduct,
    recentScans,
    setRecentScans,
    lastScannedCode,
    setLastScannedCode,
    
    // Action state
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
    
    // Dialog state
    showConsumeDialog,
    setShowConsumeDialog,
    showProduceDialog,
    setShowProduceDialog,
    dialogProductionRuns,
    setDialogProductionRuns,
    isLoadingDialogRuns,
    setIsLoadingDialogRuns,
    
    // Batch state
    batches,
    setBatches,
    showBatchTransferModal,
    setShowBatchTransferModal,
    batchTransferData,
    setBatchTransferData,
    
    // Stage output state
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
    
    // Camera state
    videoRef,
    isScanning,
    setIsScanning,
    cameraError,
    setCameraError,
    scanAttempts,
    setScanAttempts,
    lastScanTime,
    setLastScanTime,
    reader,
    hasProcessedScan,
    dismissedCode,
    
    // Helpers
    addToHistory,
    resetSelectionAfterAction,
    resetSelectionDismissed,
  }
}

