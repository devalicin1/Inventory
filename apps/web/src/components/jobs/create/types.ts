export interface JobFormData {
    jobCode: string
    sku: string
    productName: string
    quantity: number
    unit: string
    priority: number
    workflowId: string
    currentStageId: string
    plannedStageIds: string[]
    status: 'draft' | 'pending' | 'in_progress' | 'completed' | 'cancelled'
    assignees: string[]
    workcenterId: string
    plannedStart: string
    plannedEnd: string
    dueDate: string
    customer: {
        id: string
        name: string
        orderNo: string
        ref: string
        estNo: string
        date: string
    }
    internalRef: string
    customerPo: string
    cutterNo: string
    notes: string
    bom: any[]
    output: any[]
    packaging: {
        packingNote: string
        pcsPerBox?: number
        boxesPerPallet?: number
        plannedPallets?: number
        strapSpec?: string
        actual: { batches: any[] }
    }
    isRepeat: boolean
    outerType: 'plain' | 'std_ptd' | 'bespoke'
    outerCode: string
    rsOrderRef: string
    deliveryAddress: string
    weightPerBox?: number
    productionSpecs: {
        size: { width?: number; length?: number; height?: number }
        forme: { width?: number; length?: number }
        sheet: { width?: number; length?: number }
        cutTo: { width?: number; length?: number }
        yieldPerSheet?: number
        labelNo?: number
        style: string
        numberUp?: number
        printedColors?: number
        varnish: string
        microns?: number
        board: string
        oversPct?: number
        sheetWastage?: number
        gsm?: string
        tags?: string[]
    }
    deliveryMethod: string
    stageProgress: any[]
    specialComponents: any[]
    attachments: any[]
    requireOutputToAdvance: boolean
}
