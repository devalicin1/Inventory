import { getProductByCode } from '../../../api/inventory'
import type { Job } from '../../../api/production-jobs'
import type { BatchQrPayload, StageTransitionRule } from '../../jobs/create/types'
import type { ScanMode, ScannedType } from '../types'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '../../../lib/firebase'

export const parseBatchPayload = (raw: string): BatchQrPayload | null => {
  try {
    const parsed = JSON.parse(raw)
    if (parsed && parsed.type === 'batch') {
      return parsed as BatchQrPayload
    }
    return null
  } catch {
    return null
  }
}

export const getTransitionRuleForStages = (
  job: Job,
  fromStageId: string,
  toStageId: string,
  workflows: any[]
): StageTransitionRule | undefined => {
  const workflow = workflows.find((w: any) => w.id === job.workflowId)
  const wfTransitions = (workflow?.allowedTransitions || []) as any[]
  const wfRule = wfTransitions.find(
    (t: any) => t.fromStageId === fromStageId && t.toStageId === toStageId
  )
  if (wfRule) {
    return {
      fromStageId,
      toStageId,
      requireOutputToAdvance: wfRule.requireOutputToAdvance ?? (job as any).requireOutputToAdvance !== false,
      minQtyToStartNextStage: wfRule.minQtyToStartNextStage,
      unit: wfRule.unit || 'sheet',
      allowPartial: wfRule.allowPartial !== false,
      allowRework: false,
    }
  }

  const jobRules = (job as any).stageTransitionRules as StageTransitionRule[] | undefined
  return jobRules?.find(r => r.fromStageId === fromStageId && r.toStageId === toStageId)
}

interface HandleScanParams {
  code: string
  workspaceId: string
  jobs: Job[]
  jobsLoading: boolean
  jobsError: any
  recentScans: Array<{ code: string; type: ScannedType; timestamp: Date }>
  lastScanTime: number
  dismissedCode: string | null
  selectedJob: Job | null
  onJobFound: (job: Job) => void
  onProductFound: (product: any) => void
  onNotFound: (code: string) => void
  onBatchPayload: (payload: BatchQrPayload, rule?: StageTransitionRule) => void
  onPOFound?: (poId: string) => void
  addToHistory: (code: string, type: ScannedType) => void
  setLastScanTime: (time: number) => void
  setScanAttempts: (attempts: number) => void
  workflows: any[]
}

export const handleScan = async ({
  code,
  workspaceId,
  jobs,
  jobsLoading,
  jobsError,
  recentScans,
  lastScanTime,
  dismissedCode,
  selectedJob,
  onJobFound,
  onProductFound,
  onNotFound,
  onBatchPayload,
  onPOFound,
  addToHistory,
  setLastScanTime,
  setScanAttempts,
  workflows,
}: HandleScanParams) => {
  const trimmedCode = code.trim()
  const now = Date.now()
  
  if (dismissedCode) {
    const dismissed = dismissedCode.toLowerCase()
    if (trimmedCode.toLowerCase() === dismissed) {
      console.log('Scan blocked - this code was dismissed by user:', trimmedCode)
      return
    }
  }
  
  if (lastScanTime > 0 && (now - lastScanTime) < 2000) {
    const recentScan = recentScans[0]
    if (recentScan && recentScan.code === trimmedCode) {
      console.log('Duplicate scan ignored:', trimmedCode)
      return
    }
  }
  setLastScanTime(now)
  
  if (!workspaceId) {
    console.error('workspaceId is null or undefined')
    return
  }
  
  if (jobsLoading) {
    console.log('Jobs still loading, please wait...')
    return
  }

  if (jobsError) {
    console.error('Jobs query error:', jobsError)
    return
  }

  // Check for batch QR payloads
  const batchPayload = parseBatchPayload(trimmedCode)
  if (batchPayload && selectedJob && batchPayload.jobId === selectedJob.id) {
    const rule = getTransitionRuleForStages(
      selectedJob,
      batchPayload.sourceStageId,
      batchPayload.targetStageId,
      workflows
    )
    onBatchPayload(batchPayload, rule)
    addToHistory(trimmedCode, 'job')
    return
  }

  // Check Jobs
  const job = jobs.find(j => {
    const jobCode = (j.code || '').trim().toLowerCase()
    const jobSku = (j.sku || '').trim().toLowerCase()
    const jobId = (j.id || '').trim().toLowerCase()
    const searchCode = trimmedCode.toLowerCase()
    return jobCode === searchCode || jobSku === searchCode || jobId === searchCode
  })
  
  if (job) {
    console.log('Job found:', job.code || job.id)
    onJobFound(job)
    addToHistory(trimmedCode, 'job')
    setScanAttempts(0)
    return
  }

  // Check Products
  try {
    const product = await getProductByCode(workspaceId, trimmedCode)
    if (product) {
      console.log('Product found:', product.sku || product.id)
      onProductFound(product)
      addToHistory(trimmedCode, 'product')
      setScanAttempts(0)
      return
    }
  } catch (e) {
    console.error('Product lookup failed', e)
  }

  // Check Purchase Orders (if onPOFound callback is provided)
  if (onPOFound) {
    try {
      // Check if it's a PO QR code format (PO:poId)
      if (trimmedCode.startsWith('PO:')) {
        const poId = trimmedCode.substring(3)
        console.log('PO found via QR code:', poId)
        onPOFound(poId)
        addToHistory(trimmedCode, 'po')
        setScanAttempts(0)
        return
      }
      
      // Check if it's a PO number format (PO-000001)
      if (trimmedCode.startsWith('PO-') || trimmedCode.match(/^PO\d+$/)) {
        const poCol = collection(db, 'workspaces', workspaceId, 'purchaseOrders')
        const q = query(poCol, where('poNumber', '==', trimmedCode))
        const snap = await getDocs(q)
        
        if (!snap.empty) {
          const poDoc = snap.docs[0]
          const poId = poDoc.id
          console.log('PO found by number:', trimmedCode, '->', poId)
          onPOFound(poId)
          addToHistory(trimmedCode, 'po')
          setScanAttempts(0)
          return
        }
      }
    } catch (e) {
      console.error('PO lookup failed', e)
    }
  }

  // Not Found
  console.log('Scan not found:', { 
    code: trimmedCode, 
    jobsCount: jobs.length,
    sampleJobCodes: jobs.map(j => j.code || j.id).slice(0, 3)
  })
  
  const alreadyShown = recentScans.some(s => s.code === trimmedCode && s.type === 'none')
  if (!alreadyShown) {
    onNotFound(trimmedCode)
  }
}

