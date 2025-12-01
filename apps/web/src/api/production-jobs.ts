import { db, storage } from '../lib/firebase'
import {
  addDoc,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDocs,
  getDoc,
  orderBy,
  query,
  where,
  serverTimestamp,
  updateDoc,
  writeBatch,
  limit,
  startAfter,
  DocumentSnapshot,
  setDoc,
} from 'firebase/firestore'
import { getDownloadURL, ref, uploadBytes, deleteObject } from 'firebase/storage'
import { createStockTransaction, getProductByCode } from './inventory'
import { generateQRCodeDataURL } from '../utils/qrcode'
import { generateBarcodeDataURL } from '../utils/barcode'
import { sanitizeForFirestore } from '../utils/sanitize'

// ===== INTERFACES =====

export interface CustomerAddress {
  street?: string
  city?: string
  state?: string
  zipCode?: string
  country?: string
}

export interface Customer {
  id: string
  name: string
  code?: string  // Customer code/reference
  companyName?: string
  contactPerson?: string
  email?: string
  phone?: string
  mobile?: string
  fax?: string
  billingAddress?: CustomerAddress
  shippingAddress?: CustomerAddress
  taxId?: string
  paymentTerms?: string
  creditLimit?: number
  notes?: string
  active: boolean
  createdAt: any
  updatedAt: any
}

export interface JobCustomer {
  id: string
  name: string
  orderNo?: string
  ref?: string  // Reference number
  estNo?: string  // Estimate/Quote number
  date?: Date  // Order date
}

export interface BOMItem {
  itemId?: string
  sku: string
  name: string
  qtyRequired: number
  uom: string
  reserved: number
  consumed: number
  lot?: string
  unitCost?: number
}

export interface OutputItem {
  sku: string
  name: string
  qtyPlanned: number
  qtyProduced: number
  uom: string
  unitDefinition?: string
  lot?: string
}

export interface Packaging {
  pcsPerBox?: number
  boxesPerPallet?: number
  plannedBoxes?: number
  actualBoxes?: number
  plannedPallets?: number
  actualPallets?: number
  strapSpec?: string  // Strap/Banding specification
  palletLabelsOnly?: string  // Pallet label notes
  outersUsed?: number  // Total outers used
}

export interface ProductionSpecs {
  size?: { width?: number; length?: number; height?: number }  // Dimensions in mm
  formeSize?: { width?: number; length?: number }  // Forme/die size
  numberUp?: number  // Pieces per sheet
  printedColors?: number  // Number of print colors
  varnish?: string  // Varnish/coating type
  microns?: number  // Board thickness
  gsm?: string  // Paper/board GSM of selected sheet
  board?: string  // Board type/material
  supplier?: string  // Source/supplier
  sheetSize?: { width?: number; length?: number }  // Sheet size
  sheetsToUse?: number  // Number of sheets needed
  cutTo?: string  // Cut dimensions
  yield?: string  // Output per sheet
  labelNo?: string  // Label number
  tags?: string[]  // Copied from selected sheet product tags
}

export interface JobInput {
  code: string
  sku: string
  productName: string
  quantity: number
  unit: string
  priority: 1 | 2 | 3 | 4 | 5
  workflowId: string
  currentStageId: string
  plannedStageIds?: string[]
  status: 'draft' | 'released' | 'in_progress' | 'blocked' | 'done' | 'cancelled'
  assignees: string[]
  workcenterId?: string
  plannedStart?: Date
  plannedEnd?: Date
  dueDate: Date
  risk?: 'ok' | 'warning' | 'overdue'
  customer: JobCustomer
  notes?: string
  bom: BOMItem[]
  output: OutputItem[]
  packaging?: Packaging
  qaAcceptedAt?: Date
  customerAcceptedAt?: Date
  blockReason?: string
  // Additional manual form fields
  isRepeat?: boolean  // NEW / REPEAT indicator
  tams?: string  // Internal reference/code
  outerType?: 'plain' | 'std_ptd' | 'bespoke'  // Outers type
  outerCode?: string  // Outers code
  rsOrderRef?: string  // RS/Order reference
  deliveryAddress?: string  // Delivery address
  weightPerBox?: number  // Weight of one box in kg
  productionSpecs?: ProductionSpecs  // Technical specifications
  deliveryMethod?: string  // To be delivered by (e.g., "Our Van")
  stageProgress?: StageProgressEntry[]  // Progress tracking per stage
  specialComponents?: SpecialComponent[]  // Special components tracking
  // Controls
  requireOutputToAdvance?: boolean  // If true, moving to the next stage requires at least one production run in the current stage
}

export interface JobAttachment {
  id: string
  name: string
  url: string
  fileType: string          // mime-based: pdf, image, other
  category?: string         // business type: invoice, artwork, etc.
  size?: number
  uploadedAt?: any
}

export interface Job extends JobInput {
  id: string
  createdAt: any
  createdBy: string
  updatedAt: any
  totalValue?: number
  qrUrl?: string
  barcodeUrl?: string
  jobPdfUrl?: string
  attachments?: JobAttachment[]
}

export async function uploadJobAttachment(
  workspaceId: string,
  jobId: string,
  file: File,
  category: string
): Promise<JobAttachment> {
  const ext = file.name.split('.').pop() || ''
  const baseName = file.name.replace(/\.[^/.]+$/, '')
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const safeName = `${baseName}_${timestamp}.${ext}`

  const fileRef = ref(storage, `workspaces/${workspaceId}/jobs/${jobId}/files/${safeName}`)

  await uploadBytes(fileRef, file, { contentType: file.type || undefined })
  const url = await getDownloadURL(fileRef)

  const fileType =
    file.type === 'application/pdf'
      ? 'pdf'
      : file.type.startsWith('image/')
      ? 'image'
      : 'other'

  const attachment: JobAttachment = {
    id: fileRef.name,
    name: file.name,
    url,
    fileType,
    category,
    size: file.size,
    // Use ISO date string instead of serverTimestamp to avoid nested sentinel in arrayUnion
    uploadedAt: new Date().toISOString(),
  } as JobAttachment

  await updateDoc(doc(db, 'workspaces', workspaceId, 'jobs', jobId), {
    attachments: arrayUnion(attachment as any),
    updatedAt: serverTimestamp(),
  } as any)

  return attachment
}

export async function deleteJobAttachment(
  workspaceId: string,
  jobId: string,
  attachment: JobAttachment
): Promise<void> {
  // Delete from storage
  const fileRef = ref(storage, `workspaces/${workspaceId}/jobs/${jobId}/files/${attachment.id}`)
  try {
    await deleteObject(fileRef)
  } catch (err) {
    // File might not exist in storage, continue to remove from Firestore
    console.warn('File not found in storage:', err)
  }

  // Remove from Firestore attachments array
  // We need to get the current job, filter out the attachment, and update
  const jobRef = doc(db, 'workspaces', workspaceId, 'jobs', jobId)
  const jobSnap = await getDoc(jobRef)
  if (!jobSnap.exists()) return

  const jobData = jobSnap.data()
  const currentAttachments: JobAttachment[] = jobData.attachments || []
  const updatedAttachments = currentAttachments.filter(a => a.id !== attachment.id)

  await updateDoc(jobRef, {
    attachments: updatedAttachments,
    updatedAt: serverTimestamp(),
  } as any)
}

export interface Ticket {
  id: string
  title: string
  description?: string
  assignees: string[]
  status: 'open' | 'in_progress' | 'done' | 'cancelled'
  dueDate?: Date
  attachments: string[]
  createdAt: any
  updatedAt: any
}

export interface StageProgressEntry {
  stageId: string
  stageName: string
  date?: Date
  initials?: string  // Operator initials
  quantity?: number
  pallets?: number
  outers?: number
  qtyPerOuter?: number
  subTotal?: number  // Sub-total for this entry
  completed?: boolean
}

export interface SpecialComponent {
  description: string
  supplier?: string
  ordered?: { qty?: number; date?: Date }
  due?: Date
  received?: { qty?: number; date?: Date }
}

export interface TimeLog {
  id: string
  stageId: string
  resourceId: string
  startedAt: any
  stoppedAt?: any
  durationSec?: number
  notes?: string
}

export interface HistoryEvent {
  id: string
  at: any
  actorId: string
  type: string
  payload: any
}

export interface Consumption {
  id: string
  stageId: string
  itemId: string
  sku: string
  name: string
  qtyUsed: number
  uom: string
  lot?: string
  userId: string
  at: any
  approved?: boolean
  notes?: string
}

export interface Attachment {
  id: string
  name: string
  url: string
  tag: string
  createdAt: any
}

// Actual production output entries (per stage/machine)
export interface ProductionRun {
  id: string
  stageId: string
  workcenterId?: string
  machineId?: string // if resources track machines separately
  qtyGood: number
  qtyScrap?: number
  lot?: string
  notes?: string
  at: any
  operatorId: string
}

// ===== WORKFLOW MANAGEMENT =====

export interface WorkflowStage {
  id: string
  name: string
  color: string
  order: number
  wipLimit?: number
  expectedSLAHours?: number
  defaultWorkcenterId?: string
  exitChecks: string[]
}

export interface WorkflowTransition {
  fromStageId: string
  toStageId: string
  guard?: string
}

export interface Workflow {
  id: string
  name: string
  version: string
  isDefault: boolean
  stages: WorkflowStage[]
  allowedTransitions: WorkflowTransition[]
  createdAt: any
  updatedAt: any
}

export interface WorkflowInput {
  name: string
  version: string
  isDefault?: boolean
  stages: Omit<WorkflowStage, 'id'>[]
  allowedTransitions: WorkflowTransition[]
}

// ===== WORKCENTER & RESOURCE MANAGEMENT =====

export interface Workcenter {
  id: string
  name: string
  code: string
  skills: string[]
  capacityPerHour: number
  location?: string
  active: boolean
  createdAt: any
  updatedAt: any
}

export interface Resource {
  id: string
  type: 'person' | 'machine'
  name: string
  skills: string[]
  calendarId?: string
  hourlyCost?: number
  active: boolean
  createdAt: any
  updatedAt: any
}

// ===== JOB MANAGEMENT =====

export async function listJobs(
  workspaceId: string,
  filters?: {
    status?: string[]
    stageId?: string
    workcenterId?: string
    assigneeId?: string
    priority?: number[]
    customerId?: string
    dueBefore?: Date
  },
  pagination?: {
    limit?: number
    startAfter?: DocumentSnapshot
  }
): Promise<{ jobs: Job[]; lastDoc?: DocumentSnapshot }> {
  try {
    // Build query constraints
    const constraints: any[] = []

    // Apply filters first
    if (filters?.status && filters.status.length > 0) {
      constraints.push(where('status', 'in', filters.status))
    }
    if (filters?.stageId) {
      constraints.push(where('currentStageId', '==', filters.stageId))
    }
    if (filters?.workcenterId) {
      constraints.push(where('workcenterId', '==', filters.workcenterId))
    }
    if (filters?.assigneeId) {
      constraints.push(where('assignees', 'array-contains', filters.assigneeId))
    }
    if (filters?.priority && filters.priority.length > 0) {
      constraints.push(where('priority', 'in', filters.priority))
    }
    if (filters?.customerId) {
      constraints.push(where('customer.id', '==', filters.customerId))
    }
    if (filters?.dueBefore) {
      constraints.push(where('dueDate', '<=', filters.dueBefore))
    }

    // Add ordering only if no array filters (which require composite index)
    if (!filters?.status?.length && !filters?.priority?.length) {
      constraints.push(orderBy('createdAt', 'desc'))
    }

    if (pagination?.limit) {
      constraints.push(limit(pagination.limit))
    }
    if (pagination?.startAfter) {
      constraints.push(startAfter(pagination.startAfter))
    }

    // Build final query
    const q = query(collection(db, 'workspaces', workspaceId, 'jobs'), ...constraints)

    const snap = await getDocs(q)
    const jobs = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Job[]

    return {
      jobs,
      lastDoc: snap.docs[snap.docs.length - 1] as DocumentSnapshot | undefined
    }
  } catch (error) {
    console.error('Error fetching jobs:', error)
    throw error
  }
}

export async function getJob(workspaceId: string, jobId: string): Promise<Job | null> {
  try {
    const docRef = doc(db, 'workspaces', workspaceId, 'jobs', jobId)
    const snap = await getDoc(docRef)
    if (!snap.exists()) return null
    return { id: snap.id, ...(snap.data() as any) } as Job
  } catch (error) {
    console.error('Error fetching job:', error)
    throw error
  }
}

export async function createJob(workspaceId: string, input: JobInput): Promise<Job> {
  if (!workspaceId) {
    throw new Error('workspaceId is required to create a job')
  }

  const jobsCol = collection(db, 'workspaces', workspaceId, 'jobs')
  const now = serverTimestamp()

  const basePayload = {
    ...input,
    createdAt: now,
    createdBy: 'current-user', // TODO: Get from auth context
    updatedAt: now,
    totalValue: 0, // Will be calculated based on BOM
  }

  const sanitized = sanitizeForFirestore(basePayload)
  console.log('createJob sanitized payload ->', sanitized)

  let docRef
  try {
    docRef = await addDoc(jobsCol, sanitized as any)
  } catch (err) {
    console.error('createJob addDoc failed:', err)
    throw err
  }

  // Generate QR and Barcode for the job (optional, don't fail if it fails)
  let qrUrl: string | undefined
  let barcodeUrl: string | undefined

  try {
    const qrData = await generateQRCodeDataURL(input.code || docRef.id)
    const barcodeData = await generateBarcodeDataURL(input.code || docRef.id)

    const qrRef = ref(storage, `workspaces/${workspaceId}/jobs/${docRef.id}/qr.png`)
    const barRef = ref(storage, `workspaces/${workspaceId}/jobs/${docRef.id}/barcode.png`)

    // Convert data URLs to bytes
    async function uploadDataUrl(storageRef: any, dataUrl: string) {
      const res = await fetch(dataUrl)
      const buf = await res.arrayBuffer()
      await uploadBytes(storageRef, new Uint8Array(buf), { contentType: 'image/png' })
      return await getDownloadURL(storageRef)
    }

    const [qrUrlResult, barcodeUrlResult] = await Promise.all([
      uploadDataUrl(qrRef, qrData.dataUrl),
      uploadDataUrl(barRef, barcodeData),
    ])

    qrUrl = qrUrlResult
    barcodeUrl = barcodeUrlResult

    // Update job with QR and barcode URLs
    const afterCreateUpdate = sanitizeForFirestore({
      qrUrl,
      barcodeUrl,
      updatedAt: serverTimestamp(),
    })

    await updateDoc(doc(db, 'workspaces', workspaceId, 'jobs', docRef.id), afterCreateUpdate)
  } catch (err) {
    console.warn('createJob QR/Barcode generation failed (continuing anyway):', err)
    // Don't throw - continue without QR/Barcode URLs
  }

  return {
    id: docRef.id,
    ...input,
    qrUrl,
    barcodeUrl,
    createdAt: now,
    createdBy: 'current-user',
    updatedAt: now,
    totalValue: 0,
  }
}

export async function updateJob(
  workspaceId: string,
  jobId: string,
  input: Partial<JobInput>
): Promise<void> {
  const target = doc(db, 'workspaces', workspaceId, 'jobs', jobId)

  const updatePayload = sanitizeForFirestore({
    ...input,
    updatedAt: serverTimestamp(),
  })

  await updateDoc(target, updatePayload as any)
}

export async function saveJobQr(
  workspaceId: string,
  jobId: string,
  dataUrl: string
): Promise<string> {
  // Delete old QR code if exists
  const oldQrRef = ref(storage, `workspaces/${workspaceId}/jobs/${jobId}/qr.png`)
  try {
    await deleteObject(oldQrRef)
  } catch (err) {
    // Ignore if file doesn't exist
    console.log('Old QR code not found or already deleted')
  }

  // Upload new QR code
  const qrRef = ref(storage, `workspaces/${workspaceId}/jobs/${jobId}/qr.png`)
  const res = await fetch(dataUrl)
  const buf = await res.arrayBuffer()
  await uploadBytes(qrRef, new Uint8Array(buf), { contentType: 'image/png' })
  const url = await getDownloadURL(qrRef)
  
  // Update job with new QR URL
  await updateDoc(doc(db, 'workspaces', workspaceId, 'jobs', jobId), {
    qrUrl: url,
    updatedAt: serverTimestamp(),
  } as any)
  
  return url
}

export async function deleteJobQr(
  workspaceId: string,
  jobId: string
): Promise<void> {
  const qrRef = ref(storage, `workspaces/${workspaceId}/jobs/${jobId}/qr.png`)
  try {
    await deleteObject(qrRef)
  } catch (err) {
    // Ignore if file doesn't exist
  }
  await updateDoc(doc(db, 'workspaces', workspaceId, 'jobs', jobId), {
    qrUrl: null,
    updatedAt: serverTimestamp(),
  } as any)
}

// Helper function to calculate when threshold was met for a stage
async function calculateThresholdMetAt(
  workspaceId: string,
  jobId: string,
  stageId: string,
  jobData: any
): Promise<number | null> {
  if (!stageId || !jobData) return null

  try {
    // Fetch all production runs to calculate previous stage output
    const runsCol = collection(db, 'workspaces', workspaceId, 'jobs', jobId, 'productionRuns')
    const allRunsSnap = await getDocs(query(runsCol, orderBy('at', 'asc')))
    const allRuns = allRunsSnap.docs.map(d => ({ id: d.id, ...d.data() } as any))

    // Get runs for this stage
    const runs = allRuns.filter((r: any) => r.stageId === stageId)
    if (runs.length === 0) return null

    // Fetch workflow to get stage info for UOM conversion
    const workflowsRef = collection(db, 'workspaces', workspaceId, 'workflows')
    const workflowSnap = await getDoc(doc(workflowsRef, jobData.workflowId))
    const workflow = workflowSnap.exists() ? workflowSnap.data() : null
    const stageInfo = workflow?.stages?.find((s: any) => s.id === stageId)
    const stageOutputUOM = stageInfo?.outputUOM || ''
    const numberUp = jobData.productionSpecs?.numberUp || 1

    // Find previous stage from planned stages
    const plannedStages: string[] = Array.isArray(jobData.plannedStageIds) ? jobData.plannedStageIds : []
    const currentStageIndex = plannedStages.indexOf(stageId)
    const previousStageId = currentStageIndex > 0 ? plannedStages[currentStageIndex - 1] : null

    // Calculate planned quantity - use previous stage's output if available
    let plannedQty: number
    if (previousStageId) {
      // Get previous stage info
      const previousStageInfo = workflow?.stages?.find((s: any) => s.id === previousStageId)
      const previousStageOutputUOM = previousStageInfo?.outputUOM || ''

      // Get previous stage runs
      const previousStageRuns = allRuns.filter((r: any) => r.stageId === previousStageId)

      // Calculate previous stage total output (runs are already in output UOM after conversion)
      const previousStageTotalOutput = previousStageRuns.reduce((sum: number, r: any) => {
        return sum + Number(r.qtyGood || 0) // Already in output UOM
      }, 0)

      if (previousStageTotalOutput > 0) {
        // Use previous stage output as planned quantity
        // Convert to current stage output UOM if needed
        if (previousStageOutputUOM === stageOutputUOM) {
          plannedQty = previousStageTotalOutput
        } else if (previousStageOutputUOM === 'cartoon' && stageOutputUOM === 'sheets' && numberUp > 0) {
          plannedQty = previousStageTotalOutput / numberUp
        } else if (previousStageOutputUOM === 'sheets' && stageOutputUOM === 'cartoon' && numberUp > 0) {
          plannedQty = previousStageTotalOutput * numberUp
        } else {
          plannedQty = previousStageTotalOutput
        }
      } else {
        // Fallback to original plan if no previous stage output
        if (stageOutputUOM === 'cartoon') {
          const boxQty = jobData.packaging?.plannedBoxes || 0
          const pcsPerBox = jobData.packaging?.pcsPerBox || 1
          plannedQty = boxQty * pcsPerBox
        } else {
          const bom = Array.isArray(jobData.bom) ? jobData.bom : []
          const sheetItem = bom.find((item: any) => {
            const uom = String(item.uom || '').toLowerCase()
            return ['sht', 'sheet', 'sheets'].includes(uom)
          })
          plannedQty = sheetItem ? Number(sheetItem.qtyRequired || 0) : (jobData.output?.[0]?.qtyPlanned || Number(jobData.quantity || 0))
        }
      }
    } else {
      // First stage - use original planned quantity
      if (stageOutputUOM === 'cartoon') {
        const boxQty = jobData.packaging?.plannedBoxes || 0
        const pcsPerBox = jobData.packaging?.pcsPerBox || 1
        plannedQty = boxQty * pcsPerBox
      } else {
        const bom = Array.isArray(jobData.bom) ? jobData.bom : []
        const sheetItem = bom.find((item: any) => {
          const uom = String(item.uom || '').toLowerCase()
          return ['sht', 'sheet', 'sheets'].includes(uom)
        })
        plannedQty = sheetItem ? Number(sheetItem.qtyRequired || 0) : (jobData.output?.[0]?.qtyPlanned || Number(jobData.quantity || 0))
      }
    }

    const WASTAGE_THRESHOLD_LOWER = 400
    const completionThreshold = Math.max(0, plannedQty - WASTAGE_THRESHOLD_LOWER)

    // Calculate cumulative production and find when threshold was met
    // Production runs are already stored in output UOM, so use directly
    let cumulativeTotal = 0
    for (const run of runs) {
      const qtyGood = Number(run.qtyGood || 0) // Already in output UOM
      cumulativeTotal += qtyGood

      if (cumulativeTotal >= completionThreshold) {
        // Threshold met at this run's timestamp
        const runAt = run.at
        if (runAt?.seconds) {
          return runAt.seconds
        } else if (runAt) {
          // If it's a Date object
          return Math.floor(new Date(runAt).getTime() / 1000)
        }
      }
    }

    return null
  } catch (error) {
    console.warn('calculateThresholdMetAt error:', error)
    return null
  }
}

export async function moveJobToStage(
  workspaceId: string,
  jobId: string,
  newStageId: string,
  actorId: string,
  note?: string
): Promise<void> {
  const batch = writeBatch(db)

  // Read job for guard checks and history
  const jobRef = doc(db, 'workspaces', workspaceId, 'jobs', jobId)
  const currentSnap = await getDoc(jobRef)
  const jobData = currentSnap.exists() ? (currentSnap.data() as any) : null
  const previousStageId = (jobData?.currentStageId ?? null) || null

  // Guard: Only allow stage moves when job is Released or In-Progress
  const status = String(jobData?.status || '')
  if (status !== 'released' && status !== 'in_progress') {
    throw new Error("Bu iş 'Released' değil. Aşama değişikliği için önce Release yapmalısınız.")
  }

  // Enforce linear progression based on planned stage order
  const planned: string[] = Array.isArray(jobData?.plannedStageIds) ? jobData.plannedStageIds : []
  if (planned.length > 0) {
    const currentIdx = planned.indexOf(previousStageId || planned[0])
    const targetIdx = planned.indexOf(newStageId)
    if (targetIdx === -1) {
      throw new Error('Target stage is not part of planned workflow')
    }
    // Disallow moving backwards or skipping ahead
    if (targetIdx < currentIdx) {
      throw new Error('Önceki aşamalara geri dönülemez')
    }
    if (targetIdx > currentIdx + 1) {
      throw new Error('Aşamalar sırayla ilerlemelidir; adım atlanamaz')
    }
  }

  // Guard: Require output to advance (if enabled) — ensure at least one production run exists for previous stage
  if (jobData?.requireOutputToAdvance && previousStageId && newStageId !== previousStageId) {
    const runsCol = collection(db, 'workspaces', workspaceId, 'jobs', jobId, 'productionRuns')
    const snap = await getDocs(query(runsCol, where('stageId', '==', previousStageId)))
    const hasAnyRun = snap.docs.length > 0
    if (!hasAnyRun) {
      throw new Error('Bu işte aşama ilerletmek için mevcut aşamada üretim girişi (output) zorunludur.')
    }
  }

  // Calculate threshold met date for previous stage
  let thresholdMetAt: number | null = null
  if (previousStageId && newStageId !== previousStageId) {
    thresholdMetAt = await calculateThresholdMetAt(workspaceId, jobId, previousStageId, jobData)
  }

  // Update job stage
  batch.update(jobRef, {
    currentStageId: newStageId,
    updatedAt: serverTimestamp(),
  })

  // Add history event (avoid undefined fields in Firestore)
  const historyRef = doc(collection(db, 'workspaces', workspaceId, 'jobs', jobId, 'history'))
  const payload: any = { newStageId, previousStageId }
  if (typeof note === 'string' && note.trim().length > 0) {
    payload.note = note
  }
  // Add threshold met timestamp if available
  if (thresholdMetAt !== null) {
    payload.previousStageThresholdMetAt = thresholdMetAt
  }
  batch.set(historyRef, {
    at: serverTimestamp(),
    actorId,
    type: 'stage_change',
    payload,
  })

  await batch.commit()
}

export async function setJobStatus(
  workspaceId: string,
  jobId: string,
  status: JobInput['status'],
  blockReason?: string
): Promise<void> {
  // Read current job to check previous status and stage
  const jobRef = doc(db, 'workspaces', workspaceId, 'jobs', jobId)
  const snap = await getDoc(jobRef)
  const prev = snap.exists() ? (snap.data() as any) : null

  const updateData: any = { status, updatedAt: serverTimestamp() }
  if (status === 'blocked' && blockReason) updateData.blockReason = blockReason

  await updateDoc(jobRef, updateData)

  // If moving to Released for the first time, emit a stage_change to mark start of first stage
  try {
    if (status === 'released' && prev && prev.status !== 'released') {
      const firstStageId = String(prev.currentStageId || '')
      if (firstStageId) {
        const historyRef = doc(collection(db, 'workspaces', workspaceId, 'jobs', jobId, 'history'))
        await setDoc(historyRef, {
          at: serverTimestamp(),
          actorId: 'system',
          type: 'stage_change',
          payload: { previousStageId: null, newStageId: firstStageId, reason: 'job_released' },
        } as any)
      }
    }

    // If moving to Blocked, emit a status_change history event
    if (status === 'blocked' && prev && prev.status !== 'blocked') {
      const historyRef = doc(collection(db, 'workspaces', workspaceId, 'jobs', jobId, 'history'))
      await setDoc(historyRef, {
        at: serverTimestamp(),
        actorId: 'current-user', // TODO: Get from auth context
        type: 'status_change',
        payload: {
          previousStatus: prev.status || 'unknown',
          newStatus: 'blocked',
          reason: blockReason || 'Job blocked',
          blockReason: blockReason
        },
      } as any)
    }

    // If moving from Blocked to In Progress (Resume), emit a status_change history event
    if (status === 'in_progress' && prev && prev.status === 'blocked') {
      const historyRef = doc(collection(db, 'workspaces', workspaceId, 'jobs', jobId, 'history'))
      await setDoc(historyRef, {
        at: serverTimestamp(),
        actorId: 'current-user', // TODO: Get from auth context
        type: 'status_change',
        payload: {
          previousStatus: 'blocked',
          newStatus: 'in_progress',
          reason: 'Job resumed',
          previousBlockReason: prev.blockReason
        },
      } as any)
    }

    // If moving to Done, emit a status_change history event
    if (status === 'done' && prev && prev.status !== 'done') {
      const historyRef = doc(collection(db, 'workspaces', workspaceId, 'jobs', jobId, 'history'))
      await setDoc(historyRef, {
        at: serverTimestamp(),
        actorId: 'system',
        type: 'status_change',
        payload: {
          previousStatus: prev.status || 'unknown',
          newStatus: 'done',
          reason: 'job_completed'
        },
      } as any)
    }
  } catch (e) {
    console.warn('setJobStatus: failed to record history event', e)
  }
}

export async function deleteJob(workspaceId: string, jobId: string): Promise<void> {
  await deleteDoc(doc(db, 'workspaces', workspaceId, 'jobs', jobId))
}

// ===== WORKFLOW MANAGEMENT =====

export async function listWorkflows(workspaceId: string): Promise<Workflow[]> {
  try {
    const workflowsCol = collection(db, 'workspaces', workspaceId, 'workflows')
    const qy = query(workflowsCol, orderBy('name'))
    const snap = await getDocs(qy)
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Workflow[]
  } catch (error) {
    console.error('Error fetching workflows:', error)
    throw error
  }
}

export async function createWorkflow(workspaceId: string, input: WorkflowInput): Promise<string> {
  const col = collection(db, 'workspaces', workspaceId, 'workflows')
  const ref = await addDoc(col, {
    ...input,
    isDefault: input.isDefault ?? false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  } as any)
  return ref.id
}

export async function updateWorkflow(
  workspaceId: string,
  workflowId: string,
  input: Partial<WorkflowInput>
): Promise<void> {
  await updateDoc(doc(db, 'workspaces', workspaceId, 'workflows', workflowId), {
    ...input,
    updatedAt: serverTimestamp(),
  } as any)
}

export async function deleteWorkflow(workspaceId: string, workflowId: string): Promise<void> {
  await deleteDoc(doc(db, 'workspaces', workspaceId, 'workflows', workflowId))
}

// ===== WORKCENTER MANAGEMENT =====

export async function listWorkcenters(workspaceId: string): Promise<Workcenter[]> {
  try {
    const workcentersCol = collection(db, 'workspaces', workspaceId, 'workcenters')
    const qy = query(workcentersCol, orderBy('name'))
    const snap = await getDocs(qy)
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Workcenter[]
  } catch (error) {
    console.error('Error fetching workcenters:', error)
    throw error
  }
}

export async function createWorkcenter(
  workspaceId: string,
  input: Omit<Workcenter, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const col = collection(db, 'workspaces', workspaceId, 'workcenters')
  const ref = await addDoc(col, {
    ...input,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  } as any)
  return ref.id
}

export async function updateWorkcenter(
  workspaceId: string,
  workcenterId: string,
  input: Partial<Omit<Workcenter, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<void> {
  await updateDoc(doc(db, 'workspaces', workspaceId, 'workcenters', workcenterId), {
    ...input,
    updatedAt: serverTimestamp(),
  } as any)
}

export async function deleteWorkcenter(workspaceId: string, workcenterId: string): Promise<void> {
  await deleteDoc(doc(db, 'workspaces', workspaceId, 'workcenters', workcenterId))
}

// ===== RESOURCE MANAGEMENT =====

export async function listResources(workspaceId: string): Promise<Resource[]> {
  try {
    const resourcesCol = collection(db, 'workspaces', workspaceId, 'resources')
    const qy = query(resourcesCol, orderBy('name'))
    const snap = await getDocs(qy)
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Resource[]
  } catch (error) {
    console.error('Error fetching resources:', error)
    throw error
  }
}

export async function createResource(
  workspaceId: string,
  input: Omit<Resource, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const col = collection(db, 'workspaces', workspaceId, 'resources')
  const ref = await addDoc(col, {
    ...input,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  } as any)
  return ref.id
}

export async function updateResource(
  workspaceId: string,
  resourceId: string,
  input: Partial<Omit<Resource, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<void> {
  await updateDoc(doc(db, 'workspaces', workspaceId, 'resources', resourceId), {
    ...input,
    updatedAt: serverTimestamp(),
  } as any)
}

export async function deleteResource(workspaceId: string, resourceId: string): Promise<void> {
  await deleteDoc(doc(db, 'workspaces', workspaceId, 'resources', resourceId))
}

// ===== TICKET MANAGEMENT =====

export async function listJobTickets(workspaceId: string, jobId: string): Promise<Ticket[]> {
  try {
    const ticketsCol = collection(db, 'workspaces', workspaceId, 'jobs', jobId, 'tickets')
    const qy = query(ticketsCol, orderBy('createdAt', 'desc'))
    const snap = await getDocs(qy)
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Ticket[]
  } catch (error) {
    console.error('Error fetching tickets:', error)
    throw error
  }
}

export async function createTicket(
  workspaceId: string,
  jobId: string,
  input: Omit<Ticket, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const col = collection(db, 'workspaces', workspaceId, 'jobs', jobId, 'tickets')
  const ref = await addDoc(col, {
    ...input,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  } as any)
  return ref.id
}

// ===== CONSUMPTION MANAGEMENT =====

export async function listJobConsumptions(workspaceId: string, jobId: string): Promise<Consumption[]> {
  try {
    const consumptionsCol = collection(db, 'workspaces', workspaceId, 'jobs', jobId, 'consumptions')
    const qy = query(consumptionsCol, orderBy('at', 'desc'))
    const snap = await getDocs(qy)
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Consumption[]
  } catch (error) {
    console.error('Error fetching consumptions:', error)
    throw error
  }
}

export async function createConsumption(
  workspaceId: string,
  jobId: string,
  input: Omit<Consumption, 'id' | 'at'>
): Promise<string> {
  const col = collection(db, 'workspaces', workspaceId, 'jobs', jobId, 'consumptions')
  const ref = await addDoc(col, {
    ...input,
    at: serverTimestamp(),
  } as any)

  // Create a stock transaction to decrement on-hand
  try {
    if ((input as any).approved && (input as any).itemId && Number(input.qtyUsed) > 0) {
      // Read job code for nicer reason text
      const jobDoc = await getDoc(doc(db, 'workspaces', workspaceId, 'jobs', jobId))
      const jobData = jobDoc.exists() ? (jobDoc.data() as any) : null
      const jobCode = jobData?.code || jobId
      const wcId = jobData?.workcenterId || null
      let wcName: string | null = null
      if (wcId) {
        const wcDoc = await getDoc(doc(db, 'workspaces', workspaceId, 'workcenters', wcId))
        wcName = wcDoc.exists() ? ((wcDoc.data() as any).name || wcId) : wcId
      }

      await createStockTransaction({
        workspaceId,
        productId: (input as any).itemId,
        type: 'out',
        qty: Number(input.qtyUsed),
        userId: (input as any).userId || 'current-user',
        reason: `Job consumption (${jobCode})`,
        reference: wcName ? `${jobCode} • Workcenter: ${wcName}` : `${jobCode}`,
        // also include structured references for richer UIs
        // @ts-ignore
        refs: { jobId, jobCode, workcenterId: wcId, workcenterName: wcName },
      })
    }
  } catch (e) {
    console.error('createConsumption: stock transaction failed', e)
  }
  // Update BOM consumed figures for UI consistency
  try {
    if ((input as any).approved) {
      await recalculateJobBomConsumption(workspaceId, jobId)
      console.log('[createConsumption] BOM consumed values recalculated successfully')
    } else {
      console.log('[createConsumption] Consumption not approved, skipping BOM recalculation')
    }
  } catch (e) {
    console.error('createConsumption: bom recompute failed', e)
    // Don't throw - consumption is already created
  }
  return ref.id
}

export async function deleteConsumption(
  workspaceId: string,
  jobId: string,
  consumptionId: string,
  restock: boolean
): Promise<void> {
  const docRef = doc(db, 'workspaces', workspaceId, 'jobs', jobId, 'consumptions', consumptionId)
  const snap = await getDoc(docRef)
  const data = snap.exists() ? (snap.data() as any) : null
  await deleteDoc(docRef)
  // Optional restock
  try {
    if (restock && data?.approved && data?.itemId && Number(data?.qtyUsed) > 0) {
      // Read job code for nicer reason text
      const jobDoc = await getDoc(doc(db, 'workspaces', workspaceId, 'jobs', jobId))
      const jobData = jobDoc.exists() ? (jobDoc.data() as any) : null
      const jobCode = jobData?.code || jobId
      const wcId = jobData?.workcenterId || null
      let wcName: string | null = null
      if (wcId) {
        const wcDoc = await getDoc(doc(db, 'workspaces', workspaceId, 'workcenters', wcId))
        wcName = wcDoc.exists() ? ((wcDoc.data() as any).name || wcId) : wcId
      }

      await createStockTransaction({
        workspaceId,
        productId: data.itemId,
        type: 'in',
        qty: Number(data.qtyUsed),
        userId: data.userId || 'current-user',
        reason: `Reversal of consumption (${jobCode})`,
        reference: wcName ? `${jobCode} • Workcenter: ${wcName}` : `${jobCode}`,
        // @ts-ignore
        refs: { jobId, jobCode, workcenterId: wcId, workcenterName: wcName },
      })
    }
  } catch (e) {
    console.error('deleteConsumption: restock failed', e)
  }
  // Recompute BOM consumed after deletion
  try {
    await recalculateJobBomConsumption(workspaceId, jobId)
  } catch (e) {
    console.warn('deleteConsumption: bom recompute failed', e)
  }
}

export async function approveConsumption(
  workspaceId: string,
  jobId: string,
  consumptionId: string
): Promise<void> {
  const cRef = doc(db, 'workspaces', workspaceId, 'jobs', jobId, 'consumptions', consumptionId)
  const snap = await getDoc(cRef)
  if (!snap.exists()) return
  const data = snap.data() as any
  if (data.approved) return

  // mark approved
  await updateDoc(cRef, { approved: true, at: serverTimestamp() })

  // perform stock transaction
  if (data.itemId && Number(data.qtyUsed) > 0) {
    const jobDoc = await getDoc(doc(db, 'workspaces', workspaceId, 'jobs', jobId))
    const jobData = jobDoc.exists() ? (jobDoc.data() as any) : null
    const jobCode = jobData?.code || jobId
    const wcId = jobData?.workcenterId || null
    let wcName: string | null = null
    if (wcId) {
      const wcDoc = await getDoc(doc(db, 'workspaces', workspaceId, 'workcenters', wcId))
      wcName = wcDoc.exists() ? ((wcDoc.data() as any).name || wcId) : wcId
    }
    await createStockTransaction({
      workspaceId,
      productId: data.itemId,
      type: 'out',
      qty: Number(data.qtyUsed),
      userId: data.userId || 'current-user',
      reason: `Job consumption (${jobCode})`,
      reference: wcName ? `${jobCode} • Workcenter: ${wcName}` : `${jobCode}`,
      // @ts-ignore
      refs: { jobId, jobCode, workcenterId: wcId, workcenterName: wcName },
    })
  }

  // Auto-start rule: if at least one approved consumption exists, or if all BOM items are fully approved, move job to in_progress
  try {
    const jobRef = doc(db, 'workspaces', workspaceId, 'jobs', jobId)
    const jobSnap = await getDoc(jobRef)
    if (jobSnap.exists()) {
      const job = jobSnap.data() as any
      const bom: any[] = job.bom || []
      const consCol = collection(db, 'workspaces', workspaceId, 'jobs', jobId, 'consumptions')
      const consSnap = await getDocs(query(consCol, where('approved', '==', true)))
      const hasAnyApproved = consSnap.docs.length > 0

      let allCovered = false
      if (bom.length > 0) {
        const totalsByItem: Record<string, number> = {}
        consSnap.docs.forEach(d => {
          const r = d.data() as any
          const key = String(r.itemId || r.sku)
          totalsByItem[key] = (totalsByItem[key] || 0) + Number(r.qtyUsed || 0)
        })
        allCovered = bom.every(b => {
          const key = String((b as any).itemId || b.sku)
          const need = Number(b.qtyRequired || 0)
          const have = Number(totalsByItem[key] || 0)
          return have >= need
        })
      }

      if ((hasAnyApproved || allCovered) && job.status !== 'in_progress') {
        await updateDoc(jobRef, { status: 'in_progress', updatedAt: serverTimestamp() })
        const historyRef = doc(collection(db, 'workspaces', workspaceId, 'jobs', jobId, 'history'))
        await setDoc(historyRef, {
          at: serverTimestamp(),
          actorId: data.userId || 'system',
          type: 'status_change',
          payload: { newStatus: 'in_progress', previousStatus: job.status, reason: hasAnyApproved ? 'First material approved' : 'All materials approved' },
        } as any)
      }
    }
  } catch (e) {
    console.warn('approveConsumption: auto-start check failed', e)
  }
  // Recompute BOM consumed so Materials section updates
  try {
    await recalculateJobBomConsumption(workspaceId, jobId)
  } catch (e) {
    console.warn('approveConsumption: bom recompute failed', e)
  }
}

export async function updateConsumption(
  workspaceId: string,
  jobId: string,
  consumptionId: string,
  input: Partial<Omit<Consumption, 'id' | 'at' | 'userId' | 'stageId'>>
): Promise<void> {
  const cRef = doc(db, 'workspaces', workspaceId, 'jobs', jobId, 'consumptions', consumptionId)
  const payload = sanitizeForFirestore(input)
  await updateDoc(cRef, payload as any)
  try {
    await recalculateJobBomConsumption(workspaceId, jobId)
  } catch (e) {
    console.warn('updateConsumption: bom recompute failed', e)
  }
}

// ===== TIME LOG MANAGEMENT =====

export async function listJobTimeLogs(workspaceId: string, jobId: string): Promise<TimeLog[]> {
  try {
    const timelogsCol = collection(db, 'workspaces', workspaceId, 'jobs', jobId, 'timelogs')
    const qy = query(timelogsCol, orderBy('startedAt', 'desc'))
    const snap = await getDocs(qy)
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as TimeLog[]
  } catch (error) {
    console.error('Error fetching timelogs:', error)
    throw error
  }
}

export async function createTimeLog(
  workspaceId: string,
  jobId: string,
  input: Omit<TimeLog, 'id'>
): Promise<string> {
  const col = collection(db, 'workspaces', workspaceId, 'jobs', jobId, 'timelogs')
  const ref = await addDoc(col, input as any)
  return ref.id
}

// ===== HISTORY MANAGEMENT =====

export async function listJobHistory(workspaceId: string, jobId: string): Promise<HistoryEvent[]> {
  try {
    const historyCol = collection(db, 'workspaces', workspaceId, 'jobs', jobId, 'history')
    const qy = query(historyCol, orderBy('at', 'desc'))
    const snap = await getDocs(qy)
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as HistoryEvent[]
  } catch (error) {
    console.error('Error fetching history:', error)
    throw error
  }
}

// ===== OUTPUT RECORDING & BACKFLUSHING =====

export async function recordJobOutput(
  workspaceId: string,
  jobId: string,
  params: {
    qtyOutput: number
    autoConsumeMaterials: boolean
    completeJob: boolean
    stageId?: string
    workcenterId?: string
    lot?: string
    notes?: string
    userId?: string
  }
): Promise<void> {
  const { qtyOutput, autoConsumeMaterials, completeJob, stageId, workcenterId, lot, notes, userId } = params
  const currentUser = userId || 'current-user'

  // 1. Fetch Job Data
  const jobRef = doc(db, 'workspaces', workspaceId, 'jobs', jobId)
  const jobSnap = await getDoc(jobRef)
  if (!jobSnap.exists()) throw new Error('Job not found')
  const job = jobSnap.data() as any

  // 2. Create Stock Transaction for Output (Finished Goods)
  // Only do this if we are recording a positive output quantity
  if (qtyOutput > 0) {
    // Look up product by SKU to get productId (Job doesn't have productId field)
    const product = await getProductByCode(workspaceId, job.sku)
    if (!product) {
      throw new Error(`Product not found for SKU: ${job.sku}. Cannot record output.`)
    }

    await createStockTransaction({
      workspaceId,
      productId: product.id,
      type: 'in',
      qty: qtyOutput,
      userId: currentUser,
      reason: `Production output (${job.code})`,
      reference: job.code,
      // @ts-ignore
      refs: { jobId, jobCode: job.code, stageId, workcenterId, lot, notes },
    })
  }

  // 3. Backflushing (Auto-consume materials)
  if (autoConsumeMaterials && qtyOutput > 0) {
    try {
      // Ensure we have a valid stageId (required by Consumption interface)
      const validStageId = stageId || job.currentStageId
      if (!validStageId) {
        console.warn('Cannot perform backflushing: stageId is required but not available')
      } else {
        const plannedQty = Number(job.quantity || 0)
        // Avoid division by zero
        if (plannedQty > 0) {
          const proportion = qtyOutput / plannedQty
          const bom = Array.isArray(job.bom) ? job.bom : []

          // Process each BOM item
          for (const item of bom) {
            const required = Number(item.qtyRequired || 0)
            if (required > 0) {
              const qtyToConsume = required * proportion

              // Create consumption record (which triggers stock deduction)
              await createConsumption(workspaceId, jobId, {
                itemId: (item as any).itemId || (item as any).id, // Handle different BOM structures
                sku: item.sku,
                name: item.name,
                qtyUsed: qtyToConsume,
                uom: item.uom,
                approved: true, // Auto-approved
                userId: currentUser,
                stageId: validStageId,
                lot: '', // Backflushed items usually don't have specific lot tracking unless strict
                notes: 'Auto-consumed (Backflush)',
              })
            }
          }
        }
      }
    } catch (error) {
      console.error('Backflushing failed:', error)
      // We don't throw here to avoid rolling back the output recording, but we should probably alert the user
      // For now, we log it. In a real app, we might want to return a warning.
    }
  }

  // 4. Update Job Status if requested
  if (completeJob) {
    await setJobStatus(workspaceId, jobId, 'done')
  }
}

// ===== PRODUCTION RUNS (ACTUAL OUTPUT) =====
export async function listJobProductionRuns(workspaceId: string, jobId: string): Promise<ProductionRun[]> {
  try {
    const colRef = collection(db, 'workspaces', workspaceId, 'jobs', jobId, 'productionRuns')
    const qy = query(colRef, orderBy('at', 'desc'))
    const snap = await getDocs(qy)
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as ProductionRun[]
  } catch (error) {
    console.error('Error fetching production runs:', error)
    throw error
  }
}

export async function createProductionRun(
  workspaceId: string,
  jobId: string,
  input: Omit<ProductionRun, 'id'>
): Promise<string> {
  const colRef = collection(db, 'workspaces', workspaceId, 'jobs', jobId, 'productionRuns')
  const payload = sanitizeForFirestore({ ...input, at: (input as any).at || serverTimestamp() })
  const ref = await addDoc(colRef, payload as any)

  // Optionally roll-up qtyProduced on job.output[0] for quick progress bar
  try {
    const jobRef = doc(db, 'workspaces', workspaceId, 'jobs', jobId)
    const snap = await getDoc(jobRef)
    if (snap.exists()) {
      const job = snap.data() as any
      const runsSnap = await getDocs(collection(db, 'workspaces', workspaceId, 'jobs', jobId, 'productionRuns'))
      let totalGood = 0
      runsSnap.docs.forEach(r => { const d: any = r.data(); totalGood += Number(d.qtyGood || 0) })
      const output = Array.isArray(job.output) && job.output.length > 0
        ? job.output.map((o: any, idx: number) => idx === 0 ? { ...o, qtyProduced: totalGood } : o)
        : [{ sku: job.sku, name: job.productName, qtyPlanned: Number(job.quantity || 0), qtyProduced: totalGood, uom: job.unit }]
      await updateDoc(jobRef, { output, updatedAt: serverTimestamp() })
    }
  } catch (e) {
    console.warn('createProductionRun: roll-up failed', e)
  }

  return ref.id
}

// ===== HELPERS =====
export async function recalculateJobBomConsumption(workspaceId: string, jobId: string): Promise<void> {
  const jobRef = doc(db, 'workspaces', workspaceId, 'jobs', jobId)
  const jobSnap = await getDoc(jobRef)
  if (!jobSnap.exists()) return
  const job = jobSnap.data() as any
  const bom: any[] = Array.isArray(job.bom) ? job.bom : []
  if (bom.length === 0) return

  const consCol = collection(db, 'workspaces', workspaceId, 'jobs', jobId, 'consumptions')
  // Get ALL consumptions (both approved and not approved) for debugging
  const consSnapAll = await getDocs(consCol)
  // Get approved consumptions for actual calculation
  const consSnap = await getDocs(query(consCol, where('approved', '==', true)))
  
  console.log(`[recalculateJobBomConsumption] Job: ${jobId}, BOM items: ${bom.length}, Approved consumptions: ${consSnap.docs.length}, All consumptions: ${consSnapAll.docs.length}`)
  
  // Build multiple lookup maps for flexible matching
  const totalsByItemId: Record<string, number> = {}
  const totalsBySku: Record<string, number> = {}
  const totalsByName: Record<string, number> = {}
  // Special map for consumptions with empty SKU - match by name only
  const totalsByNameNoSku: Record<string, number> = {}
  
  consSnap.docs.forEach(d => {
    const r: any = d.data()
    const qtyUsed = Number(r.qtyUsed || 0)
    if (qtyUsed <= 0) return
    
    // Normalize keys (trim, lowercase for case-insensitive matching)
    const itemId = r.itemId ? String(r.itemId).trim() : null
    const sku = r.sku ? String(r.sku).trim().toLowerCase() : null
    const name = r.name ? String(r.name).trim().toLowerCase().replace(/\s+/g, ' ') : null
    
    console.log(`[recalculateJobBomConsumption] Consumption: itemId=${itemId}, sku=${sku || '(empty)'}, name=${name}, qtyUsed=${qtyUsed}`)
    
    if (itemId) {
      totalsByItemId[itemId] = (totalsByItemId[itemId] || 0) + qtyUsed
    }
    if (sku && sku !== '') {
      totalsBySku[sku] = (totalsBySku[sku] || 0) + qtyUsed
    }
    if (name) {
      totalsByName[name] = (totalsByName[name] || 0) + qtyUsed
      // If SKU is empty/null, also add to special map for name-only matching
      if (!sku || sku === '') {
        totalsByNameNoSku[name] = (totalsByNameNoSku[name] || 0) + qtyUsed
      }
    }
  })

  const nextBom = bom.map(b => {
    // Try multiple matching strategies
    let consumed = 0
    
    // 1. Try itemId match (most reliable)
    const bomItemId = (b as any).itemId ? String((b as any).itemId).trim() : null
    const bomSku = b.sku ? String(b.sku).trim().toLowerCase() : null
    const bomName = b.name ? String(b.name).trim().toLowerCase().replace(/\s+/g, ' ') : null
    
    console.log(`[recalculateJobBomConsumption] BOM item: itemId=${bomItemId || '(empty)'}, sku=${bomSku || '(empty)'}, name=${bomName || '(empty)'}`)
    
    if (bomItemId && totalsByItemId[bomItemId]) {
      consumed = totalsByItemId[bomItemId]
      console.log(`[recalculateJobBomConsumption] Matched by itemId: ${consumed}`)
    } else {
      // 2. Try SKU match (case-insensitive)
      if (bomSku && bomSku !== '' && totalsBySku[bomSku]) {
        consumed = totalsBySku[bomSku]
        console.log(`[recalculateJobBomConsumption] Matched by SKU: ${consumed}`)
      } else {
        // 3. Try name match (case-insensitive, fallback)
        if (bomName) {
          // If BOM item has no SKU (or empty SKU), prioritize name-only matching
          if ((!bomSku || bomSku === '') && totalsByNameNoSku[bomName]) {
            consumed = totalsByNameNoSku[bomName]
            console.log(`[recalculateJobBomConsumption] Matched by name (BOM no SKU): ${consumed}`)
          } else if (totalsByNameNoSku[bomName]) {
            // If consumption has no SKU but name matches, use it (even if BOM has SKU)
            consumed = totalsByNameNoSku[bomName]
            console.log(`[recalculateJobBomConsumption] Matched by name (consumption no SKU): ${consumed}`)
          } else if (totalsByName[bomName]) {
            // Otherwise use general name match
            consumed = totalsByName[bomName]
            console.log(`[recalculateJobBomConsumption] Matched by name: ${consumed}`)
          } else {
            console.log(`[recalculateJobBomConsumption] No match found for BOM item`)
            // Debug: show what we're looking for
            console.log(`[recalculateJobBomConsumption] Looking for: name="${bomName}", available names:`, Object.keys(totalsByName))
            console.log(`[recalculateJobBomConsumption] Available names (no SKU):`, Object.keys(totalsByNameNoSku))
          }
        }
      }
    }
    
    return { ...b, consumed: Number(consumed) }
  })

  await updateDoc(jobRef, { bom: nextBom, updatedAt: serverTimestamp() })
  console.log(`[recalculateJobBomConsumption] Updated BOM with consumed values`)
}

// ===== CUSTOMER MANAGEMENT =====

export async function listCustomers(workspaceId: string): Promise<Customer[]> {
  try {
    const customersCol = collection(db, 'workspaces', workspaceId, 'customers')
    const qy = query(customersCol, orderBy('name'))
    const snap = await getDocs(qy)
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Customer[]
  } catch (error) {
    console.error('Error fetching customers:', error)
    throw error
  }
}

export async function createCustomer(
  workspaceId: string,
  input: Omit<Customer, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const col = collection(db, 'workspaces', workspaceId, 'customers')
  const ref = await addDoc(col, {
    ...input,
    active: input.active ?? true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  } as any)
  return ref.id
}

export async function updateCustomer(
  workspaceId: string,
  customerId: string,
  input: Partial<Omit<Customer, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<void> {
  await updateDoc(doc(db, 'workspaces', workspaceId, 'customers', customerId), {
    ...input,
    updatedAt: serverTimestamp(),
  } as any)
}

export async function deleteCustomer(workspaceId: string, customerId: string): Promise<void> {
  await deleteDoc(doc(db, 'workspaces', workspaceId, 'customers', customerId))
}