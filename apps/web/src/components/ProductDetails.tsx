import { 
  XMarkIcon, 
  PlusIcon,
  MinusIcon,
  ArrowPathIcon,
  DocumentTextIcon,
  ClockIcon,
  UserIcon,
  ChartBarIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline'

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
}

interface Props {
  product: Product
  onClose: () => void
  onSave?: (adjustments: StockAdjustment[]) => void
}

export function ProductDetails({ product, onClose, onSave }: Props) {
  const [activeTab, setActiveTab] = useState<'adjust' | 'history' | 'analytics'>('adjust')
  const [adjustmentType, setAdjustmentType] = useState<'in' | 'out' | 'transfer' | 'adjustment'>('in')
  const [quantity, setQuantity] = useState('')
  const [reason, setReason] = useState('')
  const [notes, setNotes] = useState('')
  const [reference, setReference] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Mock data for history and analytics
  const stockHistory: StockAdjustment[] = [
    {
      id: '1',
      type: 'in',
      quantity: 50,
      previousQuantity: 100,
      newQuantity: 150,
      reason: 'Purchase Order #PO-1234',
      notes: 'New stock received from supplier',
      createdAt: '2024-01-15T10:30:00Z',
      createdBy: 'John Doe',
      reference: 'PO-1234'
    },
    {
      id: '2',
      type: 'out',
      quantity: 25,
      previousQuantity: 150,
      newQuantity: 125,
      reason: 'Sales Order #SO-5678',
      notes: 'Shipped to customer',
      createdAt: '2024-01-14T14:20:00Z',
      createdBy: 'Jane Smith',
      reference: 'SO-5678'
    }
  ]

  const analytics = {
    monthlyMovements: 245,
    stockTurnover: 3.2,
    averageStock: 89,
    stockOutEvents: 2,
    reorderSuggestions: 1
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!quantity || !reason) return

    setIsSubmitting(true)
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // Here you would typically call onSave with the adjustment data
    setIsSubmitting(false)
    // onClose() or show success message
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
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 bg-white">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <h3 className="text-xl font-bold text-gray-900 truncate">Stok Yönetimi</h3>
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

        <div className="flex flex-col h-[calc(90vh-80px)]">
          {/* Tabs */}
          <div className="border-b border-gray-200 bg-white">
            <nav className="flex -mb-px">
              <button
                onClick={() => setActiveTab('adjust')}
                className={`flex-1 py-4 px-6 text-center font-medium text-sm border-b-2 transition-colors ${
                  activeTab === 'adjust'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <PlusIcon className="h-4 w-4 inline mr-2" />
                Stok Düzenle
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
                Geçmiş
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
                Analiz
              </button>
            </nav>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-hidden">
            {activeTab === 'adjust' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 h-full">
                {/* Left: Current Stock Info */}
                <div className="lg:col-span-1 p-6 border-r border-gray-200 bg-gray-50">
                  <h4 className="text-lg font-semibold text-gray-900 mb-4">Mevcut Stok</h4>
                  
                  <div className="space-y-4">
                    <div className="bg-white rounded-lg border border-gray-200 p-4">
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-sm font-medium text-gray-700">Kutu Miktarı</span>
                        <span className="text-2xl font-bold text-gray-900">{product.quantityBox}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-green-500 h-2 rounded-full transition-all duration-300"
                          style={{ 
                            width: `${Math.min((product.quantityBox / (product.minLevelBox * 2)) * 100, 100)}%` 
                          }}
                        ></div>
                      </div>
                      <div className="flex justify-between text-xs text-gray-500 mt-1">
                        <span>0</span>
                        <span>Min: {product.minLevelBox}</span>
                        <span>{product.minLevelBox * 2}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-white rounded-lg border border-gray-200 p-4">
                        <p className="text-sm text-gray-600">Minimum Seviye</p>
                        <p className="text-lg font-semibold text-gray-900">{product.minLevelBox}</p>
                      </div>
                      <div className="bg-white rounded-lg border border-gray-200 p-4">
                        <p className="text-sm text-gray-600">Toplam Değer</p>
                        <p className="text-lg font-semibold text-gray-900">£{product.totalValue.toFixed(2)}</p>
                      </div>
                    </div>

                    {product.quantityBox <= product.minLevelBox && (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                        <div className="flex items-center gap-2">
                          <ExclamationTriangleIcon className="h-5 w-5 text-amber-600" />
                          <span className="text-sm font-medium text-amber-800">Düşük Stok Uyarısı</span>
                        </div>
                        <p className="text-xs text-amber-700 mt-1">
                          Stok seviyesi minimumun altında. Yeniden sipariş önerilir.
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right: Adjustment Form */}
                <div className="lg:col-span-2 p-6">
                  <h4 className="text-lg font-semibold text-gray-900 mb-6">Stok İşlemi</h4>
                  
                  <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Adjustment Type */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-3">İşlem Türü</label>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {[
                          { value: 'in', label: 'Stok Girişi', icon: PlusIcon, color: 'green' },
                          { value: 'out', label: 'Stok Çıkışı', icon: MinusIcon, color: 'red' },
                          { value: 'transfer', label: 'Transfer', icon: ArrowPathIcon, color: 'blue' },
                          { value: 'adjustment', label: 'Düzeltme', icon: DocumentTextIcon, color: 'gray' }
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
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label htmlFor="quantity" className="block text-sm font-medium text-gray-700 mb-2">
                          Miktar *
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

                      <div>
                        <label htmlFor="reference" className="block text-sm font-medium text-gray-700 mb-2">
                          Referans No
                        </label>
                        <input
                          type="text"
                          id="reference"
                          value={reference}
                          onChange={(e) => setReference(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="PO-1234, SO-5678, etc."
                        />
                      </div>
                    </div>

                    {/* Reason */}
                    <div>
                      <label htmlFor="reason" className="block text-sm font-medium text-gray-700 mb-2">
                        Sebep *
                      </label>
                      <select
                        id="reason"
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        required
                      >
                        <option value="">Sebep seçin</option>
                        <option value="purchase">Satın Alma</option>
                        <option value="sale">Satış</option>
                        <option value="return">İade</option>
                        <option value="damaged">Hasarlı Ürün</option>
                        <option value="count_adjustment">Sayım Düzeltme</option>
                        <option value="transfer">Depo Transferi</option>
                        <option value="other">Diğer</option>
                      </select>
                    </div>

                    {/* Notes */}
                    <div>
                      <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-2">
                        Notlar
                      </label>
                      <textarea
                        id="notes"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="İşlem hakkında notlar..."
                      />
                    </div>

                    {/* Preview */}
                    {quantity && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <h5 className="text-sm font-medium text-blue-900 mb-2">Önizleme</h5>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-blue-700">Mevcut Stok:</span>
                          <span className="font-medium">{product.quantityBox}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-blue-700">Değişim:</span>
                          <span className={`font-medium ${
                            adjustmentType === 'in' ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {adjustmentType === 'in' ? '+' : '-'}{quantity}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-sm font-medium">
                          <span className="text-blue-900">Yeni Stok:</span>
                          <span className="text-blue-900">
                            {adjustmentType === 'in' 
                              ? product.quantityBox + Number(quantity)
                              : product.quantityBox - Number(quantity)
                            }
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
                      <button
                        type="button"
                        onClick={onClose}
                        className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors font-medium"
                      >
                        İptal
                      </button>
                      <button
                        type="submit"
                        disabled={isSubmitting || !quantity || !reason}
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium flex items-center"
                      >
                        {isSubmitting ? (
                          <>
                            <ArrowPathIcon className="animate-spin h-4 w-4 mr-2" />
                            Kaydediliyor...
                          </>
                        ) : (
                          'Stok Güncelle'
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {activeTab === 'history' && (
              <div className="p-6 h-full overflow-y-auto">
                <h4 className="text-lg font-semibold text-gray-900 mb-6">Stok Geçmişi</h4>
                
                <div className="space-y-4">
                  {stockHistory.map((record) => (
                    <div key={record.id} className="bg-white border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg border ${getAdjustmentColor(record.type)}`}>
                            {getAdjustmentIcon(record.type)}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{record.reason}</p>
                            <p className="text-sm text-gray-500">{record.reference}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`text-lg font-bold ${
                            record.type === 'in' ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {record.type === 'in' ? '+' : '-'}{record.quantity}
                          </p>
                          <p className="text-xs text-gray-500">
                            {new Date(record.createdAt).toLocaleDateString('tr-TR')}
                          </p>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-4 text-sm text-gray-600 mt-3">
                        <div>
                          <span className="font-medium">Önceki:</span> {record.previousQuantity}
                        </div>
                        <div>
                          <span className="font-medium">Sonraki:</span> {record.newQuantity}
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
              <div className="p-6 h-full overflow-y-auto">
                <h4 className="text-lg font-semibold text-gray-900 mb-6">Stok Analizi</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                  <div className="bg-white border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <ArrowPathIcon className="h-6 w-6 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Aylık Hareket</p>
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
                        <p className="text-sm text-gray-600">Stok Devir Hızı</p>
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
                        <p className="text-sm text-gray-600">Stok Tükenme</p>
                        <p className="text-2xl font-bold text-gray-900">{analytics.stockOutEvents}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Stock Level Chart Placeholder */}
                <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
                  <h5 className="font-medium text-gray-900 mb-4">Stok Seviyesi Trendi</h5>
                  <div className="h-48 bg-gray-50 rounded-lg flex items-center justify-center">
                    <p className="text-gray-500">Stok seviyesi grafiği burada gösterilecek</p>
                  </div>
                </div>

                {/* Recommendations */}
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <h5 className="font-medium text-amber-900 mb-2">Öneriler</h5>
                  <ul className="text-sm text-amber-800 space-y-1">
                    <li>• Stok seviyesi minimuma yaklaştı, yeniden sipariş verin</li>
                    <li>• Son 30 günde 2 kez stok tükenmesi yaşanmış</li>
                    <li>• Ortalama stok devir hızı: {analytics.stockTurnover}</li>
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}