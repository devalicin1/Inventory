import { useState } from 'react'

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

interface KanbanBoardProps {
  tasks: Task[]
  stages: Stage[]
  onTaskMove: (taskId: string, newStageId: string) => void
  onTaskClick?: (task: Task) => void
}

export function KanbanBoard({ tasks, stages, onTaskMove, onTaskClick }: KanbanBoardProps) {
  const [draggedTask, setDraggedTask] = useState<string | null>(null)

  const getTasksForStage = (stageId: string) => {
    return tasks.filter(task => {
      // Map task status to stage for simplicity
      if (stageId === 'open') return task.status === 'Open'
      if (stageId === 'progress') return task.status === 'InProgress'
      if (stageId === 'blocked') return task.status === 'Blocked'
      if (stageId === 'done') return task.status === 'Done'
      return false
    })
  }

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    setDraggedTask(taskId)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = (e: React.DragEvent, stageId: string) => {
    e.preventDefault()
    if (draggedTask) {
      onTaskMove(draggedTask, stageId)
      setDraggedTask(null)
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

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {stages.map((stage) => {
        const stageTasks = getTasksForStage(stage.id)
        return (
          <div
            key={stage.id}
            className="flex-shrink-0 w-80"
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, stage.id)}
          >
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900">{stage.name}</h3>
                <span className="text-sm text-gray-500">
                  {stageTasks.length}
                  {stage.wipLimit && ` / ${stage.wipLimit}`}
                </span>
              </div>
              
              <div className="space-y-2">
                {stageTasks.map((task) => (
                  <div
                    key={task.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, task.id)}
                    onClick={() => onTaskClick?.(task)}
                    className="bg-white rounded-lg p-3 shadow-sm border cursor-pointer hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-medium text-sm text-gray-900 line-clamp-2">
                        {task.title}
                      </h4>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(task.priority)}`}>
                        {task.priority}
                      </span>
                    </div>
                    
                    {task.description && (
                      <p className="text-xs text-gray-600 line-clamp-2 mb-2">
                        {task.description}
                      </p>
                    )}
                    
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>{task.assigneeName || 'Unassigned'}</span>
                      {task.dueDate && (
                        <span>{new Date(task.dueDate).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
