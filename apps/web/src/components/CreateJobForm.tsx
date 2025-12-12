import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { listProducts, type ListedProduct } from '../api/inventory'
import { listCustomers, type Customer } from '../api/production-jobs'
import { listGroups, type Group } from '../api/products'
import {
  XMarkIcon,
  CheckIcon,
  UserIcon,
  ClipboardDocumentListIcon,
  ShoppingCartIcon,
  TruckIcon,
  DocumentTextIcon,
  CogIcon
} from '@heroicons/react/24/outline'
import { JobBasicInfoStep } from './jobs/create/JobBasicInfoStep'
import { JobSpecsStep } from './jobs/create/JobSpecsStep'
import { JobMaterialsStep } from './jobs/create/JobMaterialsStep'
import { JobWorkflowStep } from './jobs/create/JobWorkflowStep'
import { JobPackagingStep } from './jobs/create/JobPackagingStep'
import { JobFinalizeStep } from './jobs/create/JobFinalizeStep'
import { useJobCalculations } from './jobs/create/useJobCalculations'
import { useJobValidation } from './jobs/create/useJobValidation'
import type { JobFormData } from './jobs/create/types'
import { Button } from './ui/Button'

export type CreateJobFormProps = {
  onSubmit: (data: any) => void
  onClose: () => void
  isLoading: boolean
  workflows: any[]
  workcenters: any[]
  resources: any[]
  workspaceId?: string
  initialJob?: any
}

export function CreateJobForm({
  onSubmit,
  onClose,
  isLoading,
  workflows,
  workcenters,
  resources,
  workspaceId = 'demo-workspace',
  initialJob
}: CreateJobFormProps) {
  const [currentStep, setCurrentStep] = useState(1)
  const totalSteps = 7

  // Get initial values safely
  const getInitialStageId = () => {
    if (workflows.length > 0 && workflows[0].stages?.length > 0) {
      return workflows[0].stages[0].id
    }
    return ''
  }

  // Get today's date in YYYY-MM-DD format
  const getTodayDate = () => {
    const today = new Date()
    return today.toISOString().split('T')[0]
  }

  // Generate unique job code based on current date, customer name, and random (short format)
  const generateUniqueJobCode = (customerName?: string) => {
    const now = new Date()
    const year = String(now.getFullYear()).slice(-2) // Last 2 digits of year
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0')

    // Get customer initials (first 3 letters, uppercase)
    let customerPart = ''
    if (customerName && customerName.trim()) {
      const initials = customerName
        .split(' ')
        .map(word => word.charAt(0))
        .join('')
        .toUpperCase()
        .slice(0, 3)
      customerPart = initials || ''
    }

    return customerPart ? `JOB${year}${month}${day}-${customerPart}-${random}` : `JOB${year}${month}${day}${random}`
  }

  // Generate the unique job code once and use it for both jobCode and internalRef
  const uniqueJobCode = generateUniqueJobCode()

  // If duplicating from an existing job, prefill most fields but reset process-related ones
  const initialFromJob = (() => {
    const j = initialJob
    if (!j) return null
    const wfId = j.workflowId || (workflows[0]?.id || '')
    // When duplicating, copy workflow section data exactly as is
    const originalPlannedStageIds = Array.isArray((j as any).plannedStageIds) ? (j as any).plannedStageIds : []
    // Fallback to workflow stages if original plannedStageIds is empty
    const planned = originalPlannedStageIds.length > 0
      ? originalPlannedStageIds
      : (workflows.find((w: any) => w.id === wfId)?.stages || workflows[0]?.stages || []).map((s: any) => s.id)
    const out0 = (j.output && j.output[0]) ? j.output[0] : null
    return {
      jobCode: uniqueJobCode,
      sku: j.sku || '',
      productName: j.productName || '',
      quantity: j.quantity || 1,
      unit: j.unit || 'pcs',
      priority: j.priority || 3,
      workflowId: wfId,
      // Reset currentStageId to first stage since process starts from beginning
      currentStageId: planned[0] || '',
      plannedStageIds: planned,
      // Copy requireOutputToAdvance setting from original job
      requireOutputToAdvance: (j as any).requireOutputToAdvance !== false,
      status: 'draft' as const,
      assignees: [] as string[],
      workcenterId: '',
      plannedStart: '',
      plannedEnd: '',
      dueDate: (() => {
        const d: any = (j as any).dueDate
        if (!d) return ''
        try {
          // Firestore Timestamp
          if (d.seconds) {
            return new Date(d.seconds * 1000).toISOString().split('T')[0]
          }
          const parsed = new Date(d)
          return isNaN(parsed.getTime()) ? '' : parsed.toISOString().split('T')[0]
        } catch { return '' }
      })(),
      customer: j.customer ? { ...j.customer, orderNo: '', ref: '', estNo: '', date: getTodayDate() as any } : { id: '', name: '', orderNo: '', ref: '', estNo: '', date: getTodayDate() as any },
      internalRef: uniqueJobCode,
      customerPo: '',
      cutterNo: (j as any).cutterNo || '',
      notes: j.notes || '',
      bom: (j.bom || []).map((b: any) => ({ ...b, reserved: 0, consumed: 0 })),
      output: out0 ? [{ ...out0, qtyProduced: 0 }] : [],
      packaging: j.packaging ? { ...j.packaging } : { packingNote: '', pcsPerBox: undefined, boxesPerPallet: undefined, plannedPallets: undefined, actual: { batches: [] as any[] } },
      // When duplicating a job, default Job Type to Repeat
      isRepeat: true,
      outerType: ((j as any).outerType || 'plain') as 'plain' | 'std_ptd' | 'bespoke',
      outerCode: (j as any).outerCode || '',
      rsOrderRef: (j as any).rsOrderRef || '',
      deliveryAddress: (j as any).deliveryAddress || '',
      weightPerBox: (j as any).weightPerBox,
      productionSpecs: (j as any).productionSpecs || {
        size: { width: undefined as number | undefined, length: undefined as number | undefined, height: undefined as number | undefined },
        forme: { width: undefined as number | undefined, length: undefined as number | undefined },
        sheet: { width: undefined as number | undefined, length: undefined as number | undefined },
        cutTo: { width: undefined as number | undefined, length: undefined as number | undefined },
        yieldPerSheet: undefined as number | undefined,
        labelNo: undefined as number | undefined,
        style: '' as string,
        numberUp: undefined as number | undefined,
        printedColors: undefined as number | undefined,
        varnish: '' as string,
        microns: undefined as number | undefined,
        board: '' as string,
        oversPct: undefined as number | undefined,
        sheetWastage: undefined as number | undefined,
      } as any,
      deliveryMethod: (j as any).deliveryMethod || '',
      stageProgress: [] as any[],
      specialComponents: [] as any[],
      attachments: [] as any[],
    }
  })()

  const [formData, setFormData] = useState<JobFormData>(initialFromJob || {
    jobCode: uniqueJobCode,
    sku: '',
    productName: '',
    quantity: 1,
    unit: 'pcs',
    priority: 3,
    workflowId: workflows[0]?.id || '',
    currentStageId: getInitialStageId(),
    plannedStageIds: (workflows[0]?.stages || []).map((s: any) => s.id),
    status: 'draft',
    assignees: [],
    workcenterId: '',
    plannedStart: '',
    plannedEnd: '',
    dueDate: '',
    customer: { id: '', name: '', orderNo: '', ref: '', estNo: '', date: getTodayDate() },
    internalRef: uniqueJobCode,
    customerPo: '',
    cutterNo: '',
    notes: '',
    bom: [],
    output: [],
    packaging: {
      packingNote: '',
      pcsPerBox: undefined,
      boxesPerPallet: undefined,
      plannedPallets: undefined,
      actual: { batches: [] }
    },
    isRepeat: false,
    outerType: 'plain',
    outerCode: '',
    rsOrderRef: '',
    deliveryAddress: '',
    weightPerBox: undefined,
    productionSpecs: {
      size: { width: undefined, length: undefined, height: undefined },
      forme: { width: undefined, length: undefined },
      sheet: { width: undefined, length: undefined },
      cutTo: { width: undefined, length: undefined },
      yieldPerSheet: undefined,
      labelNo: undefined,
      style: '',
      numberUp: undefined,
      printedColors: undefined,
      varnish: '',
      microns: undefined,
      board: '',
      oversPct: undefined,
      sheetWastage: undefined,
    },
    deliveryMethod: '',
    stageProgress: [],
    specialComponents: [],
    attachments: [],
    requireOutputToAdvance: true,
  })

  // Inventory products for planned materials
  const { data: products = [] } = useQuery<ListedProduct[]>({
    queryKey: ['products', workspaceId],
    queryFn: () => listProducts(workspaceId),
  })

  // Fetch groups for product organization
  const { data: groups = [] } = useQuery<Group[]>({
    queryKey: ['groups', workspaceId],
    queryFn: () => listGroups(workspaceId),
    enabled: !!workspaceId,
  })

  // Fetch customers for selection
  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ['customers', workspaceId],
    queryFn: () => listCustomers(workspaceId),
  })

  const { planned, hasPalletMismatch, sheetsNeededWithWastage } = useJobCalculations(formData)
  const { validateStep } = useJobValidation()

  // Set default workflow when workflows load
  useEffect(() => {
    if (workflows.length > 0) {
      const firstWorkflow = workflows[0]
      const firstStageId = firstWorkflow.stages?.[0]?.id || ''

      setFormData(prev => {
        if (!prev.workflowId && !prev.currentStageId) {
          return {
            ...prev,
            workflowId: firstWorkflow.id,
            currentStageId: firstStageId,
            plannedStageIds: (firstWorkflow.stages || []).map((s: any) => s.id)
          }
        }
        if (prev.workflowId && !prev.currentStageId) {
          const workflow = workflows.find(w => w.id === prev.workflowId)
          const stageId = workflow?.stages?.[0]?.id || ''
          return {
            ...prev,
            currentStageId: stageId,
            plannedStageIds: (workflow?.stages || []).map((s: any) => s.id)
          }
        }
        return prev
      })
    }
  }, [workflows])

  // Auto-sync first Planned Output with Product Details
  useEffect(() => {
    const base = {
      sku: formData.sku || '',
      name: formData.productName || '',
      qtyPlanned: Number(formData.quantity || 0),
      uom: formData.unit || 'pcs',
      qtyProduced: 0,
      stockable: true
    }
    // If key product fields are empty, don't enforce an output row
    if (!base.sku && !base.name) return
    setFormData(prev => {
      const rest = (prev.output || []).slice(1)
      return {
        ...prev,
        output: [base, ...rest]
      }
    })
  }, [formData.sku, formData.productName, formData.quantity, formData.unit])

  // Keep all output rows' UOM equal to selected Unit
  useEffect(() => {
    setFormData(prev => ({
      ...prev,
      output: (prev.output || []).map((o: any) => ({ ...o, uom: prev.unit }))
    }))
  }, [formData.unit])

  // Auto-update sheet quantity in BOM based on Sheets with Wastage
  useEffect(() => {
    if (sheetsNeededWithWastage !== undefined && sheetsNeededWithWastage > 0) {
      const sw = formData.productionSpecs?.sheet?.width
      const sl = formData.productionSpecs?.sheet?.length

      if (sw && sl) {
        setFormData(prev => {
          const nextBom = (prev.bom || []).map((item: any) => {
            const product = products.find(p => p.id === item.itemId)
            const dims = (product as any)?.dimensionsWxLmm
            if (dims && typeof dims === 'string') {
              const parts = dims.split('x')
              if (parts.length === 2) {
                const itemWidth = parseInt(parts[0].trim())
                const itemLength = parseInt(parts[1].trim())
                if (itemWidth === sw && itemLength === sl) {
                  return { ...item, qtyRequired: sheetsNeededWithWastage }
                }
              }
            }
            return item
          })
          return { ...prev, bom: nextBom }
        })
      }
    }
  }, [sheetsNeededWithWastage, formData.productionSpecs?.sheet?.width, formData.productionSpecs?.sheet?.length, products])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const errs: string[] = []
    for (let s = 1; s <= 5; s++) errs.push(...validateStep(s, formData))

    if (hasPalletMismatch) {
      const ok = confirm('Planned pallets override differs from automatic calculation. Do you want to proceed?')
      if (!ok) return
    }

    if (errs.length > 0) { alert(errs.join('\n')); return }

    // Build final payload
    // Map jobCode to code for API compatibility
    const { jobCode, ...restFormData } = formData

    // Transform BOM items: map 'qty' to 'qtyRequired' for API compatibility
    const transformedBom = (formData.bom || []).map((item: any) => ({
      ...item,
      qtyRequired: item.qtyRequired !== undefined ? item.qtyRequired : (item.qty !== undefined ? item.qty : 0),
      reserved: item.reserved !== undefined ? item.reserved : 0,
      consumed: item.consumed !== undefined ? item.consumed : 0,
    }))

    const payload = {
      ...restFormData,
      code: jobCode, // Map jobCode to code
      bom: transformedBom, // Use transformed BOM with qtyRequired
      plannedStart: formData.plannedStart ? new Date(formData.plannedStart) : undefined,
      plannedEnd: formData.plannedEnd ? new Date(formData.plannedEnd) : undefined,
      dueDate: formData.dueDate ? new Date(formData.dueDate) : new Date(),
      customer: {
        ...formData.customer,
        date: formData.customer.date ? new Date(formData.customer.date) : undefined
      },
      packaging: {
        // Direct packaging fields (not nested in 'planned')
        pcsPerBox: formData.packaging?.pcsPerBox,
        boxesPerPallet: formData.packaging?.boxesPerPallet,
        plannedBoxes: planned.plannedOuters || 0, // plannedOuters is actually boxes
        actualBoxes: 0, // Will be updated later when actual packaging is recorded
        plannedPallets: planned.pallets || 0,
        actualPallets: 0, // Will be updated later when actual packaging is recorded
        strapSpec: formData.packaging?.strapSpec || '',
        palletLabelsOnly: formData.packaging?.palletLabelsOnly || '',
        // Keep planned structure for backward compatibility if needed
        planned: {
          pcsPerBox: formData.packaging?.pcsPerBox,
          boxesPerPallet: formData.packaging?.boxesPerPallet,
          pallets: planned.pallets,
          totals: { outers: planned.plannedOuters, pallets: planned.pallets, quantity: planned.plannedQtyByPack },
          packingNote: formData.packaging?.packingNote || ''
        }
      }
    }

    onSubmit(payload)
  }

  const nextStep = () => {
    if (currentStep === 1 && hasPalletMismatch) {
      const ok = confirm('Planned pallets override differs from automatic calculation. Do you want to proceed?')
      if (!ok) return
    }
    const errs = validateStep(currentStep, formData)
    if (errs.length > 0) {
      alert(errs.join('\n'))
      return
    }
    setCurrentStep(prev => Math.min(prev + 1, totalSteps))
  }

  const prevStep = () => setCurrentStep(prev => Math.max(prev - 1, 1))

  const stepConfig = [
    { number: 1, title: 'Customer', icon: UserIcon, description: 'Customer and order details' },
    { number: 2, title: 'Product', icon: UserIcon, description: 'Product and quantity details' },
    { number: 3, title: 'Specs – Dimensions', icon: CogIcon, description: 'Sizes and sheet selection' },
    { number: 4, title: 'Materials & Outputs', icon: ShoppingCartIcon, description: 'BOM and planned outputs' },
    { number: 5, title: 'Workflow', icon: ClipboardDocumentListIcon, description: 'Production stages and schedule' },
    { number: 6, title: 'Logistics', icon: TruckIcon, description: 'Delivery and packaging' },
    { number: 7, title: 'Finalize', icon: DocumentTextIcon, description: 'Attachments and review' }
  ]

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header - Premium Gradient */}
        <div className="relative overflow-hidden">
          {/* Background gradient */}
          <div className="absolute inset-0 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900" />
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wMyI+PHBhdGggZD0iTTM2IDM0djItSDI0di0yaDEyek0zNiAyNHYySDI0di0yaDEyeiIvPjwvZz48L2c+PC9zdmc+')] opacity-50" />

          <div className="relative px-4 sm:px-6 py-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-white/10 backdrop-blur-sm rounded-xl border border-white/10">
                  <ClipboardDocumentListIcon className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="text-lg sm:text-xl font-bold text-white">Create Production Job</h1>
                  <p className="text-slate-400 text-xs sm:text-sm hidden sm:block">Set up a new manufacturing job with all necessary details</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2.5 text-slate-400 hover:text-white transition-colors hover:bg-white/10 rounded-xl"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            {/* Progress Steps - Premium Design */}
            <div className="mt-6 overflow-x-auto no-scrollbar pb-2 sm:pb-0">
              {/* Mobile: Compact step indicator */}
              <div className="sm:hidden flex items-center justify-center gap-2 mb-3">
                {stepConfig.map((step) => (
                  <button
                    key={step.number}
                    type="button"
                    onClick={() => setCurrentStep(step.number)}
                    className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${step.number === currentStep
                      ? 'w-8 bg-white'
                      : step.number < currentStep
                        ? 'bg-emerald-400'
                        : 'bg-white/30'
                      }`}
                  />
                ))}
              </div>
              <div className="sm:hidden text-center">
                <span className="text-white font-semibold">{stepConfig[currentStep - 1].title}</span>
                <span className="text-slate-400 text-sm ml-2">Step {currentStep} of {totalSteps}</span>
              </div>

              {/* Desktop: Full step indicator */}
              <div className="hidden sm:flex items-center justify-between min-w-max sm:min-w-0">
                {stepConfig.map((step, idx) => (
                  <div key={step.number} className="flex items-center flex-1 last:flex-none">
                    <button
                      type="button"
                      onClick={() => setCurrentStep(step.number)}
                      className={`flex items-center gap-3 transition-all duration-300 group ${step.number === currentStep ? 'scale-105' : ''
                        }`}
                    >
                      <div className={`relative flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-300 ${step.number < currentStep
                        ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30'
                        : step.number === currentStep
                          ? 'bg-white text-slate-900 shadow-lg shadow-white/20'
                          : 'bg-white/10 text-white/50 border border-white/10'
                        } font-semibold text-sm flex-shrink-0`}>
                        {step.number < currentStep ? (
                          <CheckIcon className="h-5 w-5" />
                        ) : (
                          <step.icon className="h-5 w-5" />
                        )}
                        {/* Active indicator ring */}
                        {step.number === currentStep && (
                          <div className="absolute inset-0 rounded-xl ring-4 ring-white/20 animate-pulse" />
                        )}
                      </div>
                      <div className="hidden lg:block text-left">
                        <div className={`text-sm font-semibold transition-colors ${step.number <= currentStep ? 'text-white' : 'text-white/50'
                          }`}>{step.title}</div>
                        <div className={`text-xs transition-colors ${step.number <= currentStep ? 'text-slate-400' : 'text-white/30'
                          }`}>{step.description}</div>
                      </div>
                    </button>
                    {idx < stepConfig.length - 1 && (
                      <div className="flex-1 mx-4 min-w-[30px]">
                        <div className="h-0.5 bg-white/10 rounded-full overflow-hidden">
                          <div
                            className={`h-full bg-emerald-400 rounded-full transition-all duration-500 ${step.number < currentStep ? 'w-full' : 'w-0'
                              }`}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
          {/* Step Content */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-gradient-to-b from-gray-50 to-white">
            {currentStep === 1 && (
              <JobBasicInfoStep
                formData={formData}
                setFormData={setFormData}
                customers={customers}
                products={products}
                groups={groups}
                generateUniqueJobCode={generateUniqueJobCode}
                mode="customer"
              />
            )}
            {currentStep === 2 && (
              <JobBasicInfoStep
                formData={formData}
                setFormData={setFormData}
                customers={customers}
                products={products}
                groups={groups}
                generateUniqueJobCode={generateUniqueJobCode}
                mode="product"
              />
            )}
            {currentStep === 3 && (
              <JobSpecsStep
                formData={formData}
                setFormData={setFormData}
                sheetProducts={products}
                groups={groups}
              />
            )}
            {currentStep === 4 && (
              <JobMaterialsStep
                formData={formData}
                setFormData={setFormData}
                products={products}
              />
            )}
            {currentStep === 5 && (
              <JobWorkflowStep
                formData={formData}
                setFormData={setFormData}
                workflows={workflows}
                workcenters={workcenters}
                resources={resources}
              />
            )}
            {currentStep === 6 && (
              <JobPackagingStep
                formData={formData}
                setFormData={setFormData}
                planned={planned}
              />
            )}
            {currentStep === 7 && (
              <JobFinalizeStep
                formData={formData}
                setFormData={setFormData}
              />
            )}
          </div>

          {/* Footer - Premium Design */}
          <div className="bg-white border-t border-gray-100 px-4 sm:px-6 py-4">
            <div className="flex items-center justify-between">
              {/* Back Button */}
              <button
                type="button"
                onClick={prevStep}
                disabled={currentStep === 1}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all ${currentStep === 1
                  ? 'text-gray-300 cursor-not-allowed'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                <span className="hidden sm:inline">Back</span>
              </button>

              {/* Progress indicator */}
              <div className="hidden sm:flex items-center gap-2">
                <span className="text-sm text-gray-500">Step {currentStep} of {totalSteps}</span>
                <div className="w-32 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full transition-all duration-500"
                    style={{ width: `${(currentStep / totalSteps) * 100}%` }}
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 sm:gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl font-medium text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-all"
                >
                  Cancel
                </button>
                {currentStep < totalSteps ? (
                  <button
                    type="button"
                    onClick={nextStep}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm bg-slate-900 text-white hover:bg-slate-800 shadow-lg shadow-slate-900/20 transition-all active:scale-95"
                  >
                    <span>Next</span>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-semibold text-sm bg-gradient-to-r from-emerald-500 to-green-600 text-white hover:from-emerald-600 hover:to-green-700 shadow-lg shadow-emerald-500/30 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? (
                      <>
                        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        <span>Creating...</span>
                      </>
                    ) : (
                      <>
                        <CheckIcon className="w-4 h-4" />
                        <span>Create Job</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}