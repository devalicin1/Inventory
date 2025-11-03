import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { DataTable } from '../components/DataTable'
import { ProductionBoard } from '../components/ProductionBoard'
import { JobDetail } from '../components/JobDetail'
import { CreateJobForm } from '../components/CreateJobForm'
import { 
  type Job, 
  listJobs, 
  listWorkflows, 
  listWorkcenters, 
  listResources,
  createJob,
  moveJobToStage,
  setJobStatus,
  deleteJob,
  createProductionRun
} from '../api/production-jobs'
import { toCSV, downloadCSV } from '../utils/csv'
import { generateJobPDFBlob, downloadJobPDF } from '../utils/pdfGenerator'
import { storage } from '../lib/firebase'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { updateDoc, doc, serverTimestamp } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { 
  PlusIcon, 
  ArrowDownTrayIcon,
  Squares2X2Icon,
  ViewColumnsIcon,
  XMarkIcon,
  CheckIcon,
  TrashIcon,
  FunnelIcon,
  ArrowsPointingOutIcon,
  ArrowsPointingInIcon,
  MagnifyingGlassIcon,
  Cog6ToothIcon,
  ChartBarIcon,
  CalendarIcon,
  ClockIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline'

// Helper function to check if date is in current week
function isThisWeek(date: Date): boolean {
  const now = new Date()
  const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()))
  const endOfWeek = new Date(now.setDate(now.getDate() + 6))
  return date >= startOfWeek && date <= endOfWeek
}

// Confirm Move Modal Component
function ConfirmMoveModal({ 
  job, 
  targetStageName, 
  workcenters,
  onCancel, 
  onConfirm,
  onCreateRun
}: { 
  job: Job; 
  targetStageName: string; 
  workcenters: Array<{ id: string; name: string }>;
  onCancel: () => void; 
  onConfirm: (note?: string) => void;
  onCreateRun: (payload: { qtyGood: number; qtyScrap?: number; lot?: string; workcenterId?: string }) => Promise<void>
}) {
  const [note, setNote] = useState('')
  const [qtyGood, setQtyGood] = useState<number>(0)
  const [qtyScrap, setQtyScrap] = useState<number>(0)
  const [lot, setLot] = useState('')
  const [workcenterId, setWorkcenterId] = useState<string | undefined>(job.workcenterId)
  const requireOutput = ((job as any).requireOutputToAdvance !== false)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 rounded-t-2xl">
          <h3 className="text-lg font-semibold text-gray-900">Confirm Stage Change</h3>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-700">
            Move <span className="font-medium text-blue-600">{job.code}</span> to <span className="font-medium text-green-600">{targetStageName}</span>?
          </p>
          {requireOutput && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-xs text-blue-800 mb-2">Output required before advancing. Enter production for current stage.</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-gray-700">Good Qty</label>
                  <input type="number" min={0} value={qtyGood} onChange={(e) => setQtyGood(Number(e.target.value))} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700">Scrap Qty</label>
                  <input type="number" min={0} value={qtyScrap} onChange={(e) => setQtyScrap(Number(e.target.value))} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-700">Lot</label>
                  <input type="text" value={lot} onChange={(e) => setLot(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-700">Workcenter</label>
                  <select value={workcenterId || ''} onChange={(e) => setWorkcenterId(e.target.value || undefined)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500">
                    <option value="">Unspecified</option>
                    {workcenters.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                </div>
              </div>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Note (optional)
            </label>
            <textarea
              className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 transition-colors py-2 px-3 border"
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add a reason or note for this move..."
            />
          </div>
        </div>
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-2xl flex justify-end gap-3">
          <button 
            onClick={onCancel}
            className="px-4 py-2 rounded-lg bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors font-medium"
          >
            Cancel
          </button>
          <button 
            onClick={async () => {
              if (requireOutput) {
                if (qtyGood <= 0) { alert('Please enter Good Qty to proceed.'); return }
                await onCreateRun({ qtyGood, qtyScrap, lot: lot || undefined, workcenterId })
              }
              onConfirm(note || undefined)
            }}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors font-medium"
          >
            Confirm Move
          </button>
        </div>
      </div>
    </div>
  )
}

function ConfirmCompleteModal({
  job,
  workcenters,
  onCancel,
  onCreateRun,
  onConfirm
}: {
  job: Job;
  workcenters: Array<{ id: string; name: string }>;
  onCancel: () => void;
  onCreateRun: (payload: { qtyGood: number; qtyScrap?: number; lot?: string; workcenterId?: string }) => Promise<void>;
  onConfirm: () => void;
}) {
  const requireOutput = ((job as any).requireOutputToAdvance !== false)
  const [qtyGood, setQtyGood] = useState<number>(0)
  const [qtyScrap, setQtyScrap] = useState<number>(0)
  const [lot, setLot] = useState('')
  const [workcenterId, setWorkcenterId] = useState<string | undefined>(job.workcenterId)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 rounded-t-2xl">
          <h3 className="text-lg font-semibold text-gray-900">Complete Job</h3>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-700">Mark <span className="font-medium text-blue-600">{job.code}</span> as <span className="font-medium text-green-600">DONE</span>?</p>
          {requireOutput && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-xs text-blue-800 mb-2">Output required before completion. Enter final production for current stage.</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-gray-700">Good Qty</label>
                  <input type="number" min={0} value={qtyGood} onChange={(e) => setQtyGood(Number(e.target.value))} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700">Scrap Qty</label>
                  <input type="number" min={0} value={qtyScrap} onChange={(e) => setQtyScrap(Number(e.target.value))} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-700">Lot</label>
                  <input type="text" value={lot} onChange={(e) => setLot(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-700">Workcenter</label>
                  <select value={workcenterId || ''} onChange={(e) => setWorkcenterId(e.target.value || undefined)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500">
                    <option value="">Unspecified</option>
                    {workcenters.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-2xl flex justify-end gap-3">
          <button onClick={onCancel} className="px-4 py-2 rounded-lg bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors font-medium">Cancel</button>
          <button
            onClick={async () => {
              if (requireOutput) {
                if (qtyGood <= 0) { alert('Please enter Good Qty to complete.'); return }
                await onCreateRun({ qtyGood, qtyScrap, lot: lot || undefined, workcenterId })
              }
              onConfirm()
            }}
            className="px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors font-medium"
          >
            Confirm Complete
          </button>
        </div>
      </div>
    </div>
  )
}

function RequireReleaseModal({
  targetStageName,
  onCancel,
  onRelease
}: {
  targetStageName: string;
  onCancel: () => void;
  onRelease: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 rounded-t-2xl">
          <h3 className="text-lg font-semibold text-gray-900">Release Required</h3>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-700">This job is not in <span className="font-semibold">Released</span> status. Please release it before moving to <span className="font-semibold">{targetStageName}</span>.</p>
        </div>
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-2xl flex justify-end gap-3">
          <button onClick={onCancel} className="px-4 py-2 rounded-lg bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors font-medium">Cancel</button>
          <button onClick={onRelease} className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors font-medium">Release Job</button>
        </div>
      </div>
    </div>
  )
}

// Main Production Component
export function Production() {
  const [view, setView] = useState<'board' | 'list'>('board')
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [fitToScreen, setFitToScreen] = useState(false)
  const [zoom, setZoom] = useState<number>(() => {
    try {
      const v = window.localStorage.getItem('boardZoom')
      return v ? Number(v) : 1
    } catch { return 1 }
  })
  const boardRef = (typeof window !== 'undefined') ? (window as any)._prodBoardRef || { current: null } : { current: null }
  if ((window as any) && !(window as any)._prodBoardRef) { (window as any)._prodBoardRef = boardRef }
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [initialJobForCreate, setInitialJobForCreate] = useState<Job | null>(null)
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
  const [searchQuery, setSearchQuery] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const queryClient = useQueryClient()

  // Mock workspace ID - in real app, get from context
  const workspaceId = 'demo-workspace'

  // Fetch data
  const { data: jobsData, isLoading: jobsLoading, error: jobsError } = useQuery({
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

  // Enhanced filtering with search
  const filteredJobs = jobs.filter(job => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      const matchesSearch = 
        job.code.toLowerCase().includes(query) ||
        job.productName.toLowerCase().includes(query) ||
        job.customer.name.toLowerCase().includes(query) ||
        job.sku.toLowerCase().includes(query)
      if (!matchesSearch) return false
    }
    return true
  })

  // Open job if ?jobId= is present
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search)
      const jId = params.get('jobId')
      if (jId && jobs.length > 0) {
        const match = jobs.find(j => j.id === jId)
        if (match) setSelectedJob(match)
      }
    } catch {}
  }, [jobs])

  // Fullscreen API handlers
  useEffect(() => {
    const handler = () => setIsFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', handler)
    return () => document.removeEventListener('fullscreenchange', handler)
  }, [])

  const toggleFullscreen = () => {
    const el = (boardRef as any).current as HTMLElement | null
    if (!document.fullscreenElement) {
      if (el && el.requestFullscreen) el.requestFullscreen()
      else document.documentElement.requestFullscreen?.()
    } else {
      document.exitFullscreen?.()
    }
  }

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
    onSuccess: (_data, variables) => {
      // Refresh both the board list and the specific job detail so Workflow Path updates immediately
      queryClient.invalidateQueries({ queryKey: ['jobs', workspaceId] })
      if (variables?.jobId) {
        queryClient.invalidateQueries({ queryKey: ['job', workspaceId, variables.jobId] })
      }
    },
  })

  const moveJobMutation = useMutation({
    mutationFn: ({ jobId, newStageId, note }: { jobId: string; newStageId: string; note?: string }) =>
      moveJobToStage(workspaceId, jobId, newStageId, 'current-user', note),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs', workspaceId] })
    },
    onError: (err: any) => {
      alert(err?.message || 'Move failed')
    }
  })

  const deleteJobMutation = useMutation({
    mutationFn: (jobId: string) => deleteJob(workspaceId, jobId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs', workspaceId] })
      setSelectedJob(null)
    },
  })

  const handleCreateJob = async (data: any) => {
    const createdJob = await createJobMutation.mutateAsync(data)
    
    // Generate, upload and download PDF after successful job creation
    try {
      // Generate PDF blob
      const pdfBlob = await generateJobPDFBlob(createdJob)
      
      // Upload to Firebase Storage
      const timestamp = new Date().toISOString().split('T')[0]
      const filename = `production_job_${createdJob.code || createdJob.id}_${timestamp}.pdf`
      const pdfRef = ref(storage, `workspaces/${workspaceId}/jobs/${createdJob.id}/files/${filename}`)
      
      await uploadBytes(pdfRef, pdfBlob, { contentType: 'application/pdf' })
      const pdfUrl = await getDownloadURL(pdfRef)
      
      // Update job with PDF URL in Firestore
      await updateDoc(doc(db, 'workspaces', workspaceId, 'jobs', createdJob.id), {
        jobPdfUrl: pdfUrl,
        updatedAt: serverTimestamp(),
      })
      
      // Invalidate queries to refresh job data
      queryClient.invalidateQueries({ queryKey: ['job', workspaceId, createdJob.id] })
      queryClient.invalidateQueries({ queryKey: ['jobs', workspaceId] })
      
      // Download locally
      await downloadJobPDF(createdJob)
    } catch (error) {
      console.error('PDF generation/upload failed:', error)
      // Don't block the success flow if PDF generation fails
      alert('Job created successfully, but PDF generation/upload failed. You can generate it later.')
    }
  }

  const handleStatusChange = (jobId: string, status: Job['status'], blockReason?: string) => {
    statusMutation.mutate({ jobId, status, blockReason })
  }

  const handleDeleteJob = (jobId: string) => {
    if (confirm('Are you sure you want to delete this job? This action cannot be undone.')) {
      deleteJobMutation.mutate(jobId)
    }
  }

  const clearFilters = () => {
    setFilters({
      status: [],
      stageId: '',
      workcenterId: '',
      assigneeId: '',
      priority: [],
      customerId: '',
      dueBefore: undefined,
    })
    setSearchQuery('')
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
      case 'done': return <CheckIcon className="h-4 w-4" />
      case 'cancelled': return <XMarkIcon className="h-4 w-4" />
      default: return <Cog6ToothIcon className="h-4 w-4" />
    }
  }

  // Helper function to format dates
  const formatDate = (value: any) => {
    if (!value) return '-'
    try {
      if (value.seconds) {
        return new Date(value.seconds * 1000).toLocaleDateString()
      }
      return new Date(value).toLocaleDateString()
    } catch {
      return 'Invalid Date'
    }
  }

  // Helper function to get stage name
  const getStageName = (stageId: string) => {
    if (!stageId) return '-'
    for (const workflow of workflows) {
      const stage = workflow.stages?.find(s => s.id === stageId)
      if (stage) return stage.name
    }
    return stageId
  }

  // Helper function to get assignee names
  const getAssigneeNames = (assigneeIds: string[]) => {
    if (assigneeIds.length === 0) return 'Unassigned'
    return assigneeIds.map(id => {
      const resource = resources.find(r => r.id === id)
      return resource?.name || id
    }).join(', ')
  }

  const listColumns = [
    { key: 'code' as keyof Job, label: 'Job Code', sortable: true },
    { key: 'sku' as keyof Job, label: 'SKU', sortable: true },
    { 
      key: 'customer' as keyof Job, 
      label: 'Customer',
      render: (value: any) => value?.name || '-',
      sortable: true
    },
    { 
      key: 'assignees' as keyof Job, 
      label: 'Assignees',
      render: (value: string[]) => getAssigneeNames(value)
    },
    { 
      key: 'currentStageId' as keyof Job, 
      label: 'Stage',
      render: (_value: string, item: any) => item.status === 'draft' ? '-' : (item.status === 'done' ? 'DONE' : getStageName(item.currentStageId)),
      sortable: true
    },
    { 
      key: 'dueDate' as keyof Job, 
      label: 'Due Date',
      render: (value: any) => formatDate(value),
      sortable: true
    },
    { key: 'quantity' as keyof Job, label: 'Qty', sortable: true },
    { 
      key: 'updatedAt' as keyof Job, 
      label: 'Finish Date',
      render: (_value: any, item: any) => item.status === 'done' ? formatDate(item.updatedAt || item.customerAcceptedAt || item.qaAcceptedAt) : '-',
      sortable: true
    },
    { 
      key: 'status' as keyof Job, 
      label: 'Status',
      render: (value: string) => (
        <span className={`px-3 py-1 rounded-full text-xs font-medium inline-flex items-center gap-1 ${getStatusColor(value)} border`}>
          {getStatusIcon(value)}
          {value.replace('_', ' ').toUpperCase()}
        </span>
      ),
      sortable: true
    },
  ]

  // Move confirmation state (List view)
  const [confirmMove, setConfirmMove] = useState<{ open: boolean; job?: Job; targetStageId?: string; targetStageName?: string }>({ open: false })
  const [requireRelease, setRequireRelease] = useState<{ open: boolean; job?: Job; targetStageId?: string; targetStageName?: string }>({ open: false })
  const [confirmComplete, setConfirmComplete] = useState<{ open: boolean; job?: Job }>({ open: false })

  // Enhanced loading state
  if (jobsLoading) {
    return (
      <div className="min-h-screen bg-gray-50 py-6">
        <div className="w-full px-6 lg:px-10">
          <div className="animate-pulse space-y-6">
            {/* Header Skeleton */}
            <div className="flex items-center justify-between">
              <div className="space-y-3">
                <div className="h-8 bg-gray-200 rounded w-64"></div>
                <div className="h-4 bg-gray-200 rounded w-96"></div>
              </div>
              <div className="flex gap-3">
                <div className="h-10 bg-gray-200 rounded w-32"></div>
                <div className="h-10 bg-gray-200 rounded w-36"></div>
              </div>
            </div>
            
            {/* View Toggle Skeleton */}
            <div className="h-12 bg-gray-200 rounded"></div>
            
            {/* KPI Cards Skeleton */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-24 bg-gray-200 rounded-lg"></div>
              ))}
            </div>
            
            {/* Content Skeleton */}
            <div className="h-96 bg-gray-200 rounded-lg"></div>
          </div>
        </div>
      </div>
    )
  }

  if (jobsError) {
    return (
      <div className="min-h-screen bg-gray-50 py-6 flex items-center justify-center">
        <div className="text-center">
          <ExclamationTriangleIcon className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Failed to load production data</h3>
          <p className="text-gray-600 mb-4">Please try refreshing the page</p>
          <button 
            onClick={() => queryClient.invalidateQueries({ queryKey: ['jobs', workspaceId] })}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-6">
      <div className="w-full px-6 lg:px-10">
        {/* Enhanced Header */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Cog6ToothIcon className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Production Management</h1>
                  <p className="text-gray-600 mt-1">
                    {filteredJobs.length} job{filteredJobs.length !== 1 ? 's' : ''} • {workflows.length} workflow{workflows.length !== 1 ? 's' : ''} • {workcenters.length} workcenter{workcenters.length !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="flex flex-wrap gap-3">
              {/* Search Bar */}
              <div className="relative flex-1 min-w-[280px]">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search jobs, products, customers..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <XMarkIcon className="h-4 w-4" />
                  </button>
                )}
              </div>

              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border transition-colors ${
                  showFilters 
                    ? 'bg-blue-50 border-blue-200 text-blue-700' 
                    : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                <FunnelIcon className="h-4 w-4" />
                Filters
                {Object.values(filters).some(v => 
                  Array.isArray(v) ? v.length > 0 : Boolean(v)
                ) && (
                  <span className="bg-blue-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                    {Object.values(filters).filter(v => Array.isArray(v) ? v.length > 0 : Boolean(v)).length}
                  </span>
                )}
              </button>

              <button
                onClick={() => downloadCSV('production_jobs.csv', toCSV(filteredJobs))}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <ArrowDownTrayIcon className="h-4 w-4" />
                Export
              </button>

              <button
                onClick={() => setShowCreateForm(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
              >
                <PlusIcon className="h-4 w-4" />
                New Job
              </button>
            </div>
          </div>

          {/* Enhanced Filters */}
          {showFilters && (
            <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                  <div className="space-y-2">
                    {['draft', 'released', 'in_progress', 'blocked', 'done', 'cancelled'].map(status => (
                      <label key={status} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={filters.status.includes(status)}
                          onChange={(e) => {
                            const newStatus = e.target.checked
                              ? [...filters.status, status]
                              : filters.status.filter(s => s !== status)
                            setFilters({...filters, status: newStatus})
                          }}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="capitalize">{status.replace('_', ' ')}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Workcenter</label>
                  <select
                    value={filters.workcenterId}
                    onChange={(e) => setFilters({...filters, workcenterId: e.target.value})}
                    className="w-full rounded-lg border-gray-300 focus:border-blue-500 focus:ring-blue-500 py-2.5"
                  >
                    <option value="">All Workcenters</option>
                    {workcenters.map(wc => (
                      <option key={wc.id} value={wc.id}>{wc.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Assignee</label>
                  <select
                    value={filters.assigneeId}
                    onChange={(e) => setFilters({...filters, assigneeId: e.target.value})}
                    className="w-full rounded-lg border-gray-300 focus:border-blue-500 focus:ring-blue-500 py-2.5"
                  >
                    <option value="">All Assignees</option>
                    {resources.map(resource => (
                      <option key={resource.id} value={resource.id}>{resource.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Due Before</label>
                  <input
                    type="date"
                    value={filters.dueBefore ? filters.dueBefore.toISOString().split('T')[0] : ''}
                    onChange={(e) => setFilters({...filters, dueBefore: e.target.value ? new Date(e.target.value) : undefined})}
                    className="w-full rounded-lg border-gray-300 focus:border-blue-500 focus:ring-blue-500 py-2.5"
                  />
                </div>
              </div>
              
              <div className="flex justify-between items-center mt-4 pt-4 border-t border-gray-200">
                <button
                  onClick={clearFilters}
                  className="text-sm text-gray-600 hover:text-gray-800 transition-colors"
                >
                  Clear all filters
                </button>
                <span className="text-sm text-gray-500">
                  Showing {filteredJobs.length} of {jobs.length} jobs
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Enhanced KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Jobs</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{filteredJobs.length}</p>
              </div>
              <div className="p-3 bg-blue-50 rounded-lg">
                <ChartBarIcon className="h-6 w-6 text-blue-600" />
              </div>
            </div>
            <div className="mt-4 flex items-center text-sm text-gray-500">
              <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs">
                Active
              </span>
              <span className="ml-2">{filteredJobs.filter(j => j.status === 'in_progress').length} in progress</span>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">In Progress</p>
                <p className="text-3xl font-bold text-yellow-600 mt-1">
                  {filteredJobs.filter(job => job.status === 'in_progress').length}
                </p>
              </div>
              <div className="p-3 bg-yellow-50 rounded-lg">
                <ClockIcon className="h-6 w-6 text-yellow-600" />
              </div>
            </div>
            <div className="mt-4 text-sm text-gray-500">
              {filteredJobs.filter(j => j.status === 'released').length} ready to start
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Blocked</p>
                <p className="text-3xl font-bold text-red-600 mt-1">
                  {filteredJobs.filter(job => job.status === 'blocked').length}
                </p>
              </div>
              <div className="p-3 bg-red-50 rounded-lg">
                <ExclamationTriangleIcon className="h-6 w-6 text-red-600" />
              </div>
            </div>
            <div className="mt-4 text-sm text-gray-500">
              Needs attention
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Completed</p>
                <p className="text-3xl font-bold text-green-600 mt-1">
                  {filteredJobs.filter(job => job.status === 'done').length}
                </p>
              </div>
              <div className="p-3 bg-green-50 rounded-lg">
                <CheckIcon className="h-6 w-6 text-green-600" />
              </div>
            </div>
            <div className="mt-4 text-sm text-gray-500">
              This week: {filteredJobs.filter(j => j.status === 'done' && isThisWeek(new Date(j.updatedAt))).length}
            </div>
          </div>
        </div>

        {/* Enhanced View Controls */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex items-center gap-2">
              {/* View Toggle */}
              <div className="flex rounded-lg shadow-sm border border-gray-300 bg-white">
                <button
                  onClick={() => setView('board')}
                  className={`px-4 py-2.5 text-sm font-medium rounded-l-lg border-r transition-colors inline-flex items-center gap-2 ${
                    view === 'board'
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <Squares2X2Icon className="h-4 w-4" />
                  Board View
                </button>
                <button
                  onClick={() => setView('list')}
                  className={`px-4 py-2.5 text-sm font-medium rounded-r-lg transition-colors inline-flex items-center gap-2 ${
                    view === 'list'
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <ViewColumnsIcon className="h-4 w-4" />
                  List View
                </button>
              </div>

              {/* View Info */}
              <div className="ml-4 text-sm text-gray-500">
                {view === 'board' ? 'Visual workflow management' : 'Detailed job listing'}
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Board Controls */}
              {view === 'board' && (
                <>
                  <div className="hidden md:flex items-center gap-1 bg-gray-50 rounded-lg p-1">
                    <button
                      onClick={() => { const z = Math.max(0.5, Math.round((zoom - 0.1) * 10) / 10); setZoom(z); try{localStorage.setItem('boardZoom', String(z))}catch{} }}
                      className="p-2 rounded-md text-sm font-medium text-gray-700 hover:bg-white transition-colors"
                      title="Zoom out"
                    >
                      −
                    </button>
                    <span className="px-3 text-sm text-gray-700 w-16 text-center font-medium">{Math.round(zoom*100)}%</span>
                    <button
                      onClick={() => { const z = Math.min(2, Math.round((zoom + 0.1) * 10) / 10); setZoom(z); try{localStorage.setItem('boardZoom', String(z))}catch{} }}
                      className="p-2 rounded-md text-sm font-medium text-gray-700 hover:bg-white transition-colors"
                      title="Zoom in"
                    >
                      +
                    </button>
                  </div>

                  <button
                    onClick={() => setFitToScreen(v => !v)}
                    className={`px-4 py-2.5 rounded-lg text-sm font-medium inline-flex items-center gap-2 transition-colors ${
                      fitToScreen 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {fitToScreen ? 'Fit: On' : 'Fit: Off'}
                  </button>
                </>
              )}

              {/* Fullscreen Toggle */}
              <button
                onClick={toggleFullscreen}
                className="px-4 py-2.5 rounded-lg text-sm font-medium inline-flex items-center gap-2 bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 transition-colors"
                title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
              >
                {isFullscreen ? (
                  <ArrowsPointingInIcon className="h-4 w-4" />
                ) : (
                  <ArrowsPointingOutIcon className="h-4 w-4" />
                )}
                {isFullscreen ? 'Exit' : 'Fullscreen'}
              </button>
            </div>
          </div>
        </div>

        {/* Main Content */}
        {view === 'board' ? (
          <div 
            ref={boardRef} 
            className={`bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden relative transition-all ${
              isFullscreen 
                ? 'fixed inset-0 z-50 m-0 rounded-none' 
                : 'h-[calc(100vh-280px)] min-h-[600px]'
            }`}
          >
            <ProductionBoard
              workspaceId={workspaceId}
              onJobClick={setSelectedJob}
              fitToScreen={fitToScreen}
              zoom={zoom}
            />
            
            {isFullscreen && selectedJob && (
              <div className="absolute inset-0 z-50 bg-white">
                <JobDetail
                  job={selectedJob}
                  workspaceId={workspaceId}
                  onClose={() => setSelectedJob(null)}
                  onDelete={handleDeleteJob}
                  workcenters={workcenters}
                  resources={resources}
                />
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <DataTable
              data={filteredJobs}
              columns={listColumns}
              onRowClick={setSelectedJob}
              renderActions={(job) => (
                <div className="flex items-center justify-end space-x-2">
                  {job.status === 'draft' && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleStatusChange(job.id, 'released') }}
                      className="text-white bg-blue-600 hover:bg-blue-700 font-medium text-sm px-3 py-1.5 rounded-lg shadow-sm border border-transparent transition-colors"
                      title="Release job"
                    >
                      Release
                    </button>
                  )}
                  
                  {(() => {
                    const planned: string[] = (job as any).plannedStageIds || []
                    const allStages = (workflows.find(w => w.id === job.workflowId) || workflows[0])?.stages || []
                    const currentIdx = planned.length > 0 ? planned.indexOf(job.currentStageId) : allStages.findIndex((s: any) => s.id === job.currentStageId)
                    const nextId = planned.length > 0 ? planned[currentIdx + 1] : (allStages[currentIdx + 1]?.id)
                    const nextName = nextId ? (allStages.find((s: any) => s.id === nextId)?.name || 'Next') : null
                    return nextId ? (
                      <button
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          if (!(job.status === 'released' || job.status === 'in_progress')) { 
                            setRequireRelease({ open: true, job, targetStageId: nextId, targetStageName: nextName || 'Next' })
                            return
                          }
                          setConfirmMove({ open: true, job, targetStageId: nextId, targetStageName: nextName || 'Next' }) 
                        }}
                        className="text-white bg-gray-700 hover:bg-gray-800 text-sm px-3 py-1.5 rounded-lg shadow-sm border border-transparent transition-colors"
                        title={`Move to ${nextName}`}
                      >
                        Next Stage
                      </button>
                    ) : null
                  })()}

                  {(() => {
                    const planned: string[] = (job as any).plannedStageIds || []
                    const atLast = planned.length > 0 ? planned[planned.length - 1] === job.currentStageId : false
                    const canShowComplete = atLast && job.status !== 'done' && job.status !== 'cancelled'
                    return canShowComplete ? (
                      <button
                        onClick={(e) => { e.stopPropagation(); setConfirmComplete({ open: true, job }) }}
                        className="text-white bg-green-600 hover:bg-green-700 font-medium text-sm px-3 py-1.5 rounded-lg shadow-sm border border-transparent transition-colors"
                        title="Mark as Completed"
                      >
                        Complete
                      </button>
                    ) : null
                  })()}
                  
                  {/* Duplicate */}
                  <button
                    onClick={(e) => { e.stopPropagation(); setInitialJobForCreate(job); setShowCreateForm(true) }}
                    className="text-gray-700 hover:text-gray-900 text-sm px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
                    title="Duplicate job"
                  >
                    Duplicate
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelectedJob(job)
                    }}
                    className="text-blue-600 hover:text-blue-900 font-medium text-sm px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors"
                  >
                    Details
                  </button>
                  
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDeleteJob(job.id)
                    }}
                    className="text-red-600 hover:text-red-900 p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                    title="Delete job"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              )}
            />
          </div>
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
            workspaceId={workspaceId}
            initialJob={initialJobForCreate || undefined}
          />
        )}

        {!isFullscreen && selectedJob && (
          <JobDetail
            job={selectedJob}
            workspaceId={workspaceId}
            onClose={() => setSelectedJob(null)}
            onDelete={handleDeleteJob}
            workcenters={workcenters}
            resources={resources}
          />
        )}

        {confirmMove.open && confirmMove.job && confirmMove.targetStageId && (
          <ConfirmMoveModal
            job={confirmMove.job}
            targetStageName={confirmMove.targetStageName || 'Next stage'}
            workcenters={workcenters}
            onCancel={() => setConfirmMove({ open: false })}
            onCreateRun={async ({ qtyGood, qtyScrap, lot, workcenterId }) => {
              await createProductionRun(workspaceId, confirmMove.job!.id, {
                stageId: confirmMove.job!.currentStageId,
                workcenterId,
                qtyGood,
                qtyScrap,
                lot,
                operatorId: 'current-user'
              } as any)
            }}
            onConfirm={(note) => { moveJobMutation.mutate({ jobId: confirmMove.job!.id, newStageId: confirmMove.targetStageId!, note }); setConfirmMove({ open: false }) }}
          />
        )}

        {confirmComplete.open && confirmComplete.job && (
          <ConfirmCompleteModal
            job={confirmComplete.job}
            workcenters={workcenters}
            onCancel={() => setConfirmComplete({ open: false })}
            onCreateRun={async ({ qtyGood, qtyScrap, lot, workcenterId }) => {
              await createProductionRun(workspaceId, confirmComplete.job!.id, {
                stageId: confirmComplete.job!.currentStageId,
                workcenterId,
                qtyGood,
                qtyScrap,
                lot,
                operatorId: 'current-user'
              } as any)
            }}
            onConfirm={() => { handleStatusChange(confirmComplete.job!.id, 'done'); setConfirmComplete({ open: false }) }}
          />
        )}

        {requireRelease.open && requireRelease.job && requireRelease.targetStageId && (
          <RequireReleaseModal
            targetStageName={requireRelease.targetStageName || 'Next stage'}
            onCancel={() => setRequireRelease({ open: false })}
            onRelease={() => {
              // Confirm and then release, then reopen move modal
              if (confirm('Are you sure you want to Release this job?')) {
                statusMutation.mutate({ jobId: requireRelease.job!.id, status: 'released' })
                setRequireRelease({ open: false })
                setConfirmMove({ open: true, job: requireRelease.job!, targetStageId: requireRelease.targetStageId!, targetStageName: requireRelease.targetStageName })
              }
            }}
          />
        )}
      </div>
    </div>
  )
}