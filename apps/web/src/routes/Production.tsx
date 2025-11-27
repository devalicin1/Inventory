import { useState, useEffect, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { DataTable } from '../components/DataTable'
import { ProductionBoard } from '../components/ProductionBoard'
import { ProductionReportsTab } from '../components/job-detail/tabs/ProductionReportsTab'
import { JobDetail } from '../components/JobDetail'
import { CreateJobForm } from '../components/CreateJobForm'
import { ConfirmStageChangeModal } from '../components/ConfirmStageChangeModal'
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
  createProductionRun,
  listJobProductionRuns
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
  ExclamationTriangleIcon,
  ArrowRightIcon
} from '@heroicons/react/24/outline'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'

// Helper function to check if date is in current week
function isThisWeek(date: Date): boolean {
  const now = new Date()
  const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()))
  const endOfWeek = new Date(now.setDate(now.getDate() + 6))
  return date >= startOfWeek && date <= endOfWeek
}

// Confirm Move Modal moved to a standalone component in components/ConfirmStageChangeModal

function ConfirmCompleteModal({
  job,
  workcenters,
  workspaceId,
  workflows,
  onCancel,
  onCreateRun,
  onConfirm
}: {
  job: Job;
  workcenters: Array<{ id: string; name: string }>;
  workspaceId: string;
  workflows: Array<{ id: string; stages?: Array<{ id: string; name: string; inputUOM?: string; outputUOM?: string }> }>;
  onCancel: () => void;
  onCreateRun: (payload: { qtyGood: number; qtyScrap?: number; lot?: string; workcenterId?: string; at?: Date }) => Promise<void>;
  onConfirm: () => void;
}) {
  const queryClient = useQueryClient()
  const requireOutput = ((job as any).requireOutputToAdvance !== false)

  // Helper function to get stage info
  const getStageInfo = (stageId: string) => {
    for (const workflow of workflows) {
      const stage = workflow.stages?.find(s => s.id === stageId)
      if (stage) return stage
    }
    return null
  }
  const [qtyGood, setQtyGood] = useState<number>(0)
  const [qtyScrap, setQtyScrap] = useState<number>(0)
  const [lot, setLot] = useState('')
  const [workcenterId, setWorkcenterId] = useState<string | undefined>(job.workcenterId)
  const [runDateTime, setRunDateTime] = useState<string>(() => {
    const now = new Date()
    const off = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
    return off.toISOString().slice(0, 16)
  })

  // Fetch all production runs for this job
  const { data: allJobRuns = [] } = useQuery({
    queryKey: ['jobRuns', workspaceId, job.id],
    queryFn: () => listJobProductionRuns(workspaceId, job.id),
    enabled: !!workspaceId && !!job.id
  })

  const { data: currentStageRuns = [] } = useQuery({
    queryKey: ['jobRuns', workspaceId, job.id, job.currentStageId],
    queryFn: () => allJobRuns.filter(r => r.stageId === job.currentStageId),
    enabled: !!workspaceId && !!job.id && allJobRuns.length > 0
  })
 
  const currentStageInfo = getStageInfo(job.currentStageId)
  const currentStageInputUOM = currentStageInfo?.inputUOM || ''
  const currentStageOutputUOM = currentStageInfo?.outputUOM || ''

  // Get Number Up for conversion
  const numberUp = job.productionSpecs?.numberUp || 1

  // Find box item from BOM
  const boxItem = Array.isArray(job.bom)
    ? job.bom.find((item: any) => {
      const uom = String(item.uom || '').toLowerCase()
      return uom === 'box' || uom === 'boxes'
    })
    : null

  // Calculate total cartoon from all stages with cartoon output
  const totalCartoonOutput = useMemo(() => {
    let total = 0
    for (const run of allJobRuns) {
      const stageInfo = getStageInfo(run.stageId)
      const stageOutputUOM = stageInfo?.outputUOM || ''
      if (stageOutputUOM === 'cartoon') {
        // Runs are already saved in cartoon, so just sum
        total += run.qtyGood || 0
      }
    }
    // Add current entry if it's in cartoon output stage
    if (currentStageOutputUOM === 'cartoon' && qtyGood > 0) {
      const thisEntryCartoon = currentStageInputUOM === 'sheets' && numberUp > 0
        ? (qtyGood * numberUp)
        : qtyGood
      total += thisEntryCartoon
    }
    return total
  }, [allJobRuns, qtyGood, currentStageOutputUOM, currentStageInputUOM, numberUp, workflows])

  // Calculate boxes from cartoon total
  const pcsPerBox = job.packaging?.pcsPerBox || 1
  const calculatedBoxes = pcsPerBox > 0 ? totalCartoonOutput / pcsPerBox : 0
  const plannedBoxes = job.packaging?.plannedBoxes
    || (boxItem ? Number(boxItem.qtyRequired || 0) : 0)
    || (job.unit === 'box' ? Number((job as any).quantity || 0) : 0)

  // Check if completion is allowed: calculatedBoxes >= plannedBoxes OR calculatedBoxes >= (plannedBoxes - 5)
  const BOX_TOLERANCE = 5
  const canComplete = calculatedBoxes >= plannedBoxes || calculatedBoxes >= (plannedBoxes - BOX_TOLERANCE)
  const boxesDifference = plannedBoxes - calculatedBoxes

  // Convert produced quantity from input UOM to output UOM if needed
  const convertToOutputUOM = (qtyInInputUOM: number): number => {
    if (currentStageInputUOM === 'sheets' && currentStageOutputUOM === 'cartoon' && numberUp > 0) {
      // Convert sheets to cartoon: sheets × numberUp = cartoon (Number Up = cartoon per sheet)
      return qtyInInputUOM * numberUp
    }
    return qtyInInputUOM
  }

  // Total produced in stage
  // Note: If stage output is cartoon, runs are already saved in cartoon, so no conversion needed
  // If stage input is sheets and output is cartoon, runs are saved in cartoon (qtyGood × numberUp)
  const totalProducedInStage = currentStageRuns.reduce((sum, r) => sum + (r.qtyGood || 0), 0)

  // Find sheet item from BOM to get planned sheets quantity
  const sheetItem = Array.isArray(job.bom) ? job.bom.find((item: any) => {
    const uom = String(item.uom || '').toLowerCase()
    return uom === 'sht' || uom === 'sheet' || uom === 'sheets'
  }) : null

  // Calculate planned quantity based on stage output UOM
  let plannedQty: number
  let plannedUOM: string = currentStageInputUOM || 'sheets'

  if (currentStageOutputUOM === 'cartoon') {
    // If output is cartoon, calculate: plannedBoxes * pcsPerBox = planned cartoon
    const boxQty = job.packaging?.plannedBoxes
      || (boxItem ? Number(boxItem.qtyRequired || 0) : 0)
      || (job.unit === 'box' ? Number((job as any).quantity || 0) : 0)
    const pcsPerBox = job.packaging?.pcsPerBox || 1
    plannedQty = boxQty * pcsPerBox
    plannedUOM = 'cartoon'
  } else if (currentStageInputUOM) {
    const inputItem = Array.isArray(job.bom) ? job.bom.find((item: any) => {
      const uom = String(item.uom || '').toLowerCase()
      return uom === currentStageInputUOM.toLowerCase()
    }) : null

    plannedQty = inputItem
      ? Number(inputItem.qtyRequired || 0)
      : (sheetItem ? Number(sheetItem.qtyRequired || 0) : ((job.output?.[0]?.qtyPlanned as number) || Number((job as any).quantity || 0)))
    plannedUOM = currentStageInputUOM
  } else {
    plannedQty = sheetItem ? Number(sheetItem.qtyRequired || 0) : ((job.output?.[0]?.qtyPlanned as number) || Number((job as any).quantity || 0))
    plannedUOM = 'sheets'
  }

  const WASTAGE_THRESHOLD_LOWER = 400 // Alt sınır: planned - 400
  const WASTAGE_THRESHOLD_UPPER = 500 // Üst sınır: planned + 500
  const completionThreshold = Math.max(0, plannedQty - WASTAGE_THRESHOLD_LOWER)
  const completionThresholdUpper = plannedQty + WASTAGE_THRESHOLD_UPPER
  // Convert this entry to output UOM for calculation (if input is sheets, convert to cartoon)
  const thisEntryInOutputUOM = currentStageInputUOM === 'sheets' && currentStageOutputUOM === 'cartoon' && numberUp > 0
    ? convertToOutputUOM(qtyGood)
    : qtyGood
  const totalAfterThisEntry = totalProducedInStage + thisEntryInOutputUOM
  const remaining = plannedQty - totalAfterThisEntry
  const isIncomplete = plannedQty > 0 && (totalAfterThisEntry < completionThreshold || totalAfterThisEntry > completionThresholdUpper)
  const isWithinThreshold = plannedQty > 0 && totalAfterThisEntry >= completionThreshold && totalAfterThisEntry <= completionThresholdUpper && totalAfterThisEntry < plannedQty
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 sm:mx-0">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 rounded-t-2xl">
          <h3 className="text-lg font-semibold text-gray-900">Complete Job</h3>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-700">Mark <span className="font-medium text-blue-600">{job.code}</span> as <span className="font-medium text-green-600">DONE</span>?</p>

          {/* Completion Status based on total cartoon output */}
          {(() => {
            if (calculatedBoxes > 0 || plannedBoxes > 0) {
              return (
                <div className={`rounded-lg p-3 border ${canComplete ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
                  <div className="text-xs font-semibold mb-2">
                    {canComplete ? '✓ Completion Status:' : '⚠️ Completion Status:'}
                  </div>
                  <div className="text-xs text-gray-700 space-y-1">
                    <div className="flex justify-between">
                      <span>Total Cartoon Output:</span>
                      <span className="font-medium">{totalCartoonOutput.toLocaleString()} cartoon</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Calculated Boxes:</span>
                      <span className="font-medium">{calculatedBoxes.toFixed(1)} boxes</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Planned Boxes:</span>
                      <span className="font-medium">{plannedBoxes.toLocaleString()} boxes</span>
                    </div>
                    <div className="flex justify-between border-t pt-1 mt-1">
                      <span className={canComplete ? 'text-green-700 font-semibold' : 'text-amber-700 font-semibold'}>
                        {canComplete ? 'Status:' : 'Remaining:'}
                      </span>
                      <span className={canComplete ? 'text-green-700 font-semibold' : 'text-amber-700 font-semibold'}>
                        {canComplete
                          ? `✓ Complete (${calculatedBoxes >= plannedBoxes ? 'exceeded' : `${boxesDifference.toFixed(1)} boxes under tolerance`})`
                          : `${Math.abs(boxesDifference).toFixed(1)} boxes remaining (tolerance: 5 boxes)`}
                      </span>
                    </div>
                    {!canComplete && (
                      <div className="mt-1 text-xs text-amber-800">
                        Need at least {Math.max(0, plannedBoxes - BOX_TOLERANCE).toLocaleString()} boxes to complete.
                      </div>
                    )}
                  </div>
                </div>
              )
            }
            return null
          })()}

          {requireOutput && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-xs text-blue-800 mb-2">Output required before completion. Enter final production for current stage.</p>
              {plannedQty > 0 && (
                <div className="mb-2 p-2 bg-white rounded border border-gray-200">
                  <div className="text-xs text-gray-700">
                    <div className="flex justify-between mb-1">
                      <span>Planned ({plannedUOM}):</span>
                      <span className="font-medium">{plannedQty.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between mb-1">
                      <span>Produced (this stage):</span>
                      <span className="font-medium">{totalProducedInStage.toLocaleString()} {currentStageInputUOM && `(${currentStageInputUOM})`}</span>
                    </div>
                    <div className="flex justify-between mb-1">
                      <span>This entry:</span>
                      <span className="font-medium">{qtyGood.toLocaleString()} {currentStageInputUOM && `(${currentStageInputUOM})`}</span>
                    </div>
                    {currentStageOutputUOM === 'cartoon' && (
                      <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-800">
                        <span className="font-semibold">Note:</span> Planned quantity is in {plannedUOM} (based on {job.packaging?.plannedBoxes || boxItem?.qtyRequired || 'box'} boxes)
                      </div>
                    )}
                    {currentStageInputUOM === 'sheets' && currentStageOutputUOM === 'cartoon' && numberUp > 0 && (
                      <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-800">
                        <span className="font-semibold">Note:</span> Planned quantity is in {plannedUOM} (based on {job.packaging?.plannedBoxes || boxItem?.qtyRequired || 'box'} boxes × {job.packaging?.pcsPerBox || 1} pieces per box). Entry in sheets will be converted to cartoon using Number Up: 1 sheet = {numberUp} cartoon
                      </div>
                    )}
                    {currentStageInputUOM && currentStageOutputUOM && currentStageInputUOM !== currentStageOutputUOM && currentStageInputUOM !== 'sheets' && (
                      <div className="mt-2 p-2 bg-purple-50 border border-purple-200 rounded text-xs text-purple-800">
                        <span className="font-semibold">Conversion:</span> This stage converts {currentStageInputUOM} → {currentStageOutputUOM}
                      </div>
                    )}
                    <div className="flex justify-between border-t pt-1 mt-1">
                      <span className={isIncomplete ? 'text-amber-600 font-semibold' : isWithinThreshold ? 'text-blue-600 font-semibold' : 'text-green-600 font-semibold'}>
                        {isIncomplete ? 'Remaining:' : isWithinThreshold ? 'Status (within threshold):' : 'Status:'}
                      </span>
                      <span className={isIncomplete ? 'text-amber-600 font-semibold' : isWithinThreshold ? 'text-blue-600 font-semibold' : 'text-green-600 font-semibold'}>
                        {isIncomplete ? `${remaining.toLocaleString()} ${plannedUOM} remaining` : isWithinThreshold ? `Completed (${remaining.toLocaleString()} ${plannedUOM} under threshold) ✓` : 'Completed ✓'}
                      </span>
                    </div>
                    {isWithinThreshold && (
                      <div className="mt-1 text-xs text-blue-600">
                        Threshold: {completionThreshold.toLocaleString()} - {completionThresholdUpper.toLocaleString()} {plannedUOM} (planned -400 / +500)
                      </div>
                    )}
                  </div>
                </div>
              )}
              {isIncomplete && (
                <div className="mt-2 p-2 bg-amber-50 border border-amber-300 rounded text-xs text-amber-800">
                  ⚠️ Planned {plannedUOM} not completed (threshold: {completionThreshold.toLocaleString()} - {completionThresholdUpper.toLocaleString()} {plannedUOM}). You must complete between {completionThreshold.toLocaleString()} and {completionThresholdUpper.toLocaleString()} {plannedUOM} before completing the job.
                </div>
              )}
              {isWithinThreshold && (
                <div className="mt-2 p-2 bg-blue-50 border border-blue-300 rounded text-xs text-blue-800">
                  ✓ Within acceptable threshold (-400 / +500). {remaining.toLocaleString()} {plannedUOM} below planned, but completion is acceptable.
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-700">Date & Time</label>
                  <input type="datetime-local" value={runDateTime} onChange={(e) => setRunDateTime(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700">
                    Good Qty {currentStageInputUOM && `(${currentStageInputUOM})`}
                    {currentStageInputUOM && currentStageOutputUOM && currentStageInputUOM !== currentStageOutputUOM && numberUp > 0 && (
                      <span className="text-xs text-gray-500 ml-1 block">
                        → {convertToOutputUOM(qtyGood || 0).toFixed(2)} {currentStageOutputUOM}
                      </span>
                    )}
                  </label>
                  <input type="number" min={0} value={qtyGood} onChange={(e) => setQtyGood(Number(e.target.value))} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700">Scrap Qty {currentStageInputUOM && `(${currentStageInputUOM})`}</label>
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
          {requireOutput && (
            <button
              onClick={async () => {
                if (qtyGood <= 0) {
                  alert('Please enter Good Qty to add record.');
                  return
                }
                const savedQty = qtyGood
                const savedQtyOutputUOM = convertToOutputUOM(qtyGood)
                // Save in output UOM (cartoon) if conversion is needed
                const qtyGoodToSave = currentStageInputUOM === 'sheets' && currentStageOutputUOM === 'cartoon' && numberUp > 0
                  ? convertToOutputUOM(qtyGood)
                  : qtyGood
                const qtyScrapToSave = currentStageInputUOM === 'sheets' && currentStageOutputUOM === 'cartoon' && numberUp > 0 && qtyScrap > 0
                  ? convertToOutputUOM(qtyScrap)
                  : qtyScrap
                await onCreateRun({ qtyGood: qtyGoodToSave, qtyScrap: qtyScrapToSave || undefined, lot: lot || undefined, workcenterId, at: runDateTime ? new Date(runDateTime) : undefined } as any)
                queryClient.invalidateQueries({ queryKey: ['jobRuns', workspaceId, job.id] })
                queryClient.invalidateQueries({ queryKey: ['jobRuns', workspaceId, job.id, job.currentStageId] })
                // Also invalidate allJobRuns to update threshold checks immediately
                queryClient.invalidateQueries({ queryKey: ['allJobRuns', workspaceId] })
                setQtyGood(0)
                setQtyScrap(0)
                setLot('')
                const message = isIncomplete
                  ? `✓ Record added successfully!\n\nGood Qty: ${savedQty.toLocaleString()} ${currentStageInputUOM || ''} (${savedQtyOutputUOM.toFixed(2)} ${currentStageOutputUOM || currentStageInputUOM || ''})\nStage will remain until threshold (${completionThreshold.toLocaleString()} - ${completionThresholdUpper.toLocaleString()} ${plannedUOM}) is reached.`
                  : `✓ Record added successfully!\n\nGood Qty: ${savedQty.toLocaleString()} ${currentStageInputUOM || ''} (${savedQtyOutputUOM.toFixed(2)} ${currentStageOutputUOM || currentStageInputUOM || ''})\nThreshold reached. You can now complete the job using "Confirm Complete" button.`
                alert(message)
              }}
              className="px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors font-medium"
            >
              Add Record
            </button>
          )}
          <button
            onClick={async () => {
              // Check completion based on cartoon to box conversion
              if (!canComplete) {
                alert(`⚠️ Cannot complete: Box requirement not met.\n\nTotal Cartoon Output: ${totalCartoonOutput.toLocaleString()} cartoon\nCalculated Boxes: ${calculatedBoxes.toFixed(1)} boxes\nPlanned Boxes: ${plannedBoxes.toLocaleString()} boxes\nRemaining: ${Math.abs(boxesDifference).toFixed(1)} boxes\n\nTolerance: 5 boxes\nNeed at least ${Math.max(0, plannedBoxes - BOX_TOLERANCE).toLocaleString()} boxes to complete.`)
                return
              }

              // If there's new output entered, save it first
              if (requireOutput && qtyGood > 0) {
                // Save in output UOM (cartoon) if conversion is needed
                const qtyGoodToSave = currentStageInputUOM === 'sheets' && currentStageOutputUOM === 'cartoon' && numberUp > 0
                  ? convertToOutputUOM(qtyGood)
                  : qtyGood
                const qtyScrapToSave = currentStageInputUOM === 'sheets' && currentStageOutputUOM === 'cartoon' && numberUp > 0 && qtyScrap > 0
                  ? convertToOutputUOM(qtyScrap)
                  : qtyScrap
                await onCreateRun({ qtyGood: qtyGoodToSave, qtyScrap: qtyScrapToSave || undefined, lot: lot || undefined, workcenterId, at: runDateTime ? new Date(runDateTime) as any : undefined } as any)
                queryClient.invalidateQueries({ queryKey: ['jobRuns', workspaceId, job.id] })
                // Also invalidate allJobRuns to update threshold checks immediately
                queryClient.invalidateQueries({ queryKey: ['allJobRuns', workspaceId] })
              }

              // Show completion confirmation
              const finalBoxes = qtyGood > 0 && currentStageOutputUOM === 'cartoon'
                ? (totalCartoonOutput + (currentStageInputUOM === 'sheets' && numberUp > 0 ? convertToOutputUOM(qtyGood) : qtyGood)) / pcsPerBox
                : calculatedBoxes

              if (finalBoxes >= plannedBoxes) {
                alert(`✓ Job completed successfully!\n\nTotal Cartoon Output: ${(qtyGood > 0 && currentStageOutputUOM === 'cartoon' ? totalCartoonOutput + (currentStageInputUOM === 'sheets' && numberUp > 0 ? convertToOutputUOM(qtyGood) : qtyGood) : totalCartoonOutput).toLocaleString()} cartoon\nFinal Boxes: ${finalBoxes.toFixed(1)} boxes\nPlanned Boxes: ${plannedBoxes.toLocaleString()} boxes`)
              } else {
                alert(`✓ Job completed successfully!\n\nTotal Cartoon Output: ${(qtyGood > 0 && currentStageOutputUOM === 'cartoon' ? totalCartoonOutput + (currentStageInputUOM === 'sheets' && numberUp > 0 ? convertToOutputUOM(qtyGood) : qtyGood) : totalCartoonOutput).toLocaleString()} cartoon\nFinal Boxes: ${finalBoxes.toFixed(1)} boxes\nPlanned Boxes: ${plannedBoxes.toLocaleString()} boxes\nWithin tolerance (${(plannedBoxes - finalBoxes).toFixed(1)} boxes under)`)
              }

              onConfirm()
            }}
            className={`px-4 py-2 rounded-lg transition-colors font-medium ${!canComplete
              ? 'bg-gray-400 text-white cursor-not-allowed'
              : 'bg-green-600 text-white hover:bg-green-700'
              }`}
            disabled={!canComplete}
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
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 sm:mx-0">
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
  const [view, setView] = useState<'board' | 'list' | 'reports'>('list')
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
        (job.code || '').toLowerCase().includes(query) ||
        (job.productName || '').toLowerCase().includes(query) ||
        (job.customer?.name || '').toLowerCase().includes(query) ||
        (job.sku || '').toLowerCase().includes(query)
      if (!matchesSearch) return false
    }
    return true
  })

  // Open job if ?jobId= is present or create form if ?action=new
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search)
      const jId = params.get('jobId')
      const action = params.get('action')

      if (action === 'new') {
        setShowCreateForm(true)
        // Clean up URL but keep other params if any
        const newParams = new URLSearchParams(window.location.search)
        newParams.delete('action')
        const newUrl = newParams.toString() ? `${window.location.pathname}?${newParams.toString()}` : window.location.pathname
        window.history.replaceState({}, '', newUrl)
      } else if (jId && jobs.length > 0) {
        const match = jobs.find(j => j.id === jId)
        if (match) setSelectedJob(match)
      }
    } catch { }
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

  // Fetch all production runs for checking stage completion
  const { data: allRunsData = {} } = useQuery({
    queryKey: ['allJobRuns', workspaceId, filteredJobs.map(j => j.id).join(',')],
    queryFn: async () => {
      const runsMap: Record<string, any[]> = {}
      for (const job of filteredJobs.filter(j => j.status !== 'done' && j.status !== 'draft')) {
        try {
          const runs = await listJobProductionRuns(workspaceId, job.id)
          runsMap[job.id] = runs
        } catch {
          runsMap[job.id] = []
        }
      }
      return runsMap
    },
    enabled: filteredJobs.length > 0
  })

  // Helper function to check if stage threshold is met
  const checkStageThreshold = (job: Job, stageId: string, workflows: any[]) => {
    const WASTAGE_THRESHOLD_LOWER = 400 // Alt sınır: planned - 400
    const WASTAGE_THRESHOLD_UPPER = 500 // Üst sınır: planned + 500
    const runs = allRunsData[job.id] || []
    const stageRuns = runs.filter(r => r.stageId === stageId)

    // Get stage info for UOM
    const workflow = workflows.find(w => w.id === job.workflowId)
    const stageInfo = workflow?.stages?.find((s: any) => s.id === stageId)
    const stageOutputUOM = stageInfo?.outputUOM || ''

    // Total produced in stage
    // Note: If stage output is cartoon, runs are already saved in cartoon, so no conversion needed
    const totalProduced = stageRuns.reduce((sum, r) => sum + (r.qtyGood || 0), 0)

    // Find box item from BOM if output UOM is cartoon
    const boxItem = stageOutputUOM === 'cartoon' && Array.isArray(job.bom)
      ? job.bom.find((item: any) => {
        const uom = String(item.uom || '').toLowerCase()
        return uom === 'box' || uom === 'boxes'
      })
      : null

    // Find sheet item from BOM
    const sheetItem = Array.isArray(job.bom) ? job.bom.find((item: any) => {
      const uom = String(item.uom || '').toLowerCase()
      return uom === 'sht' || uom === 'sheet' || uom === 'sheets'
    }) : null

    // Calculate planned quantity based on stage output UOM
    let plannedQty: number
    if (stageOutputUOM === 'cartoon') {
      // If output is cartoon, calculate: plannedBoxes * pcsPerBox = planned cartoon
      const boxQty = job.packaging?.plannedBoxes
        || (boxItem ? Number(boxItem.qtyRequired || 0) : 0)
        || (job.unit === 'box' ? Number((job as any).quantity || 0) : 0)
      const pcsPerBox = job.packaging?.pcsPerBox || 1
      plannedQty = boxQty * pcsPerBox
    } else {
      // Find sheet item from BOM
      plannedQty = sheetItem ? Number(sheetItem.qtyRequired || 0) : ((job.output?.[0]?.qtyPlanned as number) || Number((job as any).quantity || 0))
    }

    const completionThresholdLower = Math.max(0, plannedQty - WASTAGE_THRESHOLD_LOWER)
    const completionThresholdUpper = plannedQty + WASTAGE_THRESHOLD_UPPER
    // Threshold met: alt sınır ile üst sınır arasında olmalı
    const isThresholdMet = plannedQty > 0 && totalProduced >= completionThresholdLower && totalProduced <= completionThresholdUpper
    return { totalProduced, plannedQty, completionThreshold: completionThresholdLower, completionThresholdUpper, isThresholdMet }
  }

  // Calculate jobs ready to move (stage completed but not moved to next)
  const jobsReadyToMove = useMemo(() => {
    const ready: Array<{ job: Job; currentStageName: string; nextStageName?: string }> = []

    for (const job of filteredJobs.filter(j => j.status !== 'done' && j.status !== 'draft')) {
      if (!job.currentStageId) continue

      const thresholdCheck = checkStageThreshold(job, job.currentStageId, workflows)
      if (thresholdCheck.isThresholdMet) {
        const currentStageName = getStageName(job.currentStageId)
        const workflow = workflows.find(w => w.stages?.some(s => s.id === job.currentStageId))
        const currentIndex = workflow?.stages?.findIndex(s => s.id === job.currentStageId) ?? -1
        const nextStage = currentIndex >= 0 && workflow?.stages && currentIndex + 1 < workflow.stages.length
          ? workflow.stages[currentIndex + 1]
          : undefined

        // Only add if there's a next stage (not at last stage)
        if (nextStage) {
          ready.push({
            job,
            currentStageName,
            nextStageName: nextStage?.name
          })
        }
      }
    }

    return ready
  }, [filteredJobs, allRunsData, workflows])

  // Calculate jobs ready to complete (at last stage and threshold met)
  const jobsReadyToComplete = useMemo(() => {
    const ready: Job[] = []

    for (const job of filteredJobs.filter(j => j.status !== 'done' && j.status !== 'draft')) {
      if (!job.currentStageId) continue

      const planned: string[] = (job as any).plannedStageIds || []
      const allStages = (workflows.find(w => w.id === job.workflowId) || workflows[0])?.stages || []
      const atLast = planned.length > 0
        ? planned[planned.length - 1] === job.currentStageId
        : (allStages.length > 0 && allStages[allStages.length - 1]?.id === job.currentStageId)

      if (atLast) {
        const thresholdCheck = checkStageThreshold(job, job.currentStageId, workflows)
        if (thresholdCheck.isThresholdMet) {
          ready.push(job)
        }
      }
    }

    return ready
  }, [filteredJobs, allRunsData, workflows])

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
      <div className="space-y-8">
        {/* Header Skeleton */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="h-8 bg-gray-200 rounded w-64 animate-pulse"></div>
            <div className="h-4 bg-gray-200 rounded w-96 mt-2 animate-pulse"></div>
          </div>
          <div className="flex gap-3">
            <div className="h-9 bg-gray-200 rounded w-24 animate-pulse"></div>
            <div className="h-9 bg-gray-200 rounded w-28 animate-pulse"></div>
          </div>
        </div>

        {/* Stats Skeleton */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="relative overflow-hidden">
              <div className="p-1">
                <div className="flex items-center justify-between">
                  <div className="h-4 bg-gray-200 rounded w-24 animate-pulse"></div>
                  <div className="h-10 w-10 bg-gray-200 rounded-md animate-pulse"></div>
                </div>
                <div className="mt-4">
                  <div className="h-8 bg-gray-200 rounded w-16 animate-pulse"></div>
                </div>
                <div className="mt-1">
                  <div className="h-3 bg-gray-200 rounded w-32 animate-pulse"></div>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Content Skeleton */}
        <Card>
          <div className="h-96 bg-gray-100 rounded animate-pulse"></div>
        </Card>
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
    <div className="space-y-8">
      {/* Header Section - Matching Dashboard Style */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Production Management</h1>
          <p className="mt-1 text-sm text-gray-500">
            Plan, execute, and analyze production workflows and job management.
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
          >
            <FunnelIcon className="h-4 w-4 mr-2" />
            Filters
            {(filters.status.length > 0 || filters.stageId || filters.workcenterId || filters.assigneeId || filters.priority.length > 0) && (
              <span className="ml-2 bg-blue-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {filters.status.length + (filters.stageId ? 1 : 0) + (filters.workcenterId ? 1 : 0) + (filters.assigneeId ? 1 : 0) + filters.priority.length}
              </span>
            )}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => downloadCSV('production_jobs.csv', toCSV(filteredJobs))}
          >
            <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setShowCreateForm(true)}
          >
            <PlusIcon className="h-4 w-4 mr-2" />
            Create Job
          </Button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
        <input
          type="text"
          placeholder="Search jobs, products, customers..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-10 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors text-sm"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <Card className="bg-gray-50">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
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
                        setFilters({ ...filters, status: newStatus })
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
                onChange={(e) => setFilters({ ...filters, workcenterId: e.target.value })}
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
                onChange={(e) => setFilters({ ...filters, assigneeId: e.target.value })}
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
                onChange={(e) => setFilters({ ...filters, dueBefore: e.target.value ? new Date(e.target.value) : undefined })}
                className="w-full rounded-lg border-gray-300 focus:border-blue-500 focus:ring-blue-500 py-2.5"
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mt-4 pt-4 border-t border-gray-200">
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
        </Card>
      )}

      {/* Primary Stats Grid - Matching Dashboard Style */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Jobs */}
        <Card className="relative overflow-hidden border-l-4 border-l-primary-500">
          <div className="p-1">
            <div className="flex items-center justify-between">
              <p className="truncate text-sm font-medium text-gray-500">Total Jobs</p>
              <div className="rounded-md bg-primary-50 p-2">
                <ChartBarIcon className="h-5 w-5 text-primary-600" aria-hidden="true" />
              </div>
            </div>
            <div className="mt-4 flex items-baseline">
              {jobsLoading ? (
                <div className="h-8 w-16 animate-pulse bg-gray-200 rounded" />
              ) : (
                <p className="text-3xl font-semibold text-gray-900">{filteredJobs.length}</p>
              )}
            </div>
            <div className="mt-1">
              <p className="text-xs text-gray-500">{filteredJobs.filter(j => j.status === 'in_progress').length} in progress</p>
            </div>
          </div>
        </Card>

        {/* In Progress */}
        <Card className="relative overflow-hidden border-l-4 border-l-yellow-500">
          <div className="p-1">
            <div className="flex items-center justify-between">
              <p className="truncate text-sm font-medium text-gray-500">In Progress</p>
              <div className="rounded-md bg-yellow-50 p-2">
                <ClockIcon className="h-5 w-5 text-yellow-600" aria-hidden="true" />
              </div>
            </div>
            <div className="mt-4 flex items-baseline">
              {jobsLoading ? (
                <div className="h-8 w-16 animate-pulse bg-gray-200 rounded" />
              ) : (
                <p className="text-3xl font-semibold text-gray-900">
                  {filteredJobs.filter(job => job.status === 'in_progress').length}
                </p>
              )}
            </div>
            <div className="mt-1">
              <p className="text-xs text-gray-500">{filteredJobs.filter(j => j.status === 'released').length} ready to start</p>
            </div>
          </div>
        </Card>

        {/* Blocked */}
        <Card className="relative overflow-hidden border-l-4 border-l-red-500">
          <div className="p-1">
            <div className="flex items-center justify-between">
              <p className="truncate text-sm font-medium text-gray-500">Blocked</p>
              <div className="rounded-md bg-red-50 p-2">
                <ExclamationTriangleIcon className="h-5 w-5 text-red-600" aria-hidden="true" />
              </div>
            </div>
            <div className="mt-4 flex items-baseline">
              {jobsLoading ? (
                <div className="h-8 w-16 animate-pulse bg-gray-200 rounded" />
              ) : (
                <p className="text-3xl font-semibold text-gray-900">
                  {filteredJobs.filter(job => job.status === 'blocked').length}
                </p>
              )}
            </div>
            <div className="mt-1">
              <p className="text-xs text-gray-500">Needs attention</p>
            </div>
          </div>
        </Card>

        {/* Completed */}
        <Card className="relative overflow-hidden border-l-4 border-l-emerald-500">
          <div className="p-1">
            <div className="flex items-center justify-between">
              <p className="truncate text-sm font-medium text-gray-500">Completed</p>
              <div className="rounded-md bg-emerald-50 p-2">
                <CheckIcon className="h-5 w-5 text-emerald-600" aria-hidden="true" />
              </div>
            </div>
            <div className="mt-4 flex items-baseline">
              {jobsLoading ? (
                <div className="h-8 w-16 animate-pulse bg-gray-200 rounded" />
              ) : (
                <p className="text-3xl font-semibold text-gray-900">
                  {filteredJobs.filter(job => job.status === 'done').length}
                </p>
              )}
            </div>
            <div className="mt-1">
              <p className="text-xs text-gray-500">
                {filteredJobs.filter(j => j.status === 'done' && isThisWeek(new Date(j.updatedAt))).length} this week
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Enhanced View Controls */}
      <Card className="p-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-2 w-full lg:w-auto justify-between lg:justify-start">
            {/* View Toggle */}
            <div className="flex bg-gray-100 p-1 rounded-lg">
              <button
                onClick={() => setView('board')}
                className={`px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-all flex items-center gap-1.5 sm:gap-2 ${view === 'board'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
                  }`}
              >
                <Squares2X2Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Board</span>
              </button>
              <button
                onClick={() => setView('list')}
                className={`px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-all flex items-center gap-1.5 sm:gap-2 ${view === 'list'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
                  }`}
              >
                <ViewColumnsIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">List</span>
              </button>
              <button
                onClick={() => setView('reports')}
                className={`px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-all flex items-center gap-1.5 sm:gap-2 ${view === 'reports'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
                  }`}
              >
                <ChartBarIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Reports</span>
              </button>
            </div>

            {/* View Info */}
            <div className="text-xs sm:text-sm text-gray-500 hidden sm:block">
              {view === 'board' ? 'Visual workflow' : view === 'list' ? 'Detailed list' : 'Analytics & Reports'}
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            {/* Board Controls */}
            {view === 'board' && (
              <>
                <div className="hidden sm:flex items-center gap-1 bg-gray-50 rounded-lg p-1">
                  <button
                    onClick={() => { const z = Math.max(0.5, Math.round((zoom - 0.1) * 10) / 10); setZoom(z); try { localStorage.setItem('boardZoom', String(z)) } catch { } }}
                    className="p-1.5 sm:p-2 rounded-md text-xs sm:text-sm font-medium text-gray-700 hover:bg-white transition-colors"
                    title="Zoom out"
                  >
                    −
                  </button>
                  <span className="px-2 sm:px-3 text-xs sm:text-sm text-gray-700 w-12 sm:w-16 text-center font-medium">{Math.round(zoom * 100)}%</span>
                  <button
                    onClick={() => { const z = Math.min(2, Math.round((zoom + 0.1) * 10) / 10); setZoom(z); try { localStorage.setItem('boardZoom', String(z)) } catch { } }}
                    className="p-1.5 sm:p-2 rounded-md text-xs sm:text-sm font-medium text-gray-700 hover:bg-white transition-colors"
                    title="Zoom in"
                  >
                    +
                  </button>
                </div>

                <button
                  onClick={() => setFitToScreen(v => !v)}
                  className={`px-3 sm:px-4 py-1.5 sm:py-2.5 rounded-lg text-xs sm:text-sm font-medium inline-flex items-center gap-1.5 sm:gap-2 transition-colors ${fitToScreen
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                    }`}
                >
                  <span className="hidden sm:inline">{fitToScreen ? 'Fit: On' : 'Fit: Off'}</span>
                  <span className="sm:hidden">{fitToScreen ? 'Fit' : 'Fit'}</span>
                </button>
              </>
            )}

            {/* Fullscreen Toggle */}
            <button
              onClick={toggleFullscreen}
              className="px-3 sm:px-4 py-1.5 sm:py-2.5 rounded-lg text-xs sm:text-sm font-medium inline-flex items-center gap-1.5 sm:gap-2 bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 transition-colors"
              title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
            >
              {isFullscreen ? (
                <ArrowsPointingInIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              ) : (
                <ArrowsPointingOutIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              )}
              <span className="hidden sm:inline">{isFullscreen ? 'Exit' : 'Fullscreen'}</span>
              <span className="sm:hidden">{isFullscreen ? 'Exit' : 'Full'}</span>
            </button>
          </div>
        </div>
      </Card>

      {/* Main Content */}
      {view === 'board' ? (
        <div
          ref={boardRef}
          className={`bg-white rounded-xl sm:rounded-2xl shadow-sm border border-gray-100 overflow-hidden relative transition-all ${isFullscreen
            ? 'fixed inset-0 z-50 m-0 rounded-none'
            : 'h-[calc(100vh-200px)] sm:h-[calc(100vh-280px)] min-h-[400px] sm:min-h-[600px]'
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
      ) : view === 'reports' ? (
        <ProductionReportsTab workspaceId={workspaceId} />
      ) : (
        <>
          {/* Mobile Search Bar - Sticky for easy access */}
          <div className="md:hidden sticky top-0 z-10 bg-white rounded-xl shadow-sm border border-gray-100 p-3 mb-3">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search jobs, products, customers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-10 py-2.5 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
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
          </div>

          <div className="bg-white rounded-xl sm:rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {/* Mobile Card List View */}
            <div className="md:hidden space-y-4 p-4">
              {filteredJobs.map((job) => {
                const isReadyToMove = jobsReadyToMove.some(r => r.job.id === job.id)
                const stageName = job.status === 'draft' ? '-' : (job.status === 'done' ? 'DONE' : getStageName(job.currentStageId))

                // Calculate actions logic
                const planned: string[] = (job as any).plannedStageIds || []
                const allStages = (workflows.find(w => w.id === job.workflowId) || workflows[0])?.stages || []
                const currentIdx = planned.length > 0 ? planned.indexOf(job.currentStageId) : allStages.findIndex((s: any) => s.id === job.currentStageId)
                const nextId = planned.length > 0 ? planned[currentIdx + 1] : (allStages[currentIdx + 1]?.id)
                const nextName = nextId ? (allStages.find((s: any) => s.id === nextId)?.name || 'Next') : null
                const canShowNextStage = nextId && (job.status === 'released' || job.status === 'in_progress')
                const requireOutput = ((job as any).requireOutputToAdvance !== false)
                const thresholdCheck = checkStageThreshold(job, job.currentStageId, workflows)
                const isThresholdMet = thresholdCheck.isThresholdMet
                const isReady = requireOutput ? isThresholdMet : true

                const renderActions = () => (
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      {job.status === 'draft' && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleStatusChange(job.id, 'released') }}
                          className="text-white bg-blue-600 hover:bg-blue-700 font-semibold text-sm px-4 py-2 rounded-lg shadow-sm transition-colors"
                        >
                          Release
                        </button>
                      )}

                      {(job.status === 'released' || job.status === 'in_progress') && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            if (canShowNextStage) {
                              setConfirmMove({ open: true, job, targetStageId: nextId!, targetStageName: nextName || 'Next' })
                            } else {
                              const currentStageName = getStageName(job.currentStageId)
                              setConfirmMove({ open: true, job, targetStageId: job.currentStageId, targetStageName: currentStageName })
                            }
                          }}
                          className="text-white bg-green-600 hover:bg-green-700 font-semibold text-sm px-4 py-2 rounded-lg shadow-sm transition-colors"
                        >
                          Output
                        </button>
                      )}

                      {canShowNextStage && isReady && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!(job.status === 'released' || job.status === 'in_progress')) {
                              setRequireRelease({ open: true, job, targetStageId: nextId!, targetStageName: nextName || 'Next' })
                              return
                            }
                            setConfirmMove({ open: true, job, targetStageId: nextId!, targetStageName: nextName || 'Next' })
                          }}
                          className="text-white bg-gray-700 hover:bg-gray-800 font-semibold text-sm px-4 py-2 rounded-lg shadow-sm transition-colors"
                        >
                          Next Stage
                        </button>
                      )}
                    </div>

                    <button
                      onClick={(e) => { e.stopPropagation(); setSelectedJob(job) }}
                      className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 font-semibold text-sm px-4 py-2 rounded-lg transition-colors"
                    >
                      Details
                    </button>
                  </div>
                )

                return (
                  <div
                    key={job.id}
                    className="bg-white p-5 sm:p-4 active:bg-gray-50 transition-colors rounded-lg shadow-sm border border-gray-200"
                  >
                    {/* Top Row: Job Code, Status, Date */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2.5 flex-1 min-w-0">
                        <span className="font-bold text-lg text-gray-900 truncate">{job.code}</span>
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${getStatusColor(job.status)} whitespace-nowrap flex-shrink-0`}>
                          {job.status.replace('_', ' ').toUpperCase()}
                        </span>
                      </div>
                      <div className="text-right flex-shrink-0 ml-3">
                        <div className="text-xs font-semibold text-gray-600">{formatDate(job.dueDate)}</div>
                      </div>
                    </div>

                    {/* Customer Name */}
                    <div className="mb-3">
                      <div className="text-sm font-semibold text-gray-800 uppercase tracking-wide">
                        {job.customer.name}
                      </div>
                    </div>

                    {/* Product Info */}
                    <div className="mb-3 space-y-2">
                      {job.sku && (
                        <div className="flex items-center gap-2">
                          <span className="bg-gray-100 text-gray-700 px-2.5 py-1 rounded-md text-xs font-semibold">
                            {job.sku}
                          </span>
                        </div>
                      )}
                      <div className="text-sm text-gray-600 leading-relaxed">
                        {job.productName}
                      </div>
                    </div>

                    {/* Stage Info & Ready Badge */}
                    {(stageName !== '-' && stageName !== 'DONE') || isReadyToMove ? (
                      <div className="flex items-center gap-2 mb-3 flex-wrap">
                        {stageName !== '-' && stageName !== 'DONE' && (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 text-blue-700 rounded-md text-xs font-semibold border border-blue-200">
                            <span>{stageName}</span>
                          </div>
                        )}
                        {isReadyToMove && (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-orange-50 text-orange-700 rounded-md text-xs font-semibold border border-orange-200">
                            <ArrowRightIcon className="h-3.5 w-3.5" />
                            <span>Ready for next stage</span>
                          </div>
                        )}
                      </div>
                    ) : null}

                    {/* Actions Row */}
                    <div onClick={(e) => e.stopPropagation()} className="pt-3 border-t border-gray-200">
                      {renderActions()}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block">
              <DataTable
                data={filteredJobs.map(job => {
                  const isReadyToMove = jobsReadyToMove.some(r => r.job.id === job.id)
                  return { ...job, _isReadyToMove: isReadyToMove }
                })}
                columns={listColumns.map(col => {
                  if (col.key === 'currentStageId') {
                    return {
                      ...col,
                      render: (_value: string, item: any) => {
                        const stageName = item.status === 'draft' ? '-' : (item.status === 'done' ? 'DONE' : getStageName(item.currentStageId))
                        const isReady = item._isReadyToMove
                        return (
                          <div className="flex items-center gap-2">
                            <span>{stageName}</span>
                            {isReady && (
                              <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full text-xs font-medium flex items-center gap-1">
                                <ArrowRightIcon className="h-3 w-3" />
                                Ready
                              </span>
                            )}
                          </div>
                        )
                      }
                    }
                  }
                  return col
                })}
                onRowClick={setSelectedJob}
                renderActions={(job) => {
                  const planned: string[] = (job as any).plannedStageIds || []
                  const allStages = (workflows.find(w => w.id === job.workflowId) || workflows[0])?.stages || []
                  const currentIdx = planned.length > 0 ? planned.indexOf(job.currentStageId) : allStages.findIndex((s: any) => s.id === job.currentStageId)
                  const nextId = planned.length > 0 ? planned[currentIdx + 1] : (allStages[currentIdx + 1]?.id)
                  const nextName = nextId ? (allStages.find((s: any) => s.id === nextId)?.name || 'Next') : null
                  const canShowNextStage = nextId && (job.status === 'released' || job.status === 'in_progress')
                  const requireOutput = ((job as any).requireOutputToAdvance !== false)
                  const thresholdCheck = checkStageThreshold(job, job.currentStageId, workflows)
                  const isThresholdMet = thresholdCheck.isThresholdMet
                  const isReady = requireOutput ? isThresholdMet : true

                  return (
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

                      {/* Add Output button - always visible when job is released/in_progress */}
                      {(job.status === 'released' || job.status === 'in_progress') && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            // Always open move modal for output entry (even if no next stage)
                            if (canShowNextStage) {
                              setConfirmMove({ open: true, job, targetStageId: nextId!, targetStageName: nextName || 'Next' })
                            } else {
                              // If no next stage, open modal with dummy target (just for output entry)
                              const currentStageName = getStageName(job.currentStageId)
                              setConfirmMove({ open: true, job, targetStageId: job.currentStageId, targetStageName: currentStageName })
                            }
                          }}
                          className="text-white bg-green-600 hover:bg-green-700 font-medium text-sm px-3 py-1.5 rounded-lg shadow-sm border border-transparent transition-colors"
                          title="Add production output"
                        >
                          Add Output
                        </button>
                      )}

                      {/* Next Stage button - only if there's a next stage AND threshold is met */}
                      {canShowNextStage && isReady && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!(job.status === 'released' || job.status === 'in_progress')) {
                              setRequireRelease({ open: true, job, targetStageId: nextId!, targetStageName: nextName || 'Next' })
                              return
                            }
                            setConfirmMove({ open: true, job, targetStageId: nextId!, targetStageName: nextName || 'Next' })
                          }}
                          className="text-sm px-3 py-1.5 rounded-lg shadow-sm border border-transparent transition-colors text-white bg-gray-700 hover:bg-gray-800"
                          title={`Move to ${nextName}`}
                        >
                          Next Stage
                        </button>
                      )}

                      {(() => {
                        const isReadyToComplete = jobsReadyToComplete.some(j => j.id === job.id)
                        const canShowComplete = isReadyToComplete && job.status !== 'done' && job.status !== 'cancelled'
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
                  )
                }}
              />
            </div>
          </div>
        </>
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
        <ConfirmStageChangeModal
          job={confirmMove.job}
          currentStageName={getStageName(confirmMove.job.currentStageId)}
          targetStageName={confirmMove.targetStageName || 'Next stage'}
          workcenters={workcenters}
          workspaceId={workspaceId}
          workflows={workflows}
          onCancel={() => setConfirmMove({ open: false })}
          onCreateRun={async ({ qtyGood, qtyScrap, lot, workcenterId, at }) => {
            await createProductionRun(workspaceId, confirmMove.job!.id, {
              stageId: confirmMove.job!.currentStageId,
              workcenterId,
              qtyGood,
              qtyScrap,
              lot,
              operatorId: 'current-user',
              at
            } as any)
            // Invalidate allJobRuns to update threshold checks immediately
            queryClient.invalidateQueries({ queryKey: ['allJobRuns', workspaceId] })
          }}
          onConfirm={(note) => { moveJobMutation.mutate({ jobId: confirmMove.job!.id, newStageId: confirmMove.targetStageId!, note }); setConfirmMove({ open: false }) }}
          onComplete={() => {
            // Modal handles completion internally, just close it
            setConfirmMove({ open: false })
          }}
        />
      )}

      {confirmComplete.open && confirmComplete.job && (
        <ConfirmCompleteModal
          job={confirmComplete.job}
          workcenters={workcenters}
          workspaceId={workspaceId}
          workflows={workflows}
          onCancel={() => setConfirmComplete({ open: false })}
          onCreateRun={async ({ qtyGood, qtyScrap, lot, workcenterId, at }) => {
            await createProductionRun(workspaceId, confirmComplete.job!.id, {
              stageId: confirmComplete.job!.currentStageId,
              workcenterId,
              qtyGood,
              qtyScrap,
              lot,
              operatorId: 'current-user',
              at
            } as any)
            // Invalidate allJobRuns to update threshold checks immediately
            queryClient.invalidateQueries({ queryKey: ['allJobRuns', workspaceId] })
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
  )
}