import { useState, useEffect } from 'react'
import { 
  XMarkIcon, 
  PlusIcon,
  MinusIcon,
  ArrowPathIcon,
  DocumentTextIcon,
  ClockIcon,
  UserIcon,
  ChartBarIcon,
  ExclamationTriangleIcon,
  QrCodeIcon
} from '@heroicons/react/24/outline'
import { listStockReasons, type StockReason } from '../api/settings'

interface StockAdjustment {
  id: string
  type: 'in' | 'out' | 'transfer' | 'adjustment'
  quantity: number
  previousQuantity: number
  newQuantity: number
  reason: string
  notes?: string
  createdAt: string
  createdBy: string
  reference?: string
  refs?: any
}

interface Product {
  id: string
  name: string
  sku: string
  quantityBox: number
  minLevelBox: number
  pricePerBox: number
  totalValue: number
  uom: string
  status: string
  lastUpdated?: string
  // Additional fields from ProductForm
  groupId?: string
  pcsPerBox?: number
  minStock?: number
  reorderPoint?: number
  category?: string
  subcategory?: string
  materialSeries?: string
  boardType?: string
  gsm?: string
  dimensionsWxLmm?: string
  cal?: string
  tags?: string[]
  notes?: string
  imageUrl?: string
  galleryUrls?: string[]
  qrUrl?: string
  barcodeUrl?: string
}

interface Props {
  product: Product
  onClose: () => void
  onSaved?: () => void
}

import { useSessionStore } from '../state/sessionStore'
import { createStockTransaction, listProductStockTxns, type UiTxnType, getProductOnHand } from '../api/inventory'
import { listGroups, type Group, updateProduct, saveProductQr, deleteProductQr } from '../api/products'
import { listUOMs, listCategories, listSubcategories, listCustomFields } from '../api/settings'
import { generateQRCodeDataURL, downloadQRCode, type QRCodeResult } from '../utils/qrcode'

// Stock Trend Chart Component
function StockTrendChart({ history }: { history: StockAdjustment[] }) {
  const chartWidth = 800
  const chartHeight = 300
  const padding = 40
  
  // Get last 30 days of data
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  
  const recentHistory = history
    .filter(h => new Date(h.createdAt) >= thirtyDaysAgo)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
  
  if (recentHistory.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        <div className="text-center">
          <svg className="w-12 h-12 mx-auto mb-2 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <p>No stock movements in the last 30 days</p>
        </div>
      </div>
    )
  }
  
  // Calculate running balance for chart
  let runningBalance = 0
  const chartData = recentHistory.map(h => {
    runningBalance += h.type === 'in' || h.type === 'transfer' ? h.quantity : -h.quantity
    return {
      date: new Date(h.createdAt),
      balance: runningBalance,
      type: h.type
    }
  })
  
  // Find min/max for scaling
  const balances = chartData.map(d => d.balance)
  const minBalance = Math.min(0, ...balances)
  const maxBalance = Math.max(0, ...balances)
  const range = maxBalance - minBalance || 1
  
  // Convert to SVG coordinates
  const points = chartData.map((d, i) => {
    const x = padding + (i / (chartData.length - 1)) * (chartWidth - 2 * padding)
    const y = padding + ((maxBalance - d.balance) / range) * (chartHeight - 2 * padding)
    return { x, y, ...d }
  })
  
  // Create path for line
  const pathData = points.map((p, i) => 
    `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`
  ).join(' ')
  
  return (
    <div className="w-full">
      <svg width="100%" height={chartHeight} viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="overflow-visible">
        {/* Grid lines */}
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#f3f4f6" strokeWidth="1"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
        
        {/* Zero line */}
        <line
          x1={padding}
          y1={padding + ((maxBalance - 0) / range) * (chartHeight - 2 * padding)}
          x2={chartWidth - padding}
          y2={padding + ((maxBalance - 0) / range) * (chartHeight - 2 * padding)}
          stroke="#d1d5db"
          strokeWidth="2"
          strokeDasharray="5,5"
        />
        
        {/* Chart line */}
        <path
          d={pathData}
          fill="none"
          stroke="#3b82f6"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        
        {/* Data points */}
        {points.map((point, i) => (
          <circle
            key={i}
            cx={point.x}
            cy={point.y}
            r="4"
            fill={point.type === 'in' || point.type === 'transfer' ? '#10b981' : '#ef4444'}
            stroke="white"
            strokeWidth="2"
          />
        ))}
        
        {/* Y-axis labels */}
        <text x="10" y={padding + 5} textAnchor="middle" className="text-xs fill-gray-600">
          {maxBalance}
        </text>
        <text x="10" y={chartHeight - padding + 5} textAnchor="middle" className="text-xs fill-gray-600">
          {minBalance}
        </text>
        <text x="10" y={padding + ((maxBalance - 0) / range) * (chartHeight - 2 * padding) + 5} textAnchor="middle" className="text-xs fill-gray-600">
          0
        </text>
        
        {/* X-axis labels */}
        {points.filter((_, i) => i % Math.ceil(points.length / 5) === 0).map((point, i) => (
          <text
            key={i}
            x={point.x}
            y={chartHeight - 10}
            textAnchor="middle"
            className="text-xs fill-gray-600"
          >
            {point.date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' })}
          </text>
        ))}
      </svg>
      
      {/* Legend */}
      <div className="flex justify-center gap-6 mt-4">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-green-500 rounded-full"></div>
          <span className="text-sm text-gray-600">Stock In</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-red-500 rounded-full"></div>
          <span className="text-sm text-gray-600">Stock Out</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
          <span className="text-sm text-gray-600">Stock Level</span>
        </div>
      </div>
    </div>
  )
}


export function ProductDetails({ product, onClose, onSaved }: Props) {
  const [activeTab, setActiveTab] = useState<'details' | 'adjust' | 'qr' | 'history' | 'analytics'>('adjust')
  const [adjustmentType, setAdjustmentType] = useState<'in' | 'out' | 'transfer' | 'adjustment'>('in')
  const [quantity, setQuantity] = useState('')
  const [reason, setReason] = useState('')
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [history, setHistory] = useState<StockAdjustment[]>([])
  const [onHand, setOnHand] = useState<number>((product as any).qtyOnHand || 0)
  const [groups, setGroups] = useState<Group[]>([])
  const [uoms, setUoms] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [subcategories, setSubcategories] = useState<any[]>([])
  const [customFields, setCustomFields] = useState<any[]>([])
  const [stockReasons, setStockReasons] = useState<StockReason[]>([])
  const [transferTo, setTransferTo] = useState<string>('')
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [qrRemoteUrl, setQrRemoteUrl] = useState<string | null>((product as any).qrUrl || (product as any).barcodeUrl || null)
  const [qrBusy, setQrBusy] = useState(false)
  const [qrError, setQrError] = useState<string | null>(null)
  const [qrInfo, setQrInfo] = useState<QRCodeResult | null>(null)
  const { workspaceId, userId } = useSessionStore()
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>((product as any).imageUrl || null)
  const [showImageModal, setShowImageModal] = useState(false)
  const [modalImageUrl, setModalImageUrl] = useState<string | null>(null)
  const allImages: string[] = [
    ...( (product as any).imageUrl ? [(product as any).imageUrl as string] : []),
    ...((Array.isArray((product as any).galleryUrls) ? (product as any).galleryUrls : []) as string[])
  ]

  // Load history and current on-hand from Firestore
  const loadHistoryAndStock = async () => {
      if (!workspaceId) return
    try {
      console.log('Loading history for product:', product.id)
      const txns = await listProductStockTxns(workspaceId, product.id, 50)
      const oh = await getProductOnHand(workspaceId, product.id)
      console.log('Loaded transactions:', txns.length, 'On-hand:', oh)

      // Calculate running balance for each transaction
      // Start with current on-hand quantity and work backwards
      let runningBalance = Number(oh)
      const mapped: StockAdjustment[] = txns.map((t) => {
        const qty = Number(t.qty || 0)
        const newQuantity = runningBalance
        // Reverse the transaction to get previous quantity
        runningBalance -= qty
        const previousQuantity = runningBalance
        
        return {
        id: t.id,
        type: (t.type === 'Receive' || t.type === 'Produce' ? 'in' : t.type === 'Transfer' ? 'transfer' : 'out') as 'in' | 'out' | 'transfer' | 'adjustment',
          quantity: Math.abs(qty),
          previousQuantity,
          newQuantity,
        reason: t.reason || '',
        notes: '',
        createdAt: (t as any).timestamp?.toDate?.()?.toISOString?.() || new Date().toISOString(),
        createdBy: t.userId || 'system',
        reference: (t.refs && (t.refs.ref || t.refs.taskId || t.refs.poId)) || '',
        refs: (t as any).refs || undefined,
        }
      }).reverse() // Reverse to show chronological order (oldest first)
      setHistory(mapped)
      // Use the calculated on-hand quantity directly
      setOnHand(Number(oh))
    } catch (error) {
      console.error('Error loading history:', error)
    }
  }

  useEffect(() => {
    loadHistoryAndStock()
  }, [workspaceId, product.id])

  // Load existing QR code on component mount
  useEffect(() => {
    if ((product as any).qrUrl || (product as any).barcodeUrl) {
      const qrUrl = (product as any).qrUrl || (product as any).barcodeUrl
      setQrRemoteUrl(qrUrl)
    }
  }, [product])

  // Load groups for transfer destination selection
  useEffect(() => {
    let ignore = false
    async function loadGroups() {
      if (!workspaceId) return
      const g = await listGroups(workspaceId)
      if (ignore) return
      setGroups(g)
    }
    async function loadSettingsData() {
      if (!workspaceId) return
      try {
        const [uomsData, categoriesData, subcategoriesData, customFieldsData, stockReasonsData] = await Promise.all([
          listUOMs(workspaceId),
          listCategories(workspaceId),
          listSubcategories(workspaceId),
          listCustomFields(workspaceId),
          listStockReasons(workspaceId)
        ])
        if (ignore) return
        setUoms(uomsData)
        setCategories(categoriesData)
        setSubcategories(subcategoriesData)
        setCustomFields(customFieldsData.filter(f => f.active && (!f.groupId || f.groupId === product.groupId)))
        setStockReasons(stockReasonsData.filter(r => r.active))
      } catch (error) {
        console.error('Error loading settings data:', error)
      }
    }
    loadGroups()
    loadSettingsData()
    return () => { ignore = true }
  }, [workspaceId])

  const analytics = {
    monthlyMovements: history.filter(h => new Date(h.createdAt) > new Date(Date.now() - 30*24*60*60*1000)).length,
    stockTurnover: Number((history.filter(h => h.type === 'out').length / 4).toFixed(1)),
    averageStock: onHand,
    stockOutEvents: history.filter(h => h.type === 'out').length,
    reorderSuggestions: onHand <= product.minLevelBox ? 1 : 0
  }

  // QR Code functions
  const handleGenerateQR = async () => {
    if (qrBusy) return
    
    setQrBusy(true)
    setQrError(null)
    
    try {
      const qrText = product.sku || product.id
      const result = await generateQRCodeDataURL(qrText)
      setQrDataUrl(result.dataUrl)
      setQrInfo(result)
    } catch (error) {
      console.error('QR generation error:', error)
      setQrError(error instanceof Error ? error.message : 'QR kod oluşturulamadı')
    } finally {
      setQrBusy(false)
    }
  }

  const handleDownloadQR = () => {
    if (!qrDataUrl) {
      setQrError('Önce QR kod oluşturun')
      return
    }
    
    try {
      // Clean SKU for filename (remove special characters)
      const cleanSku = (product.sku || product.id).replace(/[^a-zA-Z0-9-_]/g, '_')
      const filename = `${cleanSku}_QR_Code.png`
      downloadQRCode(qrDataUrl, filename)
      setQrError(null) // Clear any previous errors
    } catch (error) {
      console.error('QR download error:', error)
      setQrError(error instanceof Error ? error.message : 'QR kod indirilemedi')
    }
  }


  const handleSaveQR = async () => {
    if (!qrDataUrl || !workspaceId) return
    
    setQrBusy(true)
    setQrError(null)
    
    try {
      const url = await saveProductQr(workspaceId, product.id, qrDataUrl)
      setQrRemoteUrl(url)
      
      // Update product's QR URL fields in Firestore
      await updateProduct(workspaceId, product.id, { qrUrl: url, barcodeUrl: url })
      
      onSaved?.()
    } catch (error) {
      console.error('QR save error:', error)
      setQrError(error instanceof Error ? error.message : 'QR kod kaydedilemedi')
    } finally {
      setQrBusy(false)
    }
  }

  const handleDeleteQR = async () => {
    if (!workspaceId || !qrRemoteUrl) return
    
    setQrBusy(true)
    setQrError(null)
    
    try {
      await deleteProductQr(workspaceId, product.id)
      setQrRemoteUrl(null)
      setQrDataUrl(null)
      setQrInfo(null)
      
      // Update product's QR URL fields in Firestore to null
      await updateProduct(workspaceId, product.id, { qrUrl: null, barcodeUrl: null })
      
      onSaved?.()
    } catch (error) {
      console.error('QR delete error:', error)
      setQrError(error instanceof Error ? error.message : 'QR kod silinemedi')
    } finally {
      setQrBusy(false)
    }
  }

  const handleImageClick = (imageUrl: string) => {
    setModalImageUrl(imageUrl)
    setShowImageModal(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!quantity || !reason) return

    setIsSubmitting(true)
    try {
      if (!workspaceId) throw new Error('No workspace selected')
      const qtyNum = Number(quantity)
      await createStockTransaction({
        workspaceId,
        productId: product.id,
        type: adjustmentType as UiTxnType,
        qty: qtyNum,
        userId,
        reason,
        reference: '',
        fromLoc: adjustmentType === 'transfer' ? (product as any).groupId || null : null,
        toLoc: adjustmentType === 'transfer' ? transferTo || null : null,
        unitCost: (product as any).pricePerBox || null,
      })
      // Optimistic on-hand update
      setOnHand((prev) => {
        const base = Number(prev || 0)
        return adjustmentType === 'in' ? base + qtyNum : base - qtyNum
      })
      // reload recent history and stock
      await loadHistoryAndStock()
      onSaved?.()
      setQuantity('')
      setReason('')
    } catch (err) {
      console.error('createStockTransaction failed', err)
    } finally {
      setIsSubmitting(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800'
      case 'inactive': return 'bg-gray-100 text-gray-800'
      case 'low': return 'bg-amber-100 text-amber-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getAdjustmentIcon = (type: string) => {
    switch (type) {
      case 'in': return <PlusIcon className="h-4 w-4 text-green-600" />
      case 'out': return <MinusIcon className="h-4 w-4 text-red-600" />
      case 'transfer': return <ArrowPathIcon className="h-4 w-4 text-blue-600" />
      default: return <DocumentTextIcon className="h-4 w-4 text-gray-600" />
    }
  }

  const getAdjustmentColor = (type: string) => {
    switch (type) {
      case 'in': return 'text-green-600 bg-green-50 border-green-200'
      case 'out': return 'text-red-600 bg-red-50 border-red-200'
      case 'transfer': return 'text-blue-600 bg-blue-50 border-blue-200'
      default: return 'text-gray-600 bg-gray-50 border-gray-200'
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-start justify-center p-2 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl my-4 max-h-[95vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 bg-white">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <h3 className="text-xl font-bold text-gray-900 truncate">Stock Management</h3>
              <div className="flex items-center gap-3 mt-1">
                <p className="text-sm text-gray-600">{product.name}</p>
                <span className="text-sm text-gray-400">•</span>
                <p className="text-sm text-gray-600">SKU: {product.sku}</p>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(product.status)}`}>
                  {product.status}
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <XMarkIcon className="h-5 w-5 text-gray-500" />
            </button>
          </div>
        </div>

        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Tabs */}
          <div className="border-b border-gray-200 bg-white">
            <nav className="flex -mb-px">
              <button
                onClick={() => setActiveTab('details')}
                className={`flex-1 py-4 px-6 text-center font-medium text-sm border-b-2 transition-colors ${
                  activeTab === 'details'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Details
              </button>
              <button
                onClick={() => setActiveTab('adjust')}
                className={`flex-1 py-4 px-6 text-center font-medium text-sm border-b-2 transition-colors ${
                  activeTab === 'adjust'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <PlusIcon className="h-4 w-4 inline mr-2" />
                Adjust Stock
              </button>
              <button
                onClick={() => setActiveTab('qr')}
                className={`flex-1 py-4 px-6 text-center font-medium text-sm border-b-2 transition-colors ${
                  activeTab === 'qr'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <QrCodeIcon className="h-4 w-4 inline mr-2" />
                QR Code
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`flex-1 py-4 px-6 text-center font-medium text-sm border-b-2 transition-colors ${
                  activeTab === 'history'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <ClockIcon className="h-4 w-4 inline mr-2" />
                History
              </button>
              <button
                onClick={() => setActiveTab('analytics')}
                className={`flex-1 py-4 px-6 text-center font-medium text-sm border-b-2 transition-colors ${
                  activeTab === 'analytics'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <ChartBarIcon className="h-4 w-4 inline mr-2" />
                Analytics
              </button>
            </nav>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {activeTab === 'details' && (
              <div className="p-6 space-y-6">
                  {/* Image Slider */}
                  {allImages.length > 0 && (
                    <div className="bg-white rounded-lg border border-gray-200 p-6">
                      <h4 className="text-lg font-semibold text-gray-900 mb-4">Product Images</h4>
                      <div className="flex items-center justify-center mb-4">
                        <img
                          src={selectedImageUrl || allImages[0]}
                          alt={product.name}
                          className="max-h-80 object-contain cursor-pointer"
                          onClick={() => handleImageClick(selectedImageUrl || allImages[0])}
                        />
                    </div>
                  {allImages.length > 1 && (
                        <div className="flex gap-2 overflow-x-auto">
                          {allImages.map((url, index) => (
                            <button
                              key={index}
                              onClick={() => setSelectedImageUrl(url)}
                              className={`flex-shrink-0 border-2 rounded-lg overflow-hidden ${
                                url === (selectedImageUrl || allImages[0])
                                  ? 'border-blue-500 ring-2 ring-blue-200'
                                  : 'border-gray-200 hover:border-gray-300'
                              }`}
                            >
                              <img src={url} alt={`gallery-${index}`} className="h-20 w-24 object-cover" />
                        </button>
                      ))}
                    </div>
                  )}
                    </div>
                  )}
                  {/* Basic Information Section */}
                  <section className="bg-white rounded-lg border border-gray-200 p-6">
                    <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                      <svg className="w-5 h-5 text-blue-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Basic Information
                    </h4>
                    <form
                      onSubmit={async (e) => {
                        e.preventDefault()
                        if (!workspaceId) return
                        const formData = new FormData(e.currentTarget as HTMLFormElement)
                        const payload: any = {
                          name: formData.get('name') as string,
                          sku: formData.get('sku') as string,
                          uom: formData.get('uom') as string,
                          status: (formData.get('status') as string) as any,
                          groupId: formData.get('groupId') as string || null,
                        }
                        try {
                          console.log('Updating product with payload:', payload)
                          await updateProduct(workspaceId, product.id, payload)
                          console.log('Product updated successfully')
                          onSaved?.()
                        } catch (err) {
                          console.error('updateProduct failed', err)
                          alert('Ürün güncellenirken hata oluştu: ' + (err instanceof Error ? err.message : 'Bilinmeyen hata'))
                        }
                      }}
                    >
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Product Name *</label>
                          <input name="name" defaultValue={product.name} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" required />
                    </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">SKU *</label>
                          <input name="sku" defaultValue={product.sku} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" required />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Group</label>
                          <select name="groupId" defaultValue={product.groupId || ''} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                            <option value="">Select group</option>
                            {groups.map((g) => (
                              <option key={g.id} value={g.id}>{g.name}</option>
                            ))}
                          </select>
                    </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                          <select name="status" defaultValue={product.status} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                            <option value="active">Active</option>
                            <option value="inactive">Inactive</option>
                            <option value="draft">Draft</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Unit of Measure</label>
                          <select name="uom" defaultValue={product.uom} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                            <option value="">Select UOM</option>
                            {uoms.map((uom) => (
                              <option key={uom.id} value={uom.symbol}>
                                {uom.symbol} - {uom.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div className="flex justify-end mt-4">
                        <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Save Changes</button>
                      </div>
                    </form>
                  </section>

                  {/* Inventory & Pricing Section */}
                  <section className="bg-white rounded-lg border border-gray-200 p-6">
                    <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                      <svg className="w-5 h-5 text-green-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Stock and Pricing Information
                    </h4>
                    <form
                      onSubmit={async (e) => {
                        e.preventDefault()
                        if (!workspaceId) return
                        const formData = new FormData(e.currentTarget as HTMLFormElement)
                        const payload: any = {
                          pricePerBox: Number(formData.get('pricePerBox') || 0),
                          quantityBox: Number(formData.get('quantityBox') || 0),
                          pcsPerBox: Number(formData.get('pcsPerBox') || 0),
                          minStock: Number(formData.get('minStock') || 0),
                          reorderPoint: Number(formData.get('reorderPoint') || 0),
                          minLevelBox: Number(formData.get('minLevelBox') || 0),
                        }
                        try {
                          console.log('Updating stock/pricing with payload:', payload)
                          await updateProduct(workspaceId, product.id, payload)
                          console.log('Stock/pricing updated successfully')
                            onSaved?.()
                        } catch (err) {
                          console.error('updateProduct failed', err)
                          alert('Stok/fiyat bilgileri güncellenirken hata oluştu: ' + (err instanceof Error ? err.message : 'Bilinmeyen hata'))
                        }
                      }}
                    >
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Price Per Box (£)</label>
                          <input name="pricePerBox" type="number" step="0.01" defaultValue={product.pricePerBox || 0} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" min={0} />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Box Quantity</label>
                          <input name="quantityBox" type="number" defaultValue={product.quantityBox || 0} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" min={0} />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Pieces Per Box</label>
                          <input name="pcsPerBox" type="number" defaultValue={product.pcsPerBox || 0} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" min={0} />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Minimum Stock</label>
                          <input name="minStock" type="number" defaultValue={product.minStock || 0} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" min={0} />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Reorder Point</label>
                          <input name="reorderPoint" type="number" defaultValue={product.reorderPoint || 0} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" min={0} />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Minimum Box Level</label>
                          <input name="minLevelBox" type="number" defaultValue={product.minLevelBox || 0} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" min={0} />
                        </div>
                      </div>
                      <div className="flex justify-end mt-4">
                        <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Save Changes</button>
                      </div>
                    </form>
                  </section>

                  {/* Classification Section */}
                  <section className="bg-white rounded-lg border border-gray-200 p-6">
                    <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                      <svg className="w-5 h-5 text-purple-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                      </svg>
                      Classification
                    </h4>
                    <form
                      onSubmit={async (e) => {
                        e.preventDefault()
                        if (!workspaceId) return
                        const formData = new FormData(e.currentTarget as HTMLFormElement)
                        const payload: any = {
                          category: formData.get('category') as string,
                          subcategory: formData.get('subcategory') as string,
                        }
                        try {
                          console.log('Updating classification with payload:', payload)
                          await updateProduct(workspaceId, product.id, payload)
                          console.log('Classification updated successfully')
                            onSaved?.()
                        } catch (err) {
                          console.error('updateProduct failed', err)
                          alert('Sınıflandırma güncellenirken hata oluştu: ' + (err instanceof Error ? err.message : 'Bilinmeyen hata'))
                        }
                      }}
                    >
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                          <select name="category" defaultValue={product.category || ''} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                            <option value="">Select Category</option>
                            {categories.map((category) => (
                              <option key={category.id} value={category.name}>
                                {category.name}
                              </option>
                            ))}
                          </select>
                    </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Subcategory</label>
                          <select name="subcategory" defaultValue={product.subcategory || ''} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                            <option value="">Select Subcategory</option>
                            {subcategories.map((subcategory) => (
                              <option key={subcategory.id} value={subcategory.name}>
                                {subcategory.name}
                              </option>
                            ))}
                          </select>
                      </div>
                  </div>
                      <div className="flex justify-end mt-4">
                        <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Save Changes</button>
                </div>
                    </form>
                  </section>

                  {/* Technical Specifications */}
                  <section className="bg-white rounded-lg border border-gray-200 p-6">
                    <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                      <svg className="w-5 h-5 text-orange-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      Technical Specifications
                    </h4>
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault()
                      if (!workspaceId) return
                      const formData = new FormData(e.currentTarget as HTMLFormElement)
                      const payload: any = {
                          materialSeries: formData.get('materialSeries') as string,
                          boardType: formData.get('boardType') as string,
                          gsm: formData.get('gsm') as string,
                          dimensionsWxLmm: formData.get('dimensionsWxLmm') as string,
                          cal: formData.get('cal') as string,
                      }
                      try {
                          console.log('Updating technical specs with payload:', payload)
                        await updateProduct(workspaceId, product.id, payload)
                          console.log('Technical specs updated successfully')
                        onSaved?.()
                      } catch (err) {
                        console.error('updateProduct failed', err)
                          alert('Teknik özellikler güncellenirken hata oluştu: ' + (err instanceof Error ? err.message : 'Bilinmeyen hata'))
                      }
                    }}
                  >
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Material/Series</label>
                          <input name="materialSeries" defaultValue={product.materialSeries || ''} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                      </div>
                      <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Board Type</label>
                          <input name="boardType" defaultValue={product.boardType || ''} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                      </div>
                      <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">GSM</label>
                          <input name="gsm" defaultValue={product.gsm || ''} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                      </div>
                      <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Dimensions (WxL mm)</label>
                          <input name="dimensionsWxLmm" defaultValue={product.dimensionsWxLmm || ''} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="200x300" />
                      </div>
                      <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">CAL</label>
                          <input name="cal" defaultValue={product.cal || ''} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                      </div>
                      </div>
                      <div className="flex justify-end mt-4">
                        <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Save Changes</button>
                      </div>
                    </form>
                  </section>

                  {/* Tags & Notes */}
                  <section className="bg-white rounded-lg border border-gray-200 p-6">
                    <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                      <svg className="w-5 h-5 text-indigo-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                      </svg>
                      Tags and Notes
                    </h4>
                    <form
                      onSubmit={async (e) => {
                        e.preventDefault()
                        if (!workspaceId) return
                        const formData = new FormData(e.currentTarget as HTMLFormElement)
                        const payload: any = {
                          tags: (formData.get('tags') as string).split(',').map(s => s.trim()).filter(Boolean),
                          notes: formData.get('notes') as string,
                        }
                        try {
                          console.log('Updating tags/notes with payload:', payload)
                          await updateProduct(workspaceId, product.id, payload)
                          console.log('Tags/notes updated successfully')
                          onSaved?.()
                        } catch (err) {
                          console.error('updateProduct failed', err)
                          alert('Etiketler/notlar güncellenirken hata oluştu: ' + (err instanceof Error ? err.message : 'Bilinmeyen hata'))
                        }
                      }}
                    >
                      <div className="space-y-4">
                      <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Tags (comma separated)</label>
                          <input name="tags" defaultValue={(product.tags || []).join(', ')} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="tag1, tag2, tag3" />
                      </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
                          <textarea name="notes" defaultValue={product.notes || ''} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" rows={4} placeholder="Product notes..." />
                    </div>
                      </div>
                      <div className="flex justify-end mt-4">
                        <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Save Changes</button>
                    </div>
                  </form>
                  </section>

                  {/* Custom Fields Section */}
                  {customFields.length > 0 && (
                    <section className="bg-white rounded-lg border border-gray-200 p-6">
                      <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                        <svg className="w-5 h-5 text-indigo-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Custom Fields
                      </h4>
                      <form
                        onSubmit={async (e) => {
                          e.preventDefault()
                          if (!workspaceId) return
                          const formData = new FormData(e.currentTarget as HTMLFormElement)
                          const payload: any = {}
                          customFields.forEach(field => {
                            const value = formData.get(`custom_${field.id}`)
                            if (value) {
                              payload[`custom_${field.id}`] = value
                            }
                          })
                          try {
                            console.log('Updating custom fields with payload:', payload)
                            await updateProduct(workspaceId, product.id, payload)
                            console.log('Custom fields updated successfully')
                            onSaved?.()
                          } catch (err) {
                            console.error('updateProduct failed', err)
                            alert('Custom fields güncellenirken hata oluştu: ' + (err instanceof Error ? err.message : 'Bilinmeyen hata'))
                          }
                        }}
                      >
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {customFields.map((field) => (
                            <div key={field.id}>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                {field.name} {field.required && '*'}
                              </label>
                              {field.type === 'text' && (
                                <input
                                  name={`custom_${field.id}`}
                                  defaultValue={(product as any)[`custom_${field.id}`] || ''}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                  required={field.required}
                                />
                              )}
                              {field.type === 'number' && (
                                <input
                                  type="number"
                                  name={`custom_${field.id}`}
                                  defaultValue={(product as any)[`custom_${field.id}`] || ''}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                  required={field.required}
                                />
                              )}
                              {field.type === 'date' && (
                                <input
                                  type="date"
                                  name={`custom_${field.id}`}
                                  defaultValue={(product as any)[`custom_${field.id}`] || ''}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                  required={field.required}
                                />
                              )}
                              {field.type === 'boolean' && (
                                <div className="flex items-center">
                                  <input
                                    type="checkbox"
                                    name={`custom_${field.id}`}
                                    defaultChecked={(product as any)[`custom_${field.id}`] || false}
                                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                  />
                                  <label className="ml-2 text-sm text-gray-700">Yes</label>
                                </div>
                              )}
                              {field.type === 'select' && (
                                <select
                                  name={`custom_${field.id}`}
                                  defaultValue={(product as any)[`custom_${field.id}`] || ''}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                  required={field.required}
                                >
                                  <option value="">Select {field.name}</option>
                                  {field.options?.map((option: string, index: number) => (
                                    <option key={index} value={option}>
                                      {option}
                                    </option>
                                  ))}
                        </select>
                              )}
                      </div>
                          ))}
                    </div>
                        <div className="flex justify-end mt-4">
                          <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Save Changes</button>
                    </div>
                  </form>
                    </section>
                  )}

                  {/* Media Section */}
                  <section className="bg-white rounded-lg border border-gray-200 p-6">
                    <h4 className="text-lg font-semibold text-gray-900 mb-4">Media</h4>
                    {allImages.length > 0 && (
                      <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 flex items-center justify-center mb-4">
                        <img 
                          src={selectedImageUrl || allImages[0]} 
                          alt={product.name} 
                          className="max-h-56 object-contain cursor-pointer hover:opacity-80 transition-opacity" 
                          onClick={() => handleImageClick(selectedImageUrl || allImages[0])}
                        />
                      </div>
                    )}
                    {allImages.length > 1 && (
                      <div className="grid grid-cols-4 gap-2 mb-4">
                        {allImages.map((u, i) => (
                          <button 
                            key={i} 
                            className={`border rounded ${u === (selectedImageUrl || allImages[0]) ? 'ring-2 ring-blue-500' : ''}`} 
                            onClick={() => setSelectedImageUrl(u)}
                          >
                            <img 
                              src={u} 
                              alt={`thumb-${i}`} 
                              className="h-16 w-full object-cover rounded cursor-pointer hover:opacity-80 transition-opacity" 
                              onClick={(e) => {
                                e.stopPropagation()
                                handleImageClick(u)
                              }}
                            />
                          </button>
                        ))}
                      </div>
                    )}
                    {/* QR Code Section */}
                    <div className="bg-white rounded-lg border border-gray-200 p-6">
                      <div className="flex items-center justify-between mb-4">
                        <h5 className="text-lg font-semibold text-gray-900">QR Code</h5>
                        <div className="text-sm text-gray-500">
                          {qrInfo ? `${qrInfo.size}x${qrInfo.size}px` : ''}
                        </div>
                      </div>
                      
                      {/* Error Message */}
                      {qrError && (
                        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                          <div className="flex items-center">
                            <svg className="w-4 h-4 text-red-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span className="text-sm text-red-700">{qrError}</span>
                          </div>
                        </div>
                      )}

                      {/* QR Code Display */}
                      {(qrDataUrl || qrRemoteUrl) && (
                        <div className="mb-4 flex justify-center">
                          <div className="bg-white p-4 rounded-lg border-2 border-gray-200 shadow-sm">
                            <img 
                              src={qrDataUrl || qrRemoteUrl || ''} 
                              alt="QR Code" 
                              className="w-48 h-48 object-contain"
                            />
                          </div>
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="space-y-3">
                        {/* Primary Actions */}
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={handleGenerateQR}
                            disabled={qrBusy}
                            className="flex-1 min-w-[120px] px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium flex items-center justify-center"
                          >
                            {qrBusy ? (
                              <>
                                <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                                </svg>
                                Generating...
                              </>
                            ) : (
                              <>
                                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                                Generate QR
                              </>
                            )}
                          </button>
                          
                          <button
                            onClick={handleSaveQR}
                            disabled={!qrDataUrl || qrBusy || !workspaceId}
                            className="flex-1 min-w-[120px] px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium flex items-center justify-center"
                          >
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3-3m0 0l-3 3m3-3v12" />
                            </svg>
                            Save
                          </button>
                        </div>

                        {/* Secondary Actions */}
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={handleDownloadQR}
                            disabled={!qrDataUrl || qrBusy}
                            className="flex-1 min-w-[100px] px-3 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium flex items-center justify-center"
                            title={!qrDataUrl ? 'Önce QR kod oluşturun' : 'QR kodu indir'}
                          >
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            {!qrDataUrl ? 'Generate First' : 'Download'}
                          </button>
                          
                          <button
                            onClick={handleDeleteQR}
                            disabled={!qrRemoteUrl || qrBusy || !workspaceId}
                            className="flex-1 min-w-[100px] px-3 py-2 border border-red-300 text-red-700 rounded-lg hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium flex items-center justify-center"
                          >
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            Delete
                          </button>
                        </div>
                      </div>

                      {/* QR Info */}
                      {qrInfo && (
                        <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                          <div className="text-sm text-gray-600">
                            <div className="flex justify-between">
                              <span>Metin:</span>
                              <span className="font-mono">{qrInfo.text}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Boyut:</span>
                              <span>{qrInfo.size}x{qrInfo.size}px</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </section>
                </div>
            )}
            {activeTab === 'adjust' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 min-h-full">
                {/* Left: Current Stock Info */}
                <div className="lg:col-span-1 p-4 border-r border-gray-200 bg-gray-50">
                  <h4 className="text-lg font-semibold text-gray-900 mb-3">Current Stock</h4>
                  
                  <div className="space-y-3">
                    {allImages.length > 0 && (
                      <div className="bg-white rounded-lg border border-gray-200 p-2 flex items-center justify-center">
                        <img
                          src={selectedImageUrl || allImages[0]}
                          alt={product.name}
                          className="max-h-40 object-contain"
                        />
                      </div>
                    )}
                    {allImages.length > 1 && (
                      <div className="bg-white rounded-lg border border-gray-200 p-2">
                        <div className="flex gap-2 overflow-x-auto">
                          {allImages.map((u, i) => (
                            <button key={i} className={`border rounded ${u === (selectedImageUrl || allImages[0]) ? 'ring-2 ring-blue-500' : ''}`} onClick={() => setSelectedImageUrl(u)}>
                              <img src={u} alt={`gallery-${i}`} className="h-16 w-24 object-cover rounded" />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="bg-white rounded-lg border border-gray-200 p-4">
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-sm font-medium text-gray-700">Box Quantity</span>
                        <span className="text-2xl font-bold text-gray-900">{onHand}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full transition-all duration-300 ${
                            onHand >= (product.minLevelBox || 0) 
                              ? 'bg-green-500' 
                              : onHand > 0 
                                ? 'bg-yellow-500' 
                                : 'bg-red-500'
                          }`}
                          style={{ 
                            width: `${Math.min((onHand / Math.max((product.minLevelBox || 0) * 2, 1)) * 100, 100)}%` 
                          }}
                        ></div>
                      </div>
                      <div className="flex justify-between text-xs text-gray-500 mt-1">
                        <span>0</span>
                        <span>Min: {product.minLevelBox || 0}</span>
                        <span>{(product.minLevelBox || 0) * 2}</span>
                      </div>
                      <div className="mt-2 text-xs text-gray-600">
                        <div className="flex justify-between">
                          <span>Current: {onHand} boxes</span>
                          <span>Status: {
                            onHand >= (product.minLevelBox || 0) 
                              ? '✅ Good' 
                              : onHand > 0 
                                ? '⚠️ Low' 
                                : '❌ Out of Stock'
                          }</span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-white rounded-lg border border-gray-200 p-4">
                        <p className="text-sm text-gray-600">Minimum Level</p>
                        <p className="text-lg font-semibold text-gray-900">{product.minLevelBox}</p>
                      </div>
                      <div className="bg-white rounded-lg border border-gray-200 p-4">
                        <p className="text-sm text-gray-600">Total Value</p>
                        <p className="text-lg font-semibold text-gray-900">£{(onHand * (product.pricePerBox || 0)).toFixed(2)}</p>
                      </div>
                    </div>

                    {onHand <= product.minLevelBox && (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                        <div className="flex items-center gap-2">
                          <ExclamationTriangleIcon className="h-5 w-5 text-amber-600" />
                          <span className="text-sm font-medium text-amber-800">Low Stock Warning</span>
                        </div>
                        <p className="text-xs text-amber-700 mt-1">
                          Stock level is below minimum. Reorder is recommended.
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right: Adjustment Form */}
                <div className="lg:col-span-1 p-4">
                  <h4 className="text-lg font-semibold text-gray-900 mb-4">Stock Operation</h4>
                  
                  <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Adjustment Type */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Operation Type</label>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { value: 'in', label: 'Stock In', icon: PlusIcon, color: 'green' },
                          { value: 'out', label: 'Stock Out', icon: MinusIcon, color: 'red' },
                          { value: 'transfer', label: 'Transfer', icon: ArrowPathIcon, color: 'blue' },
                          { value: 'adjustment', label: 'Adjustment', icon: DocumentTextIcon, color: 'gray' }
                        ].map(({ value, label, icon: Icon, color }) => (
                          <button
                            key={value}
                            type="button"
                            onClick={() => setAdjustmentType(value as any)}
                            className={`p-4 rounded-lg border-2 text-left transition-all ${
                              adjustmentType === value
                                ? `border-${color}-500 bg-${color}-50`
                                : 'border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            <Icon className={`h-6 w-6 text-${color}-600 mb-2`} />
                            <span className="block text-sm font-medium text-gray-900">{label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Quantity and Details */}
                    <div className="grid grid-cols-1 gap-4">
                      <div>
                        <label htmlFor="quantity" className="block text-sm font-medium text-gray-700 mb-2">
                          Quantity *
                        </label>
                        <input
                          type="number"
                          id="quantity"
                          value={quantity}
                          onChange={(e) => setQuantity(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="0"
                          min="0"
                          step="0.01"
                          required
                        />
                      </div>

                    </div>

                    {/* Reason */}
                    <div>
                      <label htmlFor="reason" className="block text-sm font-medium text-gray-700 mb-2">
                        Reason *
                      </label>
                      <select
                        id="reason"
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        required
                      >
                        <option value="">Select a reason</option>
                        {stockReasons
                          .filter(r => {
                            // Filter reasons based on adjustment type
                            switch (adjustmentType) {
                              case 'in': return r.operationType === 'stock_in'
                              case 'out': return r.operationType === 'stock_out'
                              case 'transfer': return r.operationType === 'transfer'
                              case 'adjustment': return r.operationType === 'adjustment'
                              default: return true
                            }
                          })
                          .map((reason) => (
                            <option key={reason.id} value={reason.name}>
                              {reason.name}
                            </option>
                          ))}
                      </select>
                    </div>

                    {/* Notes */}
                    <div>
                      <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-2">
                        Notes
                      </label>
                      <textarea
                        id="notes"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Notes about the transaction..."
                      />
                    </div>

                    {/* Preview */}
                    {quantity && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <h5 className="text-sm font-medium text-blue-900 mb-2">Preview</h5>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-blue-700">Current Stock:</span>
                          <span className="font-medium">{onHand}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-blue-700">Change:</span>
                          <span className={`font-medium ${
                            adjustmentType === 'in' ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {adjustmentType === 'in' ? '+' : '-'}{quantity}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-sm font-medium">
                          <span className="text-blue-900">New Stock:</span>
                          <span className="text-blue-900">
                            {adjustmentType === 'in' 
                              ? onHand + Number(quantity)
                              : onHand - Number(quantity)
                            }
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-200">
                      <button
                        type="button"
                        onClick={onClose}
                        className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors font-medium"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isSubmitting || !quantity || !reason}
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium flex items-center"
                      >
                        {isSubmitting ? (
                          <>
                            <ArrowPathIcon className="animate-spin h-4 w-4 mr-2" />
                            Saving...
                          </>
                        ) : (
                          'Update Stock'
                        )}
                      </button>
                    </div>

                    {adjustmentType === 'transfer' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Transfer To Folder</label>
                        <select
                          value={transferTo}
                          onChange={(e) => setTransferTo(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                          <option value="">Select folder</option>
                          {groups.map((g) => (
                            <option key={g.id} value={g.id}>{g.name}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </form>
                </div>
                </div>
            )}

            {activeTab === 'qr' && (
              <div className="p-6">
                <div className="max-w-2xl mx-auto">
                  <h4 className="text-lg font-semibold text-gray-900 mb-6">QR Code Management</h4>
                  
                    {/* QR Code Display */}
                    <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
                      <div className="flex items-center justify-between mb-4">
                        <h5 className="text-md font-medium text-gray-900">QR Code</h5>
                        {qrInfo && (
                          <span className="text-sm text-gray-500">{qrInfo.size}x{qrInfo.size}px</span>
                        )}
                      </div>
                    
                    {qrError && (
                      <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-sm text-red-600">{qrError}</p>
                      </div>
                    )}
                    
                    {qrDataUrl ? (
                      <div className="flex justify-center mb-4">
                        <img
                          src={qrDataUrl}
                          alt="QR Code"
                          className="max-w-full h-auto border border-gray-200 rounded-lg"
                        />
                      </div>
                    ) : qrRemoteUrl ? (
                      <div className="flex justify-center mb-4">
                        <img
                          src={qrRemoteUrl}
                          alt="QR Code"
                          className="max-w-full h-auto border border-gray-200 rounded-lg"
                        />
                      </div>
                    ) : (
                      <div className="flex justify-center mb-4">
                        <div className="w-48 h-48 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center">
                          <span className="text-gray-500">No QR Code Generated</span>
                        </div>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="space-y-3">
                      <div className="flex gap-3">
                        <button
                          onClick={handleGenerateQR}
                          disabled={qrBusy}
                          className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                        >
                          {qrBusy ? 'Generating...' : 'Generate QR Code'}
                        </button>
                        <button
                          onClick={handleSaveQR}
                          disabled={!qrDataUrl || qrBusy || !workspaceId}
                          className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                        >
                          Save to Storage
                        </button>
                      </div>
                      
                      <div className="flex gap-3">
                        <button
                          onClick={handleDownloadQR}
                          disabled={!qrDataUrl || qrBusy}
                          className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          title={!qrDataUrl ? 'Önce QR kod oluşturun' : 'QR kodu indir'}
                        >
                          {!qrDataUrl ? 'Generate First' : 'Download QR Code'}
                        </button>
                        <button
                          onClick={handleDeleteQR}
                          disabled={!qrRemoteUrl || qrBusy || !workspaceId}
                          className="flex-1 px-4 py-2 border border-red-300 text-red-700 rounded-lg hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          Delete from Storage
                        </button>
                      </div>
                    </div>

                    {/* QR Info */}
                    {qrInfo && (
                      <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                        <h6 className="text-sm font-medium text-gray-900 mb-2">QR Code Information</h6>
                        <div className="text-sm text-gray-600 space-y-1">
                          <div className="flex justify-between">
                            <span>Text:</span>
                            <span className="font-mono text-xs break-all">{qrInfo.text}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Size:</span>
                            <span>{qrInfo.size}x{qrInfo.size}px</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Format:</span>
                            <span>PNG</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'history' && (
              <div className="p-6">
                <h4 className="text-lg font-semibold text-gray-900 mb-6">Stock History</h4>
                
                <div className="space-y-4">
                    {history.slice().reverse().map((record) => (
                    <div key={record.id} className="bg-white border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg border ${getAdjustmentColor(record.type)}`}>
                            {getAdjustmentIcon(record.type)}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{record.reason}</p>
                            <p className="text-sm text-gray-500">{record.reference}</p>
                            {(record as any).refs?.jobId && (
                              <a
                                className="inline-block mt-1 text-blue-600 hover:text-blue-800 text-sm"
                                href={`/production?jobId=${(record as any).refs.jobId}`}
                                title="Open job"
                              >
                                Open job →
                              </a>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`text-lg font-bold ${
                            record.type === 'in' ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {record.type === 'in' ? '+' : '-'}{record.quantity}
                          </p>
                          <p className="text-xs text-gray-500">
                            {new Date(record.createdAt).toLocaleDateString('en-GB')}
                          </p>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-4 text-sm text-gray-600 mt-3">
                        <div>
                          <span className="font-medium">Previous:</span> {record.previousQuantity}
                        </div>
                        <div>
                          <span className="font-medium">New:</span> {record.newQuantity}
                        </div>
                        <div className="flex items-center gap-1">
                          <UserIcon className="h-3 w-3" />
                          {record.createdBy}
                        </div>
                      </div>
                      
                      {record.notes && (
                        <p className="text-sm text-gray-600 mt-2 bg-gray-50 p-2 rounded">{record.notes}</p>
                      )}
                    </div>
                  ))}
                </div>
                </div>
            )}

            {activeTab === 'analytics' && (
              <div className="p-6">
                <h4 className="text-lg font-semibold text-gray-900 mb-6">Stock Analysis</h4>
                
                {/* Stock Level Trend Chart */}
                <div className="bg-white p-6 rounded-lg border border-gray-200 mb-6">
                  <h5 className="text-lg font-semibold text-gray-900 mb-4">Stock Level Trend (Last 30 Days)</h5>
                  <StockTrendChart history={history} />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                  <div className="bg-white border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <ArrowPathIcon className="h-6 w-6 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Monthly Movements</p>
                        <p className="text-2xl font-bold text-gray-900">{analytics.monthlyMovements}</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-white border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-green-100 rounded-lg">
                        <ChartBarIcon className="h-6 w-6 text-green-600" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Stock Turnover</p>
                        <p className="text-2xl font-bold text-gray-900">{analytics.stockTurnover}</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-white border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-amber-100 rounded-lg">
                        <ExclamationTriangleIcon className="h-6 w-6 text-amber-600" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Stockouts</p>
                        <p className="text-2xl font-bold text-gray-900">{analytics.stockOutEvents}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Stock Level Chart Placeholder */}
                <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
                  <h5 className="font-medium text-gray-900 mb-4">Stock Level Trend</h5>
                  <div className="h-48 bg-gray-50 rounded-lg flex items-center justify-center">
                    <p className="text-gray-500">Stock level chart will be shown here</p>
                  </div>
                </div>

                {/* Recommendations */}
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <h5 className="font-medium text-amber-900 mb-2">Recommendations</h5>
                  <ul className="text-sm text-amber-800 space-y-1">
                    <li>• Stock level is near minimum, place a reorder</li>
                    <li>• There were 2 stockouts in the last 30 days</li>
                    <li>• Average stock turnover: {analytics.stockTurnover}</li>
                  </ul>
                </div>
                </div>
            )}
          </div>
        </div>
      </div>

      {/* Image Modal */}
      {showImageModal && modalImageUrl && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50" onClick={() => setShowImageModal(false)}>
          <div className="max-w-4xl max-h-full p-4" onClick={(e) => e.stopPropagation()}>
            <div className="relative">
              <button
                onClick={() => setShowImageModal(false)}
                className="absolute -top-4 -right-4 bg-white rounded-full p-2 shadow-lg hover:bg-gray-100 transition-colors"
              >
                <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <img
                src={modalImageUrl}
                alt={product.name}
                className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}