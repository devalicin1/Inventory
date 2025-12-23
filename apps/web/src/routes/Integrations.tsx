import React from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSessionStore } from '../state/sessionStore'
import { PageShell } from '../components/layout/PageShell'
import { showToast } from '../components/ui/Toast'
import {
  getQuickBooksConfig,
  saveQuickBooksConfig,
  getQuickBooksAuthUrl,
  syncInventoryFromQuickBooks,
  importProductsFromQuickBooks,
  getQuickBooksLogs,
  getQuickBooksAutoSyncConfig,
  saveQuickBooksAutoSyncConfig,
  type QuickBooksLogEntry,
  type QuickBooksConfig,
  type QuickBooksConnectionStatus,
  type QuickBooksAutoSyncConfig,
} from '../api/quickbooks'
import { listProducts } from '../api/inventory'
import { QuickBooksTab } from './Settings'

function Card({
  title,
  description,
  right,
  children,
}: {
  title: string
  description?: string
  right?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
      <div className="px-6 py-4 border-b border-gray-100 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
          {description ? <p className="mt-1 text-xs text-gray-500">{description}</p> : null}
        </div>
        {right ? <div className="shrink-0">{right}</div> : null}
      </div>
      <div className="p-6">{children}</div>
    </div>
  )
}

function Badge({
  tone = 'gray',
  children,
}: {
  tone?: 'gray' | 'blue' | 'green' | 'red' | 'amber'
  children: React.ReactNode
}) {
  const map = {
    gray: 'bg-gray-100 text-gray-800',
    blue: 'bg-blue-100 text-blue-800',
    green: 'bg-green-100 text-green-800',
    red: 'bg-red-100 text-red-800',
    amber: 'bg-amber-100 text-amber-800',
  } as const

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs ${map[tone]}`}>
      {children}
    </span>
  )
}

export function Integrations() {
  const { workspaceId } = useSessionStore()
  const queryClient = useQueryClient()

  const toJsDate = (value: any): Date | null => {
    if (!value) return null
    if (typeof value.toDate === 'function') {
      const d = value.toDate()
      return isNaN(d.getTime()) ? null : d
    }
    if (typeof value === 'object') {
      const seconds = (value as any).seconds ?? (value as any)._seconds
      if (typeof seconds === 'number') {
        const d = new Date(seconds * 1000)
        return isNaN(d.getTime()) ? null : d
      }
    }
    const d = new Date(value)
    return isNaN(d.getTime()) ? null : d
  }

  const formatDateTime = (d: Date | null) => {
    if (!d) return '-'
    try {
      return new Intl.DateTimeFormat('en-GB', {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }).format(d)
    } catch {
      return d.toLocaleString()
    }
  }

  const { data: quickBooksStatus, isLoading: quickBooksLoading, refetch: refetchQuickBooks } =
    useQuery({
      queryKey: ['quickBooksConfig', workspaceId],
      queryFn: () => getQuickBooksConfig(workspaceId!),
      enabled: !!workspaceId,
    })

  const { data: products = [] } = useQuery({
    queryKey: ['products', workspaceId],
    queryFn: () => listProducts(workspaceId!),
    enabled: !!workspaceId,
  })

  const canManageSettings = true

  const { data: quickBooksLogs = [], isLoading: logsLoading } = useQuery({
    queryKey: ['quickBooksLogs', workspaceId],
    queryFn: () => getQuickBooksLogs(workspaceId!, 20),
    enabled: !!workspaceId,
  })

  const { data: autoSyncConfig, isLoading: autoSyncLoading } = useQuery({
    queryKey: ['quickBooksAutoSyncConfig', workspaceId],
    queryFn: () => getQuickBooksAutoSyncConfig(workspaceId!),
    enabled: !!workspaceId,
  })

  // Auto Sync UX: local edits + explicit Save
  const [inventoryFrequency, setInventoryFrequency] =
    React.useState<QuickBooksAutoSyncConfig['inventorySyncInterval']>('off')
  const [productFrequency, setProductFrequency] =
    React.useState<QuickBooksAutoSyncConfig['productImportInterval']>('off')
  const [savingAutoSync, setSavingAutoSync] = React.useState(false)

  React.useEffect(() => {
    if (autoSyncConfig) {
      setInventoryFrequency(autoSyncConfig.inventorySyncInterval)
      setProductFrequency(autoSyncConfig.productImportInterval)
    } else {
      setInventoryFrequency('off')
      setProductFrequency('off')
    }
  }, [autoSyncConfig])

  const hasAutoSyncChanges = React.useMemo(() => {
    const currentInv = autoSyncConfig?.inventorySyncInterval ?? 'off'
    const currentProd = autoSyncConfig?.productImportInterval ?? 'off'
    return inventoryFrequency !== currentInv || productFrequency !== currentProd
  }, [autoSyncConfig, inventoryFrequency, productFrequency])

  const lastInventorySyncAt = toJsDate((autoSyncConfig as any)?.lastInventorySyncAt)
  const lastProductImportAt = toJsDate((autoSyncConfig as any)?.lastProductImportAt)

  // Activity filters
  const [typeFilter, setTypeFilter] = React.useState<'all' | 'product_import' | 'inventory_sync'>(
    'all'
  )
  const [triggerFilter, setTriggerFilter] = React.useState<'all' | 'manual' | 'auto'>('all')
  const [statusFilter, setStatusFilter] = React.useState<'all' | 'success' | 'failed'>('all')

  // Activity pagination (client-side over fetched logs)
  const [page, setPage] = React.useState(1)
  const [pageSize, setPageSize] = React.useState(10)

  const filteredLogs = React.useMemo(() => {
    return quickBooksLogs.filter((log: QuickBooksLogEntry) => {
      const errors = log.errors ?? 0
      const derivedStatus: 'success' | 'failed' = (log.status as any) || (errors > 0 ? 'failed' : 'success')
      const trigger = (log.trigger ?? 'manual') as 'manual' | 'auto'
      const type = log.type as 'product_import' | 'inventory_sync' | string

      if (typeFilter !== 'all' && type !== typeFilter) return false
      if (triggerFilter !== 'all' && trigger !== triggerFilter) return false
      if (statusFilter !== 'all' && derivedStatus !== statusFilter) return false
      return true
    })
  }, [quickBooksLogs, typeFilter, triggerFilter, statusFilter])

  // Reset to first page when filters or source logs change
  React.useEffect(() => {
    setPage(1)
  }, [typeFilter, triggerFilter, statusFilter, quickBooksLogs])

  const totalItems = filteredLogs.length
  const totalPages = totalItems === 0 ? 1 : Math.ceil(totalItems / pageSize)
  const currentPage = Math.min(page, totalPages)
  const paginatedLogs = React.useMemo(() => {
    const start = (currentPage - 1) * pageSize
    const end = start + pageSize
    return filteredLogs.slice(start, end)
  }, [filteredLogs, currentPage, pageSize])

  return (
    <PageShell title="Integrations">
      <div className="space-y-6">
        {!workspaceId ? (
          <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-xl px-4 py-3 text-sm">
            Select a workspace to manage integrations.
          </div>
        ) : null}

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* QuickBooks (main) */}
          <div className="xl:col-span-2 space-y-6">
            <Card
              title="QuickBooks"
              description="Connect your QuickBooks Online account and manage product import / inventory sync."
              right={
                quickBooksLoading ? (
                  <Badge tone="gray">Loading</Badge>
                ) : quickBooksStatus ? (
                  <Badge tone="green">Configured</Badge>
                ) : (
                  <Badge tone="amber">Not configured</Badge>
                )
              }
            >
              <QuickBooksTab
                workspaceId={workspaceId || ''}
                status={quickBooksStatus as QuickBooksConnectionStatus | undefined}
                isLoading={quickBooksLoading}
                products={products}
                canManage={canManageSettings}
                onConfigSave={async (config: QuickBooksConfig) => {
                  if (!workspaceId) return
                  try {
                    await saveQuickBooksConfig(workspaceId, config)
                    refetchQuickBooks()
                    showToast('QuickBooks configuration saved successfully!', 'success')
                  } catch (error) {
                    console.error('Save error:', error)
                    showToast(
                      'Error saving configuration: ' +
                        (error instanceof Error ? error.message : 'Unknown error'),
                      'error'
                    )
                  }
                }}
                onConnect={async () => {
                  if (!workspaceId) return
                  try {
                    const authUrl = await getQuickBooksAuthUrl(workspaceId)
                    window.open(authUrl, 'quickbooks_oauth', 'width=600,height=700')
                  } catch (error) {
                    console.error('Connect error:', error)
                    showToast(
                      'Error connecting to QuickBooks: ' +
                        (error instanceof Error ? error.message : 'Unknown error'),
                      'error'
                    )
                  }
                }}
                onImportProducts={async (skus?: string[]) => {
                  if (!workspaceId) return
                  try {
                    showToast('Importing products from QuickBooks...', 'info')
                    const result = await importProductsFromQuickBooks(workspaceId, skus)
                    showToast(
                      `Imported ${result.imported} products, updated ${result.updated} products. ${
                        result.skipped > 0 ? `${result.skipped} skipped.` : ''
                      } ${result.errors > 0 ? `${result.errors} errors.` : ''}`,
                      result.imported > 0 || result.updated > 0 ? 'success' : 'error'
                    )
                    queryClient.invalidateQueries({ queryKey: ['products', workspaceId] })
                    queryClient.invalidateQueries({ queryKey: ['quickBooksLogs', workspaceId] })
                  } catch (error) {
                    console.error('Import error:', error)
                    showToast(
                      'Error importing products: ' +
                        (error instanceof Error ? error.message : 'Unknown error'),
                      'error'
                    )
                  }
                }}
                onSyncInventory={async () => {
                  if (!workspaceId) return
                  try {
                    showToast('Syncing inventory from QuickBooks...', 'info')
                    await syncInventoryFromQuickBooks(workspaceId)
                    showToast('Inventory synced successfully!', 'success')
                    queryClient.invalidateQueries({ queryKey: ['products', workspaceId] })
                    queryClient.invalidateQueries({ queryKey: ['quickBooksLogs', workspaceId] })
                  } catch (error) {
                    console.error('Sync error:', error)
                    showToast(
                      'Error syncing inventory: ' +
                        (error instanceof Error ? error.message : 'Unknown error'),
                      'error'
                    )
                  }
                }}
              />
            </Card>
          </div>

          {/* Auto Sync (sidebar) */}
          <div className="xl:col-span-1">
            <Card
              title="Auto Sync"
              description="Set how frequently inventory and products are synchronized."
              right={
                autoSyncLoading ? (
                  <Badge tone="gray">Loading</Badge>
                ) : inventoryFrequency === 'off' && productFrequency === 'off' ? (
                  <Badge tone="amber">Disabled</Badge>
                ) : (
                  <Badge tone="blue">Enabled</Badge>
                )
              }
            >
              {autoSyncLoading ? (
                <div className="text-gray-500 text-sm">Loading auto sync settings...</div>
              ) : (
                <div className="space-y-5">
                  <div className="space-y-2">
                    <label className="block text-xs font-medium text-gray-700">
                      Inventory sync frequency
                    </label>
                    <select
                      className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm"
                      disabled={!workspaceId || savingAutoSync}
                      value={inventoryFrequency}
                      onChange={(e) =>
                        setInventoryFrequency(
                          e.target.value as QuickBooksAutoSyncConfig['inventorySyncInterval']
                        )
                      }
                    >
                      <option value="off">Off</option>
                      <option value="30m">Every 30 minutes</option>
                      <option value="1h">Hourly</option>
                      <option value="4h">Every 4 hours</option>
                      <option value="1d">Daily</option>
                    </select>
                    <p className="text-xs text-gray-500">
                      Last run: <span className="text-gray-700">{formatDateTime(lastInventorySyncAt)}</span>
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-xs font-medium text-gray-700">
                      Product import frequency
                    </label>
                    <select
                      className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm"
                      disabled={!workspaceId || savingAutoSync}
                      value={productFrequency}
                      onChange={(e) =>
                        setProductFrequency(
                          e.target.value as QuickBooksAutoSyncConfig['productImportInterval']
                        )
                      }
                    >
                      <option value="off">Off</option>
                      <option value="1d">Daily</option>
                      <option value="7d">Weekly</option>
                    </select>
                    <p className="text-xs text-gray-500">
                      Last run: <span className="text-gray-700">{formatDateTime(lastProductImportAt)}</span>
                    </p>
                  </div>

                  <div className="pt-2 flex items-center justify-between gap-3">
                    {hasAutoSyncChanges ? (
                      <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded-lg">
                        Unsaved changes
                      </span>
                    ) : (
                      <span className="text-xs text-gray-500">Up to date</span>
                    )}

                    <button
                      type="button"
                      disabled={!workspaceId || savingAutoSync || !hasAutoSyncChanges}
                      onClick={async () => {
                        if (!workspaceId) return
                        setSavingAutoSync(true)
                        try {
                          await saveQuickBooksAutoSyncConfig(workspaceId, {
                            inventorySyncInterval: inventoryFrequency,
                            productImportInterval: productFrequency,
                          })
                          await queryClient.invalidateQueries({
                            queryKey: ['quickBooksAutoSyncConfig', workspaceId],
                          })
                          showToast('Auto sync settings saved.', 'success')
                        } catch (error) {
                          console.error('Auto sync save error:', error)
                          showToast(
                            'Error saving auto sync settings: ' +
                              (error instanceof Error ? error.message : 'Unknown error'),
                            'error'
                          )
                        } finally {
                          setSavingAutoSync(false)
                        }
                      }}
                      className="inline-flex items-center justify-center rounded-lg bg-gray-900 px-3 py-2 text-xs font-semibold text-white shadow-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-800"
                    >
                      {savingAutoSync ? 'Saving…' : 'Save changes'}
                    </button>
                  </div>

                  <div className="text-xs text-gray-500 leading-relaxed">
                    Recommendation: Inventory sync can be hourly or every 4 hours for most teams. Product import is typically
                    daily or weekly.
                  </div>
                </div>
              )}
            </Card>
          </div>
        </div>

        {/* Activity */}
        <Card
          title="QuickBooks Activity"
          description="Recent imports and inventory sync runs (last 20). Use filters and pagination to review outcomes."
          right={
            logsLoading ? (
              <Badge tone="gray">Loading</Badge>
            ) : quickBooksLogs.length === 0 ? (
              <Badge tone="amber">No activity</Badge>
            ) : (
              <Badge tone="blue">{quickBooksLogs.length} entries</Badge>
            )
          }
        >
          {logsLoading ? (
            <div className="text-gray-500 text-sm">Loading activity...</div>
          ) : quickBooksLogs.length === 0 ? (
            <div className="text-gray-500 text-sm">
              No QuickBooks activity found yet. Run an import or inventory sync to see logs here.
            </div>
          ) : (
            <div className="space-y-4">
              {/* Filters */}
              <div className="flex flex-col md:flex-row md:items-end gap-3">
                <div className="min-w-[180px]">
                  <label className="block text-xs font-medium text-gray-700 mb-1">Type</label>
                  <select
                    className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm"
                    value={typeFilter}
                    onChange={(e) =>
                      setTypeFilter(e.target.value as typeof typeFilter)
                    }
                  >
                    <option value="all">All</option>
                    <option value="product_import">Product Import</option>
                    <option value="inventory_sync">Inventory Sync</option>
                  </select>
                </div>

                <div className="min-w-[180px]">
                  <label className="block text-xs font-medium text-gray-700 mb-1">Trigger</label>
                  <select
                    className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm"
                    value={triggerFilter}
                    onChange={(e) =>
                      setTriggerFilter(e.target.value as typeof triggerFilter)
                    }
                  >
                    <option value="all">All</option>
                    <option value="manual">Manual</option>
                    <option value="auto">Auto</option>
                  </select>
                </div>

                <div className="min-w-[180px]">
                  <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
                  <select
                    className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm"
                    value={statusFilter}
                    onChange={(e) =>
                      setStatusFilter(e.target.value as typeof statusFilter)
                    }
                  >
                    <option value="all">All</option>
                    <option value="success">Success</option>
                    <option value="failed">Failed</option>
                  </select>
                </div>

                <div className="md:ml-auto text-xs text-gray-500">
                  Showing <span className="text-gray-800 font-semibold">{filteredLogs.length}</span> result(s)
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        Date
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        Type
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        Trigger
                      </th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        Imported
                      </th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        Updated
                      </th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        Skipped
                      </th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        Errors
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        Status
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-gray-100 bg-white">
                    {paginatedLogs.map((log: QuickBooksLogEntry, idx: number) => {
                      const started = toJsDate(log.startedAt)
                      const finished = toJsDate(log.finishedAt)
                      const date = finished || started

                      const imported = log.imported ?? log.matchedProducts ?? 0
                      const updated = log.updated ?? log.updatedProducts ?? 0
                      const skipped = log.skipped ?? log.unchangedProducts ?? 0
                      const errors = log.errors ?? 0

                      const typeLabel =
                        log.type === 'product_import'
                          ? 'Product Import'
                          : log.type === 'inventory_sync'
                          ? 'Inventory Sync'
                          : log.type

                      const derivedStatus: 'success' | 'failed' =
                        (log.status as any) || (errors > 0 ? 'failed' : 'success')
                      const trigger = (log.trigger ?? 'manual') as 'manual' | 'auto'

                      return (
                        <tr key={log.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}>
                          <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-800">
                            {formatDateTime(date)}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-800">
                            {typeLabel}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap text-xs">
                            <Badge tone={trigger === 'auto' ? 'blue' : 'gray'}>
                              {trigger === 'auto' ? 'Auto' : 'Manual'}
                            </Badge>
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap text-xs text-right text-gray-800">
                            {imported}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap text-xs text-right text-gray-800">
                            {updated}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap text-xs text-right text-gray-800">
                            {skipped}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap text-xs text-right text-gray-800">
                            {errors}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap text-xs">
                            <Badge tone={derivedStatus === 'success' ? 'green' : 'red'}>
                              {derivedStatus === 'success' ? 'Success' : 'Failed'}
                            </Badge>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>

                {filteredLogs.length === 0 ? (
                  <div className="p-4 text-sm text-gray-500">
                    No results match the selected filters.
                  </div>
                ) : null}

                {filteredLogs.length > 0 ? (
                  <div className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3 justify-between border-t border-gray-200 bg-gray-50">
                    <div className="flex items-center gap-2 text-xs text-gray-600">
                      <span>Rows per page</span>
                      <select
                        className="border-gray-300 rounded-md text-xs shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                        value={pageSize}
                        onChange={(e) => {
                          const nextSize = Number(e.target.value) || 10
                          setPageSize(nextSize)
                          setPage(1)
                        }}
                      >
                        <option value={5}>5</option>
                        <option value={10}>10</option>
                        <option value={20}>20</option>
                      </select>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-4 text-xs text-gray-600">
                      <span>
                        Showing{' '}
                        <span className="font-semibold">
                          {totalItems === 0
                            ? 0
                            : (currentPage - 1) * pageSize + 1}
                          {' - '}
                          {Math.min(currentPage * pageSize, totalItems)}
                        </span>{' '}
                        of <span className="font-semibold">{totalItems}</span>
                      </span>

                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setPage((p) => Math.max(1, p - 1))}
                          disabled={currentPage <= 1}
                          className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Previous
                        </button>
                        <span className="text-xs text-gray-500">
                          Page <span className="font-semibold">{currentPage}</span> of{' '}
                          <span className="font-semibold">{totalPages}</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                          disabled={currentPage >= totalPages}
                          className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </Card>
      </div>
    </PageShell>
  )
}
