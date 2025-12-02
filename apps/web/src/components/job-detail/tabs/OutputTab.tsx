import { useState, type FC, type ReactNode } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { Job, ProductionRun, Workflow } from '../../../api/production-jobs'
import { listJobProductionRuns, createProductionRun } from '../../../api/production-jobs'

interface OutputTabProps {
  job: Job
  workspaceId: string
  workcenters: Array<{ id: string; name: string }>
  workflows?: Workflow[]
}

export const OutputTab: FC<OutputTabProps> = ({ job, workspaceId, workcenters, workflows = [] }) => {
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
      if (s?.inputUOM) return s.inputUOM
    }
    return ''
  }

  const plannedIds: string[] = Array.isArray((job as any).plannedStageIds) ? (job as any).plannedStageIds : []
  const wf = workflows.find(w => w.id === (job as any).workflowId)
  const stageOptions = (wf?.stages || [])
    .filter(s => plannedIds.length === 0 || plannedIds.includes(s.id))
    .sort((a, b) => a.order - b.order)

  const getWorkcenterName = (id?: string) => {
    if (!id) return '-'
    const wc = workcenters.find(w => w.id === id)
    return wc?.name || id
  }

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

      {/* Mobile-friendly list view */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3 md:hidden">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-gray-900">Production Runs</h3>
          <span className="text-xs text-gray-500">{runs.length} records</span>
        </div>
        {runs.length === 0 && (
          <p className="text-sm text-gray-500 text-center py-4">
            No production runs recorded yet.
          </p>
        )}
        {runs
          .slice()
          .sort((a, b) => {
            const dateA = a.at?.seconds ? a.at.seconds * 1000 : new Date(a.at).getTime()
            const dateB = b.at?.seconds ? b.at.seconds * 1000 : new Date(b.at).getTime()
            return dateB - dateA
          })
          .map((r) => {
            const stageName = getStageName(r.stageId)
            const unit = getStageOutputUOM(r.stageId)
            return (
              <div
                key={r.id}
                className="border border-gray-100 rounded-lg px-3 py-2.5 shadow-sm bg-gray-50"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-xs font-medium text-gray-500">
                    {new Date(r.at?.seconds ? r.at.seconds * 1000 : r.at).toLocaleString()}
                  </p>
                  <p className="text-xs font-semibold text-gray-700">
                    {stageName}
                  </p>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <div>
                    <p className="text-gray-700 font-semibold">
                      Good: {r.qtyGood.toLocaleString()} {unit && <span className="text-gray-500 text-xs">({unit})</span>}
                    </p>
                    <p className="text-gray-600 text-xs mt-0.5">
                      Scrap: {(r.qtyScrap || 0).toLocaleString()} {unit && <span className="text-gray-400 text-[11px]">({unit})</span>}
                    </p>
                  </div>
                  <div className="text-right text-xs text-gray-500 space-y-0.5">
                    <p>WC: {getWorkcenterName(r.workcenterId)}</p>
                    <p>Lot: {r.lot || '-'}</p>
                    <p>Op: {r.operatorId}</p>
                  </div>
                </div>
              </div>
            )
          })}
      </div>

      {/* Desktop table view */}
      <div className="bg-white rounded-lg border border-gray-200 hidden md:block">
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

                const rows: ReactNode[] = []

                sortedStages.forEach((stageId) => {
                  const stageRuns = groupedByStage[stageId]
                  const stageName = getStageName(stageId)
                  const stageOutputUOM = getStageOutputUOM(stageId)
                  const stageTotalGood = stageRuns.reduce((sum, r) => sum + (r.qtyGood || 0), 0)
                  const stageTotalScrap = stageRuns.reduce((sum, r) => sum + (r.qtyScrap || 0), 0)

                  const sortedRuns = stageRuns.sort((a, b) => {
                    const dateA = a.at?.seconds ? a.at.seconds * 1000 : new Date(a.at).getTime()
                    const dateB = b.at?.seconds ? b.at.seconds * 1000 : new Date(b.at).getTime()
                    return dateB - dateA
                  })

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

                  sortedRuns.forEach((r) => {
                    const runStageOutputUOM = getStageOutputUOM(r.stageId)
                    rows.push(
                      <tr key={r.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {new Date(r.at?.seconds ? r.at.seconds * 1000 : r.at).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 pl-8"></td>
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
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm"></td>
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

