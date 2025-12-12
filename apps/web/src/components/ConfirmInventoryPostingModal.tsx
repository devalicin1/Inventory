import type { FC } from 'react'
import { useEffect, useState } from 'react'
import { XMarkIcon, CheckBadgeIcon, QuestionMarkCircleIcon } from '@heroicons/react/24/outline'
import {
  type Job,
  listJobProductionRuns,
  type ProductionRun,
  listWorkflows,
  recordJobOutput,
  listJobConsumptions,
  type Consumption
} from '../api/production-jobs'
import { type ListedProduct, getProductOnHand } from '../api/inventory'
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

  // When runs change, sync posting quantity from the LAST STAGE only
  // CRITICAL: Only allow posting from the final stage in the workflow
  // Exclude:
  // 1. Transfer runs (runs with transferSourceRunIds) - these are WIP transfers, not actual production
  // 2. Outputs that have been transferred to next stage (check by lot number)
  // 3. Outputs from non-final stages
  useEffect(() => {
    console.log('[ConfirmInventoryPostingModal] useEffect triggered:', {
      runsLength: runs?.length || 0,
      workflowsLength: workflows?.length || 0,
      jobId: job?.id,
      jobCurrentStageId: (job as any)?.currentStageId
    })
    
    if (!Array.isArray(runs) || runs.length === 0) {
      console.log('[ConfirmInventoryPostingModal] No runs available')
      setRows(prev => prev.map(r => ({ ...r, qty: 0, selected: false })))
      return
    }
    
    // Find the workflow and determine the last stage
    const wf = (workflows as any[]).find(w => w.id === (job as any).workflowId)
    if (!wf || !Array.isArray(wf.stages) || wf.stages.length === 0) {
      console.log('[ConfirmInventoryPostingModal] No workflow or stages found')
      setRows(prev => prev.map(r => ({ ...r, qty: 0, selected: false })))
      return
    }
    
    // Use plannedStageIds if available, otherwise use all workflow stages
    const plannedIds: string[] = Array.isArray((job as any).plannedStageIds) ? (job as any).plannedStageIds : []
    const jobCurrentStageId = (job as any).currentStageId
    
    let lastStageId: string
    if (plannedIds.length > 0) {
      // Use the last stage from planned stages
      lastStageId = plannedIds[plannedIds.length - 1]
    } else {
      // Fallback to last stage in workflow
      lastStageId = wf.stages[wf.stages.length - 1].id
    }
    
    console.log('[ConfirmInventoryPostingModal] Stage check:', {
      lastStageId,
      jobCurrentStageId,
      plannedIds,
      match: jobCurrentStageId === lastStageId,
      wfStages: wf.stages.map((s: any) => ({ id: s.id, name: s.name }))
    })
    
    // Use jobCurrentStageId if it matches lastStageId, otherwise use lastStageId
    // This handles cases where job might be at last stage but currentStageId might not match exactly
    const targetStageId = (jobCurrentStageId === lastStageId) ? jobCurrentStageId : lastStageId
    console.log('[ConfirmInventoryPostingModal] Using targetStageId:', targetStageId)
    
    // Check which runs have been transferred to next stage (by lot number)
    const isRunTransferred = (run: ProductionRun) => {
      if (!run.lot) return false
      // Check if this lot exists in any later stage (shouldn't happen if we're at last stage, but check anyway)
      const runStageIndex = wf.stages.findIndex((s: any) => s.id === run.stageId)
      if (runStageIndex === -1) return false
      
      // Check all stages after this one
      for (let i = runStageIndex + 1; i < wf.stages.length; i++) {
        const laterStageId = wf.stages[i].id
        const laterStageRuns = runs.filter(r => r.stageId === laterStageId)
        if (laterStageRuns.some(r => r.lot === run.lot)) {
          return true
        }
      }
      return false
    }
    
    const lastStageRuns = runs.filter(r => {
      if (r.stageId !== targetStageId) return false
      // Exclude transfer runs (these are WIP transfers, not actual production)
      if ((r as any).transferSourceRunIds && Array.isArray((r as any).transferSourceRunIds) && (r as any).transferSourceRunIds.length > 0) {
        return false
      }
      // Exclude runs that have been transferred to next stage (shouldn't happen at last stage, but safety check)
      if (isRunTransferred(r)) {
        return false
      }
      return true
    })
    
    const totalGoodInLastStage = lastStageRuns.reduce((sum, r) => sum + Number(r.qtyGood || 0), 0)
    
    // Debug log for modal quantity calculation
    console.log('[ConfirmInventoryPostingModal] Quantity calculation:', {
      lastStageId,
      targetStageId,
      jobCurrentStageId: jobCurrentStageId,
      totalRuns: runs.length,
      lastStageRunsCount: lastStageRuns.length,
      lastStageRuns: lastStageRuns.map((r: any) => ({
        id: r.id,
        stageId: r.stageId,
        qtyGood: r.qtyGood,
        lot: r.lot,
        hasTransferSource: !!(r.transferSourceRunIds && Array.isArray(r.transferSourceRunIds) && r.transferSourceRunIds.length > 0)
      })),
      totalGoodInLastStage
    })
    
    // Determine stage UOM from workflow config (prefer outputUOM, fallback inputUOM)
    let stageUom: string = ''
    try {
      const stage = wf.stages.find((s: any) => s.id === targetStageId)
      stageUom = stage?.outputUOM || stage?.inputUOM || ''
    } catch { }
    
    // If rows array is empty, create a new row from job output or use a default
    setRows(prev => {
      if (prev.length === 0) {
        // Create a row if none exists
        const outs: any[] = Array.isArray(job.output) ? job.output : []
        if (outs.length > 0) {
          return outs.map((o: any, idx: number) => ({
            selected: totalGoodInLastStage > 0,
            sku: o.sku || '',
            name: o.name || '',
            uom: stageUom || o.uom || '',
            qty: totalGoodInLastStage,
            toLoc: '',
            lot: '',
            productId: '' as string,
          }))
        } else {
          // Create a default row if no output exists
          return [{
            selected: totalGoodInLastStage > 0,
            sku: '',
            name: '',
            uom: stageUom || '',
            qty: totalGoodInLastStage,
            toLoc: '',
            lot: '',
            productId: '' as string,
          }]
        }
      }
      // Update existing rows
      return prev.map(r => ({ ...r, qty: totalGoodInLastStage, uom: stageUom || r.uom, selected: totalGoodInLastStage > 0 }))
    })
  }, [runs, workflows, job])

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
      // Capture initial stock levels for selected products (for user feedback)
      const selectedRows = rows.filter(r => r.selected)
      const distinctProductIds = Array.from(
        new Set(
          selectedRows
            .map(r => (r.productId ? r.productId : products.find(p => p.sku === r.sku)?.id))
            .filter((id): id is string => Boolean(id))
        )
      )

      const stockBefore: Record<string, number> = {}
      await Promise.all(
        distinctProductIds.map(async (pid) => {
          stockBefore[pid] = await getProductOnHand(workspaceId, pid)
        })
      )

      // Capture existing consumptions (for backflush delta)
      let consumptionsBefore: Consumption[] = []
      if (autoConsume) {
        try {
          consumptionsBefore = await listJobConsumptions(workspaceId, job.id)
        } catch (e) {
          console.warn('Failed to read consumptions before posting (backflush check):', e)
        }
      }

      for (const r of rows) {
        if (!r.selected) continue
        const product = (r.productId ? products.find(p => p.id === r.productId) : undefined) || products.find(p => p.sku === r.sku)
        if (!product) continue
        const qtyToPost = convertToProductUom(r.uom, Number(r.qty || 0), product.uom)
        if (qtyToPost <= 0) continue

        // CRITICAL: Validate that we're only posting from the last stage
        const wf = (workflows as any[]).find(w => w.id === (job as any).workflowId)
        if (!wf || !Array.isArray(wf.stages) || wf.stages.length === 0) {
          throw new Error('Workflow configuration not found. Cannot post to inventory.')
        }
        
        // Use plannedStageIds if available, otherwise use all workflow stages
        const plannedIds: string[] = Array.isArray((job as any).plannedStageIds) ? (job as any).plannedStageIds : []
        let lastStageId: string
        if (plannedIds.length > 0) {
          // Use the last stage from planned stages
          lastStageId = plannedIds[plannedIds.length - 1]
        } else {
          // Fallback to last stage in workflow
          lastStageId = wf.stages[wf.stages.length - 1].id
        }
        
        // Use job.currentStageId instead of runs[0].stageId (more reliable)
        const postingStageId = (job as any).currentStageId || (runs.length > 0 ? runs[0].stageId : undefined)
        
        console.log('[ConfirmInventoryPostingModal] handleConfirm stage check:', {
          lastStageId,
          postingStageId,
          jobCurrentStageId: (job as any).currentStageId,
          plannedIds,
          match: postingStageId === lastStageId
        })
        
        if (postingStageId && postingStageId !== lastStageId) {
          throw new Error(`Cannot post to inventory from stage ${postingStageId}. Only the final stage (${lastStageId}) can post to inventory.`)
        }
        
        // Additional validation: Check if any runs have been transferred (shouldn't happen at last stage, but safety check)
        const runsInLastStage = runs.filter(r => r.stageId === lastStageId)
        const transferredRuns = runsInLastStage.filter(r => 
          (r as any).transferSourceRunIds && Array.isArray((r as any).transferSourceRunIds) && (r as any).transferSourceRunIds.length > 0
        )
        
        if (transferredRuns.length > 0) {
          // This shouldn't happen, but if it does, we should only post actual production runs, not transfer runs
          console.warn('Warning: Found transfer runs in last stage. These will be excluded from inventory posting.')
        }
        
        // Use the new recordJobOutput API
        await recordJobOutput(workspaceId, job.id, {
          qtyOutput: qtyToPost,
          autoConsumeMaterials: autoConsume,
          completeJob: false, // We'll let the parent handle completion or do it here if needed. The original code didn't complete it here, but onSuccess did.
          // Only post from the last stage
          stageId: lastStageId,
          notes: `Production output posted from final stage (${job.code})`
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

      // Fetch updated stock levels for feedback
      const stockAfter: Record<string, number> = {}
      await Promise.all(
        distinctProductIds.map(async (pid) => {
          stockAfter[pid] = await getProductOnHand(workspaceId, pid)
        })
      )

      // Fetch new consumptions to detect backflushed lines
      let backflushLines: Consumption[] = []
      if (autoConsume) {
        try {
          const consumptionsAfter = await listJobConsumptions(workspaceId, job.id)
          const beforeIds = new Set(consumptionsBefore.map(c => c.id))
          backflushLines = consumptionsAfter.filter(
            c => !beforeIds.has(c.id) && String(c.notes || '').includes('Auto-consumed (Backflush)')
          )
        } catch (e) {
          console.warn('Failed to read consumptions after posting (backflush check):', e)
        }
      }

      // Build human-readable feedback message
      try {
        const lines: string[] = []
        lines.push(`Inventory posting completed for Job ${job.code}.`)
        if (distinctProductIds.length > 0) {
          lines.push('')
          lines.push('Stock changes:')
          distinctProductIds.forEach(pid => {
            const product = products.find(p => p.id === pid)
            const name = product ? `${product.sku} — ${product.name}` : pid
            const before = stockBefore[pid] ?? 0
            const after = stockAfter[pid] ?? before
            const uom = product?.uom || ''
            lines.push(`• ${name}: ${before.toLocaleString()} → ${after.toLocaleString()} ${uom}`)
          })
        }

        if (autoConsume) {
          lines.push('')
          if (backflushLines.length > 0) {
            const totalSheets = backflushLines
              .filter(c => ['sht', 'sheet', 'sheets'].includes(String(c.uom || '').toLowerCase()))
              .reduce((sum, c) => sum + Number(c.qtyUsed || 0), 0)

            lines.push(`Backflushing:`)
            lines.push(`• ${backflushLines.length} material consumption line(s) auto-created.`)
            if (totalSheets > 0) {
              lines.push(`• Approx. ${totalSheets.toLocaleString()} sheets consumed automatically (see Consumptions tab for details).`)
            } else {
              lines.push('• Raw materials were auto-consumed based on the BOM (see Consumptions tab for exact lines).')
            }
          } else {
            lines.push('')
            lines.push('Backflushing attempted, but no new auto-consumption lines were detected. Please review the Consumptions tab.')
          }
        }

        alert(lines.join('\n'))
      } catch (e) {
        console.warn('Failed to build inventory posting feedback message:', e)
      }

      onClose()
      // Call onSuccess callback if provided (for completing job after successful posting)
      if (onSuccess) {
        onSuccess()
      }
    } catch (error: any) {
      console.error('Error confirming inventory posting:', error)
      const errorMessage = error?.message || 'Unknown error occurred'
      alert(`Failed to post inventory: ${errorMessage}\n\nPlease try again.`)
    } finally {
      setIsSubmitting(false)
    }
  }

  const selectedCount = rows.filter(r => r.selected).length
  const allSelected = rows.length > 0 && rows.every(r => r.selected)
  const someSelected = selectedCount > 0 && !allSelected
  const invalid = rows.some(r => r.selected && (!((r.productId || products.find(p => p.sku === r.sku)?.id)) || Number(r.qty) <= 0))
  
  // Calculate total quantity for conditional rendering
  const totalQty = rows.reduce((sum, r) => sum + Number(r.qty || 0), 0)
  
  // Debug log for modal rendering decision
  console.log('[ConfirmInventoryPostingModal] Rendering decision:', {
    totalQty,
    runsLength: runs.length,
    rowsLength: rows.length,
    rows: rows.map(r => ({ sku: r.sku, qty: r.qty, selected: r.selected })),
    willRender: !(totalQty <= 0 && runs.length > 0),
    jobOutput: job.output,
    lastStageRuns: runs.filter((r: any) => {
      const wf = (workflows as any[]).find(w => w.id === (job as any).workflowId)
      if (!wf || !Array.isArray(wf.stages) || wf.stages.length === 0) return false
      const lastStageId = wf.stages[wf.stages.length - 1].id
      return r.stageId === lastStageId && !((r as any).transferSourceRunIds && Array.isArray((r as any).transferSourceRunIds) && (r as any).transferSourceRunIds.length > 0)
    }).map((r: any) => ({ id: r.id, qtyGood: r.qtyGood, stageId: r.stageId }))
  })
  
  // Don't render modal if there's nothing to post (after runs have loaded and processed)
  // But only check this if runs have been loaded (runs.length > 0)
  // If rows are empty but runs exist, wait for useEffect to populate rows
  if (totalQty <= 0 && runs.length > 0 && rows.length > 0) {
    console.log('[ConfirmInventoryPostingModal] Not rendering - totalQty is 0 but runs and rows exist')
    return null
  }
  
  // If runs are loaded but rows are still empty, don't render yet (wait for useEffect)
  if (runs.length > 0 && rows.length === 0) {
    console.log('[ConfirmInventoryPostingModal] Waiting for rows to be populated from runs')
    return null
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:rounded-2xl sm:shadow-2xl sm:w-full sm:max-w-7xl border-0 sm:border border-gray-200 flex flex-col h-full sm:h-auto sm:max-h-[90vh]">
        {/* Mobile Header - Full Width */}
        <div className="p-4 sm:p-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-emerald-500 to-emerald-600 sm:bg-white">
          <div className="flex items-center space-x-3 flex-1">
            <div className="w-10 h-10 sm:w-8 sm:h-8 bg-white/20 sm:bg-transparent rounded-xl sm:rounded-none flex items-center justify-center">
              <CheckBadgeIcon className="h-6 w-6 sm:h-5 sm:w-5 text-white sm:text-emerald-600" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-lg sm:text-lg font-bold text-white sm:text-gray-900">Complete Production Job</h3>
              <p className="text-sm text-emerald-50 sm:text-gray-600">
                Job: <span className="font-mono font-medium">#{job.code}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2 sm:space-x-3">
            <span className="text-xs sm:text-sm text-white/90 sm:text-gray-600 hidden sm:inline">
              {selectedCount} item{selectedCount !== 1 ? 's' : ''} selected
            </span>
            <button
              onClick={onClose}
              className="w-10 h-10 sm:w-8 sm:h-8 bg-white/20 sm:bg-transparent text-white sm:text-gray-400 hover:bg-white/30 sm:hover:bg-gray-100 rounded-xl sm:rounded-lg transition-colors flex items-center justify-center"
            >
              <XMarkIcon className="h-6 w-6 sm:h-5 sm:w-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-4 sm:p-4">
            {/* Mobile: Card View, Desktop: Table View */}
            {/* Desktop Table Header */}
            <div className="hidden sm:grid grid-cols-12 gap-2 text-xs font-semibold text-gray-700 pb-2 border-b border-gray-200 uppercase tracking-wide">
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

            {/* Mobile: Select All */}
            <div className="sm:hidden mb-4 p-3 bg-gray-50 rounded-xl border border-gray-200">
              <div className="flex items-center justify-between">
                <label className="flex items-center space-x-3 flex-1">
                  <input
                    type="checkbox"
                    className="h-5 w-5 text-emerald-600 focus:ring-emerald-500 border-gray-300 rounded"
                    checked={allSelected}
                    ref={el => { if (el) el.indeterminate = someSelected }}
                    onChange={e => {
                      const next = rows.map(r => ({ ...r, selected: e.target.checked }))
                      setRows(next)
                    }}
                  />
                  <span className="text-sm font-semibold text-gray-900">Select All ({selectedCount} selected)</span>
                </label>
              </div>
            </div>

            {/* Mobile: Card View, Desktop: Table Rows */}
            <div className="space-y-3 sm:space-y-0 sm:divide-y sm:divide-gray-100">
              {rows.map((r, i) => {
                const product = products.find(p => p.id === r.productId) || products.find(p => p.sku === r.sku)
                const targetUom = product?.uom || r.uom
                const converted = convertToProductUom(r.uom, Number(r.qty || 0), targetUom)
                const hasProduct = !!(r.productId || products.find(p => p.sku === r.sku)?.id)

                return (
                  <div key={i} className={`${r.selected ? 'bg-emerald-50 border-2 border-emerald-200' : 'bg-white border border-gray-200'} rounded-2xl sm:rounded-none sm:border-0 p-4 sm:p-0 sm:py-2 sm:hover:bg-gray-50 transition-all`}>
                    {/* Mobile Card Layout */}
                    <div className="sm:hidden space-y-3">
                      {/* Header Row */}
                      <div className="flex items-center justify-between">
                        <label className="flex items-center space-x-3 flex-1">
                          <input
                            type="checkbox"
                            className="h-5 w-5 text-emerald-600 focus:ring-emerald-500 border-gray-300 rounded"
                            checked={r.selected}
                            onChange={e => {
                              const next = [...rows]
                              next[i] = { ...next[i], selected: e.target.checked }
                              setRows(next)
                            }}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-gray-900 text-base">{r.name}</p>
                            <p className="font-mono text-sm text-gray-600">{r.sku}</p>
                          </div>
                        </label>
                        <div className="text-right">
                          <div className="text-lg font-bold text-emerald-600">
                            {Number.isFinite(converted) ? Number(converted).toLocaleString() : '-'}
                          </div>
                          <div className="text-xs text-gray-500">{product?.uom || r.uom}</div>
                        </div>
                      </div>

                      {/* Product Selection */}
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-2">Inventory Item</label>
                        <select
                          className={`w-full text-base border-2 rounded-xl px-4 py-3 transition-colors ${r.selected && !hasProduct
                            ? 'border-orange-300 bg-orange-50'
                            : 'border-gray-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500'
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

                      {/* Quantity Row */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-gray-700 mb-2">Quantity</label>
                          <input
                            type="number"
                            min={0}
                            className="w-full text-base border-2 border-gray-300 rounded-xl px-4 py-3 text-right font-medium focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500"
                            value={r.qty}
                            onChange={e => {
                              const next = [...rows]
                              next[i] = { ...next[i], qty: Number(e.target.value) }
                              setRows(next)
                            }}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-700 mb-2">UOM</label>
                          <div className="w-full text-base bg-gray-100 border-2 border-gray-200 rounded-xl px-4 py-3 text-center font-medium">
                            {r.uom}
                          </div>
                        </div>
                      </div>

                      {/* Conversion Info */}
                      {pcsPerBox > 0 && (
                        <div className="text-xs text-gray-600 bg-blue-50 rounded-lg p-2">
                          <span className="font-semibold">Pieces per Box:</span> {pcsPerBox.toLocaleString()}
                        </div>
                      )}
                    </div>

                    {/* Desktop Table Layout */}
                    <div className="hidden sm:grid grid-cols-12 gap-2 items-center">
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
                  </div>
                )
              })}
            </div>

            {/* Options Section */}
            <div className="mt-6 p-4 sm:p-4 bg-blue-50 rounded-xl sm:rounded-lg border border-blue-100">
              <div className="flex items-start space-x-3">
                <div className="flex items-center h-6 sm:h-5">
                  <input
                    id="auto-consume"
                    name="auto-consume"
                    type="checkbox"
                    checked={autoConsume}
                    onChange={(e) => setAutoConsume(e.target.checked)}
                    className="focus:ring-blue-500 h-5 w-5 sm:h-4 sm:w-4 text-blue-600 border-gray-300 rounded"
                  />
                </div>
                <div className="ml-3 flex-1">
                  <label htmlFor="auto-consume" className="text-base sm:text-sm font-semibold text-blue-900 block mb-1">
                    Auto-consume raw materials (Backflushing)
                  </label>
                  <p className="text-sm sm:text-sm text-blue-700">
                    Automatically deduct raw materials from inventory based on the BOM and the quantity being posted.
                  </p>
                </div>
              </div>
            </div>

            {/* Status Badge - Mobile */}
            <div className="mt-4 sm:hidden">
              <div className={`w-full p-4 rounded-xl text-center font-semibold ${invalid ? 'bg-orange-100 text-orange-700 border-2 border-orange-200' : selectedCount === 0 ? 'bg-gray-100 text-gray-700 border-2 border-gray-200' : 'bg-emerald-100 text-emerald-700 border-2 border-emerald-200'
                }`}>
                {selectedCount === 0 ? 'Select items to post' :
                  invalid ? 'Complete required fields' :
                    'Ready to post'}
              </div>
            </div>

            {/* Compact Help Text - Desktop */}
            <div className="mt-4 hidden sm:flex items-center justify-between text-xs text-gray-600">
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

        {/* Footer - Mobile Full Width, Desktop Compact */}
        <div className="p-4 sm:p-4 border-t border-gray-200 bg-gray-50 sm:bg-gray-50">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-0">
            <button
              onClick={onClose}
              disabled={isSubmitting}
              className="w-full sm:w-auto px-6 py-4 sm:py-2 text-base sm:text-sm font-semibold sm:font-medium text-gray-700 bg-white border-2 sm:border border-gray-300 rounded-xl sm:rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 transition-colors disabled:opacity-50 active:scale-[0.98]"
            >
              Cancel
            </button>
            <button
              disabled={invalid || isSubmitting || selectedCount === 0}
              onClick={handleConfirm}
              className={`w-full sm:w-auto px-6 py-4 sm:py-2 text-base sm:text-sm font-bold sm:font-medium text-white rounded-xl sm:rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 transition-all flex items-center justify-center space-x-2 active:scale-[0.98] ${invalid || isSubmitting || selectedCount === 0
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 shadow-lg shadow-emerald-500/30'
                }`}
            >
              {isSubmitting ? (
                <>
                  <div className="w-5 h-5 sm:w-4 sm:h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <CheckBadgeIcon className="h-5 w-5 sm:h-4 sm:w-4" />
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