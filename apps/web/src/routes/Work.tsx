import { useState, type FC } from 'react'
import { useQuery } from '@tanstack/react-query'
import { KanbanBoard } from '../components/KanbanBoard'
import { DataTable } from '../components/DataTable'
import { listMyTasks } from '../api/work'
import { 
  PlusIcon, 
  ViewColumnsIcon,
  Squares2X2Icon
} from '@heroicons/react/24/outline'

interface Task {
  id: string
  title: string
  description?: string
  workflowId: string
  stageId: string
  assigneeId?: string
  assigneeName?: string
  priority: 'low' | 'med' | 'high' | 'urgent'
  dueDate?: string
  status: 'Open' | 'InProgress' | 'Blocked' | 'Done'
  links?: {
    productId?: string
    poId?: string
  }
}

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

  // Mock workspace ID - in real app, get from context
  const workspaceId = 'demo-workspace'
  const userId = 'demo-user'

  // Mock data - in real app, fetch from Firestore
  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['myTasks', workspaceId, userId],
    queryFn: () => listMyTasks(workspaceId, userId),
  })

  const stages: Stage[] = [
    { id: 'open', name: 'Open', color: 'bg-gray-100' },
    { id: 'progress', name: 'In Progress', color: 'bg-blue-100' },
    { id: 'blocked', name: 'Blocked', color: 'bg-red-100' },
    { id: 'done', name: 'Done', color: 'bg-green-100', isTerminal: true },
  ]

  const handleTaskMove = (taskId: string, newStageId: string) => {
    console.log('Move task', taskId, 'to stage', newStageId)
    // In real app, update task in Firestore
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
              <button className="ml-3 inline-flex items-center rounded-md bg-green-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-green-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600">
                <PlusIcon className="-ml-0.5 mr-1.5 h-5 w-5" />
                New Task
              </button>
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

      {view === 'board' ? (
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
          onClose={() => setSelectedTask(null)}
        />
      )}
    </div>
  </div>
  )
}

type TaskDetailProps = { task: Task; onClose: () => void }

const TaskDetail: FC<TaskDetailProps> = (props) => {
  const { task, onClose } = props
  const [produceQty, setProduceQty] = useState(0)
  const [consumeQty, setConsumeQty] = useState(0)

  const handleComplete = () => {
    console.log('Complete task', task.id, { produceQty, consumeQty })
    // In real app, call completeTask function
    onClose()
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
            className="flex-1 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          >
            Complete Task
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
