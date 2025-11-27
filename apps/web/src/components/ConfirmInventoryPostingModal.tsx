import type { FC } from 'react'
import { useEffect, useState } from 'react'
import { XMarkIcon, CheckBadgeIcon, QuestionMarkCircleIcon } from '@heroicons/react/24/outline'
import { type Job, listJobProductionRuns, type ProductionRun, listWorkflows, recordJobOutput } from '../api/production-jobs'
import { type ListedProduct } from '../api/inventory'
import { useQuery, useQueryClient } from '@tanstack/react-query'

interface Props {
  job: Job
  workspaceId: string
  products: ListedProduct[]
  onClose: () => void
  onSuccess?: () => void
}

export const ConfirmInventoryPostingModal: FC<Props> = ({ job, workspaceId, products, onClose, onSuccess }) => {
  const queryClient = useQueryClient()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [autoConsume, setAutoConsume] = useState(true)

  const [rows, setRows] = useState(() => {
    const outs: any[] = Array.isArray(job.output) ? job.output : []
    return outs.map((o: any, idx: number) => ({
      selected: Boolean((o as any).stockable ?? (idx === 0)),
      sku: o.sku,
      name: o.name,
      uom: o.uom,
      qty: Number(o.qtyProduced ?? o.qtyPlanned ?? 0),
      toLoc: '',
      lot: '',
      productId: '' as string,
    }))
  })

  // Fetch production runs to determine the latest stage output
  const { data: runs = [] } = useQuery<ProductionRun[]>({
    queryKey: ['jobRuns', workspaceId, job.id],
    queryFn: () => listJobProductionRuns(workspaceId, job.id),
    enabled: !!workspaceId && !!job?.id,
  })

  // Fetch workflows to read stage UOMs
  const { data: workflows = [] } = useQuery<any[]>({
    queryKey: ['workflows', workspaceId],
    queryFn: () => listWorkflows(workspaceId),
    enabled: !!workspaceId,
  })

  // When runs change, sync posting quantity from the latest stage only
  // We take the most recent stageId and sum qtyGood of that stage.
  // This ensures we only post outputs from the last added stage, as requested.
  useEffect(() => {
    if (!Array.isArray(runs) || runs.length === 0) return
    const latestStageId = runs[0].stageId
    const totalGoodInLatestStage = runs
      .filter(r => r.stageId === latestStageId)
      .reduce((sum, r) => sum + Number(r.qtyGood || 0), 0)
    // Determine stage UOM from workflow config (prefer outputUOM, fallback inputUOM)
    let stageUom: string = ''
    try {
      const wf = (workflows as any[]).find(w => w.id === (job as any).workflowId)
      const stage = wf?.stages?.find((s: any) => s.id === latestStageId)
      stageUom = stage?.outputUOM || stage?.inputUOM || ''
    } catch { }
    setRows(prev => prev.map(r => ({ ...r, qty: totalGoodInLatestStage, uom: stageUom || r.uom, selected: totalGoodInLatestStage > 0 })))
  }, [runs, workflows])

  // Conversion helpers
  const pcsPerBox = Number((job as any)?.packaging?.pcsPerBox || 0)
  const normalize = (u?: string) => String(u || '').trim().toLowerCase()
  // Business rule: 'cartoon' represents piece count contained in boxes.
  // Therefore, treat 'cartoon' as PCS, not as BOX.
  const isBox = (u?: string) => ['box', 'boxes', 'carton', 'cartons', 'outer', 'outers'].includes(normalize(u))
  const isPcs = (u?: string) => ['pcs', 'pieces', 'units', 'ea', 'cartoon'].includes(normalize(u))
  const convertToProductUom = (sourceUom: string, qty: number, productUom: string): number => {
    const srcBox = isBox(sourceUom), dstBox = isBox(productUom)
    const srcPcs = isPcs(sourceUom), dstPcs = isPcs(productUom)
    if ((srcBox && dstBox) || (srcPcs && dstPcs) || (!srcBox && !srcPcs && normalize(sourceUom) === normalize(productUom))) return qty
    if (srcPcs && dstBox) {
      const per = pcsPerBox > 0 ? pcsPerBox : 1
      return Math.ceil(qty / per)
    }
    if (srcBox && dstPcs) {
      const per = pcsPerBox > 0 ? pcsPerBox : 1
      return qty * per
    }
    return qty
  }

  const handleConfirm = async () => {
    setIsSubmitting(true)
    try {
      for (const r of rows) {
        if (!r.selected) continue
        const product = (r.productId ? products.find(p => p.id === r.productId) : undefined) || products.find(p => p.sku === r.sku)
        if (!product) continue
        const qtyToPost = convertToProductUom(r.uom, Number(r.qty || 0), product.uom)
        if (qtyToPost <= 0) continue

        // Use the new recordJobOutput API
        await recordJobOutput(workspaceId, job.id, {
          qtyOutput: qtyToPost,
          autoConsumeMaterials: autoConsume,
          completeJob: false, // We'll let the parent handle completion or do it here if needed. The original code didn't complete it here, but onSuccess did.
          // We can pass stageId if we want to link it to the latest stage
          stageId: runs.length > 0 ? runs[0].stageId : undefined,
          notes: `Production output posted (${job.code})`
        })
      }

      queryClient.invalidateQueries({ queryKey: ['job', workspaceId, job.id] })
      queryClient.invalidateQueries({ queryKey: ['jobs', workspaceId] })
      // Also invalidate consumptions if auto-consume was on
      if (autoConsume) {
        queryClient.invalidateQueries({ queryKey: ['jobConsumptions', workspaceId, job.id] })
      }

      // CRITICAL: Invalidate inventory queries to refresh stock after posting
      // This ensures inventory UI shows updated quantities
      queryClient.invalidateQueries({ queryKey: ['products', workspaceId] })
      // Invalidate stock transactions and on-hand for all products that were posted
      for (const r of rows) {
        if (!r.selected) continue
        const product = (r.productId ? products.find(p => p.id === r.productId) : undefined) || products.find(p => p.sku === r.sku)
        if (product) {
          queryClient.invalidateQueries({ queryKey: ['stockTxns', workspaceId, product.id] })
          queryClient.invalidateQueries({ queryKey: ['productOnHand', workspaceId, product.id] })
        }
      }
      // Also invalidate all stockTxns and productOnHand queries to ensure any open ProductDetails refreshes
      queryClient.invalidateQueries({ queryKey: ['stockTxns', workspaceId] })
      queryClient.invalidateQueries({ queryKey: ['productOnHand', workspaceId] })
      // Dispatch custom event to notify ProductDetails (for any open product)
      for (const r of rows) {
        if (!r.selected) continue
        const product = (r.productId ? products.find(p => p.id === r.productId) : undefined) || products.find(p => p.sku === r.sku)
        if (product) {
          window.dispatchEvent(new CustomEvent('stockTransactionCreated', { detail: { productId: product.id } }))
        }
      }

      onClose()
      // Call onSuccess callback if provided (for completing job after successful posting)
      if (onSuccess) {
        onSuccess()
      }
    } catch (error) {
      console.error('Error confirming inventory posting:', error)
      alert('Failed to post inventory. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const selectedCount = rows.filter(r => r.selected).length
  const allSelected = rows.length > 0 && rows.every(r => r.selected)
  const someSelected = selectedCount > 0 && !allSelected
  const invalid = rows.some(r => r.selected && (!((r.productId || products.find(p => p.sku === r.sku)?.id)) || Number(r.qty) <= 0))

  return (
    <div className="fixed inset-0 z-[60] backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-7xl border border-gray-200 flex flex-col max-h-[90vh]">
        {/* Compact Header */}
        <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-white">
          <div className="flex items-center space-x-3">
            <CheckBadgeIcon className="h-5 w-5 text-emerald-600" />
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Complete Production Job</h3>
              <p className="text-sm text-gray-600">
                Job: <span className="font-mono font-medium">#{job.code}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <span className="text-sm text-gray-600">
              {selectedCount} item{selectedCount !== 1 ? 's' : ''} selected
            </span>
            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Compact Table */}
        <div className="flex-1 overflow-auto">
          <div className="p-4">
            {/* Table Header - Single Line */}
            <div className="grid grid-cols-12 gap-2 text-xs font-semibold text-gray-700 pb-2 border-b border-gray-200 uppercase tracking-wide">
              <div className="col-span-1 flex justify-center">
                <input
                  type="checkbox"
                  className="h-4 w-4 text-emerald-600 focus:ring-emerald-500 border-gray-300 rounded"
                  checked={allSelected}
                  ref={el => { if (el) el.indeterminate = someSelected }}
                  onChange={e => {
                    const next = rows.map(r => ({ ...r, selected: e.target.checked }))
                    setRows(next)
                  }}
                  aria-label="Select all to post"
                />
              </div>
              <div className="col-span-2">SKU</div>
              <div className="col-span-2">Product</div>
              <div className="col-span-2">Inventory Item</div>
              <div className="col-span-1 text-center">Qty</div>
              <div className="col-span-1 text-center">UOM</div>
              <div className="col-span-1 text-center">Pieces in Box</div>
              <div className="col-span-2 text-right">Post Qty</div>
            </div>

            {/* Table Rows */}
            <div className="divide-y divide-gray-100">
              {rows.map((r, i) => {
                const product = products.find(p => p.id === r.productId) || products.find(p => p.sku === r.sku)
                const targetUom = product?.uom || r.uom
                const converted = convertToProductUom(r.uom, Number(r.qty || 0), targetUom)
                const hasProduct = !!(r.productId || products.find(p => p.sku === r.sku)?.id)

                return (
                  <div key={i} className="grid grid-cols-12 gap-2 items-center py-2 hover:bg-gray-50 transition-colors">
                    {/* Select */}
                    <div className="col-span-1 flex justify-center">
                      <input
                        type="checkbox"
                        className="h-4 w-4 text-emerald-600 focus:ring-emerald-500 border-gray-300 rounded"
                        checked={r.selected}
                        onChange={e => {
                          const next = [...rows]
                          next[i] = { ...next[i], selected: e.target.checked }
                          setRows(next)
                        }}
                      />
                    </div>

                    {/* SKU */}
                    <div className="col-span-2">
                      <span className="font-mono text-xs text-gray-900 font-medium">{r.sku}</span>
                    </div>

                    {/* Name - Truncated */}
                    <div className="col-span-2">
                      <p className="text-xs text-gray-900 truncate" title={r.name}>{r.name}</p>
                    </div>

                    {/* Product Selection - Compact */}
                    <div className="col-span-2">
                      <select
                        className={`w-full text-xs border rounded px-2 py-1.5 transition-colors ${r.selected && !hasProduct
                          ? 'border-orange-300 bg-orange-50'
                          : 'border-gray-300 hover:border-gray-400'
                          }`}
                        value={r.productId || (product?.id || '')}
                        onChange={e => {
                          const next = [...rows]
                          next[i] = { ...next[i], productId: e.target.value }
                          setRows(next)
                        }}
                      >
                        <option value="">Select item...</option>
                        {products.map(p => (
                          <option key={p.id} value={p.id}>
                            {p.sku} - {p.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Quantity Input */}
                    <div className="col-span-1">
                      <input
                        type="number"
                        min={0}
                        className="w-full text-xs border border-gray-300 rounded px-2 py-1.5 text-right font-medium hover:border-gray-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                        value={r.qty}
                        onChange={e => {
                          const next = [...rows]
                          next[i] = { ...next[i], qty: Number(e.target.value) }
                          setRows(next)
                        }}
                      />
                    </div>

                    {/* Source UOM */}
                    <div className="col-span-1 text-center">
                      <span className="text-xs font-medium text-gray-600 bg-gray-100 px-2 py-1 rounded">
                        {r.uom}
                      </span>
                    </div>

                    {/* Pieces in Box */}
                    <div className="col-span-1 text-center">
                      <span className="text-xs font-medium text-gray-700">
                        {pcsPerBox > 0 ? pcsPerBox.toLocaleString() : '-'}
                      </span>
                    </div>

                    {/* Converted Quantity */}
                    <div className="col-span-2 text-right">
                      <div className="text-sm font-semibold text-gray-900">
                        {Number.isFinite(converted) ? Number(converted).toLocaleString() : '-'}
                      </div>
                      <div className="text-xs text-gray-500">{product?.uom || r.uom}</div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Options Section */}
            <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-100">
              <div className="flex items-start space-x-3">
                <div className="flex items-center h-5">
                  <input
                    id="auto-consume"
                    name="auto-consume"
                    type="checkbox"
                    checked={autoConsume}
                    onChange={(e) => setAutoConsume(e.target.checked)}
                    className="focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300 rounded"
                  />
                </div>
                <div className="ml-3 text-sm">
                  <label htmlFor="auto-consume" className="font-medium text-blue-900">
                    Auto-consume raw materials (Backflushing)
                  </label>
                  <p className="text-blue-700">
                    Automatically deduct raw materials from inventory based on the BOM and the quantity being posted.
                  </p>
                </div>
              </div>
            </div>

            {/* Compact Help Text */}
            <div className="mt-4 flex items-center justify-between text-xs text-gray-600">
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-1">
                  <QuestionMarkCircleIcon className="h-4 w-4" />
                  <span>Quantities auto-convert to inventory UOM</span>
                </div>
                <div className="flex items-center space-x-1">
                  <CheckBadgeIcon className="h-4 w-4 text-emerald-600" />
                  <span>Reference: <strong>#{job.code}</strong></span>
                </div>
              </div>
              <div className={`text-xs px-2 py-1 rounded ${invalid ? 'bg-orange-100 text-orange-700' : 'bg-emerald-100 text-emerald-700'
                }`}>
                {selectedCount === 0 ? 'Select items to post' :
                  invalid ? 'Complete required fields' :
                    'Ready to post'}
              </div>
            </div>
          </div>
        </div>

        {/* Compact Footer */}
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <button
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              disabled={invalid || isSubmitting || selectedCount === 0}
              onClick={handleConfirm}
              className={`px-6 py-2 text-sm font-medium text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 transition-colors flex items-center space-x-2 ${invalid || isSubmitting || selectedCount === 0
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <CheckBadgeIcon className="h-4 w-4" />
                  <span>Post to Inventory</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}