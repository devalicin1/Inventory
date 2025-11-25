import { useState, type FC } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { Job, Consumption } from '../../../api/production-jobs'
import { listProducts, type ListedProduct } from '../../../api/inventory'
import { listJobConsumptions, createConsumption, updateJob } from '../../../api/production-jobs'

interface MaterialsTabProps {
  job: Job
  workspaceId: string
}

export const MaterialsTab: FC<MaterialsTabProps> = ({ job, workspaceId }) => {
  const queryClient = useQueryClient()
  const [qtyDraft, setQtyDraft] = useState<Record<string, number>>({})
  const [search, setSearch] = useState('')
  const { data: products = [] } = useQuery<ListedProduct[]>({
    queryKey: ['products', workspaceId],
    queryFn: () => listProducts(workspaceId),
  })
  const { data: existingConsumptions = [] } = useQuery<Consumption[]>({
    queryKey: ['jobConsumptions', workspaceId, job.id],
    queryFn: () => listJobConsumptions(workspaceId, job.id),
  })
  const filteredProducts = products.filter(p => {
    if (!search) return true
    const t = search.toLowerCase();
    return p.name.toLowerCase().includes(t) || p.sku.toLowerCase().includes(t)
  })

  const createMutation = useMutation({
    mutationFn: async (payload: any) => createConsumption(workspaceId, job.id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobConsumptions', workspaceId, job.id] })
      queryClient.invalidateQueries({ queryKey: ['jobs', workspaceId] })
    }
  })
  const updateJobMutation = useMutation({
    mutationFn: (payload: any) => updateJob(workspaceId, job.id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job', workspaceId, job.id] })
    }
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900">Bill of Materials</h3>
      </div>
      {/* Add item to BOM */}
      <div className="flex gap-2 items-center">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search inventory (SKU or name)"
          className="flex-1 rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 transition-colors py-2 px-3 border"
        />
        <select
          onChange={async (e) => {
            const id = e.target.value
            if (!id) return
            const p = products.find(pr => pr.id === id)
            if (!p) return
            const exists = (job.bom || []).some(b => (b as any).itemId === id || b.sku === p.sku)
            if (exists) { e.currentTarget.selectedIndex = 0; return }
            const nextBom = [...(job.bom || []), { itemId: id, sku: p.sku, name: p.name, qtyRequired: 1, uom: p.uom, reserved: 0, consumed: 0 }]
            await updateJobMutation.mutateAsync({ bom: nextBom })
            e.currentTarget.selectedIndex = 0
          }}
          className="rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 transition-colors py-2 px-3 border bg-white"
        >
          <option value="">Add item…</option>
          {filteredProducts.map(p => (
            <option key={p.id} value={p.id}>{p.sku} — {p.name} ({p.uom})</option>
          ))}
        </select>
      </div>
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
              <th className="px-6 py-3" />
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {(job.bom || []).map((item, index) => (
              <tr key={index}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{item.sku}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.name}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  <input
                    type="number"
                    min="0"
                    className="w-24 rounded border-gray-300 text-sm"
                    value={qtyDraft[item.sku || item.name || (item as any).itemId] ?? item.qtyRequired ?? (item as any).qty ?? 0}
                    onChange={(e) => {
                      const key = item.sku || item.name || (item as any).itemId
                      setQtyDraft({ ...qtyDraft, [key]: Number(e.target.value) })
                    }}
                    onBlur={async () => {
                      const key = item.sku || item.name || (item as any).itemId
                      const newQty = qtyDraft[key]
                      const currentQty = item.qtyRequired ?? (item as any).qty ?? 0
                      if (typeof newQty === 'number' && newQty !== currentQty) {
                        // Match by SKU first, then by name, then by itemId
                        const nextBom = (job.bom || []).map(b => {
                          if (item.sku && b.sku === item.sku) return { ...b, qtyRequired: newQty }
                          if (!item.sku && item.name && b.name === item.name) return { ...b, qtyRequired: newQty }
                          if ((b as any).itemId === (item as any).itemId) return { ...b, qtyRequired: newQty }
                          return b
                        })
                        await updateJobMutation.mutateAsync({ bom: nextBom })
                      }
                    }}
                  />
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.reserved}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.consumed}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.uom}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.lot || '-'}</td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                  <div className="flex items-center gap-2 justify-end">
                    <button
                      className="text-blue-600 hover:text-blue-800"
                      onClick={async () => {
                        // Find product by SKU first, then by name if SKU is empty or not found
                        let prod = products.find(p => p.sku && p.sku === item.sku)

                        // If not found by SKU or SKU is empty, try to find by name
                        if (!prod && item.name) {
                          const matchingByName = products.filter(p =>
                            p.name && item.name &&
                            p.name.toLowerCase().trim() === item.name.toLowerCase().trim()
                          )

                          if (matchingByName.length === 1) {
                            prod = matchingByName[0]
                          } else if (matchingByName.length > 1) {
                            // Multiple products with same name - need to check both SKU and name
                            // If SKU is provided, try to match both
                            if (item.sku) {
                              prod = matchingByName.find(p => p.sku === item.sku) || matchingByName[0]
                            } else {
                              alert(`Multiple products found with name "${item.name}". Please ensure SKU is set correctly.`)
                              return
                            }
                          }
                        }

                        if (!prod) {
                          alert(`Product not found for SKU: ${item.sku || '(empty)'} and Name: ${item.name || '(empty)'}`)
                          return
                        }

                        // Use the product ID from the found product
                        const itemId = prod.id

                        const max = Number(prod?.qtyOnHand || 0)
                        // Use SKU as key if available, otherwise use name, otherwise use itemId as fallback
                        const draftKey = item.sku || item.name || (item as any).itemId || prod.id
                        const requested = qtyDraft[draftKey] ?? item.qtyRequired ?? (item as any).qty ?? 0
                        if (requested <= 0) {
                          alert(`Please enter a valid quantity for ${item.sku || item.name}`)
                          return
                        }
                        if (requested > max) {
                          alert(`Not enough stock for ${item.sku || item.name}. Available: ${max}`)
                          return
                        }

                        if (existingConsumptions.some(c => c.itemId === itemId && c.approved)) {
                          alert('This item has already been approved and deducted.')
                          return
                        }
                        try {
                          await createMutation.mutateAsync({
                            stageId: (job as any).currentStageId,
                            itemId: itemId,
                            sku: item.sku,
                            name: item.name,
                            qtyUsed: requested,
                            uom: item.uom,
                            lot: '',
                            userId: 'current-user',
                            approved: true,
                          })
                          // Invalidate all relevant queries to refresh UI
                          queryClient.invalidateQueries({ queryKey: ['job', workspaceId, job.id] })
                          queryClient.invalidateQueries({ queryKey: ['jobs', workspaceId] })
                          queryClient.invalidateQueries({ queryKey: ['jobConsumptions', workspaceId, job.id] })
                          // CRITICAL: Invalidate products query so ProductDetails shows updated stock
                          queryClient.invalidateQueries({ queryKey: ['products', workspaceId] })
                          // Also invalidate stock transactions and on-hand for the specific product
                          queryClient.invalidateQueries({ queryKey: ['stockTxns', workspaceId, itemId] })
                          queryClient.invalidateQueries({ queryKey: ['productOnHand', workspaceId, itemId] })
                          // Invalidate ALL stockTxns queries to ensure any open ProductDetails refreshes
                          queryClient.invalidateQueries({ queryKey: ['stockTxns', workspaceId] })
                          queryClient.invalidateQueries({ queryKey: ['productOnHand', workspaceId] })
                          // Dispatch custom event to notify ProductDetails (for any open product)
                          window.dispatchEvent(new CustomEvent('stockTransactionCreated', { detail: { productId: itemId } }))
                        } catch (error: any) {
                          alert(`Failed to approve and deduct: ${error.message || 'Unknown error'}`)
                          console.error('Approve & deduct error:', error)
                        }
                      }}
                      disabled={createMutation.isPending}
                    >
                      {createMutation.isPending ? 'Approving…' : (existingConsumptions.some(c => c.itemId === ((item as any).itemId || products.find(p => p.sku === item.sku)?.id) && c.approved) ? 'Approved' : 'Approve & deduct')}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

