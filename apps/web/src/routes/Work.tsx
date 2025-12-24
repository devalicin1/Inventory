import React, { useState, type FC } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { KanbanBoard } from '../components/KanbanBoard'
import { DataTable } from '../components/DataTable'
import { listMyTasks, updateTask, createTask, completeTask, type Task, type TaskInput } from '../api/work'
import { useSessionStore } from '../state/sessionStore'
import { showToast } from '../components/ui/Toast'
import { 
  PlusIcon, 
  ViewColumnsIcon,
  Squares2X2Icon,
  XMarkIcon
} from '@heroicons/react/24/outline'

interface Stage {
  id: string
  name: string
  color: string
  isTerminal?: boolean
  wipLimit?: number
}

export function Work() {
  const [view, setView] = useState<'board' | 'list'>('board')
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const queryClient = useQueryClient()
  const { workspaceId, userId } = useSessionStore()

  // Fetch tasks from Firestore
  const { data: tasks = [], isLoading, error } = useQuery({
    queryKey: ['myTasks', workspaceId, userId],
    queryFn: () => listMyTasks(workspaceId || '', userId || ''),
    enabled: !!workspaceId && !!userId,
  })

  // Debug logging
  React.useEffect(() => {
    if (workspaceId && userId) {
      console.log('Work component - workspaceId:', workspaceId, 'userId:', userId)
      console.log('Work component - tasks:', tasks.length, 'isLoading:', isLoading)
      if (error) {
        console.error('Work component - error:', error)
      }
    }
  }, [workspaceId, userId, tasks.length, isLoading, error])

  const stages: Stage[] = [
    { id: 'open', name: 'Open', color: 'bg-gray-100' },
    { id: 'progress', name: 'In Progress', color: 'bg-blue-100' },
    { id: 'blocked', name: 'Blocked', color: 'bg-red-100' },
    { id: 'done', name: 'Done', color: 'bg-green-100', isTerminal: true },
  ]

  const handleTaskMove = async (taskId: string, newStageId: string) => {
    if (!workspaceId) return

    try {
      await updateTask(workspaceId, taskId, { stageId: newStageId })
      // Invalidate and refetch tasks
      queryClient.invalidateQueries({ queryKey: ['myTasks', workspaceId, userId] })
    } catch (error) {
      console.error('Failed to move task:', error)
      showToast('Failed to move task. Please try again.', 'error')
    }
  }

  const handleCreateDemoTasks = async () => {
    if (!workspaceId || !userId) return

    const demoTasks: TaskInput[] = [
      {
        title: 'Cut materials for Widget A',
        description: 'Cut 100 pieces of material according to specifications',
        workflowId: 'wf-1',
        stageId: 'open',
        assigneeId: userId,
        assigneeName: 'John Doe',
        priority: 'high',
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      },
      {
        title: 'Assemble Widget B components',
        description: 'Assemble 50 units of Widget B',
        workflowId: 'wf-1',
        stageId: 'progress',
        assigneeId: userId,
        assigneeName: 'John Doe',
        priority: 'med',
        dueDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), // 10 days from now
      },
      {
        title: 'Quality check Widget A',
        description: 'Perform quality inspection on completed Widget A units',
        workflowId: 'wf-1',
        stageId: 'blocked',
        assigneeId: userId,
        assigneeName: 'John Doe',
        priority: 'urgent',
        dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days from now
      },
      {
        title: 'Package completed items',
        description: 'Package and label completed Widget B units',
        workflowId: 'wf-1',
        stageId: 'done',
        assigneeId: userId,
        assigneeName: 'John Doe',
        priority: 'low',
        dueDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
      },
      {
        title: 'Prepare materials for next production run',
        description: 'Gather and prepare all materials needed for upcoming production batch',
        workflowId: 'wf-1',
        stageId: 'open',
        assigneeId: userId,
        assigneeName: 'John Doe',
        priority: 'med',
        dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 days from now
      }
    ]

    try {
      for (const task of demoTasks) {
        await createTask(workspaceId, task)
      }
      queryClient.invalidateQueries({ queryKey: ['myTasks', workspaceId, userId] })
      showToast('Demo tasks created successfully!', 'success')
    } catch (error) {
      console.error('Failed to create demo tasks:', error)
      showToast('Failed to create demo tasks. Please try again.', 'error')
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-800'
      case 'high': return 'bg-orange-100 text-orange-800'
      case 'med': return 'bg-yellow-100 text-yellow-800'
      case 'low': return 'bg-green-100 text-green-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const listColumns = [
    { key: 'title' as keyof Task, label: 'Title' },
    { key: 'assigneeName' as keyof Task, label: 'Assignee' },
    { 
      key: 'priority' as keyof Task, 
      label: 'Priority',
      render: (value: string) => (
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(value)}`}>
          {value}
        </span>
      )
    },
    { 
      key: 'status' as keyof Task, 
      label: 'Status',
      render: (value: string) => (
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
          value === 'Open' ? 'bg-gray-100 text-gray-800' :
          value === 'InProgress' ? 'bg-blue-100 text-blue-800' :
          value === 'Blocked' ? 'bg-red-100 text-red-800' :
          'bg-green-100 text-green-800'
        }`}>
          {value}
        </span>
      )
    },
    { 
      key: 'dueDate' as keyof Task, 
      label: 'Due Date',
      render: (value: string) => value ? new Date(value).toLocaleDateString() : '-'
    },
  ]

  if (isLoading) {
    return (
      <div className="p-4">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="py-6">
      <div className="w-full px-6 lg:px-10">
          {/* Header */}
          <div className="md:flex md:items-center md:justify-between border-b border-gray-100 pb-4 mb-6">
            <div className="min-w-0 flex-1">
              <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:truncate sm:text-3xl sm:tracking-tight">
                Work Management
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                Manage tasks, track progress, and coordinate team workflows
              </p>
            </div>
            <div className="mt-4 flex md:ml-4 md:mt-0">
              <div className="flex rounded-md shadow-sm" role="group">
                <button
                  onClick={() => setView('board')}
                  className={`inline-flex items-center px-4 py-2 text-sm font-medium rounded-l-md border ${
                    view === 'board' 
                      ? 'bg-blue-600 text-white border-blue-600' 
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <Squares2X2Icon className="-ml-0.5 mr-1.5 h-4 w-4" />
                  Board
                </button>
                <button
                  onClick={() => setView('list')}
                  className={`inline-flex items-center px-4 py-2 text-sm font-medium rounded-r-md border-t border-r border-b ${
                    view === 'list' 
                      ? 'bg-blue-600 text-white border-blue-600' 
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <ViewColumnsIcon className="-ml-0.5 mr-1.5 h-4 w-4" />
                  List
                </button>
              </div>
              <button 
                onClick={() => setShowCreateForm(true)}
                className="ml-3 inline-flex items-center rounded-md bg-green-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-green-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600"
              >
                <PlusIcon className="-ml-0.5 mr-1.5 h-5 w-5" />
                New Task
              </button>
              {tasks.length === 0 && (
                <button 
                  onClick={handleCreateDemoTasks}
                  className="ml-3 inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                >
                  Create Demo Tasks
                </button>
              )}
            </div>
          </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
          <h3 className="text-sm font-medium text-gray-500">Total Tasks</h3>
          <p className="text-2xl font-semibold text-gray-900">{tasks.length}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
          <h3 className="text-sm font-medium text-gray-500">In Progress</h3>
          <p className="text-2xl font-semibold text-blue-600">
            {tasks.filter(t => t.status === 'InProgress').length}
          </p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
          <h3 className="text-sm font-medium text-gray-500">Blocked</h3>
          <p className="text-2xl font-semibold text-red-600">
            {tasks.filter(t => t.status === 'Blocked').length}
          </p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
          <h3 className="text-sm font-medium text-gray-500">Done</h3>
          <p className="text-2xl font-semibold text-green-600">
            {tasks.filter(t => t.status === 'Done').length}
          </p>
        </div>
      </div>

      {tasks.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-12 text-center">
          <div className="mx-auto h-12 w-12 text-gray-400 mb-4">
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" className="h-12 w-12">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No tasks found</h3>
          <p className="text-sm text-gray-500 mb-6">
            You don't have any tasks assigned yet. Create your first task to get started!
          </p>
          <button
            onClick={() => setShowCreateForm(true)}
            className="inline-flex items-center rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-green-500"
          >
            <PlusIcon className="-ml-0.5 mr-1.5 h-5 w-5" />
            Create Your First Task
          </button>
        </div>
      ) : view === 'board' ? (
        <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-4">
          <KanbanBoard
            tasks={tasks}
            stages={stages}
            onTaskMove={handleTaskMove}
            onTaskClick={setSelectedTask}
          />
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-100 shadow-sm">
          <DataTable
            data={tasks}
            columns={listColumns}
            onRowClick={setSelectedTask}
          />
        </div>
      )}

      {selectedTask && (
        <TaskDetail
          task={selectedTask}
          workspaceId={workspaceId || ''}
          onClose={() => setSelectedTask(null)}
          onUpdate={() => {
            queryClient.invalidateQueries({ queryKey: ['myTasks', workspaceId, userId] })
          }}
        />
      )}

      {showCreateForm && (
        <CreateTaskForm
          workspaceId={workspaceId || ''}
          userId={userId || ''}
          onClose={() => setShowCreateForm(false)}
          onCreated={() => {
            queryClient.invalidateQueries({ queryKey: ['myTasks', workspaceId, userId] })
            setShowCreateForm(false)
          }}
        />
      )}
    </div>
  </div>
  )
}

type TaskDetailProps = { 
  task: Task
  workspaceId: string
  onClose: () => void
  onUpdate: () => void
}

const TaskDetail: FC<TaskDetailProps> = (props) => {
  const { task, workspaceId, onClose, onUpdate } = props
  const [produceQty, setProduceQty] = useState(0)
  const [consumeQty, setConsumeQty] = useState(0)
  const [isCompleting, setIsCompleting] = useState(false)

  const handleComplete = async () => {
    if (!workspaceId) return

    setIsCompleting(true)
    try {
      await completeTask(workspaceId, task.id, produceQty, consumeQty)
      onUpdate()
      onClose()
    } catch (error) {
      console.error('Failed to complete task:', error)
      showToast('Failed to complete task. Please try again.', 'error')
    } finally {
      setIsCompleting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg p-6 max-w-lg w-full">
        <h3 className="text-lg font-semibold mb-4">Task Details</h3>
        
        <div className="space-y-4">
          <div>
            <h4 className="font-medium text-gray-900">{task.title}</h4>
            {task.description && (
              <p className="text-sm text-gray-600 mt-1">{task.description}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Assignee:</span>
              <p className="font-medium">{task.assigneeName || 'Unassigned'}</p>
            </div>
            <div>
              <span className="text-gray-500">Priority:</span>
              <p className="font-medium capitalize">{task.priority}</p>
            </div>
            <div>
              <span className="text-gray-500">Status:</span>
              <p className="font-medium">{task.status}</p>
            </div>
            <div>
              <span className="text-gray-500">Due Date:</span>
              <p className="font-medium">
                {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'No due date'}
              </p>
            </div>
          </div>

          {task.links?.productId && (
            <div className="border-t pt-4">
              <h5 className="font-medium text-gray-900 mb-2">Stock Operations</h5>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Produce Qty</label>
                  <input
                    type="number"
                    value={produceQty}
                    onChange={(e) => setProduceQty(Number(e.target.value))}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Consume Qty</label>
                  <input
                    type="number"
                    value={consumeQty}
                    onChange={(e) => setConsumeQty(Number(e.target.value))}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-2 mt-6">
          <button
            onClick={handleComplete}
            disabled={isCompleting}
            className="flex-1 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isCompleting ? 'Completing...' : 'Complete Task'}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

type CreateTaskFormProps = {
  workspaceId: string
  userId: string
  onClose: () => void
  onCreated: () => void
}

const CreateTaskForm: FC<CreateTaskFormProps> = ({ workspaceId, userId, onClose, onCreated }) => {
  const [formData, setFormData] = useState<TaskInput>({
    title: '',
    description: '',
    workflowId: 'production',
    stageId: 'open',
    assigneeId: userId,
    assigneeName: 'Current User',
    priority: 'med',
    dueDate: undefined,
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.title.trim()) {
      showToast('Please enter a task title', 'warning')
      return
    }

    setIsSubmitting(true)
    try {
      await createTask(workspaceId, formData)
      onCreated()
    } catch (error) {
      console.error('Failed to create task:', error)
      showToast('Failed to create task. Please try again.', 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Create New Task</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Title *
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Priority
              </label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value as any })}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              >
                <option value="low">Low</option>
                <option value="med">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Initial Stage
              </label>
              <select
                value={formData.stageId}
                onChange={(e) => setFormData({ ...formData, stageId: e.target.value })}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              >
                <option value="open">Open</option>
                <option value="progress">In Progress</option>
                <option value="blocked">Blocked</option>
                <option value="done">Done</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Due Date
            </label>
            <input
              type="date"
              value={formData.dueDate ? (typeof formData.dueDate === 'string' ? formData.dueDate : new Date(formData.dueDate).toISOString().split('T')[0]) : ''}
              onChange={(e) => setFormData({ ...formData, dueDate: e.target.value || undefined })}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>

          <div className="flex gap-2 mt-6">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Creating...' : 'Create Task'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
