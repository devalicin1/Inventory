import React, { useCallback, useRef, useState, type FC } from 'react'
import { downloadJobCreateFormPDF, type JobCreateFormOverrides } from '../utils/jobCreateFormGenerator'

interface Props {
  formData: any
  onClose: () => void
  onApply?: (overrides: Partial<JobCreateFormOverrides>) => void
}

const InputField: FC<{
  label: string
  value: string | number
  onChange: (value: string | number) => void
  onReset?: () => void
  type?: 'text' | 'number'
  placeholder?: string
}> = ({ label, value, onChange, onReset, type = 'text', placeholder }) => {
  const inputRef = useRef<HTMLInputElement>(null)
  return (
    <div className="relative group">
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
        {onReset && value !== '' && (
          <button
            onClick={onReset}
            className="ml-2 text-xs text-blue-600 hover:text-blue-800 transition-colors"
            title="Reset to default"
            type="button"
          >
            ↺
          </button>
        )}
      </label>
      <input
        ref={inputRef}
        type={type}
        value={value ?? ''}
        onChange={(e) => onChange(type === 'number' ? Number(e.target.value) : e.target.value)}
        className="w-full border border-gray-300 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 hover:border-gray-400"
        placeholder={placeholder}
        onFocus={(e) => e.target.select()}
      />
    </div>
  )
}

const MemoizedInputField = React.memo(InputField)

export const JobCreatePrintFormModal: FC<Props> = ({ formData, onClose, onApply }) => {
  const specs = formData.productionSpecs || {}
  const sheet = specs.sheet || specs.sheetSize || {}
  const forme = (specs as any).forme || (specs as any).formeSize || {}

  const [data, setData] = useState<JobCreateFormOverrides>({
    date: (formData.customer?.date && typeof formData.customer.date === 'string') ? formData.customer.date : new Date().toISOString().split('T')[0],
    orderNo: (formData.code || formData.jobCode || formData.internalRef || formData.customer?.orderNo || formData.customerPo || ''),
    style: specs.style || '',
    sizeW: specs?.size?.width,
    sizeL: specs?.size?.length,
    sizeH: specs?.size?.height,
    numberUp: specs.numberUp,
    title: formData.productName || formData.sku || '',
    formeW: (forme as any)?.width,
    formeL: (forme as any)?.length,
    material: `${specs.board || ''}${specs.microns ? ` ${specs.microns} MICRON` : ''}`.trim(),
    workingTo: (formData as any).workingTo || 'THIS ORDER & DIGITAL FILE',
    machine: (formData as any).machine || 'Iberica/Eterna',
    scoringRuleHeight: (formData as any).scoringRuleHeight || '',
    nicks: (formData as any).nicks || '0.5 GRIP EDGE. REST 0.3',
    spareRule: (formData as any).spareRule || '',
    patchUpSheet: (formData as any).patchUpSheet || '',
    counters: (formData as any).counters || '',
    strippingTooling: (formData as any).strippingTooling || '',
    boardW: sheet?.width,
    boardL: sheet?.length,
    priceQuoted: (formData as any).priceQuoted || '',
    required: formData.whenRequired || 'sap please',
    note: formData.notes || ''
  })

  const change = useCallback((k: keyof JobCreateFormOverrides, v: any) => {
    setData(prev => ({ ...prev, [k]: v }))
  }, [])

  const applyAndDownload = async (apply: boolean) => {
    if (apply && onApply) onApply(data)
    await downloadJobCreateFormPDF(data)
    onClose()
  }

  const [activeSection, setActiveSection] = useState('order-info')

  const Section: FC<{ id: string; title: string; children: React.ReactNode }> = useCallback(({ id, title, children }) => (
    <section 
      id={id}
      className={`p-6 bg-white rounded-xl border transition-all duration-300 ${
        activeSection === id ? 'border-blue-200 ring-2 ring-blue-50' : 'border-gray-200 hover:border-gray-300'
      }`}
    >
      <h4 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
        <div className={`w-2 h-2 rounded-full mr-3 transition-colors ${
          activeSection === id ? 'bg-blue-500' : 'bg-gray-300'
        }`} />
        {title}
      </h4>
      {children}
    </section>
  ), [activeSection])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black bg-opacity-50 backdrop-blur-sm transition-opacity duration-300" onClick={onClose} />
      <div className="relative bg-white w-full max-w-6xl max-h-[90vh] rounded-2xl shadow-2xl flex flex-col transform transition-all duration-300 scale-100">
        <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold text-gray-900">Create Form</h3>
              <p className="text-sm text-gray-600 mt-1">Edit fields for PDF</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white rounded-xl transition-all duration-200 group" type="button">
              <svg className="w-5 h-5 text-gray-500 group-hover:text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="px-6 py-3 bg-gray-50 border-b border-gray-100">
          <div className="flex space-x-1 overflow-x-auto">
            {[
              { id: 'order-info', label: 'Order Info', icon: '📋' },
              { id: 'specs', label: 'Specs', icon: '📏' },
              { id: 'process', label: 'Process', icon: '⚙️' },
              { id: 'notes', label: 'Notes', icon: '📝' },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setActiveSection(item.id)
                  document.getElementById(item.id)?.scrollIntoView({ behavior: 'smooth' })
                }}
                className={`flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 whitespace-nowrap ${
                  activeSection === item.id ? 'bg-blue-500 text-white shadow-sm' : 'text-gray-600 hover:bg-white hover:text-gray-900'
                }`}
                type="button"
              >
                <span className="mr-2">{item.icon}</span>
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-6">
            {activeSection === 'order-info' && (
              <Section id="order-info" title="Order Information">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <MemoizedInputField label="ORDER DATE" value={data.date || ''} onChange={(v) => change('date', v)} placeholder="YYYY-MM-DD" />
                  <MemoizedInputField label="ORDER NO" value={data.orderNo || ''} onChange={(v) => change('orderNo', v)} />
                  <MemoizedInputField label="STYLE" value={data.style || ''} onChange={(v) => change('style', v)} />
                  <MemoizedInputField label="WORKING TO" value={data.workingTo || ''} onChange={(v) => change('workingTo', v)} />
                  <MemoizedInputField label="NUMBER UP" type="number" value={data.numberUp || ''} onChange={(v) => change('numberUp', v)} />
                  <MemoizedInputField label="TITLE" value={data.title || ''} onChange={(v) => change('title', v)} />
                </div>
              </Section>
            )}

            {activeSection === 'specs' && (
              <Section id="specs" title="Specifications">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <MemoizedInputField label="SIZE (W)" type="number" value={data.sizeW || ''} onChange={(v) => change('sizeW', v)} />
                  <MemoizedInputField label="SIZE (L)" type="number" value={data.sizeL || ''} onChange={(v) => change('sizeL', v)} />
                  <MemoizedInputField label="SIZE (H)" type="number" value={data.sizeH || ''} onChange={(v) => change('sizeH', v)} />
                  <MemoizedInputField label="FORME SIZE (W)" type="number" value={data.formeW || ''} onChange={(v) => change('formeW', v)} />
                  <MemoizedInputField label="FORME SIZE (L)" type="number" value={data.formeL || ''} onChange={(v) => change('formeL', v)} />
                  <MemoizedInputField label="MATERIAL" value={data.material || ''} onChange={(v) => change('material', v)} />
                  <MemoizedInputField label="BOARD SIZE (W)" type="number" value={data.boardW || ''} onChange={(v) => change('boardW', v)} />
                  <MemoizedInputField label="BOARD SIZE (L)" type="number" value={data.boardL || ''} onChange={(v) => change('boardL', v)} />
                </div>
              </Section>
            )}

            {activeSection === 'process' && (
              <Section id="process" title="Process">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="relative group">
                    <label className="block text-sm font-medium text-gray-700 mb-1">MACHINE</label>
                    <select
                      value={String(data.machine || 'Iberica/Eterna')}
                      onChange={(e) => change('machine', e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                    >
                      <option value="Iberica">Iberica</option>
                      <option value="Eterna">Eterna</option>
                      <option value="Iberica/Eterna">Iberica/Eterna</option>
                    </select>
                  </div>
                  <MemoizedInputField label="SCORING RULE HEIGHT" value={data.scoringRuleHeight || ''} onChange={(v) => change('scoringRuleHeight', v)} />
                  <MemoizedInputField label="NICKS" value={data.nicks || ''} onChange={(v) => change('nicks', v)} />
                  <MemoizedInputField label="SPARE RULE" value={data.spareRule || ''} onChange={(v) => change('spareRule', v)} />
                  <MemoizedInputField label="PATCH UP SHEET" value={data.patchUpSheet || ''} onChange={(v) => change('patchUpSheet', v)} />
                  <MemoizedInputField label="COUNTERS" value={data.counters || ''} onChange={(v) => change('counters', v)} />
                  <MemoizedInputField label="STRIPPING TOOLING" value={data.strippingTooling || ''} onChange={(v) => change('strippingTooling', v)} />
                </div>
              </Section>
            )}

            {activeSection === 'notes' && (
              <Section id="notes" title="Commercials & Notes">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <MemoizedInputField label="PRICE QUOTED" value={data.priceQuoted || ''} onChange={(v) => change('priceQuoted', v)} />
                  <MemoizedInputField label="REQUIRED" value={data.required || ''} onChange={(v) => change('required', v)} />
                  <MemoizedInputField label="NOTE" value={data.note || ''} onChange={(v) => change('note', v)} />
                </div>
              </Section>
            )}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-500">
              These changes affect the PDF only{onApply ? ', you may also apply them to the form' : ''}.
            </div>
            <div className="flex items-center space-x-3">
              <button onClick={onClose} className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-all duration-200 font-medium" type="button">Close</button>
              <button onClick={() => applyAndDownload(false)} className="px-6 py-2.5 border border-blue-200 text-blue-700 rounded-lg hover:bg-blue-50 transition-all duration-200 font-medium" type="button">Download only</button>
              {onApply && (
                <button onClick={() => applyAndDownload(true)} className="px-8 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 font-medium shadow-sm hover:shadow-md" type="button">Apply & Download</button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}


