// import { db } from '../lib/firebase'
// import { collection, getDocs, query, orderBy, where, limit } from 'firebase/firestore'
import { listProducts } from './inventory'

// Types for report data
export interface StockOnHandRow {
  sku: string
  productName: string
  location: string
  soh: number
  allocated: number
  available: number
  onPO: number
  min: number
  max: number
  safety: number
  reorderPoint: number
  daysOfCover: number
  lowStock: boolean
  overStock: boolean
  category?: string
  supplier?: string
}

export interface InventoryAgingRow {
  sku: string
  product: string
  firstReceiptDate: string
  daysOnHand: number
  agingBucket: string
  quantity: number
  unitCost: number
  value: number
  deadStock: boolean
}

export interface ReplenishmentRow {
  sku: string
  product: string
  avgDailyDemand: number
  leadTime: number
  reviewPeriod: number
  safety: number
  targetStock: number
  available: number
  onPO: number
  suggestedQty: number
  moq: number
  casePack: number
  supplier: string
}

export interface SkuVelocityRow {
  sku: string
  product: string
  unitsSoldPerDay: number
  revenuePerDay: number
  netUnits: number
  netRevenue: number
  turnoverRatio: number
  sellThroughPercent: number
  abcClass: string
  channel?: string
}

export interface InventoryLedgerRow {
  dateTime: string
  documentNo: string
  movementType: string
  locationIn: string
  locationOut: string
  qtyIn: number
  qtyOut: number
  net: number
  runningBalance: number
  user: string
  notes: string
}

export interface CycleCountRow {
  sku: string
  location: string
  systemQty: number
  countedQty: number
  varianceQty: number
  varianceValue: number
  itemAccuracy: number
  countDate: string
  countGroup: string
  user: string
}

export interface CogsGrossProfitRow {
  date: string
  channel: string
  sku: string
  product: string
  netSales: number
  cogs: number
  grossProfit: number
  grossMargin: number
  returnsValue: number
  returnsUnits: number
}

export interface ReturnsRow {
  rmaNo: string
  date: string
  customer: string
  orderNo: string
  sku: string
  qty: number
  reasonCode: string
  disposition: string
  creditNote: number
  linkedClaim: string
  status: string
  notes: string
}

// Filter interfaces
export interface ReportFilters {
  dateFrom?: string
  dateTo?: string
  location?: string
  category?: string
  supplier?: string
  tags?: string[]
  sku?: string
  channel?: string
  movementType?: string
  user?: string
  reasonCode?: string
  customer?: string
  abcClass?: string
  lowStockOnly?: boolean
  agingBucket?: string
}

// Helper functions for calculations
function calculateDaysBetween(date1: Date, date2: Date): number {
  return Math.floor((date2.getTime() - date1.getTime()) / (1000 * 60 * 60 * 24))
}

// function calculateStandardDeviation(values: number[]): number {
//   const mean = values.reduce((sum, val) => sum + val, 0) / values.length
//   const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length
//   return Math.sqrt(variance)
// }

function getAgingBucket(daysOnHand: number): string {
  if (daysOnHand <= 30) return '0-30'
  if (daysOnHand <= 60) return '31-60'
  if (daysOnHand <= 90) return '61-90'
  return '90+'
}

// Stock On-Hand Report
export async function getStockOnHandReport(
  workspaceId: string,
  _filters: ReportFilters = {}
): Promise<StockOnHandRow[]> {
  const products = await listProducts(workspaceId)
  
  // For now, we'll use mock data since we don't have all the required fields
  // In a real implementation, you'd calculate these from actual transaction data
  return products.map(product => {
    const soh = product.qtyOnHand || 0
    const allocated = 0 // Not implemented yet
    const available = soh - allocated
    const onPO = 0 // Not implemented yet
    const min = product.minStock || 0
    const max = (product as any).maxStock || min * 3 // Default to 3x min
    const safety = (product as any).safetyStock || min * 0.5 // Default to 50% of min
    const avgDailyDemand = 1 // Mock value - would calculate from sales history
    const leadTime = (product as any).leadTimeDays || 7 // Default 7 days
    const reorderPoint = safety + avgDailyDemand * leadTime
    const daysOfCover = avgDailyDemand > 0 ? available / avgDailyDemand : 0
    
    return {
      sku: product.sku,
      productName: product.name,
      location: 'Main Warehouse', // Default location
      soh,
      allocated,
      available,
      onPO,
      min,
      max,
      safety,
      reorderPoint,
      daysOfCover,
      lowStock: available <= reorderPoint,
      overStock: soh > max,
      category: product.category,
      supplier: (product as any).supplier
    }
  })
}

// Inventory Aging Report
export async function getInventoryAgingReport(
  workspaceId: string,
  _filters: ReportFilters = {}
): Promise<InventoryAgingRow[]> {
  const products = await listProducts(workspaceId)
  
  // Mock data - in real implementation, would calculate from transaction history
  return products.map(product => {
    const soh = product.qtyOnHand || 0
    const firstReceiptDate = new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000) // Random date within last year
    const daysOnHand = calculateDaysBetween(firstReceiptDate, new Date())
    const agingBucket = getAgingBucket(daysOnHand)
    const unitCost = (product as any).unitCost || 10 // Mock unit cost
    const value = soh * unitCost
    const deadStock = daysOnHand >= 90 && Math.random() > 0.5 // Mock dead stock flag
    
    return {
      sku: product.sku,
      product: product.name,
      firstReceiptDate: firstReceiptDate.toISOString().split('T')[0],
      daysOnHand,
      agingBucket,
      quantity: soh,
      unitCost,
      value,
      deadStock
    }
  })
}

// Replenishment Suggestions Report
export async function getReplenishmentReport(
  workspaceId: string,
  _filters: ReportFilters = {}
): Promise<ReplenishmentRow[]> {
  const products = await listProducts(workspaceId)
  
  return products.map(product => {
    const soh = product.qtyOnHand || 0
    const avgDailyDemand = Math.random() * 5 + 1 // Mock daily demand
    const leadTime = (product as any).leadTimeDays || 7
    const reviewPeriod = (product as any).reviewPeriodDays || 7
    const demandStdDev = avgDailyDemand * 0.3 // Mock standard deviation
    const safety = 1.65 * demandStdDev * Math.sqrt(leadTime + reviewPeriod) // 95% service level
    const targetStock = safety + avgDailyDemand * (leadTime + reviewPeriod)
    const available = soh
    const onPO = 0 // Not implemented yet
    const suggestedQty = Math.max(0, targetStock - available - onPO)
    const moq = (product as any).moq || 10
    const casePack = (product as any).casePack || 12
    const supplier = (product as any).supplier || 'Default Supplier'
    
    return {
      sku: product.sku,
      product: product.name,
      avgDailyDemand,
      leadTime,
      reviewPeriod,
      safety,
      targetStock,
      available,
      onPO,
      suggestedQty: Math.ceil(suggestedQty / casePack) * casePack, // Round to case pack
      moq,
      casePack,
      supplier
    }
  })
}

// SKU Velocity & ABC Report
export async function getSkuVelocityReport(
  workspaceId: string,
  _filters: ReportFilters = {}
): Promise<SkuVelocityRow[]> {
  const products = await listProducts(workspaceId)
  
  // Mock data - would calculate from actual sales transactions
  const mockData = products.map(product => {
    const netUnits = Math.floor(Math.random() * 1000) + 100
    const netRevenue = netUnits * (Math.random() * 50 + 10) // Random price between 10-60
    const periodDays = 365 // 12 months
    const unitsSoldPerDay = netUnits / periodDays
    const revenuePerDay = netRevenue / periodDays
    const turnoverRatio = Math.random() * 5 + 1 // Mock turnover
    const sellThroughPercent = Math.random() * 100 // Mock sell-through
    const channel = ['Shopify', 'Amazon', 'Manual'][Math.floor(Math.random() * 3)]
    
    return {
      sku: product.sku,
      product: product.name,
      unitsSoldPerDay,
      revenuePerDay,
      netUnits,
      netRevenue,
      turnoverRatio,
      sellThroughPercent,
      abcClass: '', // Will be calculated after sorting
      channel
    }
  })
  
  // Sort by net revenue and assign ABC classes
  mockData.sort((a, b) => b.netRevenue - a.netRevenue)
  const totalRevenue = mockData.reduce((sum, item) => sum + item.netRevenue, 0)
  let cumulativeRevenue = 0
  
  return mockData.map(item => {
    cumulativeRevenue += item.netRevenue
    const cumulativePercent = (cumulativeRevenue / totalRevenue) * 100
    let abcClass = 'C'
    if (cumulativePercent <= 80) abcClass = 'A'
    else if (cumulativePercent <= 95) abcClass = 'B'
    
    return { ...item, abcClass }
  })
}

// Inventory Ledger Report
export async function getInventoryLedgerReport(
  _workspaceId: string,
  _filters: ReportFilters = {}
): Promise<InventoryLedgerRow[]> {
  // This would query stockTxns collection and build the ledger
  // For now, return empty array as we need to implement transaction querying
  return []
}

// Cycle Count Accuracy Report
export async function getCycleCountReport(
  _workspaceId: string,
  _filters: ReportFilters = {}
): Promise<CycleCountRow[]> {
  // This would query cycleCounts collection
  // For now, return empty array as we need to implement cycle counting
  return []
}

// COGS & Gross Profit Report
export async function getCogsGrossProfitReport(
  _workspaceId: string,
  _filters: ReportFilters = {}
): Promise<CogsGrossProfitRow[]> {
  // This would calculate from sales transactions and cost data
  // For now, return empty array as we need sales transaction data
  return []
}

// Returns & Credit Notes Report
export async function getReturnsReport(
  _workspaceId: string,
  _filters: ReportFilters = {}
): Promise<ReturnsRow[]> {
  // This would query returns collection
  // For now, return empty array as we need to implement returns tracking
  return []
}

// Export functions for CSV generation
export function exportToCSV<T extends Record<string, any>>(
  data: T[],
  filename: string,
  columns: { key: keyof T; label: string }[]
): void {
  const headers = columns.map(col => col.label).join(',')
  const rows = data.map(row => 
    columns.map(col => {
      const value = row[col.key]
      // Escape CSV values
      if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
        return `"${value.replace(/"/g, '""')}"`
      }
      return value
    }).join(',')
  )
  
  const csvContent = [headers, ...rows].join('\n')
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  link.setAttribute('href', url)
  link.setAttribute('download', filename)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}
