import { useState, type FC } from 'react'
import { 
  Job, 
  Ticket, 
  Consumption, 
  TimeLog, 
  HistoryEvent,
  listJobTickets,
  listJobConsumptions,
  listJobTimeLogs,
  listJobHistory,
  createTicket,
  createConsumption,
  createTimeLog
} from '../api/production-jobs'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { 
  XMarkIcon,
  PlusIcon,
  PlayIcon,
  PauseIcon,
  CheckCircleIcon,
  ClockIcon,
  UserGroupIcon,
  CubeIcon,
  TruckIcon,
  DocumentTextIcon,
  ChartBarIcon,
  CalendarIcon,
  ArchiveBoxIcon
} from '@heroicons/react/24/outline'

interface JobDetailProps {
  job: Job
  workspaceId: string
  onClose: () => void
}

type TabType = 'overview' | 'tickets' | 'materials' | 'consumptions' | 'output' | 'packaging' | 'time' | 'history' | 'files'

export function JobDetail({ job, workspaceId, onClose }: JobDetailProps) {
  const [activeTab, setActiveTab] = useState<TabType>('overview')
  const [showCreateTicket, setShowCreateTicket] = useState(false)
  const [showCreateConsumption, setShowCreateConsumption] = useState(false)
  const [showCreateTimeLog, setShowCreateTimeLog] = useState(false)
  const queryClient = useQueryClient()

  // Fetch related data
  const { data: tickets = [] } = useQuery({
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
    mutationFn: (input: Omit<Consumption, 'id'>) =>
      createConsumption(workspaceId, job.id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobConsumptions', workspaceId, job.id] })
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

  const tabs = [
    { id: 'overview', name: 'Overview', icon: DocumentTextIcon },
    { id: 'tickets', name: 'Tickets', icon: ArchiveBoxIcon },
    { id: 'materials', name: 'Materials (BOM)', icon: CubeIcon },
    { id: 'consumptions', name: 'Consumptions', icon: ChartBarIcon },
    { id: 'output', name: 'Output', icon: TruckIcon },
    { id: 'packaging', name: 'Packaging', icon: CubeIcon },
    { id: 'time', name: 'Time', icon: ClockIcon },
    { id: 'history', name: 'History', icon: CalendarIcon },
    { id: 'files', name: 'Files', icon: DocumentTextIcon },
  ]

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

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-6xl w-full h-5/6 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">{job.code}</h2>
            <p className="text-sm text-gray-600">{job.productName} • {job.quantity} {job.unit}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            {tabs.map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as TabType)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                    activeTab === tab.id
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

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'overview' && <OverviewTab job={job} getStatusColor={getStatusColor} getRiskColor={getRiskColor} />}
          {activeTab === 'tickets' && <TicketsTab tickets={tickets} onCreateTicket={() => setShowCreateTicket(true)} />}
          {activeTab === 'materials' && <MaterialsTab job={job} />}
          {activeTab === 'consumptions' && <ConsumptionsTab consumptions={consumptions} onCreateConsumption={() => setShowCreateConsumption(true)} />}
          {activeTab === 'output' && <OutputTab job={job} />}
          {activeTab === 'packaging' && <PackagingTab job={job} />}
          {activeTab === 'time' && <TimeTab timelogs={timelogs} onCreateTimeLog={() => setShowCreateTimeLog(true)} />}
          {activeTab === 'history' && <HistoryTab history={history} />}
          {activeTab === 'files' && <FilesTab job={job} />}
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

      {showCreateConsumption && (
        <CreateConsumptionModal
          job={job}
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
  getStatusColor: (status: string) => string
  getRiskColor: (risk?: string) => string
}

const OverviewTab: FC<OverviewTabProps> = ({ job, getStatusColor, getRiskColor }) => {
  return (
    <div className="space-y-6">
      {/* Status and Priority */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700">Status</label>
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(job.status)}`}>
            {job.status.replace('_', ' ').toUpperCase()}
          </span>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Priority</label>
          <span className="text-sm text-gray-900">Priority {job.priority}</span>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Risk Level</label>
          <span className={`text-sm font-medium ${getRiskColor(job.risk)}`}>
            {job.risk?.toUpperCase() || 'OK'}
          </span>
        </div>
      </div>

      {/* Customer Information */}
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Customer Information</h3>
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Customer Name</label>
              <p className="text-sm text-gray-900">{job.customer.name}</p>
            </div>
            {job.customer.orderNo && (
              <div>
                <label className="block text-sm font-medium text-gray-700">Order Number</label>
                <p className="text-sm text-gray-900">{job.customer.orderNo}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Dates */}
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Important Dates</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Due Date</label>
            <p className={`text-sm font-medium ${getRiskColor(job.risk)}`}>
              {new Date(job.dueDate).toLocaleDateString()}
            </p>
          </div>
          {job.plannedStart && (
            <div>
              <label className="block text-sm font-medium text-gray-700">Planned Start</label>
              <p className="text-sm text-gray-900">{new Date(job.plannedStart).toLocaleDateString()}</p>
            </div>
          )}
          {job.plannedEnd && (
            <div>
              <label className="block text-sm font-medium text-gray-700">Planned End</label>
              <p className="text-sm text-gray-900">{new Date(job.plannedEnd).toLocaleDateString()}</p>
            </div>
          )}
          {job.qaAcceptedAt && (
            <div>
              <label className="block text-sm font-medium text-gray-700">QA Accepted</label>
              <p className="text-sm text-green-600">{new Date(job.qaAcceptedAt).toLocaleDateString()}</p>
            </div>
          )}
          {job.customerAcceptedAt && (
            <div>
              <label className="block text-sm font-medium text-gray-700">Customer Accepted</label>
              <p className="text-sm text-blue-600">{new Date(job.customerAcceptedAt).toLocaleDateString()}</p>
            </div>
          )}
        </div>
      </div>

      {/* Assignees and Workcenter */}
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Assignment</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Assignees</label>
            <p className="text-sm text-gray-900">
              {job.assignees.length > 0 ? job.assignees.join(', ') : 'Unassigned'}
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Workcenter</label>
            <p className="text-sm text-gray-900">{job.workcenterId || 'Unassigned'}</p>
          </div>
        </div>
      </div>

      {/* Notes */}
      {job.notes && (
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-4">Notes</h3>
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-900">{job.notes}</p>
          </div>
        </div>
      )}

      {/* Block Reason */}
      {job.status === 'blocked' && job.blockReason && (
        <div>
          <h3 className="text-lg font-medium text-red-900 mb-4">Block Reason</h3>
          <div className="bg-red-50 rounded-lg p-4">
            <p className="text-sm text-red-900">{job.blockReason}</p>
          </div>
        </div>
      )}
    </div>
  )
}

const TicketsTab: FC<{ tickets: Ticket[]; onCreateTicket: () => void }> = ({ tickets, onCreateTicket }) => {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium text-gray-900">Tickets ({tickets.length})</h3>
        <button
          onClick={onCreateTicket}
          className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
        >
          <PlusIcon className="h-4 w-4 mr-1" />
          New Ticket
        </button>
      </div>
      <div className="space-y-3">
        {tickets.map((ticket) => (
          <div key={ticket.id} className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h4 className="text-sm font-medium text-gray-900">{ticket.title}</h4>
                {ticket.description && (
                  <p className="text-sm text-gray-600 mt-1">{ticket.description}</p>
                )}
              </div>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                ticket.status === 'open' ? 'bg-gray-100 text-gray-800' :
                ticket.status === 'in_progress' ? 'bg-yellow-100 text-yellow-800' :
                ticket.status === 'done' ? 'bg-green-100 text-green-800' :
                'bg-red-100 text-red-800'
              }`}>
                {ticket.status.replace('_', ' ').toUpperCase()}
              </span>
            </div>
            <div className="mt-2 flex items-center space-x-4 text-sm text-gray-500">
              <span>Assignees: {ticket.assignees.length}</span>
              {ticket.dueDate && (
                <span>Due: {new Date(ticket.dueDate).toLocaleDateString()}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

const MaterialsTab: FC<{ job: Job }> = ({ job }) => {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium text-gray-900">Bill of Materials</h3>
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
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {job.bom.map((item, index) => (
              <tr key={index}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{item.sku}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.name}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.qtyRequired}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.reserved}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.consumed}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.uom}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.lot || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const ConsumptionsTab: FC<{ consumptions: Consumption[]; onCreateConsumption: () => void }> = ({ consumptions, onCreateConsumption }) => {
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
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{consumption.qtyUsed}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{consumption.uom}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{consumption.lot || '-'}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{consumption.userId}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const OutputTab: FC<{ job: Job }> = ({ job }) => {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium text-gray-900">Production Output</h3>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SKU</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Planned</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Produced</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Progress</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">UOM</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Unit Definition</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Lot</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {job.output.map((item, index) => {
              const progress = item.qtyPlanned > 0 ? (item.qtyProduced / item.qtyPlanned) * 100 : 0
              return (
                <tr key={index}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{item.sku}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.qtyPlanned}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.qtyProduced}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <div className="flex items-center">
                      <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                        <div
                          className="bg-blue-500 h-2 rounded-full"
                          style={{ width: `${Math.min(progress, 100)}%` }}
                        />
                      </div>
                      <span className="text-xs">{progress.toFixed(1)}%</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.uom}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.unitDefinition || '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.lot || '-'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
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

const HistoryTab: FC<{ history: HistoryEvent[] }> = ({ history }) => {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium text-gray-900">History ({history.length})</h3>
      <div className="space-y-3">
        {history.map((event) => (
          <div key={event.id} className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center space-x-2">
                  <CalendarIcon className="h-4 w-4 text-gray-400" />
                  <span className="text-sm font-medium text-gray-900">{event.type.replace('_', ' ').toUpperCase()}</span>
                </div>
                <p className="text-sm text-gray-600 mt-1">Actor: {event.actorId}</p>
                {event.payload && (
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
  return (
    <div className="text-center py-8">
      <DocumentTextIcon className="mx-auto h-12 w-12 text-gray-400" />
      <h3 className="mt-2 text-sm font-medium text-gray-900">No files attached</h3>
      <p className="mt-1 text-sm text-gray-500">Files and attachments will appear here.</p>
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

interface CreateConsumptionModalProps {
  job: Job
  onSubmit: (data: Omit<Consumption, 'id'>) => void
  onClose: () => void
  isLoading: boolean
}

const CreateConsumptionModal: FC<CreateConsumptionModalProps> = ({ job, onSubmit, onClose, isLoading }) => {
  const [formData, setFormData] = useState({
    stageId: job.currentStageId,
    sku: '',
    name: '',
    qtyUsed: 0,
    uom: '',
    lot: '',
    userId: 'current-user',
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(formData)
  }

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg p-6 max-w-md w-full">
        <h3 className="text-lg font-semibold mb-4">Record Material Consumption</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
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
          <div>
            <label className="block text-sm font-medium text-gray-700">Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
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
            <div>
              <label className="block text-sm font-medium text-gray-700">UOM</label>
              <input
                type="text"
                value={formData.uom}
                onChange={(e) => setFormData({...formData, uom: e.target.value})}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                required
              />
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
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
            >
              {isLoading ? 'Recording...' : 'Record'}
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