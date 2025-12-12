import type { Job } from '../../../api/production-jobs'
import type { ProductionSummary, StageProgress } from '../types'

export interface StageInfo {
  id: string
  name: string
  inputUOM?: string
  outputUOM?: string
}

export interface Progress {
  produced: number
  planned: number
  percentage: number
  uom: string
}

/**
 * Calculate tolerance thresholds based on order quantity
 */
export function calculateToleranceThresholds(plannedQty: number): { lower: number; upper: number } {
  let tolerancePercent: number
  
  if (plannedQty < 1000) {
    tolerancePercent = 0.10
  } else if (plannedQty < 5000) {
    tolerancePercent = 0.075
  } else if (plannedQty < 10000) {
    tolerancePercent = 0.05
  } else {
    tolerancePercent = 0.03
  }
  
  const calculatedTolerance = Math.round(plannedQty * tolerancePercent)
  const lower = Math.max(50, Math.min(calculatedTolerance, 2000))
  const upper = Math.max(50, Math.min(calculatedTolerance, 2000))
  
  return { lower, upper }
}

/**
 * Get stage info from workflows
 */
export function getStageInfo(
  stageId: string | undefined,
  workflows: Array<{ stages?: Array<StageInfo> }>
): StageInfo | null {
  if (!stageId) return null
  for (const workflow of workflows) {
    const stage = workflow.stages?.find(s => s.id === stageId)
    if (stage) return stage
  }
  return null
}

/**
 * Calculate overall progress for a job
 */
export function calculateProgress(
  job: Job,
  productionRuns: any[],
  workflows: Array<{ stages?: Array<StageInfo> }>
): Progress {
  const outputItem = job.output?.[0]
  
  let produced: number
  let planned: number
  let uom: string
  
  if (outputItem?.qtyProduced !== undefined && outputItem?.qtyPlanned !== undefined) {
    produced = Number(outputItem.qtyProduced || 0)
    planned = Number(outputItem.qtyPlanned || 0)
    uom = outputItem.uom || job.unit || 'units'
  } else {
    const plannedStages = job.plannedStageIds || []
    const lastStageId = plannedStages.length > 0 ? plannedStages[plannedStages.length - 1] : job.currentStageId
    const lastStageInfo = getStageInfo(lastStageId, workflows)
    const finalOutputUOM = (lastStageInfo as any)?.outputUOM || outputItem?.uom || job.unit || 'sheets'
    
    let totalProduced = 0
    
    for (let i = plannedStages.length - 1; i >= 0; i--) {
      const stageId = plannedStages[i]
      const stageInfo = getStageInfo(stageId, workflows) as any
      if (stageInfo?.outputUOM === finalOutputUOM) {
        const stageRuns = productionRuns.filter((r: any) => r.stageId === stageId)
        totalProduced = stageRuns.reduce((sum: number, r: any) => sum + Number(r.qtyGood || 0), 0)
        break
      }
    }
    
    if (totalProduced === 0) {
      totalProduced = productionRuns.reduce((sum: number, r: any) => sum + Number(r.qtyGood || 0), 0)
    }
    
    produced = totalProduced
    
    if (finalOutputUOM === 'cartoon' || finalOutputUOM === 'box' || finalOutputUOM === 'boxes') {
      const boxQty = job.packaging?.plannedBoxes || 0
      const pcsPerBox = job.packaging?.pcsPerBox || 1
      planned = boxQty * pcsPerBox
      uom = 'cartoon'
    } else {
      const sheetItem = Array.isArray(job.bom) ? job.bom.find((item: any) => 
        ['sht', 'sheet', 'sheets'].includes(String(item.uom || '').toLowerCase())
      ) : null
      planned = sheetItem 
        ? Number(sheetItem.qtyRequired || 0) 
        : (outputItem?.qtyPlanned as number) || Number(job.quantity || 0)
      uom = finalOutputUOM
    }
  }

  const percentage = planned > 0 ? Math.min(100, (produced / planned) * 100) : 0
  
  return { produced, planned, percentage, uom }
}

/**
 * Calculate progress for a specific stage
 */
export function calculateStageProgress(
  job: Job,
  stageId: string,
  productionRuns: any[],
  workflows: Array<{ stages?: Array<StageInfo> }>
): StageProgress | null {
  const stageInfo = getStageInfo(stageId, workflows) as any
  if (!stageInfo) return null

  const stageInputUOM = stageInfo.inputUOM || ''
  const stageOutputUOM = stageInfo.outputUOM || ''
  const numberUp = job.productionSpecs?.numberUp || 1

  const stageRuns = productionRuns.filter((r: any) => 
    r.stageId === stageId && !Array.isArray((r as any).transferSourceRunIds)
  )
  const totalProduced = stageRuns.reduce((sum: number, r: any) => {
    return sum + Number(r.qtyGood || 0)
  }, 0)

  let plannedQty: number
  let plannedUOM: string = stageOutputUOM || stageInputUOM || 'sheets'
  
  if (stageOutputUOM === 'cartoon') {
    const boxQty = job.packaging?.plannedBoxes || 0
    const pcsPerBox = job.packaging?.pcsPerBox || 1
    if (boxQty > 0 && pcsPerBox > 0) {
      plannedQty = boxQty * pcsPerBox
      plannedUOM = 'cartoon'
    } else {
      const plannedSheets = (job.output?.[0]?.qtyPlanned as number) || Number(job.quantity || 0)
      if (numberUp > 0) {
        plannedQty = plannedSheets * numberUp
        plannedUOM = 'cartoon'
      } else {
        plannedQty = plannedSheets
        plannedUOM = 'cartoon'
      }
    }
  } else {
    const bom = Array.isArray(job.bom) ? job.bom : []
    const sheetItem = bom.find((item: any) => {
      const uom = String(item.uom || '').toLowerCase()
      return ['sht', 'sheet', 'sheets'].includes(uom)
    })
    const plannedSheets = sheetItem 
      ? Number(sheetItem.qtyRequired || 0) 
      : ((job.output?.[0]?.qtyPlanned as number) || Number(job.quantity || 0))
    plannedQty = plannedSheets
    plannedUOM = 'sheets'
  }

  const percentage = plannedQty > 0 ? Math.min(100, (totalProduced / plannedQty) * 100) : 0

  return {
    stageId,
    stageName: stageInfo.name,
    produced: totalProduced,
    planned: plannedQty,
    percentage,
    uom: plannedUOM,
    isCurrent: job.currentStageId === stageId
  }
}

/**
 * Calculate production summary for current stage
 */
export function calculateProductionSummary(
  job: Job,
  productionRuns: any[],
  workflows: Array<{ stages?: Array<StageInfo> }>,
  customProductionRuns?: any[]
): ProductionSummary {
  const currentStageInfo = getStageInfo(job.currentStageId, workflows) as any
  const currentStageInputUOM = currentStageInfo?.inputUOM || ''
  const currentStageOutputUOM = currentStageInfo?.outputUOM || ''
  const numberUp = job.productionSpecs?.numberUp || 1

  const runsToUse = customProductionRuns || productionRuns

  const currentStageRuns = runsToUse.filter((r: any) => {
    if (r.stageId !== job.currentStageId) return false
    if (r.transferSourceRunIds && Array.isArray(r.transferSourceRunIds) && r.transferSourceRunIds.length > 0) {
      return false
    }
    return true
  })
  const totalProducedInStage = currentStageRuns.reduce((sum: number, r: any) => {
    return sum + Number(r.qtyGood || 0)
  }, 0)

  let plannedQty: number
  let plannedUOM: string = currentStageOutputUOM || currentStageInputUOM || 'sheets'
  
  if (currentStageOutputUOM === 'cartoon') {
    const boxQty = job.packaging?.plannedBoxes || 0
    const pcsPerBox = job.packaging?.pcsPerBox || 1
    if (boxQty > 0 && pcsPerBox > 0) {
      plannedQty = boxQty * pcsPerBox
      plannedUOM = 'cartoon'
    } else {
      const plannedSheets = (job.output?.[0]?.qtyPlanned as number) || Number(job.quantity || 0)
      if (numberUp > 0) {
        plannedQty = plannedSheets * numberUp
        plannedUOM = 'cartoon'
      } else {
        plannedQty = plannedSheets
        plannedUOM = 'cartoon'
      }
    }
  } else {
    const bom = Array.isArray(job.bom) ? job.bom : []
    const sheetItem = bom.find((item: any) => {
      const uom = String(item.uom || '').toLowerCase()
      return ['sht', 'sheet', 'sheets'].includes(uom)
    })
    const plannedSheets = sheetItem 
      ? Number(sheetItem.qtyRequired || 0) 
      : ((job.output?.[0]?.qtyPlanned as number) || Number(job.quantity || 0))
    plannedQty = plannedSheets
    plannedUOM = 'sheets'
  }

  const tolerance = calculateToleranceThresholds(plannedQty)
  const completionThreshold = Math.max(0, plannedQty - tolerance.lower)
  const completionThresholdUpper = plannedQty + tolerance.upper

  const convertToOutputUOM = (qtyInInputUOM: number): number => {
    if (currentStageInputUOM === 'sheets' && currentStageOutputUOM === 'cartoon' && numberUp > 0) {
      return qtyInInputUOM * numberUp
    }
    return qtyInInputUOM
  }

  return {
    currentStageInputUOM,
    currentStageOutputUOM,
    numberUp,
    totalProducedInStage,
    plannedQty,
    plannedUOM,
    completionThreshold,
    completionThresholdUpper,
    convertToOutputUOM
  }
}
