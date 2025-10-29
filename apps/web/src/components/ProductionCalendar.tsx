import { useState, type FC } from 'react'
import { useQuery } from '@tanstack/react-query'
import { 
  Job, 
  listJobs, 
  listWorkcenters, 
  listResources 
} from '../api/production-jobs'
import { 
  ChevronLeftIcon,
  ChevronRightIcon,
  CalendarIcon,
  ClockIcon,
  UserIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline'

interface ProductionCalendarProps {
  workspaceId: string
}

type ViewMode = 'week' | 'month' | 'gantt'

export function ProductionCalendar({ workspaceId }: ProductionCalendarProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('week')
  const [currentDate, setCurrentDate] = useState(new Date())

  // Fetch data
  const { data: jobsData } = useQuery({
    queryKey: ['jobs', workspaceId],
    queryFn: () => listJobs(workspaceId),
  })

  const { data: workcenters = [] } = useQuery({
    queryKey: ['workcenters', workspaceId],
    queryFn: () => listWorkcenters(workspaceId),
  })

  const { data: resources = [] } = useQuery({
    queryKey: ['resources', workspaceId],
    queryFn: () => listResources(workspaceId),
  })

  const jobs = jobsData?.jobs || []

  const getWeekDates = (date: Date) => {
    const start = new Date(date)
    start.setDate(date.getDate() - date.getDay())
    const dates = []
    for (let i = 0; i < 7; i++) {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      dates.push(d)
    }
    return dates
  }

  const getMonthDates = (date: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const startDate = new Date(firstDay)
    startDate.setDate(startDate.getDate() - firstDay.getDay())
    
    const dates = []
    const endDate = new Date(lastDay)
    endDate.setDate(endDate.getDate() + (6 - lastDay.getDay()))
    
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      dates.push(new Date(d))
    }
    return dates
  }

  const getJobsForDate = (date: Date) => {
    return jobs.filter(job => {
      const jobDate = new Date(job.plannedStart || job.createdAt?.seconds ? job.createdAt.seconds * 1000 : job.createdAt)
      return jobDate.toDateString() === date.toDateString()
    })
  }

  const getJobsForDateRange = (startDate: Date, endDate: Date) => {
    return jobs.filter(job => {
      const jobStart = new Date(job.plannedStart || job.createdAt?.seconds ? job.createdAt.seconds * 1000 : job.createdAt)
      const jobEnd = new Date(job.plannedEnd || job.dueDate)
      return jobStart <= endDate && jobEnd >= startDate
    })
  }

  const navigateDate = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate)
    if (viewMode === 'week') {
      newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7))
    } else if (viewMode === 'month') {
      newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1))
    }
    setCurrentDate(newDate)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-gray-100 text-gray-800'
      case 'released': return 'bg-blue-100 text-blue-800'
      case 'in_progress': return 'bg-yellow-100 text-yellow-800'
      case 'blocked': return 'bg-red-100 text-red-800'
      case 'done': return 'bg-green-100 text-green-800'
      case 'cancelled': return 'bg-gray-100 text-gray-500'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getPriorityColor = (priority: number) => {
    switch (priority) {
      case 1: return 'border-l-red-500'
      case 2: return 'border-l-orange-500'
      case 3: return 'border-l-yellow-500'
      case 4: return 'border-l-blue-500'
      case 5: return 'border-l-green-500'
      default: return 'border-l-gray-500'
    }
  }

  const renderWeekView = () => {
    const weekDates = getWeekDates(currentDate)
    
    return (
      <div className="space-y-4">
        {/* Week Header */}
        <div className="grid grid-cols-8 gap-1">
          <div className="p-2 text-sm font-medium text-gray-500">Time</div>
          {weekDates.map((date, index) => (
            <div key={index} className="p-2 text-center">
              <div className="text-sm font-medium text-gray-900">
                {date.toLocaleDateString('en-US', { weekday: 'short' })}
              </div>
              <div className="text-xs text-gray-500">
                {date.getDate()}
              </div>
            </div>
          ))}
        </div>

        {/* Time Slots */}
        <div className="grid grid-cols-8 gap-1">
          <div className="space-y-1">
            {Array.from({ length: 24 }, (_, i) => (
              <div key={i} className="h-12 text-xs text-gray-500 p-1">
                {i === 0 ? '12 AM' : i < 12 ? `${i} AM` : i === 12 ? '12 PM' : `${i - 12} PM`}
              </div>
            ))}
          </div>
          
          {weekDates.map((date, dateIndex) => (
            <div key={dateIndex} className="space-y-1">
              {Array.from({ length: 24 }, (_, hourIndex) => {
                const hourJobs = getJobsForDate(date).filter(job => {
                  const jobHour = new Date(job.plannedStart || job.createdAt?.seconds ? job.createdAt.seconds * 1000 : job.createdAt).getHours()
                  return jobHour === hourIndex
                })
                
                return (
                  <div key={hourIndex} className="h-12 border border-gray-100 relative">
                    {hourJobs.map((job, jobIndex) => (
                      <div
                        key={job.id}
                        className={`absolute inset-1 rounded text-xs p-1 border-l-4 ${getPriorityColor(job.priority)} ${getStatusColor(job.status)}`}
                        style={{ 
                          zIndex: jobIndex + 1,
                          fontSize: '10px'
                        }}
                        title={`${job.code} - ${job.productName}`}
                      >
                        <div className="font-medium truncate">{job.code}</div>
                        <div className="truncate">{job.productName}</div>
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    )
  }

  const renderMonthView = () => {
    const monthDates = getMonthDates(currentDate)
    const weeks = []
    for (let i = 0; i < monthDates.length; i += 7) {
      weeks.push(monthDates.slice(i, i + 7))
    }

    return (
      <div className="space-y-4">
        {/* Month Header */}
        <div className="grid grid-cols-7 gap-1">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="p-2 text-center text-sm font-medium text-gray-500">
              {day}
            </div>
          ))}
        </div>

        {/* Month Grid */}
        <div className="grid grid-cols-7 gap-1">
          {monthDates.map((date, index) => {
            const isCurrentMonth = date.getMonth() === currentDate.getMonth()
            const isToday = date.toDateString() === new Date().toDateString()
            const dayJobs = getJobsForDate(date)
            
            return (
              <div
                key={index}
                className={`min-h-24 p-2 border border-gray-100 ${
                  isCurrentMonth ? 'bg-white' : 'bg-gray-50'
                } ${isToday ? 'ring-2 ring-blue-500' : ''}`}
              >
                <div className={`text-sm font-medium ${isCurrentMonth ? 'text-gray-900' : 'text-gray-400'}`}>
                  {date.getDate()}
                </div>
                <div className="mt-1 space-y-1">
                  {dayJobs.slice(0, 3).map(job => (
                    <div
                      key={job.id}
                      className={`text-xs p-1 rounded border-l-4 ${getPriorityColor(job.priority)} ${getStatusColor(job.status)}`}
                      title={`${job.code} - ${job.productName}`}
                    >
                      <div className="truncate font-medium">{job.code}</div>
                      <div className="truncate">{job.productName}</div>
                    </div>
                  ))}
                  {dayJobs.length > 3 && (
                    <div className="text-xs text-gray-500">
                      +{dayJobs.length - 3} more
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  const renderGanttView = () => {
    const startDate = new Date(currentDate)
    startDate.setDate(startDate.getDate() - 7)
    const endDate = new Date(currentDate)
    endDate.setDate(endDate.getDate() + 14)
    
    const ganttJobs = getJobsForDateRange(startDate, endDate)
    const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
    
    return (
      <div className="space-y-4">
        {/* Gantt Header */}
        <div className="flex">
          <div className="w-64 p-2 text-sm font-medium text-gray-500">Job</div>
          <div className="flex-1 grid grid-cols-7 gap-1">
            {Array.from({ length: totalDays }, (_, i) => {
              const date = new Date(startDate)
              date.setDate(startDate.getDate() + i)
              return (
                <div key={i} className="p-2 text-center text-xs text-gray-500">
                  <div>{date.getDate()}</div>
                  <div>{date.toLocaleDateString('en-US', { weekday: 'short' })}</div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Gantt Rows */}
        <div className="space-y-1">
          {ganttJobs.map(job => {
            const jobStart = new Date(job.plannedStart || job.createdAt?.seconds ? job.createdAt.seconds * 1000 : job.createdAt)
            const jobEnd = new Date(job.plannedEnd || job.dueDate)
            const startOffset = Math.max(0, Math.ceil((jobStart.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)))
            const duration = Math.ceil((jobEnd.getTime() - jobStart.getTime()) / (1000 * 60 * 60 * 24))
            
            return (
              <div key={job.id} className="flex">
                <div className="w-64 p-2 text-sm">
                  <div className="font-medium text-gray-900">{job.code}</div>
                  <div className="text-xs text-gray-500">{job.productName}</div>
                  <div className="text-xs text-gray-500">{job.customer.name}</div>
                </div>
                <div className="flex-1 relative">
                  <div className="h-8 relative">
                    <div
                      className={`absolute top-1 h-6 rounded border-l-4 ${getPriorityColor(job.priority)} ${getStatusColor(job.status)}`}
                      style={{
                        left: `${(startOffset / totalDays) * 100}%`,
                        width: `${Math.max(2, (duration / totalDays) * 100)}%`
                      }}
                    >
                      <div className="px-2 py-1 text-xs truncate">
                        {job.productName}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Production Calendar</h2>
          <p className="text-sm text-gray-600">Schedule and track production jobs</p>
        </div>
        <div className="flex items-center space-x-4">
          {/* View Mode Toggle */}
          <div className="flex rounded-md shadow-sm">
            <button
              onClick={() => setViewMode('week')}
              className={`px-3 py-2 text-sm font-medium rounded-l-md border ${
                viewMode === 'week'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              Week
            </button>
            <button
              onClick={() => setViewMode('month')}
              className={`px-3 py-2 text-sm font-medium border-t border-b ${
                viewMode === 'month'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              Month
            </button>
            <button
              onClick={() => setViewMode('gantt')}
              className={`px-3 py-2 text-sm font-medium rounded-r-md border ${
                viewMode === 'gantt'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              Gantt
            </button>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigateDate('prev')}
            className="p-2 rounded-md border border-gray-300 hover:bg-gray-50"
          >
            <ChevronLeftIcon className="h-4 w-4" />
          </button>
          <h3 className="text-lg font-semibold text-gray-900">
            {viewMode === 'week' && 
              `Week of ${getWeekDates(currentDate)[0].toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`
            }
            {viewMode === 'month' && 
              currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
            }
            {viewMode === 'gantt' && 
              `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
            }
          </h3>
          <button
            onClick={() => navigateDate('next')}
            className="p-2 rounded-md border border-gray-300 hover:bg-gray-50"
          >
            <ChevronRightIcon className="h-4 w-4" />
          </button>
        </div>
        <button
          onClick={() => setCurrentDate(new Date())}
          className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
        >
          Today
        </button>
      </div>

      {/* Calendar Content */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
        {viewMode === 'week' && renderWeekView()}
        {viewMode === 'month' && renderMonthView()}
        {viewMode === 'gantt' && renderGanttView()}
      </div>

      {/* Legend */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h4 className="text-sm font-medium text-gray-900 mb-3">Legend</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-gray-100 rounded border-l-4 border-l-red-500"></div>
            <span className="text-sm text-gray-700">Priority 1 (Critical)</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-gray-100 rounded border-l-4 border-l-yellow-500"></div>
            <span className="text-sm text-gray-700">Priority 3 (Normal)</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-yellow-100 rounded text-yellow-800"></div>
            <span className="text-sm text-gray-700">In Progress</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-green-100 rounded text-green-800"></div>
            <span className="text-sm text-gray-700">Completed</span>
          </div>
        </div>
      </div>
    </div>
  )
}