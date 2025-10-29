import { useState, useRef, useEffect, type FC } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { 
  Job, 
  listJobs, 
  moveJobToStage, 
  setJobStatus,
  createConsumption,
  createTimeLog
} from '../api/production-jobs'
import { 
  QrCodeIcon,
  PlayIcon,
  PauseIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  CubeIcon,
  XMarkIcon
} from '@heroicons/react/24/outline'

interface ProductionScannerProps {
  workspaceId: string
  onClose?: () => void
}

export function ProductionScanner({ workspaceId, onClose }: ProductionScannerProps) {
  const [scannedCode, setScannedCode] = useState('')
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [action, setAction] = useState<'start' | 'complete' | 'block' | 'consume' | 'produce'>('start')
  const [showManualInput, setShowManualInput] = useState(false)
  const [manualCode, setManualCode] = useState('')
  const [consumptionData, setConsumptionData] = useState({
    sku: '',
    name: '',
    qtyUsed: 0,
    uom: '',
    lot: ''
  })
  const [productionData, setProductionData] = useState({
    qtyProduced: 0,
    uom: '',
    lot: ''
  })
  const queryClient = useQueryClient()

  // Fetch jobs for lookup
  const { data: jobsData } = useQuery({
    queryKey: ['jobs', workspaceId],
    queryFn: () => listJobs(workspaceId),
  })

  const jobs = jobsData?.jobs || []

  // Mutations
  const moveJobMutation = useMutation({
    mutationFn: ({ jobId, newStageId }: { jobId: string; newStageId: string }) =>
      moveJobToStage(workspaceId, jobId, newStageId, 'current-user'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs', workspaceId] })
      setSelectedJob(null)
      setScannedCode('')
    },
  })

  const statusMutation = useMutation({
    mutationFn: ({ jobId, status, blockReason }: { jobId: string; status: Job['status']; blockReason?: string }) =>
      setJobStatus(workspaceId, jobId, status, blockReason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs', workspaceId] })
      setSelectedJob(null)
      setScannedCode('')
    },
  })

  const consumptionMutation = useMutation({
    mutationFn: (data: any) => createConsumption(workspaceId, selectedJob!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs', workspaceId] })
      setConsumptionData({ sku: '', name: '', qtyUsed: 0, uom: '', lot: '' })
    },
  })

  const timeLogMutation = useMutation({
    mutationFn: (data: any) => createTimeLog(workspaceId, selectedJob!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs', workspaceId] })
    },
  })

  // Handle scanned code
  const handleScannedCode = (code: string) => {
    setScannedCode(code)
    const job = jobs.find(j => j.code === code || j.sku === code)
    if (job) {
      setSelectedJob(job)
    } else {
      setSelectedJob(null)
    }
  }

  // Handle manual code input
  const handleManualSubmit = () => {
    if (manualCode.trim()) {
      handleScannedCode(manualCode.trim())
      setManualCode('')
      setShowManualInput(false)
    }
  }

  // Handle action execution
  const handleAction = async () => {
    if (!selectedJob) return

    try {
      switch (action) {
        case 'start':
          await statusMutation.mutateAsync({ 
            jobId: selectedJob.id, 
            status: 'in_progress' 
          })
          // Log time start
          await timeLogMutation.mutateAsync({
            stageId: selectedJob.currentStageId,
            resourceId: 'current-user',
            startedAt: new Date(),
            notes: 'Stage started via scanner'
          })
          break

        case 'complete':
          await statusMutation.mutateAsync({ 
            jobId: selectedJob.id, 
            status: 'done' 
          })
          // Log time end
          await timeLogMutation.mutateAsync({
            stageId: selectedJob.currentStageId,
            resourceId: 'current-user',
            startedAt: new Date(),
            stoppedAt: new Date(),
            durationSec: 0, // Will be calculated
            notes: 'Stage completed via scanner'
          })
          break

        case 'block':
          await statusMutation.mutateAsync({ 
            jobId: selectedJob.id, 
            status: 'blocked',
            blockReason: 'Blocked via scanner'
          })
          break

        case 'consume':
          if (consumptionData.sku && consumptionData.qtyUsed > 0) {
            await consumptionMutation.mutateAsync({
              stageId: selectedJob.currentStageId,
              sku: consumptionData.sku,
              name: consumptionData.name,
              qtyUsed: consumptionData.qtyUsed,
              uom: consumptionData.uom,
              lot: consumptionData.lot,
              userId: 'current-user'
            })
          }
          break

        case 'produce':
          // Update job output
          // This would require updating the job's output array
          console.log('Production recorded:', productionData)
          break
      }
    } catch (error) {
      console.error('Action failed:', error)
    }
  }

  const getActionColor = (actionType: string) => {
    switch (actionType) {
      case 'start': return 'bg-green-600 hover:bg-green-700'
      case 'complete': return 'bg-blue-600 hover:bg-blue-700'
      case 'block': return 'bg-red-600 hover:bg-red-700'
      case 'consume': return 'bg-yellow-600 hover:bg-yellow-700'
      case 'produce': return 'bg-purple-600 hover:bg-purple-700'
      default: return 'bg-gray-600 hover:bg-gray-700'
    }
  }

  const getActionIcon = (actionType: string) => {
    switch (actionType) {
      case 'start': return PlayIcon
      case 'complete': return CheckCircleIcon
      case 'block': return PauseIcon
      case 'consume': return CubeIcon
      case 'produce': return CubeIcon
      default: return PlayIcon
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Production Scanner</h1>
            <p className="text-sm text-gray-600">Scan QR codes or barcodes to manage production jobs</p>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Scanner Interface */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Scan Code</h2>
            
            {/* QR Code Scanner Placeholder */}
            <div className="bg-gray-100 rounded-lg p-8 text-center mb-4">
              <QrCodeIcon className="mx-auto h-16 w-16 text-gray-400 mb-4" />
              <p className="text-sm text-gray-600 mb-4">
                Position QR code or barcode within the frame
              </p>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
                <p className="text-xs text-gray-500">Camera view would appear here</p>
                <p className="text-xs text-gray-500 mt-1">(Requires camera access)</p>
              </div>
            </div>

            {/* Manual Input */}
            <div className="space-y-4">
              <button
                onClick={() => setShowManualInput(!showManualInput)}
                className="w-full px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                {showManualInput ? 'Hide' : 'Show'} Manual Input
              </button>

              {showManualInput && (
                <div className="space-y-2">
                  <input
                    type="text"
                    placeholder="Enter job code or SKU manually"
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleManualSubmit()}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    onClick={handleManualSubmit}
                    className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    Lookup Job
                  </button>
                </div>
              )}
            </div>

            {/* Scanned Code Display */}
            {scannedCode && (
              <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>Scanned:</strong> {scannedCode}
                </p>
              </div>
            )}
          </div>

          {/* Job Details & Actions */}
          <div className="space-y-6">
            {/* Job Information */}
            {selectedJob ? (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Job Details</h2>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm font-medium text-gray-500">Code:</span>
                    <span className="text-sm text-gray-900">{selectedJob.code}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm font-medium text-gray-500">SKU:</span>
                    <span className="text-sm text-gray-900">{selectedJob.sku}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm font-medium text-gray-500">Product:</span>
                    <span className="text-sm text-gray-900">{selectedJob.productName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm font-medium text-gray-500">Quantity:</span>
                    <span className="text-sm text-gray-900">{selectedJob.quantity} {selectedJob.unit}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm font-medium text-gray-500">Status:</span>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      selectedJob.status === 'draft' ? 'bg-gray-100 text-gray-800' :
                      selectedJob.status === 'released' ? 'bg-blue-100 text-blue-800' :
                      selectedJob.status === 'in_progress' ? 'bg-yellow-100 text-yellow-800' :
                      selectedJob.status === 'blocked' ? 'bg-red-100 text-red-800' :
                      selectedJob.status === 'done' ? 'bg-green-100 text-green-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {selectedJob.status.replace('_', ' ').toUpperCase()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm font-medium text-gray-500">Stage:</span>
                    <span className="text-sm text-gray-900">{selectedJob.currentStageId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm font-medium text-gray-500">Customer:</span>
                    <span className="text-sm text-gray-900">{selectedJob.customer.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm font-medium text-gray-500">Due Date:</span>
                    <span className="text-sm text-gray-900">
                      {new Date(selectedJob.dueDate).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>
            ) : scannedCode ? (
              <div className="bg-red-50 rounded-lg border border-red-200 p-6">
                <div className="flex items-center">
                  <ExclamationTriangleIcon className="h-5 w-5 text-red-400 mr-2" />
                  <p className="text-sm text-red-800">
                    Job not found for code: {scannedCode}
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-gray-50 rounded-lg border border-gray-200 p-6">
                <p className="text-sm text-gray-600 text-center">
                  Scan a QR code or enter a job code to get started
                </p>
              </div>
            )}

            {/* Action Selection */}
            {selectedJob && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Select Action</h2>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  {[
                    { id: 'start', label: 'Start Stage', icon: PlayIcon },
                    { id: 'complete', label: 'Complete Stage', icon: CheckCircleIcon },
                    { id: 'block', label: 'Block Job', icon: PauseIcon },
                    { id: 'consume', label: 'Record Consumption', icon: CubeIcon },
                    { id: 'produce', label: 'Record Production', icon: CubeIcon },
                  ].map((actionOption) => {
                    const Icon = actionOption.icon
                    return (
                      <button
                        key={actionOption.id}
                        onClick={() => setAction(actionOption.id as any)}
                        className={`p-3 rounded-lg border-2 text-sm font-medium flex items-center justify-center space-x-2 ${
                          action === actionOption.id
                            ? 'border-blue-500 bg-blue-50 text-blue-700'
                            : 'border-gray-200 hover:border-gray-300 text-gray-700'
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                        <span>{actionOption.label}</span>
                      </button>
                    )
                  })}
                </div>

                {/* Action-specific forms */}
                {action === 'consume' && (
                  <div className="space-y-3 p-4 bg-yellow-50 rounded-lg">
                    <h3 className="text-sm font-medium text-gray-900">Material Consumption</h3>
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        type="text"
                        placeholder="SKU"
                        value={consumptionData.sku}
                        onChange={(e) => setConsumptionData({...consumptionData, sku: e.target.value})}
                        className="px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <input
                        type="text"
                        placeholder="Name"
                        value={consumptionData.name}
                        onChange={(e) => setConsumptionData({...consumptionData, name: e.target.value})}
                        className="px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <input
                        type="number"
                        step="0.01"
                        placeholder="Quantity Used"
                        value={consumptionData.qtyUsed}
                        onChange={(e) => setConsumptionData({...consumptionData, qtyUsed: Number(e.target.value)})}
                        className="px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <input
                        type="text"
                        placeholder="UOM"
                        value={consumptionData.uom}
                        onChange={(e) => setConsumptionData({...consumptionData, uom: e.target.value})}
                        className="px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <input
                        type="text"
                        placeholder="Lot Number"
                        value={consumptionData.lot}
                        onChange={(e) => setConsumptionData({...consumptionData, lot: e.target.value})}
                        className="px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 col-span-2"
                      />
                    </div>
                  </div>
                )}

                {action === 'produce' && (
                  <div className="space-y-3 p-4 bg-purple-50 rounded-lg">
                    <h3 className="text-sm font-medium text-gray-900">Production Output</h3>
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        type="number"
                        step="0.01"
                        placeholder="Quantity Produced"
                        value={productionData.qtyProduced}
                        onChange={(e) => setProductionData({...productionData, qtyProduced: Number(e.target.value)})}
                        className="px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <input
                        type="text"
                        placeholder="UOM"
                        value={productionData.uom}
                        onChange={(e) => setProductionData({...productionData, uom: e.target.value})}
                        className="px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <input
                        type="text"
                        placeholder="Lot Number"
                        value={productionData.lot}
                        onChange={(e) => setProductionData({...productionData, lot: e.target.value})}
                        className="px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 col-span-2"
                      />
                    </div>
                  </div>
                )}

                {/* Execute Action Button */}
                <button
                  onClick={handleAction}
                  disabled={statusMutation.isPending || moveJobMutation.isPending || consumptionMutation.isPending}
                  className={`w-full mt-4 px-4 py-2 text-white rounded-md font-medium flex items-center justify-center space-x-2 ${getActionColor(action)} disabled:opacity-50`}
                >
                  {(() => {
                    const Icon = getActionIcon(action)
                    return (
                      <>
                        <Icon className="h-4 w-4" />
                        <span>
                          {statusMutation.isPending || moveJobMutation.isPending || consumptionMutation.isPending
                            ? 'Processing...'
                            : `Execute ${action.charAt(0).toUpperCase() + action.slice(1)}`
                          }
                        </span>
                      </>
                    )
                  })()}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Recent Jobs */}
        <div className="mt-8 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Jobs</h2>
          <div className="space-y-2">
            {jobs.slice(0, 5).map((job) => (
              <div
                key={job.id}
                onClick={() => setSelectedJob(job)}
                className={`p-3 rounded-lg border cursor-pointer hover:bg-gray-50 ${
                  selectedJob?.id === job.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{job.code}</p>
                    <p className="text-xs text-gray-600">{job.productName} • {job.quantity} {job.unit}</p>
                  </div>
                  <div className="text-right">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      job.status === 'draft' ? 'bg-gray-100 text-gray-800' :
                      job.status === 'released' ? 'bg-blue-100 text-blue-800' :
                      job.status === 'in_progress' ? 'bg-yellow-100 text-yellow-800' :
                      job.status === 'blocked' ? 'bg-red-100 text-red-800' :
                      job.status === 'done' ? 'bg-green-100 text-green-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {job.status.replace('_', ' ').toUpperCase()}
                    </span>
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(job.dueDate).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}