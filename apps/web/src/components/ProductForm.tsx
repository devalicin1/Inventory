import { useEffect, useState } from 'react'
import { createProduct, updateProduct, type ProductInput, type Group } from '../api/products'
import { listCustomFields, type CustomField } from '../api/settings'
import { LABEL_SIZES, PAPER_SIZES, generateBarcodeDataURL, type LabelSize, type PaperSize, type BarcodeOptions } from '../utils/barcode'

interface Props {
  workspaceId: string
  groups: Group[]
  onCreated: () => void
  onClose: () => void
  // Optional editing props
  productId?: string
  initialValues?: Partial<ProductInput> & { name?: string; sku?: string }
}

export function ProductForm({ workspaceId, groups, onCreated, onClose, productId, initialValues }: Props) {
  const [form, setForm] = useState<ProductInput>({
    name: '',
    sku: '',
    uom: 'pcs',
    minStock: 0,
    reorderPoint: 0,
    status: 'active',
    groupId: undefined,
    imageFile: null,
    imageFiles: null,
    quantityBox: 0,
    minLevelBox: 0,
    pricePerBox: 0,
    pcsPerBox: 0,
    category: '',
    subcategory: '',
    materialSeries: '',
    boardType: '',
    gsm: '',
    dimensionsWxLmm: '',
    cal: '',
    tags: [],
    notes: '',
  })
  // Prefill when editing
  useEffect(() => {
    if (initialValues) {
      setForm((f) => ({
        ...f,
        ...(initialValues as any),
      }))
    }
  }, [initialValues])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [primaryPreview, setPrimaryPreview] = useState<string | null>(null)
  const [galleryPreviews, setGalleryPreviews] = useState<string[]>([])
  const [expandedSections, setExpandedSections] = useState({
    classification: false,
    technical: false,
    tagsAndNotes: false,
    barcode: false,
  })
  
  // Barcode options
  const [generateBarcode, setGenerateBarcode] = useState(true)
  const [barcodeOptions, setBarcodeOptions] = useState<BarcodeOptions>({
    format: 'CODE128',
    labelSize: '100x50',
    paperSize: 'A4',
    showText: true,
    content: {
      includeSKU: true,
      includeProductName: true,
      includePrice: false,
      includeCategory: false,
    },
  })
  
  // Barcode preview state
  const [barcodePreview, setBarcodePreview] = useState<{
    dataUrl: string | null
    busy: boolean
    error: string | null
  }>({
    dataUrl: null,
    busy: false,
    error: null,
  })

  // Custom fields for selected group
  const [customFields, setCustomFields] = useState<CustomField[]>([])
  const [customValues, setCustomValues] = useState<Record<string, any>>({})

  // Load custom fields for selected group or global when group changes
  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!workspaceId) return
      try {
        const all = await listCustomFields(workspaceId)
        const filtered = all.filter(f => f.active && (!f.groupId || f.groupId === (form.groupId || '')))
        if (cancelled) return
        setCustomFields(filtered)
      } catch (e) {
        // silent
      }
    }
    load()
    return () => { cancelled = true }
  }, [workspaceId, form.groupId])

  // Auto-generate barcode preview when options or form data changes (only when barcode section is expanded) - TEMPORARILY DISABLED
  useEffect(() => {
    // Temporarily disabled
    return
    // if (!expandedSections.barcode || !generateBarcode) return
    // if (!form.sku && !form.name) return // Need at least SKU or name

    // let cancelled = false
    // const timeoutId = setTimeout(async () => {
    //   try {
    //     setBarcodePreview(prev => ({ ...prev, busy: true, error: null }))
    //     const sku = form.sku || 'PREVIEW'
    //     const groupName = form.groupId ? groups.find(g => g.id === form.groupId)?.name : undefined
    //     const options: BarcodeOptions = {
    //       ...barcodeOptions,
    //       productData: {
    //         sku: form.sku || 'PREVIEW',
    //         name: form.name || 'Product Name',
    //         price: form.pricePerBox,
    //         category: form.category,
    //         subcategory: form.subcategory,
    //         uom: form.uom,
    //         quantityBox: form.quantityBox,
    //         pcsPerBox: form.pcsPerBox,
    //         materialSeries: form.materialSeries,
    //         boardType: form.boardType,
    //         gsm: form.gsm,
    //         dimensionsWxLmm: form.dimensionsWxLmm,
    //         cal: form.cal,
    //         minStock: form.minStock,
    //         reorderPoint: form.reorderPoint,
    //         minLevelBox: form.minLevelBox,
    //         status: form.status,
    //         groupName: groupName,
    //         tags: form.tags,
    //         notes: form.notes,
    //       },
    //     }
    //     const res = await generateBarcodeDataURL(sku, options)
    //     if (!cancelled) {
    //       setBarcodePreview(prev => ({ ...prev, dataUrl: res.dataUrl, busy: false }))
    //     }
    //   } catch (e: any) {
    //     if (!cancelled) {
    //       setBarcodePreview(prev => ({ ...prev, error: e?.message || 'Failed to generate preview', busy: false }))
    //     }
    //   }
    // }, 500) // Debounce 500ms

    // return () => {
    //   cancelled = true
    //   clearTimeout(timeoutId)
    // }
  }, [expandedSections.barcode, generateBarcode, barcodeOptions, form, groups])

  const handleChange = (key: keyof ProductInput, value: any) => {
    setForm((f) => ({ ...f, [key]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      // merge custom values and barcode options
      const payload: any = { 
        ...form, 
        ...customValues,
        generateBarcode,
        barcodeOptions: generateBarcode ? barcodeOptions : undefined,
      }
      if (productId) {
        await updateProduct(workspaceId, productId, payload)
      } else {
        await createProduct(workspaceId, payload)
      }
      onCreated()
      onClose()
    } catch (err: any) {
      setError(err?.message || (productId ? 'Failed to update product' : 'Failed to create product'))
    } finally {
      setSubmitting(false)
    }
  }

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }))
  }

  const totalValue = (form.quantityBox || 0) * (form.pricePerBox || 0)

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-start justify-center p-2 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-7xl my-4 max-h-[95vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-white">
          <div>
            <h3 className="text-xl font-bold text-gray-900">{productId ? 'Edit Product' : 'Add New Product'}</h3>
            <p className="text-sm text-gray-600 mt-1">QR code will be generated automatically.</p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 xl:grid-cols-5">
              {/* Left Panel - Form Fields */}
              <div className="xl:col-span-4 p-6 overflow-y-auto">
                <div className="space-y-6">
                  {/* Basic Information Section */}
                  <section className="bg-white rounded-lg border border-gray-200 p-6">
                    <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                      <svg className="w-5 h-5 text-blue-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Basic Information
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Product Name *</label>
                        <input
                          value={form.name}
                          onChange={(e) => handleChange('name', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                          placeholder="Enter product name"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">SKU *</label>
                        <input
                          value={form.sku}
                          onChange={(e) => handleChange('sku', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                          placeholder="Enter SKU code"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Group</label>
                        <select
                          value={form.groupId || ''}
                          onChange={(e) => handleChange('groupId', e.target.value || null)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                        >
                          <option value="">Select group</option>
                          {groups.map((g) => (
                            <option key={g.id} value={g.id}>{g.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                        <select
                          value={form.status}
                          onChange={(e) => handleChange('status', e.target.value as any)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                        >
                          <option value="active">Active</option>
                          <option value="inactive">Inactive</option>
                        </select>
                      </div>
                    </div>
                  </section>

                  {/* Custom Fields (depends on selected group) */}
                  {customFields.length > 0 && (
                    <section className="bg-white rounded-lg border border-gray-200 p-6">
                      <h4 className="text-lg font-semibold text-gray-900 mb-4">Custom Fields</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {customFields.map((field) => (
                          <div key={field.id}>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              {field.name} {field.required && '*'}
                            </label>
                            {field.type === 'text' && (
                              <input
                                value={customValues[`custom_${field.id}`] || ''}
                                onChange={(e) => setCustomValues(v => ({ ...v, [`custom_${field.id}`]: e.target.value }))}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                required={field.required}
                              />
                            )}
                            {field.type === 'number' && (
                              <input
                                type="number"
                                value={customValues[`custom_${field.id}`] ?? ''}
                                onChange={(e) => setCustomValues(v => ({ ...v, [`custom_${field.id}`]: e.target.value === '' ? '' : Number(e.target.value) }))}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                required={field.required}
                              />
                            )}
                            {field.type === 'date' && (
                              <input
                                type="date"
                                value={customValues[`custom_${field.id}`] || ''}
                                onChange={(e) => setCustomValues(v => ({ ...v, [`custom_${field.id}`]: e.target.value }))}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                required={field.required}
                              />
                            )}
                            {field.type === 'boolean' && (
                              <div className="flex items-center">
                                <input
                                  type="checkbox"
                                  checked={Boolean(customValues[`custom_${field.id}`])}
                                  onChange={(e) => setCustomValues(v => ({ ...v, [`custom_${field.id}`]: e.target.checked }))}
                                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                />
                                <label className="ml-2 text-sm text-gray-700">Yes</label>
                              </div>
                            )}
                            {field.type === 'select' && (
                              <select
                                value={customValues[`custom_${field.id}`] || ''}
                                onChange={(e) => setCustomValues(v => ({ ...v, [`custom_${field.id}`]: e.target.value }))}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                required={field.required}
                              >
                                <option value="">Select {field.name}</option>
                                {(field.options || []).map((opt, idx) => (
                                  <option key={idx} value={opt}>{opt}</option>
                                ))}
                              </select>
                            )}
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {/* Inventory & Pricing Section */}
                  <section className="bg-white rounded-lg border border-gray-200 p-6">
                    <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                      <svg className="w-5 h-5 text-green-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Stock and Pricing Information
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Price Per Box (£)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={form.pricePerBox}
                          onChange={(e) => handleChange('pricePerBox', Number(e.target.value))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                          min={0}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Box Quantity</label>
                        <input
                          type="number"
                          value={form.quantityBox}
                          onChange={(e) => handleChange('quantityBox', Number(e.target.value))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                          min={0}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Pieces Per Box</label>
                        <input
                          type="number"
                          value={form.pcsPerBox}
                          onChange={(e) => handleChange('pcsPerBox', Number(e.target.value))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                          min={0}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Unit of Measure</label>
                        <input
                          value={form.uom}
                          onChange={(e) => handleChange('uom', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                          placeholder="pcs, kg, m"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Minimum Stock</label>
                        <input
                          type="number"
                          value={form.minStock}
                          onChange={(e) => handleChange('minStock', Number(e.target.value))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                          min={0}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Reorder Point</label>
                        <input
                          type="number"
                          value={form.reorderPoint}
                          onChange={(e) => handleChange('reorderPoint', Number(e.target.value))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                          min={0}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Minimum Box Level</label>
                        <input
                          type="number"
                          value={form.minLevelBox}
                          onChange={(e) => handleChange('minLevelBox', Number(e.target.value))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                          min={0}
                        />
                      </div>
                    </div>
                  </section>

                  {/* Classification Section - Collapsible */}
                  <section className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => toggleSection('classification')}
                      className="w-full px-6 py-4 text-left flex items-center justify-between hover:bg-gray-50 transition-colors"
                    >
                      <h4 className="text-lg font-semibold text-gray-900 flex items-center">
                        <svg className="w-5 h-5 text-purple-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                        Classification
                      </h4>
                      <svg 
                        className={`w-5 h-5 text-gray-500 transform transition-transform ${expandedSections.classification ? 'rotate-180' : ''}`}
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {expandedSections.classification && (
                      <div className="px-6 pb-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                            <input
                              value={form.category}
                              onChange={(e) => handleChange('category', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Subcategory</label>
                            <input
                              value={form.subcategory}
                              onChange={(e) => handleChange('subcategory', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </section>

                  {/* Technical Specifications - Collapsible */}
                  <section className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => toggleSection('technical')}
                      className="w-full px-6 py-4 text-left flex items-center justify-between hover:bg-gray-50 transition-colors"
                    >
                      <h4 className="text-lg font-semibold text-gray-900 flex items-center">
                        <svg className="w-5 h-5 text-orange-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        Technical Specifications
                      </h4>
                      <svg 
                        className={`w-5 h-5 text-gray-500 transform transition-transform ${expandedSections.technical ? 'rotate-180' : ''}`}
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {expandedSections.technical && (
                      <div className="px-6 pb-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Material/Series</label>
                            <input
                              value={form.materialSeries}
                              onChange={(e) => handleChange('materialSeries', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Board Type</label>
                            <input
                              value={form.boardType}
                              onChange={(e) => handleChange('boardType', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">GSM</label>
                            <input
                              value={form.gsm}
                              onChange={(e) => handleChange('gsm', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Dimensions (WxL mm)</label>
                            <input
                              value={form.dimensionsWxLmm}
                              onChange={(e) => handleChange('dimensionsWxLmm', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                              placeholder="200x300"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">CAL</label>
                            <input
                              value={form.cal}
                              onChange={(e) => handleChange('cal', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </section>

                  {/* Tags & Notes - Collapsible */}
                  <section className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => toggleSection('tagsAndNotes')}
                      className="w-full px-6 py-4 text-left flex items-center justify-between hover:bg-gray-50 transition-colors"
                    >
                      <h4 className="text-lg font-semibold text-gray-900 flex items-center">
                        <svg className="w-5 h-5 text-indigo-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                        </svg>
                        Tags and Notes
                      </h4>
                      <svg 
                        className={`w-5 h-5 text-gray-500 transform transition-transform ${expandedSections.tagsAndNotes ? 'rotate-180' : ''}`}
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {expandedSections.tagsAndNotes && (
                      <div className="px-6 pb-6">
                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Tags (comma separated)</label>
                            <input
                              value={(form.tags || []).join(', ')}
                              onChange={(e) => handleChange('tags', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                              placeholder="tag1, tag2, tag3"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
                            <textarea
                              value={form.notes}
                              onChange={(e) => handleChange('notes', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                              rows={4}
                              placeholder="Product notes..."
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </section>

                  {/* Barcode Configuration - Collapsible - TEMPORARILY HIDDEN */}
                  {false && (
                  <section className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => toggleSection('barcode')}
                      className="w-full px-6 py-4 text-left flex items-center justify-between hover:bg-gray-50 transition-colors"
                    >
                      <h4 className="text-lg font-semibold text-gray-900 flex items-center">
                        <svg className="w-5 h-5 text-teal-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Barcode Settings
                      </h4>
                      <svg 
                        className={`w-5 h-5 text-gray-500 transform transition-transform ${expandedSections.barcode ? 'rotate-180' : ''}`}
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {expandedSections.barcode && (
                      <div className="px-6 pb-6">
                        <div className="space-y-6">
                          {/* Enable/Disable Barcode */}
                          <div className="flex items-center">
                            <input
                              type="checkbox"
                              checked={generateBarcode}
                              onChange={(e) => setGenerateBarcode(e.target.checked)}
                              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                              id="generate-barcode"
                            />
                            <label htmlFor="generate-barcode" className="ml-2 text-sm font-medium text-gray-700">
                              Generate barcode for this product
                            </label>
                          </div>

                          {generateBarcode && (
                            <>
                              {/* Barcode Preview */}
                              <div className="bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 p-6 flex flex-col items-center justify-center min-h-[200px]">
                                {barcodePreview.busy ? (
                                  <div className="flex flex-col items-center gap-3">
                                    <svg className="animate-spin h-8 w-8 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    <p className="text-sm text-gray-600">Generating preview...</p>
                                  </div>
                                ) : barcodePreview.error ? (
                                  <div className="flex flex-col items-center gap-2 text-red-600">
                                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <p className="text-sm">{barcodePreview.error}</p>
                                  </div>
                                ) : barcodePreview.dataUrl ? (
                                  <img 
                                    src={barcodePreview.dataUrl} 
                                    alt="Barcode Preview" 
                                    className="max-w-full max-h-64 object-contain bg-white p-4 rounded-lg shadow-sm border border-gray-200"
                                  />
                                ) : (
                                  <div className="flex flex-col items-center gap-2 text-gray-400">
                                    <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                    <p className="text-sm">Barcode preview will appear here</p>
                                    <p className="text-xs text-gray-500">Enter product name and SKU to see preview</p>
                                  </div>
                                )}
                              </div>
                              {/* Barcode Format */}
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Barcode Format</label>
                                <select
                                  value={barcodeOptions.format || 'CODE128'}
                                  onChange={(e) => setBarcodeOptions(prev => ({ ...prev, format: e.target.value as any }))}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                                >
                                  <option value="CODE128">CODE128 (Recommended)</option>
                                  <option value="CODE39">CODE39</option>
                                  <option value="EAN13">EAN13</option>
                                  <option value="EAN8">EAN8</option>
                                  <option value="UPC">UPC</option>
                                  <option value="ITF14">ITF14</option>
                                </select>
                              </div>

                              {/* Label Size */}
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Label Size</label>
                                <select
                                  value={barcodeOptions.labelSize || '100x50'}
                                  onChange={(e) => setBarcodeOptions(prev => ({ ...prev, labelSize: e.target.value as LabelSize }))}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                                >
                                  {Object.entries(LABEL_SIZES).map(([key, size]) => (
                                    <option key={key} value={key}>{size.name}</option>
                                  ))}
                                </select>
                                {barcodeOptions.labelSize === 'custom' && (
                                  <div className="mt-2 grid grid-cols-2 gap-2">
                                    <div>
                                      <label className="block text-xs text-gray-600 mb-1">Width (mm)</label>
                                      <input
                                        type="number"
                                        value={barcodeOptions.customWidth || 100}
                                        onChange={(e) => setBarcodeOptions(prev => ({ ...prev, customWidth: Number(e.target.value) }))}
                                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                                        min="10"
                                        max="500"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-xs text-gray-600 mb-1">Height (mm)</label>
                                      <input
                                        type="number"
                                        value={barcodeOptions.customHeight || 50}
                                        onChange={(e) => setBarcodeOptions(prev => ({ ...prev, customHeight: Number(e.target.value) }))}
                                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                                        min="10"
                                        max="500"
                                      />
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* Paper Size */}
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Paper Size (for printing)</label>
                                <select
                                  value={barcodeOptions.paperSize || 'A4'}
                                  onChange={(e) => setBarcodeOptions(prev => ({ ...prev, paperSize: e.target.value as PaperSize }))}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                                >
                                  {Object.entries(PAPER_SIZES).map(([key, size]) => (
                                    <option key={key} value={key}>{size.name}</option>
                                  ))}
                                </select>
                              </div>

                              {/* Show Barcode Text */}
                              <div className="flex items-center">
                                <input
                                  type="checkbox"
                                  checked={barcodeOptions.showText !== false}
                                  onChange={(e) => setBarcodeOptions(prev => ({ ...prev, showText: e.target.checked }))}
                                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                  id="show-barcode-text"
                                />
                                <label htmlFor="show-barcode-text" className="ml-2 text-sm text-gray-700">
                                  Show barcode value below barcode
                                </label>
                              </div>

                              {/* Content Options */}
                              <div className="border-t border-gray-200 pt-4">
                                <label className="block text-sm font-medium text-gray-700 mb-3">Label Content</label>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-96 overflow-y-auto pr-2">
                                  {/* Basic Info */}
                                  <div className="space-y-2">
                                    <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Basic Information</h4>
                                    <div className="flex items-center">
                                      <input
                                        type="checkbox"
                                        checked={barcodeOptions.content?.includeProductName !== false}
                                        onChange={(e) => setBarcodeOptions(prev => ({
                                          ...prev,
                                          content: { ...prev.content, includeProductName: e.target.checked }
                                        }))}
                                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                        id="include-name"
                                      />
                                      <label htmlFor="include-name" className="ml-2 text-sm text-gray-700">
                                        Product Name
                                      </label>
                                    </div>
                                    <div className="flex items-center">
                                      <input
                                        type="checkbox"
                                        checked={barcodeOptions.content?.includeSKU !== false}
                                        onChange={(e) => setBarcodeOptions(prev => ({
                                          ...prev,
                                          content: { ...prev.content, includeSKU: e.target.checked }
                                        }))}
                                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                        id="include-sku"
                                      />
                                      <label htmlFor="include-sku" className="ml-2 text-sm text-gray-700">
                                        SKU
                                      </label>
                                    </div>
                                    <div className="flex items-center">
                                      <input
                                        type="checkbox"
                                        checked={barcodeOptions.content?.includePrice || false}
                                        onChange={(e) => setBarcodeOptions(prev => ({
                                          ...prev,
                                          content: { ...prev.content, includePrice: e.target.checked }
                                        }))}
                                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                        id="include-price"
                                      />
                                      <label htmlFor="include-price" className="ml-2 text-sm text-gray-700">
                                        Price
                                      </label>
                                    </div>
                                    <div className="flex items-center">
                                      <input
                                        type="checkbox"
                                        checked={barcodeOptions.content?.includeStatus || false}
                                        onChange={(e) => setBarcodeOptions(prev => ({
                                          ...prev,
                                          content: { ...prev.content, includeStatus: e.target.checked }
                                        }))}
                                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                        id="include-status"
                                      />
                                      <label htmlFor="include-status" className="ml-2 text-sm text-gray-700">
                                        Status
                                      </label>
                                    </div>
                                    <div className="flex items-center">
                                      <input
                                        type="checkbox"
                                        checked={barcodeOptions.content?.includeGroup || false}
                                        onChange={(e) => setBarcodeOptions(prev => ({
                                          ...prev,
                                          content: { ...prev.content, includeGroup: e.target.checked }
                                        }))}
                                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                        id="include-group"
                                      />
                                      <label htmlFor="include-group" className="ml-2 text-sm text-gray-700">
                                        Group
                                      </label>
                                    </div>
                                  </div>

                                  {/* Classification */}
                                  <div className="space-y-2">
                                    <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Classification</h4>
                                    <div className="flex items-center">
                                      <input
                                        type="checkbox"
                                        checked={barcodeOptions.content?.includeCategory || false}
                                        onChange={(e) => setBarcodeOptions(prev => ({
                                          ...prev,
                                          content: { ...prev.content, includeCategory: e.target.checked }
                                        }))}
                                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                        id="include-category"
                                      />
                                      <label htmlFor="include-category" className="ml-2 text-sm text-gray-700">
                                        Category
                                      </label>
                                    </div>
                                    <div className="flex items-center">
                                      <input
                                        type="checkbox"
                                        checked={barcodeOptions.content?.includeSubcategory || false}
                                        onChange={(e) => setBarcodeOptions(prev => ({
                                          ...prev,
                                          content: { ...prev.content, includeSubcategory: e.target.checked }
                                        }))}
                                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                        id="include-subcategory"
                                      />
                                      <label htmlFor="include-subcategory" className="ml-2 text-sm text-gray-700">
                                        Subcategory
                                      </label>
                                    </div>
                                    <div className="flex items-center">
                                      <input
                                        type="checkbox"
                                        checked={barcodeOptions.content?.includeTags || false}
                                        onChange={(e) => setBarcodeOptions(prev => ({
                                          ...prev,
                                          content: { ...prev.content, includeTags: e.target.checked }
                                        }))}
                                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                        id="include-tags"
                                      />
                                      <label htmlFor="include-tags" className="ml-2 text-sm text-gray-700">
                                        Tags
                                      </label>
                                    </div>
                                  </div>

                                  {/* Inventory */}
                                  <div className="space-y-2">
                                    <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Inventory</h4>
                                    <div className="flex items-center">
                                      <input
                                        type="checkbox"
                                        checked={barcodeOptions.content?.includeUOM || false}
                                        onChange={(e) => setBarcodeOptions(prev => ({
                                          ...prev,
                                          content: { ...prev.content, includeUOM: e.target.checked }
                                        }))}
                                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                        id="include-uom"
                                      />
                                      <label htmlFor="include-uom" className="ml-2 text-sm text-gray-700">
                                        Unit of Measure
                                      </label>
                                    </div>
                                    <div className="flex items-center">
                                      <input
                                        type="checkbox"
                                        checked={barcodeOptions.content?.includeQuantityBox || false}
                                        onChange={(e) => setBarcodeOptions(prev => ({
                                          ...prev,
                                          content: { ...prev.content, includeQuantityBox: e.target.checked }
                                        }))}
                                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                        id="include-quantity-box"
                                      />
                                      <label htmlFor="include-quantity-box" className="ml-2 text-sm text-gray-700">
                                        Quantity Box
                                      </label>
                                    </div>
                                    <div className="flex items-center">
                                      <input
                                        type="checkbox"
                                        checked={barcodeOptions.content?.includePcsPerBox || false}
                                        onChange={(e) => setBarcodeOptions(prev => ({
                                          ...prev,
                                          content: { ...prev.content, includePcsPerBox: e.target.checked }
                                        }))}
                                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                        id="include-pcs-per-box"
                                      />
                                      <label htmlFor="include-pcs-per-box" className="ml-2 text-sm text-gray-700">
                                        Pieces Per Box
                                      </label>
                                    </div>
                                    <div className="flex items-center">
                                      <input
                                        type="checkbox"
                                        checked={barcodeOptions.content?.includeMinStock || false}
                                        onChange={(e) => setBarcodeOptions(prev => ({
                                          ...prev,
                                          content: { ...prev.content, includeMinStock: e.target.checked }
                                        }))}
                                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                        id="include-min-stock"
                                      />
                                      <label htmlFor="include-min-stock" className="ml-2 text-sm text-gray-700">
                                        Min Stock
                                      </label>
                                    </div>
                                    <div className="flex items-center">
                                      <input
                                        type="checkbox"
                                        checked={barcodeOptions.content?.includeReorderPoint || false}
                                        onChange={(e) => setBarcodeOptions(prev => ({
                                          ...prev,
                                          content: { ...prev.content, includeReorderPoint: e.target.checked }
                                        }))}
                                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                        id="include-reorder-point"
                                      />
                                      <label htmlFor="include-reorder-point" className="ml-2 text-sm text-gray-700">
                                        Reorder Point
                                      </label>
                                    </div>
                                    <div className="flex items-center">
                                      <input
                                        type="checkbox"
                                        checked={barcodeOptions.content?.includeMinLevelBox || false}
                                        onChange={(e) => setBarcodeOptions(prev => ({
                                          ...prev,
                                          content: { ...prev.content, includeMinLevelBox: e.target.checked }
                                        }))}
                                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                        id="include-min-level-box"
                                      />
                                      <label htmlFor="include-min-level-box" className="ml-2 text-sm text-gray-700">
                                        Min Level Box
                                      </label>
                                    </div>
                                  </div>

                                  {/* Technical Specs */}
                                  <div className="space-y-2">
                                    <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Technical Specs</h4>
                                    <div className="flex items-center">
                                      <input
                                        type="checkbox"
                                        checked={barcodeOptions.content?.includeMaterialSeries || false}
                                        onChange={(e) => setBarcodeOptions(prev => ({
                                          ...prev,
                                          content: { ...prev.content, includeMaterialSeries: e.target.checked }
                                        }))}
                                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                        id="include-material-series"
                                      />
                                      <label htmlFor="include-material-series" className="ml-2 text-sm text-gray-700">
                                        Material/Series
                                      </label>
                                    </div>
                                    <div className="flex items-center">
                                      <input
                                        type="checkbox"
                                        checked={barcodeOptions.content?.includeBoardType || false}
                                        onChange={(e) => setBarcodeOptions(prev => ({
                                          ...prev,
                                          content: { ...prev.content, includeBoardType: e.target.checked }
                                        }))}
                                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                        id="include-board-type"
                                      />
                                      <label htmlFor="include-board-type" className="ml-2 text-sm text-gray-700">
                                        Board Type
                                      </label>
                                    </div>
                                    <div className="flex items-center">
                                      <input
                                        type="checkbox"
                                        checked={barcodeOptions.content?.includeGSM || false}
                                        onChange={(e) => setBarcodeOptions(prev => ({
                                          ...prev,
                                          content: { ...prev.content, includeGSM: e.target.checked }
                                        }))}
                                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                        id="include-gsm"
                                      />
                                      <label htmlFor="include-gsm" className="ml-2 text-sm text-gray-700">
                                        GSM
                                      </label>
                                    </div>
                                    <div className="flex items-center">
                                      <input
                                        type="checkbox"
                                        checked={barcodeOptions.content?.includeDimensions || false}
                                        onChange={(e) => setBarcodeOptions(prev => ({
                                          ...prev,
                                          content: { ...prev.content, includeDimensions: e.target.checked }
                                        }))}
                                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                        id="include-dimensions"
                                      />
                                      <label htmlFor="include-dimensions" className="ml-2 text-sm text-gray-700">
                                        Dimensions
                                      </label>
                                    </div>
                                    <div className="flex items-center">
                                      <input
                                        type="checkbox"
                                        checked={barcodeOptions.content?.includeCAL || false}
                                        onChange={(e) => setBarcodeOptions(prev => ({
                                          ...prev,
                                          content: { ...prev.content, includeCAL: e.target.checked }
                                        }))}
                                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                        id="include-cal"
                                      />
                                      <label htmlFor="include-cal" className="ml-2 text-sm text-gray-700">
                                        CAL
                                      </label>
                                    </div>
                                  </div>

                                  {/* Additional */}
                                  <div className="space-y-2 md:col-span-2">
                                    <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Additional</h4>
                                    <div className="flex items-center">
                                      <input
                                        type="checkbox"
                                        checked={barcodeOptions.content?.includeNotes || false}
                                        onChange={(e) => setBarcodeOptions(prev => ({
                                          ...prev,
                                          content: { ...prev.content, includeNotes: e.target.checked }
                                        }))}
                                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                        id="include-notes"
                                      />
                                      <label htmlFor="include-notes" className="ml-2 text-sm text-gray-700">
                                        Notes
                                      </label>
                                    </div>
                                    <div>
                                      <label className="block text-sm text-gray-700 mb-1">Custom Text (optional)</label>
                                      <input
                                        type="text"
                                        value={barcodeOptions.content?.customText || ''}
                                        onChange={(e) => setBarcodeOptions(prev => ({
                                          ...prev,
                                          content: { ...prev.content, customText: e.target.value }
                                        }))}
                                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        placeholder="Additional text to display on label"
                                      />
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </section>
                  )}
                </div>
              </div>

              {/* Right Panel - Media & Summary */}
              <div className="xl:col-span-1 bg-gray-50 border-l border-gray-200 p-6">
                <div className="space-y-6 sticky top-6">
                  {/* Media Upload */}
                  <section className="bg-white rounded-lg border border-gray-200 p-4">
                    <h4 className="text-lg font-semibold text-gray-900 mb-4">Media</h4>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Main Image</label>
                        <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-blue-400 transition-colors">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                              const f = e.target.files?.[0] || null
                              handleChange('imageFile', f)
                              setPrimaryPreview(f ? URL.createObjectURL(f) : null)
                            }}
                            className="hidden"
                            id="primary-image"
                          />
                          <label htmlFor="primary-image" className="cursor-pointer block">
                            <svg className="mx-auto h-8 w-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <span className="mt-2 block text-sm text-gray-600">Click to upload image</span>
                          </label>
                        </div>
                        {primaryPreview && (
                          <div className="mt-3">
                            <img src={primaryPreview} alt="preview" className="w-full h-32 object-cover rounded-lg border" />
                          </div>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Gallery Images</label>
                        <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-blue-400 transition-colors">
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            onChange={(e) => {
                              const files = e.target.files ? Array.from(e.target.files) : null
                              handleChange('imageFiles', files)
                              setGalleryPreviews(files ? files.map(f => URL.createObjectURL(f)) : [])
                            }}
                            className="hidden"
                            id="gallery-images"
                          />
                          <label htmlFor="gallery-images" className="cursor-pointer block">
                            <svg className="mx-auto h-8 w-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <span className="mt-2 block text-sm text-gray-600">Upload multiple images</span>
                          </label>
                        </div>
                        {galleryPreviews.length > 0 && (
                          <div className="mt-3 grid grid-cols-3 gap-2">
                            {galleryPreviews.map((u, i) => (
                              <img key={i} src={u} alt="gallery" className="h-20 w-full object-cover rounded border" />
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </section>

                  {/* Summary Card */}
                  <section className="bg-white rounded-lg border border-gray-200 p-4">
                    <h4 className="text-lg font-semibold text-gray-900 mb-4">Summary</h4>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Total Stock Value</span>
                        <span className="text-lg font-bold text-gray-900">£{totalValue.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm text-gray-500">
                        <span>Number of Boxes</span>
                        <span>{form.quantityBox || 0} boxes</span>
                      </div>
                      <div className="flex justify-between items-center text-sm text-gray-500">
                        <span>Price Per Box</span>
                        <span>£{(form.pricePerBox || 0).toFixed(2)}</span>
                      </div>
                      <div className="pt-3 border-t border-gray-200">
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-gray-600">Total Pieces</span>
                          <span className="font-semibold text-gray-900">
                            {((form.quantityBox || 0) * (form.pcsPerBox || 0)).toLocaleString()} pieces
                          </span>
                        </div>
                      </div>
                    </div>
                  </section>
                </div>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="sticky bottom-0 border-t border-gray-200 bg-white px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  {error && (
                    <div className="flex items-center text-sm text-red-600">
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {error}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium flex items-center"
                  >
                    {submitting ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                        </svg>
                        Saving...
                      </>
                    ) : (
                      productId ? 'Save Changes' : 'Save Product'
                    )}
                  </button>
                </div>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}