import { useEffect, useState } from 'react'
import { createProduct, updateProduct, type ProductInput, type Group } from '../api/products'
import { listCustomFields, type CustomField } from '../api/settings'

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

  const handleChange = (key: keyof ProductInput, value: any) => {
    setForm((f) => ({ ...f, [key]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      // merge custom values
      const payload: any = { ...form, ...customValues }
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
            <p className="text-sm text-gray-600 mt-1">QR code and barcode will be generated automatically</p>
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