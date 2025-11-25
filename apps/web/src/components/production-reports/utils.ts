import type { ProductionRun } from '../../api/production-jobs'

export interface WIPStageData {
  stageId: string
  name: string
  count: number
  wipLimit?: number
  overLimit: boolean
  jobs: any[]
  avgDaysInStage: number
  priorityBreakdown: { [priority: number]: number }
  workcenters: { [wcId: string]: number }
  overdueCount: number
  totalValue: number
}

export interface ThroughputData {
  date: string
  count: number
}

export interface OnTimeData {
  total: number
  onTime: number
  percentage: number
}

export interface CycleTimeData {
  average: number
  cycleTimes: number[]
}

export interface ResourceUtilizationData {
  resourceId: string
  resourceName: string
  assigned: number
  total: number
  utilization: number
}

export interface MaterialUsageData {
  sku: string
  required: number
  consumed: number
  variance: number
  variancePercentage: number
}

export interface OutputPalletizationData {
  jobCode: string
  sku: string
  totalPlanned: number
  totalProduced: number
  productionPercentage: number
  plannedBoxes: number
  actualBoxes: number
  boxVariance: number
  plannedPallets: number
  actualPallets: number
  palletVariance: number
}

export interface StageOutputData {
  jobCode: string
  productName: string
  stageId: string
  stageName: string
  workcenterId?: string
  workcenterName: string
  qtyGood: number
  qtyScrap: number
  lot?: string
  date: string
  operatorId: string
  notes?: string
}

export interface DeadlinesAcceptanceData {
  upcomingDeadlines: Array<{
    jobCode: string
    productName: string
    dueDate: Date
    status: string
    daysUntilDue: number
    qaAccepted: boolean
    customerAccepted: boolean
  }>
  acceptanceStats: {
    totalJobs: number
    qaAccepted: number
    customerAccepted: number
    qaAcceptanceRate: number
    customerAcceptanceRate: number
  }
}

export interface EfficiencyData {
  efficiency: number
  totalPlanned: number
  totalProduced: number
  avgCycleTime: number
  onTimeRate: number
  overallScore: number
}

export interface QualityMetricsData {
  scrapRate: number
  totalGood: number
  totalScrap: number
  jobs: Array<{
    jobCode: string
    good: number
    scrap: number
    scrapRate: number
  }>
}

export interface WorkcenterPerformanceData {
  workcenterId: string
  workcenterName: string
  jobs: number
  totalGood: number
  totalScrap: number
  efficiency: number
}

export interface JobStatusData {
  status: string
  count: number
  percentage: number
}

export interface StageTimeData {
  stageId: string
  name: string
  totalTime: number
  jobCount: number
  avgTime: number
}

// Calculate WIP by Stage - Enhanced
export function calculateWIPByStage(
  jobs: any[],
  workflows: any[]
): WIPStageData[] {
  const stageData: { 
    [stageId: string]: { 
      name: string
      count: number
      wipLimit?: number
      overLimit: boolean
      jobs: any[]
      avgDaysInStage: number
      priorityBreakdown: { [priority: number]: number }
      workcenters: { [wcId: string]: number }
      overdueCount: number
      totalValue: number
    } 
  } = {}
  
  const now = new Date()
  
  jobs.forEach(job => {
    const stageId = job.currentStageId
    if (!stageId) return
    
    // Find stage info
    let stageName = stageId
    let wipLimit: number | undefined
    for (const wf of workflows) {
      const stage = wf.stages?.find((s: any) => s.id === stageId)
      if (stage) {
        stageName = stage.name
        wipLimit = stage.wipLimit
        break
      }
    }
    
    if (!stageData[stageId]) {
      stageData[stageId] = {
        name: stageName,
        count: 0,
        wipLimit,
        overLimit: false,
        jobs: [],
        avgDaysInStage: 0,
        priorityBreakdown: {},
        workcenters: {},
        overdueCount: 0,
        totalValue: 0
      }
    }
    
    stageData[stageId].count += 1
    stageData[stageId].jobs.push(job)
    
    // Priority breakdown
    const priority = job.priority || 0
    stageData[stageId].priorityBreakdown[priority] = (stageData[stageId].priorityBreakdown[priority] || 0) + 1
    
    // Workcenter distribution
    if (job.workcenterId) {
      stageData[stageId].workcenters[job.workcenterId] = (stageData[stageId].workcenters[job.workcenterId] || 0) + 1
    }
    
    // Check if overdue
    const dueDate = new Date(job.dueDate)
    if (dueDate < now && job.status !== 'done' && job.status !== 'cancelled') {
      stageData[stageId].overdueCount += 1
    }
    
    // Calculate days in stage (if stageProgress exists)
    if (job.stageProgress && Array.isArray(job.stageProgress)) {
      const stageProgress = job.stageProgress.find((p: any) => p.stageId === stageId)
      if (stageProgress?.date) {
        const entered = new Date(stageProgress.date)
        if (!isNaN(entered.getTime())) {
          const daysInStage = (now.getTime() - entered.getTime()) / (1000 * 60 * 60 * 24)
          stageData[stageId].avgDaysInStage = (stageData[stageId].avgDaysInStage * (stageData[stageId].count - 1) + daysInStage) / stageData[stageId].count
        }
      }
    }
    
    // Fallback: use job creation date if no stage progress
    if (stageData[stageId].avgDaysInStage === 0 && job.createdAt) {
      const created = new Date(job.createdAt.seconds ? job.createdAt.seconds * 1000 : job.createdAt)
      if (!isNaN(created.getTime())) {
        const daysSinceCreated = (now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24)
        stageData[stageId].avgDaysInStage = daysSinceCreated
      }
    }
    
    // Calculate total value (if output has pricing)
    const outputValue = job.output?.reduce((sum: number, item: any) => {
      return sum + (item.qtyProduced || 0) * (item.unitPrice || 0)
    }, 0) || 0
    stageData[stageId].totalValue += outputValue
  })
  
  // Check over limit
  Object.keys(stageData).forEach(stageId => {
    const data = stageData[stageId]
    if (data.wipLimit && data.count > data.wipLimit) {
      data.overLimit = true
    }
  })
  
  return Object.entries(stageData).map(([stageId, data]) => ({
    stageId,
    ...data
  })).sort((a, b) => b.count - a.count)
}

// Calculate Throughput
export function calculateThroughput(jobs: any[]): ThroughputData[] {
  const completedJobs = jobs.filter(job => job.status === 'done')
  const dailyCounts: { [key: string]: number } = {}
  
  completedJobs.forEach(job => {
    const date = new Date(job.updatedAt?.seconds ? job.updatedAt.seconds * 1000 : job.updatedAt).toISOString().split('T')[0]
    dailyCounts[date] = (dailyCounts[date] || 0) + 1
  })
  
  return Object.entries(dailyCounts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }))
}

// Calculate On-Time Delivery
export function calculateOnTimeDelivery(jobs: any[]): OnTimeData {
  const completedJobs = jobs.filter(job => job.status === 'done')
  const onTimeJobs = completedJobs.filter(job => {
    const completedDate = new Date(job.updatedAt?.seconds ? job.updatedAt.seconds * 1000 : job.updatedAt)
    const dueDate = new Date(job.dueDate)
    return completedDate <= dueDate
  })
  
  return {
    total: completedJobs.length,
    onTime: onTimeJobs.length,
    percentage: completedJobs.length > 0 ? (onTimeJobs.length / completedJobs.length) * 100 : 0
  }
}

// Calculate Cycle Time
export function calculateCycleTime(jobs: any[]): CycleTimeData {
  const completedJobs = jobs.filter(job => job.status === 'done')
  const cycleTimes = completedJobs.map(job => {
    const startDate = new Date(job.createdAt?.seconds ? job.createdAt.seconds * 1000 : job.createdAt)
    const endDate = new Date(job.updatedAt?.seconds ? job.updatedAt.seconds * 1000 : job.updatedAt)
    return (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24) // days
  })
  
  const average = cycleTimes.length > 0 ? cycleTimes.reduce((sum, time) => sum + time, 0) / cycleTimes.length : 0
  return { average, cycleTimes }
}

// Calculate Resource Utilization
export function calculateResourceUtilization(
  jobs: any[],
  resources: any[]
): ResourceUtilizationData[] {
  const utilization: { [key: string]: { assigned: number; total: number } } = {}
  
  resources.forEach(resource => {
    utilization[resource.id] = { assigned: 0, total: 1 }
  })
  
  jobs.forEach(job => {
    job.assignees.forEach((assigneeId: string) => {
      if (utilization[assigneeId]) {
        utilization[assigneeId].assigned += 1
      }
    })
  })
  
  return Object.entries(utilization).map(([resourceId, data]) => {
    const resource = resources.find(r => r.id === resourceId)
    return {
      resourceId,
      resourceName: resource?.name || 'Unknown',
      assigned: data.assigned,
      total: data.total,
      utilization: (data.assigned / data.total) * 100
    }
  })
}

// Calculate Material Usage
export function calculateMaterialUsage(jobs: any[]): MaterialUsageData[] {
  const materialData: { [key: string]: { required: number; consumed: number; variance: number } } = {}
  
  jobs.forEach(job => {
    job.bom.forEach((item: any) => {
      if (!materialData[item.sku]) {
        materialData[item.sku] = { required: 0, consumed: 0, variance: 0 }
      }
      materialData[item.sku].required += item.qtyRequired
      materialData[item.sku].consumed += item.consumed
    })
  })
  
  Object.keys(materialData).forEach(sku => {
    materialData[sku].variance = materialData[sku].consumed - materialData[sku].required
  })
  
  return Object.entries(materialData).map(([sku, data]) => ({
    sku,
    ...data,
    variancePercentage: data.required > 0 ? (data.variance / data.required) * 100 : 0
  }))
}

// Calculate Output & Palletization
export function calculateOutputPalletization(jobs: any[]): OutputPalletizationData[] {
  return jobs.map(job => {
    const totalPlanned = job.output.reduce((sum: number, item: any) => sum + item.qtyPlanned, 0)
    const totalProduced = job.output.reduce((sum: number, item: any) => sum + item.qtyProduced, 0)
    const plannedBoxes = job.packaging?.plannedBoxes || 0
    const actualBoxes = job.packaging?.actualBoxes || 0
    const plannedPallets = job.packaging?.plannedPallets || 0
    const actualPallets = job.packaging?.actualPallets || 0
    
    return {
      jobCode: job.code,
      sku: job.sku,
      totalPlanned,
      totalProduced,
      productionPercentage: totalPlanned > 0 ? (totalProduced / totalPlanned) * 100 : 0,
      plannedBoxes,
      actualBoxes,
      boxVariance: actualBoxes - plannedBoxes,
      plannedPallets,
      actualPallets,
      palletVariance: actualPallets - plannedPallets
    }
  })
}

// Calculate Stage Output Report
export function calculateStageOutput(
  jobs: any[],
  allRunsData: { [jobId: string]: ProductionRun[] } | undefined,
  workflows: any[],
  workcenters: any[]
): StageOutputData[] {
  if (!allRunsData) return []
  
  const getStageName = (stageId: string) => {
    for (const wf of workflows) {
      const stage = wf.stages?.find((s: any) => s.id === stageId)
      if (stage) return stage.name
    }
    return stageId
  }

  const getWorkcenterName = (workcenterId?: string) => {
    if (!workcenterId) return '-'
    const wc = workcenters.find((w: any) => w.id === workcenterId)
    return wc?.name || workcenterId
  }

  const reportData: StageOutputData[] = []

  jobs.forEach(job => {
    const runs = allRunsData[job.id] || []
    runs.forEach(run => {
      const runDate = run.at?.seconds 
        ? new Date(run.at.seconds * 1000).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0]
      
      reportData.push({
        jobCode: job.code || job.id,
        productName: job.productName || job.sku || '',
        stageId: run.stageId,
        stageName: getStageName(run.stageId),
        workcenterId: run.workcenterId,
        workcenterName: getWorkcenterName(run.workcenterId),
        qtyGood: run.qtyGood || 0,
        qtyScrap: run.qtyScrap || 0,
        lot: run.lot,
        date: runDate,
        operatorId: run.operatorId || '',
        notes: run.notes,
      })
    })
  })

  // Sort by job code, then by stage order, then by date
  return reportData.sort((a, b) => {
    if (a.jobCode !== b.jobCode) return a.jobCode.localeCompare(b.jobCode)
    if (a.stageId !== b.stageId) return a.stageId.localeCompare(b.stageId)
    return b.date.localeCompare(a.date) // newest first
  })
}

// Calculate Deadlines & Acceptance
export function calculateDeadlinesAcceptance(jobs: any[]): DeadlinesAcceptanceData {
  const upcomingDeadlines = jobs
    .filter(job => job.status !== 'done' && job.status !== 'cancelled')
    .map(job => ({
      jobCode: job.code,
      productName: job.productName,
      dueDate: new Date(job.dueDate),
      status: job.status,
      daysUntilDue: Math.ceil((new Date(job.dueDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)),
      qaAccepted: !!job.qaAcceptedAt,
      customerAccepted: !!job.customerAcceptedAt
    }))
    .sort((a, b) => a.daysUntilDue - b.daysUntilDue)
  
  const acceptanceStats = {
    totalJobs: jobs.length,
    qaAccepted: jobs.filter(job => job.qaAcceptedAt).length,
    customerAccepted: jobs.filter(job => job.customerAcceptedAt).length,
    qaAcceptanceRate: jobs.length > 0 ? (jobs.filter(job => job.qaAcceptedAt).length / jobs.length) * 100 : 0,
    customerAcceptanceRate: jobs.length > 0 ? (jobs.filter(job => job.customerAcceptedAt).length / jobs.length) * 100 : 0
  }
  
  return { upcomingDeadlines, acceptanceStats }
}

// Calculate Production Efficiency
export function calculateEfficiency(
  jobs: any[],
  cycleTimeData: CycleTimeData,
  onTimeData: OnTimeData
): EfficiencyData {
  const completedJobs = jobs.filter(job => job.status === 'done')
  const totalPlanned = completedJobs.reduce((sum, job) => {
    return sum + job.output.reduce((s: number, item: any) => s + item.qtyPlanned, 0)
  }, 0)
  const totalProduced = completedJobs.reduce((sum, job) => {
    return sum + job.output.reduce((s: number, item: any) => s + item.qtyProduced, 0)
  }, 0)
  const efficiency = totalPlanned > 0 ? (totalProduced / totalPlanned) * 100 : 0
  
  return {
    efficiency,
    totalPlanned,
    totalProduced,
    avgCycleTime: cycleTimeData.average,
    onTimeRate: onTimeData.percentage,
    overallScore: (efficiency * 0.4 + (onTimeData.percentage / 100) * 40 + (cycleTimeData.average > 0 ? Math.max(0, 100 - (cycleTimeData.average / 10) * 20) : 0))
  }
}

// Calculate Quality Metrics
export function calculateQualityMetrics(
  jobs: any[],
  allRunsData: { [jobId: string]: ProductionRun[] } | undefined
): QualityMetricsData {
  if (!allRunsData) return { scrapRate: 0, totalGood: 0, totalScrap: 0, jobs: [] }
  
  let totalGood = 0
  let totalScrap = 0
  
  const jobQuality: { [jobCode: string]: { good: number; scrap: number; scrapRate: number } } = {}
  
  jobs.forEach(job => {
    const runs = allRunsData[job.id] || []
    let jobGood = 0
    let jobScrap = 0
    
    runs.forEach(run => {
      jobGood += run.qtyGood || 0
      jobScrap += run.qtyScrap || 0
    })
    
    totalGood += jobGood
    totalScrap += jobScrap
    
    const total = jobGood + jobScrap
    jobQuality[job.code] = {
      good: jobGood,
      scrap: jobScrap,
      scrapRate: total > 0 ? (jobScrap / total) * 100 : 0
    }
  })
  
  const total = totalGood + totalScrap
  const scrapRate = total > 0 ? (totalScrap / total) * 100 : 0
  
  return {
    scrapRate,
    totalGood,
    totalScrap,
    jobs: Object.entries(jobQuality).map(([code, data]) => ({
      jobCode: code,
      ...data
    })).sort((a, b) => b.scrapRate - a.scrapRate)
  }
}

// Calculate Workcenter Performance
export function calculateWorkcenterPerformance(
  jobs: any[],
  allRunsData: { [jobId: string]: ProductionRun[] } | undefined,
  workcenters: any[]
): WorkcenterPerformanceData[] {
  if (!allRunsData) return []
  
  const wcStats: { [wcId: string]: { name: string; jobs: number; totalGood: number; totalScrap: number; avgEfficiency: number } } = {}
  
  jobs.forEach(job => {
    const runs = allRunsData[job.id] || []
    runs.forEach(run => {
      const wcId = run.workcenterId || 'unassigned'
      const wc = workcenters.find((w: any) => w.id === wcId)
      const wcName = wc?.name || 'Unassigned'
      
      if (!wcStats[wcId]) {
        wcStats[wcId] = { name: wcName, jobs: 0, totalGood: 0, totalScrap: 0, avgEfficiency: 0 }
      }
      
      wcStats[wcId].totalGood += run.qtyGood || 0
      wcStats[wcId].totalScrap += run.qtyScrap || 0
    })
  })
  
  // Count unique jobs per workcenter
  jobs.forEach(job => {
    const runs = allRunsData[job.id] || []
    const wcIds = new Set(runs.map(r => r.workcenterId || 'unassigned'))
    wcIds.forEach(wcId => {
      if (wcStats[wcId]) {
        wcStats[wcId].jobs += 1
      }
    })
  })
  
  return Object.entries(wcStats).map(([wcId, stats]) => {
    const total = stats.totalGood + stats.totalScrap
    const efficiency = total > 0 ? (stats.totalGood / total) * 100 : 0
    return {
      workcenterId: wcId,
      workcenterName: stats.name,
      jobs: stats.jobs,
      totalGood: stats.totalGood,
      totalScrap: stats.totalScrap,
      efficiency
    }
  }).sort((a, b) => b.efficiency - a.efficiency)
}

// Calculate Job Status Summary
export function calculateJobStatusSummary(jobs: any[]): JobStatusData[] {
  const statusCounts: { [status: string]: number } = {}
  jobs.forEach(job => {
    statusCounts[job.status] = (statusCounts[job.status] || 0) + 1
  })
  
  return Object.entries(statusCounts).map(([status, count]) => ({
    status,
    count,
    percentage: jobs.length > 0 ? (count / jobs.length) * 100 : 0
  })).sort((a, b) => b.count - a.count)
}

// Calculate Stage Time Analysis
export function calculateStageTimeAnalysis(
  jobs: any[],
  workflows: any[]
): StageTimeData[] {
  const completedJobs = jobs.filter(job => job.status === 'done')
  const stageTimes: { [stageId: string]: { name: string; totalTime: number; jobCount: number; avgTime: number } } = {}
  
  completedJobs.forEach(job => {
    if (job.stageProgress && Array.isArray(job.stageProgress)) {
      job.stageProgress.forEach((progress: any) => {
        const stageId = progress.stageId
        if (!stageTimes[stageId]) {
          const workflow = workflows.find((w: any) => w.stages?.some((s: any) => s.id === stageId))
          const stage = workflow?.stages?.find((s: any) => s.id === stageId)
          stageTimes[stageId] = {
            name: stage?.name || stageId,
            totalTime: 0,
            jobCount: 0,
            avgTime: 0
          }
        }
        
        if (progress.enteredAt && progress.completedAt) {
          const entered = new Date(progress.enteredAt.seconds ? progress.enteredAt.seconds * 1000 : progress.enteredAt)
          const completed = new Date(progress.completedAt.seconds ? progress.completedAt.seconds * 1000 : progress.completedAt)
          if (!isNaN(entered.getTime()) && !isNaN(completed.getTime())) {
            const timeDiff = (completed.getTime() - entered.getTime()) / (1000 * 60 * 60) // hours
            stageTimes[stageId].totalTime += timeDiff
            stageTimes[stageId].jobCount += 1
          }
        }
      })
    }
  })
  
  Object.keys(stageTimes).forEach(stageId => {
    if (stageTimes[stageId].jobCount > 0) {
      stageTimes[stageId].avgTime = stageTimes[stageId].totalTime / stageTimes[stageId].jobCount
    }
  })
  
  return Object.entries(stageTimes).map(([stageId, data]) => ({
    stageId,
    ...data
  })).sort((a, b) => b.avgTime - a.avgTime)
}

