import React from 'react'
import { useState, type FC, useCallback, useRef } from 'react'
import type { Job } from '../api/production-jobs'
import { downloadPrintFormPDF, type PrintFormOverrides } from '../utils/printFormGenerator'

interface Props {
  job: Job
  onClose: () => void
}

// Stable input bileşeni - React.memo ile sarmalayarak gereksiz render'ları önle
const InputField: FC<{
  label: string
  value: string | number
  onChange: (value: string | number) => void
  onReset: () => void
  type?: 'text' | 'number'
  placeholder?: string
  isResetVisible?: boolean
}> = ({ label, value, onChange, onReset, type = 'text', placeholder, isResetVisible = true }) => {
  const inputRef = useRef<HTMLInputElement>(null)
  
  return (
    <div className="relative group">
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
        {isResetVisible && value !== '' && (
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
        onChange={(e) => {
          // Debounce mekanizması ekle
          setTimeout(() => {
            onChange(type === 'number' ? Number(e.target.value) : e.target.value)
          }, 0)
        }}
        className="w-full border border-gray-300 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 hover:border-gray-400"
        placeholder={placeholder}
        onFocus={(e) => e.target.select()}
      />
    </div>
  )
}

// Memoize edilmiş bileşen
const MemoizedInputField = React.memo(InputField)

export const PrintFormModal: FC<Props> = ({ job, onClose }) => {
  const specs: any = job.productionSpecs || {}
  const sheet = specs.sheet || specs.sheetSize || {}
  const bomSheets = Array.isArray((job as any).bom)
    ? (job as any).bom
        .filter((b: any) => {
          const u = String(b.uom || '').toLowerCase()
          return u === 'sht' || u === 'sheet' || u === 'sheets'
        })
        .reduce((sum: number, b: any) => sum + Number(b.qtyRequired || 0), 0)
    : 0
  const sheetsBase = bomSheets || specs.sheetsToUse || 0
  
  // Default değerleri useRef ile sabitle - her render'da yeniden oluşturulmasın
  const defaultsRef = useRef<PrintFormOverrides>({
    date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
    contact: 'Deniz Nayir',
    orderNo: job.customer?.orderNo || '',
    jobRef: job.code || job.id,
    jobTitle: job.productName || job.sku || '',
    minSheetsRequired: Math.max(0, Number(sheetsBase) - 400),
    sheetsAvailable: 'NOW',
    boardWidth: sheet.width,
    boardLength: sheet.length,
    material: specs.board,
    microns: specs.microns,
    colours: specs.printedColors || 0,
    process: specs.printedColors || 0,
    varnish: specs.varnish,
    specialInstructions: job.notes || '',
    whenRequired: 'URGENT PLEASE',
    plates: 'NEW PLATES',
    platesNote: 'please use a cut blanket',
    priceAgreed: '',
    alert1: 'RETURN ALL MAKE-READYS ON TOP OF A PALLET',
    alert2: '15mm GRIP REQUIRED TO FIRST CUT & SIDELAY OPERATORS SIDE',
    alert3: 'QUALITY CHECKS MUST BE PERFORMED BEFORE DELIVERY',
  })

  // State'i doğrudan defaultsRef.current ile başlat
  const [data, setData] = useState<PrintFormOverrides>(() => defaultsRef.current)
  const [activeSection, setActiveSection] = useState('job-info')

  // useCallback ile fonksiyonları sabitle
  const handleInputChange = useCallback((key: keyof PrintFormOverrides, value: string | number) => {
    setData(prev => ({
      ...prev,
      [key]: value
    }))
  }, [])

  const resetField = useCallback((key: keyof PrintFormOverrides) => {
    setData(prev => ({ 
      ...prev, 
      [key]: defaultsRef.current[key] 
    }))
  }, [])

  const handleDownload = async () => {
    await downloadPrintFormPDF(job, data)
    onClose()
  }

  const resetAll = useCallback(() => {
    setData(defaultsRef.current)
  }, [])

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
      {/* Blur Background */}
      <div 
        className="absolute inset-0 bg-black bg-opacity-50 backdrop-blur-sm transition-opacity duration-300"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-white w-full max-w-6xl max-h-[90vh] rounded-2xl shadow-2xl flex flex-col transform transition-all duration-300 scale-100">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold text-gray-900">Print Order Form</h3>
              <p className="text-sm text-gray-600 mt-1">
                Edit print form details for <span className="font-semibold">{job.code || job.id}</span>
              </p>
            </div>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-white rounded-xl transition-all duration-200 group"
              type="button"
            >
              <svg className="w-5 h-5 text-gray-500 group-hover:text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Navigation */}
        <div className="px-6 py-3 bg-gray-50 border-b border-gray-100">
          <div className="flex space-x-1 overflow-x-auto">
            {[
              { id: 'job-info', label: 'Job Info', icon: '📋' },
              { id: 'requirements', label: 'Requirements', icon: '📏' },
              { id: 'logistics', label: 'Logistics', icon: '🚚' },
              { id: 'instructions', label: 'Instructions', icon: '📝' },
              { id: 'alerts', label: 'Alerts', icon: '⚠️' }
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setActiveSection(item.id)
                  document.getElementById(item.id)?.scrollIntoView({ behavior: 'smooth' })
                }}
                className={`flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 whitespace-nowrap ${
                  activeSection === item.id
                    ? 'bg-blue-500 text-white shadow-sm'
                    : 'text-gray-600 hover:bg-white hover:text-gray-900'
                }`}
                type="button"
              >
                <span className="mr-2">{item.icon}</span>
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-6">
            {/* Job Information */}
            <Section id="job-info" title="Job Information">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <MemoizedInputField
                  label="Date"
                  value={data.date || ''}
                  onChange={(value) => handleInputChange('date', value)}
                  onReset={() => resetField('date')}
                  placeholder="DD MMM YYYY"
                />
                <MemoizedInputField
                  label="Contact Person"
                  value={data.contact || ''}
                  onChange={(value) => handleInputChange('contact', value)}
                  onReset={() => resetField('contact')}
                  placeholder="Enter contact name"
                />
                <MemoizedInputField
                  label="Order Number"
                  value={data.orderNo || ''}
                  onChange={(value) => handleInputChange('orderNo', value)}
                  onReset={() => resetField('orderNo')}
                  placeholder="Customer order number"
                />
                <MemoizedInputField
                  label="Job Reference"
                  value={data.jobRef || ''}
                  onChange={(value) => handleInputChange('jobRef', value)}
                  onReset={() => resetField('jobRef')}
                  placeholder="Job reference code"
                />
                <MemoizedInputField
                  label="Job Title"
                  value={data.jobTitle || ''}
                  onChange={(value) => handleInputChange('jobTitle', value)}
                  onReset={() => resetField('jobTitle')}
                  placeholder="Product name or description"
                />
              </div>
            </Section>

            {/* Requirements */}
            <Section id="requirements" title="Production Requirements">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <MemoizedInputField
                  label="Minimum Sheets Required"
                  value={data.minSheetsRequired || ''}
                  onChange={(value) => handleInputChange('minSheetsRequired', value)}
                  onReset={() => resetField('minSheetsRequired')}
                  type="number"
                  placeholder="0"
                />
                <MemoizedInputField
                  label="Sheets Available"
                  value={data.sheetsAvailable || ''}
                  onChange={(value) => handleInputChange('sheetsAvailable', value)}
                  onReset={() => resetField('sheetsAvailable')}
                  placeholder="NOW"
                />
                <MemoizedInputField
                  label="Board Width (mm)"
                  value={data.boardWidth || ''}
                  onChange={(value) => handleInputChange('boardWidth', value)}
                  onReset={() => resetField('boardWidth')}
                  type="number"
                  placeholder="Width in millimeters"
                />
                <MemoizedInputField
                  label="Board Length (mm)"
                  value={data.boardLength || ''}
                  onChange={(value) => handleInputChange('boardLength', value)}
                  onReset={() => resetField('boardLength')}
                  type="number"
                  placeholder="Length in millimeters"
                />
                <MemoizedInputField
                  label="Material Type"
                  value={data.material || ''}
                  onChange={(value) => handleInputChange('material', value)}
                  onReset={() => resetField('material')}
                  placeholder="Board material"
                />
                <MemoizedInputField
                  label="Microns"
                  value={data.microns || ''}
                  onChange={(value) => handleInputChange('microns', value)}
                  onReset={() => resetField('microns')}
                  type="number"
                  placeholder="Thickness in microns"
                />
                <MemoizedInputField
                  label="Number of Colors"
                  value={data.colours || ''}
                  onChange={(value) => handleInputChange('colours', value)}
                  onReset={() => resetField('colours')}
                  type="number"
                  placeholder="0"
                />
                <MemoizedInputField
                  label="Process"
                  value={data.process || ''}
                  onChange={(value) => handleInputChange('process', value)}
                  onReset={() => resetField('process')}
                  type="number"
                  placeholder="Process count"
                />
                <MemoizedInputField
                  label="Varnish"
                  value={data.varnish || ''}
                  onChange={(value) => handleInputChange('varnish', value)}
                  onReset={() => resetField('varnish')}
                  placeholder="Varnish type"
                />
              </div>
            </Section>

            {/* Logistics - BU BÖLÜMÜ ÖZELLİKLE DÜZENLEDİM */}
            <Section id="logistics" title="Logistics & Pricing">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <MemoizedInputField
                  label="When Required"
                  value={data.whenRequired || ''}
                  onChange={(value) => handleInputChange('whenRequired', value)}
                  onReset={() => resetField('whenRequired')}
                  placeholder="Delivery timeline"
                />
                <MemoizedInputField
                  label="Plates Requirement"
                  value={data.plates || ''}
                  onChange={(value) => handleInputChange('plates', value)}
                  onReset={() => resetField('plates')}
                  placeholder="Plate specifications"
                />
                <MemoizedInputField
                  label="Plates Note"
                  value={data.platesNote || ''}
                  onChange={(value) => handleInputChange('platesNote', value)}
                  onReset={() => resetField('platesNote')}
                  placeholder="Additional plate instructions"
                />
                {/* PriceAgreed için özel çözüm */}
                <div className="relative group">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Agreed Price
                  </label>
                  <input
                    type="text"
                    value={data.priceAgreed || ''}
                    onChange={(e) => {
                      // Doğrudan state güncelle, setTimeout ile event loop'tan sonra
                      setTimeout(() => {
                        handleInputChange('priceAgreed', e.target.value)
                      }, 0)
                    }}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 hover:border-gray-400"
                    placeholder="Price agreement details"
                    onFocus={(e) => e.target.select()}
                  />
                </div>
              </div>
            </Section>

            {/* Special Instructions */}
            <Section id="instructions" title="Special Instructions">
              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700">
                  Special Instructions & Notes
                  {data.specialInstructions !== defaultsRef.current.specialInstructions && (
                    <button
                      onClick={() => resetField('specialInstructions')}
                      className="ml-2 text-xs text-blue-600 hover:text-blue-800 transition-colors"
                      title="Reset to default"
                      type="button"
                    >
                      ↺ Reset to default
                    </button>
                  )}
                </label>
                <textarea
                  className="w-full border border-gray-300 rounded-lg px-3 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 hover:border-gray-400 min-h-[120px] resize-y"
                  value={data.specialInstructions || ''}
                  onChange={(e) => handleInputChange('specialInstructions', e.target.value)}
                  placeholder="Enter any special instructions, notes, or production requirements..."
                  onFocus={(e) => e.target.select()}
                />
                <p className="text-xs text-gray-500">
                  This text will appear in the special instructions section of the print form.
                </p>
              </div>
            </Section>

            {/* Alerts */}
            <Section id="alerts" title="Important Alerts">
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <MemoizedInputField
                    label="Alert #1"
                    value={data.alert1 || ''}
                    onChange={(value) => handleInputChange('alert1', value)}
                    onReset={() => resetField('alert1')}
                    placeholder="Critical instruction 1"
                  />
                  <MemoizedInputField
                    label="Alert #2"
                    value={data.alert2 || ''}
                    onChange={(value) => handleInputChange('alert2', value)}
                    onReset={() => resetField('alert2')}
                    placeholder="Critical instruction 2"
                  />
                  <MemoizedInputField
                    label="Alert #3"
                    value={data.alert3 || ''}
                    onChange={(value) => handleInputChange('alert3', value)}
                    onReset={() => resetField('alert3')}
                    placeholder="Critical instruction 3"
                  />
                </div>
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-start">
                    <svg className="w-5 h-5 text-yellow-600 mt-0.5 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <div className="text-sm text-yellow-800">
                      <strong>Note:</strong> These alerts will be displayed prominently in the PDF with warning styling. 
                      Use them for critical production requirements and safety instructions.
                    </div>
                  </div>
                </div>
              </div>
            </Section>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-500">
              All changes will be reflected in the generated PDF
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={onClose}
                className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-all duration-200 font-medium"
                type="button"
              >
                Cancel
              </button>
              <button
                onClick={resetAll}
                className="px-6 py-2.5 border border-blue-200 text-blue-700 rounded-lg hover:bg-blue-50 transition-all duration-200 font-medium"
                type="button"
              >
                Reset All
              </button>
              <button
                onClick={handleDownload}
                className="px-8 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 font-medium shadow-sm hover:shadow-md flex items-center"
                type="button"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Generate PDF
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}