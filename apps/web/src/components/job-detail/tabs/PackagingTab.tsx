import { useState, useEffect, useMemo, type FC } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CubeIcon, TruckIcon, PencilIcon } from '@heroicons/react/24/outline'
import type { Job, ProductionRun, Workflow } from '../../../api/production-jobs'
import { listJobProductionRuns, updateJob } from '../../../api/production-jobs'

interface PackagingTabProps {
  job: Job
  workspaceId: string
  workflows?: Workflow[]
  allRuns?: ProductionRun[]
}

export const PackagingTab: FC<PackagingTabProps> = ({ job, workspaceId, workflows = [], allRuns = [] }) => {
  const queryClient = useQueryClient()

  const { data: runs = [] } = useQuery<ProductionRun[]>({
    queryKey: ['jobRuns', workspaceId, job.id],
    queryFn: () => listJobProductionRuns(workspaceId, job.id),
    enabled: !!workspaceId && !!job?.id && allRuns.length === 0,
  })
  const productionRuns = allRuns.length > 0 ? allRuns : runs

  const calculateActualFromRuns = useMemo(() => {
    if (!productionRuns || productionRuns.length === 0) {
      return { actualBoxes: 0, actualPallets: 0 }
    }

    const workflow = workflows.find((w: any) => w.id === job.workflowId)
    const plannedStages: string[] = Array.isArray((job as any).plannedStageIds) ? (job as any).plannedStageIds : []
    const lastStageId = plannedStages.length > 0 ? plannedStages[plannedStages.length - 1] : job.currentStageId

    let lastCartoonStageId: string | null = null
    for (let i = plannedStages.length - 1; i >= 0; i--) {
      const stageId = plannedStages[i]
      const stageInfo = workflow?.stages?.find((s: any) => s.id === stageId)
      if (stageInfo?.outputUOM === 'cartoon') {
        lastCartoonStageId = stageId
        break
      }
    }

    const targetStageId = lastCartoonStageId || lastStageId
    // Filter runs for target stage, excluding transfer runs (WIP transfers, not actual production)
    const targetStageRuns = productionRuns.filter((r: any) => {
      if (r.stageId !== targetStageId) return false
      // Exclude transfer runs (these are WIP transfers, not actual production)
      if ((r as any).transferSourceRunIds && Array.isArray((r as any).transferSourceRunIds) && (r as any).transferSourceRunIds.length > 0) {
        return false
      }
      return true
    })

    const totalCartoonOutput = targetStageRuns.reduce((sum: number, r: any) => {
      return sum + Number(r.qtyGood || 0)
    }, 0)

    const pcsPerBox = job.packaging?.pcsPerBox || 1
    const calculatedActualBoxes = pcsPerBox > 0 ? Math.ceil(totalCartoonOutput / pcsPerBox) : 0

    const boxesPerPallet = job.packaging?.boxesPerPallet || 1
    const calculatedActualPallets = boxesPerPallet > 0 ? Math.ceil(calculatedActualBoxes / boxesPerPallet) : 0

    return {
      actualBoxes: calculatedActualBoxes,
      actualPallets: calculatedActualPallets,
      totalCartoonOutput
    }
  }, [productionRuns, job, workflows])

  const packaging = job.packaging as any
  const pcsPerBox = packaging?.pcsPerBox || packaging?.planned?.pcsPerBox || 0
  const boxesPerPallet = packaging?.boxesPerPallet || packaging?.planned?.boxesPerPallet || 0
  const plannedBoxes = packaging?.plannedBoxes || packaging?.planned?.totals?.outers || 0
  const actualBoxes = calculateActualFromRuns.actualBoxes > 0 ? calculateActualFromRuns.actualBoxes : (packaging?.actualBoxes || 0)
  const plannedPallets = packaging?.plannedPallets || packaging?.planned?.pallets || 0
  const actualPallets = calculateActualFromRuns.actualPallets > 0 ? calculateActualFromRuns.actualPallets : (packaging?.actualPallets || 0)
  const strapSpec = packaging?.strapSpec || ''
  const palletLabelsOnly = packaging?.palletLabelsOnly || ''

  const [isEditing, setIsEditing] = useState(false)
  const [formData, setFormData] = useState({
    pcsPerBox,
    boxesPerPallet,
    plannedBoxes,
    actualBoxes,
    plannedPallets,
    actualPallets,
    strapSpec,
    palletLabelsOnly,
  })

  useEffect(() => {
    if (!isEditing && (calculateActualFromRuns.actualBoxes > 0 || calculateActualFromRuns.actualPallets > 0)) {
      setFormData(prev => ({
        ...prev,
        actualBoxes: calculateActualFromRuns.actualBoxes > 0 ? calculateActualFromRuns.actualBoxes : prev.actualBoxes,
        actualPallets: calculateActualFromRuns.actualPallets > 0 ? calculateActualFromRuns.actualPallets : prev.actualPallets,
      }))
    }
  }, [calculateActualFromRuns.actualBoxes, calculateActualFromRuns.actualPallets, isEditing])

  const updateMutation = useMutation({
    mutationFn: (payload: any) => updateJob(workspaceId, job.id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job', workspaceId, job.id] })
      queryClient.invalidateQueries({ queryKey: ['jobs', workspaceId] })
      setIsEditing(false)
    },
  })

  const handleSave = () => {
    updateMutation.mutate({
      packaging: {
        ...formData,
        pcsPerBox: Number(formData.pcsPerBox) || 0,
        boxesPerPallet: Number(formData.boxesPerPallet) || 0,
        plannedBoxes: Number(formData.plannedBoxes) || 0,
        actualBoxes: Number(formData.actualBoxes) || 0,
        plannedPallets: Number(formData.plannedPallets) || 0,
        actualPallets: Number(formData.actualPallets) || 0,
      }
    })
  }

  const handleCancel = () => {
    setFormData({
      pcsPerBox,
      boxesPerPallet,
      plannedBoxes,
      actualBoxes,
      plannedPallets,
      actualPallets,
      strapSpec,
      palletLabelsOnly,
    })
    setIsEditing(false)
  }

  const totalPiecesPlanned = (formData.pcsPerBox || 0) * (formData.plannedBoxes || 0)
  const totalPiecesActual = (formData.pcsPerBox || 0) * (formData.actualBoxes || 0)
  const calculatedPalletsPlanned = formData.boxesPerPallet > 0
    ? Math.ceil((formData.plannedBoxes || 0) / formData.boxesPerPallet)
    : 0
  const calculatedPalletsActual = formData.boxesPerPallet > 0
    ? Math.ceil((formData.actualBoxes || 0) / formData.boxesPerPallet)
    : 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900">Packaging Information</h3>
        {!isEditing ? (
          <button
            onClick={() => setIsEditing(true)}
            className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <PencilIcon className="h-4 w-4 mr-2" />
            Edit
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={handleCancel}
              className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={updateMutation.isPending}
              className="inline-flex items-center px-3 py-2 border border-transparent shadow-sm text-sm leading-4 font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {updateMutation.isPending ? 'Saving...' : 'Save'}
            </button>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h4 className="text-md font-medium text-gray-900 mb-4">Packaging Rules</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Pieces per Box (PCS/Box)</label>
            {isEditing ? (
              <input
                type="number"
                min="0"
                value={formData.pcsPerBox}
                onChange={(e) => setFormData({ ...formData, pcsPerBox: Number(e.target.value) || 0 })}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            ) : (
              <p className="text-sm text-gray-900">{formData.pcsPerBox || 'Not set'}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Boxes per Pallet</label>
            {isEditing ? (
              <input
                type="number"
                min="0"
                value={formData.boxesPerPallet}
                onChange={(e) => setFormData({ ...formData, boxesPerPallet: Number(e.target.value) || 0 })}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            ) : (
              <p className="text-sm text-gray-900">{formData.boxesPerPallet || 'Not set'}</p>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h4 className="text-md font-medium text-gray-900 mb-4">Planned vs Actual</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <h5 className="text-sm font-medium text-gray-900">Boxes</h5>
              <CubeIcon className="h-5 w-5 text-gray-400" />
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Planned</label>
                {isEditing ? (
                  <input
                    type="number"
                    min="0"
                    value={formData.plannedBoxes}
                    onChange={(e) => setFormData({ ...formData, plannedBoxes: Number(e.target.value) || 0 })}
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                  />
                ) : (
                  <p className="text-lg font-semibold text-gray-900">{formData.plannedBoxes || 0}</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Actual</label>
                {isEditing ? (
                  <input
                    type="number"
                    min="0"
                    value={formData.actualBoxes}
                    onChange={(e) => setFormData({ ...formData, actualBoxes: Number(e.target.value) || 0 })}
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                  />
                ) : (
                  <p className="text-lg font-semibold text-gray-900">{formData.actualBoxes || 0}</p>
                )}
                {!isEditing && calculateActualFromRuns.totalCartoonOutput > 0 && (
                  <p className="text-xs text-blue-600 mt-1">
                    Calculated from production: {calculateActualFromRuns.totalCartoonOutput.toLocaleString()} cartoon
                  </p>
                )}
              </div>
              {formData.pcsPerBox > 0 && (
                <div className="pt-2 border-t border-gray-200">
                  <p className="text-xs text-gray-500">Total Pieces (Planned): {totalPiecesPlanned.toLocaleString()}</p>
                  <p className="text-xs text-gray-500">Total Pieces (Actual): {totalPiecesActual.toLocaleString()}</p>
                </div>
              )}
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <h5 className="text-sm font-medium text-gray-900">Pallets</h5>
              <TruckIcon className="h-5 w-5 text-gray-400" />
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Planned</label>
                {isEditing ? (
                  <input
                    type="number"
                    min="0"
                    value={formData.plannedPallets}
                    onChange={(e) => setFormData({ ...formData, plannedPallets: Number(e.target.value) || 0 })}
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                  />
                ) : (
                  <p className="text-lg font-semibold text-gray-900">{formData.plannedPallets || 0}</p>
                )}
                {formData.boxesPerPallet > 0 && formData.plannedBoxes > 0 && (
                  <p className="text-xs text-gray-500 mt-1">Calculated: {calculatedPalletsPlanned} (from boxes)</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Actual</label>
                {isEditing ? (
                  <input
                    type="number"
                    min="0"
                    value={formData.actualPallets}
                    onChange={(e) => setFormData({ ...formData, actualPallets: Number(e.target.value) || 0 })}
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                  />
                ) : (
                  <p className="text-lg font-semibold text-gray-900">{formData.actualPallets || 0}</p>
                )}
                {formData.boxesPerPallet > 0 && formData.actualBoxes > 0 && (
                  <p className="text-xs text-gray-500 mt-1">Calculated: {calculatedPalletsActual} (from boxes)</p>
                )}
                {!isEditing && calculateActualFromRuns.actualPallets > 0 && (
                  <p className="text-xs text-blue-600 mt-1">
                    Auto-calculated from production runs
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {isEditing && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h4 className="text-md font-medium text-gray-900 mb-4">Additional Information</h4>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Strap/Banding Specification</label>
              <input
                type="text"
                value={formData.strapSpec}
                onChange={(e) => setFormData({ ...formData, strapSpec: e.target.value })}
                placeholder="e.g., 2 straps per pallet"
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Pallet Label Notes</label>
              <textarea
                value={formData.palletLabelsOnly}
                onChange={(e) => setFormData({ ...formData, palletLabelsOnly: e.target.value })}
                placeholder="Special instructions for pallet labeling"
                rows={3}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>
      )}

      {formData.pcsPerBox > 0 && formData.boxesPerPallet > 0 && (
        <div className="bg-blue-50 rounded-lg border border-blue-200 p-6">
          <h4 className="text-md font-medium text-blue-900 mb-4">Packaging Summary</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-blue-600 font-medium">Total Pieces (Planned)</p>
              <p className="text-lg font-semibold text-blue-900">{totalPiecesPlanned.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-blue-600 font-medium">Total Pieces (Actual)</p>
              <p className="text-lg font-semibold text-blue-900">{totalPiecesActual.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-blue-600 font-medium">Pallets (Planned)</p>
              <p className="text-lg font-semibold text-blue-900">
                {formData.plannedPallets || calculatedPalletsPlanned}
              </p>
            </div>
            <div>
              <p className="text-blue-600 font-medium">Pallets (Actual)</p>
              <p className="text-lg font-semibold text-blue-900">
                {formData.actualPallets || calculatedPalletsActual}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

