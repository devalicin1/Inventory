import { db, storage } from '../lib/firebase'
import { createStockTransaction } from './inventory'
import {
  addDoc,
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
} from 'firebase/firestore'
import { getDownloadURL, ref, uploadBytes, deleteObject } from 'firebase/storage'
import { generateQRCodeDataURL } from '../utils/qrcode'
import { generateBarcodeDataURL } from '../utils/barcode'
import { sanitizeForFirestore, coerceNumberOrNull } from '../utils/sanitize'

// ===== INTERFACES =====

export interface Customer {
  id: string
  name: string
  orderNo?: string
}

export interface BOMItem {
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
  status: 'draft' | 'released' | 'in_progress' | 'blocked' | 'done' | 'cancelled'
  assignees: string[]
  workcenterId?: string
  plannedStart?: Date
  plannedEnd?: Date
  dueDate: Date
  risk?: 'ok' | 'warning' | 'overdue'
  customer: Customer
  notes?: string
  bom: BOMItem[]
  output: OutputItem[]
  packaging?: Packaging
  qaAcceptedAt?: Date
  customerAcceptedAt?: Date
  blockReason?: string
}

export interface Job extends JobInput {
  id: string
  createdAt: any
  createdBy: string
  updatedAt: any
  totalValue?: number
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
  sku: string
  name: string
  qtyUsed: number
  uom: string
  lot?: string
  userId: string
  at: any
}

export interface Attachment {
  id: string
  name: string
  url: string
  tag: string
  createdAt: any
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
    let q = query(collection(db, 'workspaces', workspaceId, 'jobs'), orderBy('createdAt', 'desc'))
    
    if (filters?.status && filters.status.length > 0) {
      q = query(q, where('status', 'in', filters.status))
    }
    if (filters?.stageId) {
      q = query(q, where('currentStageId', '==', filters.stageId))
    }
    if (filters?.workcenterId) {
      q = query(q, where('workcenterId', '==', filters.workcenterId))
    }
    if (filters?.assigneeId) {
      q = query(q, where('assignees', 'array-contains', filters.assigneeId))
    }
    if (filters?.priority && filters.priority.length > 0) {
      q = query(q, where('priority', 'in', filters.priority))
    }
    if (filters?.customerId) {
      q = query(q, where('customer.id', '==', filters.customerId))
    }
    if (filters?.dueBefore) {
      q = query(q, where('dueDate', '<=', filters.dueBefore))
    }
    
    if (pagination?.limit) {
      q = query(q, limit(pagination.limit))
    }
    if (pagination?.startAfter) {
      q = query(q, startAfter(pagination.startAfter))
    }

    const snap = await getDocs(q)
    const jobs = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Job[]
    
    return {
      jobs,
      lastDoc: snap.docs[snap.docs.length - 1]
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

  // Generate QR and Barcode for the job
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

  const [qrUrl, barcodeUrl] = await Promise.all([
    uploadDataUrl(qrRef, qrData.dataURL),
    uploadDataUrl(barRef, barcodeData),
  ])

  // Update job with QR and barcode URLs
  const afterCreateUpdate = sanitizeForFirestore({
    qrUrl,
    barcodeUrl,
    updatedAt: serverTimestamp(),
  })

  try {
    await updateDoc(doc(db, 'workspaces', workspaceId, 'jobs', docRef.id), afterCreateUpdate)
  } catch (err) {
    console.error('createJob updateDoc (qr/barcode) failed:', err, afterCreateUpdate)
    throw err
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

export async function moveJobToStage(
  workspaceId: string,
  jobId: string,
  newStageId: string,
  actorId: string
): Promise<void> {
  const batch = writeBatch(db)
  
  // Update job stage
  const jobRef = doc(db, 'workspaces', workspaceId, 'jobs', jobId)
  batch.update(jobRef, {
    currentStageId: newStageId,
    updatedAt: serverTimestamp(),
  })

  // Add history event
  const historyRef = doc(collection(db, 'workspaces', workspaceId, 'jobs', jobId, 'history'))
  batch.set(historyRef, {
    at: serverTimestamp(),
    actorId,
    type: 'stage_change',
    payload: { newStageId, previousStageId: 'unknown' }, // TODO: Get previous stage
  })

  await batch.commit()
}

export async function setJobStatus(
  workspaceId: string,
  jobId: string,
  status: JobInput['status'],
  blockReason?: string
): Promise<void> {
  const updateData: any = {
    status,
    updatedAt: serverTimestamp(),
  }

  if (status === 'blocked' && blockReason) {
    updateData.blockReason = blockReason
  }

  await updateDoc(doc(db, 'workspaces', workspaceId, 'jobs', jobId), updateData)
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
  input: Omit<Consumption, 'id'>
): Promise<string> {
  const col = collection(db, 'workspaces', workspaceId, 'jobs', jobId, 'consumptions')
  const ref = await addDoc(col, {
    ...input,
    at: serverTimestamp(),
  } as any)
  return ref.id
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