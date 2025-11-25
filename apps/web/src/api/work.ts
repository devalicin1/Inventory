import { db } from '../lib/firebase'
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
  addDoc,
  serverTimestamp,
  orderBy,
} from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { functions } from '../lib/firebase'
import { sanitizeForFirestore } from '../utils/sanitize'
import { listJobs } from './production-jobs'

export interface Task {
  id: string
  title: string
  description?: string
  workflowId: string
  stageId: string
  assigneeId?: string
  assigneeName?: string
  priority: 'low' | 'med' | 'high' | 'urgent'
  dueDate?: string | Date
  status: 'Open' | 'InProgress' | 'Blocked' | 'Done'
  links?: {
    productId?: string
    poId?: string
    jobId?: string
  }
  createdAt?: any
  updatedAt?: any
}

export interface TaskInput {
  title: string
  description?: string
  workflowId: string
  stageId: string
  assigneeId?: string
  assigneeName?: string
  priority: 'low' | 'med' | 'high' | 'urgent'
  dueDate?: string | Date
  links?: {
    productId?: string
    poId?: string
    jobId?: string
  }
}

/**
 * Convert a Job to a Task format for Work Management
 */
function jobToTask(job: any, userId: string): Task | null {
  // Show jobs that are:
  // 1. Assigned to this user
  // 2. Have no assignees (unassigned jobs - show to everyone)
  // 3. Have empty assignees array
  const hasAssignees = job.assignees && Array.isArray(job.assignees) && job.assignees.length > 0
  if (hasAssignees && !job.assignees.includes(userId)) {
    return null // Job is assigned to someone else, don't show
  }

  // Map job status to task status
  const statusMap: Record<string, 'Open' | 'InProgress' | 'Blocked' | 'Done'> = {
    'draft': 'Open',
    'released': 'Open',
    'in_progress': 'InProgress',
    'blocked': 'Blocked',
    'done': 'Done',
    'cancelled': 'Open'
  }

  // Map job stage to task stage (keep same stage ID, but map common names)
  const stageId = job.currentStageId || 'open'
  // Keep the original stageId - it should match workflow stages

  // Map job priority (1-5) to task priority
  const priorityMap: Record<number, 'low' | 'med' | 'high' | 'urgent'> = {
    1: 'urgent',
    2: 'high',
    3: 'med',
    4: 'low',
    5: 'low'
  }

  const dueDate = job.dueDate?.toDate ? job.dueDate.toDate() : 
                  job.dueDate?.seconds ? new Date(job.dueDate.seconds * 1000) :
                  job.dueDate ? new Date(job.dueDate) : undefined

  return {
    id: `job-${job.id}`, // Prefix to distinguish from regular tasks
    title: `${job.code || job.id}: ${job.productName || job.sku || 'Untitled Job'}`,
    description: job.notes || `Production job for ${job.quantity} ${job.unit || 'pcs'}`,
    workflowId: job.workflowId || 'production',
    stageId: stageId,
    assigneeId: job.assignees?.[0] || userId,
    assigneeName: job.assignees?.[0] || 'Unassigned',
    priority: priorityMap[job.priority || 3] || 'med',
    dueDate: dueDate?.toISOString(),
    status: statusMap[job.status || 'draft'] || 'Open',
    links: {
      jobId: job.id,
    }
  }
}

/**
 * List tasks assigned to a specific user (including jobs converted to tasks)
 */
export async function listMyTasks(workspaceId: string, userId: string): Promise<Task[]> {
  if (!workspaceId || !userId) {
    console.warn('listMyTasks: Missing workspaceId or userId', { workspaceId, userId })
    return []
  }

  try {
    const tasksCol = collection(db, 'workspaces', workspaceId, 'tasks')
    
    // Try to query with assigneeId, but fallback to fetching all if index doesn't exist
    let snap
    try {
      // First try with assigneeId filter only (no orderBy to avoid index requirement)
      const q = query(
        tasksCol,
        where('assigneeId', '==', userId)
      )
      snap = await getDocs(q)
      console.log(`listMyTasks: Found ${snap.docs.length} tasks for userId ${userId} (with filter)`)
    } catch (queryError: any) {
      // If query fails (likely missing index), fetch all tasks and filter in memory
      console.warn('Query with assigneeId failed, fetching all tasks and filtering:', queryError?.message)
      const allTasksQuery = query(tasksCol)
      snap = await getDocs(allTasksQuery)
      console.log(`listMyTasks: Fetched ${snap.docs.length} total tasks, will filter for userId ${userId}`)
    }
    
    let tasks: Task[] = snap.docs.map((d) => {
      const data = d.data()
      return {
        id: d.id,
        title: data.title || '',
        description: data.description,
        workflowId: data.workflowId || '',
        stageId: data.stageId || 'open',
        assigneeId: data.assigneeId,
        assigneeName: data.assigneeName,
        priority: data.priority || 'med',
        dueDate: data.dueDate?.toDate ? data.dueDate.toDate().toISOString() : data.dueDate,
        status: data.status || 'Open',
        links: data.links,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      }
    })

    // Always filter by assigneeId in memory to ensure we only return user's tasks
    tasks = tasks.filter(t => t.assigneeId === userId)
    console.log(`listMyTasks: Found ${tasks.length} regular tasks for userId ${userId}`)

    // Also fetch jobs and convert them to tasks
    try {
      const jobsData = await listJobs(workspaceId, {
        status: ['released', 'in_progress', 'blocked'], // Only active jobs
      })
      const jobs = jobsData.jobs || []
      console.log(`listMyTasks: Found ${jobs.length} jobs to convert to tasks`)

      // Convert jobs to tasks
      const jobTasks = jobs
        .map(job => jobToTask(job, userId))
        .filter((task): task is Task => task !== null)

      // Merge tasks and job-tasks
      tasks = [...tasks, ...jobTasks]
      console.log(`listMyTasks: Total tasks after adding jobs: ${tasks.length}`)
    } catch (jobError) {
      console.warn('Error fetching jobs for task conversion:', jobError)
      // Continue with just regular tasks if job fetch fails
    }

    // Sort by dueDate if available
    tasks.sort((a, b) => {
      if (!a.dueDate && !b.dueDate) return 0
      if (!a.dueDate) return 1
      if (!b.dueDate) return -1
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
    })

    return tasks
  } catch (error) {
    console.error('Error fetching tasks:', error)
    // Fallback to empty array on error
    return []
  }
}

/**
 * List all tasks in a workspace (for managers/admins)
 */
export async function listAllTasks(workspaceId: string): Promise<Task[]> {
  if (!workspaceId) {
    return []
  }

  try {
    const tasksCol = collection(db, 'workspaces', workspaceId, 'tasks')
    const q = query(tasksCol, orderBy('createdAt', 'desc'))

    const snap = await getDocs(q)
    const tasks: Task[] = snap.docs.map((d) => {
      const data = d.data()
      return {
        id: d.id,
        title: data.title || '',
        description: data.description,
        workflowId: data.workflowId || '',
        stageId: data.stageId || 'open',
        assigneeId: data.assigneeId,
        assigneeName: data.assigneeName,
        priority: data.priority || 'med',
        dueDate: data.dueDate?.toDate ? data.dueDate.toDate().toISOString() : data.dueDate,
        status: data.status || 'Open',
        links: data.links,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      }
    })

    return tasks
  } catch (error) {
    console.error('Error fetching all tasks:', error)
    return []
  }
}

/**
 * Update task stage/status
 */
export async function updateTask(
  workspaceId: string,
  taskId: string,
  updates: {
    stageId?: string
    status?: 'Open' | 'InProgress' | 'Blocked' | 'Done'
    assigneeId?: string
    assigneeName?: string
    priority?: 'low' | 'med' | 'high' | 'urgent'
    dueDate?: string | Date
  }
): Promise<void> {
  if (!workspaceId || !taskId) {
    throw new Error('workspaceId and taskId are required')
  }

  try {
    const taskRef = doc(db, 'workspaces', workspaceId, 'tasks', taskId)
    const updateData: any = {
      ...updates,
      updatedAt: serverTimestamp(),
    }

    // Map stageId to status if status is not explicitly provided
    if (updates.stageId && !updates.status) {
      const stageToStatus: Record<string, 'Open' | 'InProgress' | 'Blocked' | 'Done'> = {
        open: 'Open',
        progress: 'InProgress',
        blocked: 'Blocked',
        done: 'Done',
      }
      updateData.status = stageToStatus[updates.stageId] || 'Open'
    }

    // Handle dueDate conversion
    if (updates.dueDate) {
      updateData.dueDate = typeof updates.dueDate === 'string' 
        ? new Date(updates.dueDate)
        : updates.dueDate
    }

    const sanitized = sanitizeForFirestore(updateData)
    await updateDoc(taskRef, sanitized)
  } catch (error) {
    console.error('Error updating task:', error)
    throw error
  }
}

/**
 * Create a new task
 */
export async function createTask(workspaceId: string, input: TaskInput): Promise<Task> {
  if (!workspaceId) {
    throw new Error('workspaceId is required')
  }

  try {
    const tasksCol = collection(db, 'workspaces', workspaceId, 'tasks')
    const now = serverTimestamp()

    const basePayload = {
      title: input.title.trim(),
      description: input.description?.trim() || null,
      workflowId: input.workflowId,
      stageId: input.stageId,
      assigneeId: input.assigneeId || null,
      assigneeName: input.assigneeName || null,
      priority: input.priority || 'med',
      dueDate: input.dueDate ? (typeof input.dueDate === 'string' ? new Date(input.dueDate) : input.dueDate) : null,
      status: input.stageId === 'open' ? 'Open' :
              input.stageId === 'progress' ? 'InProgress' :
              input.stageId === 'blocked' ? 'Blocked' :
              input.stageId === 'done' ? 'Done' : 'Open',
      links: input.links || null,
      createdAt: now,
      updatedAt: now,
    }

    const sanitized = sanitizeForFirestore(basePayload)
    const docRef = await addDoc(tasksCol, sanitized as any)

    return {
      id: docRef.id,
      ...basePayload,
      dueDate: basePayload.dueDate ? basePayload.dueDate.toISOString() : undefined,
    } as Task
  } catch (error) {
    console.error('Error creating task:', error)
    throw error
  }
}

/**
 * Complete a task (calls cloud function to handle stock transactions)
 */
export async function completeTask(
  workspaceId: string,
  taskId: string,
  produceQty: number = 0,
  consumeQty: number = 0
): Promise<{ success: boolean }> {
  if (!workspaceId || !taskId) {
    throw new Error('workspaceId and taskId are required')
  }

  try {
    const fn = httpsCallable(functions, 'completeTask')
    const res = await fn({
      workspaceId,
      taskId,
      produceQty,
      consumeQty,
    })
    return res.data as { success: boolean }
  } catch (error) {
    console.error('Error completing task:', error)
    throw error
  }
}

