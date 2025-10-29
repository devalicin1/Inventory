import { useState, type FC } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { DataTable } from '../components/DataTable'
import { ProductionBoard } from '../components/ProductionBoard'
import { JobDetail } from '../components/JobDetail'
import { ProductionReports } from '../components/ProductionReports'
import { ProductionCalendar } from '../components/ProductionCalendar'
import { ProductionSettings } from '../components/ProductionSettings'
import { 
  Job, 
  listJobs, 
  listWorkflows, 
  listWorkcenters, 
  listResources,
  createJob,
  setJobStatus
} from '../api/production-jobs'
import { toCSV, downloadCSV } from '../utils/csv'
import { 
  PlusIcon, 
  ArrowDownTrayIcon,
  Squares2X2Icon,
  ViewColumnsIcon,
  CalendarIcon,
  ChartBarIcon,
  CogIcon
} from '@heroicons/react/24/outline'

export function Production() {
  const [view, setView] = useState<'board' | 'list' | 'calendar' | 'reports' | 'settings'>('board')
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [filters, setFilters] = useState({
    status: [] as string[],
    stageId: '',
    workcenterId: '',
    assigneeId: '',
    priority: [] as number[],
    customerId: '',
    dueBefore: undefined as Date | undefined,
  })
  const queryClient = useQueryClient()

  // Mock workspace ID - in real app, get from context
  const workspaceId = 'demo-workspace'

  // Fetch data
  const { data: jobsData, isLoading: jobsLoading } = useQuery({
    queryKey: ['jobs', workspaceId, filters],
    queryFn: () => listJobs(workspaceId, filters),
  })

  const { data: workflows = [] } = useQuery({
    queryKey: ['workflows', workspaceId],
    queryFn: () => listWorkflows(workspaceId),
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

  // Mutations
  const createJobMutation = useMutation({
    mutationFn: (input: any) => createJob(workspaceId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs', workspaceId] })
      setShowCreateForm(false)
    },
  })

  const statusMutation = useMutation({
    mutationFn: ({ jobId, status, blockReason }: { jobId: string; status: Job['status']; blockReason?: string }) =>
      setJobStatus(workspaceId, jobId, status, blockReason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs', workspaceId] })
    },
  })

  const handleCreateJob = async (data: any) => {
    await createJobMutation.mutateAsync(data)
  }

  const handleStatusChange = (jobId: string, status: Job['status'], blockReason?: string) => {
    statusMutation.mutate({ jobId, status, blockReason })
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-gray-100 text-gray-800'
      case 'released': return 'bg-blue-100 text-blue-800'
      case 'in_progress': return 'bg-yellow-100 text-yellow-800'
      case 'blocked': return 'bg-red-100 text-red-800'
      case 'done': return 'bg-green-100 text-green-800'
      case 'cancelled': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getRiskColor = (risk?: string) => {
    switch (risk) {
      case 'overdue': return 'text-red-600'
      case 'warning': return 'text-yellow-600'
      default: return 'text-green-600'
    }
  }

  const getPriorityColor = (priority: number) => {
    switch (priority) {
      case 1: return 'bg-red-100 text-red-800'
      case 2: return 'bg-orange-100 text-orange-800'
      case 3: return 'bg-yellow-100 text-yellow-800'
      case 4: return 'bg-blue-100 text-blue-800'
      case 5: return 'bg-green-100 text-green-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const listColumns = [
    { key: 'code' as keyof Job, label: 'Job Code' },
    { key: 'sku' as keyof Job, label: 'SKU' },
    { 
      key: 'customer' as keyof Job, 
      label: 'Customer',
      render: (value: any) => value?.name || '-'
    },
    { 
      key: 'assignees' as keyof Job, 
      label: 'Assignees',
      render: (value: string[]) => value.length > 0 ? value.join(', ') : 'Unassigned'
    },
    { key: 'currentStageId' as keyof Job, label: 'Stage' },
    { 
      key: 'dueDate' as keyof Job, 
      label: 'Due Date',
      render: (value: Date) => new Date(value).toLocaleDateString()
    },
    { key: 'quantity' as keyof Job, label: 'Qty' },
    { 
      key: 'bom' as keyof Job, 
      label: 'Materials',
      render: (value: any[]) => {
        const totalConsumed = value.reduce((sum, item) => sum + item.consumed, 0)
        const totalRequired = value.reduce((sum, item) => sum + item.qtyRequired, 0)
        return `${totalConsumed}/${totalRequired}`
      }
    },
    { 
      key: 'output' as keyof Job, 
      label: 'Output',
      render: (value: any[]) => {
        const totalProduced = value.reduce((sum, item) => sum + item.qtyProduced, 0)
        const totalPlanned = value.reduce((sum, item) => sum + item.qtyPlanned, 0)
        return `${totalProduced}/${totalPlanned}`
      }
    },
    { 
      key: 'packaging' as keyof Job, 
      label: 'Pallets',
      render: (value: any) => {
        if (!value) return '-'
        return `${value.actualPallets || 0}/${value.plannedPallets || 0}`
      }
    },
    { 
      key: 'qaAcceptedAt' as keyof Job, 
      label: 'QA Accepted',
      render: (value: Date) => value ? new Date(value).toLocaleDateString() : '-'
    },
    { 
      key: 'customerAcceptedAt' as keyof Job, 
      label: 'Customer Accepted',
      render: (value: Date) => value ? new Date(value).toLocaleDateString() : '-'
    },
    { 
      key: 'status' as keyof Job, 
      label: 'Status',
      render: (value: string) => (
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(value)}`}>
          {value.replace('_', ' ').toUpperCase()}
        </span>
      )
    },
  ]

  if (jobsLoading) {
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
              Production Management
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Manage manufacturing workflows, track progress, and coordinate production
            </p>
          </div>
          <div className="mt-4 md:mt-0 flex gap-2">
            <button
              onClick={() => downloadCSV('production_jobs.csv', toCSV(jobs))}
              className="inline-flex items-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-200 hover:bg-gray-50"
            >
              <ArrowDownTrayIcon className="-ml-0.5 mr-1.5 h-5 w-5 text-gray-400" />
              Export CSV
            </button>
            <button
              onClick={() => setShowCreateForm(true)}
              className="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              <PlusIcon className="-ml-0.5 mr-1.5 h-5 w-5" />
              Create Job
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="flex space-x-8">
            {[
              { id: 'board', name: 'Board', icon: Squares2X2Icon },
              { id: 'list', name: 'List', icon: ViewColumnsIcon },
              { id: 'calendar', name: 'Calendar', icon: CalendarIcon },
              { id: 'reports', name: 'Reports', icon: ChartBarIcon },
              { id: 'settings', name: 'Settings', icon: CogIcon },
            ].map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setView(tab.id as any)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                    view === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{tab.name}</span>
                </button>
              )
            })}
          </nav>
        </div>

        {/* Filters */}
        <div className="mb-6 bg-gray-50 rounded-lg p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                multiple
                value={filters.status}
                onChange={(e) => setFilters({...filters, status: Array.from(e.target.selectedOptions, option => option.value)})}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              >
                <option value="draft">Draft</option>
                <option value="released">Released</option>
                <option value="in_progress">In Progress</option>
                <option value="blocked">Blocked</option>
                <option value="done">Done</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Workcenter</label>
              <select
                value={filters.workcenterId}
                onChange={(e) => setFilters({...filters, workcenterId: e.target.value})}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              >
                <option value="">All Workcenters</option>
                {workcenters.map(wc => (
                  <option key={wc.id} value={wc.id}>{wc.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Assignee</label>
              <select
                value={filters.assigneeId}
                onChange={(e) => setFilters({...filters, assigneeId: e.target.value})}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              >
                <option value="">All Assignees</option>
                {resources.map(resource => (
                  <option key={resource.id} value={resource.id}>{resource.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Due Before</label>
              <input
                type="date"
                value={filters.dueBefore ? filters.dueBefore.toISOString().split('T')[0] : ''}
                onChange={(e) => setFilters({...filters, dueBefore: e.target.value ? new Date(e.target.value) : undefined})}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
            <h3 className="text-sm font-medium text-gray-500">Total Jobs</h3>
            <p className="text-2xl font-semibold text-gray-900">{jobs.length}</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
            <h3 className="text-sm font-medium text-gray-500">In Progress</h3>
            <p className="text-2xl font-semibold text-yellow-600">
              {jobs.filter(job => job.status === 'in_progress').length}
            </p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
            <h3 className="text-sm font-medium text-gray-500">Blocked</h3>
            <p className="text-2xl font-semibold text-red-600">
              {jobs.filter(job => job.status === 'blocked').length}
            </p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
            <h3 className="text-sm font-medium text-gray-500">Completed</h3>
            <p className="text-2xl font-semibold text-green-600">
              {jobs.filter(job => job.status === 'done').length}
            </p>
          </div>
        </div>

        {/* Main Content */}
        {view === 'board' && (
          <div className="bg-white rounded-lg border border-gray-100 shadow-sm h-96">
            <ProductionBoard
              workspaceId={workspaceId}
              onJobClick={setSelectedJob}
            />
          </div>
        )}

        {view === 'list' && (
          <div className="bg-white rounded-lg border border-gray-100 shadow-sm">
            <DataTable
              data={jobs}
              columns={listColumns}
              onRowClick={setSelectedJob}
            />
          </div>
        )}

        {view === 'calendar' && (
          <ProductionCalendar workspaceId={workspaceId} />
        )}

        {view === 'reports' && (
          <ProductionReports workspaceId={workspaceId} />
        )}

        {view === 'settings' && (
          <ProductionSettings workspaceId={workspaceId} />
        )}

        {/* Modals */}
        {showCreateForm && (
          <CreateJobForm
            onSubmit={handleCreateJob}
            onClose={() => setShowCreateForm(false)}
            isLoading={createJobMutation.isPending}
            workflows={workflows}
            workcenters={workcenters}
            resources={resources}
          />
        )}

        {selectedJob && (
          <JobDetail
            job={selectedJob}
            workspaceId={workspaceId}
            onClose={() => setSelectedJob(null)}
          />
        )}
      </div>
    </div>
  )
}

type CreateJobFormProps = {
  onSubmit: (data: any) => void
  onClose: () => void
  isLoading: boolean
  workflows: any[]
  workcenters: any[]
  resources: any[]
}

const CreateJobForm: FC<CreateJobFormProps> = ({ onSubmit, onClose, isLoading, workflows, workcenters, resources }) => {
  const [formData, setFormData] = useState({
    code: '',
    sku: '',
    productName: '',
    quantity: 0,
    unit: 'pcs',
    priority: 3,
    workflowId: workflows[0]?.id || '',
    currentStageId: workflows[0]?.stages?.[0]?.id || '',
    status: 'draft' as const,
    assignees: [] as string[],
    workcenterId: '',
    plannedStart: '',
    plannedEnd: '',
    dueDate: '',
    customer: { id: '', name: '', orderNo: '' },
    notes: '',
    bom: [] as any[],
    output: [] as any[],
    packaging: {} as any,
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit({
      ...formData,
      plannedStart: formData.plannedStart ? new Date(formData.plannedStart) : undefined,
      plannedEnd: formData.plannedEnd ? new Date(formData.plannedEnd) : undefined,
      dueDate: new Date(formData.dueDate),
    })
  }

  const selectedWorkflow = workflows.find(w => w.id === formData.workflowId)

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-96 overflow-y-auto">
        <h3 className="text-lg font-semibold mb-4">Create Production Job</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Job Code</label>
              <input
                type="text"
                value={formData.code}
                onChange={(e) => setFormData({...formData, code: e.target.value})}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">SKU</label>
              <input
                type="text"
                value={formData.sku}
                onChange={(e) => setFormData({...formData, sku: e.target.value})}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Product Name</label>
              <input
                type="text"
                value={formData.productName}
                onChange={(e) => setFormData({...formData, productName: e.target.value})}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Quantity</label>
              <input
                type="number"
                value={formData.quantity}
                onChange={(e) => setFormData({...formData, quantity: Number(e.target.value)})}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Unit</label>
              <select
                value={formData.unit}
                onChange={(e) => setFormData({...formData, unit: e.target.value})}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              >
                <option value="pcs">Pieces</option>
                <option value="kg">Kilograms</option>
                <option value="m">Meters</option>
                <option value="L">Liters</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Priority</label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData({...formData, priority: Number(e.target.value)})}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              >
                <option value={1}>1 - Critical</option>
                <option value={2}>2 - High</option>
                <option value={3}>3 - Medium</option>
                <option value={4}>4 - Low</option>
                <option value={5}>5 - Very Low</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Due Date</label>
              <input
                type="date"
                value={formData.dueDate}
                onChange={(e) => setFormData({...formData, dueDate: e.target.value})}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Workflow</label>
              <select
                value={formData.workflowId}
                onChange={(e) => setFormData({...formData, workflowId: e.target.value, currentStageId: workflows.find(w => w.id === e.target.value)?.stages?.[0]?.id || ''})}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                required
              >
                {workflows.map(workflow => (
                  <option key={workflow.id} value={workflow.id}>{workflow.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Workcenter</label>
              <select
                value={formData.workcenterId}
                onChange={(e) => setFormData({...formData, workcenterId: e.target.value})}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              >
                <option value="">Select Workcenter</option>
                {workcenters.map(wc => (
                  <option key={wc.id} value={wc.id}>{wc.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Customer</label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-1">
              <input
                type="text"
                placeholder="Customer Name"
                value={formData.customer.name}
                onChange={(e) => setFormData({...formData, customer: {...formData.customer, name: e.target.value}})}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                required
              />
              <input
                type="text"
                placeholder="Order Number (optional)"
                value={formData.customer.orderNo}
                onChange={(e) => setFormData({...formData, customer: {...formData.customer, orderNo: e.target.value}})}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
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
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {isLoading ? 'Creating...' : 'Create Job'}
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
