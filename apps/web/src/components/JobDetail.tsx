import { useState, useEffect, type FC } from 'react'
import {
  type Job,
  type Ticket,
  type Consumption,
  getJob,
  listJobTickets,
  listJobConsumptions,
  listJobHistory,
  createTicket,
  createConsumption,
  listJobProductionRuns
} from '../api/production-jobs'
import { listProducts, type ListedProduct } from '../api/inventory'
import { ConfirmInventoryPostingModal } from './ConfirmInventoryPostingModal'
import { PrintFormModal } from './PrintFormModal'
import { JobCreatePrintFormModal } from './JobCreatePrintFormModal'
import { DeliveryNoteModal } from './DeliveryNoteModal'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listWorkflows, setJobStatus } from '../api/production-jobs'
import { listGroups, type Group } from '../api/products'
import {
  XMarkIcon,
  ClockIcon,
  CubeIcon,
  TruckIcon,
  DocumentTextIcon,
  ChartBarIcon,
  CalendarIcon,
  ArchiveBoxIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  QrCodeIcon
} from '@heroicons/react/24/outline'
import { JobDetailHeader, JobDetailTabs } from './job-detail'
import {
  OverviewTab,
  TicketsTab,
  MaterialsTab,
  ConsumptionsTab,
  OutputTab,
  PackagingTab,
  HistoryTab,
  FilesTab,
  QRCodeTab
} from './job-detail/tabs'

interface JobDetailProps {
  job: Job
  workspaceId: string
  onClose: () => void
  onDelete?: (jobId: string) => void
  workcenters?: Array<{ id: string; name: string }>
  resources?: Array<{ id: string; name: string }>
}

type TabType = 'overview' | 'tickets' | 'materials' | 'consumptions' | 'output' | 'packaging' | 'qrcode' | 'history' | 'files'

export function JobDetail({ job, workspaceId, onClose, onDelete, workcenters = [], resources = [] }: JobDetailProps) {
  const [activeTab, setActiveTab] = useState<TabType>('overview')
  const [showCreateTicket, setShowCreateTicket] = useState(false)
  const [showCreateConsumption, setShowCreateConsumption] = useState(false)
  const queryClient = useQueryClient()
  const [showPrintForm, setShowPrintForm] = useState(false)
  const [showCreatePrintForm, setShowCreatePrintForm] = useState(false)
  const [showCompleteModal, setShowCompleteModal] = useState(false)
  const [showPostToInventoryPrompt, setShowPostToInventoryPrompt] = useState(false)
  const [showDeliveryNoteModal, setShowDeliveryNoteModal] = useState(false)
  const [showExportMenu, setShowExportMenu] = useState(false)
  // Inventory products for modal
  const { data: products = [] } = useQuery<ListedProduct[]>({
    queryKey: ['products', workspaceId],
    queryFn: () => listProducts(workspaceId),
  })

  const handleCompleteJob = async (postToInventory: boolean) => {
    if (postToInventory) {
      // Show inventory posting modal
      setShowCompleteModal(true)
      setShowPostToInventoryPrompt(false)
    } else {
      // Complete job without posting to inventory
      await setJobStatus(workspaceId, job.id, 'done')
      setShowPostToInventoryPrompt(false)
      queryClient.invalidateQueries({ queryKey: ['job', workspaceId, job.id] })
      queryClient.invalidateQueries({ queryKey: ['jobs', workspaceId] })
    }
  }

  // Keep job fresh so stage changes reflect immediately after confirm
  const { data: jobFresh } = useQuery({
    queryKey: ['job', workspaceId, job.id],
    queryFn: () => getJob(workspaceId, job.id),
    initialData: job,
  })
  const effectiveJob = (jobFresh || job) as Job

  // Close export menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (showExportMenu && !target.closest('.export-menu-container')) {
        setShowExportMenu(false)
      }
    }
    if (showExportMenu) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showExportMenu])

  // Fetch related data
  const { data: tickets = [], isLoading: ticketsLoading } = useQuery({
    queryKey: ['jobTickets', workspaceId, job.id],
    queryFn: () => listJobTickets(workspaceId, job.id),
  })

  const { data: consumptions = [] } = useQuery({
    queryKey: ['jobConsumptions', workspaceId, job.id],
    queryFn: () => listJobConsumptions(workspaceId, job.id),
  })

  const { data: history = [] } = useQuery({
    queryKey: ['jobHistory', workspaceId, job.id],
    queryFn: () => listJobHistory(workspaceId, job.id),
  })

  const { data: workflows = [] } = useQuery({
    queryKey: ['workflows', workspaceId],
    queryFn: () => listWorkflows(workspaceId),
  })

  // Fetch production runs for threshold calculation in timeline
  const { data: allRuns = [] } = useQuery({
    queryKey: ['jobRuns', workspaceId, job.id],
    queryFn: () => listJobProductionRuns(workspaceId, job.id),
    enabled: !!workspaceId && !!job.id,
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
    { id: 'qrcode', name: 'QR Code', icon: QrCodeIcon, count: job.qrUrl ? 1 : 0 },
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

  const renderActiveTab = () => {
    if (activeTab === 'overview') {
  return (
        <OverviewTab
          job={effectiveJob}
          getRiskColor={getRiskColor}
          getPriorityColor={getPriorityColor}
          workcenters={workcenters}
          resources={resources}
          workflows={workflows}
          history={history}
          workspaceId={workspaceId}
          allRuns={allRuns}
        />
      )
    }

    if (activeTab === 'tickets') {
      return (
        <TicketsTab
          tickets={tickets}
          isLoading={ticketsLoading}
          onCreateTicket={() => setShowCreateTicket(true)}
        />
      )
    }

    if (activeTab === 'materials') {
      return <MaterialsTab job={effectiveJob} workspaceId={workspaceId} />
    }

    if (activeTab === 'consumptions') {
      return (
        <ConsumptionsTab
          consumptions={consumptions}
          onCreateConsumption={() => setShowCreateConsumption(true)}
          workspaceId={workspaceId}
          jobId={job.id}
        />
      )
    }

    if (activeTab === 'output') {
      return (
        <OutputTab
          job={effectiveJob}
          workspaceId={workspaceId}
          workcenters={workcenters}
          workflows={workflows}
        />
      )
    }

    if (activeTab === 'packaging') {
      return (
        <PackagingTab
          job={effectiveJob}
          workspaceId={workspaceId}
          workflows={workflows}
          allRuns={allRuns}
        />
      )
    }

    if (activeTab === 'history') {
      return (
        <HistoryTab
          history={history}
          workflows={workflows}
        />
      )
    }

    if (activeTab === 'qrcode') {
      return (
        <QRCodeTab
          job={effectiveJob}
          workspaceId={workspaceId}
        />
      )
    }

    if (activeTab === 'files') {
      return <FilesTab job={effectiveJob} />
    }

    return null
  }

  return (
    <>
      <div className="fixed inset-0 z-50 backdrop-blur-sm flex items-center justify-center p-0 sm:p-4">
        <div className="bg-white sm:rounded-xl w-full h-full sm:h-[90vh] max-w-7xl flex flex-col shadow-2xl border border-gray-200">
        <JobDetailHeader
          job={job}
          effectiveJob={effectiveJob}
          workflows={workflows}
          allRuns={allRuns}
          showExportMenu={showExportMenu}
          showPostToInventoryPrompt={showPostToInventoryPrompt}
          onClose={onClose}
          onDelete={onDelete}
          setShowExportMenu={setShowExportMenu}
          setShowPrintForm={setShowPrintForm}
          setShowCreatePrintForm={setShowCreatePrintForm}
          setShowDeliveryNoteModal={setShowDeliveryNoteModal}
          setShowCompleteModal={setShowCompleteModal}
          setShowPostToInventoryPrompt={setShowPostToInventoryPrompt}
          setStatusMutation={setStatusMutation}
          handleCompleteJob={handleCompleteJob}
          getStatusColor={getStatusColor}
          getStatusIcon={getStatusIcon}
        />

        {showCompleteModal && (
          <ConfirmInventoryPostingModal
            job={effectiveJob}
            workspaceId={workspaceId}
            products={products}
            onClose={() => {
              setShowCompleteModal(false)
            }}
            onSuccess={async () => {
              // Complete the job after successful inventory posting
              await setJobStatus(workspaceId, effectiveJob.id, 'done')
              queryClient.invalidateQueries({ queryKey: ['job', workspaceId, effectiveJob.id] })
              queryClient.invalidateQueries({ queryKey: ['jobs', workspaceId] })
            }}
          />
        )}

        <JobDetailTabs
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={(tabId) => setActiveTab(tabId as TabType)}
          content={renderActiveTab()}
        />
          </div>
        </div>

        {showCreateTicket && (
          <CreateTicketModal
            onSubmit={(data) => createTicketMutation.mutate(data)}
            onClose={() => setShowCreateTicket(false)}
            isLoading={createTicketMutation.isPending}
          />
        )}

        {showDeliveryNoteModal && (
          <DeliveryNoteModal
            job={effectiveJob}
            onClose={() => setShowDeliveryNoteModal(false)}
            productionRuns={allRuns}
            workflows={workflows}
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
    </>
  )
}

// All tab components moved to ./job-detail/tabs/

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
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              required
            />
      </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              rows={3}
            />
                  </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Due Date</label>
                    <input
              type="date"
              value={formData.dueDate}
              onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
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

// All tab components moved to ./job-detail/tabs/

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
                onChange={(e) => setFormData({ ...formData, qtyUsed: Number(e.target.value) })}
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
              onChange={(e) => setFormData({ ...formData, lot: e.target.value })}
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
