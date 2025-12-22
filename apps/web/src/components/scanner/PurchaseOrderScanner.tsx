import React, { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getPurchaseOrder, updatePurchaseOrder } from '../../api/purchase-orders'
import { createStockTransaction } from '../../api/inventory'
import { Scanner } from '../Scanner'
import { ScannerHeader } from './components/ScannerHeader'
import { XMarkIcon, CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline'
import { useSessionStore } from '../../state/sessionStore'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import type { PurchaseOrder, PurchaseOrderLineItem } from '../../api/purchase-orders'

interface PurchaseOrderScannerProps {
  workspaceId: string
  onClose: () => void
}

export function PurchaseOrderScanner({ workspaceId, onClose }: PurchaseOrderScannerProps) {
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const { userId } = useSessionStore()

  const poIdFromUrl = searchParams.get('poId')
  const [scannedPOId, setScannedPOId] = useState<string | null>(poIdFromUrl)

  const [po, setPo] = useState<PurchaseOrder | null>(null)
  const [receivedItems, setReceivedItems] = useState<Map<string, { received: boolean; qty: number }>>(new Map())
  const [postedItems, setPostedItems] = useState<Set<string>>(new Set())
  const [isProcessing, setIsProcessing] = useState(false)
  const [isCheckingStatus, setIsCheckingStatus] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Scanner State
  const [scanMode, setScanMode] = useState<'camera' | 'manual'>('camera')
  const [manualCode, setManualCode] = useState('')
  const [processingCode, setProcessingCode] = useState<string | null>(null) // v3.3 Debug

  // IMPORTANT: only initialize from URL once (prevents "Scan New" being overwritten by URL param)
  const didInitFromUrl = useRef(false)
  useEffect(() => {
    if (!didInitFromUrl.current && poIdFromUrl) {
      setScannedPOId(poIdFromUrl)
      didInitFromUrl.current = true
    }
  }, [poIdFromUrl])

  const clearPoIdFromUrl = () => {
    const next = new URLSearchParams(searchParams)
    next.delete('poId')
    setSearchParams(next, { replace: true })
  }

  // Fetch PO when scanned
  const { data: fetchedPO, isError: isFetchError, error: fetchError } = useQuery({
    queryKey: ['po', workspaceId, scannedPOId],
    queryFn: () => getPurchaseOrder(workspaceId, scannedPOId!),
    enabled: !!scannedPOId && !!workspaceId,
  })

  // Clear PO when scannedPOId is cleared
  useEffect(() => {
    if (!scannedPOId) {
      setPo(null)
      setReceivedItems(new Map())
      setPostedItems(new Set())
      setError(null)
      setProcessingCode(null) // Reset debug state
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scannedPOId])

  useEffect(() => {
    if (isFetchError) {
      setProcessingCode(null) // Stop spinner on error
      setError(`PO Lookup Failed: ${fetchError instanceof Error ? fetchError.message : 'Unknown error'}`)
      return
    }

    if (!fetchedPO) return

    setPo(fetchedPO)
    setProcessingCode(null) // Stop spinner on success
    setIsCheckingStatus(true)

    const checkPostedItems = async () => {
      const postedSet = new Set<string>()

      if (Array.isArray(fetchedPO.lineItems)) {
        for (const item of fetchedPO.lineItems) {
          if (!item.productId) continue
          try {
            const txnsCol = collection(db, 'workspaces', workspaceId, 'stockTxns')
            const q = query(
              txnsCol,
              where('productId', '==', item.productId),
              where('refs.poId', '==', fetchedPO.id)
            )
            const snap = await getDocs(q)
            if (!snap.empty) postedSet.add(item.productId)
          } catch (err) {
            console.error('Error checking posted items:', err)
          }
        }
      }

      setPostedItems(postedSet)

      // Initialize received items map (stable keys)
      const initialMap = new Map<string, { received: boolean; qty: number }>()
      const isAlreadyReceived = fetchedPO.status === 'Received' || fetchedPO.status === 'Partially Received'

      if (Array.isArray(fetchedPO.lineItems)) {
        fetchedPO.lineItems.forEach((item, index) => {
          const key = item.productId ?? item.id ?? `idx:${index}`
          initialMap.set(key, {
            received: isAlreadyReceived,
            qty: item.orderQuantity || 0,
          })
        })
      }

      setReceivedItems(initialMap)
      setError(null)
      setIsCheckingStatus(false)
    }

    checkPostedItems()
  }, [fetchedPO, workspaceId, isFetchError, fetchError])

  // Handle QR code scan or manual entry
  const handleScanSuccess = async (code: string) => {
    const trimmedCode = code.trim()
    setError(null)

    // v4.1 FIX: Close scanner immediately to reveal Processing overlay
    setScanMode('manual')

    // Show processing state
    setProcessingCode(trimmedCode)

    // Parse PO ID from QR code (format: "PO:poId")
    if (trimmedCode.startsWith('PO:')) {
      const poId = trimmedCode.substring(3)
      setScannedPOId(poId)
      return
    }

    // Try to find PO by PO Number (format: "PO-000001" or "PO123")
    if (trimmedCode.startsWith('PO-') || trimmedCode.match(/^PO\d+$/)) {
      try {
        setError('Looking up PO...')

        const poCol = collection(db, 'workspaces', workspaceId, 'purchaseOrders')
        const q = query(poCol, where('poNumber', '==', trimmedCode))
        const snap = await getDocs(q)

        if (!snap.empty) {
          const poDoc = snap.docs[0]
          setScannedPOId(poDoc.id)
          setError(null)
        } else {
          setProcessingCode(null)
          setError(`Purchase Order not found: ${trimmedCode}`)
        }
      } catch (err) {
        console.error('Error looking up PO:', err)
        setProcessingCode(null)
        setError(`Failed to lookup PO: ${err instanceof Error ? err.message : 'Unknown error'}`)
      }
      return
    }

    // If it's just a PO ID (without prefix), try ID first, then PO number
    if (trimmedCode.length > 0) {
      try {
        const maybe = await getPurchaseOrder(workspaceId, trimmedCode)
        if (maybe) {
          setScannedPOId(trimmedCode)
          setError(null)
          return
        }
      } catch {
        try {
          const poCol = collection(db, 'workspaces', workspaceId, 'purchaseOrders')
          const q = query(poCol, where('poNumber', '==', trimmedCode))
          const snap = await getDocs(q)

          if (!snap.empty) {
            const poDoc = snap.docs[0]
            setScannedPOId(poDoc.id)
            setError(null)
            return
          }
        } catch (err2) {
          console.error('Error looking up PO:', err2)
        }
      }
    }

    setProcessingCode(null)
    setError('Invalid format. Enter PO number (e.g., PO-000001) or scan QR code')
  }

  const toggleItemReceived = (itemKey: string) => {
    setReceivedItems((prev) => {
      const next = new Map(prev)
      const current = next.get(itemKey)
      if (current) next.set(itemKey, { received: !current.received, qty: current.qty })
      return next
    })
  }

  const updateReceivedQty = (itemKey: string, qty: number) => {
    setReceivedItems((prev) => {
      const next = new Map(prev)
      const current = next.get(itemKey)
      if (current) next.set(itemKey, { received: current.received, qty: Math.max(0, qty) })
      return next
    })
  }

  const handleProcessReceived = async () => {
    if (!po || !workspaceId || !userId) return

    setIsProcessing(true)
    setError(null)

    try {
      const itemsToPost: Array<{ item: PurchaseOrderLineItem; qty: number }> = []

      receivedItems.forEach((status, itemKey) => {
        if (!status.received || status.qty <= 0) return
        const item = Array.isArray(po.lineItems)
          ? po.lineItems.find((li, idx) => (li.productId ?? li.id ?? `idx:${idx}`) === itemKey)
          : null
        if (item && item.productId) itemsToPost.push({ item, qty: status.qty })
      })

      if (itemsToPost.length === 0) {
        setError('Please mark at least one item as received')
        setIsProcessing(false)
        return
      }

      const allItemsReceived =
        Array.isArray(po.lineItems) &&
        po.lineItems.every((item, idx) => {
          const key = item.productId ?? item.id ?? `idx:${idx}`
          const status = receivedItems.get(key)
          return status?.received && status.qty >= (item.orderQuantity || 0)
        })

      if (allItemsReceived && po.status !== 'Received') {
        await updatePurchaseOrder(workspaceId, po.id, {
          status: 'Received',
          dates: { ...po.dates, dateReceived: new Date() },
        })
      } else if (!allItemsReceived && po.status !== 'Partially Received') {
        await updatePurchaseOrder(workspaceId, po.id, { status: 'Partially Received' })
      }

      let postedCount = 0
      let skippedCount = 0

      for (const { item, qty } of itemsToPost) {
        if (!item.productId || qty <= 0) continue

        if (postedItems.has(item.productId)) {
          skippedCount++
          continue
        }

        const txnsCol = collection(db, 'workspaces', workspaceId, 'stockTxns')
        const q = query(
          txnsCol,
          where('productId', '==', item.productId),
          where('refs.poId', '==', po.id)
        )
        const snap = await getDocs(q)

        if (snap.empty) {
          await createStockTransaction({
            workspaceId,
            productId: item.productId,
            type: 'in',
            qty,
            userId,
            reason: `Received from PO ${po.poNumber}`,
            reference: po.poNumber,
            unitCost: item.unitRate > 0 ? item.unitRate : null,
            refs: { poId: po.id, poNumber: po.poNumber },
          })
          postedCount++
        } else {
          skippedCount++
        }
      }

      queryClient.invalidateQueries({ queryKey: ['purchaseOrders', workspaceId] })
      queryClient.invalidateQueries({ queryKey: ['po', workspaceId, po.id] })
      queryClient.invalidateQueries({ queryKey: ['products', workspaceId] })
      queryClient.invalidateQueries({ queryKey: ['stockTxns', workspaceId] })

      let message = `Successfully processed ${postedCount} item(s) to inventory.`
      if (skippedCount > 0) message += ` ${skippedCount} item(s) were already posted and skipped.`
      alert(message)

      // Close: stop camera + clear URL param so it won't re-open on next render
      clearPoIdFromUrl()
      onClose()
    } catch (err) {
      console.error('Error processing received items:', err)
      setError(`Failed to process: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleCloseClick = () => {
    // Don't clear URL here, it conflicts with navigation
    onClose()
  }

  const handleScanNew = () => {
    clearPoIdFromUrl()

    if (scannedPOId) {
      queryClient.removeQueries({ queryKey: ['po', workspaceId, scannedPOId] })
    }

    // Clear all state
    setScannedPOId(null)
    setPo(null)
    setReceivedItems(new Map())
    setPostedItems(new Set())
    setError(null)
    setManualCode('')
    setProcessingCode(null)

    // Reset to camera mode
    setScanMode('camera')
  }

  if (po) {
    const isAlreadyReceived = po.status === 'Received'
    const isPartiallyReceived = po.status === 'Partially Received'
    const postedProductCount = po.lineItems?.filter((i) => i.productId).length ?? 0
    const allPosted = isAlreadyReceived && postedItems.size === postedProductCount

    return (
      <div className="fixed inset-0 bg-gray-50 z-50 flex flex-col" style={{ touchAction: 'pan-y' }}>
        {/* Close button (mobile-stable) */}
        <button
          type="button"
          onPointerUp={(e) => {
            e.stopPropagation()
            handleCloseClick()
          }}
          className="absolute top-2 right-2 z-[200] bg-white rounded-full shadow-lg p-3 text-gray-400 active:bg-gray-100 min-w-[50px] min-h-[50px] flex items-center justify-center"
          style={{
            WebkitTapHighlightColor: 'transparent',
            WebkitUserSelect: 'none',
            userSelect: 'none',
          }}
          aria-label="Close"
        >
          <XMarkIcon className="h-6 w-6 pointer-events-none" />
        </button>

        <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between relative z-[100]">
          <h2 className="text-lg font-semibold text-gray-900 pr-12">
            Receive PO <span className="text-xs text-blue-600 font-mono font-bold">v4.1</span>
          </h2>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {/* PO Info */}
          <div
            className={`bg-white rounded-lg shadow-sm border-2 p-4 mb-4 ${isAlreadyReceived
              ? 'border-green-500 bg-green-50'
              : isPartiallyReceived
                ? 'border-yellow-500 bg-yellow-50'
                : 'border-gray-200'
              }`}
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-gray-900">{po.poNumber}</h3>
              {isAlreadyReceived && (
                <span className="px-2 py-1 text-xs font-semibold text-green-700 bg-green-100 rounded">
                  Already Received
                </span>
              )}
              {isPartiallyReceived && (
                <span className="px-2 py-1 text-xs font-semibold text-yellow-700 bg-yellow-100 rounded">
                  Partially Received
                </span>
              )}
            </div>
            <p className="text-sm text-gray-600">Vendor: {po.vendor?.name || 'N/A'}</p>
            <p className="text-sm text-gray-600">Status: {po.status}</p>
          </div>

          {/* Items List */}
          <div className="space-y-3">
            <h3 className="font-semibold text-gray-900 mb-2">Line Items</h3>

            {Array.isArray(po.lineItems) && po.lineItems.length > 0 ? (
              po.lineItems.map((item, index) => {
                const key = item.productId ?? item.id ?? `idx:${index}`
                const status = receivedItems.get(key) || { received: false, qty: item.orderQuantity || 0 }
                const isPosted = item.productId ? postedItems.has(item.productId) : false

                return (
                  <div
                    key={key}
                    className={`bg-white rounded-lg shadow-sm border-2 p-4 ${status.received ? 'border-green-500' : 'border-gray-200'
                      } ${isPosted ? 'bg-blue-50' : ''}`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium text-gray-900">{item.itemDescription}</h4>
                          {isPosted && (
                            <span className="px-2 py-0.5 text-xs font-semibold text-blue-700 bg-blue-100 rounded">
                              Posted
                            </span>
                          )}
                        </div>

                        {item.partNumber && <p className="text-sm text-gray-500">Part #: {item.partNumber}</p>}

                        <p className="text-sm text-gray-600 mt-1">
                          Ordered: {item.orderQuantity} {item.uom || 'units'}
                        </p>

                        {isPosted && <p className="text-xs text-blue-600 mt-1">✓ Already posted to inventory</p>}
                      </div>

                      <button
                        type="button"
                        onClick={() => !isAlreadyReceived && toggleItemReceived(key)}
                        disabled={isAlreadyReceived}
                        className={`ml-4 p-2 rounded-full ${status.received ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                          } ${isAlreadyReceived ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        {status.received ? (
                          <CheckCircleIcon className="h-6 w-6" />
                        ) : (
                          <XCircleIcon className="h-6 w-6" />
                        )}
                      </button>
                    </div>

                    {status.received && (
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Received Quantity</label>
                        <input
                          type="number"
                          min="0"
                          max={item.orderQuantity}
                          value={status.qty}
                          onChange={(e) =>
                            !isAlreadyReceived && updateReceivedQty(key, parseFloat(e.target.value) || 0)
                          }
                          disabled={isAlreadyReceived}
                          className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 ${isAlreadyReceived ? 'bg-gray-100 cursor-not-allowed' : ''
                            }`}
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Max: {item.orderQuantity} {item.uom || 'units'}
                        </p>
                        {isPosted && (
                          <p className="text-xs text-blue-600 mt-1">
                            ⚠ This item is already posted to inventory. Posting again will create a duplicate
                            transaction.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )
              })
            ) : (
              <p className="text-gray-500 text-center py-8">No line items found</p>
            )}
          </div>

          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">{error}</div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="bg-white border-t border-gray-200 px-4 py-3 flex gap-2 relative z-[100]">
          <button
            type="button"
            onPointerUp={(e) => {
              e.stopPropagation()
              handleScanNew()
            }}
            className="flex-1 px-4 py-4 text-base font-medium text-gray-700 bg-white border-2 border-gray-300 rounded-lg active:bg-gray-100 min-h-[56px]"
            style={{ WebkitTapHighlightColor: 'transparent' }}
          >
            Scan New PO
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              handleProcessReceived()
            }}
            onPointerUp={(e) => {
              if (!isProcessing && !isCheckingStatus) {
                e.stopPropagation()
                handleProcessReceived()
              }
            }}
            disabled={isProcessing || isCheckingStatus || allPosted}
            className="flex-1 px-4 py-3 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 active:bg-green-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-h-[44px]"
          >
            {isProcessing ? 'Processing...' : isCheckingStatus ? 'Checking...' : allPosted ? 'All Items Posted' : 'Process Received'}
          </button>
        </div>
      </div>
    )
  }

  // Show scanner
  return (
    <div className="fixed inset-0 bg-gray-900 z-50 flex flex-col">
      <ScannerHeader onClose={handleCloseClick} />

      <div className="flex-1 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-gray-900 rounded-2xl overflow-hidden shadow-2xl aspect-[3/4] relative flex flex-col items-center justify-center text-white mb-4">

            {/* Shared Scanner Component */}
            {scanMode === 'camera' && !processingCode && (
              <div className="absolute inset-0 z-10 w-full h-full">
                <Scanner
                  onScan={handleScanSuccess}
                  onClose={() => setScanMode('manual')}
                />
              </div>
            )}

            {processingCode ? (
              <div className="absolute inset-0 bg-blue-900 flex flex-col items-center justify-center p-6 z-30">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mb-4"></div>
                <h3 className="text-xl font-bold mb-2">Processing Scan</h3>
                <p className="font-mono text-blue-200 text-center break-all text-sm mb-4">"{processingCode}"</p>
                <p className="text-sm text-blue-300">Searching database...</p>
              </div>
            ) : scanMode === 'manual' ? (
              <div className="w-full h-full flex flex-col items-center justify-center p-4">
                <input
                  type="text"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && manualCode.trim()) handleScanSuccess(manualCode.trim())
                  }}
                  placeholder="Enter PO Number (e.g., PO-000001)"
                  className="w-full px-4 py-3 bg-gray-800 text-white rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => manualCode.trim() && handleScanSuccess(manualCode.trim())}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold"
                >
                  Submit
                </button>
                <button type="button" onClick={() => setScanMode('camera')} className="mt-4 text-sm text-gray-400 hover:text-white">
                  Use Camera
                </button>
              </div>
            ) : null}
          </div>

          <p className="text-center text-white text-sm">Scan PO QR code or enter manually</p>
        </div>
      </div>

      {error && <div className="bg-red-50 border-t border-red-200 px-4 py-3 text-red-700 text-sm">{error}</div>}
    </div>
  )
}
