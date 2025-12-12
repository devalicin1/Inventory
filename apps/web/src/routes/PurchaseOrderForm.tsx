import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createPurchaseOrder,
  getPurchaseOrder,
  updatePurchaseOrder,
  type PurchaseOrder,
  type PurchaseOrderLineItem,
  type PurchaseOrderStatus,
  type Vendor,
  type Address,
} from '../api/purchase-orders'
import { listProducts } from '../api/products'
import { listVendors } from '../api/vendors'
import { listAddresses } from '../api/addresses'
import { listUOMs } from '../api/settings'
import { getCompanyInformation } from '../api/company'
import { createStockTransaction } from '../api/inventory'
import { downloadPurchaseOrderPDF } from '../utils/purchaseOrderPdfGenerator'
import { useSessionStore } from '../state/sessionStore'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { generateQRCodeDataURL, downloadQRCode, copyQRCodeToClipboard } from '../utils/qrcode'
import {
  XMarkIcon,
  MagnifyingGlassIcon,
  QrCodeIcon,
  TrashIcon,
  PlusIcon,
  CalendarDaysIcon,
  ArrowDownTrayIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline'

// Default export fields
const DEFAULT_FIELDS = [
  'poNumber',
  'dateOrdered',
  'dateExpected',
  'dateReceived',
  'submittedBy',
  'approvedBy',
  'itemDescription',
  'partNumber',
  'quantity',
  'unitName',
  'unitRate',
  'amount',
  'subtotal',
  'discounts',
  'tax',
  'shipping',
  'companyLogo',
  'lineItem',
  'itemNotes',
]

// Helper function to clean product names and fix encoding issues
const cleanProductName = (name: string | null | undefined): string => {
  if (!name) return ''
  let cleaned = String(name)
    .replace(/\uFFFD/g, '') // Remove replacement characters ()
    .replace(/\u0000/g, '') // Remove null characters
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // Remove control characters
    .trim()
  
  // Try to decode HTML entities if any
  try {
    const textarea = document.createElement('textarea')
    textarea.innerHTML = cleaned
    cleaned = textarea.value || cleaned
  } catch (e) {
    // If decoding fails, use original
  }
  
  // Fix common encoding issues
  cleaned = cleaned
    .replace(/'/g, "'") // Replace smart apostrophe
    .replace(/'/g, "'") // Replace right single quotation mark
    .replace(/"/g, '"') // Replace smart double quote
    .replace(/"/g, '"') // Replace right double quotation mark
    .replace(/–/g, '-') // Replace en dash
    .replace(/—/g, '-') // Replace em dash
  
  // Remove question marks that appear between characters (likely encoding errors)
  cleaned = cleaned.replace(/\s+\?\s+/g, ' ') // Remove " ? " patterns
  cleaned = cleaned.replace(/(\w)\s+\?(\s+\w)/g, '$1$2') // Remove " ? " between words
  cleaned = cleaned.replace(/(\w)\?(\w)/g, '$1$2') // Remove "?" between characters
  cleaned = cleaned.replace(/\s+\?/g, '') // Remove trailing " ?"
  cleaned = cleaned.replace(/\?\s+/g, '') // Remove leading "? "
  cleaned = cleaned.replace(/\s+/g, ' ') // Normalize multiple spaces to single space
  cleaned = cleaned.trim()
  
  return cleaned || name
}

export function PurchaseOrderForm() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const location = useLocation()
  const { workspaceId, userId } = useSessionStore()
  const queryClient = useQueryClient()
  const isEdit = location.pathname.includes('/edit')
  const isView = !!id && !isEdit
  
  // Check if we're duplicating from an existing PO
  const duplicateFromId = new URLSearchParams(location.search).get('duplicate')

  const [formData, setFormData] = useState<Partial<PurchaseOrder>>({
    status: 'Draft',
    orderTotal: 0,
    lineItems: [],
    dates: {},
    vendor: undefined,
    shipTo: undefined,
    billTo: undefined,
    notes: '',
    createdBy: userId || undefined,
  })

  const [itemSearchTerm, setItemSearchTerm] = useState('')
  const [showLowStockOnly, setShowLowStockOnly] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [showProductDropdown, setShowProductDropdown] = useState(false)
  const [selectedProductIndex, setSelectedProductIndex] = useState(-1)
  const [showVendorModal, setShowVendorModal] = useState(false)
  const [showShipToModal, setShowShipToModal] = useState(false)
  const [showBillToModal, setShowBillToModal] = useState(false)
  const [showReceivedConfirmModal, setShowReceivedConfirmModal] = useState(false)
  const [showExportModal, setShowExportModal] = useState(false)
  const [showPostToInventoryModal, setShowPostToInventoryModal] = useState(false)
  const [isPosting, setIsPosting] = useState(false)
  const [postedItems, setPostedItems] = useState<Set<string>>(new Set())
  const [pendingStatus, setPendingStatus] = useState<PurchaseOrderStatus | null>(null)
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null)
  const [isGeneratingQR, setIsGeneratingQR] = useState(false)
  const [showQRModal, setShowQRModal] = useState(false)
  const [exportOptions, setExportOptions] = useState({
    includeItemPhotos: true,
    selectedFields: [
      'poNumber',
      'dateOrdered',
      'dateExpected',
      'dateReceived',
      'submittedBy',
      'approvedBy',
      'itemDescription',
      'partNumber',
      'quantity',
      'unitName',
      'unitRate',
      'amount',
      'subtotal',
      'companyLogo',
      'lineItem',
    ],
  })
  const [isExporting, setIsExporting] = useState(false)
  const productDropdownRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Fetch existing PO if editing or duplicating
  const poIdToFetch = id || duplicateFromId
  const { data: existingPO, isLoading: loadingPO } = useQuery({
    queryKey: ['purchaseOrder', workspaceId, poIdToFetch],
    queryFn: () => getPurchaseOrder(workspaceId!, poIdToFetch!),
    enabled: !!workspaceId && !!poIdToFetch,
  })

  // Fetch products for line items
  const { data: products = [] } = useQuery({
    queryKey: ['products', workspaceId],
    queryFn: () => listProducts(workspaceId!),
    enabled: !!workspaceId,
  })

  // Fetch vendors
  const { data: vendors = [] } = useQuery({
    queryKey: ['vendors', workspaceId],
    queryFn: () => listVendors(workspaceId!),
    enabled: !!workspaceId,
  })

  // Fetch addresses
  const { data: addresses = [] } = useQuery({
    queryKey: ['addresses', workspaceId],
    queryFn: () => listAddresses(workspaceId!),
    enabled: !!workspaceId,
  })

  // Fetch UOMs for unit selection
  const { data: uoms = [] } = useQuery({
    queryKey: ['uoms', workspaceId],
    queryFn: () => listUOMs(workspaceId!),
    enabled: !!workspaceId,
  })

  // Fetch company information for export
  const { data: companyInfo } = useQuery({
    queryKey: ['companyInfo', workspaceId],
    queryFn: () => getCompanyInformation(workspaceId!),
    enabled: !!workspaceId,
  })

  // Generate QR code for PO
  useEffect(() => {
    if (existingPO && existingPO.id) {
      const generateQR = async () => {
        setIsGeneratingQR(true)
        try {
          // QR kod içeriği: PO ID veya PO Number
          const qrText = `PO:${existingPO.id}`
          const result = await generateQRCodeDataURL(qrText, { scale: 8 })
          setQrCodeUrl(result.dataUrl)
        } catch (error) {
          console.error('QR kod oluşturma hatası:', error)
        } finally {
          setIsGeneratingQR(false)
        }
      }
      generateQR()
    } else {
      setQrCodeUrl(null)
    }
  }, [existingPO?.id])

  // Load existing PO data (for edit) or duplicate PO data (for new PO from duplicate)
  useEffect(() => {
    if (existingPO) {
      // If we're duplicating, we want to copy the data but reset certain fields
      const isDuplicating = !!duplicateFromId && !id
      
      if (isDuplicating) {
        console.log('[PurchaseOrderForm] Duplicating PO:', existingPO)
        
        // Copy PO data but reset status, dates, and remove ID/PO number
        const dates = existingPO.dates || {}
        const convertTimestamp = (ts: any): Date | undefined => {
          if (!ts) return undefined
          try {
            if (ts?.toDate && typeof ts.toDate === 'function') {
              return ts.toDate()
            } else if (ts.seconds) {
              return new Date(ts.seconds * 1000)
            } else if (ts instanceof Date) {
              return ts
            } else if (typeof ts === 'string') {
              const d = new Date(ts)
              return isNaN(d.getTime()) ? undefined : d
            } else if (typeof ts === 'number') {
              const d = new Date(ts)
              return isNaN(d.getTime()) ? undefined : d
            }
          } catch (e) {
            console.error('Error converting timestamp:', e, ts)
          }
          return undefined
        }
        
        // Helper to convert timestamps recursively
        const convertTimestamps = (data: any): any => {
          if (!data || typeof data !== 'object') return data
          if (data instanceof Date) return data
          if (data?.toDate && typeof data.toDate === 'function') {
            return data.toDate()
          }
          if (data.seconds) {
            return new Date(data.seconds * 1000)
          }
          if (Array.isArray(data)) {
            return data.map(convertTimestamps)
          }
          const converted: any = {}
          for (const key in data) {
            if (data.hasOwnProperty(key)) {
              converted[key] = convertTimestamps(data[key])
            }
          }
          return converted
        }
        
        // Convert lineItems to array if needed
        let rawLineItems = existingPO.lineItems
        if (rawLineItems && !Array.isArray(rawLineItems) && typeof rawLineItems === 'object') {
          const keys = Object.keys(rawLineItems)
          const numericKeys = keys.filter(k => !isNaN(parseInt(k)) && parseInt(k).toString() === k)
          if (numericKeys.length > 0) {
            rawLineItems = numericKeys
              .sort((a, b) => parseInt(a) - parseInt(b))
              .map(key => convertTimestamps(rawLineItems[key]))
          } else {
            rawLineItems = []
          }
        } else if (Array.isArray(rawLineItems)) {
          rawLineItems = rawLineItems.map(item => convertTimestamps(item))
        } else {
          rawLineItems = []
        }
        
        const duplicatedData: Partial<PurchaseOrder> = {
          status: 'Draft', // Reset to Draft
          orderTotal: existingPO.orderTotal || 0,
          lineItems: rawLineItems as PurchaseOrderLineItem[],
          dates: {
            // Reset dates - don't copy them
            submittedBy: '',
            dateExpected: undefined,
            approvedBy: '',
            dateOrdered: undefined,
            dateReceived: undefined,
          },
          vendor: existingPO.vendor ? { ...existingPO.vendor } : undefined,
          shipTo: existingPO.shipTo ? { ...existingPO.shipTo } : undefined,
          billTo: existingPO.billTo ? { ...existingPO.billTo } : undefined,
          notes: existingPO.notes || '',
          createdBy: userId || undefined,
          // Explicitly exclude poNumber so createPurchaseOrder generates a new one
          poNumber: undefined,
        }
        
        setFormData(duplicatedData)
        return
      }
      
      // Normal edit/view mode
      console.log('[PurchaseOrderForm] Loading existing PO:', existingPO)
      
      // Ensure dates object is properly structured
      const dates = existingPO.dates || {}
      
      // Convert Firestore Timestamps to Date objects (if not already converted by API)
      const convertTimestamp = (ts: any): Date | undefined => {
        if (!ts) return undefined
        try {
          if (ts?.toDate && typeof ts.toDate === 'function') {
            return ts.toDate()
          } else if (ts.seconds) {
            return new Date(ts.seconds * 1000)
          } else if (ts instanceof Date) {
            return ts
          } else if (typeof ts === 'string') {
            const d = new Date(ts)
            return isNaN(d.getTime()) ? undefined : d
          } else if (typeof ts === 'number') {
            const d = new Date(ts)
            return isNaN(d.getTime()) ? undefined : d
          }
        } catch (e) {
          console.error('Error converting timestamp:', e, ts)
        }
        return undefined
      }
      
      // Convert lineItems to array if it's an object (Firestore sometimes returns objects with numeric keys)
      let rawLineItems = existingPO.lineItems
      if (rawLineItems && !Array.isArray(rawLineItems) && typeof rawLineItems === 'object') {
        // Convert object with numeric keys to array
        const keys = Object.keys(rawLineItems).sort((a, b) => {
          const numA = parseInt(a)
          const numB = parseInt(b)
          if (!isNaN(numA) && !isNaN(numB)) {
            return numA - numB
          }
          return a.localeCompare(b)
        })
        rawLineItems = keys.map(key => rawLineItems[key])
        console.log('[PurchaseOrderForm] Converted lineItems object to array:', rawLineItems)
      }
      
      // Ensure lineItems is an array and process each item
      const lineItems = Array.isArray(rawLineItems) 
        ? rawLineItems.map((item: any) => ({
            ...item,
            orderQuantity: item.orderQuantity || 0,
            unitRate: item.unitRate || 0,
            amount: item.amount || (item.orderQuantity || 0) * (item.unitRate || 0),
            uom: item.uom || '',
          }))
        : []
      
      console.log('[PurchaseOrderForm] Processed dates:', {
        submittedBy: dates.submittedBy,
        dateExpected: dates.dateExpected,
        approvedBy: dates.approvedBy,
        dateOrdered: dates.dateOrdered,
        dateReceived: dates.dateReceived,
      })
      
      console.log('[PurchaseOrderForm] Processed lineItems:', lineItems)
      console.log('[PurchaseOrderForm] existingPO.createdAt:', existingPO.createdAt, typeof existingPO.createdAt)
      console.log('[PurchaseOrderForm] existingPO.lineItems (raw):', existingPO.lineItems, 'type:', typeof existingPO.lineItems, 'isArray:', Array.isArray(existingPO.lineItems))
      
      // Final lineItems (should already be processed above)
      const finalLineItems = lineItems
      
      console.log('[PurchaseOrderForm] Final lineItems count:', finalLineItems.length)
      console.log('[PurchaseOrderForm] Final lineItems:', JSON.stringify(finalLineItems, null, 2))
      
      // Ensure we preserve all existingPO data but override with processed values
      const updatedFormData = {
        ...existingPO,
        lineItems: finalLineItems,
        dates: {
          submittedBy: dates.submittedBy || '',
          dateExpected: convertTimestamp(dates.dateExpected),
          approvedBy: dates.approvedBy || '',
          dateOrdered: convertTimestamp(dates.dateOrdered),
          dateReceived: convertTimestamp(dates.dateReceived),
        },
      }
      
      console.log('[PurchaseOrderForm] Setting formData with lineItems:', updatedFormData.lineItems?.length || 0)
      console.log('[PurchaseOrderForm] Updated formData:', JSON.stringify(updatedFormData, null, 2))
      
      setFormData(updatedFormData)
      
      // Double check after state update
      setTimeout(() => {
        console.log('[PurchaseOrderForm] formData after setState (check):', formData.lineItems?.length || 0)
      }, 100)
    }
  }, [existingPO, duplicateFromId, id, userId])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        productDropdownRef.current &&
        !productDropdownRef.current.contains(event.target as Node) &&
        searchInputRef.current &&
        !searchInputRef.current.contains(event.target as Node)
      ) {
        setShowProductDropdown(false)
      }
    }

    if (showProductDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showProductDropdown])

  // Calculate order total
  const orderTotal = useMemo(() => {
    if (!formData.lineItems || !Array.isArray(formData.lineItems)) {
      return 0
    }
    return formData.lineItems.reduce((sum, item) => sum + (item.amount || 0), 0)
  }, [formData.lineItems])

  // Filter products for search
  const filteredProducts = useMemo(() => {
    let filtered = products

    // Filter by search term
    if (itemSearchTerm) {
      filtered = filtered.filter(
        (p) =>
          p.name.toLowerCase().includes(itemSearchTerm.toLowerCase()) ||
          p.sku.toLowerCase().includes(itemSearchTerm.toLowerCase())
      )
    }

    // Filter by low stock
    if (showLowStockOnly) {
      filtered = filtered.filter((p) => (p.qtyOnHand || 0) < (p.minStock || 0))
    }

    // Limit to 10 results for dropdown
    return filtered.slice(0, 10)
  }, [products, itemSearchTerm, showLowStockOnly])

  // Handle keyboard navigation in product dropdown
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showProductDropdown || filteredProducts.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedProductIndex((prev) => Math.min(prev + 1, filteredProducts.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedProductIndex((prev) => Math.max(prev - 1, -1))
    } else if (e.key === 'Enter' && selectedProductIndex >= 0) {
      e.preventDefault()
      handleAddItem(filteredProducts[selectedProductIndex])
      setShowProductDropdown(false)
      setSelectedProductIndex(-1)
    } else if (e.key === 'Escape') {
      setShowProductDropdown(false)
      setSelectedProductIndex(-1)
    }
  }

  const handleAddItem = (product: any) => {
    // Ensure lineItems is an array
    const currentLineItems = Array.isArray(formData.lineItems) ? formData.lineItems : []
    
    // Check if product is already in line items
    const existingIndex = currentLineItems.findIndex((item) => item.productId === product.id)
    
    if (existingIndex >= 0) {
      // If product exists, just increment quantity
      handleUpdateLineItem(existingIndex, {
        orderQuantity: (currentLineItems[existingIndex].orderQuantity || 0) + 1,
      })
    } else {
      // Add new item with product's UOM
      const newItem: PurchaseOrderLineItem = {
        productId: product.id,
        itemDescription: cleanProductName(product.name),
        partNumber: product.sku,
        orderQuantity: 1,
        uom: product.uom || '',
        unitRate: 0,
        amount: 0,
        quantityReceived: 0,
      }

      setFormData({
        ...formData,
        lineItems: [...currentLineItems, newItem],
      })
    }
    
    setItemSearchTerm('')
    setShowProductDropdown(false)
    setSelectedProductIndex(-1)
  }

  const handleUpdateLineItem = (index: number, updates: Partial<PurchaseOrderLineItem>) => {
    const currentLineItems = Array.isArray(formData.lineItems) ? formData.lineItems : []
    const updatedItems = [...currentLineItems]
    const item = { ...updatedItems[index], ...updates }
    item.amount = (item.orderQuantity || 0) * (item.unitRate || 0)
    updatedItems[index] = item

    setFormData({
      ...formData,
      lineItems: updatedItems,
    })
  }

  const handleRemoveLineItem = (index: number) => {
    const currentLineItems = Array.isArray(formData.lineItems) ? formData.lineItems : []
    const updatedItems = currentLineItems.filter((_, i) => i !== index)
    setFormData({
      ...formData,
      lineItems: updatedItems,
    })
  }

  const handleSave = async () => {
    if (!workspaceId) return

    setIsSaving(true)
    try {
      // Ensure lineItems is an array
      const lineItems = Array.isArray(formData.lineItems) ? formData.lineItems : []
      
      const poData = {
        ...formData,
        lineItems,
        orderTotal,
        lastUpdated: new Date(),
        // Remove poNumber for new POs (including duplicates) so createPurchaseOrder generates a new one
        ...(isEdit && id ? {} : { poNumber: undefined }),
      }

      if (isEdit && id) {
        await updatePurchaseOrder(workspaceId, id, poData)
      } else {
        await createPurchaseOrder(workspaceId, poData as any)
      }

      queryClient.invalidateQueries({ queryKey: ['purchaseOrders', workspaceId] })
      navigate('/purchase-orders')
    } catch (error) {
      console.error('Failed to save purchase order:', error)
      alert('Failed to save purchase order. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  const formatDate = (date: Date | any) => {
    if (!date) return ''
    try {
      let d: Date
      if (date?.toDate) {
        d = date.toDate()
      } else if (date instanceof Date) {
        d = date
      } else if (typeof date === 'string' || typeof date === 'number') {
        d = new Date(date)
      } else {
        return ''
      }
      
      // Check if date is valid
      if (isNaN(d.getTime())) {
        return ''
      }
      
      return d.toISOString().split('T')[0]
    } catch (error) {
      console.error('Error formatting date:', error, date)
      return ''
    }
  }

  const formatDateTime = (date: Date | any) => {
    if (!date) {
      console.log('[formatDateTime] No date provided')
      return ''
    }
    
    // Skip serverTimestamp placeholders
    if (date && typeof date === 'object' && date._methodName === 'serverTimestamp') {
      console.log('[formatDateTime] Skipping serverTimestamp placeholder')
      return '-'
    }
    
    try {
      let d: Date
      if (date?.toDate && typeof date.toDate === 'function') {
        d = date.toDate()
      } else if (date.seconds && typeof date.seconds === 'number') {
        d = new Date(date.seconds * 1000)
      } else if (date instanceof Date) {
        d = date
      } else if (typeof date === 'string' || typeof date === 'number') {
        d = new Date(date)
      } else {
        console.log('[formatDateTime] Unknown date format:', date)
        return '-'
      }
      
      // Check if date is valid
      if (isNaN(d.getTime())) {
        console.log('[formatDateTime] Invalid date:', d)
        return ''
      }
      
      const formatted = d.toLocaleString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
      console.log('[formatDateTime] Formatted:', formatted, 'from:', date)
      return formatted
    } catch (error) {
      console.error('Error formatting date time:', error, date)
      return ''
    }
  }

  if (loadingPO) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Purchase Orders</h1>
        </div>
        <div className="flex items-center gap-4">
          {existingPO && (
            <div className="text-sm text-gray-500">
              Last Updated: {formatDateTime(existingPO.lastUpdated || existingPO.updatedAt)}
            </div>
          )}
          {isView ? (
            <div className="flex gap-2">
              {existingPO && qrCodeUrl && (
                <>
                  <button
                    onClick={() => setShowQRModal(true)}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-blue-600 rounded-md hover:bg-blue-700 flex items-center gap-2"
                  >
                    <QrCodeIcon className="h-4 w-4" />
                    QR CODE
                  </button>
                  <button
                    onClick={() => navigate('/scan/po')}
                    className="px-4 py-2 text-sm font-medium text-white bg-purple-600 border border-purple-600 rounded-md hover:bg-purple-700 flex items-center gap-2"
                  >
                    <QrCodeIcon className="h-4 w-4" />
                    SCAN TO RECEIVE
                  </button>
                </>
              )}
              <button
                onClick={() => setShowExportModal(true)}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-red-600 rounded-md hover:bg-red-700 flex items-center gap-2"
              >
                <ArrowDownTrayIcon className="h-4 w-4" />
                EXPORT
              </button>
              {existingPO && existingPO.status === 'Received' && (
                <button
                  onClick={async () => {
                    if (!existingPO || !workspaceId) return
                    
                    // Check which items are already posted before showing modal
                    const alreadyPostedSet = new Set<string>()
                    if (Array.isArray(existingPO.lineItems)) {
                      for (const item of existingPO.lineItems) {
                        if (item.productId) {
                          try {
                            const txnsCol = collection(db, 'workspaces', workspaceId, 'stockTxns')
                            const q = query(
                              txnsCol,
                              where('productId', '==', item.productId),
                              where('refs.poId', '==', existingPO.id)
                            )
                            const snap = await getDocs(q)
                            if (!snap.empty) {
                              alreadyPostedSet.add(item.productId || '')
                            }
                          } catch (error) {
                            console.error('Error checking posted items:', error)
                          }
                        }
                      }
                    }
                    setPostedItems(alreadyPostedSet)
                    setShowPostToInventoryModal(true)
                  }}
                  className="px-4 py-2 text-sm font-medium text-white bg-green-600 border border-green-600 rounded-md hover:bg-green-700 flex items-center gap-2"
                >
                  <CheckCircleIcon className="h-4 w-4" />
                  POST TO INVENTORY
                </button>
              )}
              <button
                onClick={() => navigate(`/purchase-orders/${id}/edit`)}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-blue-600 rounded-md hover:bg-blue-700"
              >
                EDIT
              </button>
              <button
                onClick={() => navigate('/purchase-orders')}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                BACK
              </button>
            </div>
          ) : (
            <button
              onClick={() => navigate('/purchase-orders')}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              CANCEL
            </button>
          )}
        </div>
      </div>

      {/* PO Number and Status */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <input
              type="text"
              value={
                isView || isEdit
                  ? existingPO?.poNumber || 'PO-000004'
                  : duplicateFromId
                    ? 'Auto-generated'
                    : 'Auto-generated'
              }
              readOnly
              className="text-2xl font-bold text-gray-900 bg-transparent border-none focus:outline-none"
            />
            <select
              value={pendingStatus || formData.status || 'Draft'}
              onChange={(e) => {
                const newStatus = e.target.value as PurchaseOrderStatus
                if (newStatus === 'Received' && formData.status !== 'Received') {
                  // Show confirmation modal before changing to Received
                  setPendingStatus(newStatus)
                  setShowReceivedConfirmModal(true)
                } else {
                  setPendingStatus(null)
                  setFormData({ ...formData, status: newStatus })
                }
              }}
              disabled={isView}
              className={`px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                isView ? 'bg-gray-100 cursor-not-allowed' : ''
              }`}
            >
              <option value="Draft">Draft</option>
              <option value="Submitted">Submitted</option>
              <option value="Approved">Approved</option>
              <option value="Ordered">Ordered</option>
              <option value="Partially Received">Partially Received</option>
              <option value="Received">Received</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-500">Order Total</div>
            <div className="text-2xl font-bold text-gray-900">GBP {orderTotal.toFixed(2)}</div>
          </div>
        </div>
        {existingPO && (
          <div className="text-sm text-gray-500">
            Created By: {existingPO.createdBy || 'Ball Packaging'} Date Created:{' '}
            {(() => {
              const createdAt = existingPO.createdAt
              console.log('[PurchaseOrderForm] Rendering createdAt:', createdAt, 'type:', typeof createdAt)
              if (!createdAt) {
                console.log('[PurchaseOrderForm] createdAt is falsy')
                return '-'
              }
              const formatted = formatDateTime(createdAt)
              console.log('[PurchaseOrderForm] formatted createdAt:', formatted)
              return formatted || '-'
            })()}
          </div>
        )}
      </div>

      {/* Dates Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Dates</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Submitted By</label>
            <input
              type="text"
              value={formData.dates?.submittedBy || ''}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  dates: { ...formData.dates, submittedBy: e.target.value },
                })
              }
              disabled={isView}
              readOnly={isView}
              className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                isView ? 'bg-gray-50 cursor-not-allowed' : ''
              }`}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date Expected</label>
            <div className="relative">
              <CalendarDaysIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="date"
                value={formData.dates?.dateExpected ? formatDate(formData.dates.dateExpected) : ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    dates: { ...formData.dates, dateExpected: e.target.value ? new Date(e.target.value) : undefined },
                  })
                }
                disabled={isView}
                readOnly={isView}
                className={`w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  isView ? 'bg-gray-50 cursor-not-allowed' : ''
                }`}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Approved By</label>
            <input
              type="text"
              value={formData.dates?.approvedBy || ''}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  dates: { ...formData.dates, approvedBy: e.target.value },
                })
              }
              disabled={isView}
              readOnly={isView}
              className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                isView ? 'bg-gray-50 cursor-not-allowed' : ''
              }`}
            />
          </div>
        </div>
      </div>

      {/* Line Items Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Line Items</h2>

        {/* Search and Add Items */}
        {!isView && (
          <div className="mb-6 space-y-4">
            <div className="flex gap-4">
              <div className="flex-1 relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search to add items to the purchase order"
                  value={itemSearchTerm}
                  onChange={(e) => {
                    setItemSearchTerm(e.target.value)
                    setShowProductDropdown(true)
                    setSelectedProductIndex(-1)
                  }}
                  onFocus={() => {
                    if (itemSearchTerm || filteredProducts.length > 0) {
                      setShowProductDropdown(true)
                    }
                  }}
                  onKeyDown={handleKeyDown}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              
              {/* Product Dropdown */}
              {showProductDropdown && (
                <div
                  ref={productDropdownRef}
                  className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-80 overflow-auto"
                >
                  {!itemSearchTerm && !showLowStockOnly ? (
                    <div className="px-4 py-3 text-sm text-gray-500">
                      Start typing to search for products from inventory...
                    </div>
                  ) : filteredProducts.length === 0 ? (
                    <div className="px-4 py-3 text-sm text-gray-500">
                      No products found. Try a different search term.
                    </div>
                  ) : (
                    filteredProducts.map((product, index) => {
                      const isLowStock = (product.qtyOnHand || 0) < (product.minStock || 0)
                      const isSelected = index === selectedProductIndex
                      
                      return (
                        <button
                          key={product.id}
                          type="button"
                          onClick={() => handleAddItem(product)}
                          onMouseEnter={() => setSelectedProductIndex(index)}
                          className={`w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors ${
                            isSelected ? 'bg-blue-50' : ''
                          } ${index !== filteredProducts.length - 1 ? 'border-b border-gray-200' : ''}`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-gray-900">{cleanProductName(product.name)}</span>
                                {isLowStock && (
                                  <span className="px-2 py-0.5 text-xs font-medium bg-orange-100 text-orange-800 rounded">
                                    Low Stock
                                  </span>
                                )}
                              </div>
                              <div className="text-sm text-gray-500 mt-0.5">
                                SKU: {product.sku} {product.uom && `• UOM: ${product.uom}`}
                              </div>
                              {product.qtyOnHand !== undefined && (
                                <div className="text-xs text-gray-400 mt-1">
                                  Stock: {product.qtyOnHand} {product.uom || ''}
                                </div>
                              )}
                            </div>
                            <PlusIcon className="h-5 w-5 text-blue-600 flex-shrink-0 ml-2" />
                          </div>
                        </button>
                      )
                    })
                  )}
                </div>
              )}
            </div>
                <button
                  type="button"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2"
                  title="Scan barcode"
                >
                  <QrCodeIcon className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    // Add empty line item for manual entry
                    const currentLineItems = Array.isArray(formData.lineItems) ? formData.lineItems : []
                    const newItem: PurchaseOrderLineItem = {
                      itemDescription: '',
                      partNumber: '',
                      orderQuantity: 1,
                      uom: '',
                      unitRate: 0,
                      amount: 0,
                      quantityReceived: 0,
                    }
                    setFormData({
                      ...formData,
                      lineItems: [...currentLineItems, newItem],
                    })
                  }}
                  className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 flex items-center gap-2"
                  title="Add manual item"
                >
                  <PlusIcon className="h-5 w-5" />
                  Add Manual Item
                </button>
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="lowStock"
                  checked={showLowStockOnly}
                  onChange={(e) => {
                    setShowLowStockOnly(e.target.checked)
                    setShowProductDropdown(true)
                  }}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="lowStock" className="ml-2 text-sm text-gray-700">
                  Only show low-stock items
                </label>
              </div>
            </div>
          )}

        {/* Line Items Table */}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">LINE ITEM</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  ITEM DESCRIPTION
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">PART # ?</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  ORDER QUANTITY
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">UNIT</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">UNIT RATE</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">AMOUNT</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {(() => {
                const hasLineItems = Array.isArray(formData.lineItems) && formData.lineItems.length > 0
                console.log('[PurchaseOrderForm] Rendering tbody - hasLineItems:', hasLineItems, 'lineItems:', formData.lineItems)
                if (!hasLineItems) {
                  return (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-500">
                        No items added yet. Search and add items above.
                      </td>
                    </tr>
                  )
                }
                return formData.lineItems.map((item, index) => {
                  // Get product UOM if productId exists
                  const product = item.productId ? products.find(p => p.id === item.productId) : null
                  const defaultUOM = product?.uom || item.uom || ''
                  
                  return (
                    <tr key={index}>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{index + 1}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {isView ? (
                          <span className="text-sm text-gray-900">{item.itemDescription}</span>
                        ) : (
                          <input
                            type="text"
                            value={item.itemDescription}
                            onChange={(e) => handleUpdateLineItem(index, { itemDescription: e.target.value })}
                            onBlur={(e) => {
                              // Clean the value when user finishes editing
                              const cleaned = cleanProductName(e.target.value)
                              if (cleaned !== e.target.value) {
                                handleUpdateLineItem(index, { itemDescription: cleaned })
                              }
                            }}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {isView ? (
                          <span className="text-sm text-gray-900">{item.partNumber || '-'}</span>
                        ) : (
                          <input
                            type="text"
                            value={item.partNumber || ''}
                            onChange={(e) => handleUpdateLineItem(index, { partNumber: e.target.value })}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="?"
                          />
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {isView ? (
                          <span className="text-sm text-gray-900">{item.orderQuantity}</span>
                        ) : (
                          <input
                            type="number"
                            value={item.orderQuantity}
                            onChange={(e) =>
                              handleUpdateLineItem(index, { orderQuantity: Number(e.target.value) })
                            }
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            min="0"
                          />
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {item.productId ? (
                          // If product is selected, show UOM as text (from product)
                          <span className="text-sm text-gray-700 font-medium px-2 py-1 bg-gray-50 border border-gray-200 rounded">
                            {defaultUOM || '-'}
                          </span>
                        ) : (
                          // If custom item, show UOM dropdown or text
                          isView ? (
                            <span className="text-sm text-gray-700 font-medium px-2 py-1 bg-gray-50 border border-gray-200 rounded">
                              {item.uom || '-'}
                            </span>
                          ) : (
                            <select
                              value={item.uom || ''}
                              onChange={(e) => handleUpdateLineItem(index, { uom: e.target.value })}
                              className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            >
                              <option value="">Select Unit</option>
                              {uoms.map((uom) => (
                                <option key={uom.id} value={uom.symbol}>
                                  {uom.symbol} {uom.name && `(${uom.name})`}
                                </option>
                              ))}
                            </select>
                          )
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {isView ? (
                          <span className="text-sm text-gray-900">GBP {item.unitRate.toFixed(2)}</span>
                        ) : (
                          <input
                            type="number"
                            value={item.unitRate}
                            onChange={(e) => handleUpdateLineItem(index, { unitRate: Number(e.target.value) })}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            min="0"
                            step="0.01"
                          />
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                        GBP {item.amount.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {!isView && (
                          <button
                            onClick={() => handleRemoveLineItem(index)}
                            className="text-red-600 hover:text-red-800"
                          >
                            <TrashIcon className="h-5 w-5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })
              })()}
            </tbody>
          </table>
        </div>
      </div>

      {/* Vendor Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Vendor</h2>
          {!isView && (
            <button
              type="button"
              onClick={() => setShowVendorModal(true)}
              className="px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100"
            >
              SELECT VENDOR
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              value={formData.vendor?.name || ''}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  vendor: { ...formData.vendor, name: e.target.value } as Vendor,
                })
              }
              disabled={isView}
              readOnly={isView}
              className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                isView ? 'bg-gray-50 cursor-not-allowed' : ''
              }`}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Address 1</label>
            <input
              type="text"
              value={formData.vendor?.address1 || ''}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  vendor: { ...formData.vendor, address1: e.target.value } as Vendor,
                })
              }
              className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                isView ? 'bg-gray-50 cursor-not-allowed' : ''
              }`}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Address 2</label>
            <input
              type="text"
              value={formData.vendor?.address2 || ''}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  vendor: { ...formData.vendor, address2: e.target.value } as Vendor,
                })
              }
              disabled={isView}
              readOnly={isView}
              className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                isView ? 'bg-gray-50 cursor-not-allowed' : ''
              }`}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
            <input
              type="text"
              value={formData.vendor?.city || ''}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  vendor: { ...formData.vendor, city: e.target.value } as Vendor,
                })
              }
              disabled={isView}
              readOnly={isView}
              className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                isView ? 'bg-gray-50 cursor-not-allowed' : ''
              }`}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">State / Province / Region</label>
            <input
              type="text"
              value={formData.vendor?.state || ''}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  vendor: { ...formData.vendor, state: e.target.value } as Vendor,
                })
              }
              disabled={isView}
              readOnly={isView}
              className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                isView ? 'bg-gray-50 cursor-not-allowed' : ''
              }`}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Zip / Postal Code</label>
            <input
              type="text"
              value={formData.vendor?.zipCode || ''}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  vendor: { ...formData.vendor, zipCode: e.target.value } as Vendor,
                })
              }
              disabled={isView}
              readOnly={isView}
              className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                isView ? 'bg-gray-50 cursor-not-allowed' : ''
              }`}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
            <select
              value={formData.vendor?.country || ''}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  vendor: { ...formData.vendor, country: e.target.value } as Vendor,
                })
              }
              disabled={isView}
              className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                isView ? 'bg-gray-50 cursor-not-allowed' : ''
              }`}
            >
              <option value="">Select Country</option>
              <option value="GB">United Kingdom</option>
              <option value="US">United States</option>
              <option value="TR">Turkey</option>
              {/* Add more countries as needed */}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={formData.vendor?.email || ''}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  vendor: { ...formData.vendor, email: e.target.value } as Vendor,
                })
              }
              disabled={isView}
              readOnly={isView}
              className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                isView ? 'bg-gray-50 cursor-not-allowed' : ''
              }`}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
            <input
              type="tel"
              value={formData.vendor?.phoneNumber || ''}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  vendor: { ...formData.vendor, phoneNumber: e.target.value } as Vendor,
                })
              }
              disabled={isView}
              readOnly={isView}
              className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                isView ? 'bg-gray-50 cursor-not-allowed' : ''
              }`}
            />
          </div>
        </div>
      </div>

      {/* Ship To Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Ship To</h2>
          {!isView && (
            <button
              type="button"
              onClick={() => setShowShipToModal(true)}
              className="px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100"
            >
              SELECT ADDRESS
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              value={formData.shipTo?.name || ''}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  shipTo: { ...(formData.shipTo || {}), name: e.target.value } as Address,
                })
              }
              disabled={isView}
              readOnly={isView}
              className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                isView ? 'bg-gray-50 cursor-not-allowed' : ''
              }`}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Address 1</label>
            <input
              type="text"
              value={formData.shipTo?.address1 || ''}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  shipTo: { ...(formData.shipTo || {}), address1: e.target.value } as Address,
                })
              }
              disabled={isView}
              readOnly={isView}
              className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                isView ? 'bg-gray-50 cursor-not-allowed' : ''
              }`}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Address 2</label>
            <input
              type="text"
              value={formData.shipTo?.address2 || ''}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  shipTo: { ...(formData.shipTo || {}), address2: e.target.value } as Address,
                })
              }
              disabled={isView}
              readOnly={isView}
              className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                isView ? 'bg-gray-50 cursor-not-allowed' : ''
              }`}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
            <input
              type="text"
              value={formData.shipTo?.city || ''}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  shipTo: { ...(formData.shipTo || {}), city: e.target.value } as Address,
                })
              }
              disabled={isView}
              readOnly={isView}
              className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                isView ? 'bg-gray-50 cursor-not-allowed' : ''
              }`}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">State / Province / Region</label>
            <input
              type="text"
              value={formData.shipTo?.state || ''}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  shipTo: { ...(formData.shipTo || {}), state: e.target.value } as Address,
                })
              }
              disabled={isView}
              readOnly={isView}
              className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                isView ? 'bg-gray-50 cursor-not-allowed' : ''
              }`}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Zip / Postal Code</label>
            <input
              type="text"
              value={formData.shipTo?.zipCode || ''}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  shipTo: { ...(formData.shipTo || {}), zipCode: e.target.value } as Address,
                })
              }
              disabled={isView}
              readOnly={isView}
              className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                isView ? 'bg-gray-50 cursor-not-allowed' : ''
              }`}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
            <select
              value={formData.shipTo?.country || ''}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  shipTo: { ...(formData.shipTo || {}), country: e.target.value } as Address,
                })
              }
              disabled={isView}
              className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                isView ? 'bg-gray-50 cursor-not-allowed' : ''
              }`}
            >
              <option value="">Select Country</option>
              <option value="GB">United Kingdom</option>
              <option value="US">United States</option>
              <option value="TR">Turkey</option>
            </select>
          </div>
        </div>
      </div>

      {/* Bill To Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Bill To</h2>
          {!isView && (
            <button
              type="button"
              onClick={() => setShowBillToModal(true)}
              className="px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100"
            >
              SELECT ADDRESS
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              value={formData.billTo?.name || ''}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  billTo: { ...(formData.billTo || {}), name: e.target.value } as Address,
                })
              }
              disabled={isView}
              readOnly={isView}
              className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                isView ? 'bg-gray-50 cursor-not-allowed' : ''
              }`}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Address 1</label>
            <input
              type="text"
              value={formData.billTo?.address1 || ''}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  billTo: { ...(formData.billTo || {}), address1: e.target.value } as Address,
                })
              }
              disabled={isView}
              readOnly={isView}
              className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                isView ? 'bg-gray-50 cursor-not-allowed' : ''
              }`}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Address 2</label>
            <input
              type="text"
              value={formData.billTo?.address2 || ''}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  billTo: { ...(formData.billTo || {}), address2: e.target.value } as Address,
                })
              }
              disabled={isView}
              readOnly={isView}
              className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                isView ? 'bg-gray-50 cursor-not-allowed' : ''
              }`}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
            <input
              type="text"
              value={formData.billTo?.city || ''}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  billTo: { ...(formData.billTo || {}), city: e.target.value } as Address,
                })
              }
              disabled={isView}
              readOnly={isView}
              className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                isView ? 'bg-gray-50 cursor-not-allowed' : ''
              }`}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">State / Province / Region</label>
            <input
              type="text"
              value={formData.billTo?.state || ''}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  billTo: { ...(formData.billTo || {}), state: e.target.value } as Address,
                })
              }
              disabled={isView}
              readOnly={isView}
              className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                isView ? 'bg-gray-50 cursor-not-allowed' : ''
              }`}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Zip / Postal Code</label>
            <input
              type="text"
              value={formData.billTo?.zipCode || ''}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  billTo: { ...(formData.billTo || {}), zipCode: e.target.value } as Address,
                })
              }
              disabled={isView}
              readOnly={isView}
              className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                isView ? 'bg-gray-50 cursor-not-allowed' : ''
              }`}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
            <select
              value={formData.billTo?.country || ''}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  billTo: { ...(formData.billTo || {}), country: e.target.value } as Address,
                })
              }
              disabled={isView}
              className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                isView ? 'bg-gray-50 cursor-not-allowed' : ''
              }`}
            >
              <option value="">Select Country</option>
              <option value="GB">United Kingdom</option>
              <option value="US">United States</option>
              <option value="TR">Turkey</option>
            </select>
          </div>
        </div>
      </div>

      {/* Notes Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Notes</h2>
        <textarea
          value={formData.notes || ''}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          placeholder="Write a message to the vendor..."
          rows={6}
          disabled={isView}
          readOnly={isView}
          className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-y ${
            isView ? 'bg-gray-50 cursor-not-allowed' : ''
          }`}
        />
      </div>

      {/* Save Button */}
      {!isView && (
        <div className="flex justify-end gap-4">
          <button
            onClick={() => navigate('/purchase-orders')}
            className="px-6 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? 'Saving...' : 'Save Purchase Order'}
          </button>
        </div>
      )}

      {/* Export Modal */}
      {showExportModal && existingPO && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Export</h3>
              <button
                onClick={() => setShowExportModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <div className="grid grid-cols-2 gap-6">
                {/* Left Column - Settings */}
                <div className="space-y-6">
                  {/* Export Settings */}
                  <div>
                    <h4 className="text-sm font-semibold text-gray-900 mb-3">EXPORT SETTINGS</h4>
                    <div className="space-y-3">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={exportOptions.includeItemPhotos}
                          onChange={(e) =>
                            setExportOptions({ ...exportOptions, includeItemPhotos: e.target.checked })
                          }
                          className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
                        />
                        <span className="text-sm text-gray-700">Include Item Photos</span>
                      </label>
                    </div>
                  </div>

                  {/* Select Fields */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-semibold text-gray-900">SELECT FIELDS TO EXPORT</h4>
                      <button
                        onClick={() => {
                          if (exportOptions.selectedFields.length === DEFAULT_FIELDS.length) {
                            setExportOptions({ ...exportOptions, selectedFields: [] })
                          } else {
                            setExportOptions({ ...exportOptions, selectedFields: [...DEFAULT_FIELDS] })
                          }
                        }}
                        className="text-sm text-red-600 hover:text-red-700"
                      >
                        {exportOptions.selectedFields.length === DEFAULT_FIELDS.length
                          ? 'Unselect All'
                          : 'Select All'}
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {DEFAULT_FIELDS.map((field) => (
                        <label key={field} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={exportOptions.selectedFields.includes(field)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setExportOptions({
                                  ...exportOptions,
                                  selectedFields: [...exportOptions.selectedFields, field],
                                })
                              } else {
                                setExportOptions({
                                  ...exportOptions,
                                  selectedFields: exportOptions.selectedFields.filter((f) => f !== field),
                                })
                              }
                            }}
                            className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
                          />
                          <span className="text-sm text-gray-700">
                            {field
                              .replace(/([A-Z])/g, ' $1')
                              .replace(/^./, (str) => str.toUpperCase())
                              .trim()}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Right Column - Preview */}
                <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                  <h4 className="text-sm font-semibold text-gray-900 mb-3">Preview</h4>
                  <div className="bg-white rounded border border-gray-200 p-4 text-xs text-gray-500">
                    <div className="mb-2 font-semibold">PURCHASE ORDER</div>
                    <div className="space-y-1">
                      <div>PO Number: {existingPO.poNumber}</div>
                      <div>Vendor: {existingPO.vendor?.name || '-'}</div>
                      <div>Line Items: {existingPO.lineItems?.length || 0}</div>
                      <div>Total: GBP {existingPO.orderTotal.toFixed(2)}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => setShowExportModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 mr-3"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!existingPO) {
                    alert('Purchase order data is not available.')
                    return
                  }
                  
                  console.log('[Export] Starting export:', { existingPO, companyInfo, exportOptions })
                  
                  setIsExporting(true)
                  try {
                    // Use companyInfo if available, otherwise use empty object
                    const companyData = companyInfo || {}
                    await downloadPurchaseOrderPDF(existingPO, companyData, exportOptions, workspaceId)
                    setShowExportModal(false)
                  } catch (error) {
                    console.error('[Export] Export error:', error)
                    alert(`Export failed: ${error instanceof Error ? error.message : 'Unknown error'}. Please check the console for details.`)
                  } finally {
                    setIsExporting(false)
                  }
                }}
                disabled={isExporting || exportOptions.selectedFields.length === 0}
                className="px-6 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isExporting ? 'Exporting...' : 'EXPORT'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Post to Inventory Modal */}
      {showPostToInventoryModal && existingPO && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Post Received Items to Inventory</h3>
              <p className="text-sm text-gray-600 mt-2">
                This will add the received items from this purchase order to your inventory.
              </p>
            </div>
            <div className="p-6 max-h-96 overflow-y-auto">
              <div className="space-y-3">
                {Array.isArray(existingPO.lineItems) && existingPO.lineItems.length > 0 ? (
                  existingPO.lineItems.map((item, index) => {
                    const product = item.productId ? products.find((p) => p.id === item.productId) : null
                    const itemKey = `${item.productId || index}`
                    const isAlreadyPosted = postedItems.has(itemKey)
                    return (
                      <div 
                        key={index} 
                        className={`border rounded-lg p-4 ${
                          isAlreadyPosted 
                            ? 'border-yellow-300 bg-yellow-50' 
                            : 'border-gray-200'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="font-medium text-gray-900">{item.itemDescription}</div>
                            {item.partNumber && (
                              <div className="text-sm text-gray-500">Part #: {item.partNumber}</div>
                            )}
                            <div className="text-sm text-gray-600 mt-1">
                              Quantity: {item.orderQuantity} {item.uom || 'units'}
                            </div>
                            {isAlreadyPosted ? (
                              <div className="text-xs text-yellow-700 font-medium mt-1">
                                ⚠ Already posted to inventory - will be skipped
                              </div>
                            ) : product ? (
                              <div className="text-xs text-green-600 mt-1">
                                ✓ Will update existing product: {product.name}
                              </div>
                            ) : (
                              <div className="text-xs text-yellow-600 mt-1">
                                ⚠ Product not found in inventory - will be skipped
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })
                ) : (
                  <div className="text-center text-gray-500 py-8">No line items to post</div>
                )}
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setShowPostToInventoryModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!existingPO || !workspaceId || !userId) return
                  setIsPosting(true)
                  try {
                    const itemsToPost = Array.isArray(existingPO.lineItems)
                      ? existingPO.lineItems.filter((item) => item.productId)
                      : []

                    if (itemsToPost.length === 0) {
                      alert('No items with product IDs found to post to inventory.')
                      setShowPostToInventoryModal(false)
                      return
                    }

                    // Check which items are already posted
                    const alreadyPostedSet = new Set<string>()
                    for (const item of itemsToPost) {
                      if (item.productId) {
                        // Check if there's already a transaction for this PO and product
                        const txnsCol = collection(db, 'workspaces', workspaceId, 'stockTxns')
                        const q = query(
                          txnsCol,
                          where('productId', '==', item.productId),
                          where('refs.poId', '==', existingPO.id)
                        )
                        const snap = await getDocs(q)
                        if (!snap.empty) {
                          alreadyPostedSet.add(item.productId)
                        }
                      }
                    }

                    // Filter out already posted items
                    const itemsToPostFiltered = itemsToPost.filter(
                      (item) => item.productId && !alreadyPostedSet.has(item.productId)
                    )

                    if (itemsToPostFiltered.length === 0) {
                      alert('All items have already been posted to inventory.')
                      setShowPostToInventoryModal(false)
                      setIsPosting(false)
                      return
                    }

                    // Post each item to inventory
                    for (const item of itemsToPostFiltered) {
                      if (item.productId && item.orderQuantity > 0) {
                        await createStockTransaction({
                          workspaceId,
                          productId: item.productId,
                          type: 'in',
                          qty: item.orderQuantity,
                          userId,
                          reason: `Received from PO ${existingPO.poNumber}`,
                          reference: existingPO.poNumber,
                          unitCost: item.unitRate > 0 ? item.unitRate : null,
                          refs: {
                            poId: existingPO.id,
                            poNumber: existingPO.poNumber,
                          },
                        })
                      }
                    }

                    queryClient.invalidateQueries({ queryKey: ['products', workspaceId] })
                    queryClient.invalidateQueries({ queryKey: ['stockTxns', workspaceId] })
                    alert(`Successfully posted ${itemsToPostFiltered.length} item(s) to inventory.${alreadyPostedSet.size > 0 ? ` ${alreadyPostedSet.size} item(s) were already posted and skipped.` : ''}`)
                    setShowPostToInventoryModal(false)
                  } catch (error) {
                    console.error('Post to inventory error:', error)
                    alert(`Failed to post items to inventory: ${error instanceof Error ? error.message : 'Unknown error'}`)
                  } finally {
                    setIsPosting(false)
                  }
                }}
                disabled={isPosting}
                className="px-6 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPosting ? 'Posting...' : 'POST TO INVENTORY'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QR Code Modal */}
      {showQRModal && existingPO && qrCodeUrl && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Purchase Order QR Code</h3>
              <button
                onClick={() => setShowQRModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
            <div className="p-6">
              <div className="flex flex-col items-center gap-4">
                <div className="bg-white p-4 rounded-lg border-2 border-gray-200">
                  <img src={qrCodeUrl} alt="PO QR Code" className="w-64 h-64" />
                </div>
                <div className="text-center">
                  <p className="text-sm text-gray-600 mb-2">PO Number: <span className="font-semibold">{existingPO.poNumber}</span></p>
                  <p className="text-xs text-gray-500">Scan this QR code to receive items</p>
                </div>
                <div className="flex gap-2 w-full">
                  <button
                    onClick={async () => {
                      try {
                        await downloadQRCode(qrCodeUrl, `PO_${existingPO.poNumber}_QR.png`)
                      } catch (error) {
                        console.error('QR kod indirme hatası:', error)
                        alert('QR kod indirilemedi')
                      }
                    }}
                    className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 flex items-center justify-center gap-2"
                  >
                    <ArrowDownTrayIcon className="h-4 w-4" />
                    Download
                  </button>
                  <button
                    onClick={async () => {
                      try {
                        await copyQRCodeToClipboard(qrCodeUrl)
                        alert('QR kod panoya kopyalandı!')
                      } catch (error) {
                        console.error('QR kod kopyalama hatası:', error)
                        alert('QR kod kopyalanamadı')
                      }
                    }}
                    className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Copy
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Received Status Confirmation Modal */}
      {showReceivedConfirmModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Mark Purchase Order as Received?
              </h3>
              <p className="text-sm text-gray-600 mb-6">
                Are you sure you want to mark this purchase order as "Received"? 
                The "Date Received" will be automatically set to today's date.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowReceivedConfirmModal(false)
                    setPendingStatus(null)
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    const today = new Date()
                    setFormData({
                      ...formData,
                      status: 'Received' as PurchaseOrderStatus,
                      dates: {
                        ...formData.dates,
                        dateReceived: today,
                      },
                    })
                    setShowReceivedConfirmModal(false)
                    setPendingStatus(null)
                  }}
                  className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700"
                >
                  Mark as Received
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Vendor Selection Modal */}
      {showVendorModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Select Vendor</h3>
                <button
                  onClick={() => setShowVendorModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>
            </div>
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {vendors.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p>No vendors found.</p>
                  <p className="text-sm mt-2">Go to Settings → Vendors to add vendors.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {vendors.map((vendor) => (
                    <button
                      key={vendor.id}
                      onClick={() => {
                        setFormData({
                          ...formData,
                          vendor: {
                            id: vendor.id,
                            name: vendor.name,
                            address1: vendor.address1,
                            address2: vendor.address2,
                            city: vendor.city,
                            state: vendor.state,
                            zipCode: vendor.zipCode,
                            country: vendor.country,
                            email: vendor.email,
                            phoneNumber: vendor.phoneNumber,
                          },
                        })
                        setShowVendorModal(false)
                      }}
                      className="w-full text-left p-4 border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors"
                    >
                      <div className="font-medium text-gray-900">{vendor.name}</div>
                      {vendor.address1 && (
                        <div className="text-sm text-gray-600 mt-1">{vendor.address1}</div>
                      )}
                      {vendor.city && vendor.country && (
                        <div className="text-sm text-gray-500 mt-1">
                          {vendor.city}, {vendor.country}
                        </div>
                      )}
                      {vendor.email && (
                        <div className="text-sm text-gray-500 mt-1">Email: {vendor.email}</div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Ship To Address Selection Modal */}
      {showShipToModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Select Ship To Address</h3>
                <button
                  onClick={() => setShowShipToModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>
            </div>
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {addresses.filter(a => a.type === 'ship' || a.type === 'both').length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p>No shipping addresses found.</p>
                  <p className="text-sm mt-2">Go to Settings → Company Information to add addresses.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {addresses
                    .filter((a) => a.type === 'ship' || a.type === 'both')
                    .map((address) => (
                      <button
                        key={address.id}
                        onClick={() => {
                          setFormData({
                            ...formData,
                            shipTo: {
                              name: address.name,
                              address1: address.address1,
                              address2: address.address2,
                              city: address.city,
                              state: address.state,
                              zipCode: address.zipCode,
                              country: address.country,
                            },
                          })
                          setShowShipToModal(false)
                        }}
                        className="w-full text-left p-4 border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors"
                      >
                        <div className="font-medium text-gray-900">{address.name}</div>
                        <div className="text-sm text-gray-600 mt-1">{address.address1}</div>
                        {address.address2 && (
                          <div className="text-sm text-gray-600">{address.address2}</div>
                        )}
                        <div className="text-sm text-gray-500 mt-1">
                          {address.city}, {address.state} {address.zipCode}
                        </div>
                        <div className="text-sm text-gray-500">{address.country}</div>
                      </button>
                    ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Bill To Address Selection Modal */}
      {showBillToModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Select Bill To Address</h3>
                <button
                  onClick={() => setShowBillToModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>
            </div>
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {addresses.filter(a => a.type === 'bill' || a.type === 'both').length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p>No billing addresses found.</p>
                  <p className="text-sm mt-2">Go to Settings → Company Information to add addresses.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {addresses
                    .filter((a) => a.type === 'bill' || a.type === 'both')
                    .map((address) => (
                      <button
                        key={address.id}
                        onClick={() => {
                          setFormData({
                            ...formData,
                            billTo: {
                              name: address.name,
                              address1: address.address1,
                              address2: address.address2,
                              city: address.city,
                              state: address.state,
                              zipCode: address.zipCode,
                              country: address.country,
                            },
                          })
                          setShowBillToModal(false)
                        }}
                        className="w-full text-left p-4 border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors"
                      >
                        <div className="font-medium text-gray-900">{address.name}</div>
                        <div className="text-sm text-gray-600 mt-1">{address.address1}</div>
                        {address.address2 && (
                          <div className="text-sm text-gray-600">{address.address2}</div>
                        )}
                        <div className="text-sm text-gray-500 mt-1">
                          {address.city}, {address.state} {address.zipCode}
                        </div>
                        <div className="text-sm text-gray-500">{address.country}</div>
                      </button>
                    ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
