import { db } from '../lib/firebase'
import { collection, getDocs, query, orderBy, where, limit } from 'firebase/firestore'
import { listProducts, listProductStockTxns } from './inventory'
import { getReportSettings } from './settings'

// Types for report data
export interface StockOnHandRow {
  id: string  // Unique product ID
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
  groupId?: string
  groupName?: string
}

export interface InventoryAgingRow {
  id: string  // Unique product ID
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
  id: string  // Unique product ID
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
  id: string  // Unique product ID
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
  id: string
  dateTime: string
  sku: string
  productName: string
  movementType: string
  locationIn: string
  locationOut: string
  qtyIn: number
  qtyOut: number
  net: number
  runningBalance: number
  user: string
  notes: string
  reason?: string
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
  groupId?: string  // Folder/group filter
}

// Helper functions for calculations
function calculateDaysBetween(date1: Date, date2: Date): number {
  return Math.floor((date2.getTime() - date1.getTime()) / (1000 * 60 * 60 * 24))
}

function calculateStandardDeviation(values: number[]): number {
  if (values.length === 0) return 0
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length
  return Math.sqrt(variance)
}

function getAgingBucket(daysOnHand: number): string {
  if (daysOnHand <= 30) return '0-30'
  if (daysOnHand <= 60) return '31-60'
  if (daysOnHand <= 90) return '61-90'
  return '90+'
}

// Helper: Clean product name to fix encoding issues
function cleanProductName(name: string | null | undefined): string {
  if (!name) return 'Unnamed Product'
  let cleaned = String(name)
    .replace(/\uFFFD/g, '') // Remove replacement characters ()
    .replace(/\u0000/g, '') // Remove null characters
    .trim()
  
  // Remove question marks that appear between numbers/words (likely encoding errors)
  cleaned = cleaned.replace(/\s+\?\s+/g, ' ') // Remove " ? " patterns
  cleaned = cleaned.replace(/(\d)\s+\?(\s+\d)/g, '$1$2') // Remove " ? " between numbers
  cleaned = cleaned.replace(/(\w)\s+\?(\s+\w)/g, '$1$2') // Remove " ? " between words
  cleaned = cleaned.replace(/\s+\?/g, '') // Remove trailing " ?"
  cleaned = cleaned.replace(/\?\s+/g, '') // Remove leading "? "
  cleaned = cleaned.replace(/\s+/g, ' ') // Normalize multiple spaces to single space
  cleaned = cleaned.trim()
  
  return cleaned || 'Unnamed Product'
}

// Helper: Calculate average daily demand from transaction history
async function calculateAvgDailyDemand(
  workspaceId: string,
  productId: string,
  days: number = 90
): Promise<number> {
  try {
    const txns = await listProductStockTxns(workspaceId, productId, 1000)
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - days)
    
    // Filter Ship transactions (outgoing) from last N days
    const shipTxns = txns.filter(txn => {
      const txnDate = txn.timestamp?.toDate?.() || new Date(txn.timestamp)
      return txn.type === 'Ship' && txnDate >= cutoffDate && txn.qty < 0
    })
    
    if (shipTxns.length === 0) return 0
    
    // Calculate total units shipped
    const totalShipped = shipTxns.reduce((sum, txn) => sum + Math.abs(txn.qty || 0), 0)
    
    // Calculate average daily demand
    const actualDays = Math.max(1, days) // At least 1 day
    return totalShipped / actualDays
  } catch (error) {
    console.error(`Error calculating avg daily demand for product ${productId}:`, error)
    return 0
  }
}

// Helper: Find first receipt date from transaction history
async function getFirstReceiptDate(
  workspaceId: string,
  productId: string
): Promise<Date | null> {
  try {
    const txns = await listProductStockTxns(workspaceId, productId, 1000)
    
    // Find first Receive transaction
    const receiveTxns = txns.filter(txn => txn.type === 'Receive' && txn.qty > 0)
    
    if (receiveTxns.length === 0) return null
    
    // Get earliest receipt date
    const dates = receiveTxns
      .map(txn => txn.timestamp?.toDate?.() || new Date(txn.timestamp))
      .filter(date => !isNaN(date.getTime()))
    
    if (dates.length === 0) return null
    
    return new Date(Math.min(...dates.map(d => d.getTime())))
  } catch (error) {
    console.error(`Error finding first receipt date for product ${productId}:`, error)
    return null
  }
}

// Helper: Calculate average unit cost from transaction history
async function calculateAvgUnitCost(
  workspaceId: string,
  productId: string
): Promise<number> {
  try {
    const txns = await listProductStockTxns(workspaceId, productId, 1000)
    
    // Get Receive transactions with unitCost
    const receiveTxns = txns.filter(txn => {
      const txnData = txn as any
      return txn.type === 'Receive' && txn.qty > 0 && txnData.unitCost != null
    })
    
    if (receiveTxns.length === 0) return 0
    
    // Calculate weighted average unit cost
    let totalCost = 0
    let totalQty = 0
    
    receiveTxns.forEach(txn => {
      const txnData = txn as any
      const qty = Math.abs(txn.qty || 0)
      const cost = Number(txnData.unitCost || 0)
      if (qty > 0 && cost > 0) {
        totalCost += cost * qty
        totalQty += qty
      }
    })
    
    return totalQty > 0 ? totalCost / totalQty : 0
  } catch (error) {
    console.error(`Error calculating avg unit cost for product ${productId}:`, error)
    return 0
  }
}

// Helper function to filter out raw materials based on report settings
async function filterRawMaterials(workspaceId: string, products: any[]): Promise<any[]> {
  try {
    const reportSettings = await getReportSettings(workspaceId)
    const rawMaterialGroupIds = reportSettings.rawMaterialGroupIds || []
    
    if (rawMaterialGroupIds.length === 0) {
      // If no settings, fall back to boardType check
      return products.filter(product => !(product as any).boardType)
    }
    
    // Filter out products that belong to raw material groups
    return products.filter(product => {
      const productGroupId = (product as any).groupId
      return !productGroupId || !rawMaterialGroupIds.includes(productGroupId)
    })
  } catch (error) {
    console.error('Error filtering raw materials:', error)
    // Fallback to boardType check on error
    return products.filter(product => !(product as any).boardType)
  }
}

// Stock On-Hand Report
export async function getStockOnHandReport(
  workspaceId: string,
  filters: ReportFilters = {}
): Promise<StockOnHandRow[]> {
  const products = await listProducts(workspaceId)
  
  // Filter out raw materials based on report settings
  let finishedProducts = await filterRawMaterials(workspaceId, products)
  
  // Apply group/folder filter if specified
  if (filters.groupId) {
    finishedProducts = finishedProducts.filter(p => (p as any).groupId === filters.groupId)
  }
  
  // Calculate report data for each product using real transaction data
  const reportData = await Promise.all(finishedProducts.map(async product => {
    const soh = product.qtyOnHand || 0
    const allocated = 0 // Not implemented yet - would come from order allocation system
    const available = soh - allocated
    const onPO = 0 // Not implemented yet - would come from purchase order system
    const min = product.minStock || 0
    const max = (product as any).maxStock || (min > 0 ? min * 3 : 0) // Default to 3x min if min exists
    const safety = (product as any).safetyStock || (min > 0 ? min * 0.5 : 0) // Default to 50% of min
    
    // Calculate average daily demand from actual transaction history
    const avgDailyDemand = await calculateAvgDailyDemand(workspaceId, product.id, 90)
    
    const leadTime = (product as any).leadTimeDays || 7 // Default 7 days
    const reorderPoint = safety + avgDailyDemand * leadTime
    const daysOfCover = avgDailyDemand > 0 ? available / avgDailyDemand : (available > 0 ? 999 : 0)
    
    return {
      id: product.id,  // Unique product ID for React keys
      sku: product.sku || '-',
      productName: cleanProductName(product.name),
      location: 'Main Warehouse', // Default location - could be enhanced to track multiple locations
      soh,
      allocated,
      available,
      onPO,
      min,
      max,
      safety,
      reorderPoint,
      daysOfCover,
      lowStock: available <= reorderPoint && reorderPoint > 0,
      overStock: max > 0 && soh > max,
      category: product.category || undefined,
      supplier: (product as any).supplier || undefined,
      groupId: (product as any).groupId || undefined
    }
  }))
  
  return reportData
}

// Inventory Aging Report
export async function getInventoryAgingReport(
  workspaceId: string,
  filters: ReportFilters = {}
): Promise<InventoryAgingRow[]> {
  const products = await listProducts(workspaceId)
  
  // Filter out raw materials based on report settings
  let finishedProducts = await filterRawMaterials(workspaceId, products)
  
  // Apply group/folder filter if specified
  if (filters.groupId) {
    finishedProducts = finishedProducts.filter(p => (p as any).groupId === filters.groupId)
  }
  
  // Apply aging bucket filter if specified
  // Note: This will be applied after calculating aging data
  
  // Calculate aging data from actual transaction history
  const reportData = await Promise.all(finishedProducts.map(async product => {
    const soh = product.qtyOnHand || 0
    
    // Get first receipt date from transaction history
    const firstReceiptDateObj = await getFirstReceiptDate(workspaceId, product.id)
    const firstReceiptDate = firstReceiptDateObj || new Date() // Fallback to today if no receipt found
    const daysOnHand = calculateDaysBetween(firstReceiptDate, new Date())
    const agingBucket = getAgingBucket(daysOnHand)
    
    // Calculate average unit cost from transaction history
    const unitCost = await calculateAvgUnitCost(workspaceId, product.id) || (product as any).unitCost || 0
    const value = soh * unitCost
    
    // Dead stock: items older than 90 days with no recent sales (no Ship transactions in last 30 days)
    let deadStock = false
    if (daysOnHand >= 90 && soh > 0) {
      try {
        const txns = await listProductStockTxns(workspaceId, product.id, 100)
        const thirtyDaysAgo = new Date()
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
        
        const recentShipments = txns.filter(txn => {
          const txnDate = txn.timestamp?.toDate?.() || new Date(txn.timestamp)
          return txn.type === 'Ship' && txnDate >= thirtyDaysAgo && txn.qty < 0
        })
        
        deadStock = recentShipments.length === 0
      } catch (error) {
        // If error checking, assume not dead stock
        deadStock = false
      }
    }
    
    return {
      id: product.id,  // Unique product ID for React keys
      sku: product.sku || '-',
      product: cleanProductName(product.name),
      firstReceiptDate: firstReceiptDate.toISOString().split('T')[0],
      daysOnHand,
      agingBucket,
      quantity: soh,
      unitCost,
      value,
      deadStock
    }
  }))
  
  return reportData
}

// Replenishment Suggestions Report
export async function getReplenishmentReport(
  workspaceId: string,
  filters: ReportFilters = {}
): Promise<ReplenishmentRow[]> {
  const products = await listProducts(workspaceId)
  
  // Filter out raw materials based on report settings
  let finishedProducts = await filterRawMaterials(workspaceId, products)
  
  // Apply group/folder filter if specified
  if (filters.groupId) {
    finishedProducts = finishedProducts.filter(p => (p as any).groupId === filters.groupId)
  }
  
  // Apply supplier filter if specified
  if (filters.supplier) {
    finishedProducts = finishedProducts.filter(p => (p as any).supplier === filters.supplier)
  }
  
  // Calculate replenishment suggestions using real demand data
  const reportData = await Promise.all(finishedProducts.map(async product => {
    const soh = product.qtyOnHand || 0
    
    // Calculate average daily demand from actual transaction history (all outgoing types)
    const avgDailyDemand = await calculateAvgDailyDemandAllTypes(workspaceId, product.id, 90)
    
    const leadTime = (product as any).leadTimeDays || 7
    const reviewPeriod = (product as any).reviewPeriodDays || 7
    
    // Get product-defined stock levels
    const productMinStock = product.minStock || 0
    const productReorderPoint = product.reorderPoint || 0
    const productMaxStock = (product as any).maxStock || 0
    const productSafetyStock = (product as any).safetyStock || 0
    
    // Calculate demand standard deviation from historical data
    let demandStdDev = avgDailyDemand * 0.3 // Default to 30% of average
    try {
      const txns = await listProductStockTxns(workspaceId, product.id, 1000)
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - 90)
      
      // Get daily outgoing transactions (Ship, Adjust-, or any negative qty)
      const dailyShipments: Record<string, number> = {}
      txns.filter(txn => {
        const txnDate = txn.timestamp?.toDate?.() || new Date(txn.timestamp)
        return txnDate >= cutoffDate && txn.qty < 0
      }).forEach(txn => {
        const txnDate = txn.timestamp?.toDate?.() || new Date(txn.timestamp)
        const dateKey = txnDate.toISOString().split('T')[0]
        dailyShipments[dateKey] = (dailyShipments[dateKey] || 0) + Math.abs(txn.qty || 0)
      })
      
      const dailyValues = Object.values(dailyShipments)
      if (dailyValues.length > 1) {
        demandStdDev = calculateStandardDeviation(dailyValues)
      }
    } catch (error) {
      // Use default if calculation fails
    }
    
    // Determine safety stock: use product-defined or calculate
    let safety: number
    if (productSafetyStock > 0) {
      safety = productSafetyStock
    } else if (avgDailyDemand > 0) {
      // Calculate safety stock using 95% service level (z-score = 1.65)
      safety = 1.65 * demandStdDev * Math.sqrt(leadTime + reviewPeriod)
    } else {
      // No demand data - use minStock as safety
      safety = productMinStock * 0.5
    }
    
    // Determine target stock: use product-defined max or calculate
    let targetStock: number
    if (productMaxStock > 0) {
      targetStock = productMaxStock
    } else if (avgDailyDemand > 0) {
      targetStock = safety + avgDailyDemand * (leadTime + reviewPeriod)
    } else if (productMinStock > 0) {
      // No demand data - use 2x minStock as target
      targetStock = productMinStock * 2
    } else {
      targetStock = 0
    }
    
    // Determine reorder point
    let effectiveReorderPoint: number
    if (productReorderPoint > 0) {
      effectiveReorderPoint = productReorderPoint
    } else if (avgDailyDemand > 0) {
      effectiveReorderPoint = safety + avgDailyDemand * leadTime
    } else {
      effectiveReorderPoint = productMinStock
    }
    
    const available = soh
    const onPO = 0 // Not implemented yet - would come from purchase order system
    
    // Calculate suggested quantity
    // If below reorder point, suggest ordering up to target
    let suggestedQty = 0
    if (available <= effectiveReorderPoint && targetStock > 0) {
      suggestedQty = Math.max(0, targetStock - available - onPO)
    } else if (available < safety && targetStock > 0) {
      // Below safety stock - urgent reorder
      suggestedQty = Math.max(0, targetStock - available - onPO)
    }
    
    const moq = (product as any).moq || 1
    const casePack = (product as any).casePack || 1
    
    // Round suggested quantity to case pack and ensure it meets MOQ
    let finalSuggestedQty = suggestedQty
    if (casePack > 1 && finalSuggestedQty > 0) {
      finalSuggestedQty = Math.ceil(suggestedQty / casePack) * casePack
    }
    if (finalSuggestedQty > 0 && finalSuggestedQty < moq) {
      finalSuggestedQty = moq
    }
    
    const supplier = (product as any).supplier || ''
    
    return {
      id: product.id,  // Unique product ID for React keys
      sku: product.sku || '-',
      product: cleanProductName(product.name),
      avgDailyDemand,
      leadTime,
      reviewPeriod,
      safety,
      targetStock,
      available,
      onPO,
      suggestedQty: finalSuggestedQty,
      moq,
      casePack,
      supplier
    }
  }))
  
  return reportData
}

// Helper: Calculate average daily demand from ALL outgoing transaction types
async function calculateAvgDailyDemandAllTypes(
  workspaceId: string,
  productId: string,
  days: number = 90
): Promise<number> {
  try {
    const txns = await listProductStockTxns(workspaceId, productId, 1000)
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - days)
    
    // Filter ALL outgoing transactions (negative qty) from last N days
    const outTxns = txns.filter(txn => {
      const txnDate = txn.timestamp?.toDate?.() || new Date(txn.timestamp)
      return txnDate >= cutoffDate && txn.qty < 0
    })
    
    if (outTxns.length === 0) return 0
    
    // Calculate total units shipped/consumed
    const totalOut = outTxns.reduce((sum, txn) => sum + Math.abs(txn.qty || 0), 0)
    
    // Calculate average daily demand
    const actualDays = Math.max(1, days)
    return totalOut / actualDays
  } catch (error) {
    console.error(`Error calculating avg daily demand for product ${productId}:`, error)
    return 0
  }
}

// SKU Velocity & ABC Report
export async function getSkuVelocityReport(
  workspaceId: string,
  filters: ReportFilters = {}
): Promise<SkuVelocityRow[]> {
  const products = await listProducts(workspaceId)
  
  // Filter out raw materials based on report settings
  let finishedProducts = await filterRawMaterials(workspaceId, products)
  
  // Apply group/folder filter if specified
  if (filters.groupId) {
    finishedProducts = finishedProducts.filter(p => (p as any).groupId === filters.groupId)
  }
  
  const periodDays = 365 // 12 months for annual analysis
  
  // Calculate velocity data from actual transaction history
  const velocityData = await Promise.all(finishedProducts.map(async product => {
    try {
      const txns = await listProductStockTxns(workspaceId, product.id, 1000)
      
      // Filter Ship transactions (sales) from last year
      const cutoffDate = new Date()
      cutoffDate.setFullYear(cutoffDate.getFullYear() - 1)
      
      const shipTxns = txns.filter(txn => {
        const txnDate = txn.timestamp?.toDate?.() || new Date(txn.timestamp)
        return txn.type === 'Ship' && txnDate >= cutoffDate && txn.qty < 0
      })
      
      // Calculate net units sold
      const netUnits = shipTxns.reduce((sum, txn) => sum + Math.abs(txn.qty || 0), 0)
      
      // Calculate revenue (if unitCost is available, use it; otherwise estimate)
      const txnData = shipTxns[0] as any
      const avgUnitPrice = txnData?.unitCost ? 
        shipTxns.reduce((sum, txn) => {
          const txnData = txn as any
          return sum + (txnData.unitCost || 0)
        }, 0) / shipTxns.length : 
        (product as any).pricePerBox || 10 // Fallback to product price or default
      
      const netRevenue = netUnits * avgUnitPrice
      const unitsSoldPerDay = netUnits / periodDays
      const revenuePerDay = netRevenue / periodDays
      
      // Calculate turnover ratio (annual sales / average inventory)
      const avgInventory = product.qtyOnHand || 0
      const turnoverRatio = avgInventory > 0 ? netUnits / avgInventory : 0
      
      // Calculate sell-through percent (units sold / (units sold + current inventory))
      const sellThroughPercent = (netUnits + avgInventory) > 0 ? 
        (netUnits / (netUnits + avgInventory)) * 100 : 0
      
      // Channel detection (could be enhanced with actual channel data from transactions)
      const channel = (product as any).channel || 'Manual'
      
      return {
        id: product.id,  // Unique product ID for React keys
        sku: product.sku || '-',
        product: cleanProductName(product.name),
        unitsSoldPerDay,
        revenuePerDay,
        netUnits,
        netRevenue,
        turnoverRatio,
        sellThroughPercent,
        abcClass: '', // Will be calculated after sorting
        channel
      }
    } catch (error) {
      console.error(`Error calculating velocity for product ${product.id}:`, error)
      // Return zero values if calculation fails
      return {
        id: product.id,  // Unique product ID for React keys
        sku: product.sku || '-',
        product: cleanProductName(product.name),
        unitsSoldPerDay: 0,
        revenuePerDay: 0,
        netUnits: 0,
        netRevenue: 0,
        turnoverRatio: 0,
        sellThroughPercent: 0,
        abcClass: 'C',
        channel: 'Manual'
      }
    }
  }))
  
  // Sort by net revenue and assign ABC classes (80/15/5 rule)
  velocityData.sort((a, b) => b.netRevenue - a.netRevenue)
  const totalRevenue = velocityData.reduce((sum, item) => sum + item.netRevenue, 0)
  
  if (totalRevenue === 0) {
    // If no revenue, assign all to class C
    return velocityData.map(item => ({ ...item, abcClass: 'C' }))
  }
  
  let cumulativeRevenue = 0
  
  return velocityData.map(item => {
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
  workspaceId: string,
  filters: ReportFilters = {}
): Promise<InventoryLedgerRow[]> {
  try {
    const txnsCol = collection(db, 'workspaces', workspaceId, 'stockTxns')
    
    // Safety: limit the number of transactions processed for performance
    // You can override via (filters as any).limit if needed
    const maxTxns: number = (filters as any)?.limit && typeof (filters as any).limit === 'number'
      ? Math.max(100, Math.min(5000, (filters as any).limit)) // clamp between 100 and 5000
      : 1000
    
    // Build query based on filters
    let q = query(txnsCol, orderBy('timestamp', 'desc'))
    
    // Apply filters
    if (filters.sku) {
      // Need to find product ID from SKU first
      const products = await listProducts(workspaceId)
      const product = products.find(p => p.sku === filters.sku)
      if (product) {
        q = query(txnsCol, where('productId', '==', product.id), orderBy('timestamp', 'desc'))
      } else {
        return [] // No product found with this SKU
      }
    }
    
    if (filters.movementType) {
      // Filter by transaction type
      const typeMap: Record<string, string> = {
        'Receive': 'Receive',
        'Ship': 'Ship',
        'Transfer': 'Transfer',
        'Adjust+': 'Adjust+',
        'Adjust-': 'Adjust-'
      }
      const serverType = typeMap[filters.movementType] || filters.movementType
      q = query(txnsCol, where('type', '==', serverType), orderBy('timestamp', 'desc'))
    }
    
    if (filters.user) {
      q = query(txnsCol, where('userId', '==', filters.user), orderBy('timestamp', 'desc'))
    }
    
    // Apply hard limit to avoid loading too many documents at once
    q = query(q, limit(maxTxns))
    
    const txnsSnap = await getDocs(q)
    
    // Get all products for SKU lookup
    const products = await listProducts(workspaceId)
    const productMap = new Map(products.map(p => [p.id, p]))
    
    // Build ledger rows with running balance PER PRODUCT
    const ledgerRows: InventoryLedgerRow[] = []
    // Track running balance per product (productId -> balance)
    const productBalances = new Map<string, number>()
    
    // Process transactions in chronological order (oldest first for running balance)
    const txns = txnsSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) }))
    txns.sort((a, b) => {
      const dateA = a.timestamp?.toDate?.() || new Date(a.timestamp)
      const dateB = b.timestamp?.toDate?.() || new Date(b.timestamp)
      return dateA.getTime() - dateB.getTime()
    })
    
    // Create a map to track products we couldn't find (for fetching individually, with safety guard)
    const missingProductIds = new Set<string>()
    
    // First pass: identify missing products
    txns.forEach(txn => {
      if (txn.productId && !productMap.has(txn.productId)) {
        missingProductIds.add(txn.productId)
      }
    })
    
    // Try to fetch missing products individually from Firestore – but only up to a safe limit
    if (missingProductIds.size > 0) {
      const MAX_MISSING_FETCH = 200
      if (missingProductIds.size > MAX_MISSING_FETCH) {
        console.warn(
          `[Ledger] Skipping individual fetch for ${missingProductIds.size} missing products (limit ${MAX_MISSING_FETCH}). ` +
          'They will appear as deleted products in the ledger.'
        )
      } else {
        console.log('[Ledger] Fetching', missingProductIds.size, 'missing products individually')
        const { doc, getDoc } = await import('firebase/firestore')
        
        for (const productId of missingProductIds) {
          try {
            const productDoc = await getDoc(doc(db, 'workspaces', workspaceId, 'products', productId))
            if (productDoc.exists()) {
              const data = productDoc.data()
              productMap.set(productId, { id: productId, ...data } as any)
            }
          } catch (e) {
            // Product doesn't exist, will show as deleted
          }
        }
      }
    }
    
    txns.forEach(txn => {
      const txnDate = txn.timestamp?.toDate?.() || new Date(txn.timestamp)
      
      // Get product directly by productId
      const product = productMap.get(txn.productId)
      
      // Skip if date filter doesn't match
      if (filters.dateFrom) {
        const fromDate = new Date(filters.dateFrom)
        if (txnDate < fromDate) return
      }
      if (filters.dateTo) {
        const toDate = new Date(filters.dateTo)
        toDate.setHours(23, 59, 59, 999)
        if (txnDate > toDate) return
      }
      
      // Calculate qty based on transaction type and signed qty
      const txnQty = Number(txn.qty || 0)
      const txnType = txn.type
      
      // Handle both signed qty (new format) and unsigned qty with type (old format)
      let deltaQty = txnQty
      if (txnQty >= 0) {
        // qty is positive, determine sign from type
        switch (txnType) {
          case 'Produce':
          case 'Receive':
          case 'Adjust+':
            deltaQty = Math.abs(txnQty)
            break
          case 'Consume':
          case 'Ship':
          case 'Issue':
          case 'Adjust-':
            deltaQty = -Math.abs(txnQty)
            break
          case 'Transfer':
            deltaQty = txn.toLoc ? Math.abs(txnQty) : -Math.abs(txnQty)
            break
          case 'Count':
            deltaQty = 0
            break
          default:
            // For unknown types, assume qty is already signed
            deltaQty = txnQty
        }
      }
      // If qty is negative, it's already signed (new format), use as-is
      
      const qtyIn = deltaQty > 0 ? deltaQty : 0
      const qtyOut = deltaQty < 0 ? Math.abs(deltaQty) : 0
      const net = deltaQty
      
      // Update running balance for THIS PRODUCT ONLY
      const productId = txn.productId || 'unknown'
      const currentBalance = productBalances.get(productId) || 0
      const newBalance = currentBalance + deltaQty
      productBalances.set(productId, newBalance)
      
      // Get product info - if not found, show as deleted with partial ID
      const sku = product?.sku || txn.sku || `#${txn.productId?.substring(0, 6) || 'N/A'}`
      const productName = product?.name || txn.productName || txn.name || '(Deleted Product)'
      
      // Get reason/notes - combine available info
      const reason = txn.reason || txn.note || txn.notes || ''
      
      ledgerRows.push({
        id: txn.id,
        dateTime: txnDate.toISOString(),
        sku,
        productName: cleanProductName(productName),
        movementType: txn.type || 'Unknown',
        locationIn: txn.toLoc || '-',
        locationOut: txn.fromLoc || '-',
        qtyIn,
        qtyOut,
        net,
        runningBalance: newBalance, // Per-product balance
        user: txn.userId || 'Unknown',
        notes: reason,
        reason
      })
    })
    
    // Return in reverse chronological order (newest first)
    return ledgerRows.reverse()
  } catch (error) {
    console.error('Error generating inventory ledger report:', error)
    return []
  }
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
