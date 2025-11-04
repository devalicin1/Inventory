import { useState, type FC } from 'react'
import { 
  type Job, 
  type Ticket, 
  type Consumption, 
  type TimeLog, 
  type HistoryEvent,
  getJob,
  listJobTickets,
  listJobConsumptions,
  listJobTimeLogs,
  listJobHistory,
  createTicket,
  createConsumption,
  createTimeLog,
  type ProductionRun,
  listJobProductionRuns,
  createProductionRun
} from '../api/production-jobs'
import { downloadJobPDF } from '../utils/pdfGenerator'
import { PrintFormModal } from './PrintFormModal'
import { JobCreatePrintFormModal } from './JobCreatePrintFormModal'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listWorkflows, type Workflow, updateJob, setJobStatus } from '../api/production-jobs'
import { listProducts, type ListedProduct } from '../api/inventory'
import { deleteConsumption } from '../api/production-jobs'
import { approveConsumption } from '../api/production-jobs'
import { updateConsumption } from '../api/production-jobs'
import { listGroups, type Group } from '../api/products'
import { 
  XMarkIcon,
  PlusIcon,
  ClockIcon,
  CubeIcon,
  TruckIcon,
  DocumentTextIcon,
  ChartBarIcon,
  CalendarIcon,
  ArchiveBoxIcon,
  TrashIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  UserGroupIcon,
  BuildingStorefrontIcon,
  ChevronRightIcon,
  ArrowDownTrayIcon
} from '@heroicons/react/24/outline'

interface JobDetailProps {
  job: Job
  workspaceId: string
  onClose: () => void
  onDelete?: (jobId: string) => void
  workcenters?: Array<{ id: string; name: string }>
  resources?: Array<{ id: string; name: string }>
}

type TabType = 'overview' | 'tickets' | 'materials' | 'consumptions' | 'output' | 'packaging' | 'time' | 'history' | 'files'

export function JobDetail({ job, workspaceId, onClose, onDelete, workcenters = [], resources = [] }: JobDetailProps) {
  const [activeTab, setActiveTab] = useState<TabType>('overview')
  const [showCreateTicket, setShowCreateTicket] = useState(false)
  const [showCreateConsumption, setShowCreateConsumption] = useState(false)
  const [showCreateTimeLog, setShowCreateTimeLog] = useState(false)
  const queryClient = useQueryClient()
  const [showPrintForm, setShowPrintForm] = useState(false)
  const [showCreatePrintForm, setShowCreatePrintForm] = useState(false)

  // Keep job fresh so stage changes reflect immediately after confirm
  const { data: jobFresh } = useQuery({
    queryKey: ['job', workspaceId, job.id],
    queryFn: () => getJob(workspaceId, job.id),
    initialData: job,
  })
  const effectiveJob = (jobFresh || job) as Job

  // Fetch related data
  const { data: tickets = [], isLoading: ticketsLoading } = useQuery({
    queryKey: ['jobTickets', workspaceId, job.id],
    queryFn: () => listJobTickets(workspaceId, job.id),
  })

  const { data: consumptions = [] } = useQuery({
    queryKey: ['jobConsumptions', workspaceId, job.id],
    queryFn: () => listJobConsumptions(workspaceId, job.id),
  })

  const { data: timelogs = [] } = useQuery({
    queryKey: ['jobTimelogs', workspaceId, job.id],
    queryFn: () => listJobTimeLogs(workspaceId, job.id),
  })

  const { data: history = [] } = useQuery({
    queryKey: ['jobHistory', workspaceId, job.id],
    queryFn: () => listJobHistory(workspaceId, job.id),
  })

  const { data: workflows = [] } = useQuery({
    queryKey: ['workflows', workspaceId],
    queryFn: () => listWorkflows(workspaceId),
  })

  // Mutations
  const createTicketMutation = useMutation({
    mutationFn: (input: Omit<Ticket, 'id' | 'createdAt' | 'updatedAt'>) =>
      createTicket(workspaceId, job.id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobTickets', workspaceId, job.id] })
      setShowCreateTicket(false)
    },
  })

  const createConsumptionMutation = useMutation({
    mutationFn: (input: Omit<Consumption, 'id' | 'at'>) =>
      createConsumption(workspaceId, job.id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobConsumptions', workspaceId, job.id] })
      queryClient.invalidateQueries({ queryKey: ['jobs', workspaceId] })
      setShowCreateConsumption(false)
    },
  })

  const createTimeLogMutation = useMutation({
    mutationFn: (input: Omit<TimeLog, 'id'>) =>
      createTimeLog(workspaceId, job.id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobTimelogs', workspaceId, job.id] })
      setShowCreateTimeLog(false)
    },
  })

  const setStatusMutation = useMutation({
    mutationFn: (status: Job['status']) => setJobStatus(workspaceId, job.id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job', workspaceId, job.id] })
      queryClient.invalidateQueries({ queryKey: ['jobs', workspaceId] })
    },
  })

  const tabs = [
    { id: 'overview', name: 'Overview', icon: DocumentTextIcon, count: null },
    { id: 'tickets', name: 'Tickets', icon: ArchiveBoxIcon, count: tickets.length },
    { id: 'materials', name: 'Materials', icon: CubeIcon, count: job.bom?.length || 0 },
    { id: 'consumptions', name: 'Consumptions', icon: ChartBarIcon, count: consumptions.length },
    { id: 'output', name: 'Output', icon: TruckIcon, count: job.output?.length || 0 },
    { id: 'packaging', name: 'Packaging', icon: CubeIcon, count: job.packaging ? 1 : 0 },
    { id: 'time', name: 'Time', icon: ClockIcon, count: timelogs.length },
    { id: 'history', name: 'History', icon: CalendarIcon, count: history.length },
    { id: 'files', name: 'Files', icon: DocumentTextIcon, count: 0 },
  ]

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-gray-100 text-gray-800 border-gray-300'
      case 'released': return 'bg-blue-50 text-blue-700 border-blue-200'
      case 'in_progress': return 'bg-amber-50 text-amber-700 border-amber-200'
      case 'blocked': return 'bg-red-50 text-red-700 border-red-200'
      case 'done': return 'bg-green-50 text-green-700 border-green-200'
      case 'cancelled': return 'bg-gray-100 text-gray-600 border-gray-300'
      default: return 'bg-gray-100 text-gray-800 border-gray-300'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'draft': return DocumentTextIcon
      case 'released': return ClockIcon
      case 'in_progress': return ChartBarIcon
      case 'blocked': return ExclamationTriangleIcon
      case 'done': return CheckCircleIcon
      case 'cancelled': return XMarkIcon
      default: return DocumentTextIcon
    }
  }

  const getRiskColor = (risk?: string) => {
    switch (risk) {
      case 'overdue': return 'text-red-600 bg-red-50 border-red-200'
      case 'warning': return 'text-amber-600 bg-amber-50 border-amber-200'
      default: return 'text-green-600 bg-green-50 border-green-200'
    }
  }

  const getPriorityColor = (priority: number) => {
    if (priority >= 4) return 'text-red-600 bg-red-50 border-red-200'
    if (priority >= 3) return 'text-amber-600 bg-amber-50 border-amber-200'
    return 'text-blue-600 bg-blue-50 border-blue-200'
  }

  return (
    <div className="fixed inset-0 z-50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-none max-w-7xl w-full h-5/6 flex flex-col shadow-2xl border border-gray-200">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
          <div className="flex items-center space-x-4">
            <div className="flex-shrink-0">
              <div className={`w-3 h-10 rounded-full ${getStatusColor(job.status).split(' ')[0]}`} />
            </div>
            <div>
              <div className="flex items-center space-x-3">
                <h2 className="text-2xl font-bold text-gray-900">{job.code}</h2>
                <span className={`inline-flex items-center px-3 py-1 rounded-full border text-sm font-medium ${getStatusColor(job.status)}`}>
                  {(() => {
                    const Icon = getStatusIcon(job.status)
                    return <Icon className="h-4 w-4 mr-1" />
                  })()}
                  {job.status.replace('_', ' ').toUpperCase()}
                </span>
              </div>
              <p className="text-sm text-gray-600 mt-1">{job.productName} • {job.quantity} {job.unit}</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowPrintForm(true)}
              className="px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2"
              title="Download Print Form"
            >
              <ArrowDownTrayIcon className="h-5 w-5" />
              <span className="hidden sm:inline">Print Form</span>
            </button>
            <button
              onClick={() => setShowCreatePrintForm(true)}
              className="px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2"
              title="Download Create Form"
            >
              <ArrowDownTrayIcon className="h-5 w-5" />
              <span className="hidden sm:inline">Create Form</span>
            </button>
            <button
              onClick={async () => {
                try {
                  await downloadJobPDF(effectiveJob)
                } catch (error) {
                  console.error('PDF download failed:', error)
                  alert('PDF indirilemedi. Lütfen tekrar deneyin.')
                }
              }}
              className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
              title="Download PDF"
            >
              <ArrowDownTrayIcon className="h-5 w-5" />
              <span className="hidden sm:inline">Download PDF</span>
            </button>
            {job.status === 'draft' && (
              <button
                onClick={() => setStatusMutation.mutate('released')}
                className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Release
              </button>
            )}
            {onDelete && (
              <button
                onClick={() => {
                  if (confirm('Are you sure you want to delete this job? This action cannot be undone.')) {
                    onDelete(job.id)
                    onClose()
                  }
                }}
                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors duration-200"
                title="Delete job"
              >
                <TrashIcon className="h-5 w-5" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors duration-200"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 bg-white">
          <nav className="flex space-x-8 px-6 overflow-x-auto">
            {tabs.map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as TabType)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 whitespace-nowrap transition-colors duration-200 ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{tab.name}</span>
                  {tab.count !== null && (
                    <span className={`${
                      activeTab === tab.id 
                        ? 'bg-blue-100 text-blue-600' 
                        : 'bg-gray-100 text-gray-600'
                    } inline-flex items-center justify-center px-2 py-1 text-xs rounded-full`}>
                      {tab.count}
                    </span>
                  )}
                </button>
              )
            })}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto bg-gray-50">
          <div className="p-6">
            {activeTab === 'overview' && (
              <OverviewTab 
                job={effectiveJob} 
                getRiskColor={getRiskColor}
                getPriorityColor={getPriorityColor}
                workcenters={workcenters} 
                resources={resources} 
                workflows={workflows} 
                history={history}
                workspaceId={workspaceId}
              />
            )}
            {activeTab === 'tickets' && (
              <TicketsTab 
                tickets={tickets} 
                isLoading={ticketsLoading}
                onCreateTicket={() => setShowCreateTicket(true)} 
              />
            )}
          {activeTab === 'materials' && <MaterialsTab job={effectiveJob} workspaceId={workspaceId} />}
          {activeTab === 'consumptions' && (
            <ConsumptionsTab 
              consumptions={consumptions} 
              onCreateConsumption={() => setShowCreateConsumption(true)} 
              workspaceId={workspaceId}
              jobId={job.id}
            />
          )}
          {activeTab === 'output' && <OutputTab job={effectiveJob} workspaceId={workspaceId} workcenters={workcenters} workflows={workflows} />}
          {activeTab === 'packaging' && <PackagingTab job={effectiveJob} />}
          {activeTab === 'time' && (
            <TimeTab 
              timelogs={timelogs} 
              onCreateTimeLog={() => setShowCreateTimeLog(true)} 
            />
          )}
          {activeTab === 'history' && (
            <HistoryTab 
              history={history} 
              workflows={workflows}
            />
          )}
          {activeTab === 'files' && <FilesTab job={effectiveJob} />}
          </div>
        </div>
      </div>

      {/* Modals */}
      {showCreateTicket && (
        <CreateTicketModal
          onSubmit={(data) => createTicketMutation.mutate(data)}
          onClose={() => setShowCreateTicket(false)}
          isLoading={createTicketMutation.isPending}
        />
      )}

      {showPrintForm && (
        <PrintFormModal job={effectiveJob} onClose={() => setShowPrintForm(false)} />
      )}

      {showCreatePrintForm && (
        <JobCreatePrintFormModal
          formData={effectiveJob}
          onClose={() => setShowCreatePrintForm(false)}
        />
      )}

      {showCreateConsumption && (
        <CreateConsumptionModal
          job={job}
          workspaceId={workspaceId}
          onSubmit={(data) => createConsumptionMutation.mutate(data)}
          onClose={() => setShowCreateConsumption(false)}
          isLoading={createConsumptionMutation.isPending}
        />
      )}

      {showCreateTimeLog && (
        <CreateTimeLogModal
          job={job}
          onSubmit={(data) => createTimeLogMutation.mutate(data)}
          onClose={() => setShowCreateTimeLog(false)}
          isLoading={createTimeLogMutation.isPending}
        />
      )}
    </div>
  )
}

// Tab Components
interface OverviewTabProps {
  job: Job
  getRiskColor: (risk?: string) => string
  getPriorityColor: (priority: number) => string
  workcenters: Array<{ id: string; name: string }>
  resources: Array<{ id: string; name: string }>
  workflows?: Workflow[]
  history?: HistoryEvent[]
  workspaceId: string
}

const OverviewTab: FC<OverviewTabProps> = ({ 
  job, 
  getRiskColor, 
  getPriorityColor,
  workcenters, 
  resources, 
  workflows = [],
  history = [],
  workspaceId
}) => {
  const queryClient = useQueryClient()
  // Helper function to safely convert dates
  const formatDate = (date: any) => {
    if (!date) return '-'
    try {
      // Handle Firebase Timestamp
      if (date.seconds) {
        return new Date(date.seconds * 1000).toLocaleDateString()
      }
      // Handle regular Date object
      return new Date(date).toLocaleDateString()
    } catch {
      return 'Invalid Date'
    }
  }

  // Helper function to get workcenter name
  const getWorkcenterName = (id?: string) => {
    if (!id) return 'Unassigned'
    const wc = workcenters.find(w => w.id === id)
    return wc?.name || id
  }

  // Helper function to get resource names
  const getAssigneeNames = (ids: string[]) => {
    if (ids.length === 0) return 'Unassigned'
    return ids.map(id => {
      const resource = resources.find(r => r.id === id)
      return resource?.name || id
    }).join(', ')
  }

  const stageName = (id?: string | null) => {
    if (!id) return '-'
    for (const wf of workflows) {
      const s = wf.stages?.find(st => st.id === id)
      if (s) return s.name
    }
    return id
  }

  const getFinishDate = () => {
    if (job.status === 'done') {
      // Prefer updatedAt; fallback to acceptance dates
      return job.updatedAt || (job as any).customerAcceptedAt || (job as any).qaAcceptedAt
    }
    return null
  }

  const calculateProgress = () => {
    if (!job.output || job.output.length === 0) return 0
    const item = job.output[0]
    return item.qtyPlanned > 0 ? (item.qtyProduced / item.qtyPlanned) * 100 : 0
  }

  const progress = calculateProgress()

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                <CubeIcon className="h-5 w-5 text-blue-600" />
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Progress</p>
              <p className="text-2xl font-semibold text-gray-900">
                {Math.round(progress)}%
              </p>
            </div>
          </div>
          <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center">
                <ExclamationTriangleIcon className="h-5 w-5 text-amber-600" />
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Priority</p>
              <p className={`text-2xl font-semibold ${getPriorityColor(job.priority).split(' ')[0]}`}>
                P{job.priority}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                <UserGroupIcon className="h-5 w-5 text-green-600" />
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Assignees</p>
              <p className="text-2xl font-semibold text-gray-900">{job.assignees.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                job.risk === 'overdue' ? 'bg-red-100' : 
                job.risk === 'warning' ? 'bg-amber-100' : 'bg-green-100'
              }`}>
                <ChartBarIcon className={`h-5 w-5 ${
                  job.risk === 'overdue' ? 'text-red-600' : 
                  job.risk === 'warning' ? 'text-amber-600' : 'text-green-600'
                }`} />
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Risk Level</p>
              <p className={`text-2xl font-semibold ${
                job.risk === 'overdue' ? 'text-red-600' : 
                job.risk === 'warning' ? 'text-amber-600' : 'text-green-600'
              }`}>
                {job.risk?.toUpperCase() || 'LOW'}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column */}
        <div className="space-y-6">
          {/* Customer Information */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                <BuildingStorefrontIcon className="h-5 w-5 mr-2 text-gray-400" />
                Customer Information
              </h3>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-600">Customer Name</span>
                <span className="text-sm text-gray-900">{job.customer.name}</span>
              </div>
              {job.customer.orderNo && (
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-600">Order Number</span>
                  <span className="text-sm text-gray-900">{job.customer.orderNo}</span>
                </div>
              )}
            </div>
          </div>

          {/* Dates */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                <CalendarIcon className="h-5 w-5 mr-2 text-gray-400" />
                Important Dates
              </h3>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-600">Due Date</span>
                <span className={`text-sm font-medium ${getRiskColor(job.risk).split(' ')[0]}`}>
                  {formatDate(job.dueDate)}
                </span>
              </div>
              {job.plannedStart && (
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-600">Planned Start</span>
                  <span className="text-sm text-gray-900">{formatDate(job.plannedStart)}</span>
                </div>
              )}
              {job.plannedEnd && (
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-600">Planned End</span>
                  <span className="text-sm text-gray-900">{formatDate(job.plannedEnd)}</span>
                </div>
              )}
              {job.status === 'done' && (
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-600">Finish Date</span>
                  <span className="text-sm text-green-600">{formatDate(getFinishDate())}</span>
                </div>
              )}
              {job.qaAcceptedAt && (
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-600">QA Accepted</span>
                  <span className="text-sm text-green-600">{formatDate(job.qaAcceptedAt)}</span>
                </div>
              )}
              {job.customerAcceptedAt && (
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-600">Customer Accepted</span>
                  <span className="text-sm text-blue-600">{formatDate(job.customerAcceptedAt)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Job References & Flags */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Job References & Flags</h3>
            </div>
            <div className="p-6 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-600">Repeat</span>
                <span className="text-sm text-gray-900">{(job as any).isRepeat ? 'Yes' : 'No'}</span>
              </div>
              {(job as any).tams && (
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-600">TAMS</span>
                  <span className="text-sm text-gray-900">{(job as any).tams}</span>
                </div>
              )}
              {(job as any).rsOrderRef && (
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-600">RS / Order Ref</span>
                  <span className="text-sm text-gray-900">{(job as any).rsOrderRef}</span>
                </div>
              )}
              {((job as any).outerType || (job as any).outerCode) && (
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-600">Outer</span>
                  <span className="text-sm text-gray-900">{((job as any).outerType || '-') + ( (job as any).outerCode ? ` • ${String((job as any).outerCode)}` : '' )}</span>
                </div>
              )}
              {(job as any).deliveryMethod && (
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-600">Delivery Method</span>
                  <span className="text-sm text-gray-900">{(job as any).deliveryMethod}</span>
                </div>
              )}
              {(job as any).deliveryAddress && (
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-600">Delivery Address</span>
                  <span className="text-sm text-gray-900 text-right max-w-[60%] truncate" title={(job as any).deliveryAddress}>{(job as any).deliveryAddress}</span>
                </div>
              )}
              {typeof (job as any).weightPerBox !== 'undefined' && (job as any).weightPerBox !== null && (
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-600">Weight per Box</span>
                  <span className="text-sm text-gray-900">{(job as any).weightPerBox} kg</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Assignment */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                <UserGroupIcon className="h-5 w-5 mr-2 text-gray-400" />
                Assignment
              </h3>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-600">Assignees</span>
                <span className="text-sm text-gray-900 text-right">
                  {getAssigneeNames(job.assignees)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-600">Workcenter</span>
                <span className="text-sm text-gray-900">{getWorkcenterName(job.workcenterId)}</span>
              </div>
            </div>
          </div>

          {/* Workflow Path */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Workflow Path</h3>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  className="rounded border-gray-300"
                  checked={((job as any).requireOutputToAdvance !== false)}
                  onChange={async (e) => {
                    try {
                      await updateJob(workspaceId, job.id, { requireOutputToAdvance: e.target.checked } as any)
                      queryClient.invalidateQueries({ queryKey: ['job', workspaceId, job.id] })
                    } catch {
                      // best-effort; parent will re-fetch
                    }
                  }}
                />
                Require output to advance
              </label>
            </div>
            <div className="p-6">
              {Array.isArray((job as any).plannedStageIds) && (job as any).plannedStageIds.length > 0 ? (
                <>
                  {/* Chips */}
                  <div className="flex flex-wrap gap-2 mb-4">
                    {(() => {
                      const planned: string[] = (job as any).plannedStageIds
                      const visited = new Set<string>(history.filter(h => h.type === 'stage_change').map(h => String((h as any).payload?.newStageId)))
                      return planned.map((id: string, index: number) => {
                        const isCurrent = job.status !== 'done' && job.status !== 'draft' && id === job.currentStageId
                        const isDone = job.status === 'done' || (visited.has(id) && !isCurrent)
                        const base = 'px-3 py-2 rounded-lg text-sm font-medium border'
                        const cls = isCurrent
                          ? `${base} bg-blue-100 text-blue-700 border-blue-300`
                          : isDone
                            ? `${base} bg-green-50 text-green-700 border-green-200`
                            : `${base} bg-gray-100 text-gray-700 border-gray-300`
                        return (
                          <div key={id} className="flex items-center">
                            <span className={cls}>
                              {stageName(id)}
                              {isCurrent && (
                                <span className="ml-2 text-xs bg-blue-500 text-white px-1.5 py-0.5 rounded-full">Current</span>
                              )}
                              {isDone && !isCurrent && (
                                <span className="ml-2 text-xs bg-green-500 text-white px-1.5 py-0.5 rounded-full">Done</span>
                              )}
                            </span>
                            {index < planned.length - 1 && (
                              <ChevronRightIcon className="h-4 w-4 text-gray-400 mx-2" />
                            )}
                          </div>
                        )
                      })
                    })()}
                  </div>
                  {/* Timeline table */}
                  <div className="bg-gray-50 border border-gray-200 rounded-md p-3">
                    <h4 className="text-sm font-semibold text-gray-900 mb-2">Stage Timeline</h4>
                    {(() => {
                      const stageChanges = history
                        .filter(h => h.type === 'stage_change')
                        .slice()
                        .sort((a: any, b: any) => a.at.seconds - b.at.seconds)

                      // Map when a stage was COMPLETED (i.e., when the job moved to the next stage)
                      const completedAtByStage = new Map<string, number>()
                      // Map when a stage was STARTED (i.e., when the job moved into the stage)
                      const startedAtByStage = new Map<string, number>()
                      stageChanges.forEach((h: any) => {
                        const prevId = String(h.payload?.previousStageId)
                        if (prevId && !completedAtByStage.has(prevId)) {
                          completedAtByStage.set(prevId, h.at.seconds)
                        }
                        const newId = String(h.payload?.newStageId)
                        if (newId) {
                          // keep first occurrence as start
                          if (!startedAtByStage.has(newId)) {
                            startedAtByStage.set(newId, h.at.seconds)
                          }
                        }
                      })

                      // If the job is fully done, mark the current (last) stage as completed at finish time
                      if (job.status === 'done' && job.currentStageId && !completedAtByStage.has(job.currentStageId)) {
                        const f = getFinishDate() as any
                        const ts = f ? (f.seconds ? f.seconds : Math.floor(new Date(f).getTime() / 1000)) : undefined
                        if (ts) completedAtByStage.set(job.currentStageId, ts)
                      }

                      const planned: string[] = (job as any).plannedStageIds
                      const rows = planned.map((sid) => {
                        const tsFinish = completedAtByStage.get(sid)
                        const tsStart = startedAtByStage.get(sid)
                        const started = tsStart ? new Date(tsStart * 1000).toLocaleString('tr-TR') : '-'
                        const finished = tsFinish ? new Date(tsFinish * 1000).toLocaleString('tr-TR') : '-'
                        let status: 'Done' | 'Current' | '-' = '-'
                        if (job.status === 'done') {
                          status = 'Done'
                        } else if (sid === job.currentStageId) {
                          status = 'Current'
                        } else if (tsFinish) {
                          status = 'Done'
                        }
                        return { stage: stageName(sid), started, finished, status, key: sid }
                      })
                      if (job.status === 'done') {
                        const f = getFinishDate()
                        rows.push({ stage: 'Job Finished', date: f ? new Date((f as any).seconds ? (f as any).seconds * 1000 : f).toLocaleString('tr-TR') : '-', status: 'Done', key: '__finished__' })
                      }
                      if (rows.length === 0) return <p className="text-sm text-gray-500">No movements recorded yet.</p>
                      return (
                        <div className="overflow-x-auto">
                          <table className="min-w-full text-sm">
                            <thead>
                              <tr className="text-left bg-white">
                                <th className="px-3 py-2 font-medium text-gray-700">Stage</th>
                                <th className="px-3 py-2 font-medium text-gray-700">Started</th>
                                <th className="px-3 py-2 font-medium text-gray-700">Finished</th>
                                <th className="px-3 py-2 font-medium text-gray-700">Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {rows.map(r => (
                                <tr key={r.key} className="border-t border-gray-200">
                                  <td className="px-3 py-2 text-gray-900">{r.stage}</td>
                                  <td className="px-3 py-2 text-gray-900">{'started' in r ? (r as any).started : '-'}</td>
                                  <td className="px-3 py-2 text-gray-900">{'finished' in r ? (r as any).finished : (r.key === '__finished__' ? (r as any).date : '-')}</td>
                                  <td className="px-3 py-2">
                                    {r.status === 'Done' && <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 border border-green-200">Done</span>}
                                    {r.status === 'Current' && <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 border border-blue-200">Current</span>}
                                    {r.status === '-' && <span className="text-gray-500">-</span>}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )
                    })()}
                  </div>
                </>
              ) : (
                <p className="text-sm text-gray-600">No specific path defined for this job.</p>
              )}
            </div>
          </div>

          {/* Technical Specifications */}
          {((job as any).productionSpecs) && (
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">Technical Specifications</h3>
              </div>
              {(() => {
                const specs: any = (job as any).productionSpecs || {}
                const formatDim = (obj?: any) => obj && (obj.width || obj.length || obj.height)
                  ? [obj.width, obj.length, obj.height].filter(v => typeof v !== 'undefined').join(' × ')
                  : '-'
                return (
                  <div className="p-6 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="flex items-center justify-between"><span className="text-sm font-medium text-gray-600">Style</span><span className="text-sm text-gray-900">{specs.style || '-'}</span></div>
                      <div className="flex items-center justify-between"><span className="text-sm font-medium text-gray-600">Number Up</span><span className="text-sm text-gray-900">{typeof specs.numberUp === 'number' ? specs.numberUp : '-'}</span></div>
                      <div className="flex items-center justify-between"><span className="text-sm font-medium text-gray-600">Printed Colors</span><span className="text-sm text-gray-900">{typeof specs.printedColors === 'number' ? specs.printedColors : '-'}</span></div>
                      <div className="flex items-center justify-between"><span className="text-sm font-medium text-gray-600">Varnish</span><span className="text-sm text-gray-900">{specs.varnish || '-'}</span></div>
                      <div className="flex items-center justify-between"><span className="text-sm font-medium text-gray-600">Microns</span><span className="text-sm text-gray-900">{typeof specs.microns === 'number' ? specs.microns : '-'}</span></div>
                      <div className="flex items-center justify-between"><span className="text-sm font-medium text-gray-600">Board</span><span className="text-sm text-gray-900">{specs.board || '-'}</span></div>
                      <div className="flex items-center justify-between"><span className="text-sm font-medium text-gray-600">Yield per Sheet</span><span className="text-sm text-gray-900">{typeof specs.yieldPerSheet === 'number' ? specs.yieldPerSheet : '-'}</span></div>
                      <div className="flex items-center justify-between"><span className="text-sm font-medium text-gray-600">Label No</span><span className="text-sm text-gray-900">{typeof specs.labelNo === 'number' ? specs.labelNo : '-'}</span></div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="flex items-center justify-between"><span className="text-sm font-medium text-gray-600">Size (W × L × H)</span><span className="text-sm text-gray-900">{formatDim(specs.size)}</span></div>
                      <div className="flex items-center justify-between"><span className="text-sm font-medium text-gray-600">Forme (W × L)</span><span className="text-sm text-gray-900">{formatDim(specs.forme)}</span></div>
                      <div className="flex items-center justify-between"><span className="text-sm font-medium text-gray-600">Sheet (W × L)</span><span className="text-sm text-gray-900">{formatDim(specs.sheet)}</span></div>
                      <div className="flex items-center justify-between"><span className="text-sm font-medium text-gray-600">Cut To (W × L)</span><span className="text-sm text-gray-900">{formatDim(specs.cutTo)}</span></div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="flex items-center justify-between"><span className="text-sm font-medium text-gray-600">Overs %</span><span className="text-sm text-gray-900">{typeof specs.oversPct === 'number' ? `${specs.oversPct}%` : '-'}</span></div>
                      <div className="flex items-center justify-between"><span className="text-sm font-medium text-gray-600">Sheet Wastage</span><span className="text-sm text-gray-900">{typeof specs.sheetWastage === 'number' ? specs.sheetWastage : '-'}</span></div>
                    </div>
                  </div>
                )
              })()}
            </div>
          )}

          {/* Packaging Summary */}
          {((job as any).packaging) && (
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">Packaging Summary</h3>
              </div>
              {(() => {
                const p: any = (job as any).packaging || {}
                return (
                  <div className="p-6 space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="flex items-center justify-between"><span className="text-sm font-medium text-gray-600">Pieces per Box</span><span className="text-sm text-gray-900">{typeof p.pcsPerBox === 'number' ? p.pcsPerBox : '-'}</span></div>
                      <div className="flex items-center justify-between"><span className="text-sm font-medium text-gray-600">Boxes per Pallet</span><span className="text-sm text-gray-900">{typeof p.boxesPerPallet === 'number' ? p.boxesPerPallet : '-'}</span></div>
                      <div className="flex items-center justify-between"><span className="text-sm font-medium text-gray-600">Planned Pallets</span><span className="text-sm text-gray-900">{typeof p.plannedPallets === 'number' ? p.plannedPallets : '-'}</span></div>
                      <div className="flex items-center justify-between"><span className="text-sm font-medium text-gray-600">Actual Pallets</span><span className="text-sm text-gray-900">{typeof p.actualPallets === 'number' ? p.actualPallets : '-'}</span></div>
                    </div>
                  </div>
                )
              })()}
            </div>
          )}

          {/* Special Components */}
          {Array.isArray((job as any).specialComponents) && (job as any).specialComponents.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">Special Components</h3>
              </div>
              <div className="p-6">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-left bg-gray-50">
                        <th className="px-3 py-2 font-medium text-gray-700">Name</th>
                        <th className="px-3 py-2 font-medium text-gray-700">Type</th>
                        <th className="px-3 py-2 font-medium text-gray-700">Quantity</th>
                        <th className="px-3 py-2 font-medium text-gray-700">Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {((job as any).specialComponents as any[]).map((c, idx) => (
                        <tr key={idx} className="border-t border-gray-200">
                          <td className="px-3 py-2 text-gray-900">{c.name || '-'}</td>
                          <td className="px-3 py-2 text-gray-900">{c.type || '-'}</td>
                          <td className="px-3 py-2 text-gray-900">{typeof c.qty === 'number' ? c.qty : '-'}</td>
                          <td className="px-3 py-2 text-gray-900">{c.notes || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Stage Progress (per stage) */}
          {Array.isArray((job as any).stageProgress) && (job as any).stageProgress.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">Stage Progress</h3>
              </div>
              <div className="p-6">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-left bg-gray-50">
                        <th className="px-3 py-2 font-medium text-gray-700">Stage</th>
                        <th className="px-3 py-2 font-medium text-gray-700">Planned</th>
                        <th className="px-3 py-2 font-medium text-gray-700">Produced</th>
                        <th className="px-3 py-2 font-medium text-gray-700">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {((job as any).stageProgress as any[]).map((sp, idx) => (
                        <tr key={idx} className="border-t border-gray-200">
                          <td className="px-3 py-2 text-gray-900">{typeof sp.stageId === 'string' ? stageName(sp.stageId) : '-'}</td>
                          <td className="px-3 py-2 text-gray-900">{typeof sp.qtyPlanned === 'number' ? sp.qtyPlanned : '-'}</td>
                          <td className="px-3 py-2 text-gray-900">{typeof sp.qtyProduced === 'number' ? sp.qtyProduced : '-'}</td>
                          <td className="px-3 py-2">
                            {sp.status ? (
                              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200">{String(sp.status).replace('_',' ').toUpperCase()}</span>
                            ) : (
                              <span className="text-gray-500">-</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Notes */}
          {job.notes && (
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">Notes</h3>
              </div>
              <div className="p-6">
                <p className="text-sm text-gray-900">{job.notes}</p>
              </div>
            </div>
          )}

          {/* Block Reason */}
          {job.status === 'blocked' && job.blockReason && (
            <div className="bg-red-50 rounded-lg border border-red-200 shadow-sm">
              <div className="px-6 py-4 border-b border-red-200">
                <h3 className="text-lg font-semibold text-red-900 flex items-center">
                  <ExclamationTriangleIcon className="h-5 w-5 mr-2" />
                  Block Reason
                </h3>
              </div>
              <div className="p-6">
                <p className="text-sm text-red-900">{job.blockReason}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const TicketsTab: FC<{ tickets: Ticket[]; isLoading: boolean; onCreateTicket: () => void }> = ({ 
  tickets, 
  isLoading, 
  onCreateTicket 
}) => {
  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Tickets</h3>
          <p className="text-sm text-gray-600 mt-1">Manage production tickets and issues</p>
        </div>
        <button
          onClick={onCreateTicket}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
        >
          <PlusIcon className="h-4 w-4 mr-2" />
          New Ticket
        </button>
      </div>

      {tickets.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200 shadow-sm">
          <ArchiveBoxIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No tickets</h3>
          <p className="mt-1 text-sm text-gray-500">Get started by creating a new ticket.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Assignees</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Due Date</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {tickets.map((ticket) => (
                  <tr key={ticket.id} className="hover:bg-gray-50 transition-colors duration-150">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{ticket.title}</div>
                        {ticket.description && (
                          <div className="text-sm text-gray-500 truncate max-w-xs">{ticket.description}</div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`${
                        ticket.status === 'open' ? 'bg-gray-100 text-gray-800' :
                        ticket.status === 'in_progress' ? 'bg-amber-100 text-amber-800' :
                        ticket.status === 'done' ? 'bg-green-100 text-green-800' :
                        'bg-red-100 text-red-800'
                      } inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium`}>
                        {ticket.status.replace('_', ' ').toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {ticket.assignees.length} assignees
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {ticket.dueDate ? new Date(ticket.dueDate).toLocaleDateString() : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

const MaterialsTab: FC<{ job: Job; workspaceId: string }> = ({ job, workspaceId }) => {
  const queryClient = useQueryClient()
  const [qtyDraft, setQtyDraft] = useState<Record<string, number>>({})
  const [search, setSearch] = useState('')
  const { data: products = [] } = useQuery<ListedProduct[]>({
    queryKey: ['products', workspaceId],
    queryFn: () => listProducts(workspaceId),
  })
  const { data: existingConsumptions = [] } = useQuery<Consumption[]>({
    queryKey: ['jobConsumptions', workspaceId, job.id],
    queryFn: () => listJobConsumptions(workspaceId, job.id),
  })
  const filteredProducts = products.filter(p => {
    if (!search) return true
    const t = search.toLowerCase();
    return p.name.toLowerCase().includes(t) || p.sku.toLowerCase().includes(t)
  })

  const createMutation = useMutation({
    mutationFn: async (payload: any) => createConsumption(workspaceId, job.id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobConsumptions', workspaceId, job.id] })
      queryClient.invalidateQueries({ queryKey: ['jobs', workspaceId] })
    }
  })
  const updateJobMutation = useMutation({
    mutationFn: (payload: any) => updateJob(workspaceId, job.id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job', workspaceId, job.id] })
    }
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900">Bill of Materials</h3>
      </div>
      {/* Add item to BOM */}
      <div className="flex gap-2 items-center">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search inventory (SKU or name)"
          className="flex-1 rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 transition-colors py-2 px-3 border"
        />
        <select
          onChange={async (e) => {
            const id = e.target.value
            if (!id) return
            const p = products.find(pr => pr.id === id)
            if (!p) return
            const exists = (job.bom || []).some(b => (b as any).itemId === id || b.sku === p.sku)
            if (exists) { e.currentTarget.selectedIndex = 0; return }
            const nextBom = [ ...(job.bom || []), { itemId: id, sku: p.sku, name: p.name, qtyRequired: 1, uom: p.uom, reserved: 0, consumed: 0 } ]
            await updateJobMutation.mutateAsync({ bom: nextBom })
            e.currentTarget.selectedIndex = 0
          }}
          className="rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 transition-colors py-2 px-3 border bg-white"
        >
          <option value="">Add item…</option>
          {filteredProducts.map(p => (
            <option key={p.id} value={p.id}>{p.sku} — {p.name} ({p.uom})</option>
          ))}
        </select>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SKU</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Required</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reserved</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Consumed</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">UOM</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Lot</th>
              <th className="px-6 py-3" />
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {job.bom.map((item, index) => (
              <tr key={index}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{item.sku}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.name}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  <input
                    type="number"
                    min="0"
                    className="w-24 rounded border-gray-300 text-sm"
                    value={qtyDraft[item.sku] ?? item.qtyRequired}
                    onChange={(e) => setQtyDraft({ ...qtyDraft, [item.sku]: Number(e.target.value) })}
                    onBlur={async () => {
                      const newQty = qtyDraft[item.sku]
                      if (typeof newQty === 'number' && newQty !== item.qtyRequired) {
                        const nextBom = (job.bom || []).map(b => b.sku === item.sku ? { ...b, qtyRequired: newQty } : b)
                        await updateJobMutation.mutateAsync({ bom: nextBom })
                      }
                    }}
                  />
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.reserved}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.consumed}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.uom}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.lot || '-'}</td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                  <div className="flex items-center gap-2 justify-end">
                    <button
                      className="text-blue-600 hover:text-blue-800"
                      onClick={() => {
                        const prod = products.find(p => p.sku === item.sku)
                        const max = Number(prod?.qtyOnHand || 0)
                        const requested = qtyDraft[item.sku] ?? item.qtyRequired
                        if (requested > max) {
                          alert(`Not enough stock for ${item.sku}. Available: ${max}`)
                          return
                        }
                        if (existingConsumptions.some(c => c.itemId === (item as any).itemId && c.approved)) return
                        createMutation.mutate({
                        stageId: (job as any).currentStageId,
                        itemId: (item as any).itemId || '',
                        sku: item.sku,
                        name: item.name,
                        qtyUsed: qtyDraft[item.sku] ?? item.qtyRequired,
                        uom: item.uom,
                        lot: '',
                        userId: 'current-user',
                        approved: true,
                      })
                      queryClient.invalidateQueries({ queryKey: ['job', workspaceId, job.id] })
                      queryClient.invalidateQueries({ queryKey: ['jobs', workspaceId] })
                      }}
                      disabled={createMutation.isPending}
                    >
                      {createMutation.isPending ? 'Approving…' : (existingConsumptions.some(c => c.itemId === (item as any).itemId && c.approved) ? 'Approved' : 'Approve & deduct')}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const ConsumptionsTab: FC<{ consumptions: Consumption[]; onCreateConsumption: () => void; workspaceId?: string; jobId?: string }> = ({ consumptions, onCreateConsumption, workspaceId, jobId }) => {
  const [toDelete, setToDelete] = useState<Consumption | null>(null)
  const queryClient = useQueryClient()
  const [draftQty, setDraftQty] = useState<Record<string, number>>({})
  const [draftLot, setDraftLot] = useState<Record<string, string>>({})
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium text-gray-900">Material Consumptions ({consumptions.length})</h3>
        <button
          onClick={onCreateConsumption}
          className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-green-600 hover:bg-green-700"
        >
          <PlusIcon className="h-4 w-4 mr-1" />
          Record Consumption
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SKU</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Qty Used</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">UOM</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Lot</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3" />
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {consumptions.map((consumption) => (
              <tr key={consumption.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {new Date(consumption.at.seconds * 1000).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{consumption.sku}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{consumption.name}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {consumption.approved ? (
                    consumption.qtyUsed
                  ) : (
                    <input
                      type="number"
                      min="0"
                      className="w-24 rounded border-gray-300 text-sm"
                      value={draftQty[consumption.id] ?? consumption.qtyUsed}
                      onChange={(e) => setDraftQty({ ...draftQty, [consumption.id]: Number(e.target.value) })}
                    />
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{consumption.uom}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {consumption.approved ? (
                    consumption.lot || '-'
                  ) : (
                    <input
                      type="text"
                      className="w-28 rounded border-gray-300 text-sm"
                      value={(draftLot[consumption.id] ?? (consumption.lot || ''))}
                      onChange={(e) => setDraftLot({ ...draftLot, [consumption.id]: e.target.value })}
                      placeholder="Lot"
                    />
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{consumption.userId}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  {consumption.approved ? (
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 border border-green-200">Approved</span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700 border border-yellow-200">Pending</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                  <div className="flex gap-2 justify-end">
                    {!consumption.approved && workspaceId && jobId && (
                      <>
                        <button
                          className="text-gray-700 hover:text-gray-900"
                          onClick={async () => {
                            await updateConsumption(workspaceId, jobId, consumption.id, {
                              qtyUsed: draftQty[consumption.id] ?? consumption.qtyUsed,
                              lot: draftLot[consumption.id] ?? consumption.lot,
                            })
                            queryClient.invalidateQueries({ queryKey: ['jobConsumptions', workspaceId, jobId] })
                          }}
                        >
                          Save
                        </button>
                        <button className="text-blue-600 hover:text-blue-800" onClick={async () => { await approveConsumption(workspaceId, jobId, consumption.id); queryClient.invalidateQueries({ queryKey: ['jobConsumptions', workspaceId, jobId] }); queryClient.invalidateQueries({ queryKey: ['job', workspaceId, jobId] }); queryClient.invalidateQueries({ queryKey: ['jobs', workspaceId] }) }}>Approve</button>
                      </>
                    )}
                    <button className="text-red-600 hover:text-red-800" onClick={() => setToDelete(consumption)}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {toDelete && workspaceId && jobId && (
        <ConfirmDeleteConsumptionModal
          onClose={() => setToDelete(null)}
          onConfirm={async (restock) => {
            await deleteConsumption(workspaceId, jobId, toDelete.id, restock)
            setToDelete(null)
          }}
        />
      )}
    </div>
  )
}

const OutputTab: FC<{ job: Job; workspaceId: string; workcenters: Array<{ id: string; name: string }>; workflows?: Workflow[] }> = ({ job, workspaceId, workcenters, workflows = [] }) => {
  const { data: runs = [] } = useQuery<ProductionRun[]>({
    queryKey: ['jobRuns', workspaceId, job.id],
    queryFn: () => listJobProductionRuns(workspaceId, job.id),
    enabled: !!workspaceId && !!job?.id,
  })
  const queryClient = useQueryClient()
  const createRunMutation = useMutation({
    mutationFn: (payload: Omit<ProductionRun, 'id' | 'at'>) => createProductionRun(workspaceId, job.id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobRuns', workspaceId, job.id] })
      queryClient.invalidateQueries({ queryKey: ['job', workspaceId, job.id] })
    }
  })
  const [draft, setDraft] = useState<{ stageId: string; workcenterId?: string; qtyGood: number; qtyScrap?: number; lot?: string; notes?: string }>({ stageId: job.currentStageId, qtyGood: 0 })

  const getStageName = (id: string) => {
    for (const wf of workflows) {
      const s = wf.stages?.find(st => st.id === id)
      if (s) return s.name
    }
    return id
  }

  const getStageOutputUOM = (stageId: string): string => {
    for (const wf of workflows) {
      const s = wf.stages?.find(st => st.id === stageId)
      if (s?.outputUOM) return s.outputUOM
      // If no outputUOM, check inputUOM
      if (s?.inputUOM) return s.inputUOM
    }
    return '' // Default: no unit shown
  }

  const plannedIds: string[] = Array.isArray((job as any).plannedStageIds) ? (job as any).plannedStageIds : []
  const wf = workflows.find(w => w.id === (job as any).workflowId)
  const stageOptions = (wf?.stages || [])
    .filter(s => plannedIds.length === 0 || plannedIds.includes(s.id))
    .sort((a, b) => a.order - b.order)

  const totalGood = runs.reduce((s, r) => s + Number(r.qtyGood || 0), 0)
  const totalScrap = runs.reduce((s, r) => s + Number(r.qtyScrap || 0), 0)
  const planned = (job.output?.[0]?.qtyPlanned as number) || Number((job as any).quantity || 0)
  const progress = planned > 0 ? (totalGood / planned) * 100 : 0

  const getWorkcenterName = (id?: string) => {
    if (!id) return '-'
    const wc = workcenters.find(w => w.id === id)
    return wc?.name || id
  }

  // Group by stage + machine/workcenter
  const groups = runs.reduce((acc: Record<string, ProductionRun[]>, r) => {
    const key = `${r.stageId}::${r.workcenterId || ''}`
    acc[key] = acc[key] || []
    acc[key].push(r)
    return acc
  }, {})

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h4 className="text-md font-medium text-gray-900 mb-3">Record Production Run</h4>
        <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700">Stage</label>
            <select
              value={draft.stageId}
              onChange={(e) => setDraft({ ...draft, stageId: e.target.value })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              {stageOptions.length === 0 && (
                <option value={draft.stageId}>{getStageName(draft.stageId)}</option>
              )}
              {stageOptions.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700">Workcenter</label>
            <select value={draft.workcenterId || ''} onChange={(e) => setDraft({ ...draft, workcenterId: e.target.value || undefined })} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500">
              <option value="">Unspecified</option>
              {workcenters.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Good Qty</label>
            <input type="number" min={0} value={draft.qtyGood} onChange={(e) => setDraft({ ...draft, qtyGood: Number(e.target.value) })} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Scrap Qty</label>
            <input type="number" min={0} value={draft.qtyScrap || 0} onChange={(e) => setDraft({ ...draft, qtyScrap: Number(e.target.value) })} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700">Lot</label>
            <input type="text" value={draft.lot || ''} onChange={(e) => setDraft({ ...draft, lot: e.target.value })} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" />
          </div>
          <div className="md:col-span-3">
            <label className="block text-sm font-medium text-gray-700">Notes</label>
            <input type="text" value={draft.notes || ''} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" />
          </div>
          <div className="md:col-span-3 flex items-end justify-end">
            <button
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              disabled={createRunMutation.isPending || !draft.stageId || draft.qtyGood <= 0}
              onClick={async () => {
                await createRunMutation.mutateAsync({
                  stageId: draft.stageId,
                  workcenterId: draft.workcenterId,
                  qtyGood: draft.qtyGood,
                  qtyScrap: draft.qtyScrap || 0,
                  lot: draft.lot,
                  notes: draft.notes,
                  operatorId: 'current-user'
                } as any)
                setDraft({ stageId: job.currentStageId, qtyGood: 0 })
              }}
            >
              {createRunMutation.isPending ? 'Saving…' : 'Record Run'}
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="mb-4">
          <h3 className="text-lg font-medium text-gray-900">Production Output</h3>
          <p className="text-sm text-gray-600">Actual vs planned</p>
        </div>
        
        {/* Stage-wise summary */}
        {(() => {
          const groupedByStage = runs.reduce((acc: Record<string, typeof runs>, r) => {
            const stageId = r.stageId
            if (!acc[stageId]) acc[stageId] = []
            acc[stageId].push(r)
            return acc
          }, {})

          const stageOrder = stageOptions.map(s => s.id)
          const sortedStages = Object.keys(groupedByStage).sort((a, b) => {
            const idxA = stageOrder.indexOf(a)
            const idxB = stageOrder.indexOf(b)
            if (idxA === -1 && idxB === -1) return 0
            if (idxA === -1) return 1
            if (idxB === -1) return -1
            return idxA - idxB
          })

          if (sortedStages.length === 0) return null

          return (
            <div className="border-t border-gray-200 pt-4 mt-4">
              <h4 className="text-sm font-semibold text-gray-700 mb-3">By Stage</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {sortedStages.map((stageId) => {
                  const stageRuns = groupedByStage[stageId]
                  const stageName = getStageName(stageId)
                  const stageOutputUOM = getStageOutputUOM(stageId)
                  const stageTotalGood = stageRuns.reduce((sum, r) => sum + (r.qtyGood || 0), 0)
                  const stageTotalScrap = stageRuns.reduce((sum, r) => sum + (r.qtyScrap || 0), 0)
                  
                  return (
                    <div key={stageId} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                      <div className="text-sm font-semibold text-gray-900 mb-2">{stageName}</div>
                      <div className="text-xs text-gray-600 mb-1">Good: <span className="font-medium text-gray-900">{stageTotalGood.toLocaleString()}{stageOutputUOM && <span className="text-gray-500 ml-1">({stageOutputUOM})</span>}</span></div>
                      <div className="text-xs text-gray-600">Scrap: <span className="font-medium text-gray-900">{stageTotalScrap.toLocaleString()}{stageOutputUOM && <span className="text-gray-500 ml-1">({stageOutputUOM})</span>}</span></div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })()}
      </div>

      <div className="bg-white rounded-lg border border-gray-200">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">When</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stage</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Machine / Workcenter</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Good</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Scrap</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Unit</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Lot</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Operator</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {(() => {
                // Group runs by stage
                const groupedByStage = runs.reduce((acc: Record<string, typeof runs>, r) => {
                  const stageId = r.stageId
                  if (!acc[stageId]) acc[stageId] = []
                  acc[stageId].push(r)
                  return acc
                }, {})

                // Get stage order from workflow
                const stageOrder = stageOptions.map(s => s.id)
                const sortedStages = Object.keys(groupedByStage).sort((a, b) => {
                  const idxA = stageOrder.indexOf(a)
                  const idxB = stageOrder.indexOf(b)
                  if (idxA === -1 && idxB === -1) return 0
                  if (idxA === -1) return 1
                  if (idxB === -1) return -1
                  return idxA - idxB
                })

                const rows: JSX.Element[] = []
                
                sortedStages.forEach((stageId, stageIdx) => {
                  const stageRuns = groupedByStage[stageId]
                  const stageName = getStageName(stageId)
                  const stageOutputUOM = getStageOutputUOM(stageId)
                  const stageTotalGood = stageRuns.reduce((sum, r) => sum + (r.qtyGood || 0), 0)
                  const stageTotalScrap = stageRuns.reduce((sum, r) => sum + (r.qtyScrap || 0), 0)
                  
                  // Sort runs within stage by date (newest first)
                  const sortedRuns = stageRuns.sort((a, b) => {
                    const dateA = a.at?.seconds ? a.at.seconds * 1000 : new Date(a.at).getTime()
                    const dateB = b.at?.seconds ? b.at.seconds * 1000 : new Date(b.at).getTime()
                    return dateB - dateA
                  })

                  // Stage header row
                  rows.push(
                    <tr key={`stage-header-${stageId}`} className="bg-gray-100 border-t-2 border-gray-300">
                      <td colSpan={2} className="px-6 py-3 text-sm font-semibold text-gray-900">
                        {stageName}
                      </td>
                      <td className="px-6 py-3 text-sm font-medium text-gray-700 text-right" colSpan={1}>
                        Subtotal:
                      </td>
                      <td className="px-6 py-3 whitespace-nowrap text-sm font-semibold text-gray-900">
                        {stageTotalGood.toLocaleString()}{stageOutputUOM && <span className="text-gray-500 ml-1 text-xs">({stageOutputUOM})</span>}
                      </td>
                      <td className="px-6 py-3 whitespace-nowrap text-sm font-semibold text-gray-900">
                        {stageTotalScrap.toLocaleString()}{stageOutputUOM && <span className="text-gray-500 ml-1 text-xs">({stageOutputUOM})</span>}
                      </td>
                      <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-500">
                        {stageOutputUOM || '-'}
                      </td>
                      <td colSpan={2} className="px-6 py-3"></td>
                    </tr>
                  )

                  // Individual run rows
                  sortedRuns.forEach((r) => {
                    const runStageOutputUOM = getStageOutputUOM(r.stageId)
                    rows.push(
                      <tr key={r.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {new Date(r.at?.seconds ? r.at.seconds * 1000 : r.at).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 pl-8">
                          {/* Indented for visual hierarchy */}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {getWorkcenterName(r.workcenterId)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {r.qtyGood.toLocaleString()}{runStageOutputUOM && <span className="text-gray-500 ml-1 text-xs">({runStageOutputUOM})</span>}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {(r.qtyScrap || 0).toLocaleString()}{runStageOutputUOM && <span className="text-gray-500 ml-1 text-xs">({runStageOutputUOM})</span>}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {runStageOutputUOM || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {r.lot || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {r.operatorId}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                          {/* Future: edit/delete actions */}
                        </td>
                      </tr>
                    )
                  })
                })

                return rows.length > 0 ? rows : (
                  <tr>
                    <td colSpan={9} className="px-6 py-4 text-center text-sm text-gray-500">
                      No production runs recorded yet.
                    </td>
                  </tr>
                )
              })()}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

const PackagingTab: FC<{ job: Job }> = ({ job }) => {
  const packaging = job.packaging
  if (!packaging) {
    return (
      <div className="text-center py-8">
        <CubeIcon className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-sm font-medium text-gray-900">No packaging information</h3>
        <p className="mt-1 text-sm text-gray-500">Packaging details will appear here when configured.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-medium text-gray-900">Packaging Information</h3>
      
      {/* Packaging Rules */}
      <div>
        <h4 className="text-md font-medium text-gray-900 mb-4">Packaging Rules</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-gray-50 rounded-lg p-4">
            <label className="block text-sm font-medium text-gray-700">Pieces per Box</label>
            <p className="text-sm text-gray-900">{packaging.pcsPerBox || 'Not set'}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <label className="block text-sm font-medium text-gray-700">Boxes per Pallet</label>
            <p className="text-sm text-gray-900">{packaging.boxesPerPallet || 'Not set'}</p>
          </div>
        </div>
      </div>

      {/* Planned vs Actual */}
      <div>
        <h4 className="text-md font-medium text-gray-900 mb-4">Planned vs Actual</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Boxes */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <h5 className="text-sm font-medium text-gray-900">Boxes</h5>
              <CubeIcon className="h-5 w-5 text-gray-400" />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Planned:</span>
                <span className="font-medium">{packaging.plannedBoxes || 0}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Actual:</span>
                <span className="font-medium">{packaging.actualBoxes || 0}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-500 h-2 rounded-full"
                  style={{ 
                    width: packaging.plannedBoxes && packaging.actualBoxes 
                      ? `${Math.min((packaging.actualBoxes / packaging.plannedBoxes) * 100, 100)}%`
                      : '0%'
                  }}
                />
              </div>
            </div>
          </div>

          {/* Pallets */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <h5 className="text-sm font-medium text-gray-900">Pallets</h5>
              <TruckIcon className="h-5 w-5 text-gray-400" />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Planned:</span>
                <span className="font-medium">{packaging.plannedPallets || 0}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Actual:</span>
                <span className="font-medium">{packaging.actualPallets || 0}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-green-500 h-2 rounded-full"
                  style={{ 
                    width: packaging.plannedPallets && packaging.actualPallets 
                      ? `${Math.min((packaging.actualPallets / packaging.plannedPallets) * 100, 100)}%`
                      : '0%'
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

const TimeTab: FC<{ timelogs: TimeLog[]; onCreateTimeLog: () => void }> = ({ timelogs, onCreateTimeLog }) => {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium text-gray-900">Time Logs ({timelogs.length})</h3>
        <button
          onClick={onCreateTimeLog}
          className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700"
        >
          <PlusIcon className="h-4 w-4 mr-1" />
          Log Time
        </button>
      </div>
      <div className="space-y-3">
        {timelogs.map((log) => (
          <div key={log.id} className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center space-x-2">
                  <ClockIcon className="h-4 w-4 text-gray-400" />
                  <span className="text-sm font-medium text-gray-900">Stage: {log.stageId}</span>
                </div>
                <p className="text-sm text-gray-600 mt-1">Resource: {log.resourceId}</p>
                {log.notes && (
                  <p className="text-sm text-gray-600 mt-1">{log.notes}</p>
                )}
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-900">
                  {new Date(log.startedAt.seconds * 1000).toLocaleString()}
                </p>
                {log.stoppedAt && (
                  <p className="text-sm text-gray-500">
                    Duration: {log.durationSec ? `${Math.round(log.durationSec / 3600 * 100) / 100}h` : 'Unknown'}
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

const HistoryTab: FC<{ history: HistoryEvent[]; workflows: Workflow[] }> = ({ history, workflows }) => {
  const stageName = (id?: string | null) => {
    if (!id) return '-'
    for (const wf of workflows) {
      const s = wf.stages?.find(st => st.id === id)
      if (s) return s.name
    }
    return id
  }
  const [typeFilter, setTypeFilter] = useState<'all' | 'stage_change' | 'status_change'>('all')
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium text-gray-900">History ({history.length})</h3>
      <div className="flex items-center gap-2">
        <label className="text-sm text-gray-600">Filter:</label>
        <select
          className="rounded-md border-gray-300 text-sm"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as any)}
        >
          <option value="all">All</option>
          <option value="stage_change">Stage changes</option>
          <option value="status_change">Status changes</option>
        </select>
      </div>
      <div className="space-y-3">
        {history.filter(e => typeFilter === 'all' || e.type === typeFilter).map((event) => (
          <div key={event.id} className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center space-x-2">
                  <CalendarIcon className="h-4 w-4 text-gray-400" />
                  <span className="text-sm font-medium text-gray-900">{event.type.replace('_', ' ').toUpperCase()}</span>
                </div>
                <p className="text-sm text-gray-600 mt-1">Actor: {event.actorId}</p>
                {event.type === 'stage_change' && (
                  <p className="text-sm text-gray-800 mt-2">
                    Moved from <span className="font-medium">{stageName(event.payload?.previousStageId)}</span>
                    {' '}to{' '}
                    <span className="font-medium">{stageName(event.payload?.newStageId)}</span>
                    {event.payload?.note && (
                      <>
                        {' '}— <span className="text-gray-600">{event.payload.note}</span>
                      </>
                    )}
                  </p>
                )}
                {event.type === 'status_change' && (
                  <p className="text-sm text-gray-800 mt-2">
                    Status changed from <span className="font-medium">{event.payload?.previousStatus || 'unknown'}</span>
                    {' '}to{' '}
                    <span className="font-medium">{event.payload?.newStatus || 'unknown'}</span>
                    {event.payload?.reason && (
                      <>
                        {' '}— <span className="text-gray-600">{event.payload.reason}</span>
                      </>
                    )}
                  </p>
                )}
                {event.type !== 'stage_change' && event.type !== 'status_change' && event.payload && (
                  <div className="mt-2">
                    <pre className="text-xs text-gray-500 bg-gray-50 p-2 rounded">
                      {JSON.stringify(event.payload, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-900">
                  {new Date(event.at.seconds * 1000).toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

const FilesTab: FC<{ job: Job }> = ({ job }) => {
  const files: Array<{ name: string; url: string; type: string; size?: string }> = []

  // Add PDF file if exists
  if ((job as any).jobPdfUrl) {
    files.push({
      name: `Production Job Order - ${job.code || job.id}.pdf`,
      url: (job as any).jobPdfUrl,
      type: 'pdf',
    })
  }

  // Add QR code if exists
  if (job.qrUrl) {
    files.push({
      name: `QR Code - ${job.code || job.id}.png`,
      url: job.qrUrl,
      type: 'image',
    })
  }

  // Add barcode if exists
  if (job.barcodeUrl) {
    files.push({
      name: `Barcode - ${job.code || job.id}.png`,
      url: job.barcodeUrl,
      type: 'image',
    })
  }

  const getFileIcon = (type: string) => {
    if (type === 'pdf') {
      return <DocumentTextIcon className="h-8 w-8 text-red-500" />
    }
    return <DocumentTextIcon className="h-8 w-8 text-blue-500" />
  }

  const handleDownload = (url: string, filename: string) => {
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.target = '_blank'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  if (files.length === 0) {
    return (
      <div className="text-center py-8">
        <DocumentTextIcon className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-sm font-medium text-gray-900">No files attached</h3>
        <p className="mt-1 text-sm text-gray-500">Files and attachments will appear here.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Document Files</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {files.map((file, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors"
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                {getFileIcon(file.type)}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
                  <p className="text-xs text-gray-500">
                    {file.type.toUpperCase()} • {file.size || 'Automatically generated'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.open(file.url, '_blank')}
                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  title="View"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                </button>
                <button
                  onClick={() => handleDownload(file.url, file.name)}
                  className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                  title="Download"
                >
                  <ArrowDownTrayIcon className="h-5 w-5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// Modal Components
interface CreateTicketModalProps {
  onSubmit: (data: Omit<Ticket, 'id' | 'createdAt' | 'updatedAt'>) => void
  onClose: () => void
  isLoading: boolean
}

const CreateTicketModal: FC<CreateTicketModalProps> = ({ onSubmit, onClose, isLoading }) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    assignees: [] as string[],
    status: 'open' as const,
    dueDate: '',
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit({
      ...formData,
      dueDate: formData.dueDate ? new Date(formData.dueDate) : undefined,
      attachments: [],
    })
  }

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg p-6 max-w-md w-full">
        <h3 className="text-lg font-semibold mb-4">Create Ticket</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Title</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({...formData, title: e.target.value})}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              rows={3}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Due Date</label>
            <input
              type="date"
              value={formData.dueDate}
              onChange={(e) => setFormData({...formData, dueDate: e.target.value})}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {isLoading ? 'Creating...' : 'Create'}
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

function ConfirmDeleteConsumptionModal({ onClose, onConfirm }: { onClose: () => void; onConfirm: (restock: boolean) => void }) {
  const [restock, setRestock] = useState(true)
  return (
    <div className="fixed inset-0 z-50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-none border border-gray-200 shadow-2xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Delete consumption</h3>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-700">This will remove the record. Do you also want to add the quantity back to stock?</p>
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" className="rounded border-gray-300" checked={restock} onChange={(e) => setRestock(e.target.checked)} />
            Restock inventory
          </label>
          <div className="flex gap-3 justify-end pt-2">
            <button className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200" onClick={onClose}>Cancel</button>
            <button className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700" onClick={() => onConfirm(restock)}>Delete</button>
          </div>
        </div>
      </div>
    </div>
  )
}

interface CreateConsumptionModalProps {
  job: Job
  workspaceId: string
  onSubmit: (data: Omit<Consumption, 'id' | 'at'>) => void
  onClose: () => void
  isLoading: boolean
}

const CreateConsumptionModal: FC<CreateConsumptionModalProps> = ({ job, workspaceId, onSubmit, onClose, isLoading }) => {
  const { data: products = [] } = useQuery<ListedProduct[]>({
    queryKey: ['products', workspaceId],
    queryFn: () => listProducts(workspaceId),
    enabled: !!workspaceId,
  })
  const { data: groups = [] } = useQuery<Group[]>({
    queryKey: ['groups', workspaceId],
    queryFn: () => listGroups(workspaceId),
    enabled: !!workspaceId,
  })

  const [formData, setFormData] = useState({
    stageId: job.currentStageId,
    itemId: '',
    sku: '',
    name: '',
    qtyUsed: 0,
    uom: '',
    lot: '',
    userId: 'current-user',
  })

  const [searchTerm, setSearchTerm] = useState('')
  const [selectedGroup, setSelectedGroup] = useState<string>('')
  const [onlyInStock, setOnlyInStock] = useState<boolean>(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(formData)
  }

  const filteredProducts = products.filter(p => {
    const matchesTerm = !searchTerm || (p.name?.toLowerCase().includes(searchTerm.toLowerCase()) || p.sku?.toLowerCase().includes(searchTerm.toLowerCase()))
    const matchesGroup = !selectedGroup || (p as any).groupId === selectedGroup
    const matchesStock = !onlyInStock || (p.qtyOnHand || 0) > 0
    return matchesTerm && matchesGroup && matchesStock
  })

  const selected = products.find(p => p.id === formData.itemId)
  const remaining = selected ? (selected.qtyOnHand || 0) - (Number(formData.qtyUsed) || 0) : undefined

  return (
    <div className="fixed inset-0 z-50 backdrop-blur-sm flex items-center justify-center p-6">
      <div className="bg-white rounded-none border border-gray-200 shadow-2xl max-w-3xl w-full">
        <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
          <h3 className="text-lg font-semibold text-gray-900">Record Material Consumption</h3>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700">Item</label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by SKU or name"
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
              <select
                value={selectedGroup}
                onChange={(e) => setSelectedGroup(e.target.value)}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              >
                <option value="">All groups</option>
                {groups.map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
              <label className="inline-flex items-center text-sm text-gray-700 gap-2">
                <input type="checkbox" className="rounded border-gray-300" checked={onlyInStock} onChange={(e) => setOnlyInStock(e.target.checked)} />
                Only in stock
              </label>
            </div>
            <select
              value={formData.itemId}
              onChange={(e) => {
                const p = products.find(pr => pr.id === e.target.value)
                setFormData({
                  ...formData,
                  itemId: e.target.value,
                  sku: p?.sku || '',
                  name: p?.name || '',
                  uom: p?.uom || ''
                })
              }}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              required
            >
              <option value="">Select item…</option>
              {/* Grouped options by group */}
              {[...new Set(filteredProducts.map(p => (p as any).groupId || '__ungrouped__'))].map((gid) => {
                const groupName = gid === '__ungrouped__' ? 'Ungrouped' : (groups.find(g => g.id === gid)?.name || 'Group')
                const items = filteredProducts.filter(p => ((p as any).groupId || '__ungrouped__') === gid)
                return (
                  <optgroup key={gid} label={groupName}>
                    {items.map(p => (
                      <option key={p.id} value={p.id}>{p.sku} — {p.name} ({p.qtyOnHand ?? 0} {p.uom} on hand)</option>
                    ))}
                  </optgroup>
                )
              })}
            </select>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-1">
              <label className="block text-sm font-medium text-gray-700">Quantity Used</label>
              <input
                type="number"
                step="0.01"
                value={formData.qtyUsed}
                onChange={(e) => setFormData({...formData, qtyUsed: Number(e.target.value)})}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                required
              />
            </div>
            <div className="md:col-span-1">
              <label className="block text-sm font-medium text-gray-700">UOM</label>
              <input
                type="text"
                value={formData.uom}
                disabled
                className="mt-1 block w-full rounded-md border-gray-300 bg-gray-50 text-gray-700"
              />
            </div>
            <div className="md:col-span-1">
              <label className="block text-sm font-medium text-gray-700">On Hand → After</label>
              <div className="mt-1 text-sm text-gray-900 h-10 flex items-center">
                {selected ? (
                  <span>{selected.qtyOnHand ?? 0} → {Math.max(0, remaining || 0)} {selected.uom}</span>
                ) : (
                  <span className="text-gray-400">Select item</span>
                )}
              </div>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Lot Number</label>
            <input
              type="text"
              value={formData.lot}
              onChange={(e) => setFormData({...formData, lot: e.target.value})}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-600"
            >
              {isLoading ? 'Recording...' : 'Record'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

interface CreateTimeLogModalProps {
  job: Job
  onSubmit: (data: Omit<TimeLog, 'id'>) => void
  onClose: () => void
  isLoading: boolean
}

const CreateTimeLogModal: FC<CreateTimeLogModalProps> = ({ job, onSubmit, onClose, isLoading }) => {
  const [formData, setFormData] = useState({
    stageId: job.currentStageId,
    resourceId: 'current-user',
    startedAt: new Date(),
    notes: '',
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(formData)
  }

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg p-6 max-w-md w-full">
        <h3 className="text-lg font-semibold mb-4">Log Time</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Stage</label>
            <input
              type="text"
              value={formData.stageId}
              onChange={(e) => setFormData({...formData, stageId: e.target.value})}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Resource</label>
            <input
              type="text"
              value={formData.resourceId}
              onChange={(e) => setFormData({...formData, resourceId: e.target.value})}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Start Time</label>
            <input
              type="datetime-local"
              value={formData.startedAt.toISOString().slice(0, 16)}
              onChange={(e) => setFormData({...formData, startedAt: new Date(e.target.value)})}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({...formData, notes: e.target.value})}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              rows={3}
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
            >
              {isLoading ? 'Logging...' : 'Log Time'}
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