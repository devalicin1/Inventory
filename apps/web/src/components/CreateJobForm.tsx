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
  const totalSteps = 6

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
    { number: 1, title: 'Basic Info', icon: UserIcon, description: 'Customer and product details' },
    { number: 2, title: 'Specifications', icon: CogIcon, description: 'Technical specifications' },
    { number: 3, title: 'Materials & Outputs', icon: ShoppingCartIcon, description: 'BOM and planned outputs' },
    { number: 4, title: 'Workflow', icon: ClipboardDocumentListIcon, description: 'Production stages and schedule' },
    { number: 5, title: 'Logistics', icon: TruckIcon, description: 'Delivery and packaging' },
    { number: 6, title: 'Finalize', icon: DocumentTextIcon, description: 'Attachments and review' }
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white sm:rounded-xl w-full h-full sm:h-[95vh] max-w-6xl overflow-hidden flex flex-col shadow-2xl">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary-50 rounded-lg">
                <ClipboardDocumentListIcon className="h-6 w-6 text-primary-600" />
              </div>
              <div>
                <h1 className="text-lg sm:text-xl font-semibold text-gray-900">Create Production Job</h1>
                <p className="text-gray-600 text-xs sm:text-sm hidden sm:block">Set up a new manufacturing job with all necessary details</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 transition-colors hover:bg-gray-100 rounded-lg"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>

          {/* Progress Steps */}
          <div className="mt-6 overflow-x-auto no-scrollbar pb-2 sm:pb-0">
            <div className="flex items-center justify-between min-w-max sm:min-w-0 gap-4 sm:gap-0">
              {stepConfig.map((step) => (
                <div key={step.number} className="flex items-center flex-1 last:flex-none">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(step.number)}
                    className={`flex items-center gap-3 transition-all ${step.number <= currentStep ? 'text-primary-600' : 'text-gray-400'
                      } ${step.number === currentStep ? 'scale-105' : ''}`}
                  >
                    <div className={`flex items-center justify-center w-8 h-8 rounded-lg border-2 transition-all ${step.number <= currentStep
                      ? 'bg-primary-600 border-primary-600 text-white shadow-sm'
                      : 'border-gray-300 text-gray-400'
                      } font-medium text-sm flex-shrink-0`}>
                      {step.number < currentStep ? (
                        <CheckIcon className="h-4 w-4" />
                      ) : (
                        step.number
                      )}
                    </div>
                    <div className="hidden md:block text-left">
                      <div className="text-sm font-medium">{step.title}</div>
                      <div className="text-xs text-gray-500">{step.description}</div>
                    </div>
                    {/* Mobile Title */}
                    <div className="block md:hidden text-left">
                      <div className="text-sm font-medium">{step.title}</div>
                    </div>
                  </button>
                  {step.number < totalSteps && (
                    <div className={`flex-1 h-0.5 mx-4 rounded-full min-w-[20px] ${step.number < currentStep ? 'bg-primary-600' : 'bg-gray-200'
                      } transition-colors`} />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
            {currentStep === 1 && (
              <JobBasicInfoStep
                formData={formData}
                setFormData={setFormData}
                customers={customers}
                products={products}
                groups={groups}
                generateUniqueJobCode={generateUniqueJobCode}
              />
            )}
            {currentStep === 2 && (
              <JobSpecsStep
                formData={formData}
                setFormData={setFormData}
                sheetProducts={products}
                groups={groups}
              />
            )}
            {currentStep === 3 && (
              <JobMaterialsStep
                formData={formData}
                setFormData={setFormData}
                products={products}
              />
            )}
            {currentStep === 4 && (
              <JobWorkflowStep
                formData={formData}
                setFormData={setFormData}
                workflows={workflows}
                workcenters={workcenters}
                resources={resources}
              />
            )}
            {currentStep === 5 && (
              <JobPackagingStep
                formData={formData}
                setFormData={setFormData}
                planned={planned}
              />
            )}
            {currentStep === 6 && (
              <JobFinalizeStep
                formData={formData}
                setFormData={setFormData}
              />
            )}
          </div>

          {/* Footer */}
          <div className="bg-white border-t border-gray-200 px-6 py-4 flex items-center justify-between">
            <Button
              type="button"
              variant="ghost"
              onClick={prevStep}
              disabled={currentStep === 1}
            >
              Back
            </Button>
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="secondary"
                onClick={onClose}
              >
                Cancel
              </Button>
              {currentStep < totalSteps ? (
                <Button
                  type="button"
                  onClick={nextStep}
                >
                  Next Step
                </Button>
              ) : (
                <Button
                  type="submit"
                  isLoading={isLoading}
                >
                  Create Job
                </Button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}