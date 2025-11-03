import { useState, type FC } from 'react'
import { useQuery } from '@tanstack/react-query'
import { 
  type Job, 
  listJobs, 
  listWorkcenters, 
  listResources,
  listWorkflows
} from '../api/production-jobs'
import { 
  ChevronLeftIcon,
  ChevronRightIcon,
  CalendarIcon,
  ClockIcon,
  UserIcon,
  ExclamationTriangleIcon,
  MapPinIcon,
  CubeIcon,
  CheckCircleIcon,
  XCircleIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  Squares2X2Icon,
  TableCellsIcon,
  ChartBarIcon
} from '@heroicons/react/24/outline'

interface ProductionCalendarProps {
  workspaceId: string
}

type ViewMode = 'week' | 'month' | 'gantt'

export function ProductionCalendar({ workspaceId }: ProductionCalendarProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('month')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [priorityFilter, setPriorityFilter] = useState<number>(0)
  const [showFilters, setShowFilters] = useState(false)
  const [density, setDensity] = useState<'comfortable' | 'compact'>('comfortable')

  // Fetch data
  const { data: jobsData, isLoading: jobsLoading } = useQuery({
    queryKey: ['jobs', workspaceId],
    queryFn: () => listJobs(workspaceId),
    staleTime: 0, // Always refetch on mount to get latest jobs
    refetchOnMount: true,
  })

  const { data: workcenters = [] } = useQuery({
    queryKey: ['workcenters', workspaceId],
    queryFn: () => listWorkcenters(workspaceId),
  })

  const { data: resources = [] } = useQuery({
    queryKey: ['resources', workspaceId],
    queryFn: () => listResources(workspaceId),
  })

  const { data: workflows = [] } = useQuery({
    queryKey: ['workflows', workspaceId],
    queryFn: () => listWorkflows(workspaceId),
  })

  const jobs = jobsData?.jobs || []
  
  // Filtreleme fonksiyonu
  const filterJobs = (jobs: Job[]) => {
    return jobs.filter(job => {
      const matchesSearch = searchTerm === '' || 
        job.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        job.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        job.customer.name.toLowerCase().includes(searchTerm.toLowerCase())
      
      const matchesStatus = statusFilter === 'all' || job.status === statusFilter
      const matchesPriority = priorityFilter === 0 || job.priority === priorityFilter
      
      return matchesSearch && matchesStatus && matchesPriority
    })
  }

  const visibleJobs = filterJobs(jobs.filter(j => j.status !== 'done' && j.status !== 'cancelled'))

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

  const startOfDay = (d: Date) => {
    const x = new Date(d)
    x.setHours(0, 0, 0, 0)
    return x
  }

  const endOfDay = (d: Date) => {
    const x = new Date(d)
    x.setHours(23, 59, 59, 999)
    return x
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

  const getSafeDate = (value: any) => {
    if (!value) return undefined
    try {
      let d: Date | undefined
      if (typeof value === 'string') {
        if (value.trim() === '') return undefined
        d = new Date(value)
      } else if (typeof value === 'number') {
        d = new Date(value)
      } else if (value?.seconds) {
        d = new Date(value.seconds * 1000)
      } else if (value instanceof Date) {
        d = value
      }
      if (!d) return undefined
      if (isNaN(d.getTime())) return undefined
      return d
    } catch {
      return undefined
    }
  }

  const getJobsForDate = (date: Date) => {
    const dayStart = startOfDay(date)
    const dayEnd = endOfDay(date)
    return visibleJobs.filter(job => {
      const start = getSafeDate(job.plannedStart) || getSafeDate(job.createdAt) || getSafeDate(job.dueDate)
      const end = getSafeDate(job.plannedEnd) || getSafeDate(job.dueDate) || start
      if (!start || !end) return false
      return start <= dayEnd && end >= dayStart
    })
  }

  const getJobsForDateRange = (startDate: Date, endDate: Date) => {
    return visibleJobs.filter(job => {
      const start = getSafeDate(job.plannedStart) || getSafeDate(job.createdAt) || getSafeDate(job.dueDate)
      const end = getSafeDate(job.plannedEnd) || getSafeDate(job.dueDate) || start
      if (!start || !end) return false
      return start <= endDate && end >= startDate
    })
  }

  const navigateDate = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate)
    if (viewMode === 'week') {
      newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7))
    } else if (viewMode === 'month') {
      newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1))
    } else if (viewMode === 'gantt') {
      newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7))
    }
    setCurrentDate(newDate)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-gray-100 text-gray-800 border-gray-300'
      case 'released': return 'bg-blue-50 text-blue-800 border-blue-200'
      case 'in_progress': return 'bg-yellow-50 text-yellow-800 border-yellow-200'
      case 'blocked': return 'bg-red-50 text-red-800 border-red-200'
      case 'done': return 'bg-green-50 text-green-800 border-green-200'
      case 'cancelled': return 'bg-gray-100 text-gray-500 border-gray-300'
      default: return 'bg-gray-100 text-gray-800 border-gray-300'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'in_progress': return <ClockIcon className="h-4 w-4" />
      case 'blocked': return <ExclamationTriangleIcon className="h-4 w-4" />
      case 'released': return <CalendarIcon className="h-4 w-4" />
      case 'done': return <CheckCircleIcon className="h-4 w-4" />
      case 'cancelled': return <XCircleIcon className="h-4 w-4" />
      default: return <CubeIcon className="h-4 w-4" />
    }
  }

  const getPriorityColor = (priority: number) => {
    switch (priority) {
      case 1: return 'border-l-red-500 bg-red-50/50'
      case 2: return 'border-l-orange-500 bg-orange-50/50'
      case 3: return 'border-l-yellow-500 bg-yellow-50/50'
      case 4: return 'border-l-blue-500 bg-blue-50/50'
      case 5: return 'border-l-green-500 bg-green-50/50'
      default: return 'border-l-gray-500 bg-gray-50/50'
    }
  }

  const getStageName = (stageId?: string) => {
    if (!stageId) return '-'
    for (const workflow of workflows) {
      const stage = workflow.stages?.find(s => s.id === stageId)
      if (stage) return stage.name
    }
    return stageId
  }

  const stripColor = (status: string) => {
    switch (status) {
      case 'in_progress': return 'bg-yellow-400 hover:bg-yellow-500'
      case 'blocked': return 'bg-red-400 hover:bg-red-500'
      case 'released': return 'bg-blue-400 hover:bg-blue-500'
      case 'draft': return 'bg-gray-300 hover:bg-gray-400'
      default: return 'bg-gray-300 hover:bg-gray-400'
    }
  }

  const overlapsDay = (job: Job, date: Date) => {
    const dayStart = startOfDay(date)
    const dayEnd = endOfDay(date)
    const start = getSafeDate((job as any).plannedStart) || getSafeDate((job as any).createdAt) || getSafeDate((job as any).dueDate)
    const end = getSafeDate((job as any).plannedEnd) || getSafeDate((job as any).dueDate) || start
    if (!start || !end) return false
    return start <= dayEnd && end >= dayStart
  }

  const handleDateClick = (date: Date, jobs: Job[]) => {
    setSelectedDate(date)
    if (jobs.length === 1) {
      setSelectedJob(jobs[0])
    }
  }

  const renderWeekView = () => {
    const weekDates = getWeekDates(currentDate)
    const cellHeight = density === 'compact' ? 'h-10' : 'h-16'
    
    return (
      <div className="space-y-4">
        {/* Week Header */}
        <div className="grid grid-cols-8 gap-1 bg-gray-50 rounded-lg">
          <div className="p-3 text-sm font-medium text-gray-500">Time</div>
          {weekDates.map((date, index) => {
            const isToday = date.toDateString() === new Date().toDateString()
            const dayJobs = getJobsForDate(date)
            return (
              <button
                key={index}
                onClick={() => handleDateClick(date, dayJobs)}
                className={`p-3 text-center transition-colors rounded-lg ${
                  isToday 
                    ? 'bg-blue-50 border border-blue-200' 
                    : 'hover:bg-white'
                } ${
                  selectedDate?.toDateString() === date.toDateString()
                    ? 'ring-2 ring-blue-500 bg-white'
                    : ''
                }`}
              >
                <div className={`text-sm font-medium ${isToday ? 'text-blue-600' : 'text-gray-900'}`}>
                  {date.toLocaleDateString('en-US', { weekday: 'short' })}
                </div>
                <div className={`text-xs ${isToday ? 'text-blue-500' : 'text-gray-500'}`}>
                  {date.getDate()}
                </div>
                {dayJobs.length > 0 && (
                  <div className="mt-1 text-xs text-gray-400">
                    {dayJobs.length} job{dayJobs.length !== 1 ? 's' : ''}
                  </div>
                )}
              </button>
            )
          })}
        </div>

        {/* Time Slots */}
        <div className={`grid grid-cols-8 gap-1 ${density === 'compact' ? 'max-h-96' : 'max-h-[500px]'} overflow-y-auto`}>
          <div className="space-y-0.5">
            {Array.from({ length: 24 }, (_, i) => (
              <div key={i} className={`${cellHeight} text-xs text-gray-500 p-2 border-b border-gray-100 flex items-center`}>
                {i === 0 ? '12 AM' : i < 12 ? `${i} AM` : i === 12 ? '12 PM' : `${i - 12} PM`}
              </div>
            ))}
          </div>
          
          {weekDates.map((date, dateIndex) => (
            <div key={dateIndex} className="space-y-0.5">
              {Array.from({ length: 24 }, (_, hourIndex) => {
                const hourJobs = getJobsForDate(date).filter(job => {
                  const planned = getSafeDate(job.plannedStart)
                  const created = getSafeDate(job.createdAt)
                  const due = getSafeDate(job.dueDate)
                  const dt = planned || due || created
                  return dt ? dt.getHours() === hourIndex : false
                })
                
                return (
                  <div key={hourIndex} className={`${cellHeight} border border-gray-100 relative hover:bg-gray-50 transition-colors group`}>
                    {hourJobs.slice(0, density === 'compact' ? 2 : 3).map((job, jobIndex) => (
                      <button
                        key={job.id}
                        onClick={() => setSelectedJob(job)}
                        className={`absolute inset-1 rounded text-xs p-1 border-l-4 ${getPriorityColor(job.priority)} ${getStatusColor(job.status)} shadow-sm hover:shadow-md transition-all cursor-pointer group`}
                        style={{ 
                          zIndex: jobIndex + 1,
                          top: `${jobIndex * (density === 'compact' ? 45 : 60)}%`,
                          height: density === 'compact' ? '40%' : '30%'
                        }}
                      >
                        <div className="font-medium truncate group-hover:text-blue-600">
                          {job.code}
                        </div>
                        {density === 'comfortable' && (
                          <div className="truncate text-gray-600 text-[10px]">
                            {job.productName}
                          </div>
                        )}
                      </button>
                    ))}
                    {hourJobs.length > (density === 'compact' ? 2 : 3) && (
                      <div className="absolute bottom-0 right-0 bg-black/70 text-white text-[10px] px-1 rounded-tl">
                        +{hourJobs.length - (density === 'compact' ? 2 : 3)}
                      </div>
                    )}
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
    const cellHeight = density === 'compact' ? 'min-h-24' : 'min-h-32'
    const maxJobs = density === 'compact' ? 6 : 4

    return (
      <div className="space-y-4">
        {/* Month Header */}
        <div className="grid grid-cols-7 gap-1 bg-gray-50 rounded-lg">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="p-3 text-center text-sm font-medium text-gray-500">
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
              <button
                key={index}
                onClick={() => handleDateClick(date, dayJobs)}
                className={`${cellHeight} p-3 border rounded-lg transition-all text-left ${
                  isCurrentMonth 
                    ? 'bg-white hover:bg-gray-50 border-gray-200' 
                    : 'bg-gray-50 border-gray-100'
                } ${
                  isToday ? 'ring-2 ring-blue-500 bg-blue-50' : ''
                } ${
                  selectedDate?.toDateString() === date.toDateString()
                    ? 'ring-2 ring-blue-300 bg-blue-25'
                    : ''
                }`}
              >
                <div className="flex justify-between items-start">
                  <div className={`text-sm font-medium ${
                    isCurrentMonth 
                      ? isToday ? 'text-blue-600' : 'text-gray-900'
                      : 'text-gray-400'
                  }`}>
                    {date.getDate()}
                  </div>
                  {dayJobs.length > 0 && (
                    <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
                      {dayJobs.length}
                    </span>
                  )}
                </div>
                
                <div className="mt-2 space-y-1">
                  {dayJobs.slice(0, maxJobs).map(job => (
                    <div
                      key={job.id}
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelectedJob(job)
                      }}
                      className={`group flex items-center p-2 rounded text-xs cursor-pointer transition-all ${getStatusColor(job.status)} border-l-4 ${getPriorityColor(job.priority)} hover:shadow-md`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate group-hover:text-blue-600">
                          {job.code}
                        </div>
                        {density === 'comfortable' && (
                          <div className="truncate text-gray-600">
                            {job.productName}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  {dayJobs.length > maxJobs && (
                    <div className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded text-center">
                      +{dayJobs.length - maxJobs} more
                    </div>
                  )}
                </div>
              </button>
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
    endDate.setDate(endDate.getDate() + 21)
    
    const ganttJobs = getJobsForDateRange(startDate, endDate)
    const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
    const rowHeight = density === 'compact' ? 'h-10' : 'h-14'
    
    return (
      <div className="space-y-4">
        {/* Gantt Header */}
        <div className="flex bg-gray-50 rounded-lg">
          <div className="w-96 p-3 text-sm font-medium text-gray-500">Job / Resource</div>
          <div className="flex-1 relative min-w-0">
            <div className="grid overflow-x-auto" style={{ gridTemplateColumns: `repeat(${totalDays}, minmax(40px, 1fr))` }}>
              {Array.from({ length: totalDays }, (_, i) => {
                const date = new Date(startDate)
                date.setDate(startDate.getDate() + i)
                const isTodayCol = date.toDateString() === new Date().toDateString()
                const isWeekend = date.getDay() === 0 || date.getDay() === 6
                return (
                  <div 
                    key={i} 
                    className={`p-2 text-center text-xs border-l transition-colors ${
                      isTodayCol 
                        ? 'bg-yellow-50 border-yellow-200 font-medium text-yellow-800' 
                        : isWeekend
                        ? 'bg-gray-50 border-gray-100 text-gray-500'
                        : 'bg-white border-gray-100 text-gray-600'
                    }`}
                  >
                    <div className="font-medium">{date.getDate()}</div>
                    <div>{date.toLocaleDateString('en-US', { weekday: 'short' })}</div>
                  </div>
                )
              })}
            </div>
            <div className="pointer-events-none absolute inset-y-0" style={{ left: `${(Math.min(Math.max(0, Math.floor((startOfDay(new Date()).getTime() - startOfDay(startDate).getTime()) / (1000*60*60*24))), totalDays-1) / totalDays) * 100}%` }}>
              <div className="w-0.5 h-full bg-yellow-500" />
            </div>
          </div>
        </div>

        {/* Gantt Rows */}
        <div className={`space-y-1 max-h-[600px] overflow-y-auto`}>
          {ganttJobs.map(job => {
            const jobStart = getSafeDate(job.plannedStart) || getSafeDate(job.createdAt) || getSafeDate(job.dueDate) || new Date()
            const jobEnd = getSafeDate(job.plannedEnd) || getSafeDate(job.dueDate) || jobStart
            const startOffset = Math.max(0, Math.ceil((jobStart.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)))
            const duration = Math.max(1, Math.ceil((jobEnd.getTime() - jobStart.getTime()) / (1000 * 60 * 60 * 24)))
            
            return (
              <div key={job.id} className={`flex group hover:bg-gray-50 rounded-lg transition-colors ${rowHeight}`}>
                <div className="w-96 p-3 text-sm">
                  <div className="font-medium text-gray-900 group-hover:text-blue-600 truncate">
                    {job.code}
                  </div>
                  <div className="text-xs text-gray-500 truncate">{job.productName}</div>
                  {density === 'comfortable' && (
                    <div className="flex items-center mt-1 text-xs text-gray-400">
                      <UserIcon className="h-3 w-3 mr-1" />
                      {job.customer.name}
                    </div>
                  )}
                </div>
                <div className="flex-1 relative min-w-0">
                  <div className="h-full relative">
                    <button
                      onClick={() => setSelectedJob(job)}
                      className={`absolute top-1/2 -translate-y-1/2 h-6 rounded-lg ${stripColor(job.status)} shadow-sm hover:shadow-md transition-all cursor-pointer group/bar flex items-center px-2 min-w-[20px] justify-between gap-2`}
                      style={{
                        left: `${(startOffset / totalDays) * 100}%`,
                        width: `${Math.max(2, (duration / totalDays) * 100)}%`
                      }}
                    >
                      <div className="text-xs font-medium text-white">
                        {duration}d
                      </div>
                      <div className="text-xs font-medium text-white opacity-90 truncate">
                        {getStageName(job.currentStageId)}
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  const renderJobDetails = () => {
    if (!selectedJob) return null

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30" onClick={() => setSelectedJob(null)}>
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
            <div className="flex items-center space-x-3">
              <div className={`p-2 rounded-lg ${getStatusColor(selectedJob.status)}`}>
                {getStatusIcon(selectedJob.status)}
              </div>
              <div>
                <div className="font-semibold text-gray-900 text-lg">{selectedJob.code}</div>
                <div className="text-sm text-gray-500">{selectedJob.productName}</div>
                <div className="text-xs text-blue-600 font-medium mt-1">
                  Today • {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </div>
              </div>
            </div>
            <button 
              className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
              onClick={() => setSelectedJob(null)}
            >
              <XCircleIcon className="h-5 w-5 text-gray-500" />
            </button>
          </div>
          
          <div className="p-6 space-y-6 max-h-[calc(90vh-120px)] overflow-y-auto">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <h4 className="text-sm font-medium text-gray-500 mb-3">JOB DETAILS</h4>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Status</span>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(selectedJob.status)}`}>
                      {selectedJob.status.replace('_', ' ').toUpperCase()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Priority</span>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getPriorityColor(selectedJob.priority)}`}>
                      P{selectedJob.priority}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Stage</span>
                    <span className="px-2 py-1 rounded text-xs font-medium bg-purple-50 text-purple-800 border border-purple-200">
                      {getStageName(selectedJob.currentStageId)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Customer</span>
                    <span className="text-sm text-gray-900">{selectedJob.customer.name}</span>
                  </div>
                </div>
              </div>
              
              <div>
                <h4 className="text-sm font-medium text-gray-500 mb-3">TIMELINE</h4>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Planned Start</span>
                    <span className="text-sm text-gray-900">
                      {getSafeDate(selectedJob.plannedStart)?.toLocaleDateString() || 'Not set'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Planned End</span>
                    <span className="text-sm text-gray-900">
                      {getSafeDate(selectedJob.plannedEnd)?.toLocaleDateString() || 'Not set'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Due Date</span>
                    <span className="text-sm text-gray-900">
                      {getSafeDate(selectedJob.dueDate)?.toLocaleDateString() || 'Not set'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {selectedJob.notes && (
              <div>
                <h4 className="text-sm font-medium text-gray-500 mb-3">NOTES</h4>
                <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg">
                  {selectedJob.notes}
                </p>
              </div>
            )}

            <div className="flex space-x-3 pt-4">
              <button className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium">
                Edit Job
              </button>
              <button className="flex-1 border border-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium">
                View Details
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const renderDateDetails = () => {
    if (!selectedDate) return null

    const dayJobs = getJobsForDate(selectedDate)
    
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30" onClick={() => setSelectedDate(null)}>
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
            <div className="flex items-center space-x-3">
              <CalendarIcon className="h-5 w-5 text-gray-500" />
              <div>
                <div className="font-semibold text-gray-900 text-lg">
                  {selectedDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </div>
                <div className="text-sm text-gray-500">
                  {dayJobs.length} job{dayJobs.length !== 1 ? 's' : ''} scheduled
                </div>
              </div>
            </div>
            <button 
              className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
              onClick={() => setSelectedDate(null)}
            >
              <XCircleIcon className="h-5 w-5 text-gray-500" />
            </button>
          </div>
          
          <div className="p-6 max-h-[calc(90vh-120px)] overflow-y-auto">
            <div className="grid gap-4">
              {dayJobs.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No jobs scheduled for this date
                </div>
              ) : (
                dayJobs.map(job => (
                  <div
                    key={job.id}
                    className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => setSelectedJob(job)}
                  >
                    <div className="flex items-center space-x-4">
                      <div className={`p-2 rounded-lg ${getStatusColor(job.status)}`}>
                        {getStatusIcon(job.status)}
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">{job.code}</div>
                        <div className="text-sm text-gray-500">{job.productName}</div>
                        <div className="text-xs text-gray-400">{job.customer.name}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(job.status)}`}>
                        {job.status.replace('_', ' ').toUpperCase()}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">P{job.priority}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
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
          {/* Search */}
          <div className="relative">
            <input
              type="text"
              placeholder="Search jobs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-64"
            />
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
            </div>
          </div>

          {/* Density Toggle */}
          <div className="flex rounded-lg shadow-sm border border-gray-300 bg-white">
            <button
              onClick={() => setDensity('comfortable')}
              className={`px-3 py-2 text-sm font-medium rounded-l-lg border-r transition-colors ${
                density === 'comfortable'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
              title="Comfortable view"
            >
              <Squares2X2Icon className="h-4 w-4" />
            </button>
            <button
              onClick={() => setDensity('compact')}
              className={`px-3 py-2 text-sm font-medium rounded-r-lg transition-colors ${
                density === 'compact'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
              title="Compact view"
            >
              <TableCellsIcon className="h-4 w-4" />
            </button>
          </div>

          {/* View Mode Toggle */}
          <div className="flex rounded-lg shadow-sm border border-gray-300 bg-white">
            <button
              onClick={() => setViewMode('week')}
              className={`px-4 py-2 text-sm font-medium rounded-l-lg border-r transition-colors ${
                viewMode === 'week'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              Week
            </button>
            <button
              onClick={() => setViewMode('month')}
              className={`px-4 py-2 text-sm font-medium border-r transition-colors ${
                viewMode === 'month'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              Month
            </button>
            <button
              onClick={() => setViewMode('gantt')}
              className={`px-4 py-2 text-sm font-medium rounded-r-lg transition-colors ${
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

      {/* Filters Bar */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center space-x-2 px-3 py-2 rounded-lg border transition-colors ${
                showFilters ? 'bg-blue-50 border-blue-200 text-blue-700' : 'border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <FunnelIcon className="h-4 w-4" />
              <span className="text-sm font-medium">Filters</span>
            </button>

            {showFilters && (
              <>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                >
                  <option value="all">All Status</option>
                  <option value="draft">Draft</option>
                  <option value="released">Released</option>
                  <option value="in_progress">In Progress</option>
                  <option value="blocked">Blocked</option>
                </select>

                <select
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(Number(e.target.value))}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                >
                  <option value="0">All Priority</option>
                  <option value="1">P1 - Critical</option>
                  <option value="2">P2 - High</option>
                  <option value="3">P3 - Medium</option>
                  <option value="4">P4 - Low</option>
                  <option value="5">P5 - Minimal</option>
                </select>
              </>
            )}
          </div>

          <div className="text-sm text-gray-500">
            Showing {visibleJobs.length} of {jobs.length} job{visibleJobs.length !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigateDate('prev')}
            className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
          >
            <ChevronLeftIcon className="h-5 w-5" />
          </button>
          <h3 className="text-lg font-semibold text-gray-900">
            {viewMode === 'week' && 
              `Week of ${getWeekDates(currentDate)[0].toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`
            }
            {viewMode === 'month' && 
              currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
            }
            {viewMode === 'gantt' && (() => {
              const s = new Date(currentDate)
              s.setDate(s.getDate() - 7)
              const e = new Date(currentDate)
              e.setDate(e.getDate() + 21)
              return `${s.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${e.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
            })()}
          </h3>
          <button
            onClick={() => navigateDate('next')}
            className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
          >
            <ChevronRightIcon className="h-5 w-5" />
          </button>
        </div>
        <div className="flex items-center space-x-3">
          <div className="text-sm text-gray-500">
            Density: <span className="font-medium">{density === 'comfortable' ? 'Comfortable' : 'Compact'}</span>
          </div>
          <button
            onClick={() => setCurrentDate(new Date())}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Today
          </button>
        </div>
      </div>

      {/* Calendar Content */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
        {jobsLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <>
            {viewMode === 'week' && renderWeekView()}
            {viewMode === 'month' && renderMonthView()}
            {viewMode === 'gantt' && renderGanttView()}
          </>
        )}
      </div>

      {renderJobDetails()}
      {renderDateDetails()}

      {/* Legend */}
      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
        <h4 className="text-sm font-medium text-gray-900 mb-3">Legend</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-red-50 rounded border-l-4 border-l-red-500"></div>
            <span className="text-sm text-gray-700">P1 - Critical</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-orange-50 rounded border-l-4 border-l-orange-500"></div>
            <span className="text-sm text-gray-700">P2 - High</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-yellow-50 rounded border-l-4 border-l-yellow-500"></div>
            <span className="text-sm text-gray-700">P3 - Medium</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-yellow-100 rounded text-yellow-800"></div>
            <span className="text-sm text-gray-700">In Progress</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-blue-50 rounded text-blue-800"></div>
            <span className="text-sm text-gray-700">Released</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-red-50 rounded text-red-800"></div>
            <span className="text-sm text-gray-700">Blocked</span>
          </div>
        </div>
      </div>
    </div>
  )
}