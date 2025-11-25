import { useState, useEffect, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'

import {
  XMarkIcon,
  PlusIcon,
  MinusIcon,
  ArrowPathIcon,
  DocumentTextIcon,
  ClockIcon,
  ChartBarIcon,
  ExclamationTriangleIcon,
  QrCodeIcon,
  PhotoIcon,
  TagIcon,
  CubeIcon,
  CurrencyPoundIcon,
  AdjustmentsHorizontalIcon,
  ArrowDownTrayIcon,
  CheckCircleIcon,
  ArchiveBoxIcon,
  PencilIcon,
  TrashIcon
} from '@heroicons/react/24/outline'
import { listStockReasons, type StockReason } from '../api/settings'

import { useSessionStore } from '../state/sessionStore'
import { createStockTransaction, listProductStockTxns, type UiTxnType, getProductOnHand, recalculateProductStock } from '../api/inventory'
import { listGroups, type Group, updateProduct, saveProductQr, deleteProductQr, listProductTickets, createProductTicket, updateProductTicket, deleteProductTicket, type Ticket } from '../api/products'
import { listUOMs, listCategories, listSubcategories, listCustomFields } from '../api/settings'
import { generateQRCodeDataURL, downloadQRCode, type QRCodeResult } from '../utils/qrcode'
import { toCSV, downloadCSV } from '../utils/csv'

// Types remain unchanged
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
  fromLoc?: string
  toLoc?: string
  unitCost?: number
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

// --- UI Helper Components ---
const SectionHeader = ({ title, icon: Icon }: { title: string; icon?: any }) => (
  <div className="flex items-center gap-2 mb-4 pb-2 border-b border-gray-100">
    {Icon && <Icon className="w-4 h-4 text-gray-400" />}
    <h4 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">{title}</h4>
  </div>
)

const InputGroup = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="space-y-1.5">
    <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</label>
    {children}
  </div>
)

const StyledInput = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input
    {...props}
    className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-200 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 bg-white transition-all"
  />
)

const StyledSelect = (props: React.SelectHTMLAttributes<HTMLSelectElement>) => (
  <select
    {...props}
    className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-200 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 bg-white transition-all"
  />
)

// --- Chart Component ---
function StockTrendChart({ history }: { history: StockAdjustment[] }) {
  const chartHeight = 200
  const chartWidth = 800
  const padding = 40
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null)

  const data = useMemo(() => {
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const recentHistory = history
      .filter(h => new Date(h.createdAt) >= thirtyDaysAgo)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())

    if (recentHistory.length === 0) return []

    let runningBalance = 0
    return recentHistory.map(h => {
      runningBalance += h.type === 'in' || h.type === 'transfer' ? h.quantity : -h.quantity
      return {
        date: new Date(h.createdAt),
        balance: runningBalance,
        type: h.type,
        reason: h.reason,
        quantity: h.quantity
      }
    })
  }, [history])

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-gray-400 bg-gray-50 rounded-lg border border-dashed border-gray-200">
        <ChartBarIcon className="w-8 h-8 mb-2 opacity-50" />
        <p className="text-sm">No recent movement data</p>
      </div>
    )
  }

  const balances = data.map(d => d.balance)
  const min = Math.min(0, ...balances)
  const max = Math.max(1, ...balances)
  const range = max - min || 1

  const normalize = (val: number) => {
    return padding + ((max - val) / range) * (chartHeight - 2 * padding)
  }

  const points = data.map((d, i) => {
    const x = padding + (i / (data.length - 1 || 1)) * (chartWidth - 2 * padding)
    const y = normalize(d.balance)
    return { x, y, ...d, index: i }
  })

  const polylinePoints = points.map(p => `${p.x},${p.y}`).join(' ')

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const svgX = ((e.clientX - rect.left) / rect.width) * chartWidth

    // Find closest point
    let closestIndex = 0
    let minDist = Infinity
    points.forEach((p, i) => {
      const dist = Math.abs(p.x - svgX)
      if (dist < minDist) {
        minDist = dist
        closestIndex = i
      }
    })

    setHoveredIndex(closestIndex)
    setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top })
  }

  const handleMouseLeave = () => {
    setHoveredIndex(null)
    setMousePos(null)
  }

  const hoveredPoint = hoveredIndex !== null ? points[hoveredIndex] : null

  return (
    <div className="w-full h-[200px] relative">
      <svg
        className="w-full h-full overflow-visible cursor-crosshair"
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        preserveAspectRatio="none"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        {/* Gradient Defs */}
        <defs>
          <linearGradient id="chartGradient" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Grid Lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const value = min + (max - min) * ratio
          const y = normalize(value)
          return (
            <line
              key={ratio}
              x1={padding}
              y1={y}
              x2={chartWidth - padding}
              y2={y}
              stroke="#f3f4f6"
              strokeWidth="1"
              strokeDasharray={ratio === 0.5 ? "4 4" : "2 2"}
              opacity={ratio === 0.5 ? 1 : 0.5}
            />
          )
        })}

        {/* Zero Line */}
        <line
          x1={padding}
          y1={normalize(0)}
          x2={chartWidth - padding}
          y2={normalize(0)}
          stroke="#d1d5db"
          strokeWidth="2"
          strokeDasharray="4 4"
        />

        {/* Area Fill */}
        <polygon
          points={`${padding},${chartHeight - padding} ${polylinePoints} ${chartWidth - padding},${chartHeight - padding}`}
          fill="url(#chartGradient)"
        />

        {/* Main Line */}
        <polyline
          points={polylinePoints}
          fill="none"
          stroke="#3b82f6"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
          filter="url(#glow)"
        />

        {/* Data Points */}
        {points.map((point, i) => {
          const isHovered = hoveredIndex === i
          const color = point.type === 'in' ? '#10b981' : point.type === 'out' ? '#ef4444' : '#3b82f6'
          return (
            <g key={i}>
              {/* Invisible larger hit area */}
              <circle
                cx={point.x}
                cy={point.y}
                r="12"
                fill="transparent"
                style={{ cursor: 'pointer' }}
              />
              {/* Visible point */}
              <circle
                cx={point.x}
                cy={point.y}
                r={isHovered ? "6" : "4"}
                fill={color}
                stroke="white"
                strokeWidth={isHovered ? "3" : "2"}
                style={{
                  transition: 'all 0.2s ease',
                  filter: isHovered ? 'drop-shadow(0 0 4px ' + color + ')' : 'none'
                }}
              />
            </g>
          )
        })}

        {/* Hover Line */}
        {hoveredIndex !== null && hoveredPoint && (
          <g>
            <line
              x1={hoveredPoint.x}
              y1={padding}
              x2={hoveredPoint.x}
              y2={chartHeight - padding}
              stroke="#94a3b8"
              strokeWidth="1"
              strokeDasharray="4 4"
              opacity="0.5"
            />
          </g>
        )}

        {/* X-axis labels */}
        {points.filter((_, i) => i % Math.ceil(points.length / 5) === 0 || i === points.length - 1).map((point, i) => (
          <text
            key={i}
            x={point.x}
            y={chartHeight - 10}
            textAnchor="middle"
            className="text-xs fill-gray-500"
            fontSize="10"
          >
            {point.date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' })}
          </text>
        ))}

        {/* Y-axis labels */}
        {[min, (min + max) / 2, max].map((value, i) => {
          const y = normalize(value)
          return (
            <text
              key={i}
              x="10"
              y={y + 4}
              textAnchor="start"
              className="text-xs fill-gray-500"
              fontSize="10"
            >
              {Math.round(value)}
            </text>
          )
        })}
      </svg>

      {/* Tooltip */}
      {hoveredPoint && mousePos && (
        <div
          className="absolute bg-slate-900 text-white text-xs rounded-lg shadow-xl p-3 pointer-events-none z-10"
          style={{
            left: `${mousePos.x + 10}px`,
            top: `${mousePos.y - 10}px`,
            transform: mousePos.x > chartWidth / 2 ? 'translateX(-100%)' : 'none'
          }}
        >
          <div className="font-semibold mb-1">
            {hoveredPoint.date.toLocaleDateString('en-GB', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${hoveredPoint.type === 'in' ? 'bg-green-400' :
                hoveredPoint.type === 'out' ? 'bg-red-400' : 'bg-blue-400'
                }`} />
              <span className="capitalize">{hoveredPoint.type}</span>
            </div>
            <div className="text-gray-300">
              Balance: <span className="font-semibold text-white">{hoveredPoint.balance}</span>
            </div>
            <div className="text-gray-300">
              Qty: <span className="font-semibold text-white">{hoveredPoint.quantity}</span>
            </div>
            {hoveredPoint.reason && (
              <div className="text-gray-300 text-[10px] max-w-[200px] truncate">
                {hoveredPoint.reason}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export function ProductDetails({ product, onClose, onSaved }: Props) {
  const [activeTab, setActiveTab] = useState<'overview' | 'history' | 'tickets' | 'settings' | 'qr'>('overview')
  // Consolidate adjustment state
  const [adjState, setAdjState] = useState({
    type: 'in' as UiTxnType | 'adjustment',
    qty: '',
    reason: '',
    notes: '',
    transferTo: ''
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  const queryClient = useQueryClient()
  const { workspaceId, userId } = useSessionStore()

  // Fetch stock transactions and on-hand using TanStack Query for automatic refresh
  const { data: stockTxns = [], refetch: refetchStockTxns } = useQuery({
    queryKey: ['stockTxns', workspaceId, product.id],
    queryFn: async () => {
      if (!workspaceId || !product.id) return []
      return listProductStockTxns(workspaceId, product.id, 50)
    },
    enabled: !!workspaceId && !!product.id,
    refetchInterval: activeTab === 'history' ? 1500 : 3000, // Auto-refresh every 1.5s when history tab is active, 3s otherwise
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  })

  const { data: onHand = (product as any).qtyOnHand || 0, refetch: refetchOnHand } = useQuery({
    queryKey: ['productOnHand', workspaceId, product.id],
    queryFn: async () => {
      if (!workspaceId || !product.id) return 0
      return getProductOnHand(workspaceId, product.id)
    },
    enabled: !!workspaceId && !!product.id,
    refetchInterval: activeTab === 'history' ? 1500 : 3000,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  })

  // Filter state for history
  const [historyFilters, setHistoryFilters] = useState({
    type: 'all' as 'all' | 'in' | 'out' | 'transfer',
    dateFrom: '',
    dateTo: '',
  })

  // Process History from stockTxns
  const history = useMemo(() => {
    if (!stockTxns.length) return []
    let runningBalance = Number(onHand)
    const processedHistory: StockAdjustment[] = stockTxns.map((t) => {
      const qty = Number(t.qty || 0)
      const newQuantity = runningBalance
      runningBalance -= qty // Reverse calculation
      const txn = t as any
      return {
        id: t.id,
        type: (t.type === 'Receive' || t.type === 'Produce' ? 'in' : t.type === 'Transfer' ? 'transfer' : 'out') as any,
        quantity: Math.abs(qty),
        previousQuantity: runningBalance,
        newQuantity,
        reason: t.reason || '',
        notes: '',
        createdAt: txn.timestamp?.toDate?.()?.toISOString?.() || new Date().toISOString(),
        createdBy: t.userId || 'system',
        reference: (txn.reference || (t.refs && (t.refs.ref || t.refs.taskId || t.refs.poId || t.refs.jobId))) || '',
        refs: txn.refs || undefined,
        fromLoc: txn.fromLoc || undefined,
        toLoc: txn.toLoc || undefined,
        unitCost: txn.unitCost || undefined,
      }
    }).reverse()

    // Apply filters
    let filtered = processedHistory
    if (historyFilters.type !== 'all') {
      filtered = filtered.filter(h => h.type === historyFilters.type)
    }
    if (historyFilters.dateFrom) {
      const fromDate = new Date(historyFilters.dateFrom)
      filtered = filtered.filter(h => new Date(h.createdAt) >= fromDate)
    }
    if (historyFilters.dateTo) {
      const toDate = new Date(historyFilters.dateTo)
      toDate.setHours(23, 59, 59, 999) // End of day
      filtered = filtered.filter(h => new Date(h.createdAt) <= toDate)
    }

    return filtered
  }, [stockTxns, onHand, historyFilters])

  // Data State
  const [groups, setGroups] = useState<Group[]>([])
  const [uoms, setUoms] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [subcategories, setSubcategories] = useState<any[]>([])
  const [customFields, setCustomFields] = useState<any[]>([])
  const [stockReasons, setStockReasons] = useState<StockReason[]>([])

  // Tickets State
  const [showCreateTicket, setShowCreateTicket] = useState(false)
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null)

  // Fetch tickets
  const { data: tickets = [], isLoading: ticketsLoading, refetch: refetchTickets } = useQuery({
    queryKey: ['productTickets', workspaceId, product.id],
    queryFn: async () => {
      if (!workspaceId || !product.id) return []
      return listProductTickets(workspaceId, product.id)
    },
    enabled: !!workspaceId && !!product.id && activeTab === 'tickets',
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  })

  // QR State
  const [qrData, setQrData] = useState<{
    localUrl: string | null;
    remoteUrl: string | null;
    info: QRCodeResult | null;
    busy: boolean;
    error: string | null;
  }>({
    localUrl: null,
    remoteUrl: (product as any).qrUrl || (product as any).barcodeUrl || null,
    info: null,
    busy: false,
    error: null
  })

  // Update QR data when product changes
  useEffect(() => {
    const qrUrl = (product as any).qrUrl || (product as any).barcodeUrl || null
    setQrData(prev => ({
      ...prev,
      remoteUrl: qrUrl,
      // Keep localUrl if exists, otherwise clear if remoteUrl is removed
      localUrl: qrUrl ? null : prev.localUrl
    }))
  }, [(product as any).qrUrl, (product as any).barcodeUrl])

  // Image State
  const [selectedImage, setSelectedImage] = useState<string | null>((product as any).imageUrl || null)
  const [imageModal, setImageModal] = useState<string | null>(null)
  const [uploadingImages, setUploadingImages] = useState(false)
  const [mainImageFile, setMainImageFile] = useState<File | null>(null)
  const [galleryImageFiles, setGalleryImageFiles] = useState<File[]>([])

  const allImages = useMemo(() => [
    ...(product.imageUrl ? [product.imageUrl] : []),
    ...(Array.isArray(product.galleryUrls) ? product.galleryUrls : [])
  ], [product])

  // --- Effects ---
  useEffect(() => {
    if (!workspaceId) return
    const loadData = async () => {
      try {
        const [g, u, c, sc, cf, sr] = await Promise.all([
          listGroups(workspaceId),
          listUOMs(workspaceId),
          listCategories(workspaceId),
          listSubcategories(workspaceId),
          listCustomFields(workspaceId),
          listStockReasons(workspaceId)
        ])

        setGroups(g)
        setUoms(u)
        setCategories(c)
        setSubcategories(sc)
        setCustomFields(cf.filter(f => f.active && (!f.groupId || f.groupId === product.groupId)))
        setStockReasons(sr.filter(r => r.active))
      } catch (e) {
        console.error("Failed to load product data", e)
      }
    }
    loadData()
  }, [workspaceId, product.id, product.groupId])

  // Listen for window focus to refresh data when user returns to tab
  useEffect(() => {
    const handleFocus = () => {
      queryClient.invalidateQueries({ queryKey: ['stockTxns', workspaceId, product.id] })
      queryClient.invalidateQueries({ queryKey: ['productOnHand', workspaceId, product.id] })
      // Also manually refetch
      refetchStockTxns()
      refetchOnHand()
    }
    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [workspaceId, product.id, queryClient, refetchStockTxns, refetchOnHand])

  // Listen for custom event to force refresh (can be triggered from other components)
  useEffect(() => {
    const handleStockUpdate = () => {
      // Always refresh this product's queries when any stock transaction is created
      // This ensures we catch transactions even if productId doesn't match exactly
      queryClient.invalidateQueries({ queryKey: ['stockTxns', workspaceId, product.id] })
      queryClient.invalidateQueries({ queryKey: ['productOnHand', workspaceId, product.id] })
      // Also invalidate all stockTxns to catch any related updates
      queryClient.invalidateQueries({ queryKey: ['stockTxns', workspaceId] })
      queryClient.invalidateQueries({ queryKey: ['productOnHand', workspaceId] })
      // Manually refetch
      refetchStockTxns()
      refetchOnHand()
    }
    window.addEventListener('stockTransactionCreated', handleStockUpdate as EventListener)
    return () => window.removeEventListener('stockTransactionCreated', handleStockUpdate as EventListener)
  }, [workspaceId, product.id, queryClient, refetchStockTxns, refetchOnHand])

  // --- Handlers ---
  const handleAdjustment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!adjState.qty || !adjState.reason || !workspaceId) return

    setIsSubmitting(true)
    try {
      const qtyNum = Number(adjState.qty)
      await createStockTransaction({
        workspaceId,
        productId: product.id,
        type: adjState.type as UiTxnType,
        qty: qtyNum,
        userId,
        reason: adjState.reason,
        reference: adjState.notes || undefined,
        fromLoc: adjState.type === 'transfer' ? product.groupId || null : null,
        toLoc: adjState.type === 'transfer' ? adjState.transferTo || null : null,
        unitCost: product.pricePerBox || null,
      })

      // Reset Form
      setAdjState(prev => ({ ...prev, qty: '', reason: '', notes: '' }))

      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['stockTxns', workspaceId, product.id] })
      queryClient.invalidateQueries({ queryKey: ['productOnHand', workspaceId, product.id] })
      queryClient.invalidateQueries({ queryKey: ['products', workspaceId] })

      onSaved?.()
    } catch (err) {
      console.error(err)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleQR = async (action: 'generate' | 'save' | 'delete' | 'download') => {
    if (!workspaceId) {
      setQrData(prev => ({ ...prev, error: 'Workspace ID is required' }))
      return
    }

    setQrData(prev => ({ ...prev, busy: true, error: null }))
    try {
      if (action === 'generate') {
        const sku = product.sku || product.id
        if (!sku) {
          throw new Error('Product SKU or ID is required to generate QR code')
        }
        const res = await generateQRCodeDataURL(sku)
        setQrData(prev => ({ ...prev, localUrl: res.dataUrl, info: res }))
      } else if (action === 'save') {
        const localUrl = qrData.localUrl
        if (!localUrl) {
          throw new Error('No QR code generated. Please generate a QR code first.')
        }
        const url = await saveProductQr(workspaceId, product.id, localUrl)
        await updateProduct(workspaceId, product.id, { qrUrl: url, barcodeUrl: url } as any)
        setQrData(prev => ({ ...prev, remoteUrl: url, localUrl: null }))
        onSaved?.()
      } else if (action === 'delete') {
        if (!qrData.remoteUrl) {
          throw new Error('No QR code saved to delete')
        }
        await deleteProductQr(workspaceId, product.id)
        await updateProduct(workspaceId, product.id, { qrUrl: null, barcodeUrl: null } as any)
        setQrData(prev => ({ ...prev, remoteUrl: null, localUrl: null, info: null }))
        onSaved?.()
      } else if (action === 'download') {
        const qrUrl = qrData.localUrl || qrData.remoteUrl
        if (!qrUrl) {
          throw new Error('No QR code available to download')
        }
        const cleanSku = (product.sku || product.id).replace(/[^a-zA-Z0-9-_]/g, '_')

        // If remoteUrl (HTTP URL), fetch and convert to data URL for download
        if (qrData.remoteUrl && !qrData.localUrl) {
          try {
            const response = await fetch(qrData.remoteUrl)
            const blob = await response.blob()
            const reader = new FileReader()
            reader.onloadend = () => {
              downloadQRCode(reader.result as string, `${cleanSku}_QR.png`)
            }
            reader.readAsDataURL(blob)
          } catch (fetchError) {
            // Fallback: try direct download
            const link = document.createElement('a')
            link.href = qrData.remoteUrl
            link.download = `${cleanSku}_QR.png`
            link.target = '_blank'
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
          }
        } else {
          // Use localUrl (data URL) directly
          downloadQRCode(qrUrl, `${cleanSku}_QR.png`)
        }
      }
    } catch (e: any) {
      console.error('QR action error:', e)
      setQrData(prev => ({ ...prev, error: e?.message || 'An error occurred' }))
    } finally {
      setQrData(prev => ({ ...prev, busy: false }))
    }
  }

  const genericUpdate = async (formData: FormData, type: 'basic' | 'stock' | 'class' | 'tech' | 'tags' | 'custom') => {
    if (!workspaceId) return

    const payload: any = {}

    // Map form data based on type
    if (type === 'basic') {
      payload.name = formData.get('name')
      payload.sku = formData.get('sku')
      payload.uom = formData.get('uom')
      payload.status = formData.get('status')
      payload.groupId = formData.get('groupId') || null
    } else if (type === 'stock') {
      payload.pricePerBox = Number(formData.get('pricePerBox') || 0)
      payload.quantityBox = Number(formData.get('quantityBox') || 0)
      payload.pcsPerBox = Number(formData.get('pcsPerBox') || 0)
      payload.minStock = Number(formData.get('minStock') || 0)
      payload.reorderPoint = Number(formData.get('reorderPoint') || 0)
      payload.minLevelBox = Number(formData.get('minLevelBox') || 0)
    } else if (type === 'class') {
      payload.category = formData.get('category') || null
      payload.subcategory = formData.get('subcategory') || null
    } else if (type === 'tech') {
      payload.materialSeries = formData.get('materialSeries') || null
      payload.boardType = formData.get('boardType') || null
      payload.gsm = formData.get('gsm') || null
      payload.dimensionsWxLmm = formData.get('dimensionsWxLmm') || null
      payload.cal = formData.get('cal') || null
    } else if (type === 'tags') {
      const tagsValue = formData.get('tags') as string
      payload.tags = tagsValue ? tagsValue.split(',').map(s => s.trim()).filter(Boolean) : []
      payload.notes = formData.get('notes') || null
    } else if (type === 'custom') {
      for (const [key, value] of formData.entries()) {
        if (key.startsWith('custom_') && value) {
          payload[key] = value
        }
      }
    }

    try {
      await updateProduct(workspaceId, product.id, payload)
      onSaved?.()
    } catch (e) {
      alert('Update failed: ' + (e instanceof Error ? e.message : 'Unknown error'))
    }
  }

  // --- Render Parts ---
  const StatusBadge = ({ status }: { status: string }) => {
    const badgeStyles: Record<string, string> = {
      active: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      inactive: 'bg-gray-100 text-gray-700 border-gray-200',
      draft: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    }

    const style = badgeStyles[status] || badgeStyles.inactive

    return (
      <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold border ${style} capitalize shrink-0`}>
        {status}
      </span>
    )
  }

  const AdjustmentTab = ({ id, label, icon: Icon, color }: any) => {
    const colorClasses: Record<string, { active: string; icon: string }> = {
      emerald: { active: 'bg-emerald-50 border-emerald-300 text-emerald-700 ring-emerald-200 shadow-sm', icon: 'text-emerald-600' },
      red: { active: 'bg-red-50 border-red-300 text-red-700 ring-red-200 shadow-sm', icon: 'text-red-600' },
      blue: { active: 'bg-blue-50 border-blue-300 text-blue-700 ring-blue-200 shadow-sm', icon: 'text-blue-600' },
      amber: { active: 'bg-amber-50 border-amber-300 text-amber-700 ring-amber-200 shadow-sm', icon: 'text-amber-600' },
    }

    const colors = colorClasses[color] || colorClasses.emerald
    const isActive = adjState.type === id

    return (
      <button
        type="button"
        onClick={() => setAdjState(p => ({ ...p, type: id }))}
        className={`flex-1 flex flex-col items-center justify-center p-2.5 sm:p-3 rounded-xl border-2 transition-all duration-200 active:scale-95 ${
          isActive
            ? `${colors.active} ring-2`
            : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50 hover:border-gray-300'
        }`}
      >
        <Icon className={`w-4 h-4 sm:w-5 sm:h-5 mb-1 ${isActive ? colors.icon : 'text-gray-400'}`} />
        <span className="text-[10px] sm:text-xs font-semibold leading-tight text-center">{label}</span>
      </button>
    )
  }

  // Clean product name to fix encoding issues
  const cleanProductName = (name: string) => {
    if (!name) return 'Unnamed Product'
    let cleaned = name
      .replace(/\uFFFD/g, '') // Remove replacement characters
      .replace(/\u0000/g, '') // Remove null characters
      .trim()
    
    try {
      const textarea = document.createElement('textarea')
      textarea.innerHTML = cleaned
      cleaned = textarea.value || cleaned
    } catch (e) {
      // If decoding fails, use original
    }
    
    return cleaned || name
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0">
      <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity" onClick={onClose} />

      <div className="relative w-full h-full sm:h-[90vh] sm:max-w-6xl sm:mx-auto bg-white sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col lg:flex-row animate-in fade-in zoom-in duration-200">

        {/* --- Left Sidebar: Visuals & Key Stats (Desktop) --- */}
        <div className="hidden lg:flex lg:w-80 xl:w-96 bg-gradient-to-br from-slate-50 to-gray-50 lg:border-r border-gray-200 flex-col overflow-y-auto">

          {/* Desktop Layout */}
          <div className="hidden lg:block p-6">
            {/* Main Image - Desktop Full */}
            <div className="aspect-square bg-white rounded-2xl border-2 border-gray-200 shadow-md p-4 flex items-center justify-center mb-4 relative group overflow-hidden">
              <img
                src={selectedImage || allImages[0] || 'https://placehold.co/400x400?text=No+Image'}
                className="max-w-full max-h-full object-contain transition-transform duration-300 group-hover:scale-105 cursor-pointer"
                onClick={() => setImageModal(selectedImage || allImages[0])}
                alt={product.name}
              />
              {allImages.length === 0 && <PhotoIcon className="w-16 h-16 text-gray-300" />}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors pointer-events-none rounded-2xl" />
            </div>

            {/* Gallery Thumbs - Desktop */}
            {allImages.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-2 mb-6 scrollbar-hide">
                {allImages.map((url, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedImage(url)}
                    className={`flex-shrink-0 w-14 h-14 rounded-lg border-2 overflow-hidden transition-all ${selectedImage === url ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-200 hover:border-gray-300'}`}
                  >
                    <img src={url} className="w-full h-full object-cover" alt={`Gallery ${i + 1}`} />
                  </button>
                ))}
              </div>
            )}

            {/* Quick Stats Cards - Desktop only */}
            <div className="hidden lg:block space-y-3">
              <div className="bg-white p-4 rounded-xl border-2 border-gray-200 shadow-md hover:shadow-lg transition-shadow">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">In Stock</span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={async () => {
                        if (!workspaceId) return
                        try {
                          const newQty = await recalculateProductStock(workspaceId, product.id)
                          queryClient.invalidateQueries({ queryKey: ['productOnHand', workspaceId, product.id] })
                          queryClient.invalidateQueries({ queryKey: ['stockTxns', workspaceId, product.id] })
                          refetchOnHand()
                          alert(`Stock recalculated: ${newQty} ${product.uom || 'units'}`)
                        } catch (e) {
                          alert('Failed to recalculate stock: ' + (e instanceof Error ? e.message : 'Unknown error'))
                        }
                      }}
                      className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors active:scale-95"
                      title="Recalculate stock from transaction history"
                    >
                      <ArrowPathIcon className="w-4 h-4 text-gray-400 hover:text-blue-500 transition-colors" />
                    </button>
                    <CubeIcon className="w-5 h-5 text-blue-500" />
                  </div>
                </div>
                <div className="flex items-baseline gap-2 mb-3">
                  <span className="text-4xl font-bold text-gray-900">{onHand}</span>
                  <span className="text-base text-gray-500 font-medium">{product.uom || 'Units'}</span>
                </div>

                {/* Stock Level Indicator */}
                <div className="mt-3">
                  <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden shadow-inner">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${onHand <= (product.minLevelBox || 0) ? 'bg-red-500' : 'bg-emerald-500'}`}
                      style={{ width: `${Math.min(onHand / ((product.minLevelBox || 1) * 3) * 100, 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-xs text-gray-500 font-medium">Min: {product.minLevelBox}</span>
                    {onHand <= (product.minLevelBox || 0) && (
                      <span className="text-xs font-bold text-red-600 flex items-center gap-1 bg-red-50 px-2 py-0.5 rounded-full">
                        <ExclamationTriangleIcon className="w-3 h-3" /> Low Stock
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-emerald-50 to-green-50 p-4 rounded-xl border-2 border-emerald-200 shadow-md">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Est. Value</span>
                  <CurrencyPoundIcon className="w-5 h-5 text-emerald-600" />
                </div>
                <div className="text-3xl font-bold text-gray-900 mb-1">
                  £{(onHand * (product.pricePerBox || 0)).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <p className="text-xs text-gray-600 font-medium">@ £{(product.pricePerBox || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/unit</p>
              </div>

              {/* QR Quick Access */}
              <button
                onClick={() => setActiveTab('qr')}
                className="w-full flex items-center justify-center gap-2 p-3 rounded-xl border-2 border-gray-200 bg-white text-gray-700 hover:bg-gray-50 hover:border-blue-300 hover:text-blue-600 transition-all shadow-sm hover:shadow-md active:scale-95 font-medium text-sm"
              >
                <QrCodeIcon className="w-5 h-5" />
                Manage QR Code
              </button>
            </div>
          </div>
        </div>

        {/* --- Right Content: Details & Actions --- */}
        <div className="flex-1 flex flex-col overflow-hidden bg-white min-w-0">

          {/* Header */}
          <div className="px-4 sm:px-6 py-3 sm:py-4 lg:py-5 border-b border-gray-200 flex items-center justify-between bg-white shrink-0 sticky top-0 z-10">
            <div className="flex-1 min-w-0 pr-3">
              {/* Mobile: Image + Stats in Header */}
              <div className="flex items-center gap-3 mb-2 lg:hidden">
                {/* Image - Compact */}
                <div className="w-16 h-16 bg-white rounded-lg border-2 border-gray-200 shadow-sm flex items-center justify-center shrink-0 relative group overflow-hidden">
                  <img
                    src={selectedImage || allImages[0] || 'https://placehold.co/400x400?text=No+Image'}
                    className="max-w-full max-h-full object-contain transition-transform duration-300 group-hover:scale-105 cursor-pointer"
                    onClick={() => setImageModal(selectedImage || allImages[0])}
                    alt={product.name}
                  />
                  {allImages.length === 0 && <PhotoIcon className="w-6 h-6 text-gray-300" />}
                </div>
                
                {/* Stats - Compact */}
                <div className="flex-1 grid grid-cols-2 gap-2">
                  <div className="bg-gray-50 p-2 rounded-lg border border-gray-200">
                    <div className="text-[9px] text-gray-500 uppercase font-semibold mb-0.5">Stock</div>
                    <div className="text-base font-bold text-gray-900">{onHand}</div>
                    <div className="text-[9px] text-gray-500">{product.uom || 'Units'}</div>
                  </div>
                  <div className="bg-emerald-50 p-2 rounded-lg border border-emerald-200">
                    <div className="text-[9px] text-gray-600 uppercase font-semibold mb-0.5">Value</div>
                    <div className="text-sm font-bold text-gray-900">
                      £{(onHand * (product.pricePerBox || 0)).toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Product Title */}
              <div className="flex items-center gap-2 sm:gap-3 mb-1 flex-wrap">
                <h2 className="text-base sm:text-lg lg:text-xl font-bold text-gray-900 break-words">{cleanProductName(product.name)}</h2>
                <StatusBadge status={product.status} />
              </div>
              <div className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm text-gray-500 flex-wrap">
                <span className="font-mono bg-gray-100 px-2 py-1 rounded-md text-gray-700 text-xs sm:text-sm font-medium">{product.sku}</span>
                <span className="hidden sm:inline">•</span>
                <span className="truncate">{groups.find(g => g.id === product.groupId)?.name || 'Unassigned Group'}</span>
              </div>
            </div>
            <button 
              onClick={onClose} 
              className="p-2 rounded-full hover:bg-gray-100 active:bg-gray-200 text-gray-400 hover:text-gray-600 transition-colors shrink-0"
            >
              <XMarkIcon className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
          </div>

          {/* Mobile Gallery Thumbs */}
          {allImages.length > 1 && (
            <div className="lg:hidden flex gap-2 overflow-x-auto px-4 py-2 border-b border-gray-200 scrollbar-hide">
              {allImages.map((url, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedImage(url)}
                  className={`flex-shrink-0 w-10 h-10 rounded-lg border-2 overflow-hidden transition-all ${selectedImage === url ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-200'}`}
                >
                  <img src={url} className="w-full h-full object-cover" alt={`Gallery ${i + 1}`} />
                </button>
              ))}
            </div>
          )}

          {/* Tabs */}
          <div className="px-4 sm:px-6 border-b border-gray-200 overflow-x-auto scrollbar-hide shrink-0">
            <div className="flex gap-4 sm:gap-6 min-w-max">
              {[
                { id: 'overview', label: 'Overview' },
                { id: 'history', label: 'History' },
                { id: 'tickets', label: 'Tickets' },
                { id: 'qr', label: 'QR & Media' },
                { id: 'settings', label: 'Edit' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-200'
                    }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6">

            {/* --- OVERVIEW TAB --- */}
            {activeTab === 'overview' && (
              <div className="space-y-4 sm:space-y-6 lg:space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">

                {/* Stock Adjustment Card - "Hero" Action */}
                <div className="bg-white rounded-xl sm:rounded-2xl border-2 border-gray-200 shadow-md overflow-hidden">
                  <div className="p-3 sm:p-4 bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
                    <h3 className="font-semibold text-gray-900 flex items-center gap-2 text-sm sm:text-base">
                      <AdjustmentsHorizontalIcon className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
                      <span className="hidden sm:inline">Quick Stock Action</span>
                      <span className="sm:hidden">Stock Action</span>
                    </h3>
                  </div>
                  <div className="p-3 sm:p-4 lg:p-6">
                    <form onSubmit={handleAdjustment}>
                      <div className="grid grid-cols-4 gap-2 sm:gap-3 mb-4 sm:mb-6">
                        <AdjustmentTab id="in" label="Stock In" icon={PlusIcon} color="emerald" />
                        <AdjustmentTab id="out" label="Stock Out" icon={MinusIcon} color="red" />
                        <AdjustmentTab id="transfer" label="Transfer" icon={ArrowPathIcon} color="blue" />
                        <AdjustmentTab id="adjustment" label="Audit" icon={DocumentTextIcon} color="amber" />
                      </div>
                      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-4 lg:gap-6 items-start">
                        {/* QTY Input - Large */}
                        <div className="lg:col-span-3 order-1">
                          <label className="block text-xs font-medium text-gray-500 uppercase mb-2">Quantity</label>
                          <input
                            type="number"
                            value={adjState.qty}
                            onChange={e => setAdjState(p => ({ ...p, qty: e.target.value }))}
                            placeholder="0"
                            className="block w-full rounded-lg sm:rounded-xl border-2 border-gray-200 text-xl sm:text-2xl lg:text-3xl font-bold py-2.5 sm:py-3 lg:py-4 px-3 sm:px-4 text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                            autoFocus
                          />
                        </div>
                        {/* Context Fields */}
                        <div className="lg:col-span-9 grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 order-2">
                          <div className="space-y-1.5">
                            <label className="block text-xs font-medium text-gray-500 uppercase">Reason</label>
                            <StyledSelect
                              value={adjState.reason}
                              onChange={e => setAdjState(p => ({ ...p, reason: e.target.value }))}
                              required
                            >
                              <option value="">Select Reason...</option>
                              {stockReasons
                                .filter(r => {
                                  if (adjState.type === 'in') return r.operationType === 'stock_in'
                                  if (adjState.type === 'out') return r.operationType === 'stock_out'
                                  if (adjState.type === 'transfer') return r.operationType === 'transfer'
                                  return r.operationType === 'adjustment'
                                })
                                .map(r => <option key={r.id} value={r.name}>{r.name}</option>)
                              }
                            </StyledSelect>
                          </div>
                          {adjState.type === 'transfer' && (
                            <div className="space-y-1.5">
                              <label className="block text-xs font-medium text-gray-500 uppercase">Transfer To</label>
                              <StyledSelect
                                value={adjState.transferTo}
                                onChange={e => setAdjState(p => ({ ...p, transferTo: e.target.value }))}
                                required
                              >
                                <option value="">Select Group...</option>
                                {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                              </StyledSelect>
                            </div>
                          )}
                          <div className={`${adjState.type === 'transfer' ? 'md:col-span-2' : 'md:col-span-1'} space-y-1.5`}>
                            <label className="block text-xs font-medium text-gray-500 uppercase">Notes</label>
                            <input
                              type="text"
                              value={adjState.notes}
                              onChange={e => setAdjState(p => ({ ...p, notes: e.target.value }))}
                              className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-200 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                              placeholder="Optional reference..."
                            />
                          </div>
                        </div>
                      </div>
                      <div className="mt-4 sm:mt-6 flex justify-end">
                        <button
                          type="submit"
                          disabled={!adjState.qty || !adjState.reason || isSubmitting}
                          className="w-full sm:w-auto px-4 sm:px-6 py-2.5 sm:py-3 bg-slate-900 text-white text-sm font-semibold rounded-lg sm:rounded-xl hover:bg-slate-800 focus:ring-4 focus:ring-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-md hover:shadow-lg active:scale-95"
                        >
                          {isSubmitting ? (
                            <>
                              <ArrowPathIcon className="w-4 h-4 animate-spin" />
                              <span className="hidden sm:inline">Processing...</span>
                              <span className="sm:hidden">Processing</span>
                            </>
                          ) : (
                            <>
                              <span className="hidden sm:inline">Confirm Transaction</span>
                              <span className="sm:hidden">Confirm</span>
                            </>
                          )}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>

                {/* Analytics Preview */}
                <div className="grid grid-cols-1 gap-4 sm:gap-6">
                  <div className="bg-white p-3 sm:p-4 lg:p-6 rounded-xl sm:rounded-2xl border-2 border-gray-200 shadow-sm overflow-hidden">
                    <SectionHeader title="Stock Trend (30 Days)" icon={ChartBarIcon} />
                    <div className="overflow-x-auto -mx-2 sm:mx-0">
                      <div className="min-w-[400px] sm:min-w-0">
                        <StockTrendChart history={history} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Recent Activity Mini List */}
                <div>
                  <SectionHeader title="Recent Activity" icon={ClockIcon} />
                  <div className="flow-root">
                    <ul className="-mb-4 sm:-mb-8">
                      {history.slice(0, 3).map((event, eventIdx) => (
                        <li key={event.id}>
                          <div className="relative pb-6 sm:pb-8">
                            {eventIdx !== 2 && (
                              <span className="absolute top-4 left-3 sm:left-4 -ml-px h-full w-0.5 bg-gray-200" aria-hidden="true" />
                            )}
                            <div className="relative flex space-x-3">
                              <div className={`h-7 w-7 sm:h-8 sm:w-8 rounded-full flex items-center justify-center ring-4 sm:ring-8 ring-white shrink-0 ${event.type === 'in' ? 'bg-emerald-500' : event.type === 'out' ? 'bg-red-500' : 'bg-blue-500'
                                }`}>
                                {event.type === 'in' ? <PlusIcon className="h-4 w-4 sm:h-5 sm:w-5 text-white" /> :
                                  event.type === 'out' ? <MinusIcon className="h-4 w-4 sm:h-5 sm:w-5 text-white" /> :
                                    <ArrowPathIcon className="h-4 w-4 sm:h-5 sm:w-5 text-white" />}
                              </div>
                              <div className="flex min-w-0 flex-1 justify-between space-x-2 sm:space-x-4 pt-0.5 sm:pt-1.5">
                                <div className="min-w-0 flex-1">
                                  <p className="text-xs sm:text-sm text-gray-900">
                                    <span className="font-semibold">{event.type === 'in' ? 'Stock In' : event.type === 'out' ? 'Stock Out' : 'Transfer'}</span>
                                    <span className="font-bold ml-1">{event.quantity} {product.uom || 'units'}</span>
                                  </p>
                                  <p className="text-[10px] sm:text-xs text-gray-500 truncate">{event.reason} {event.reference ? `(${event.reference})` : ''}</p>
                                </div>
                                <div className="whitespace-nowrap text-right text-[10px] sm:text-xs text-gray-500 shrink-0">
                                  <time dateTime={event.createdAt}>{new Date(event.createdAt).toLocaleDateString()}</time>
                                </div>
                              </div>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* --- HISTORY TAB --- */}
            {activeTab === 'history' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900">Transaction Log</h3>
                  <button
                    onClick={() => {
                      const exportData = history.map(h => ({
                        Type: h.type,
                        Quantity: h.quantity,
                        Balance: h.newQuantity,
                        Reason: h.reason,
                        Reference: h.reference || '',
                        Location: h.fromLoc && h.toLoc ? `${h.fromLoc} → ${h.toLoc}` : h.fromLoc || h.toLoc || '',
                        'Unit Cost': h.unitCost || '',
                        Date: new Date(h.createdAt).toLocaleString('en-GB'),
                        User: h.createdBy,
                      }))
                      downloadCSV(`product-${product.sku || product.id}-transactions.csv`, toCSV(exportData))
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                  >
                    <ArrowDownTrayIcon className="w-4 h-4" />
                    Export CSV
                  </button>
                </div>

                {/* Filters */}
                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Type</label>
                      <StyledSelect
                        value={historyFilters.type}
                        onChange={(e) => setHistoryFilters(prev => ({ ...prev, type: e.target.value as any }))}
                      >
                        <option value="all">All Types</option>
                        <option value="in">Stock In</option>
                        <option value="out">Stock Out</option>
                        <option value="transfer">Transfer</option>
                      </StyledSelect>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Date From</label>
                      <StyledInput
                        type="date"
                        value={historyFilters.dateFrom}
                        onChange={(e) => setHistoryFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Date To</label>
                      <StyledInput
                        type="date"
                        value={historyFilters.dateTo}
                        onChange={(e) => setHistoryFilters(prev => ({ ...prev, dateTo: e.target.value }))}
                      />
                    </div>
                    <div className="flex items-end">
                      <button
                        onClick={() => setHistoryFilters({ type: 'all', dateFrom: '', dateTo: '' })}
                        className="w-full px-4 py-2 text-sm text-gray-600 hover:text-gray-800 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        Clear Filters
                      </button>
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto shadow ring-1 ring-black ring-opacity-5 rounded-lg -mx-4 sm:mx-0">
                  <table className="min-w-full divide-y divide-gray-300">
                    <thead className="bg-gray-50 sticky top-0 z-10">
                      <tr>
                        <th className="py-3.5 pl-4 pr-3 text-left text-xs font-semibold text-gray-900 uppercase whitespace-nowrap">Type</th>
                        <th className="px-3 py-3.5 text-left text-xs font-semibold text-gray-900 uppercase whitespace-nowrap">Qty</th>
                        <th className="px-3 py-3.5 text-left text-xs font-semibold text-gray-900 uppercase whitespace-nowrap hidden sm:table-cell">Balance</th>
                        <th className="px-3 py-3.5 text-left text-xs font-semibold text-gray-900 uppercase whitespace-nowrap">Reason</th>
                        <th className="px-3 py-3.5 text-left text-xs font-semibold text-gray-900 uppercase whitespace-nowrap hidden md:table-cell">Reference</th>
                        <th className="px-3 py-3.5 text-left text-xs font-semibold text-gray-900 uppercase whitespace-nowrap hidden lg:table-cell">Location</th>
                        <th className="px-3 py-3.5 text-left text-xs font-semibold text-gray-900 uppercase whitespace-nowrap">Date</th>
                        <th className="px-3 py-3.5 text-left text-xs font-semibold text-gray-900 uppercase whitespace-nowrap hidden lg:table-cell">User</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                      {history.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-8 text-center text-sm text-gray-500">
                            No transactions found
                          </td>
                        </tr>
                      ) : (
                        history.map((h) => {
                          const date = new Date(h.createdAt)
                          const locationText = h.fromLoc && h.toLoc
                            ? `${groups.find(g => g.id === h.fromLoc)?.name || h.fromLoc} → ${groups.find(g => g.id === h.toLoc)?.name || h.toLoc}`
                            : h.fromLoc
                              ? `From: ${groups.find(g => g.id === h.fromLoc)?.name || h.fromLoc}`
                              : h.toLoc
                                ? `To: ${groups.find(g => g.id === h.toLoc)?.name || h.toLoc}`
                                : ''
                          return (
                            <tr key={h.id} className="hover:bg-gray-50">
                              <td className="whitespace-nowrap py-3 sm:py-4 pl-4 pr-2 sm:pr-3 text-xs sm:text-sm">
                                <span className={`inline-flex items-center rounded-full px-2 py-1 text-[10px] sm:text-xs font-medium ${h.type === 'in' ? 'bg-green-50 text-green-700' :
                                  h.type === 'out' ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'
                                  }`}>
                                  {h.type === 'in' ? 'IN' : h.type === 'out' ? 'OUT' : 'TR'}
                                </span>
                              </td>
                              <td className={`whitespace-nowrap px-2 sm:px-3 py-3 sm:py-4 text-xs sm:text-sm font-bold ${h.type === 'in' ? 'text-green-600' : 'text-red-600'}`}>
                                {h.type === 'in' ? '+' : '-'}{h.quantity}
                              </td>
                              <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 hidden sm:table-cell">{h.newQuantity}</td>
                              <td className="px-2 sm:px-3 py-3 sm:py-4 text-xs sm:text-sm text-gray-600 max-w-[120px] sm:max-w-xs truncate font-medium" title={h.reason}>{h.reason}</td>
                              <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 hidden md:table-cell">
                                {h.reference ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono bg-gray-100 text-gray-700">
                                    {h.reference}
                                  </span>
                                ) : (
                                  <span className="text-gray-400">—</span>
                                )}
                              </td>
                              <td className="px-3 py-4 text-sm text-gray-500 max-w-xs truncate hidden lg:table-cell" title={locationText}>
                                {locationText || <span className="text-gray-400">—</span>}
                              </td>
                              <td className="whitespace-nowrap px-2 sm:px-3 py-3 sm:py-4 text-xs sm:text-sm text-gray-600">
                                <div className="flex flex-col">
                                  <time dateTime={date.toISOString()} className="font-medium">{date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</time>
                                  <time className="text-[10px] text-gray-400">{date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</time>
                                </div>
                              </td>
                              <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 hidden lg:table-cell">{h.createdBy || '—'}</td>
                            </tr>
                          )
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* --- SETTINGS TAB (Refactored Forms) --- */}
            {activeTab === 'settings' && (
              <div className="space-y-8">
                {/* Basic Information */}
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                  <form onSubmit={(e) => { e.preventDefault(); genericUpdate(new FormData(e.currentTarget), 'basic') }}>
                    <SectionHeader title="Basic Information" icon={TagIcon} />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <InputGroup label="Product Name">
                        <StyledInput name="name" defaultValue={product.name} required />
                      </InputGroup>
                      <InputGroup label="SKU">
                        <StyledInput name="sku" defaultValue={product.sku} required />
                      </InputGroup>
                      <InputGroup label="Group">
                        <StyledSelect name="groupId" defaultValue={product.groupId || ''}>
                          <option value="">None</option>
                          {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                        </StyledSelect>
                      </InputGroup>
                      <InputGroup label="Status">
                        <StyledSelect name="status" defaultValue={product.status}>
                          <option value="active">Active</option>
                          <option value="inactive">Inactive</option>
                          <option value="draft">Draft</option>
                        </StyledSelect>
                      </InputGroup>
                      <InputGroup label="UOM">
                        <StyledSelect name="uom" defaultValue={product.uom}>
                          <option value="">Select...</option>
                          {uoms.map(u => <option key={u.id} value={u.symbol}>{u.symbol}</option>)}
                        </StyledSelect>
                      </InputGroup>
                    </div>
                    <div className="mt-6 flex justify-end">
                      <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors">
                        Save Basic Info
                      </button>
                    </div>
                  </form>
                </div>

                {/* Inventory Settings */}
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                  <form onSubmit={(e) => { e.preventDefault(); genericUpdate(new FormData(e.currentTarget), 'stock') }}>
                    <SectionHeader title="Inventory Settings" icon={CubeIcon} />
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      <InputGroup label="Price Per Box">
                        <StyledInput name="pricePerBox" type="number" step="0.01" defaultValue={product.pricePerBox} />
                      </InputGroup>
                      <InputGroup label="Min Level (Alert)">
                        <StyledInput name="minLevelBox" type="number" defaultValue={product.minLevelBox} />
                      </InputGroup>
                      <InputGroup label="Pcs / Box">
                        <StyledInput name="pcsPerBox" type="number" defaultValue={product.pcsPerBox} />
                      </InputGroup>
                      <InputGroup label="Reorder Point">
                        <StyledInput name="reorderPoint" type="number" defaultValue={product.reorderPoint} />
                      </InputGroup>
                      <InputGroup label="Min Stock">
                        <StyledInput name="minStock" type="number" defaultValue={product.minStock} />
                      </InputGroup>
                      <InputGroup label="Box Quantity">
                        <StyledInput name="quantityBox" type="number" defaultValue={product.quantityBox} />
                      </InputGroup>
                    </div>
                    <div className="mt-6 flex justify-end">
                      <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors">
                        Save Inventory Settings
                      </button>
                    </div>
                  </form>
                </div>

                {/* Classification */}
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                  <form onSubmit={(e) => { e.preventDefault(); genericUpdate(new FormData(e.currentTarget), 'class') }}>
                    <SectionHeader title="Classification" icon={TagIcon} />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <InputGroup label="Category">
                        <StyledSelect name="category" defaultValue={product.category || ''}>
                          <option value="">Select...</option>
                          {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                        </StyledSelect>
                      </InputGroup>
                      <InputGroup label="Subcategory">
                        <StyledSelect name="subcategory" defaultValue={product.subcategory || ''}>
                          <option value="">Select...</option>
                          {subcategories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                        </StyledSelect>
                      </InputGroup>
                    </div>
                    <div className="mt-6 flex justify-end">
                      <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors">
                        Save Classification
                      </button>
                    </div>
                  </form>
                </div>

                {/* Technical Specs */}
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                  <form onSubmit={(e) => { e.preventDefault(); genericUpdate(new FormData(e.currentTarget), 'tech') }}>
                    <SectionHeader title="Technical Specs" icon={DocumentTextIcon} />
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      <InputGroup label="Material / Series">
                        <StyledInput name="materialSeries" defaultValue={product.materialSeries} />
                      </InputGroup>
                      <InputGroup label="Board Type">
                        <StyledInput name="boardType" defaultValue={product.boardType} />
                      </InputGroup>
                      <InputGroup label="Dimensions (WxL mm)">
                        <StyledInput name="dimensionsWxLmm" defaultValue={product.dimensionsWxLmm} placeholder="615x905" />
                      </InputGroup>
                      <InputGroup label="GSM">
                        <StyledInput name="gsm" defaultValue={product.gsm} />
                      </InputGroup>
                      <InputGroup label="CAL">
                        <StyledInput name="cal" defaultValue={product.cal} />
                      </InputGroup>
                    </div>
                    <div className="mt-6 flex justify-end">
                      <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors">
                        Save Specs
                      </button>
                    </div>
                  </form>
                </div>

                {/* Images & Media */}
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                  <SectionHeader title="Images & Media" icon={PhotoIcon} />

                  {/* Main Image */}
                  <div className="mb-6">
                    <InputGroup label="Main Product Image">
                      <div className="space-y-4">
                        {product.imageUrl && (
                          <div className="relative inline-block">
                            <img
                              src={product.imageUrl}
                              alt={product.name}
                              className="w-32 h-32 object-cover rounded-lg border border-gray-200"
                            />
                            <button
                              type="button"
                              onClick={async () => {
                                if (!confirm('Delete main image?') || !workspaceId) return
                                try {
                                  await updateProduct(workspaceId, product.id, { imageUrl: null } as any)
                                  onSaved?.()
                                } catch (e) {
                                  alert('Failed to delete image')
                                }
                              }}
                              className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                            >
                              <XMarkIcon className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                        <div>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                              const file = e.target.files?.[0]
                              if (file) {
                                setMainImageFile(file)
                                // Preview
                                const reader = new FileReader()
                                reader.onload = (e) => {
                                  setSelectedImage(e.target?.result as string)
                                }
                                reader.readAsDataURL(file)
                              }
                            }}
                            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                          />
                          {mainImageFile && (
                            <p className="mt-2 text-sm text-gray-600">Selected: {mainImageFile.name}</p>
                          )}
                        </div>
                      </div>
                    </InputGroup>
                  </div>

                  {/* Gallery Images */}
                  <div>
                    <InputGroup label="Gallery Images">
                      <div className="space-y-4">
                        {Array.isArray(product.galleryUrls) && product.galleryUrls.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {product.galleryUrls.map((url, idx) => (
                              <div key={idx} className="relative">
                                <img
                                  src={url}
                                  alt={`Gallery ${idx + 1}`}
                                  className="w-24 h-24 object-cover rounded-lg border border-gray-200"
                                />
                                <button
                                  type="button"
                                  onClick={async () => {
                                    if (!confirm('Delete this gallery image?') || !workspaceId) return
                                    try {
                                      const updated = [...(product.galleryUrls || [])]
                                      updated.splice(idx, 1)
                                      await updateProduct(workspaceId, product.id, { galleryUrls: updated.length > 0 ? updated : [] } as any)
                                      onSaved?.()
                                    } catch (e) {
                                      alert('Failed to delete image')
                                    }
                                  }}
                                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                                >
                                  <XMarkIcon className="w-3 h-3" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                        <div>
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            onChange={(e) => {
                              const files = Array.from(e.target.files || [])
                              if (files.length > 0) {
                                setGalleryImageFiles(prev => [...prev, ...files])
                              }
                            }}
                            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                          />
                          {galleryImageFiles.length > 0 && (
                            <div className="mt-2 space-y-1">
                              {galleryImageFiles.map((file, idx) => (
                                <div key={idx} className="flex items-center justify-between text-sm text-gray-600 bg-gray-50 px-2 py-1 rounded">
                                  <span>{file.name}</span>
                                  <button
                                    type="button"
                                    onClick={() => setGalleryImageFiles(prev => prev.filter((_, i) => i !== idx))}
                                    className="text-red-600 hover:text-red-800"
                                  >
                                    <XMarkIcon className="w-4 h-4" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </InputGroup>
                  </div>

                  <div className="mt-6 flex justify-end">
                    <button
                      type="button"
                      onClick={async () => {
                        if (!mainImageFile && galleryImageFiles.length === 0) {
                          alert('Please select at least one image to upload')
                          return
                        }

                        if (!workspaceId) return
                        setUploadingImages(true)
                        try {
                          await updateProduct(workspaceId, product.id, {
                            imageFile: mainImageFile || undefined,
                            imageFiles: galleryImageFiles.length > 0 ? galleryImageFiles : undefined,
                          })
                          setMainImageFile(null)
                          setGalleryImageFiles([])
                          onSaved?.()
                        } catch (e) {
                          alert('Failed to upload images: ' + (e instanceof Error ? e.message : 'Unknown error'))
                        } finally {
                          setUploadingImages(false)
                        }
                      }}
                      disabled={uploadingImages || (!mainImageFile && galleryImageFiles.length === 0)}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {uploadingImages ? (
                        <>
                          <ArrowPathIcon className="w-4 h-4 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <PhotoIcon className="w-4 h-4" />
                          Upload Images
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Tags & Notes */}
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                  <form onSubmit={(e) => { e.preventDefault(); genericUpdate(new FormData(e.currentTarget), 'tags') }}>
                    <SectionHeader title="Tags & Notes" icon={TagIcon} />
                    <div className="grid grid-cols-1 gap-4">
                      <InputGroup label="Tags (comma separated)">
                        <StyledInput name="tags" defaultValue={(product.tags || []).join(', ')} placeholder="tag1, tag2, tag3" />
                      </InputGroup>
                      <InputGroup label="Notes">
                        <textarea
                          name="notes"
                          defaultValue={product.notes || ''}
                          rows={4}
                          className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-200 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                          placeholder="Product notes..."
                        />
                      </InputGroup>
                    </div>
                    <div className="mt-6 flex justify-end">
                      <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors">
                        Save Tags & Notes
                      </button>
                    </div>
                  </form>
                </div>

                {/* Custom Fields */}
                {customFields.length > 0 && (
                  <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <form onSubmit={(e) => { e.preventDefault(); genericUpdate(new FormData(e.currentTarget), 'custom') }}>
                      <SectionHeader title="Custom Fields" icon={DocumentTextIcon} />
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {customFields.map((field) => (
                          <div key={field.id}>
                            <InputGroup label={field.name + (field.required ? ' *' : '')}>
                              {field.type === 'text' && (
                                <StyledInput
                                  name={`custom_${field.id}`}
                                  defaultValue={(product as any)[`custom_${field.id}`] || ''}
                                  required={field.required}
                                />
                              )}
                              {field.type === 'number' && (
                                <StyledInput
                                  type="number"
                                  name={`custom_${field.id}`}
                                  defaultValue={(product as any)[`custom_${field.id}`] || ''}
                                  required={field.required}
                                />
                              )}
                              {field.type === 'date' && (
                                <StyledInput
                                  type="date"
                                  name={`custom_${field.id}`}
                                  defaultValue={(product as any)[`custom_${field.id}`] || ''}
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
                                <StyledSelect
                                  name={`custom_${field.id}`}
                                  defaultValue={(product as any)[`custom_${field.id}`] || ''}
                                  required={field.required}
                                >
                                  <option value="">Select {field.name}</option>
                                  {field.options?.map((option: string, index: number) => (
                                    <option key={index} value={option}>
                                      {option}
                                    </option>
                                  ))}
                                </StyledSelect>
                              )}
                            </InputGroup>
                          </div>
                        ))}
                      </div>
                      <div className="mt-6 flex justify-end">
                        <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors">
                          Save Custom Fields
                        </button>
                      </div>
                    </form>
                  </div>
                )}
              </div>
            )}

            {/* --- TICKETS TAB --- */}
            {activeTab === 'tickets' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">Product Tickets</h3>
                    <p className="text-sm text-gray-600 mt-1">Manage issues and tasks related to this product</p>
                  </div>
                  <button
                    onClick={() => setShowCreateTicket(true)}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                  >
                    <PlusIcon className="w-4 h-4" />
                    New Ticket
                  </button>
                </div>

                {ticketsLoading ? (
                  <div className="flex justify-center items-center py-12">
                    <ArrowPathIcon className="w-8 h-8 animate-spin text-blue-600" />
                  </div>
                ) : tickets.length === 0 ? (
                  <div className="text-center py-12 bg-white rounded-lg border border-gray-200 shadow-sm">
                    <ArchiveBoxIcon className="mx-auto h-12 w-12 text-gray-400" />
                    <h3 className="mt-2 text-sm font-medium text-gray-900">No tickets</h3>
                    <p className="mt-1 text-sm text-gray-500">Get started by creating a new ticket.</p>
                  </div>
                ) : (
                  <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Due Date</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {tickets.map((ticket) => {
                            const dueDate = ticket.dueDate ? (ticket.dueDate instanceof Date ? ticket.dueDate : (ticket.dueDate as any)?.toDate?.() || new Date(ticket.dueDate)) : null
                            const createdAt = ticket.createdAt ? ((ticket.createdAt as any)?.toDate?.() || new Date(ticket.createdAt)) : new Date()
                            return (
                              <tr key={ticket.id} className="hover:bg-gray-50 transition-colors">
                                <td className="px-6 py-4">
                                  <div>
                                    <div className="text-sm font-medium text-gray-900">{ticket.title}</div>
                                    {ticket.description && (
                                      <div className="text-sm text-gray-500 truncate max-w-md mt-1">{ticket.description}</div>
                                    )}
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${ticket.status === 'open' ? 'bg-gray-100 text-gray-800' :
                                    ticket.status === 'in_progress' ? 'bg-amber-100 text-amber-800' :
                                      ticket.status === 'done' ? 'bg-green-100 text-green-800' :
                                        'bg-red-100 text-red-800'
                                    }`}>
                                    {ticket.status.replace('_', ' ').toUpperCase()}
                                  </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                  {dueDate ? dueDate.toLocaleDateString('en-GB') : <span className="text-gray-400">—</span>}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {createdAt.toLocaleDateString('en-GB')}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                  <div className="flex items-center justify-end gap-2">
                                    <button
                                      onClick={() => setSelectedTicket(ticket)}
                                      className="text-blue-600 hover:text-blue-900"
                                      title="Edit"
                                    >
                                      <PencilIcon className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={async () => {
                                        if (!confirm('Are you sure you want to delete this ticket?')) return
                                        if (!workspaceId) return
                                        try {
                                          await deleteProductTicket(workspaceId, product.id, ticket.id)
                                          refetchTickets()
                                          onSaved?.()
                                        } catch (e) {
                                          alert('Failed to delete ticket: ' + (e instanceof Error ? e.message : 'Unknown error'))
                                        }
                                      }}
                                      className="text-red-600 hover:text-red-900"
                                      title="Delete"
                                    >
                                      <TrashIcon className="w-4 h-4" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* --- QR TAB --- */}
            {activeTab === 'qr' && (
              <div className="max-w-2xl mx-auto py-8">
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                  <div className="p-8 flex flex-col items-center justify-center border-b border-gray-100 bg-gray-50/50">
                    {qrData.localUrl || qrData.remoteUrl ? (
                      <img src={qrData.localUrl || qrData.remoteUrl || ''} className="w-64 h-64 object-contain bg-white p-4 rounded-xl shadow-sm border border-gray-100" />
                    ) : (
                      <div className="w-64 h-64 bg-gray-100 rounded-xl flex items-center justify-center text-gray-400 border border-dashed border-gray-300">
                        No QR Code
                      </div>
                    )}
                  </div>
                  <div className="p-6 bg-white">
                    <div className="space-y-3">
                      {/* Action Buttons */}
                      <div className="grid grid-cols-2 gap-4">
                        {!qrData.remoteUrl && (
                          <button
                            onClick={() => handleQR('generate')}
                            disabled={qrData.busy}
                            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            {qrData.busy ? (
                              <>
                                <ArrowPathIcon className="w-4 h-4 animate-spin" />
                                Generating...
                              </>
                            ) : (
                              <>
                                <QrCodeIcon className="w-4 h-4" />
                                Generate QR Code
                              </>
                            )}
                          </button>
                        )}

                        {qrData.localUrl && !qrData.remoteUrl && (
                          <button
                            onClick={() => handleQR('save')}
                            disabled={qrData.busy}
                            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            {qrData.busy ? (
                              <>
                                <ArrowPathIcon className="w-4 h-4 animate-spin" />
                                Saving...
                              </>
                            ) : (
                              <>
                                <CheckCircleIcon className="w-4 h-4" />
                                Save to System
                              </>
                            )}
                          </button>
                        )}

                        {(qrData.localUrl || qrData.remoteUrl) && (
                          <button
                            onClick={() => handleQR('download')}
                            disabled={qrData.busy}
                            className="flex items-center justify-center gap-2 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            <ArrowDownTrayIcon className="w-4 h-4" />
                            Download PNG
                          </button>
                        )}

                        {qrData.remoteUrl && (
                          <button
                            onClick={() => handleQR('delete')}
                            disabled={qrData.busy}
                            className="flex items-center justify-center gap-2 px-4 py-2.5 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            {qrData.busy ? (
                              <>
                                <ArrowPathIcon className="w-4 h-4 animate-spin" />
                                Deleting...
                              </>
                            ) : (
                              <>
                                <XMarkIcon className="w-4 h-4" />
                                Delete QR
                              </>
                            )}
                          </button>
                        )}
                      </div>

                      {/* QR Code Info */}
                      {qrData.info && (
                        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                          <p className="text-xs text-blue-700">
                            <span className="font-medium">Encoded:</span> {qrData.info.text}
                          </p>
                          <p className="text-xs text-blue-600 mt-1">
                            Size: {qrData.info.size}px
                          </p>
                        </div>
                      )}

                      {/* Error Display */}
                      {qrData.error && (
                        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                          <div className="flex items-start gap-2">
                            <ExclamationTriangleIcon className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                            <div>
                              <p className="text-sm font-medium text-red-900">Error</p>
                              <p className="text-sm text-red-700 mt-1">{qrData.error}</p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Status Info */}
                      {qrData.remoteUrl && (
                        <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                          <div className="flex items-center gap-2">
                            <CheckCircleIcon className="w-5 h-5 text-emerald-600" />
                            <p className="text-sm text-emerald-700">
                              QR code is saved and linked to this product
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Full Screen Image Modal */}
      {imageModal && (
        <div className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-4" onClick={() => setImageModal(null)}>
          <img src={imageModal} className="max-w-full max-h-full rounded-lg shadow-2xl" alt={product.name} />
          <button
            className="absolute top-4 right-4 text-white hover:text-gray-300"
            onClick={() => setImageModal(null)}
          >
            <XMarkIcon className="w-8 h-8" />
          </button>
        </div>
      )}

      {/* Create Ticket Modal */}
      {showCreateTicket && (
        <CreateTicketModal
          product={product}
          onSubmit={async (data) => {
            if (!workspaceId) return
            try {
              await createProductTicket(workspaceId, product.id, data)
              setShowCreateTicket(false)
              refetchTickets()
              onSaved?.()
            } catch (e) {
              alert('Failed to create ticket: ' + (e instanceof Error ? e.message : 'Unknown error'))
            }
          }}
          onClose={() => setShowCreateTicket(false)}
          isLoading={false}
        />
      )}

      {/* Edit Ticket Modal */}
      {selectedTicket && (
        <EditTicketModal
          product={product}
          ticket={selectedTicket}
          onSubmit={async (data) => {
            if (!workspaceId) return
            try {
              await updateProductTicket(workspaceId, product.id, selectedTicket.id, data)
              setSelectedTicket(null)
              refetchTickets()
              onSaved?.()
            } catch (e) {
              alert('Failed to update ticket: ' + (e instanceof Error ? e.message : 'Unknown error'))
            }
          }}
          onClose={() => setSelectedTicket(null)}
          onDelete={async () => {
            if (!workspaceId) return
            if (!confirm('Are you sure you want to delete this ticket?')) return
            try {
              await deleteProductTicket(workspaceId, product.id, selectedTicket.id)
              setSelectedTicket(null)
              refetchTickets()
              onSaved?.()
            } catch (e) {
              alert('Failed to delete ticket: ' + (e instanceof Error ? e.message : 'Unknown error'))
            }
          }}
          isLoading={false}
        />
      )}
    </div>
  )
}

// Ticket Modal Components
interface CreateTicketModalProps {
  product: Product
  onSubmit: (data: Omit<Ticket, 'id' | 'createdAt' | 'updatedAt'>) => void
  onClose: () => void
  isLoading: boolean
}

const CreateTicketModal: React.FC<CreateTicketModalProps> = ({ product, onSubmit, onClose, isLoading }) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    assignees: [] as string[],
    status: 'open' as const,
    dueDate: '',
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit({
      ...formData,
      dueDate: formData.dueDate ? new Date(formData.dueDate) : undefined,
      attachments: [],
    })
  }

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Create Ticket</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
            <StyledInput
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
              placeholder="Enter ticket title"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-200 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
              rows={3}
              placeholder="Enter ticket description"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <StyledSelect
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
            >
              <option value="open">Open</option>
              <option value="in_progress">In Progress</option>
              <option value="done">Done</option>
              <option value="cancelled">Cancelled</option>
            </StyledSelect>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
            <StyledInput
              type="date"
              value={formData.dueDate}
              onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
            />
          </div>
          <div className="flex gap-2 pt-4">
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {isLoading ? 'Creating...' : 'Create Ticket'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

interface EditTicketModalProps {
  product: Product
  ticket: Ticket
  onSubmit: (data: Partial<Omit<Ticket, 'id' | 'createdAt' | 'updatedAt'>>) => void
  onClose: () => void
  onDelete: () => void
  isLoading: boolean
}

const EditTicketModal: React.FC<EditTicketModalProps> = ({ ticket, onSubmit, onClose, onDelete, isLoading }) => {
  const dueDate = ticket.dueDate ? (ticket.dueDate instanceof Date ? ticket.dueDate : (ticket.dueDate as any)?.toDate?.() || new Date(ticket.dueDate)) : null
  const [formData, setFormData] = useState({
    title: ticket.title,
    description: ticket.description || '',
    status: ticket.status,
    dueDate: dueDate ? dueDate.toISOString().split('T')[0] : '',
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit({
      ...formData,
      dueDate: formData.dueDate ? new Date(formData.dueDate) : undefined,
    })
  }

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Edit Ticket</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
            <StyledInput
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-200 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
              rows={3}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <StyledSelect
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
            >
              <option value="open">Open</option>
              <option value="in_progress">In Progress</option>
              <option value="done">Done</option>
              <option value="cancelled">Cancelled</option>
            </StyledSelect>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
            <StyledInput
              type="date"
              value={formData.dueDate}
              onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
            />
          </div>
          <div className="flex gap-2 pt-4">
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {isLoading ? 'Saving...' : 'Save Changes'}
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              <TrashIcon className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
