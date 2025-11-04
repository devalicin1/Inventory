import { useState, useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { listProducts, type ListedProduct } from '../api/inventory'
import { listCustomers, type Customer } from '../api/production-jobs'
import { 
  XMarkIcon, 
  CheckIcon,
  ChevronRightIcon,
  ChevronLeftIcon,
  CubeIcon,
  CalendarIcon,
  UserGroupIcon,
  ClipboardDocumentListIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  ShoppingCartIcon,
  UserIcon,
  DocumentTextIcon,
  TruckIcon,
  CogIcon,
  TagIcon,
  PhotoIcon,
  WrenchScrewdriverIcon,
  ChevronDownIcon
} from '@heroicons/react/24/outline'

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
  const [materialSearch, setMaterialSearch] = useState('')
  const [sheetProductSearch, setSheetProductSearch] = useState('')
  
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
    const planned = (workflows.find((w: any) => w.id === wfId)?.stages || workflows[0]?.stages || []).map((s: any) => s.id)
    const out0 = (j.output && j.output[0]) ? j.output[0] : null
    return {
      jobCode: uniqueJobCode,
      sku: j.sku || '',
      productName: j.productName || '',
      quantity: j.quantity || 1,
      unit: j.unit || 'pcs',
      priority: j.priority || 3,
      workflowId: wfId,
      currentStageId: planned[0] || '',
      plannedStageIds: planned,
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
      notes: j.notes || '',
      bom: (j.bom || []).map((b: any) => ({ ...b, reserved: 0, consumed: 0 })),
      output: out0 ? [{ ...out0, qtyProduced: 0 }] : [],
      packaging: j.packaging ? { ...j.packaging } : { packingNote: '', pcsPerBox: undefined, boxesPerPallet: undefined, plannedPallets: undefined, actual: { batches: [] as any[] } },
      isRepeat: Boolean((j as any).isRepeat),
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

  const [formData, setFormData] = useState(initialFromJob || {
    jobCode: uniqueJobCode,
    sku: '',
    productName: '',
    quantity: 1,
    unit: 'pcs',
    priority: 3,
    workflowId: workflows[0]?.id || '',
    currentStageId: getInitialStageId(),
    plannedStageIds: (workflows[0]?.stages || []).map((s: any) => s.id),
    status: 'draft' as const,
    assignees: [] as string[],
    workcenterId: '',
    plannedStart: '',
    plannedEnd: '',
    dueDate: '',
    customer: { id: '', name: '', orderNo: '', ref: '', estNo: '', date: getTodayDate() as any },
    internalRef: uniqueJobCode,
    customerPo: '',
    notes: '',
    bom: [] as any[],
    output: [] as any[],
    packaging: { 
      packingNote: '', 
      pcsPerBox: undefined as number | undefined, 
      boxesPerPallet: undefined as number | undefined, 
      plannedPallets: undefined as number | undefined, 
      actual: { batches: [] as any[] } 
    } as any,
    isRepeat: false,
    outerType: 'plain' as 'plain' | 'std_ptd' | 'bespoke',
    outerCode: '',
    rsOrderRef: '',
    deliveryAddress: '',
    weightPerBox: undefined as number | undefined,
    productionSpecs: {
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
    deliveryMethod: '',
    stageProgress: [] as any[],
    specialComponents: [] as any[],
    attachments: [] as any[],
  })

  // Inventory products for planned materials
  const { data: products = [] } = useQuery<ListedProduct[]>({
    queryKey: ['products', workspaceId],
    queryFn: () => listProducts(workspaceId),
  })

  // Fetch customers for selection
  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ['customers', workspaceId],
    queryFn: () => listCustomers(workspaceId),
  })

  const filteredProducts = products.filter(p => {
    if (!materialSearch) return true
    const t = materialSearch.toLowerCase()
    return p.name.toLowerCase().includes(t) || p.sku.toLowerCase().includes(t)
  })

  const filteredSheetProducts = products.filter(p => {
    if (!sheetProductSearch) return true
    const t = sheetProductSearch.toLowerCase()
    return p.name.toLowerCase().includes(t) || p.sku.toLowerCase().includes(t)
  })

  const handleSheetProductSelect = (productId: string) => {
    const product = products.find(p => p.id === productId)
    if (!product) return

    setFormData(prev => {
      const newSpecs = { ...prev.productionSpecs }
      
      // Parse dimensions if available
      const dims = (product as any).dimensionsWxLmm
      if (dims && typeof dims === 'string') {
        const parts = dims.split('x')
        if (parts.length === 2) {
          const width = parseInt(parts[0].trim())
          const length = parseInt(parts[1].trim())
          if (!isNaN(width) && !isNaN(length)) {
            newSpecs.sheet = {
              ...newSpecs.sheet,
              width,
              length
            }
          }
        }
      }

      // Parse microns from cal field if available
      const cal = (product as any).cal
      if (cal) {
        const microns = parseFloat(cal)
        if (!isNaN(microns)) {
          newSpecs.microns = microns
        }
      }

      // Copy GSM and Tags from selected sheet product if available
      const gsm = (product as any).gsm
      if (gsm) {
        (newSpecs as any).gsm = String(gsm)
      }
      const tags = (product as any).tags
      if (Array.isArray(tags)) {
        (newSpecs as any).tags = tags.filter(Boolean)
      }

      // Add sheet to BOM if not already present
      const nextBom = [...(prev.bom || [])]
      const existingBomItem = nextBom.find(b => b.sku === product.sku)
      
      if (!existingBomItem) {
        nextBom.push({ 
          itemId: product.id, 
          sku: product.sku, 
          name: product.name, 
          qtyRequired: 1, // Will be updated by auto-calc
          uom: product.uom, 
          reserved: 0, 
          consumed: 0, 
          lot: '' 
        })
      }

      return {
        ...prev,
        productionSpecs: newSpecs,
        bom: nextBom
      }
    })

    setSheetProductSearch('')
  }

  const addMaterial = (productId: string) => {
    const p = products.find(pr => pr.id === productId)
    if (!p) return
    const nextBom = [...(formData.bom || [])]
    if (nextBom.find(b => b.sku === p.sku)) return
    const initialQty = Math.min(1, Number(p.qtyOnHand || 0))
    nextBom.push({ 
      itemId: p.id, 
      sku: p.sku, 
      name: p.name, 
      qtyRequired: initialQty, 
      uom: p.uom, 
      reserved: 0, 
      consumed: 0, 
      lot: '' 
    })
    setFormData({ ...formData, bom: nextBom })
    setMaterialSearch('')
  }

  const updateBomQty = (index: number, qty: number) => {
    const next = [...(formData.bom || [])]
    if (!next[index]) return
    const sku = next[index].sku
    const prod = products.find(p => p.sku === sku)
    const max = Number(prod?.qtyOnHand || 0)
    if (qty > max) {
      const proceed = confirm(`Requested quantity exceeds stock for ${sku} (available: ${max}). Add anyway?`)
      if (proceed) {
        next[index].qtyRequired = qty
      } else {
        next[index].qtyRequired = max
      }
    } else {
      next[index].qtyRequired = qty
    }
    setFormData({ ...formData, bom: next })
  }

  const removeBomRow = (index: number) => {
    const next = [...(formData.bom || [])]
    next.splice(index, 1)
    setFormData({ ...formData, bom: next })
  }

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

  // Auto-update Planned Output based on Product Details
  useEffect(() => {
    // Only update if we have product details
    if (formData.sku && formData.productName && formData.quantity > 0) {
      const hasOutput = formData.output && formData.output.length > 0
      
      // If no outputs exist, create one from product details
      if (!hasOutput) {
        setFormData(prev => ({
          ...prev,
          output: [{
            sku: prev.sku,
            name: prev.productName,
            qty: prev.quantity,
            uom: prev.unit
          }]
        }))
      } else {
        // Update the first output if it matches the product details (to avoid overwriting user-added outputs)
        const firstOutput = formData.output[0]
        const matchesProduct = firstOutput.sku === formData.sku || 
                              firstOutput.name === formData.productName
        
        if (matchesProduct) {
          setFormData(prev => ({
            ...prev,
            output: prev.output.map((o: any, idx: number) => 
              idx === 0 
                ? { ...o, sku: prev.sku, name: prev.productName, qty: prev.quantity, uom: prev.unit }
                : o
            )
          }))
        }
      }
    }
  }, [formData.sku, formData.productName, formData.quantity, formData.unit])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const errs: string[] = []
    for (let s = 1; s <= 5; s++) errs.push(...validateStep(s, formData))
    if (!formData.outerType) errs.push('Outer type is required')
    (formData.packaging?.actual?.batches || []).forEach((b: any, i: number) => {
      if (b && b.outersPerPallet && b.totalOuters) errs.push(`Actuals row ${i+1}: Specify either Outers/Pallet or Total Outers, not both`)
    })
    const ea = formData.packaging?.pcsPerBox
    const opp = formData.packaging?.boxesPerPallet
    if (ea && opp && hasPalletMismatch) {
      const ok = confirm('Planned pallets override differs from automatic calculation. Do you want to proceed?')
      if (!ok) return
    }
    if (errs.length > 0) { alert(errs.join('\n')); return }
    onSubmit(buildPayload())
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

  const selectedWorkflow = workflows.find(w => w.id === formData.workflowId)
  const isPlanLocked = useMemo(() => {
    const s = String(formData.status || '')
    return s === 'packed' || s === 'shipped' || s === 'completed'
  }, [formData.status])

  // Packing plan calculations
  const calcPlanned = (
    qty: number,
    ea: number | undefined,
    opp: number | undefined,
    override?: number | undefined,
    unit?: string
  ) => {
    const eaSafe = Math.max(1, (ea ?? 0) | 0)
    const oppSafe = Math.max(1, (opp ?? 0) | 0)
    
    let plannedOuters: number
    let plannedQtyByPack: number
    
    if (unit === 'box' || unit === 'units') {
      // When unit is 'box', qty is in boxes
      // ea represents pieces per box, opp represents boxes per pallet
      // Calculate total pieces: qty boxes * ea pieces per box
      const totalPieces = (qty || 0) * eaSafe
      
      // When unit is 'box', "Boxes/Outer" field actually means "Pieces per Outer"
      // Calculate outers: total pieces / pieces per outer
      plannedOuters = Math.ceil(totalPieces / eaSafe)
      
      // Calculate pallets based on boxes
      const boxesPerPallet = oppSafe
      const fullPallets = Math.floor((qty || 0) / boxesPerPallet)
      const remainderBoxes = (qty || 0) - fullPallets * boxesPerPallet
      
      // Planned qty by pack is total pieces packed
      plannedQtyByPack = totalPieces
      const leftover = 0 // No leftover when working with boxes directly
      
      return {
        plannedOuters,
        pallets: fullPallets + (remainderBoxes > 0 ? 1 : 0),
        plannedQtyByPack,
        leftover,
        fullPallets,
        remainderOuters: 0,
        palletsAuto: fullPallets + (remainderBoxes > 0 ? 1 : 0)
      }
    } else {
      // When unit is 'pcs', standard calculation
      plannedOuters = Math.ceil((qty || 0) / eaSafe)
      plannedQtyByPack = plannedOuters * eaSafe
    }
    
    const fullPallets = Math.floor(plannedOuters / oppSafe)
    const remainderOuters = plannedOuters - fullPallets * oppSafe
    const palletsAuto = fullPallets + (remainderOuters > 0 ? 1 : 0)
    const pallets = override && override > 0 ? override : palletsAuto
    const leftover = plannedQtyByPack - (qty || 0)
    
    return { plannedOuters, pallets, plannedQtyByPack, leftover, fullPallets, remainderOuters, palletsAuto }
  }

  const planned = useMemo(() =>
    calcPlanned(
      formData.quantity || 0,
      formData.packaging?.pcsPerBox,
      formData.packaging?.boxesPerPallet,
      formData.packaging?.plannedPallets,
      formData.unit
    ),
  [formData.quantity, formData.packaging?.pcsPerBox, formData.packaging?.boxesPerPallet, formData.packaging?.plannedPallets, formData.unit])

  const hasPalletMismatch = useMemo(() => {
    const o = formData.packaging?.plannedPallets
    return !!(o && o > 0 && o !== planned.palletsAuto)
  }, [formData.packaging?.plannedPallets, planned.palletsAuto])

  // Schedule calculations
  const leadTimeMs = useMemo(() => {
    if (!formData.plannedStart || !formData.plannedEnd) return undefined
    const s = new Date(formData.plannedStart).getTime()
    const e = new Date(formData.plannedEnd).getTime()
    if (isNaN(s) || isNaN(e) || e < s) return undefined
    return e - s
  }, [formData.plannedStart, formData.plannedEnd])

  const scheduleSlackMs = useMemo(() => {
    if (!formData.plannedEnd || !formData.dueDate) return undefined
    const e = new Date(formData.plannedEnd).getTime()
    const d = new Date(formData.dueDate).getTime()
    if (isNaN(e) || isNaN(d)) return undefined
    return d - e
  }, [formData.plannedEnd, formData.dueDate])

  // Specs calculations
  const theoreticalNumberUp = useMemo(() => {
    const sw = formData.productionSpecs?.sheet?.width || 0
    const sl = formData.productionSpecs?.sheet?.length || 0
    const cw = formData.productionSpecs?.cutTo?.width || 0
    const cl = formData.productionSpecs?.cutTo?.length || 0
    if (sw > 0 && sl > 0 && cw > 0 && cl > 0) {
      return Math.floor(sw / cw) * Math.floor(sl / cl)
    }
    return undefined
  }, [formData.productionSpecs?.sheet?.width, formData.productionSpecs?.sheet?.length, formData.productionSpecs?.cutTo?.width, formData.productionSpecs?.cutTo?.length])

  const sheetsNeeded = useMemo(() => {
    const nUp = formData.productionSpecs?.numberUp || 0
    if (nUp > 0) {
      // For 'box' or 'units', convert to pieces first
      let totalQty = formData.quantity || 0
      if (formData.unit === 'box' || formData.unit === 'units') {
        const pcsPerBox = formData.packaging?.pcsPerBox || 1
        totalQty = totalQty * pcsPerBox
      }
      return Math.ceil(totalQty / nUp)
    }
    return undefined
  }, [formData.quantity, formData.unit, formData.packaging?.pcsPerBox, formData.productionSpecs?.numberUp])

  const sheetsNeededWithOvers = useMemo(() => {
    if (sheetsNeeded === undefined) return undefined
    const overs = formData.productionSpecs?.oversPct || 0
    return Math.ceil(sheetsNeeded * (1 + (overs > 0 ? overs / 100 : 0)))
  }, [sheetsNeeded, formData.productionSpecs?.oversPct])

  const sheetsNeededWithWastage = useMemo(() => {
    if (sheetsNeededWithOvers === undefined) return undefined
    const wastage = formData.productionSpecs?.sheetWastage || 0
    return sheetsNeededWithOvers + wastage
  }, [sheetsNeededWithOvers, formData.productionSpecs?.sheetWastage])

  // Auto-update sheet quantity in BOM based on Sheets with Wastage
  useEffect(() => {
    if (sheetsNeededWithWastage !== undefined && sheetsNeededWithWastage > 0) {
      // Find the sheet item in BOM - it should be the item that was selected via handleSheetProductSelect
      // We'll look for items that match the sheet dimensions
      const sw = formData.productionSpecs?.sheet?.width
      const sl = formData.productionSpecs?.sheet?.length
      
      if (sw && sl) {
        setFormData(prev => {
          const nextBom = (prev.bom || []).map((item: any) => {
            // Match by checking if this item has the same dimensions as the selected sheet
            const product = products.find(p => p.id === item.itemId)
            const dims = (product as any)?.dimensionsWxLmm
            if (dims && typeof dims === 'string') {
              const parts = dims.split('x')
              if (parts.length === 2) {
                const itemWidth = parseInt(parts[0].trim())
                const itemLength = parseInt(parts[1].trim())
                if (itemWidth === sw && itemLength === sl) {
                  // This is the sheet item, update its quantity
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

  // Actuals calculations (client-side)
  const computeBatch = (b: any) => {
    const pallets = Number(b.pallets || 0)
    const outersPerPallet = Number(b.outersPerPallet || 0)
    const totalOuters = b.totalOuters ? Number(b.totalOuters) : undefined
    const qtyPerOuter = Number(b.qtyPerOuter || 0)
    const outers = totalOuters !== undefined && totalOuters > 0 ? totalOuters : (pallets > 0 && outersPerPallet > 0 ? pallets * outersPerPallet : 0)
    const subQty = outers > 0 && qtyPerOuter > 0 ? outers * qtyPerOuter : 0
    return { pallets, outers, subQty }
  }

  const computeActualTotals = (batches: any[]) => {
    return batches.reduce((acc, b) => {
      const row = computeBatch(b)
      acc.pallets += row.pallets
      acc.outers += row.outers
      acc.quantity += row.subQty
      return acc
    }, { pallets: 0, outers: 0, quantity: 0 })
  }

  // Helper function to format customer address
  const formatAddress = (address?: { street?: string; city?: string; state?: string; zipCode?: string; country?: string }) => {
    if (!address) return ''
    const parts = [
      address.street,
      address.city,
      address.state,
      address.zipCode,
      address.country
    ].filter(Boolean)
    return parts.join(', ')
  }

  // Get selected customer details for display
  const selectedCustomer = formData.customer.id ? customers.find(c => c.id === formData.customer.id) : null

  // Handle customer selection
  const handleCustomerSelect = (customerId: string) => {
    if (!customerId) {
      // Reset customer info when deselecting
      setFormData(prev => ({
        ...prev,
        customer: { id: '', name: '', orderNo: '', ref: '', estNo: '', date: getTodayDate() as any }
      }))
      return
    }

    const customer = customers.find(c => c.id === customerId)
    if (!customer) return

    // Update customer information and generate new job code with customer initials
    const newJobCode = generateUniqueJobCode(customer.name)
    
    setFormData(prev => {
      const updated = {
        ...prev,
        customer: {
          ...prev.customer,
          id: customer.id,
          name: customer.name
        },
        jobCode: newJobCode,
        internalRef: newJobCode
      }
      
      // Auto-fill delivery address from shipping address if available
      const shippingAddress = formatAddress(customer.shippingAddress)
      if (shippingAddress) {
        // Only auto-fill if delivery address is empty
        if (!prev.deliveryAddress) {
          updated.deliveryAddress = shippingAddress
        }
      }
      
      return updated
    })
  }

  const actualBatches = formData.packaging?.actual?.batches || []
  const actualTotals = computeActualTotals(actualBatches)
  const plannedTotals = {
    pallets: planned.pallets,
    outers: planned.plannedOuters,
    quantity: planned.plannedQtyByPack,
  }
  const variance = {
    pallets: actualTotals.pallets - plannedTotals.pallets,
    outers: actualTotals.outers - plannedTotals.outers,
    quantity: actualTotals.quantity - plannedTotals.quantity,
  }

  // Step validation
  const validateStep = (step: number, data: any) => {
    const errs: string[] = []
    if (step === 1) {
      if (!data.customer?.name) errs.push('Customer name is required')
      if (!data.customer?.date) errs.push('Date is required')
      if (!data.productName) errs.push('Product name is required')
      if (!(data.quantity > 0)) errs.push('Quantity must be > 0')
      if (data.unit === 'pcs' || data.unit === 'units' || data.unit === 'box') {
        const ea = data.packaging?.pcsPerBox
        const opp = data.packaging?.boxesPerPallet
        if (!(ea > 0)) errs.push('Pieces/Outer or Boxes/Outer must be > 0')
        if (!(opp > 0)) errs.push('Outers/Pallet must be > 0')
      }
    }
    if (step === 2) {
      const s = data.productionSpecs || {}
      if (!(s?.size?.width > 0 && s?.size?.length > 0 && s?.size?.height >= 0)) errs.push('Size (W,L,H) is required')
      if (!(s?.numberUp > 0)) errs.push('Number Up must be > 0')
      if (!(s?.printedColors >= 0)) errs.push('Printed colours is required')
    }
    if (step === 3) {
      if (!Array.isArray(data.output) || data.output.length === 0) {
        errs.push('At least one planned output is required')
      }
      (data.output || []).forEach((o: any, idx: number) => {
        if (!(o.qty > 0)) errs.push(`Output row ${idx+1}: Quantity must be > 0`)
        if (!o.uom) errs.push(`Output row ${idx+1}: UOM is required`)
        if (!(o.sku || o.name)) errs.push(`Output row ${idx+1}: SKU or Name is required`)
      })
    }
    if (step === 4) {
      if (!data.workflowId) errs.push('Workflow is required')
      if (!Array.isArray(data.plannedStageIds) || data.plannedStageIds.length === 0) errs.push('At least one stage is required')
      if (!data.currentStageId || !(data.plannedStageIds || []).includes(data.currentStageId)) errs.push('Starting stage must be among selected stages')
      const s = data.plannedStart ? new Date(data.plannedStart).getTime() : undefined
      const e = data.plannedEnd ? new Date(data.plannedEnd).getTime() : undefined
      const d = data.dueDate ? new Date(data.dueDate).getTime() : undefined
      if (s !== undefined && e !== undefined && e < s) errs.push('Planned end must be after start')
      if (e !== undefined && d !== undefined && e > d) errs.push('Planned end must be on/before due date')
    }
    if (step === 5) {
      if (!data.outerType) errs.push('Outer type is required')
    }
    return errs
  }

  const stepConfig = [
    {
      number: 1,
      title: 'Basic Info',
      icon: UserIcon,
      description: 'Customer and product details'
    },
    {
      number: 2,
      title: 'Specifications',
      icon: CogIcon,
      description: 'Technical specifications'
    },
    {
      number: 3,
      title: 'Materials & Outputs',
      icon: ShoppingCartIcon,
      description: 'BOM and planned outputs'
    },
    {
      number: 4,
      title: 'Workflow',
      icon: ClipboardDocumentListIcon,
      description: 'Production stages and schedule'
    },
    {
      number: 5,
      title: 'Logistics',
      icon: TruckIcon,
      description: 'Delivery and packaging'
    },
    {
      number: 6,
      title: 'Finalize',
      icon: DocumentTextIcon,
      description: 'Attachments and review'
    }
  ]

  const buildPayload = () => ({
    ...formData,
    code: (formData as any).code || formData.jobCode,
    jobCode: formData.jobCode,
    plannedStart: formData.plannedStart ? new Date(formData.plannedStart) : undefined,
    plannedEnd: formData.plannedEnd ? new Date(formData.plannedEnd) : undefined,
    dueDate: formData.dueDate ? new Date(formData.dueDate) : new Date(),
    customer: {
      ...formData.customer,
      orderNo: formData.customerPo || formData.customer.orderNo,
      ref: undefined,
      date: formData.customer.date ? new Date(formData.customer.date as any) : undefined
    },
    internalRef: formData.internalRef,
    customerPo: formData.customerPo,
    productionSpecs: formData.productionSpecs && Object.keys(formData.productionSpecs).length > 0 ? formData.productionSpecs : undefined,
    packaging: formData.packaging && Object.keys(formData.packaging).length > 0 ? {
      ...formData.packaging,
      planned: {
        pcsPerBox: formData.packaging?.pcsPerBox,
        boxesPerPallet: formData.packaging?.boxesPerPallet,
        pallets: planned.pallets,
        totals: { outers: planned.plannedOuters, pallets: planned.pallets, quantity: planned.plannedQtyByPack },
        packingNote: formData.packaging?.packingNote || ''
      },
      actual: {
        batches: actualBatches,
        totals: actualTotals,
      },
      variance
    } : undefined,
    variance,
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[95vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 rounded-lg">
                <ClipboardDocumentListIcon className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">Create Production Job</h1>
                <p className="text-gray-600 text-sm">Set up a new manufacturing job with all necessary details</p>
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
          <div className="mt-6">
            <div className="flex items-center justify-between">
              {stepConfig.map((step) => (
                <div key={step.number} className="flex items-center flex-1 last:flex-none">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(step.number)}
                    className={`flex items-center gap-3 transition-all ${
                      step.number <= currentStep ? 'text-blue-600' : 'text-gray-400'
                    } ${step.number === currentStep ? 'scale-105' : ''}`}
                  >
                    <div className={`flex items-center justify-center w-8 h-8 rounded-lg border-2 transition-all ${
                      step.number <= currentStep 
                        ? 'bg-blue-600 border-blue-600 text-white shadow-sm' 
                        : 'border-gray-300 text-gray-400'
                    } font-medium text-sm`}>
                      {step.number < currentStep ? (
                        <CheckIcon className="h-4 w-4" />
                      ) : (
                        step.number
                      )}
                    </div>
                    <div className="hidden sm:block text-left">
                      <div className="text-sm font-medium">{step.title}</div>
                      <div className="text-xs text-gray-500">{step.description}</div>
                    </div>
                  </button>
                  {step.number < totalSteps && (
                    <div className={`flex-1 h-0.5 mx-4 rounded-full ${
                      step.number < currentStep ? 'bg-blue-600' : 'bg-gray-200'
                    } transition-colors`} />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
            {/* Step 1: Basic Information */}
            {currentStep === 1 && (
              <div className="max-w-4xl mx-auto">
                <div className="mb-8">
                  <h2 className="text-2xl font-bold text-gray-900">Basic Information</h2>
                  <p className="text-gray-600 mt-2">Enter customer details and product information</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Customer Information */}
                  <div className="space-y-6">
                    <div className="bg-white rounded-lg border border-gray-200 p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <UserIcon className="h-5 w-5 text-blue-600" />
                        Customer Information
                      </h3>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Customer *
                          </label>
                          <div className="relative">
                            <select
                              value={formData.customer.id || ''}
                              onChange={(e) => handleCustomerSelect(e.target.value)}
                              className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 transition-colors py-2.5 px-3 border bg-white appearance-none pr-10"
                            >
                              <option value="">Select a customer...</option>
                              {customers.filter(c => c.active).map((customer) => (
                                <option key={customer.id} value={customer.id}>
                                  {customer.name} {customer.companyName && `- ${customer.companyName}`}
                                </option>
                              ))}
                            </select>
                            <ChevronDownIcon className="absolute right-3 top-3 h-5 w-5 text-gray-400 pointer-events-none" />
                          </div>
                          {selectedCustomer && (
                            <div className="mt-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
                              <div className="text-sm text-blue-900 space-y-1">
                                <div className="font-medium">{selectedCustomer.name}</div>
                                {selectedCustomer.companyName && (
                                  <div className="text-blue-700">Company: {selectedCustomer.companyName}</div>
                                )}
                                {selectedCustomer.contactPerson && (
                                  <div className="text-blue-700">Contact: {selectedCustomer.contactPerson}</div>
                                )}
                                {selectedCustomer.email && (
                                  <div className="text-blue-700">Email: {selectedCustomer.email}</div>
                                )}
                                {selectedCustomer.phone && (
                                  <div className="text-blue-700">Phone: {selectedCustomer.phone}</div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                        {!formData.customer.id && (
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Or Enter Customer Name Manually *
                            </label>
                            <input
                              type="text"
                              placeholder="Enter customer name"
                              value={formData.customer.name}
                              onChange={(e) => {
                                const customerName = e.target.value
                                const newJobCode = generateUniqueJobCode(customerName)
                                setFormData({...formData, customer: {...formData.customer, name: customerName}, jobCode: newJobCode, internalRef: newJobCode})
                              }}
                              className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 transition-colors py-2.5 px-3 border"
                            />
                          </div>
                        )}
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Internal Reference
                            </label>
                            <input
                              type="text"
                              placeholder="Internal reference"
                              value={formData.internalRef}
                              readOnly
                              className="block w-full rounded-lg border-gray-300 shadow-sm bg-gray-50 text-gray-700 py-2.5 px-3 border cursor-not-allowed"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Customer PO
                            </label>
                            <input
                              type="text"
                              placeholder="PO number"
                              value={formData.customerPo}
                              onChange={(e) => setFormData({...formData, customerPo: e.target.value})}
                              className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 transition-colors py-2.5 px-3 border"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Estimate Number
                            </label>
                            <input
                              type="text"
                              placeholder="Estimate #"
                              value={formData.customer.estNo}
                              onChange={(e) => setFormData({...formData, customer: {...formData.customer, estNo: e.target.value}})}
                              className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 transition-colors py-2.5 px-3 border"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Job Type
                            </label>
                            <div className="flex gap-4 mt-2">
                              <label className="flex items-center gap-2">
                                <input
                                  type="radio"
                                  checked={!formData.isRepeat}
                                  onChange={() => setFormData({...formData, isRepeat: false})}
                                  className="text-blue-600 focus:ring-blue-500"
                                />
                                <span className="text-sm">New Job</span>
                              </label>
                              <label className="flex items-center gap-2">
                                <input
                                  type="radio"
                                  checked={formData.isRepeat}
                                  onChange={() => setFormData({...formData, isRepeat: true})}
                                  className="text-blue-600 focus:ring-blue-500"
                                />
                                <span className="text-sm">Repeat Job</span>
                              </label>
                            </div>
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Date *
                          </label>
                          <input
                            type="date"
                            value={formData.customer.date ? (typeof formData.customer.date === 'string' ? formData.customer.date : (formData.customer.date instanceof Date ? formData.customer.date.toISOString().split('T')[0] : '')) : ''}
                            onChange={(e) => setFormData({...formData, customer: {...formData.customer, date: e.target.value as any}})}
                            className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 transition-colors py-2.5 px-3 border"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Product Details */}
                  <div className="space-y-6">
                    <div className="bg-white rounded-lg border border-gray-200 p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <CubeIcon className="h-5 w-5 text-blue-600" />
                        Product Details
                      </h3>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Job Code
                          </label>
                          <input
                            type="text"
                            value={formData.jobCode}
                            readOnly
                            className="block w-full rounded-lg border-gray-300 shadow-sm bg-gray-50 text-gray-700 py-2.5 px-3 border cursor-not-allowed"
                            placeholder="e.g., JOB-2024-001"
                          />
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              SKU
                            </label>
                            <input
                              type="text"
                              value={formData.sku}
                              onChange={(e) => setFormData({...formData, sku: e.target.value})}
                              className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 transition-colors py-2.5 px-3 border"
                              placeholder="Product SKU"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Priority
                            </label>
                            <select
                              value={formData.priority}
                              onChange={(e) => setFormData({...formData, priority: Number(e.target.value)})}
                              className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 transition-colors py-2.5 px-3 border bg-white"
                            >
                              <option value={1}>Critical</option>
                              <option value={2}>High</option>
                              <option value={3}>Medium</option>
                              <option value={4}>Low</option>
                              <option value={5}>Very Low</option>
                            </select>
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Product Name *
                          </label>
                          <input
                            type="text"
                            value={formData.productName}
                            onChange={(e) => setFormData({...formData, productName: e.target.value})}
                            className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 transition-colors py-2.5 px-3 border"
                            placeholder="Enter full product name"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Quantity *
                            </label>
                            <input
                              type="number"
                              value={formData.quantity}
                              onChange={(e) => setFormData({...formData, quantity: Number(e.target.value)})}
                              className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 transition-colors py-2.5 px-3 border"
                              min="1"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Unit
                            </label>
                            <select
                              value={formData.unit}
                              onChange={(e) => setFormData({...formData, unit: e.target.value})}
                              className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 transition-colors py-2.5 px-3 border bg-white"
                            >
                              <option value="pcs">Pieces</option>
                              <option value="box">Box</option>
                              <option value="kg">Kilograms</option>
                              <option value="m">Meters</option>
                              <option value="L">Liters</option>
                              <option value="units">Units</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Quick Packing */}
                    {(formData.unit === 'pcs' || formData.unit === 'units' || formData.unit === 'box') && (
                      <div className="bg-white rounded-lg border border-gray-200 p-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                          <TagIcon className="h-5 w-5 text-blue-600" />
                          Packing Configuration
                        </h3>
                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Packing Note
                            </label>
                            <input
                              type="text"
                              placeholder="e.g., 200 EA OUTER"
                              value={formData.packaging?.packingNote || ''}
                              onChange={(e) => setFormData({ ...formData, packaging: { ...formData.packaging, packingNote: e.target.value } })}
                              className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 transition-colors py-2.5 px-3 border"
                            />
                          </div>
                          <div className="grid grid-cols-3 gap-3">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                {formData.unit === 'box' ? 'Boxes/Outer *' : formData.unit === 'units' ? 'Boxes/Outer *' : 'Pieces/Outer *'}
                              </label>
                              <input
                                type="number"
                                min="1"
                                value={formData.packaging?.pcsPerBox || ''}
                                onChange={(e) => setFormData({ ...formData, packaging: { ...formData.packaging, pcsPerBox: e.target.value ? Number(e.target.value) : undefined } })}
                                disabled={isPlanLocked}
                                className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 transition-colors py-2.5 px-3 border"
                                placeholder={formData.unit === 'box' ? 'e.g., 200' : formData.unit === 'units' ? 'e.g., 200' : 'e.g., 200'}
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">Outers/Pallet *</label>
                              <input
                                type="number"
                                min="1"
                                value={formData.packaging?.boxesPerPallet || ''}
                                onChange={(e) => setFormData({ ...formData, packaging: { ...formData.packaging, boxesPerPallet: e.target.value ? Number(e.target.value) : undefined } })}
                                disabled={isPlanLocked}
                                className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 transition-colors py-2.5 px-3 border"
                                placeholder="e.g., 40"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Planned Pallets {!formData.packaging?.plannedPallets && <span className="text-gray-500 text-xs">(Auto)</span>}
                              </label>
                              {formData.packaging?.plannedPallets ? (
                                <input
                                  type="number"
                                  min="1"
                                  value={formData.packaging.plannedPallets}
                                  onChange={(e) => setFormData({ ...formData, packaging: { ...formData.packaging, plannedPallets: e.target.value ? Number(e.target.value) : undefined } })}
                                  disabled={isPlanLocked}
                                  className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 transition-colors py-2.5 px-3 border"
                                />
                              ) : (
                                <div className="block w-full rounded-lg border-gray-300 shadow-sm py-2.5 px-3 border bg-blue-50">
                                  <span className="text-blue-900 font-medium">{planned.palletsAuto || 0}</span>
                                  <span className="text-blue-600 text-xs ml-2">(Auto)</span>
                                </div>
                              )}
                            </div>
                          </div>

                          {hasPalletMismatch && (
                            <div className="rounded-lg border border-amber-300 bg-amber-50 text-amber-800 p-3 text-sm">
                              Planned pallets override ({formData.packaging?.plannedPallets}) differs from auto calculation ({planned.palletsAuto})
                            </div>
                          )}

                          <div className="bg-blue-50 rounded-lg border border-blue-200 p-4">
                            <h4 className="text-sm font-semibold text-blue-900 mb-3">Packing Summary</h4>
                            <div className="grid grid-cols-2 gap-3 text-sm text-blue-900">
                              {formData.unit !== 'box' && formData.unit !== 'units' && (
                                <>
                                  <div className="flex justify-between"><span>Planned Outers</span><span className="font-semibold">{planned.plannedOuters}</span></div>
                                  <div className="flex justify-between"><span>Remainder Outers</span><span className="font-semibold">{planned.remainderOuters}</span></div>
                                </>
                              )}
                              <div className="flex justify-between"><span>Planned Pallets</span><span className="font-semibold">{planned.pallets}</span></div>
                              <div className="flex justify-between"><span>Full Pallets</span><span className="font-semibold">{planned.fullPallets}</span></div>
                              <div className="flex justify-between"><span>Total Quantity</span><span className="font-semibold">{planned.plannedQtyByPack}</span></div>
                              <div className="flex justify-between items-center">
                                <span>Leftover {formData.unit === 'box' ? 'Boxes' : formData.unit === 'units' ? 'Boxes' : 'Pieces'}</span>
                                <span className={`font-semibold ${planned.leftover === 0 ? 'text-green-700' : 'text-amber-700'}`}>{planned.leftover}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Specifications */}
            {currentStep === 2 && (
              <div className="max-w-4xl mx-auto">
                <div className="mb-8">
                  <h2 className="text-2xl font-bold text-gray-900">Product Specifications</h2>
                  <p className="text-gray-600 mt-2">Enter technical parameters and production details</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="space-y-6">
                    <div className="bg-white rounded-lg border border-gray-200 p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <CogIcon className="h-5 w-5 text-blue-600" />
                        Production Specifications
                      </h3>
                      <div className="space-y-6">
                        {/* Product Dimensions Section */}
                        <div className="border-b border-gray-200 pb-4">
                          <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                            <CubeIcon className="h-4 w-4 text-blue-500" />
                            Product Dimensions
                          </h4>
                          <div className="grid grid-cols-3 gap-3">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">Width (mm) *</label>
                              <input type="number" value={formData.productionSpecs?.size?.width || ''} onChange={(e) => setFormData({...formData, productionSpecs: {...formData.productionSpecs, size: {...formData.productionSpecs?.size, width: Number(e.target.value)}}})} className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 transition-colors py-2.5 px-3 border" />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">Length (mm) *</label>
                              <input type="number" value={formData.productionSpecs?.size?.length || ''} onChange={(e) => setFormData({...formData, productionSpecs: {...formData.productionSpecs, size: {...formData.productionSpecs?.size, length: Number(e.target.value)}}})} className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 transition-colors py-2.5 px-3 border" />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">Height (mm)</label>
                              <input type="number" value={formData.productionSpecs?.size?.height || ''} onChange={(e) => setFormData({...formData, productionSpecs: {...formData.productionSpecs, size: {...formData.productionSpecs?.size, height: Number(e.target.value)}}})} className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 transition-colors py-2.5 px-3 border" />
                            </div>
                          </div>
                        </div>

                        {/* Sheet Dimensions Section */}
                        <div className="border-b border-gray-200 pb-4">
                          <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                            <DocumentTextIcon className="h-4 w-4 text-blue-500" />
                            Sheet Dimensions
                          </h4>
                          <div className="mb-3">
                            <label className="block text-sm font-medium text-gray-700 mb-2">Select Sheet from Inventory</label>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={sheetProductSearch}
                                onChange={(e) => setSheetProductSearch(e.target.value)}
                                placeholder="Search sheets..."
                                className="flex-1 rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 transition-colors py-2 px-3 border text-sm"
                              />
                              <select
                                onChange={(e) => { if (e.target.value) handleSheetProductSelect(e.target.value) }}
                                className="rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 transition-colors py-2 px-3 border bg-white min-w-[140px] text-sm"
                              >
                                <option value="">Select Sheet</option>
                                {filteredSheetProducts.slice(0, 20).map(p => (
                                  <option key={p.id} value={p.id}>
                                    {p.sku} - {p.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">Sheet Width (mm)</label>
                              <input type="number" value={formData.productionSpecs?.sheet?.width || ''} onChange={(e) => setFormData({...formData, productionSpecs: {...formData.productionSpecs, sheet: {...formData.productionSpecs?.sheet, width: Number(e.target.value)}}})} className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 transition-colors py-2.5 px-3 border" />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">Sheet Length (mm)</label>
                              <input type="number" value={formData.productionSpecs?.sheet?.length || ''} onChange={(e) => setFormData({...formData, productionSpecs: {...formData.productionSpecs, sheet: {...formData.productionSpecs?.sheet, length: Number(e.target.value)}}})} className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 transition-colors py-2.5 px-3 border" />
                            </div>
                          </div>
                        </div>

                        {/* Forme Dimensions Section */}
                        <div className="border-b border-gray-200 pb-4">
                          <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                            <WrenchScrewdriverIcon className="h-4 w-4 text-blue-500" />
                            Forme Dimensions
                          </h4>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">Forme Width (mm)</label>
                              <input type="number" value={formData.productionSpecs?.forme?.width || ''} onChange={(e) => setFormData({...formData, productionSpecs: {...formData.productionSpecs, forme: {...formData.productionSpecs?.forme, width: Number(e.target.value)}}})} className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 transition-colors py-2.5 px-3 border" />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">Forme Length (mm)</label>
                              <input type="number" value={formData.productionSpecs?.forme?.length || ''} onChange={(e) => setFormData({...formData, productionSpecs: {...formData.productionSpecs, forme: {...formData.productionSpecs?.forme, length: Number(e.target.value)}}})} className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 transition-colors py-2.5 px-3 border" />
                            </div>
                          </div>
                        </div>

                        {/* Production Parameters */}
                        <div>
                          <h4 className="text-sm font-semibold text-gray-900 mb-3">Production Parameters</h4>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">Number Up *</label>
                              <input type="number" value={formData.productionSpecs?.numberUp || ''} onChange={(e) => setFormData({...formData, productionSpecs: {...formData.productionSpecs, numberUp: Number(e.target.value)}})} className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 transition-colors py-2.5 px-3 border" />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">Colors *</label>
                              <input type="number" value={formData.productionSpecs?.printedColors || ''} onChange={(e) => setFormData({...formData, productionSpecs: {...formData.productionSpecs, printedColors: Number(e.target.value)}})} className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 transition-colors py-2.5 px-3 border" />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3 mt-3">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">Varnish</label>
                              <input type="text" value={formData.productionSpecs?.varnish || ''} onChange={(e) => setFormData({...formData, productionSpecs: {...formData.productionSpecs, varnish: e.target.value}})} className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 transition-colors py-2.5 px-3 border" />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">Board Type</label>
                              <input type="text" value={formData.productionSpecs?.board || ''} onChange={(e) => setFormData({...formData, productionSpecs: {...formData.productionSpecs, board: e.target.value}})} className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 transition-colors py-2.5 px-3 border" />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3 mt-3">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">Overs Percentage</label>
                              <input type="number" value={formData.productionSpecs?.oversPct || ''} onChange={(e) => setFormData({...formData, productionSpecs: {...formData.productionSpecs, oversPct: Number(e.target.value)}})} className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 transition-colors py-2.5 px-3 border" />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">Microns</label>
                              <input type="number" value={formData.productionSpecs?.microns || ''} onChange={(e) => setFormData({...formData, productionSpecs: {...formData.productionSpecs, microns: Number(e.target.value)}})} className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 transition-colors py-2.5 px-3 border" />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3 mt-3">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">GSM</label>
                              <input type="text" value={(formData.productionSpecs as any)?.gsm || ''} onChange={(e) => setFormData({...formData, productionSpecs: { ...(formData.productionSpecs || {} as any), gsm: e.target.value } as any })} className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 transition-colors py-2.5 px-3 border" />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">Tags</label>
                              <input type="text" value={((formData.productionSpecs as any)?.tags || []).join(', ')} onChange={(e) => setFormData({...formData, productionSpecs: { ...(formData.productionSpecs || {} as any), tags: e.target.value.split(',').map(s => s.trim()).filter(Boolean) } as any })} className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 transition-colors py-2.5 px-3 border" placeholder="tag1, tag2" />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="bg-white rounded-lg border border-gray-200 p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Specifications Summary</h3>
                      <div className="space-y-3 text-sm">
                        <div className="flex justify-between py-2 border-b border-gray-100">
                          <span className="text-gray-600">Theoretical Number Up</span>
                          <span className="font-medium">{theoreticalNumberUp ?? 'N/A'}</span>
                        </div>
                        <div className="flex justify-between py-2 border-b border-gray-100">
                          <span className="text-gray-600">Sheets Needed</span>
                          <span className="font-medium">{sheetsNeeded ?? 'N/A'}</span>
                        </div>
                        <div className="flex justify-between py-2 border-b border-gray-100">
                          <span className="text-gray-600">Sheets with Overs</span>
                          <span className="font-medium">{sheetsNeededWithOvers ?? 'N/A'}</span>
                        </div>
                        <div className="pt-2">
                          <div className="flex justify-between items-center mb-3">
                            <label className="text-gray-600 font-medium">Sheet Wastage</label>
                            <input
                              type="number"
                              min="0"
                              value={formData.productionSpecs?.sheetWastage || ''}
                              onChange={(e) => setFormData({
                                ...formData,
                                productionSpecs: {
                                  ...formData.productionSpecs,
                                  sheetWastage: e.target.value ? Number(e.target.value) : undefined
                                }
                              })}
                              className="w-24 rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 transition-colors py-1.5 px-3 border text-right"
                              placeholder="0"
                            />
                          </div>
                        </div>
                        <div className="flex justify-between py-2 border-t border-gray-200 pt-2">
                          <span className="text-gray-900 font-semibold">Sheets with Wastage</span>
                          <span className="font-bold text-blue-600">{sheetsNeededWithWastage ?? 'N/A'}</span>
                        </div>
                      </div>

                      {theoreticalNumberUp !== undefined && formData.productionSpecs?.numberUp && theoreticalNumberUp !== formData.productionSpecs.numberUp && (
                        <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 text-amber-800 p-3 text-sm">
                          Layout mismatch: theoretical {theoreticalNumberUp} ≠ entered {formData.productionSpecs.numberUp}
                        </div>
                      )}
                    </div>

                    <div className="bg-white rounded-lg border border-gray-200 p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Additional Specifications</h3>
                      <div className="space-y-4">
                        {/* CutTo Dimensions Section */}
                        <div className="border-b border-gray-200 pb-4">
                          <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                            <WrenchScrewdriverIcon className="h-4 w-4 text-blue-500" />
                            CutTo Dimensions
                          </h4>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">CutTo Width (mm)</label>
                              <input type="number" value={formData.productionSpecs?.cutTo?.width || ''} onChange={(e) => setFormData({...formData, productionSpecs: {...formData.productionSpecs, cutTo: {...formData.productionSpecs?.cutTo, width: Number(e.target.value)}}})} className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 transition-colors py-2.5 px-3 border" />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">CutTo Length (mm)</label>
                              <input type="number" value={formData.productionSpecs?.cutTo?.length || ''} onChange={(e) => setFormData({...formData, productionSpecs: {...formData.productionSpecs, cutTo: {...formData.productionSpecs?.cutTo, length: Number(e.target.value)}}})} className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 transition-colors py-2.5 px-3 border" />
                            </div>
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Style</label>
                          <input type="text" value={formData.productionSpecs?.style || ''} onChange={(e) => setFormData({...formData, productionSpecs: {...formData.productionSpecs, style: e.target.value}})} className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 transition-colors py-2.5 px-3 border" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Materials & Outputs */}
            {currentStep === 3 && (
              <div className="max-w-4xl mx-auto">
                <div className="mb-8">
                  <h2 className="text-2xl font-bold text-gray-900">Materials & Outputs</h2>
                  <p className="text-gray-600 mt-2">Manage bill of materials and planned outputs</p>
                </div>

                <div className="grid grid-cols-1 gap-6">
                  {/* Materials Section */}
                  <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <ShoppingCartIcon className="h-5 w-5 text-blue-600" />
                      Required Materials
                    </h3>
                    <div className="space-y-4">
                      <div className="flex gap-3">
                        <div className="flex-1">
                          <input
                            type="text"
                            value={materialSearch}
                            onChange={(e) => setMaterialSearch(e.target.value)}
                            placeholder="Search materials by SKU or name..."
                            className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 transition-colors py-2.5 px-3 border"
                          />
                        </div>
                        <select
                          onChange={(e) => { if (e.target.value) addMaterial(e.target.value) }}
                          className="rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 transition-colors py-2.5 px-3 border bg-white min-w-[140px]"
                        >
                          <option value="">Add Item</option>
                          {filteredProducts.slice(0, 20).map(p => (
                            <option key={p.id} value={p.id}>
                              {p.sku} - {p.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      
                      {(formData.bom || []).length === 0 ? (
                        <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg">
                          <ShoppingCartIcon className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                          <p className="text-gray-500 text-sm">No materials added yet</p>
                          <p className="text-gray-400 text-xs mt-1">Search and add required materials above</p>
                        </div>
                      ) : (
                        <div className="space-y-3 max-h-80 overflow-y-auto pr-2">
                          {(formData.bom || []).map((b, i) => {
                            const product = products.find(p => p.sku === b.sku || p.id === b.itemId)
                            const availableQty = Number(product?.qtyOnHand || 0)
                            const isExceeding = b.qtyRequired > availableQty
                            
                            return (
                              <div key={i} className={`rounded-lg border p-4 transition-colors ${
                                isExceeding ? 'border-amber-300 bg-amber-50' : 'border-blue-200 bg-blue-50'
                              }`}>
                                <div className="flex items-start justify-between mb-3">
                                  <div className="flex items-start gap-3 flex-1 min-w-0">
                                    <div className={`w-2 h-2 rounded-full mt-2 ${
                                      isExceeding ? 'bg-amber-500' : 'bg-blue-500'
                                    }`}></div>
                                    <div className="flex-1 min-w-0">
                                      <div className="font-semibold text-gray-900 mb-1">{b.name}</div>
                                      <div className="text-xs text-gray-600 space-y-1">
                                        <div className="flex items-center gap-2">
                                          <span className="font-medium">SKU:</span>
                                          <span>{b.sku}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <span className="font-medium">Available:</span>
                                          <span className={`font-semibold ${
                                            isExceeding ? 'text-amber-600' : 'text-blue-600'
                                          }`}>
                                            {availableQty}
                                          </span>
                                          <span>{b.uom}</span>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center justify-between gap-3 pt-3 border-t border-blue-200">
                                  <label className="text-sm font-medium text-gray-700 whitespace-nowrap">
                                    Required Qty:
                                  </label>
                                  <div className="flex items-center gap-2 flex-1">
                                    <input
                                      type="number"
                                      min="0"
                                      value={b.qtyRequired}
                                      onChange={(e) => updateBomQty(i, Number(e.target.value))}
                                      className={`w-24 rounded-lg text-sm py-2 px-3 text-center focus:ring-blue-500 ${
                                        isExceeding ? 'border-amber-300 bg-amber-25' : 'border-gray-300'
                                      }`}
                                    />
                                    <span className="text-sm text-gray-600 font-medium w-12">{b.uom}</span>
                                    <button 
                                      type="button"
                                      className="text-red-500 hover:text-red-700 p-2 rounded-lg transition-colors hover:bg-red-50"
                                      onClick={() => removeBomRow(i)}
                                    >
                                      <XMarkIcon className="h-5 w-5" />
                                    </button>
                                  </div>
                                </div>
                                {isExceeding && (
                                  <div className="mt-2 text-xs text-amber-700 flex items-center gap-1">
                                    <ExclamationTriangleIcon className="h-3 w-3" />
                                    Required quantity exceeds available stock
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Outputs Section */}
                  <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <ClipboardDocumentListIcon className="h-5 w-5 text-blue-600" />
                      Planned Outputs
                    </h3>
                    <div className="space-y-4">
                      <button 
                        type="button" 
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                        onClick={() => {
                          const next = [...(formData.output || [])]
                          next.push({ sku: '', name: '', qty: 0, uom: 'pcs' })
                          setFormData({ ...formData, output: next })
                        }}
                      >
                        <span>+ Add Output</span>
                      </button>
                      
                      {(formData.output || []).length === 0 ? (
                        <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg">
                          <ClipboardDocumentListIcon className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                          <p className="text-gray-500 text-sm">No outputs defined</p>
                          <p className="text-gray-400 text-xs mt-1">Add planned production outputs</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="grid grid-cols-12 gap-3 text-sm font-medium text-gray-700 pb-2 border-b border-gray-200">
                            <div className="col-span-3">SKU</div>
                            <div className="col-span-4">Name</div>
                            <div className="col-span-2">Quantity</div>
                            <div className="col-span-2">UOM</div>
                            <div className="col-span-1"></div>
                          </div>
                          {(formData.output || []).map((o: any, i: number) => (
                            <div key={i} className="grid grid-cols-12 gap-3 items-center">
                              <input 
                                className="col-span-3 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500" 
                                placeholder="SKU" 
                                value={o.sku || ''} 
                                onChange={(e) => {
                                  const next = [...(formData.output || [])]; 
                                  next[i] = { ...next[i], sku: e.target.value }; 
                                  setFormData({ ...formData, output: next })
                                }} 
                              />
                              <input 
                                className="col-span-4 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500" 
                                placeholder="Name" 
                                value={o.name || ''} 
                                onChange={(e) => {
                                  const next = [...(formData.output || [])]; 
                                  next[i] = { ...next[i], name: e.target.value }; 
                                  setFormData({ ...formData, output: next })
                                }} 
                              />
                              <input 
                                type="number" 
                                className="col-span-2 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500" 
                                placeholder="Qty" 
                                value={o.qty || 0} 
                                onChange={(e) => {
                                  const next = [...(formData.output || [])]; 
                                  next[i] = { ...next[i], qty: Number(e.target.value) || 0 }; 
                                  setFormData({ ...formData, output: next })
                                }} 
                              />
                              <select 
                                className="col-span-2 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500 bg-white" 
                                value={o.uom || 'pcs'} 
                                onChange={(e) => {
                                  const next = [...(formData.output || [])]; 
                                  next[i] = { ...next[i], uom: e.target.value }; 
                                  setFormData({ ...formData, output: next })
                                }}
                              >
                                <option value="pcs">pcs</option>
                                <option value="kg">kg</option>
                                <option value="m">m</option>
                                <option value="L">L</option>
                              </select>
                              <button 
                                type="button" 
                                className="col-span-1 text-red-500 hover:text-red-700 p-2 rounded-lg transition-colors hover:bg-red-50 flex items-center justify-center"
                                onClick={() => { 
                                  const next = [...(formData.output || [])]; 
                                  next.splice(i,1); 
                                  setFormData({ ...formData, output: next }) 
                                }}
                              >
                                <XMarkIcon className="h-4 w-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Notes Section */}
                  <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <DocumentTextIcon className="h-5 w-5 text-blue-600" />
                      Additional Notes
                    </h3>
                    <textarea
                      value={formData.notes}
                      onChange={(e) => setFormData({...formData, notes: e.target.value})}
                      className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 transition-colors py-2.5 px-3 border"
                      rows={4}
                      placeholder="Add any special instructions, requirements, or notes for the production team..."
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Step 4: Workflow & Team */}
            {currentStep === 4 && (
              <div className="max-w-4xl mx-auto">
                <div className="mb-8">
                  <h2 className="text-2xl font-bold text-gray-900">Workflow & Team</h2>
                  <p className="text-gray-600 mt-2">Configure production workflow and assign team members</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Workflow Configuration */}
                  <div className="space-y-6">
                    <div className="bg-white rounded-lg border border-gray-200 p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <ClipboardDocumentListIcon className="h-5 w-5 text-blue-600" />
                        Workflow Setup
                      </h3>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Production Workflow *
                          </label>
                          <select
                            value={formData.workflowId}
                            onChange={(e) => {
                              const wf = workflows.find(w => w.id === e.target.value)
                              setFormData({
                                ...formData,
                                workflowId: e.target.value,
                                currentStageId: wf?.stages?.[0]?.id || '',
                                plannedStageIds: (wf?.stages || []).map((s: any) => s.id)
                              })
                            }}
                            className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 transition-colors py-2.5 px-3 border bg-white"
                          >
                            <option value="">Select a workflow...</option>
                            {workflows.map(workflow => (
                              <option key={workflow.id} value={workflow.id}>{workflow.name}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Workcenter
                          </label>
                          <select
                            value={formData.workcenterId}
                            onChange={(e) => setFormData({...formData, workcenterId: e.target.value})}
                            className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 transition-colors py-2.5 px-3 border bg-white"
                          >
                            <option value="">Any Workcenter</option>
                            {workcenters.map(wc => (
                              <option key={wc.id} value={wc.id}>{wc.name}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Stages Selection */}
                    <div className="bg-white rounded-lg border border-gray-200 p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <CalendarIcon className="h-5 w-5 text-blue-600" />
                        Production Stages
                      </h3>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Start Stage *
                          </label>
                          <select
                            value={formData.currentStageId}
                            onChange={(e) => setFormData({ ...formData, currentStageId: e.target.value })}
                            className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 transition-colors py-2.5 px-3 border bg-white"
                          >
                            <option value="">Select starting stage...</option>
                            {(selectedWorkflow?.stages || []).map((s: any) => (
                              <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Included Stages *
                          </label>
                          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 max-h-48 overflow-y-auto">
                            <div className="space-y-2">
                              {(selectedWorkflow?.stages || []).map((s: any) => {
                                const checked = (formData.plannedStageIds || []).includes(s.id)
                                return (
                                  <label key={s.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white transition-colors cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={!!checked}
                                      onChange={(e) => {
                                        const next = new Set(formData.plannedStageIds || [])
                                        if (e.target.checked) next.add(s.id); else next.delete(s.id)
                                        const nextArr = Array.from(next)
                                        setFormData({
                                          ...formData,
                                          plannedStageIds: nextArr,
                                          currentStageId: nextArr.includes(formData.currentStageId) ? formData.currentStageId : (nextArr[0] || '')
                                        })
                                      }}
                                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                    />
                                    <span className="text-sm font-medium text-gray-700">{s.name}</span>
                                  </label>
                                )
                              })}
                            </div>
                          </div>
                          {(formData.plannedStageIds || []).length === 0 && (
                            <p className="text-red-500 text-sm mt-2 flex items-center gap-1">
                              <ExclamationTriangleIcon className="h-4 w-4" />
                              Select at least one production stage
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Timeline & Team */}
                  <div className="space-y-6">
                    <div className="bg-white rounded-lg border border-gray-200 p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <ClockIcon className="h-5 w-5 text-blue-600" />
                        Production Timeline
                      </h3>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Planned Start Date</label>
                          <input 
                            type="datetime-local" 
                            value={formData.plannedStart} 
                            onChange={(e) => setFormData({...formData, plannedStart: e.target.value})} 
                            className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 transition-colors py-2.5 px-3 border" 
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Planned Completion</label>
                          <input 
                            type="datetime-local" 
                            value={formData.plannedEnd} 
                            onChange={(e) => setFormData({...formData, plannedEnd: e.target.value})} 
                            className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 transition-colors py-2.5 px-3 border" 
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Due Date</label>
                          <input 
                            type="datetime-local" 
                            value={formData.dueDate} 
                            onChange={(e) => setFormData({...formData, dueDate: e.target.value})} 
                            className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 transition-colors py-2.5 px-3 border" 
                          />
                        </div>
                        
                        {(leadTimeMs !== undefined || scheduleSlackMs !== undefined) && (
                          <div className="bg-blue-50 rounded-lg border border-blue-200 p-4">
                            <h4 className="text-sm font-semibold text-blue-900 mb-2">Schedule Summary</h4>
                            <div className="space-y-1 text-sm text-blue-900">
                              {leadTimeMs !== undefined && (
                                <div className="flex justify-between">
                                  <span>Lead Time:</span>
                                  <span className="font-medium">{Math.round(leadTimeMs / 36e5)} hours</span>
                                </div>
                              )}
                              {scheduleSlackMs !== undefined && (
                                <div className={`flex justify-between ${scheduleSlackMs < 0 ? 'text-amber-700' : ''}`}>
                                  <span>Slack to Due Date:</span>
                                  <span className="font-medium">
                                    {Math.round(Math.abs(scheduleSlackMs) / 86400000)} days
                                    {scheduleSlackMs < 0 && ' (late risk)'}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="bg-white rounded-lg border border-gray-200 p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <UserGroupIcon className="h-5 w-5 text-blue-600" />
                        Team Assignment
                      </h3>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Assign Team Members</label>
                          <select 
                            multiple 
                            value={formData.assignees} 
                            onChange={(e) => setFormData({...formData, assignees: Array.from(e.target.selectedOptions, option => option.value)})} 
                            className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 transition-colors py-2.5 px-3 border bg-white h-48"
                          >
                            {resources.map(resource => (
                              <option key={resource.id} value={resource.id}>
                                {resource.name} - {resource.role || 'Team Member'}
                              </option>
                            ))}
                          </select>
                          <p className="text-xs text-gray-500 mt-2">
                            Hold <kbd className="px-1 py-0.5 bg-gray-100 border border-gray-300 rounded text-xs">Ctrl</kbd> or 
                            <kbd className="px-1 py-0.5 bg-gray-100 border border-gray-300 rounded text-xs mx-1">Cmd</kbd> 
                            to select multiple team members
                          </p>
                        </div>
                        
                        {formData.assignees.length > 0 && (
                          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                            <h4 className="text-sm font-semibold text-green-800 mb-2">Selected Team Members</h4>
                            <div className="space-y-2">
                              {formData.assignees.map(assigneeId => {
                                const resource = resources.find(r => r.id === assigneeId)
                                return resource ? (
                                  <div key={assigneeId} className="flex items-center gap-2 text-sm text-green-700">
                                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                    <span className="font-medium">{resource.name}</span>
                                    <span className="text-green-600">({resource.role || 'Team Member'})</span>
                                  </div>
                                ) : null
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 5: Logistics & Delivery */}
            {currentStep === 5 && (
              <div className="max-w-4xl mx-auto">
                <div className="mb-8">
                  <h2 className="text-2xl font-bold text-gray-900">Logistics & Delivery</h2>
                  <p className="text-gray-600 mt-2">Configure delivery details and packaging information</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="space-y-6">
                    <div className="bg-white rounded-lg border border-gray-200 p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <TruckIcon className="h-5 w-5 text-blue-600" />
                        Delivery Information
                      </h3>
                      <div className="space-y-4">
                        <div className="bg-blue-50 rounded-lg border border-blue-200 p-4 mb-4">
                          <h4 className="text-sm font-semibold text-blue-900 mb-2">Packing Plan Summary</h4>
                          <div className="grid grid-cols-2 gap-2 text-sm text-blue-900">
                            <div className="flex justify-between"><span>EA/Outer</span><span className="font-medium">{formData.packaging?.pcsPerBox || '-'}</span></div>
                            <div className="flex justify-between"><span>Outers/Pallet</span><span className="font-medium">{formData.packaging?.boxesPerPallet || '-'}</span></div>
                            <div className="flex justify-between"><span>Planned Outers</span><span className="font-medium">{planned.plannedOuters}</span></div>
                            <div className="flex justify-between"><span>Planned Pallets</span><span className="font-medium">{planned.pallets}</span></div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Outer Type *</label>
                            <select 
                              value={formData.outerType} 
                              onChange={(e) => setFormData({...formData, outerType: e.target.value as any})} 
                              className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 transition-colors py-2.5 px-3 border bg-white"
                            >
                              <option value="plain">Plain</option>
                              <option value="std_ptd">Std Ptd</option>
                              <option value="bespoke">Bespoke</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Outer Code</label>
                            <input 
                              type="text" 
                              placeholder="Code" 
                              value={formData.outerCode} 
                              onChange={(e) => setFormData({...formData, outerCode: e.target.value})} 
                              className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 transition-colors py-2.5 px-3 border" 
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">RS/Order Ref</label>
                          <input 
                            type="text" 
                            placeholder="e.g., RS.BENT" 
                            value={formData.rsOrderRef} 
                            onChange={(e) => setFormData({...formData, rsOrderRef: e.target.value})} 
                            className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 transition-colors py-2.5 px-3 border" 
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Delivery Address</label>
                          <textarea 
                            placeholder="Enter full delivery address" 
                            value={formData.deliveryAddress} 
                            onChange={(e) => setFormData({...formData, deliveryAddress: e.target.value})} 
                            className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 transition-colors py-2.5 px-3 border" 
                            rows={3} 
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Delivery Method</label>
                          <input 
                            type="text" 
                            placeholder="e.g., Our Van" 
                            value={formData.deliveryMethod} 
                            onChange={(e) => setFormData({...formData, deliveryMethod: e.target.value})} 
                            className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 transition-colors py-2.5 px-3 border" 
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="bg-white rounded-lg border border-gray-200 p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <TagIcon className="h-5 w-5 text-blue-600" />
                        Packaging Details
                      </h3>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Weight per Box (kg)</label>
                          <input 
                            type="number" 
                            placeholder="Box weight" 
                            value={formData.weightPerBox || ''} 
                            onChange={(e) => setFormData({...formData, weightPerBox: e.target.value ? Number(e.target.value) : undefined})} 
                            className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 transition-colors py-2.5 px-3 border" 
                          />
                        </div>
                        
                        {formData.weightPerBox !== undefined && formData.weightPerBox >= 0 && (
                          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-900">
                            <div className="font-semibold mb-1">Weight Calculation</div>
                            <div className="space-y-1">
                              <div className="flex justify-between">
                                <span>Planned total weight:</span>
                                <span className="font-medium">{(planned.plannedOuters * (formData.weightPerBox || 0)).toFixed(2)} kg</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Full pallet weight:</span>
                                <span className="font-medium">{((formData.packaging?.boxesPerPallet || 0) * (formData.weightPerBox || 0)).toFixed(2)} kg</span>
                              </div>
                            </div>
                          </div>
                        )}

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Strap/Banding Spec</label>
                          <input 
                            type="text" 
                            placeholder="e.g., 15 mm GRP" 
                            value={formData.packaging?.strapSpec || ''} 
                            onChange={(e) => setFormData({...formData, packaging: {...formData.packaging, strapSpec: e.target.value}})} 
                            className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 transition-colors py-2.5 px-3 border" 
                          />
                        </div>
                      </div>
                    </div>

                    <div className="bg-white rounded-lg border border-gray-200 p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Delivery Validation</h3>
                      <div className="space-y-3 text-sm text-gray-600">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${
                            formData.outerType ? 'bg-green-500' : 'bg-gray-300'
                          }`}></div>
                          <span>Outer type {formData.outerType ? 'selected' : 'required'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${
                            formData.deliveryAddress ? 'bg-green-500' : 'bg-amber-500'
                          }`}></div>
                          <span>Delivery address {formData.deliveryAddress ? 'provided' : 'recommended'}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 6: Finalize - Files & Actuals */}
            {currentStep === 6 && (
              <div className="max-w-4xl mx-auto">
                <div className="mb-8">
                  <h2 className="text-2xl font-bold text-gray-900">Finalize Job</h2>
                  <p className="text-gray-600 mt-2">Add attachments, special components, and production actuals</p>
                </div>

                <div className="grid grid-cols-1 gap-6">
                  {/* Attachments Section */}
                  <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <PhotoIcon className="h-5 w-5 text-blue-600" />
                      Attachments
                    </h3>
                    <div className="space-y-4">
                      <button
                        type="button"
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                        onClick={() => {
                          const next = [...(formData.attachments || [])]
                          next.push({ name: '', storagePath: '', type: '' })
                          setFormData({ ...formData, attachments: next })
                        }}
                      >
                        <span>+ Add File</span>
                      </button>
                      
                      {(formData.attachments || []).length === 0 ? (
                        <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg">
                          <PhotoIcon className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                          <p className="text-gray-500 text-sm">No attachments added</p>
                          <p className="text-gray-400 text-xs mt-1">Add dielines, artwork, or other relevant files</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="grid grid-cols-12 gap-3 text-sm font-medium text-gray-700 pb-2 border-b border-gray-200">
                            <div className="col-span-3">Name</div>
                            <div className="col-span-6">Storage Path / URL</div>
                            <div className="col-span-2">Type</div>
                            <div className="col-span-1"></div>
                          </div>
                          {(formData.attachments || []).map((a: any, i: number) => (
                            <div key={i} className="grid grid-cols-12 gap-3 items-center">
                              <input 
                                className="col-span-3 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500" 
                                placeholder="Name" 
                                value={a.name || ''} 
                                onChange={(e) => {
                                  const next = [...(formData.attachments || [])]
                                  next[i] = { ...next[i], name: e.target.value }
                                  setFormData({ ...formData, attachments: next })
                                }} 
                              />
                              <input 
                                className="col-span-6 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500" 
                                placeholder="Storage Path / URL" 
                                value={a.storagePath || ''} 
                                onChange={(e) => {
                                  const next = [...(formData.attachments || [])]
                                  next[i] = { ...next[i], storagePath: e.target.value }
                                  setFormData({ ...formData, attachments: next })
                                }} 
                              />
                              <input 
                                className="col-span-2 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500" 
                                placeholder="Type" 
                                value={a.type || ''} 
                                onChange={(e) => {
                                  const next = [...(formData.attachments || [])]
                                  next[i] = { ...next[i], type: e.target.value }
                                  setFormData({ ...formData, attachments: next })
                                }} 
                              />
                              <button 
                                type="button" 
                                className="col-span-1 text-red-500 hover:text-red-700 p-2 rounded-lg transition-colors hover:bg-red-50 flex items-center justify-center"
                                onClick={() => {
                                  const next = [...(formData.attachments || [])]
                                  next.splice(i, 1)
                                  setFormData({ ...formData, attachments: next })
                                }}
                              >
                                <XMarkIcon className="h-4 w-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Special Components */}
                  <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <WrenchScrewdriverIcon className="h-5 w-5 text-blue-600" />
                      Special Components
                    </h3>
                    <div className="space-y-4">
                      <button
                        type="button"
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                        onClick={() => {
                          const next = [...(formData.specialComponents || [])]
                          next.push({ description: '', supplier: '', ordered: '', due: '', received: false })
                          setFormData({ ...formData, specialComponents: next })
                        }}
                      >
                        <span>+ Add Component</span>
                      </button>
                      
                      {(formData.specialComponents || []).length === 0 ? (
                        <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg">
                          <WrenchScrewdriverIcon className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                          <p className="text-gray-500 text-sm">No special components</p>
                          <p className="text-gray-400 text-xs mt-1">Add any special components or materials</p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div className="grid grid-cols-12 gap-3 text-sm font-medium text-gray-700 pb-2 border-b border-gray-200">
                            <div className="col-span-4">Description</div>
                            <div className="col-span-2">Supplier</div>
                            <div className="col-span-2">Ordered</div>
                            <div className="col-span-2">Due</div>
                            <div className="col-span-1">Received</div>
                            <div className="col-span-1"></div>
                          </div>
                          {(formData.specialComponents || []).map((c: any, i: number) => (
                            <div key={i} className="grid grid-cols-12 gap-3 items-center">
                              <input 
                                className="col-span-4 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500" 
                                placeholder="Description" 
                                value={c.description || ''} 
                                onChange={(e) => {
                                  const next = [...(formData.specialComponents || [])]
                                  next[i] = { ...next[i], description: e.target.value }
                                  setFormData({ ...formData, specialComponents: next })
                                }} 
                              />
                              <input 
                                className="col-span-2 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500" 
                                placeholder="Supplier" 
                                value={c.supplier || ''} 
                                onChange={(e) => {
                                  const next = [...(formData.specialComponents || [])]
                                  next[i] = { ...next[i], supplier: e.target.value }
                                  setFormData({ ...formData, specialComponents: next })
                                }} 
                              />
                              <input 
                                type="date" 
                                className="col-span-2 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500" 
                                value={c.ordered || ''} 
                                onChange={(e) => {
                                  const next = [...(formData.specialComponents || [])]
                                  next[i] = { ...next[i], ordered: e.target.value }
                                  setFormData({ ...formData, specialComponents: next })
                                }} 
                              />
                              <input 
                                type="date" 
                                className="col-span-2 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500" 
                                value={c.due || ''} 
                                onChange={(e) => {
                                  const next = [...(formData.specialComponents || [])]
                                  next[i] = { ...next[i], due: e.target.value }
                                  setFormData({ ...formData, specialComponents: next })
                                }} 
                              />
                              <label className="col-span-1 flex items-center justify-center">
                                <input 
                                  type="checkbox" 
                                  checked={!!c.received} 
                                  onChange={(e) => {
                                    const next = [...(formData.specialComponents || [])]
                                    next[i] = { ...next[i], received: e.target.checked }
                                    setFormData({ ...formData, specialComponents: next })
                                  }} 
                                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                              </label>
                              <button 
                                type="button" 
                                className="col-span-1 text-red-500 hover:text-red-700 p-2 rounded-lg transition-colors hover:bg-red-50 flex items-center justify-center"
                                onClick={() => {
                                  const next = [...(formData.specialComponents || [])]
                                  next.splice(i, 1)
                                  setFormData({ ...formData, specialComponents: next })
                                }}
                              >
                                <XMarkIcon className="h-4 w-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Production Actuals */}
                  <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                        <ClipboardDocumentListIcon className="h-5 w-5 text-blue-600" />
                        Production Actuals
                      </h3>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm"
                          onClick={() => {
                            const batches: any[] = []
                            if (planned.fullPallets > 0) {
                              batches.push({ 
                                pallets: planned.fullPallets, 
                                outersPerPallet: formData.packaging?.boxesPerPallet || 0, 
                                qtyPerOuter: formData.packaging?.pcsPerBox || 0, 
                                note: 'Full pallets' 
                              })
                            }
                            if (planned.remainderOuters > 0) {
                              batches.push({ 
                                pallets: 1, 
                                totalOuters: planned.remainderOuters, 
                                qtyPerOuter: formData.packaging?.pcsPerBox || 0, 
                                note: 'Remainder' 
                              })
                            }
                            setFormData({ ...formData, packaging: { ...formData.packaging, actual: { batches } } })
                          }}
                        >
                          Seed from Plan
                        </button>
                        <button
                          type="button"
                          className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm flex items-center gap-1"
                          onClick={() => {
                            const next = [...(formData.packaging?.actual?.batches || [])]
                            next.push({ pallets: 1, outersPerPallet: formData.packaging?.boxesPerPallet || 0, qtyPerOuter: formData.packaging?.pcsPerBox || 0 })
                            setFormData({ ...formData, packaging: { ...formData.packaging, actual: { batches: next } } })
                          }}
                        >
                          <span>+ Add Row</span>
                        </button>
                      </div>
                    </div>

                    {(formData.packaging?.actual?.batches || []).length === 0 ? (
                      <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg">
                        <ClipboardDocumentListIcon className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                        <p className="text-gray-500 text-sm">No production batches recorded</p>
                        <p className="text-gray-400 text-xs mt-1">Add production actuals or seed from plan</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="grid grid-cols-12 gap-3 text-sm font-medium text-gray-700 pb-2 border-b border-gray-200">
                          <div className="col-span-2">Pallets</div>
                          <div className="col-span-3">Outers/Pallet</div>
                          <div className="col-span-3">Total Outers</div>
                          <div className="col-span-2">Qty/Outer</div>
                          <div className="col-span-1">Sub Qty</div>
                          <div className="col-span-1"></div>
                        </div>
                        
                        {(formData.packaging?.actual?.batches || []).map((b: any, i: number) => {
                          const row = computeBatch(b)
                          const bothFilled = b.outersPerPallet && b.totalOuters
                          const qtyWarn = (b.qtyPerOuter || 0) > 0 && formData.packaging?.pcsPerBox && b.qtyPerOuter !== formData.packaging.pcsPerBox
                          
                          return (
                            <div key={i} className="grid grid-cols-12 gap-3 items-center">
                              <input 
                                type="number" 
                                className={`col-span-2 border rounded-lg px-3 py-2 text-sm focus:ring-blue-500 ${
                                  bothFilled ? 'border-amber-300 bg-amber-50' : 'border-gray-300'
                                }`} 
                                value={b.pallets || ''} 
                                onChange={(e) => {
                                  const next = [...(formData.packaging?.actual?.batches || [])]
                                  next[i] = { ...next[i], pallets: e.target.value ? Number(e.target.value) : undefined }
                                  setFormData({ ...formData, packaging: { ...formData.packaging, actual: { batches: next } } })
                                }} 
                              />
                              <input 
                                type="number" 
                                className={`col-span-3 border rounded-lg px-3 py-2 text-sm focus:ring-blue-500 ${
                                  bothFilled ? 'border-amber-300 bg-amber-50' : 'border-gray-300'
                                }`} 
                                value={b.outersPerPallet || ''} 
                                onChange={(e) => {
                                  const next = [...(formData.packaging?.actual?.batches || [])]
                                  next[i] = { ...next[i], outersPerPallet: e.target.value ? Number(e.target.value) : undefined }
                                  setFormData({ ...formData, packaging: { ...formData.packaging, actual: { batches: next } } })
                                }} 
                              />
                              <input 
                                type="number" 
                                className={`col-span-3 border rounded-lg px-3 py-2 text-sm focus:ring-blue-500 ${
                                  bothFilled ? 'border-amber-300 bg-amber-50' : 'border-gray-300'
                                }`} 
                                value={b.totalOuters || ''} 
                                onChange={(e) => {
                                  const next = [...(formData.packaging?.actual?.batches || [])]
                                  next[i] = { ...next[i], totalOuters: e.target.value ? Number(e.target.value) : undefined }
                                  setFormData({ ...formData, packaging: { ...formData.packaging, actual: { batches: next } } })
                                }} 
                              />
                              <input 
                                type="number" 
                                className={`col-span-2 border rounded-lg px-3 py-2 text-sm focus:ring-blue-500 ${
                                  qtyWarn ? 'border-amber-300 bg-amber-50' : 'border-gray-300'
                                }`} 
                                value={b.qtyPerOuter || ''} 
                                onChange={(e) => {
                                  const next = [...(formData.packaging?.actual?.batches || [])]
                                  next[i] = { ...next[i], qtyPerOuter: e.target.value ? Number(e.target.value) : undefined }
                                  setFormData({ ...formData, packaging: { ...formData.packaging, actual: { batches: next } } })
                                }} 
                              />
                              <div className="col-span-1 text-right text-sm text-gray-700 font-medium">
                                {row.subQty}
                              </div>
                              <button 
                                type="button" 
                                className="col-span-1 text-red-500 hover:text-red-700 p-2 rounded-lg transition-colors hover:bg-red-50 flex items-center justify-center"
                                onClick={() => {
                                  const next = [...(formData.packaging?.actual?.batches || [])]
                                  next.splice(i, 1)
                                  setFormData({ ...formData, packaging: { ...formData.packaging, actual: { batches: next } } })
                                }}
                              >
                                <XMarkIcon className="h-4 w-4" />
                              </button>
                              
                              {bothFilled && (
                                <div className="col-span-12 text-xs text-amber-700 bg-amber-50 rounded-lg p-2">
                                  Specify either Outers/Pallet or Total Outers, not both.
                                </div>
                              )}
                            </div>
                          )
                        })}

                        {/* Totals Summary */}
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                          <h4 className="text-sm font-semibold text-blue-900 mb-3">Totals Summary</h4>
                          <div className="grid grid-cols-3 gap-4 text-sm">
                            <div>
                              <div className="text-blue-700 mb-1">Actual Totals</div>
                              <div className="space-y-1">
                                <div className="flex justify-between">
                                  <span>Pallets:</span>
                                  <span className="font-semibold">{actualTotals.pallets}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Outers:</span>
                                  <span className="font-semibold">{actualTotals.outers}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Quantity:</span>
                                  <span className="font-semibold">{actualTotals.quantity}</span>
                                </div>
                              </div>
                            </div>
                            <div>
                              <div className="text-blue-700 mb-1">Planned Totals</div>
                              <div className="space-y-1">
                                <div className="flex justify-between">
                                  <span>Pallets:</span>
                                  <span className="font-semibold">{plannedTotals.pallets}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Outers:</span>
                                  <span className="font-semibold">{plannedTotals.outers}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Quantity:</span>
                                  <span className="font-semibold">{plannedTotals.quantity}</span>
                                </div>
                              </div>
                            </div>
                            <div>
                              <div className="text-blue-700 mb-1">Variance</div>
                              <div className="space-y-1">
                                <div className="flex justify-between">
                                  <span>Pallets:</span>
                                  <span className={`font-semibold ${
                                    variance.pallets === 0 ? 'text-gray-700' : 
                                    variance.pallets > 0 ? 'text-green-700' : 'text-red-700'
                                  }`}>
                                    {variance.pallets > 0 ? '+' : ''}{variance.pallets}
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Outers:</span>
                                  <span className={`font-semibold ${
                                    variance.outers === 0 ? 'text-gray-700' : 
                                    variance.outers > 0 ? 'text-green-700' : 'text-red-700'
                                  }`}>
                                    {variance.outers > 0 ? '+' : ''}{variance.outers}
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Quantity:</span>
                                  <span className={`font-semibold ${
                                    variance.quantity === 0 ? 'text-gray-700' : 
                                    variance.quantity > 0 ? 'text-green-700' : 'text-red-700'
                                  }`}>
                                    {variance.quantity > 0 ? '+' : ''}{variance.quantity}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer with Navigation Buttons */}
          <div className="border-t border-gray-200 px-6 py-4 bg-white">
            <div className="flex justify-between items-center">
              <button
                type="button"
                onClick={currentStep === 1 ? onClose : prevStep}
                className="px-6 py-2.5 text-gray-700 hover:text-gray-900 font-medium rounded-lg transition-colors hover:bg-gray-100 flex items-center gap-2"
              >
                <ChevronLeftIcon className="h-4 w-4" />
                {currentStep === 1 ? 'Cancel' : 'Back'}
              </button>
              
              <div className="flex items-center gap-4">
                <span className="text-sm text-gray-500">
                  Step {currentStep} of {totalSteps}
                </span>
                
                {currentStep < totalSteps ? (
                  <button
                    type="button"
                    onClick={nextStep}
                    className="px-6 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm flex items-center gap-2"
                  >
                    Continue
                    <ChevronRightIcon className="h-4 w-4" />
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="px-6 py-2.5 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors shadow-sm flex items-center gap-2"
                  >
                    {isLoading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <CheckIcon className="h-4 w-4" />
                        Create Job
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