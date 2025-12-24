/**
 * QuickBooks API Integration - Frontend Client
 */

import { httpsCallable } from 'firebase/functions'
import { functions } from '../lib/firebase'

export interface QuickBooksConfig {
  clientId?: string
  clientSecret?: string
  redirectUri?: string
  environment?: 'sandbox' | 'production'
  realmId?: string
}

export interface QuickBooksConnectionStatus {
  connected: boolean
  environment?: 'sandbox' | 'production'
  realmId?: string
}

export type AutoSyncInterval =
  | 'off'
  | '30m'
  | '1h'
  | '4h'
  | '1d'
  | '7d'

export interface QuickBooksAutoSyncConfig {
  inventorySyncInterval: AutoSyncInterval
  productImportInterval: AutoSyncInterval
  lastInventorySyncAt?: any | null
  lastProductImportAt?: any | null
}

export interface ProductSyncData {
  id: string
  name: string
  sku: string
  qtyOnHand?: number
  pricePerBox?: number
  uom?: string
}

/**
 * Get QuickBooks authorization URL
 */
export async function getQuickBooksAuthUrl(workspaceId: string): Promise<string> {
  const fn = httpsCallable(functions, 'getQuickBooksAuthUrl')
  const result = await fn({ workspaceId })
  const data = result.data as { authUrl: string }
  return data.authUrl
}

/**
 * Handle QuickBooks OAuth callback
 */
export async function quickBooksOAuthCallback(
  workspaceId: string,
  authCode: string,
  realmId: string
): Promise<void> {
  const fn = httpsCallable(functions, 'quickBooksOAuthCallback')
  await fn({ workspaceId, authCode, realmId })
}

/**
 * Save QuickBooks configuration
 */
export async function saveQuickBooksConfig(
  workspaceId: string,
  config: QuickBooksConfig
): Promise<void> {
  const fn = httpsCallable(functions, 'saveQuickBooksConfig')
  await fn({ workspaceId, config })
}

/**
 * Get QuickBooks connection status
 */
export async function getQuickBooksConfig(
  workspaceId: string
): Promise<QuickBooksConnectionStatus> {
  const fn = httpsCallable(functions, 'getQuickBooksConfig')
  const result = await fn({ workspaceId })
  return result.data as QuickBooksConnectionStatus
}

/**
 * Sync product to QuickBooks
 */
export async function syncProductToQuickBooks(
  workspaceId: string,
  product: ProductSyncData,
  quickBooksItemId?: string
): Promise<string> {
  const fn = httpsCallable(functions, 'syncProductToQuickBooks')
  const result = await fn({ workspaceId, product, quickBooksItemId })
  const data = result.data as { itemId: string }
  return data.itemId
}

/**
 * Sync inventory from QuickBooks
 */
export async function syncInventoryFromQuickBooks(workspaceId: string): Promise<void> {
  const fn = httpsCallable(functions, 'syncInventoryFromQuickBooks')
  await fn({ workspaceId })
}

/**
 * Get QuickBooks items
 */
export async function getQuickBooksItems(workspaceId: string): Promise<any[]> {
  const fn = httpsCallable(functions, 'getQuickBooksItems')
  const result = await fn({ workspaceId })
  const data = result.data as { items: any[] }
  return data.items
}

/**
 * Import products from QuickBooks
 * If skus is provided, only those SKUs will be imported.
 */
export async function importProductsFromQuickBooks(
  workspaceId: string,
  skus?: string[],
  jobId?: string
): Promise<{ imported: number; updated: number; skipped: number; errors: number; totalItems: number }> {
  const fn = httpsCallable(functions, 'importProductsFromQuickBooks')
  const result = await fn({ workspaceId, skus, jobId })
  return result.data as {
    imported: number
    updated: number
    skipped: number
    errors: number
    totalItems: number
  }
}

export interface QuickBooksLogEntry {
  id: string
  type: 'product_import' | 'inventory_sync' | string
  startedAt?: any
  finishedAt?: any
  imported?: number
  updated?: number
  skipped?: number
  errors?: number
  matchedProducts?: number
  updatedProducts?: number
  unchangedProducts?: number
  status?: string
  trigger?: 'auto' | 'manual'
  errorMessage?: string
  allowedSkus?: string[]
  filteredBySkus?: boolean
  totalItemsFromQuickBooks?: number
  details?: {
    items?: Array<{
      sku?: string
      name?: string
      quickBooksItemId?: string | null
      productId?: string | null
      action: 'imported' | 'updated' | 'skipped' | 'error'
      reason?: string
    }>
    truncated?: boolean
  }
}

export async function getQuickBooksLogs(
  workspaceId: string,
  limit = 20
): Promise<QuickBooksLogEntry[]> {
  const fn = httpsCallable(functions, 'getQuickBooksLogs')
  const result = await fn({ workspaceId, limit })
  const data = result.data as { logs: QuickBooksLogEntry[] }
  return data.logs
}

export async function getQuickBooksAutoSyncConfig(
  workspaceId: string
): Promise<QuickBooksAutoSyncConfig> {
  const fn = httpsCallable(functions, 'getQuickBooksAutoSyncConfigFn')
  const result = await fn({ workspaceId })
  return result.data as QuickBooksAutoSyncConfig
}

export async function saveQuickBooksAutoSyncConfig(
  workspaceId: string,
  config: Partial<QuickBooksAutoSyncConfig>
): Promise<void> {
  const fn = httpsCallable(functions, 'saveQuickBooksAutoSyncConfigFn')
  await fn({ workspaceId, config })
}

/**
 * Create invoice in QuickBooks
 */
export async function createQuickBooksInvoice(
  workspaceId: string,
  invoice: {
    TxnDate: string
    DueDate?: string
    CustomerRef: { value: string; name?: string }
    Line: Array<{
      DetailType: 'SalesItemLineDetail'
      Amount: number
      SalesItemLineDetail: {
        ItemRef: { value: string; name?: string }
        UnitPrice: number
        Qty: number
      }
      Description?: string
    }>
  }
): Promise<string> {
  const fn = httpsCallable(functions, 'createQuickBooksInvoice')
  const result = await fn({ workspaceId, invoice })
  const data = result.data as { invoiceId: string }
  return data.invoiceId
}

