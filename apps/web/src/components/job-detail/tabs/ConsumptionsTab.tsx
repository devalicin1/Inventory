import { useState, type FC } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { PlusIcon } from '@heroicons/react/24/outline'
import type { Consumption } from '../../../api/production-jobs'
import { updateConsumption, approveConsumption, deleteConsumption } from '../../../api/production-jobs'
import { ConfirmDeleteConsumptionModal } from '../ConfirmDeleteConsumptionModal'

interface ConsumptionsTabProps {
  consumptions: Consumption[]
  onCreateConsumption: () => void
  workspaceId?: string
  jobId?: string
}

export const ConsumptionsTab: FC<ConsumptionsTabProps> = ({ consumptions, onCreateConsumption, workspaceId, jobId }) => {
  const [toDelete, setToDelete] = useState<Consumption | null>(null)
  const queryClient = useQueryClient()
  const [draftQty, setDraftQty] = useState<Record<string, number>>({})
  const [draftLot, setDraftLot] = useState<Record<string, string>>({})
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

      {/* Mobile card view */}
      <div className="space-y-3 md:hidden">
        {consumptions.length === 0 && (
          <p className="text-sm text-gray-500 text-center py-4">
            No material consumptions recorded yet.
          </p>
        )}
        {consumptions.map((consumption) => {
          const isPending = !consumption.approved && workspaceId && jobId
          const qtyValue = draftQty[consumption.id] ?? consumption.qtyUsed
          const lotValue = draftLot[consumption.id] ?? (consumption.lot || '')
          return (
            <div
              key={consumption.id}
              className="border border-gray-200 rounded-lg p-3 bg-white shadow-sm"
            >
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-xs text-gray-500">
                  {new Date(consumption.at.seconds * 1000).toLocaleDateString()}
                </p>
                <span className="text-[11px] font-mono text-gray-500">
                  {consumption.sku}
                </span>
              </div>
              <p className="text-sm font-semibold text-gray-900 mb-1">
                {consumption.name}
              </p>
              <div className="flex items-center justify-between text-xs text-gray-600 mb-2">
                <span>UOM: {consumption.uom}</span>
                <span>User: {consumption.userId}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <div>
                  <p className="text-[11px] text-gray-500 mb-0.5">Qty Used</p>
                  {isPending ? (
                    <input
                      type="number"
                      min="0"
                      className="w-full rounded border-gray-300 text-sm px-2 py-1"
                      value={qtyValue}
                      onChange={(e) => setDraftQty({ ...draftQty, [consumption.id]: Number(e.target.value) })}
                    />
                  ) : (
                    <p className="text-sm text-gray-900">{consumption.qtyUsed}</p>
                  )}
                </div>
                <div>
                  <p className="text-[11px] text-gray-500 mb-0.5">Lot</p>
                  {isPending ? (
                    <input
                      type="text"
                      className="w-full rounded border-gray-300 text-sm px-2 py-1"
                      value={lotValue}
                      onChange={(e) => setDraftLot({ ...draftLot, [consumption.id]: e.target.value })}
                      placeholder="Lot"
                    />
                  ) : (
                    <p className="text-sm text-gray-900">{consumption.lot || '-'}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-xs">
                  {consumption.approved ? (
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-green-100 text-green-700 border border-green-200">
                      Approved
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-yellow-100 text-yellow-700 border border-yellow-200">
                      Pending
                    </span>
                  )}
                </span>
                <div className="flex items-center gap-2 text-xs">
                  {isPending && (
                    <>
                      <button
                        className="text-gray-700"
                        onClick={async () => {
                          if (!workspaceId || !jobId) return
                          await updateConsumption(workspaceId, jobId, consumption.id, {
                            qtyUsed: draftQty[consumption.id] ?? consumption.qtyUsed,
                            lot: draftLot[consumption.id] ?? consumption.lot,
                          })
                          queryClient.invalidateQueries({ queryKey: ['jobConsumptions', workspaceId, jobId] })
                        }}
                      >
                        Save
                      </button>
                      <button
                        className="text-blue-600"
                        onClick={async () => {
                          if (!workspaceId || !jobId) return
                          await approveConsumption(workspaceId, jobId, consumption.id)
                          queryClient.invalidateQueries({ queryKey: ['jobConsumptions', workspaceId, jobId] })
                          queryClient.invalidateQueries({ queryKey: ['job', workspaceId, jobId] })
                          queryClient.invalidateQueries({ queryKey: ['jobs', workspaceId] })
                        }}
                      >
                        Approve
                      </button>
                    </>
                  )}
                  <button
                    className="text-red-600"
                    onClick={() => setToDelete(consumption)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Desktop table view */}
      <div className="overflow-x-auto hidden md:block">
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
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3" />
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
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {consumption.approved ? (
                    consumption.qtyUsed
                  ) : (
                    <input
                      type="number"
                      min="0"
                      className="w-24 rounded border-gray-300 text-sm"
                      value={draftQty[consumption.id] ?? consumption.qtyUsed}
                      onChange={(e) => setDraftQty({ ...draftQty, [consumption.id]: Number(e.target.value) })}
                    />
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{consumption.uom}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {consumption.approved ? (
                    consumption.lot || '-'
                  ) : (
                    <input
                      type="text"
                      className="w-28 rounded border-gray-300 text-sm"
                      value={(draftLot[consumption.id] ?? (consumption.lot || ''))}
                      onChange={(e) => setDraftLot({ ...draftLot, [consumption.id]: e.target.value })}
                      placeholder="Lot"
                    />
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{consumption.userId}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  {consumption.approved ? (
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 border border-green-200">Approved</span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700 border border-yellow-200">Pending</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                  <div className="flex gap-2 justify-end">
                    {!consumption.approved && workspaceId && jobId && (
                      <>
                        <button
                          className="text-gray-700 hover:text-gray-900"
                          onClick={async () => {
                            await updateConsumption(workspaceId, jobId, consumption.id, {
                              qtyUsed: draftQty[consumption.id] ?? consumption.qtyUsed,
                              lot: draftLot[consumption.id] ?? consumption.lot,
                            })
                            queryClient.invalidateQueries({ queryKey: ['jobConsumptions', workspaceId, jobId] })
                          }}
                        >
                          Save
                        </button>
                        <button className="text-blue-600 hover:text-blue-800" onClick={async () => { await approveConsumption(workspaceId, jobId, consumption.id); queryClient.invalidateQueries({ queryKey: ['jobConsumptions', workspaceId, jobId] }); queryClient.invalidateQueries({ queryKey: ['job', workspaceId, jobId] }); queryClient.invalidateQueries({ queryKey: ['jobs', workspaceId] }) }}>Approve</button>
                      </>
                    )}
                    <button className="text-red-600 hover:text-red-800" onClick={() => setToDelete(consumption)}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {toDelete && workspaceId && jobId && (
        <ConfirmDeleteConsumptionModal
          onClose={() => setToDelete(null)}
          onConfirm={async (restock) => {
            await deleteConsumption(workspaceId, jobId, toDelete.id, restock)
            // Invalidate queries to refresh the UI
            queryClient.invalidateQueries({ queryKey: ['jobConsumptions', workspaceId, jobId] })
            queryClient.invalidateQueries({ queryKey: ['job', workspaceId, jobId] })
            queryClient.invalidateQueries({ queryKey: ['jobs', workspaceId] })
            queryClient.invalidateQueries({ queryKey: ['products', workspaceId] })
            // If restock was done, also invalidate stock transactions
            if (restock && toDelete.approved && toDelete.itemId) {
              queryClient.invalidateQueries({ queryKey: ['stockTxns', workspaceId, toDelete.itemId] })
              queryClient.invalidateQueries({ queryKey: ['productOnHand', workspaceId, toDelete.itemId] })
            }
            setToDelete(null)
          }}
        />
      )}
    </div>
  )
}

