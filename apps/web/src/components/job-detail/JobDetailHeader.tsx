import { type FC } from 'react'
import { downloadJobPDF } from '../../utils/pdfGenerator'
import {
  ArrowDownTrayIcon,
  ChevronRightIcon,
  DocumentTextIcon,
  TruckIcon,
  XMarkIcon,
  TrashIcon,
} from '@heroicons/react/24/outline'
import type { Job, Workflow, ProductionRun } from '../../api/production-jobs'
import type { UseMutationResult } from '@tanstack/react-query'

interface JobDetailHeaderProps {
  job: Job
  effectiveJob: Job
  workflows: Workflow[]
  allRuns: ProductionRun[]
  showExportMenu: boolean
  showPostToInventoryPrompt: boolean
  onClose: () => void
  onDelete?: (jobId: string) => void
  setShowExportMenu: React.Dispatch<React.SetStateAction<boolean>>
  setShowPrintForm: React.Dispatch<React.SetStateAction<boolean>>
  setShowCreatePrintForm: React.Dispatch<React.SetStateAction<boolean>>
  setShowDeliveryNoteModal: React.Dispatch<React.SetStateAction<boolean>>
  setShowCompleteModal: React.Dispatch<React.SetStateAction<boolean>>
  setShowPostToInventoryPrompt: React.Dispatch<React.SetStateAction<boolean>>
  setStatusMutation: UseMutationResult<any, unknown, Job['status'], unknown>
  handleCompleteJob: (postToInventory: boolean) => Promise<void> | void
  getStatusColor: (status: string) => string
  getStatusIcon: (status: string) => FC<React.SVGProps<SVGSVGElement>>
}

export const JobDetailHeader: FC<JobDetailHeaderProps> = ({
  job,
  effectiveJob,
  workflows,
  allRuns,
  showExportMenu,
  showPostToInventoryPrompt,
  onClose,
  onDelete,
  setShowExportMenu,
  setShowPrintForm,
  setShowCreatePrintForm,
  setShowDeliveryNoteModal,
  setShowCompleteModal,
  setShowPostToInventoryPrompt,
  setStatusMutation,
  handleCompleteJob,
  getStatusColor,
  getStatusIcon,
}) => {
  const planned: string[] = (effectiveJob as any).plannedStageIds || []
  const isLastStage =
    effectiveJob.currentStageId &&
    planned.length > 0 &&
    planned[planned.length - 1] === effectiveJob.currentStageId

  const isThresholdMet = () => {
    if (!isLastStage || !effectiveJob.currentStageId || !allRuns || allRuns.length === 0) return false

    const workflow = workflows.find((w: any) => w.id === effectiveJob.workflowId)
    const stageInfo = workflow?.stages?.find((s: any) => s.id === effectiveJob.currentStageId)
    const stageInputUOM = stageInfo?.inputUOM || ''
    const stageOutputUOM = stageInfo?.outputUOM || ''
    const numberUp = effectiveJob.productionSpecs?.numberUp || 1

    const stageRuns = allRuns.filter((r: any) => r.stageId === effectiveJob.currentStageId)
    const totalProduced = stageRuns.reduce((sum: number, r: any) => sum + Number(r.qtyGood || 0), 0)

    const currentStageIndex = planned.indexOf(effectiveJob.currentStageId)
    const previousStageId = currentStageIndex > 0 ? planned[currentStageIndex - 1] : null

    let plannedQty: number
    if (previousStageId) {
      const previousStageRuns = allRuns.filter((r: any) => r.stageId === previousStageId)
      const previousStageTotalOutput = previousStageRuns.reduce((sum: number, r: any) => sum + Number(r.qtyGood || 0), 0)
      if (previousStageTotalOutput > 0) {
        const previousStageInfo = workflow?.stages?.find((s: any) => s.id === previousStageId)
        const previousStageOutputUOM = previousStageInfo?.outputUOM || ''

        let currentInput: number
        if (previousStageOutputUOM === stageInputUOM) {
          currentInput = previousStageTotalOutput
        } else if (previousStageOutputUOM === 'cartoon' && stageInputUOM === 'sheets' && numberUp > 0) {
          currentInput = previousStageTotalOutput / numberUp
        } else if (previousStageOutputUOM === 'sheets' && stageInputUOM === 'cartoon' && numberUp > 0) {
          currentInput = previousStageTotalOutput * numberUp
        } else {
          currentInput = previousStageTotalOutput
        }

        if (stageInputUOM === stageOutputUOM) {
          plannedQty = currentInput
        } else if (stageInputUOM === 'sheets' && stageOutputUOM === 'cartoon' && numberUp > 0) {
          plannedQty = currentInput * numberUp
        } else if (stageInputUOM === 'cartoon' && stageOutputUOM === 'sheets' && numberUp > 0) {
          plannedQty = currentInput / numberUp
        } else {
          plannedQty = currentInput
        }
      } else {
        plannedQty = 0
      }
    } else {
      if (stageOutputUOM === 'cartoon') {
        const boxQty = effectiveJob.packaging?.plannedBoxes || 0
        const pcsPerBox = effectiveJob.packaging?.pcsPerBox || 1
        plannedQty = boxQty * pcsPerBox
      } else {
        const bom = Array.isArray(effectiveJob.bom) ? effectiveJob.bom : []
        const sheetItem = bom.find((item: any) => {
          const uom = String(item.uom || '').toLowerCase()
          return ['sht', 'sheet', 'sheets'].includes(uom)
        })
        plannedQty = sheetItem ? Number(sheetItem.qtyRequired || 0) : (effectiveJob.output?.[0]?.qtyPlanned || Number((effectiveJob as any).quantity || 0))
      }
    }

    const WASTAGE_THRESHOLD_LOWER = 400
    const completionThreshold = Math.max(0, plannedQty - WASTAGE_THRESHOLD_LOWER)

    return totalProduced >= completionThreshold
  }

  const canComplete =
    (effectiveJob.status === 'released' || effectiveJob.status === 'in_progress') &&
    isLastStage &&
    isThresholdMet()

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 sm:p-6 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white gap-4">
        <div className="flex items-center justify-between w-full sm:w-auto">
          <div className="flex items-center space-x-4">
            <div className="flex-shrink-0">
              <div className={`w-3 h-10 rounded-full ${getStatusColor(job.status).split(' ')[0]}`} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center space-x-3 flex-wrap gap-y-2">
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900 truncate">{job.code || (job as any).jobCode || job.id}</h2>
                <span className={`inline-flex items-center px-3 py-1 rounded-full border text-xs sm:text-sm font-medium ${getStatusColor(job.status)} whitespace-nowrap`}>
                  {(() => {
                    const Icon = getStatusIcon(job.status)
                    return <Icon className="h-4 w-4 mr-1" />
                  })()}
                  {job.status.replace('_', ' ').toUpperCase()}
                </span>
              </div>
              <p className="text-sm text-gray-600 mt-1 truncate">{job.productName} • {job.quantity} {job.unit}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="sm:hidden p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors duration-200"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative group export-menu-container">
            <button
              onClick={() => setShowExportMenu((prev) => !prev)}
              className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg flex items-center gap-2 transition-colors"
              title="Export Documents"
            >
              <ArrowDownTrayIcon className="h-5 w-5" />
              <span className="hidden sm:inline text-sm font-medium">Export</span>
              <ChevronRightIcon className={`h-4 w-4 transition-transform ${showExportMenu ? 'rotate-90' : ''}`} />
            </button>

            <div
              className={`absolute left-0 right-0 sm:left-auto sm:right-0 top-full mt-1 w-auto sm:w-56 min-w-[280px] sm:min-w-0 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50 transition-all duration-200 ${
                showExportMenu ? 'opacity-100 visible' : 'opacity-0 invisible group-hover:opacity-100 group-hover:visible'
              }`}
              style={{
                maxWidth: 'calc(100vw - 1rem)',
              }}
            >
              <button
                onClick={() => {
                  setShowPrintForm(true)
                  setShowExportMenu(false)
                }}
                className="w-full px-4 py-2.5 text-left hover:bg-indigo-50 flex items-center gap-3 transition-colors group/item"
                title="Print Production Order Form"
              >
                <div className="w-8 h-8 bg-indigo-100 rounded flex items-center justify-center group-hover/item:bg-indigo-200">
                  <DocumentTextIcon className="h-4 w-4 text-indigo-600" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-900">Print Order</div>
                  <div className="text-xs text-gray-500">Print production order form</div>
                </div>
              </button>

              <button
                onClick={() => {
                  setShowCreatePrintForm(true)
                  setShowExportMenu(false)
                }}
                className="w-full px-4 py-2.5 text-left hover:bg-purple-50 flex items-center gap-3 transition-colors group/item"
                title="Create Production Order Form"
              >
                <div className="w-8 h-8 bg-purple-100 rounded flex items-center justify-center group-hover/item:bg-purple-200">
                  <DocumentTextIcon className="h-4 w-4 text-purple-600" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-900">Create Order</div>
                  <div className="text-xs text-gray-500">Create production order form</div>
                </div>
              </button>

              <button
                onClick={() => {
                  setShowDeliveryNoteModal(true)
                  setShowExportMenu(false)
                }}
                className="w-full px-4 py-2.5 text-left hover:bg-orange-50 flex items-center gap-3 transition-colors group/item"
                title="Delivery Note"
              >
                <div className="w-8 h-8 bg-orange-100 rounded flex items-center justify-center group-hover/item:bg-orange-200">
                  <TruckIcon className="h-4 w-4 text-orange-600" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-900">Delivery Note</div>
                  <div className="text-xs text-gray-500">Delivery documentation</div>
                </div>
              </button>

              <div className="border-t border-gray-100 my-1"></div>

              <button
                onClick={async () => {
                  try {
                    await downloadJobPDF(effectiveJob)
                    setShowExportMenu(false)
                  } catch (error) {
                    console.error('PDF download failed:', error)
                    const errorMessage = error instanceof Error ? error.message : 'PDF indirilemedi. Lütfen tekrar deneyin.'
                    alert(errorMessage)
                  }
                }}
                className="w-full px-4 py-2.5 text-left hover:bg-green-50 flex items-center gap-3 transition-colors group/item"
                title="Production Order PDF"
              >
                <div className="w-8 h-8 bg-green-100 rounded flex items-center justify-center group-hover/item:bg-green-200">
                  <DocumentTextIcon className="h-4 w-4 text-green-600" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-900">Production Order</div>
                  <div className="text-xs text-gray-500">Complete job details PDF</div>
                </div>
              </button>
            </div>
          </div>

          {job.status === 'draft' && (
            <button
              onClick={() => setStatusMutation.mutate('released')}
              className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 whitespace-nowrap"
            >
              Release
            </button>
          )}

          {canComplete ? (
            <button
              onClick={() => setShowCompleteModal(true)}
              className="px-3 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 whitespace-nowrap"
            >
              Complete
            </button>
          ) : null}

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
            className="hidden sm:block p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors duration-200"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>
      </div>

      {showPostToInventoryPrompt && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full">
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
                onClick={() => handleCompleteJob(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Hayır
              </button>
              <button
                onClick={() => handleCompleteJob(true)}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
              >
                Evet
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}



