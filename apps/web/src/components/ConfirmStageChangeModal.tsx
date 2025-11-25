import type { FC } from 'react'
import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { Job } from '../api/production-jobs'
import { listJobHistory, listJobProductionRuns, setJobStatus } from '../api/production-jobs'
import { listProducts, type ListedProduct } from '../api/inventory'
import { ConfirmInventoryPostingModal } from './ConfirmInventoryPostingModal'

interface ConfirmStageChangeModalProps {
  job: Job
  currentStageName: string
  targetStageName: string
  workcenters: Array<{ id: string; name: string }>
  workspaceId: string
  workflows: Array<{ id: string; stages?: Array<{ id: string; name: string; inputUOM?: string; outputUOM?: string }> }>
  onCancel: () => void
  onConfirm: (note?: string) => void
  onCreateRun: (payload: { qtyGood: number; qtyScrap?: number; lot?: string; workcenterId?: string; at?: Date }) => Promise<void>
  onComplete?: () => void
}

export const ConfirmStageChangeModal: FC<ConfirmStageChangeModalProps> = ({
  job,
  currentStageName,
  targetStageName,
  workcenters,
  workspaceId,
  workflows,
  onCancel,
  onConfirm,
  onCreateRun,
  onComplete,
}) => {
  const queryClient = useQueryClient()
  const [note, setNote] = useState('')
  const [qtyGood, setQtyGood] = useState<number>(0)
  const [qtyScrap, setQtyScrap] = useState<number>(0)
  const [lot, setLot] = useState('')
  const [workcenterId, setWorkcenterId] = useState<string | undefined>(job.workcenterId)
  const [runDateTime, setRunDateTime] = useState<string>(() => {
    const now = new Date()
    return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
  })
  // Track if user has added a record in this session
  const [hasAddedRecord, setHasAddedRecord] = useState(false)
  // States for complete job flow
  const [showPostToInventoryPrompt, setShowPostToInventoryPrompt] = useState(false)
  const [showCompleteModal, setShowCompleteModal] = useState(false)
  
  // Fetch products for inventory posting
  const { data: products = [] } = useQuery<ListedProduct[]>({
    queryKey: ['products', workspaceId],
    queryFn: () => listProducts(workspaceId),
    enabled: !!workspaceId,
  })

  // Helper functions
  const getStageInfo = (stageId: string) => {
    if (!stageId) return null
    for (const workflow of workflows) {
      const stage = workflow.stages?.find(s => s.id === stageId)
      if (stage) return stage
    }
    return null
  }

  const getStageName = (stageId: string) => {
    return getStageInfo(stageId)?.name || stageId || '-'
  }

  // Stage and production data
  const currentStageInfo = getStageInfo(job.currentStageId)
  const currentStageInputUOM = currentStageInfo?.inputUOM || ''
  const currentStageOutputUOM = currentStageInfo?.outputUOM || ''
  const requireOutput = ((job as any).requireOutputToAdvance !== false)
  const numberUp = job.productionSpecs?.numberUp || 1

  // Production runs data - fetch all runs to calculate previous stage output
  const { data: allJobRuns = [] } = useQuery({
    queryKey: ['jobRuns', workspaceId, job.id],
    queryFn: () => listJobProductionRuns(workspaceId, job.id),
    enabled: !!workspaceId && !!job.id,
  })

  // Job history for progress tracking
  const { data: history = [] } = useQuery({
    queryKey: ['jobHistory', workspaceId, job.id],
    queryFn: () => listJobHistory(workspaceId, job.id),
    enabled: !!workspaceId && !!job.id,
  })

  // Find previous stage from history
  const plannedStages = (job as any).plannedStageIds || []
  const currentStageIndex = plannedStages.indexOf(job.currentStageId)
  const previousStageId = currentStageIndex > 0 ? plannedStages[currentStageIndex - 1] : null
  const previousStageInfo = previousStageId ? getStageInfo(previousStageId) : null
  const previousStageOutputUOM = previousStageInfo?.outputUOM || ''
  const isLastStage = currentStageIndex >= 0 && plannedStages.length > 0 && plannedStages[plannedStages.length - 1] === job.currentStageId

  // Calculate previous stage's actual output (in output UOM)
  // Production runs are already stored in output UOM after conversion, so use directly
  const previousStageRuns = previousStageId ? allJobRuns.filter((r: any) => r.stageId === previousStageId) : []
  const previousStageTotalOutput = previousStageRuns.reduce((sum: number, r: any) => {
    // Runs are already in output UOM, no conversion needed
    return sum + Number(r.qtyGood || 0)
  }, 0)

  // Current stage runs - production runs are stored in output UOM (after conversion)
  const currentStageRuns = allJobRuns.filter((r: any) => r.stageId === job.currentStageId)
  // Runs are already stored in output UOM, so we can use them directly
  const totalProducedInStage = currentStageRuns.reduce((sum: number, r: any) => {
    return sum + Number(r.qtyGood || 0)
  }, 0)
  
  const convertToOutputUOM = (qtyInInputUOM: number): number => {
    if (currentStageInputUOM === 'sheets' && currentStageOutputUOM === 'cartoon' && numberUp > 0) {
      return qtyInInputUOM * numberUp
    }
    return qtyInInputUOM
  }

  const thisEntryInOutputUOM = convertToOutputUOM(qtyGood)
  const totalAfterThisEntry = totalProducedInStage + thisEntryInOutputUOM

  // Planned quantity calculation - use previous stage's output if available, otherwise use original plan
  // Previous stage's OUTPUT becomes current stage's INPUT
  // Then we convert current stage INPUT to current stage OUTPUT for threshold comparison
  const calculatePlannedQty = () => {
    // If there's a previous stage with output, use that as planned quantity
    if (previousStageId && previousStageTotalOutput > 0) {
      // Previous stage output is in previous stage's output UOM
      // This becomes current stage's INPUT (if UOM matches)
      
      // Step 1: Convert previous output to current input UOM
      let currentStagePlannedInput: number
      if (previousStageOutputUOM === currentStageInputUOM) {
        // Same UOM, no conversion
        currentStagePlannedInput = previousStageTotalOutput
      } else if (previousStageOutputUOM === 'cartoon' && currentStageInputUOM === 'sheets' && numberUp > 0) {
        // Previous output cartoon -> current input sheets
        currentStagePlannedInput = previousStageTotalOutput / numberUp
      } else if (previousStageOutputUOM === 'sheets' && currentStageInputUOM === 'cartoon' && numberUp > 0) {
        // Previous output sheets -> current input cartoon
        currentStagePlannedInput = previousStageTotalOutput * numberUp
      } else {
        // Default: use previous output as current input (assume same UOM)
        currentStagePlannedInput = previousStageTotalOutput
      }
      
      // Step 2: Convert current input to current output UOM for threshold comparison
      let currentStagePlannedOutput: number
      if (currentStageInputUOM === currentStageOutputUOM) {
        currentStagePlannedOutput = currentStagePlannedInput
      } else if (currentStageInputUOM === 'sheets' && currentStageOutputUOM === 'cartoon' && numberUp > 0) {
        currentStagePlannedOutput = currentStagePlannedInput * numberUp
      } else if (currentStageInputUOM === 'cartoon' && currentStageOutputUOM === 'sheets' && numberUp > 0) {
        currentStagePlannedOutput = currentStagePlannedInput / numberUp
      } else {
        currentStagePlannedOutput = currentStagePlannedInput
      }
      
      return {
        qty: currentStagePlannedOutput, // For display in output UOM
        qtyInOutputUOM: currentStagePlannedOutput, // For threshold comparison (output UOM)
        uom: currentStageOutputUOM || 'sheets',
        displayUOM: currentStageOutputUOM || 'sheets' // Show in output UOM
      }
    }

    // For first stage, use original planned quantity
    if (currentStageOutputUOM === 'cartoon') {
      const boxQty = job.packaging?.plannedBoxes || 0
      const pcsPerBox = job.packaging?.pcsPerBox || 1
      const qtyInCartoon = boxQty * pcsPerBox
      return { 
        qty: qtyInCartoon,
        qtyInOutputUOM: qtyInCartoon,
        uom: 'cartoon',
        displayUOM: 'cartoon' // Show in output UOM
      }
    }
    
    const sheetItem = Array.isArray(job.bom) ? job.bom.find((item: any) => 
      ['sht', 'sheet', 'sheets'].includes(String(item.uom || '').toLowerCase())
    ) : null

    const qtyInSheets = sheetItem ? Number(sheetItem.qtyRequired || 0) : (job.output?.[0]?.qtyPlanned as number) || Number((job as any).quantity || 0)
    return {
      qty: qtyInSheets,
      qtyInOutputUOM: qtyInSheets,
      uom: 'sheets',
      displayUOM: currentStageOutputUOM || 'sheets' // Show in output UOM if available, otherwise sheets
    }
  }

  const planned = calculatePlannedQty()
  const WASTAGE_THRESHOLD = 400
  // Use planned quantity in output UOM for threshold comparison
  const plannedQtyInOutputUOM = planned.qtyInOutputUOM || planned.qty
  const completionThreshold = Math.max(0, plannedQtyInOutputUOM - WASTAGE_THRESHOLD)
  const isIncomplete = plannedQtyInOutputUOM > 0 && totalAfterThisEntry < completionThreshold
  // Check if threshold is already met with existing production (without current entry)
  const thresholdAlreadyMet = plannedQtyInOutputUOM > 0 && totalProducedInStage >= completionThreshold

  // Stage progress component
  const StageProgress = () => {
    const plannedStages = (job as any).plannedStageIds || []
    const stageChanges = history.filter((h: any) => h.type === 'stage_change')
      .sort((a: any, b: any) => (a.at?.seconds || 0) - (b.at?.seconds || 0))
    
    const completedStages = new Set<string>()
    const startedStages = new Set<string>()
    
    stageChanges.forEach((h: any) => {
      if (h.payload?.previousStageId) completedStages.add(h.payload.previousStageId)
      if (h.payload?.newStageId) startedStages.add(h.payload.newStageId)
    })

    if (plannedStages.length === 0) return null

    const currentStageIndex = job.currentStageId ? plannedStages.indexOf(job.currentStageId) : -1

    return (
      <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
        <h4 className="text-xs font-semibold text-gray-700 mb-2">Stage Progress</h4>
        <div className="space-y-1">
          {plannedStages.map((stageId: string, idx: number) => {
            // A stage is completed if:
            // 1. It was explicitly marked as completed in history, OR
            // 2. It comes before the current stage in the workflow order
            const isCompleted = completedStages.has(stageId) || (currentStageIndex >= 0 && idx < currentStageIndex)
            const isCurrent = stageId === job.currentStageId
            const isStarted = startedStages.has(stageId) || (currentStageIndex >= 0 && idx <= currentStageIndex)
            
            return (
              <div key={stageId} className="flex items-center gap-2 text-xs">
                <div className={`w-2 h-2 rounded-full ${
                  isCompleted ? 'bg-green-500' : 
                  isCurrent ? 'bg-blue-500' : 
                  isStarted ? 'bg-yellow-500' : 'bg-gray-300'
                }`} />
                <span className={
                  isCurrent ? 'font-medium text-blue-600' : 
                  isCompleted ? 'text-green-600' : 
                  isStarted ? 'text-yellow-600' : 'text-gray-500'
                }>
                  {getStageName(stageId)}
                  {isCurrent && ' (Current)'}
                  {isCompleted && !isCurrent && ' ✓'}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  const isStageChange = targetStageName !== currentStageName

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            {isStageChange ? 'Confirm Stage Change' : 'Add Production Output'}
          </h3>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {/* Main Message */}
          <p className="text-sm text-gray-700">
            {isStageChange ? (
              <>Move from <span className="font-medium text-blue-600">{currentStageName}</span> to <span className="font-medium text-green-600">{targetStageName}</span>?</>
            ) : (
              <>Add production output for <span className="font-medium text-blue-600">{currentStageName}</span></>
            )}
            <span className="ml-1 text-gray-500">({job.code})</span>
          </p>

          {/* Production Output Form */}
          {requireOutput && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <p className="text-sm font-medium text-blue-800">Production Output Required</p>
              </div>
              
              {/* Production Summary */}
              {planned.qty > 0 && (
                <div className="mb-3 p-3 bg-white rounded border border-gray-200 text-xs">
                  <div className="grid grid-cols-3 gap-2 mb-2">
                    <div>
                      <span className="text-gray-600">Planned:</span>
                      <div className="font-medium">{planned.qty.toLocaleString()} {planned.displayUOM}</div>
                    </div>
                    <div>
                      <span className="text-gray-600">Produced:</span>
                      <div className="font-medium">
                        {totalProducedInStage.toLocaleString()} {currentStageOutputUOM || 'sheets'}
                      </div>
                    </div>
                    <div>
                      <span className="text-gray-600">Remaining:</span>
                      <div className="font-medium">
                        {Math.max(0, plannedQtyInOutputUOM - totalAfterThisEntry).toLocaleString()} {currentStageOutputUOM || 'sheets'}
                      </div>
                    </div>
                  </div>
                  {isIncomplete && (
                    <div className="text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                      <span className="font-medium">Incomplete:</span> {completionThreshold.toLocaleString()}+ {currentStageOutputUOM || 'sheets'} required
                    </div>
                  )}
                </div>
              )}

              {/* Input Fields */}
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Good Qty ({currentStageInputUOM || 'sheets'})
                    </label>
                    <input 
                      type="number" 
                      min={0}
                      value={qtyGood} 
                      onChange={(e) => setQtyGood(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder={`Enter quantity in ${currentStageInputUOM || 'sheets'}`}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Scrap Qty ({currentStageInputUOM || 'sheets'})
                    </label>
                    <input 
                      type="number" 
                      min={0}
                      value={qtyScrap} 
                      onChange={(e) => setQtyScrap(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder={`Enter quantity in ${currentStageInputUOM || 'sheets'}`}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Date & Time</label>
                    <input 
                      type="datetime-local" 
                      value={runDateTime} 
                      onChange={(e) => setRunDateTime(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Workcenter</label>
                    <select 
                      value={workcenterId || ''} 
                      onChange={(e) => setWorkcenterId(e.target.value || undefined)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">Unspecified</option>
                      {(workcenters || []).map(w => (
                        <option key={w.id} value={w.id}>{w.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Lot Number</label>
                  <input 
                    type="text" 
                    value={lot} 
                    onChange={(e) => setLot(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Optional"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Stage Progress */}
          <StageProgress />

          {/* Note */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Note (Optional)</label>
            <textarea 
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none" 
              rows={2} 
              value={note} 
              onChange={(e) => setNote(e.target.value)} 
              placeholder="Add a reason or note for this action..."
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-200 bg-gray-50 rounded-b-xl flex justify-end gap-3">
          <button 
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
          >
            Cancel
          </button>
          
          {requireOutput && (
            <button
              onClick={async () => {
                if (qtyGood <= 0) {
                  alert('Please enter Good Quantity to add production record.')
                  return
                }

                const qtyGoodToSave = convertToOutputUOM(qtyGood)
                const qtyScrapToSave = qtyScrap > 0 ? convertToOutputUOM(qtyScrap) : undefined
                
                await onCreateRun({ 
                  qtyGood: qtyGoodToSave, 
                  qtyScrap: qtyScrapToSave, 
                  lot: lot || undefined, 
                  workcenterId, 
                  at: runDateTime ? new Date(runDateTime) : undefined 
                } as any)
                
                queryClient.invalidateQueries({ queryKey: ['jobRuns', workspaceId, job.id] })
                // Also invalidate allJobRuns to update threshold checks immediately
                queryClient.invalidateQueries({ queryKey: ['allJobRuns', workspaceId] })
                setQtyGood(0)
                setQtyScrap(0)
                setLot('')
                // Mark that a record has been added in this session
                setHasAddedRecord(true)
                
                alert(`✓ Production record added successfully!\n\nGood Quantity: ${qtyGood.toLocaleString()} ${currentStageInputUOM}`)
              }}
              className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors"
            >
              Add Record
            </button>
          )}
          
          {isStageChange && !isLastStage && (
            <button
              onClick={async () => {
                // Require user to add a record first only if threshold is not already met
                // If threshold is already met, user can move without adding a new record
                if (requireOutput && !thresholdAlreadyMet && !hasAddedRecord) {
                  alert('⚠️ Please add a production record first using "Add Record" button before moving to next stage.')
                  return
                }

                if (requireOutput && isIncomplete) {
                  alert(`⚠️ Cannot proceed: Production quantity below required threshold.\n\nRequired: ${completionThreshold.toLocaleString()}+ ${currentStageOutputUOM || 'sheets'}\nCurrent: ${totalAfterThisEntry.toLocaleString()} ${currentStageOutputUOM || 'sheets'}\n\nPlease complete production before moving to next stage.`)
                  return
                }
                
                onConfirm(note || undefined)
              }}
              className={`px-4 py-2 text-sm font-medium text-white rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors ${
                requireOutput && isIncomplete
                  ? 'bg-gray-400 cursor-not-allowed focus:ring-gray-400' 
                  : (requireOutput && !thresholdAlreadyMet && !hasAddedRecord)
                    ? 'bg-gray-400 cursor-not-allowed focus:ring-gray-400'
                    : 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'
              }`}
              disabled={requireOutput && (isIncomplete || (!thresholdAlreadyMet && !hasAddedRecord))}
              title={
                requireOutput && !thresholdAlreadyMet && !hasAddedRecord 
                  ? 'Please add a production record first using "Add Record" button' 
                  : requireOutput && isIncomplete
                    ? `Threshold not met. Required: ${completionThreshold.toLocaleString()}+ ${currentStageOutputUOM || 'sheets'}`
                    : undefined
              }
            >
              Confirm Move
            </button>
          )}

          {isLastStage && !isIncomplete && (thresholdAlreadyMet || hasAddedRecord) && (
            <button
              onClick={() => {
                setShowPostToInventoryPrompt(true)
              }}
              className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-md hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 transition-colors"
            >
              Complete Job
            </button>
          )}
        </div>
      </div>

      {/* Post to Inventory Prompt */}
      {showPostToInventoryPrompt && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Complete Job</h3>
            <p className="text-gray-700 mb-6">
              Çıktıyı stoka aktarmak ister misiniz?
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowPostToInventoryPrompt(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                İptal
              </button>
              <button
                onClick={async () => {
                  // Complete job without posting to inventory
                  await setJobStatus(workspaceId, job.id, 'done')
                  setShowPostToInventoryPrompt(false)
                  queryClient.invalidateQueries({ queryKey: ['job', workspaceId, job.id] })
                  queryClient.invalidateQueries({ queryKey: ['jobs', workspaceId] })
                  if (onComplete) {
                    onComplete()
                  } else {
                    onCancel()
                  }
                }}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Hayır
              </button>
              <button
                onClick={() => {
                  setShowPostToInventoryPrompt(false)
                  setShowCompleteModal(true)
                }}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
              >
                Evet
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Inventory Posting Modal */}
      {showCompleteModal && (
        <ConfirmInventoryPostingModal 
          job={job} 
          workspaceId={workspaceId} 
          products={products} 
          onClose={() => {
            setShowCompleteModal(false)
          }}
          onSuccess={async () => {
            // Complete the job after successful inventory posting
            await setJobStatus(workspaceId, job.id, 'done')
            queryClient.invalidateQueries({ queryKey: ['job', workspaceId, job.id] })
            queryClient.invalidateQueries({ queryKey: ['jobs', workspaceId] })
            setShowCompleteModal(false)
            if (onComplete) {
              onComplete()
            } else {
              onCancel()
            }
          }}
        />
      )}
    </div>
  )
}

export default ConfirmStageChangeModal