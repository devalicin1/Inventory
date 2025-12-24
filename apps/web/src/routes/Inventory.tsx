import React, { useMemo, useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { PageShell } from '../components/layout/PageShell'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { DataTable } from '../components/DataTable'
import { Scanner } from '../components/Scanner'
import { ProductForm } from '../components/ProductForm'
import { ProductDetails } from '../components/ProductDetails'

import { listProducts, getProductOnHand, createStockTransaction } from '../api/inventory'
import {
  listGroups,
  type Group,
  setProductStatus,
  deleteProduct,
  moveProductToGroup,
  createGroup,
  deleteGroup,
  renameGroup,
  moveGroupParent,
  createProduct,
  subscribeToProducts,
} from '../api/products'
import { listUOMs } from '../api/settings'
import { hasWorkspacePermission } from '../utils/permissions'
import { scoreAndSort } from '../utils/search'
import { toCSV, downloadCSV, parseCSV } from '../utils/csv'
import { showToast } from '../components/ui/Toast'
import { useSessionStore } from '../state/sessionStore'

import {
  PlusIcon,
  QrCodeIcon,
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  FolderIcon,
  FolderPlusIcon,
  PencilIcon,
  TrashIcon,
  EyeIcon,
  ArchiveBoxIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ChevronLeftIcon,
  EllipsisHorizontalIcon,
  EllipsisVerticalIcon,
  DocumentArrowDownIcon,
  ArrowPathIcon,
  ExclamationCircleIcon,
  XMarkIcon,
  MinusIcon,
} from '@heroicons/react/24/outline'

interface Product {
  id: string
  name: string
  sku: string
  uom: string
  minStock: number
  reorderPoint: number
  status: string
  qtyOnHand?: number
}

export function Inventory() {
  const qc = useQueryClient()
  const { workspaceId, userId } = useSessionStore()

  // Core UI
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [showScanner, setShowScanner] = useState(false)
  const [showDuplicates, setShowDuplicates] = useState(false)

  // Filters / selection
  const [selectedGroup, setSelectedGroup] = useState<string>('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [lowStockFilter, setLowStockFilter] = useState<boolean>(false)
  const [showFilters, setShowFilters] = useState(false)

  // Layout
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const [showMobileSidebar, setShowMobileSidebar] = useState(false)
  const [showMoreMenu, setShowMoreMenu] = useState(false)
  const [rowActionMenuOpen, setRowActionMenuOpen] = useState<string | null>(null)

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(25)

  // Quick adjust (mobile-first, minimal)
  const [quickAdjustProduct, setQuickAdjustProduct] = useState<string | null>(null)
  const [adjustQty, setAdjustQty] = useState<number>(1)
  const [isAdjusting, setIsAdjusting] = useState(false)

  // Permission
  const [canManageInventory, setCanManageInventory] = useState(false)

  // Permission check
  useEffect(() => {
    if (!workspaceId || !userId) {
      setCanManageInventory(false)
      return
    }
    hasWorkspacePermission(workspaceId, userId, 'manage_inventory')
      .then(setCanManageInventory)
      .catch(() => setCanManageInventory(false))
  }, [workspaceId, userId])

  const {
    data: products = [],
    isLoading: productsLoading,
    refetch: refetchProducts,
  } = useQuery({
    queryKey: ['products', workspaceId],
    queryFn: () => listProducts(workspaceId!),
    enabled: !!workspaceId,
    staleTime: Infinity, // real-time subscription drives updates
  })

  const { data: groups = [], isLoading: groupsLoading } = useQuery<Group[]>({
    queryKey: ['groups', workspaceId],
    queryFn: () => listGroups(workspaceId!),
    enabled: !!workspaceId,
  })

  const isLoading = productsLoading || groupsLoading

  // Real-time subscription (preserve qtyOnHand in cache, recompute safely)
  useEffect(() => {
    if (!workspaceId) return
    let isMounted = true
    let pendingUpdate: ReturnType<typeof setTimeout> | null = null

    const unsubscribe = subscribeToProducts(
      workspaceId,
      (updatedProducts) => {
        if (pendingUpdate) clearTimeout(pendingUpdate)
        pendingUpdate = setTimeout(async () => {
          if (!isMounted) return
          try {
            const currentCache = (qc.getQueryData(['products', workspaceId]) as Product[]) || []
            const cacheMap = new Map(currentCache.map((p) => [p.id, p]))

            const productsWithStock = await Promise.all(
              updatedProducts.map(async (p: any) => {
                try {
                  const onHand = await getProductOnHand(workspaceId, p.id)
                  return { ...p, qtyOnHand: onHand }
                } catch {
                  const cached = cacheMap.get(p.id)
                  return { ...p, qtyOnHand: cached?.qtyOnHand ?? p.qtyOnHand ?? 0 }
                }
              })
            )

            if (isMounted) qc.setQueryData(['products', workspaceId], productsWithStock)
          } catch (err) {
            console.error('[Inventory] Real-time update failed:', err)
            if (isMounted) qc.setQueryData(['products', workspaceId], updatedProducts)
          }
        }, 120)
      },
      (error) => console.error('[Inventory] Subscription error:', error)
    )

    return () => {
      isMounted = false
      if (pendingUpdate) clearTimeout(pendingUpdate)
      unsubscribe()
    }
  }, [workspaceId, qc])

  // Refetch on open
  useEffect(() => {
    if (!workspaceId) return
    refetchProducts()
  }, [workspaceId, refetchProducts])

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1)
    setSelectedIds([])
  }, [selectedGroup, searchTerm, statusFilter, lowStockFilter])

  // Open details from URL param
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const productId = params.get('productId')
    const action = params.get('action')

    if (action === 'new') {
      setShowCreate(true)
      const newParams = new URLSearchParams(window.location.search)
      newParams.delete('action')
      const newUrl = newParams.toString()
        ? `${window.location.pathname}?${newParams.toString()}`
        : window.location.pathname
      window.history.replaceState({}, '', newUrl)
      return
    }

    if (productId && products.length > 0 && !selectedProduct) {
      const p = products.find((x) => x.id === productId)
      if (p) {
        setSelectedProduct(p)
        window.history.replaceState({}, '', '/inventory')
      }
    }
  }, [products, selectedProduct])

  // Filtered products (search + filters)
  const filteredProducts = useMemo(() => {
    let filtered = products

    if (selectedGroup) filtered = filtered.filter((p: any) => p.groupId === selectedGroup)
    if (statusFilter !== 'all') filtered = filtered.filter((p) => p.status === statusFilter)
    if (lowStockFilter) filtered = filtered.filter((p) => (p.qtyOnHand || 0) < (p.minStock || 0))

    if (searchTerm.trim()) {
      const scored = scoreAndSort(filtered, searchTerm, (p) => [p.name || '', p.sku || '', p.id || ''])
      filtered = scored.map((r) => r.item)
    }

    return filtered
  }, [products, selectedGroup, statusFilter, lowStockFilter, searchTerm])

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / itemsPerPage))
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedProducts = useMemo(() => filteredProducts.slice(startIndex, endIndex), [filteredProducts, startIndex, endIndex])

  // Duplicates by SKU (ignore empty)
  const duplicateProducts = useMemo(() => {
    const skuMap = new Map<string, Product[]>()
    for (const p of products) {
      const sku = (p.sku || '').toLowerCase().trim()
      if (!sku) continue
      if (!skuMap.has(sku)) skuMap.set(sku, [])
      skuMap.get(sku)!.push(p)
    }
    const duplicates: Array<{ sku: string; products: Product[] }> = []
    skuMap.forEach((arr, sku) => {
      if (arr.length > 1) duplicates.push({ sku, products: arr })
    })
    return duplicates.sort((a, b) => a.sku.localeCompare(b.sku))
  }, [products])

  // Simple stats (minimal)
  const stats = useMemo(() => {
    const total = products.length
    const low = products.filter((p) => (p.qtyOnHand || 0) < (p.minStock || 0)).length
    const out = products.filter((p) => (p.qtyOnHand || 0) <= 0).length
    const active = products.filter((p) => p.status === 'active').length
    return { total, low, out, active }
  }, [products])

  const toggleGroupExpansion = (groupId: string) => {
    setExpandedGroups((prev) => {
      const s = new Set(prev)
      if (s.has(groupId)) s.delete(groupId)
      else s.add(groupId)
      return s
    })
  }

  const handleScan = (result: string) => {
    const product = products.find((p) => p.sku === result || p.id === result)
    if (product) setSelectedProduct(product)
    setShowScanner(false)
  }

  const handleQuickAdjust = async (productId: string, type: 'in' | 'out', qty: number) => {
    if (!workspaceId) return
    if (qty <= 0 || isAdjusting) return

    setIsAdjusting(true)
    try {
      const p = products.find((x) => x.id === productId)
      await createStockTransaction({
        workspaceId,
        productId,
        type,
        qty,
        userId: userId || undefined,
        reason: type === 'in' ? 'Quick stock in' : 'Quick stock out',
      })
      qc.invalidateQueries({ queryKey: ['products', workspaceId] })
      window.dispatchEvent(new Event('stockTransactionCreated'))

      showToast(
        `Stock ${type === 'in' ? 'added' : 'removed'}: ${type === 'in' ? '+' : '-'}${qty} ${p?.uom || 'units'} (${p?.sku || productId.slice(0, 8)})`,
        'success',
        2500
      )

      setQuickAdjustProduct(null)
      setAdjustQty(1)
    } catch (err) {
      console.error(err)
      showToast(`Failed to adjust stock: ${err instanceof Error ? err.message : 'Unknown error'}`, 'error', 4500)
    } finally {
      setIsAdjusting(false)
    }
  }

  const handleCreateDefaultGroups = async () => {
    if (!workspaceId) return
    const templateNames = ['Raw Materials', 'Work In Progress', 'Finished Goods', 'Consumables', 'Tools & Equipment']

    const existing = new Set(groups.map((g) => g.name.toLowerCase().trim()))
    const toCreate = templateNames.filter((n) => !existing.has(n.toLowerCase().trim()))
    if (toCreate.length === 0) {
      alert('All recommended folders already exist.')
      return
    }

    try {
      await Promise.all(toCreate.map((name) => createGroup(workspaceId, name)))
      qc.invalidateQueries({ queryKey: ['groups', workspaceId] })
    } catch (err) {
      console.error(err)
      alert('Failed to create folders')
    }
  }

  // Folder tree (unchanged behavior, slightly simpler UI)
  const FolderTree = ({
    groups,
    parentId = null,
    depth = 0,
  }: {
    groups: Group[]
    parentId?: string | null
    depth?: number
  }) => {
    const normalizedParent = parentId ?? null
    const children = groups.filter((g) => (g.parentId ?? null) === normalizedParent)

    return (
      <div className="space-y-1">
        {children
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((group) => {
            const hasChildren = groups.some((g) => g.parentId === group.id)
            const isExpanded = expandedGroups.has(group.id)
            const isSelected = selectedGroup === group.id

            return (
              <div key={group.id} className="select-none">
                <div
                  className={`group flex items-center gap-2 px-2.5 py-2 rounded-lg cursor-pointer transition-colors ${
                    isSelected ? 'bg-blue-50 border border-blue-200 text-blue-700' : 'hover:bg-gray-50 text-gray-700'
                  }`}
                  style={{ paddingLeft: `${depth * 12 + 8}px` }}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'group', id: group.id }))
                    e.dataTransfer.effectAllowed = 'move'
                  }}
                  onDragOver={(e) => {
                    e.preventDefault()
                    e.dataTransfer.dropEffect = 'move'
                  }}
                  onDrop={async (e) => {
                    e.preventDefault()
                    const data = e.dataTransfer.getData('text/plain')
                    try {
                      const parsed = JSON.parse(data)
                      if (parsed?.type === 'group' && parsed?.id && parsed.id !== group.id) {
                        await moveGroupParent(workspaceId!, parsed.id, group.id)
                        qc.invalidateQueries({ queryKey: ['groups', workspaceId] })
                      }
                    } catch {}
                  }}
                  onClick={() => {
                    setSelectedGroup(group.id)
                    setShowMobileSidebar(false)
                  }}
                >
                  {hasChildren ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleGroupExpansion(group.id)
                      }}
                      className="p-1 rounded hover:bg-white"
                      title={isExpanded ? 'Collapse' : 'Expand'}
                    >
                      {isExpanded ? (
                        <ChevronDownIcon className="h-3.5 w-3.5 text-gray-500" />
                      ) : (
                        <ChevronRightIcon className="h-3.5 w-3.5 text-gray-500" />
                      )}
                    </button>
                  ) : (
                    <div className="w-7" />
                  )}

                  <FolderIcon className={`h-4 w-4 ${isSelected ? 'text-blue-600' : 'text-gray-400'}`} />
                  <span className="text-sm font-medium flex-1 min-w-0 truncate">{group.name}</span>
                  <span className="text-[10px] text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded">
                    {products.filter((p: any) => p.groupId === group.id).length}
                  </span>

                  {canManageInventory && (
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                      <button
                        onClick={async (e) => {
                          e.stopPropagation()
                          const name = prompt('New subfolder name?')
                          if (!name) return
                          await createGroup(workspaceId!, name, group.id)
                          qc.invalidateQueries({ queryKey: ['groups', workspaceId] })
                          setExpandedGroups((prev) => new Set(prev).add(group.id))
                        }}
                        className="p-1 text-gray-400 hover:text-blue-600"
                        title="New subfolder"
                      >
                        <FolderPlusIcon className="h-4 w-4" />
                      </button>
                      <button
                        onClick={async (e) => {
                          e.stopPropagation()
                          const name = prompt('Rename folder', group.name)
                          if (!name) return
                          await renameGroup(workspaceId!, group.id, name)
                          qc.invalidateQueries({ queryKey: ['groups', workspaceId] })
                        }}
                        className="p-1 text-gray-400 hover:text-green-600"
                        title="Rename"
                      >
                        <PencilIcon className="h-4 w-4" />
                      </button>
                      <button
                        onClick={async (e) => {
                          e.stopPropagation()
                          if (!confirm('Delete this folder and all its contents?')) return
                          await deleteGroup(workspaceId!, group.id)
                          qc.invalidateQueries({ queryKey: ['groups', workspaceId] })
                        }}
                        className="p-1 text-gray-400 hover:text-red-600"
                        title="Delete"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>

                {hasChildren && isExpanded && <FolderTree groups={groups} parentId={group.id} depth={depth + 1} />}
              </div>
            )
          })}
      </div>
    )
  }

  // Desktop table columns (kept clean)
  const columns = [
    {
      key: 'name' as keyof Product,
      label: 'Product',
      sortable: true,
      className: 'min-w-[260px]',
      render: (value: string, item: Product) => {
        const cleaned = (value || '')
          .replace(/\uFFFD/g, '')
          .replace(/\u0000/g, '')
          .trim()

        const sku = products.find((p) => p.id === item.id)?.sku || ''
        return (
          <div className="flex flex-col gap-1">
            <span className="font-semibold text-gray-900 leading-tight">{cleaned || '—'}</span>
            {sku ? <span className="text-xs text-gray-500 font-mono">{sku}</span> : null}
          </div>
        )
      },
    },
    {
      key: 'uom' as keyof Product,
      label: 'Unit',
      sortable: true,
      className: 'w-24',
      render: (value: string) => (
        <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-700">
          {value || '—'}
        </span>
      ),
    },
    {
      key: 'qtyOnHand' as keyof Product,
      label: 'On Hand',
      sortable: true,
      className: 'w-32',
      render: (value: number, item: Product) => {
        const p = products.find((x) => x.id === item.id)
        const qty = value || 0
        const min = p?.minStock || 0
        const cls =
          qty <= 0 ? 'text-red-600' : qty < min ? 'text-amber-600' : 'text-gray-900'
        return <span className={`font-medium ${cls}`}>{qty.toLocaleString('en-GB', { maximumFractionDigits: 2 })}</span>
      },
    },
    {
      key: 'minStock' as keyof Product,
      label: 'Min Stock',
      sortable: true,
      className: 'w-32',
      render: (value: number) => (value || 0).toLocaleString('en-GB', { maximumFractionDigits: 2 }),
    },
    {
      key: 'status' as keyof Product,
      label: 'Status',
      sortable: true,
      className: 'w-28',
      render: (value: string) => (
        <span
          className={`px-2.5 py-1 rounded-full text-xs font-medium inline-flex items-center gap-1 ${
            value === 'active'
              ? 'bg-green-100 text-green-800 border border-green-200'
              : value === 'draft'
              ? 'bg-gray-100 text-gray-800 border border-gray-200'
              : 'bg-red-100 text-red-800 border border-red-200'
          }`}
        >
          {value === 'active' ? <CheckCircleIcon className="h-3 w-3" /> : null}
          {(value || '—').charAt(0).toUpperCase() + (value || '').slice(1)}
        </span>
      ),
    },
  ]

  if (!workspaceId) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" />
          <p className="mt-4 text-gray-600">Loading workspace...</p>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-gray-200 rounded w-64 animate-pulse" />
        <div className="h-4 bg-gray-200 rounded w-96 animate-pulse" />
        <div className="h-96 bg-gray-100 rounded-xl animate-pulse" />
      </div>
    )
  }

  const activeFilterCount = (statusFilter !== 'all' ? 1 : 0) + (lowStockFilter ? 1 : 0) + (selectedGroup ? 1 : 0)

  return (
    <PageShell
      title="Inventory"
      subtitle="Search, filter, and update stock quickly."
      headerClassName="mb-3 sm:mb-4"
      actions={
        <>
          {/* Mobile actions */}
          <div className="flex md:hidden items-center gap-2">
            <button
              onClick={() => setShowMobileSidebar(true)}
              className="h-9 w-9 inline-flex items-center justify-center bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              title="Folders"
            >
              <FolderIcon className="h-4 w-4 text-gray-700" />
            </button>
            <button
              onClick={() => setShowMoreMenu(true)}
              className="h-9 w-9 inline-flex items-center justify-center bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              title="More"
            >
              <EllipsisVerticalIcon className="h-4 w-4 text-gray-700" />
            </button>
          </div>

          {/* Desktop actions */}
          <div className="hidden md:flex items-center gap-2">
            {canManageInventory && (
              <Button variant="primary" size="sm" onClick={() => setShowCreate(true)}>
                <PlusIcon className="h-4 w-4 mr-1.5" />
                New Product
              </Button>
            )}

            <div className="relative">
              <Button variant="secondary" size="sm" onClick={() => setShowMoreMenu((s) => !s)}>
                <EllipsisHorizontalIcon className="h-4 w-4" />
              </Button>
              {showMoreMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowMoreMenu(false)} />
                  <div className="absolute right-0 mt-2 w-52 bg-white border border-gray-200 rounded-lg shadow-xl z-50 overflow-hidden">
                    <button
                      onClick={() => {
                        setShowImport(true)
                        setShowMoreMenu(false)
                      }}
                      className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                    >
                      <ArrowUpTrayIcon className="h-4 w-4" />
                      Import CSV
                    </button>
                    <button
                      onClick={() => {
                        downloadCSV('inventory.csv', toCSV(products))
                        setShowMoreMenu(false)
                      }}
                      className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                    >
                      <ArrowDownTrayIcon className="h-4 w-4" />
                      Export CSV
                    </button>
                    <button
                      onClick={() => {
                        setShowScanner(true)
                        setShowMoreMenu(false)
                      }}
                      className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                    >
                      <QrCodeIcon className="h-4 w-4" />
                      Scan
                    </button>
                    {duplicateProducts.length > 0 && (
                      <button
                        onClick={() => {
                          setShowDuplicates(true)
                          setShowMoreMenu(false)
                        }}
                        className="w-full text-left px-4 py-2.5 text-sm text-amber-700 hover:bg-amber-50 flex items-center gap-2 border-t border-gray-200"
                      >
                        <ExclamationCircleIcon className="h-4 w-4" />
                        Duplicates
                        <span className="ml-auto bg-amber-600 text-white text-xs px-2 py-0.5 rounded-full font-bold">
                          {duplicateProducts.length}
                        </span>
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      }
    >

      {/* Mobile more menu (same content as desktop dropdown, but positioned fixed) */}
      {showMoreMenu && (
        <div className="md:hidden">
          <div className="fixed inset-0 z-40 bg-black/30" onClick={() => setShowMoreMenu(false)} />
          <div className="fixed z-50 right-3 top-20 w-60 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden">
            {canManageInventory && (
              <button
                onClick={() => {
                  setShowCreate(true)
                  setShowMoreMenu(false)
                }}
                className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
              >
                <PlusIcon className="h-4 w-4" />
                New Product
              </button>
            )}
            <button
              onClick={() => {
                setShowScanner(true)
                setShowMoreMenu(false)
              }}
              className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
            >
              <QrCodeIcon className="h-4 w-4" />
              Scan
            </button>
            <button
              onClick={() => {
                setShowImport(true)
                setShowMoreMenu(false)
              }}
              className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
            >
              <ArrowUpTrayIcon className="h-4 w-4" />
              Import CSV
            </button>
            <button
              onClick={() => {
                downloadCSV('inventory.csv', toCSV(products))
                setShowMoreMenu(false)
              }}
              className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
            >
              <ArrowDownTrayIcon className="h-4 w-4" />
              Export CSV
            </button>
            {duplicateProducts.length > 0 && (
              <button
                onClick={() => {
                  setShowDuplicates(true)
                  setShowMoreMenu(false)
                }}
                className="w-full text-left px-4 py-3 text-sm text-amber-700 hover:bg-amber-50 flex items-center gap-2 border-t border-gray-200"
              >
                <ExclamationCircleIcon className="h-4 w-4" />
                Duplicates
                <span className="ml-auto bg-amber-600 text-white text-xs px-2 py-0.5 rounded-full font-bold">
                  {duplicateProducts.length}
                </span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Search + filters row (focus on products) */}
      <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-md supports-[backdrop-filter]:bg-white/80 -mx-2 px-2 py-2.5 border-b border-gray-200/60 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search products…"
              className="w-full h-9 rounded-lg border border-gray-300 bg-white pl-10 pr-8 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all shadow-sm"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors p-0.5 rounded"
                title="Clear"
              >
                <XMarkIcon className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowFilters((s) => !s)}
            className="shrink-0 h-9 px-3"
          >
            <FunnelIcon className="h-4 w-4 mr-1.5" />
            Filters
            {activeFilterCount > 0 && (
              <span className="ml-1.5 bg-primary-600 text-white text-[10px] font-semibold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1.5">
                {activeFilterCount}
              </span>
            )}
          </Button>
        </div>

        {/* Professional summary line with badges */}
        <div className="mt-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-gray-50 rounded-md border border-gray-200">
              <span className="text-xs font-semibold text-gray-900">{filteredProducts.length}</span>
              <span className="text-xs text-gray-600">products</span>
            </div>
            {stats.low > 0 && (
              <div className="inline-flex items-center gap-1 px-2 py-1 bg-amber-50 rounded-md border border-amber-200">
                <ExclamationTriangleIcon className="h-3 w-3 text-amber-600" />
                <span className="text-xs font-medium text-amber-700">{stats.low}</span>
                <span className="text-xs text-amber-600">low</span>
              </div>
            )}
            {stats.out > 0 && (
              <div className="inline-flex items-center gap-1 px-2 py-1 bg-red-50 rounded-md border border-red-200">
                <span className="text-xs font-medium text-red-700">{stats.out}</span>
                <span className="text-xs text-red-600">out</span>
              </div>
            )}
          </div>
          <div className="hidden sm:flex items-center text-xs text-gray-500 font-medium">
            Page {currentPage}/{totalPages}
          </div>
        </div>
      </div>

      {/* Filters panel (simple) */}
      {showFilters && (
        <Card className="bg-gray-50">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">Folder</label>
              <select
                value={selectedGroup}
                onChange={(e) => setSelectedGroup(e.target.value)}
                className="w-full rounded-lg border-gray-300 focus:border-primary-500 focus:ring-primary-500 py-1.5 px-2 text-sm h-9"
              >
                <option value="">All folders</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full rounded-lg border-gray-300 focus:border-primary-500 focus:ring-primary-500 py-1.5 px-2 text-sm h-9"
              >
                <option value="all">All</option>
                <option value="active">Active</option>
                <option value="draft">Draft</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>

            <div className="flex items-end">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={lowStockFilter}
                  onChange={(e) => setLowStockFilter(e.target.checked)}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm font-medium text-gray-700">Low stock only</span>
              </label>
            </div>
          </div>

          <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-200">
            <button
              onClick={() => {
                setSelectedGroup('')
                setStatusFilter('all')
                setLowStockFilter(false)
              }}
              className="text-xs text-gray-600 hover:text-gray-800"
            >
              Clear filters
            </button>
            <button onClick={() => setShowFilters(false)} className="text-xs text-blue-700 hover:text-blue-900">
              Close
            </button>
          </div>
        </Card>
      )}

      {/* Main content split */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Mobile sidebar */}
        {showMobileSidebar && (
          <>
            <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={() => setShowMobileSidebar(false)} />
            <aside className="fixed inset-y-0 left-0 w-72 bg-white shadow-xl z-50 lg:hidden overflow-y-auto">
              <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <FolderIcon className="h-5 w-5 text-blue-600" />
                  Folders
                </h3>
                <button
                  onClick={() => setShowMobileSidebar(false)}
                  className="p-2 text-gray-400 hover:text-gray-600 rounded-lg"
                  title="Close"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>

              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-gray-700">Product Folders</span>
                  {canManageInventory && (
                    <button
                      onClick={async () => {
                        const name = prompt('New folder name?')
                        if (!name) return
                        await createGroup(workspaceId!, name)
                        qc.invalidateQueries({ queryKey: ['groups', workspaceId] })
                      }}
                      className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                      title="New folder"
                    >
                      <FolderPlusIcon className="h-4 w-4" />
                    </button>
                  )}
                </div>

                <div
                  className="space-y-0.5"
                  onDragOver={(e) => {
                    e.preventDefault()
                    e.dataTransfer.dropEffect = 'move'
                  }}
                  onDrop={async (e) => {
                    const data = e.dataTransfer.getData('text/plain')
                    try {
                      const parsed = JSON.parse(data)
                      if (parsed?.type === 'group' && parsed?.id) {
                        await moveGroupParent(workspaceId!, parsed.id, null)
                        qc.invalidateQueries({ queryKey: ['groups', workspaceId] })
                      }
                    } catch {}
                  }}
                >
                  <div
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                      selectedGroup === '' ? 'bg-blue-50 border border-blue-200 text-blue-700' : 'hover:bg-gray-50 text-gray-700'
                    }`}
                    onClick={() => {
                      setSelectedGroup('')
                      setShowMobileSidebar(false)
                    }}
                  >
                    <ArchiveBoxIcon className="h-4 w-4 text-gray-500" />
                    <span className="text-sm font-medium flex-1">All Products</span>
                    <span className="text-[10px] text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded">{products.length}</span>
                  </div>

                  {canManageInventory && groups.length === 0 && (
                    <div className="mt-3 rounded-xl border border-dashed border-blue-200 bg-blue-50/60 px-3 py-3 space-y-2">
                      <div className="text-xs font-semibold text-blue-900">Set up folders</div>
                      <p className="text-[11px] text-blue-900/80 leading-snug">
                        Use folders to organise inventory (raw materials, finished goods, etc.).
                      </p>
                      <div className="flex gap-2">
                        <Button size="sm" variant="primary" onClick={handleCreateDefaultGroups}>
                          Use recommended
                        </Button>
                        <button
                          className="text-xs font-medium text-blue-700 hover:text-blue-900 underline underline-offset-2"
                          onClick={async () => {
                            const name = prompt('Folder name?')
                            if (!name) return
                            await createGroup(workspaceId!, name)
                            qc.invalidateQueries({ queryKey: ['groups', workspaceId] })
                          }}
                        >
                          Create custom
                        </button>
                      </div>
                    </div>
                  )}

                  <FolderTree groups={groups} />
                </div>
              </div>
            </aside>
          </>
        )}

        {/* Desktop sidebar */}
        <aside className="hidden lg:block flex-shrink-0" style={{ minWidth: '300px', maxWidth: '320px', width: '300px' }}>
          <Card className="h-full">
            <div className="flex items-center justify-between mb-3 px-1">
              <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                <FolderIcon className="h-4 w-4 text-blue-600" />
                Folders
              </h3>
              {canManageInventory && (
                <button
                  onClick={async () => {
                    const name = prompt('New folder name?')
                    if (!name) return
                    await createGroup(workspaceId!, name)
                    qc.invalidateQueries({ queryKey: ['groups', workspaceId] })
                  }}
                  className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                  title="New folder"
                >
                  <FolderPlusIcon className="h-4 w-4" />
                </button>
              )}
            </div>

            <div
              className="space-y-0.5 max-h-[calc(100vh-240px)] overflow-y-auto"
              onDragOver={(e) => {
                e.preventDefault()
                e.dataTransfer.dropEffect = 'move'
              }}
              onDrop={async (e) => {
                const data = e.dataTransfer.getData('text/plain')
                try {
                  const parsed = JSON.parse(data)
                  if (parsed?.type === 'group' && parsed?.id) {
                    await moveGroupParent(workspaceId!, parsed.id, null)
                    qc.invalidateQueries({ queryKey: ['groups', workspaceId] })
                  }
                } catch {}
              }}
            >
              <div
                className={`flex items-center gap-2 px-2.5 py-2 rounded-lg cursor-pointer transition-colors ${
                  selectedGroup === '' ? 'bg-blue-50 border border-blue-200 text-blue-700' : 'hover:bg-gray-50 text-gray-700'
                }`}
                onClick={() => setSelectedGroup('')}
              >
                <ArchiveBoxIcon className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-medium flex-1">All Products</span>
                <span className="text-[10px] text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded">{products.length}</span>
              </div>

              {canManageInventory && groups.length === 0 && (
                <div className="mt-3 rounded-xl border border-dashed border-blue-200 bg-blue-50/60 px-3 py-3 space-y-2">
                  <div className="text-sm font-semibold text-blue-900">Get started</div>
                  <p className="text-xs text-blue-900/80 leading-snug">
                    Create folders to segment products (raw materials, finished goods, tools).
                  </p>
                  <div className="flex gap-2">
                    <Button size="sm" variant="primary" onClick={handleCreateDefaultGroups}>
                      Create recommended
                    </Button>
                    <button
                      className="text-xs font-medium text-blue-700 hover:text-blue-900 underline underline-offset-2"
                      onClick={async () => {
                        const name = prompt('Folder name?')
                        if (!name) return
                        await createGroup(workspaceId!, name)
                        qc.invalidateQueries({ queryKey: ['groups', workspaceId] })
                      }}
                    >
                      Create custom
                    </button>
                  </div>
                </div>
              )}

              <FolderTree groups={groups} />
            </div>
          </Card>
        </aside>

        {/* Main list/table */}
        <section className="flex-1 min-w-0">
          {/* Bulk actions (desktop) */}
          {selectedIds.length > 0 && (
            <Card className="bg-blue-50 border-blue-200 mb-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="bg-blue-100 text-blue-800 px-3 py-1.5 rounded-full text-sm font-medium">
                    {selectedIds.length} selected
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <select
                    className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    onChange={async (e) => {
                      const target = e.target.value
                      if (target === '__noop__') return
                      await Promise.all(selectedIds.map((id) => moveProductToGroup(workspaceId!, id, target || null)))
                      setSelectedIds([])
                      qc.invalidateQueries({ queryKey: ['products', workspaceId] })
                      e.currentTarget.value = '__noop__'
                    }}
                    defaultValue="__noop__"
                  >
                    <option value="__noop__">Move to folder…</option>
                    <option value="">No Folder</option>
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>

                  <button
                    className="text-sm px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700"
                    onClick={async () => {
                      await Promise.all(selectedIds.map((id) => setProductStatus(workspaceId!, id, 'active' as any)))
                      setSelectedIds([])
                      qc.invalidateQueries({ queryKey: ['products', workspaceId] })
                    }}
                  >
                    Activate
                  </button>

                  <button
                    className="text-sm px-3 py-1.5 bg-gray-700 text-white rounded-lg hover:bg-gray-800"
                    onClick={async () => {
                      await Promise.all(selectedIds.map((id) => setProductStatus(workspaceId!, id, 'draft' as any)))
                      setSelectedIds([])
                      qc.invalidateQueries({ queryKey: ['products', workspaceId] })
                    }}
                  >
                    Draft
                  </button>

                  {canManageInventory && (
                    <button
                      className="text-sm px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-1"
                      onClick={async () => {
                        if (!confirm(`Delete ${selectedIds.length} product(s)? This cannot be undone.`)) return
                        await Promise.all(selectedIds.map((id) => deleteProduct(workspaceId!, id)))
                        setSelectedIds([])
                        qc.invalidateQueries({ queryKey: ['products', workspaceId] })
                      }}
                    >
                      <TrashIcon className="h-4 w-4" />
                      Delete
                    </button>
                  )}

                  <button className="text-sm px-3 py-1.5 text-gray-700 hover:text-gray-900" onClick={() => setSelectedIds([])}>
                    Clear
                  </button>
                </div>
              </div>
            </Card>
          )}

          {/* Desktop table */}
          <Card noPadding className="hidden md:block overflow-hidden border border-gray-200">
            <DataTable
              data={paginatedProducts}
              columns={columns}
              onRowClick={setSelectedProduct}
              selectable
              getId={(p) => (p as any).id}
              selectedIds={selectedIds}
              onToggleSelect={(id, _item, checked) => {
                setSelectedIds((prev) => (checked ? Array.from(new Set([...prev, id])) : prev.filter((x) => x !== id)))
              }}
              onToggleSelectAll={(checked) => {
                setSelectedIds(checked ? paginatedProducts.map((p: any) => p.id) : [])
              }}
              renderActions={(item) => {
                const itemId = (item as any).id
                const isOpen = rowActionMenuOpen === itemId
                return (
                  <div className="flex items-center justify-end">
                    <div className="relative">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setRowActionMenuOpen(isOpen ? null : itemId)
                        }}
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                        title="Actions"
                      >
                        <EllipsisHorizontalIcon className="h-5 w-5" />
                      </button>

                      {isOpen && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={() => setRowActionMenuOpen(null)} />
                          <div className="absolute right-0 mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-xl z-50 overflow-hidden">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                setSelectedProduct(item)
                                setRowActionMenuOpen(null)
                              }}
                              className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                            >
                              <EyeIcon className="h-4 w-4" />
                              View
                            </button>

                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                setQuickAdjustProduct(itemId)
                                setAdjustQty(1)
                                setRowActionMenuOpen(null)
                              }}
                              className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                            >
                              <ArrowPathIcon className="h-4 w-4" />
                              Quick adjust
                            </button>

                            {canManageInventory && (
                              <>
                                <button
                                  onClick={async (e) => {
                                    e.stopPropagation()
                                    const next = (item as any).status === 'active' ? 'draft' : 'active'
                                    await setProductStatus(workspaceId!, itemId, next as any)
                                    qc.invalidateQueries({ queryKey: ['products', workspaceId] })
                                    setRowActionMenuOpen(null)
                                  }}
                                  className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                                >
                                  {(item as any).status === 'active' ? 'Set Draft' : 'Activate'}
                                </button>

                                <button
                                  onClick={async (e) => {
                                    e.stopPropagation()
                                    if (!confirm('Delete this product?')) return
                                    await deleteProduct(workspaceId!, itemId)
                                    qc.invalidateQueries({ queryKey: ['products', workspaceId] })
                                    setRowActionMenuOpen(null)
                                  }}
                                  className="w-full text-left px-4 py-2.5 text-sm text-red-700 hover:bg-red-50 border-t border-gray-200 flex items-center gap-2"
                                >
                                  <TrashIcon className="h-4 w-4" />
                                  Delete
                                </button>
                              </>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )
              }}
            />
          </Card>

          {/* Mobile list (world-standard: compact rows, product-first) */}
          <div className="md:hidden">
            <Card noPadding className="overflow-hidden border border-gray-200">
              {paginatedProducts.length === 0 ? (
                <div className="p-8 text-center">
                  <div className="mx-auto h-12 w-12 bg-gray-100 rounded-full flex items-center justify-center">
                    <ArchiveBoxIcon className="h-6 w-6 text-gray-400" />
                  </div>
                  <div className="mt-3 text-sm font-semibold text-gray-900">No products found</div>
                  <div className="mt-1 text-xs text-gray-500">Try a different search or clear filters.</div>
                  <div className="mt-4 flex flex-col gap-2">
                    <Button variant="secondary" size="sm" onClick={() => setShowScanner(true)}>
                      <QrCodeIcon className="h-4 w-4 mr-1.5" />
                      Scan
                    </Button>
                    {canManageInventory && (
                      <Button variant="primary" size="sm" onClick={() => setShowCreate(true)}>
                        <PlusIcon className="h-4 w-4 mr-1.5" />
                        New Product
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {paginatedProducts.map((item: any) => {
                    const qty = item.qtyOnHand || 0
                    const min = item.minStock || 0
                    const isOut = qty <= 0
                    const isLow = qty > 0 && qty < min
                    const isSelected = selectedIds.includes(item.id)
                    const groupName = groups.find((g) => g.id === item.groupId)?.name || ''
                    const status = item.status || 'draft'
                    const isQuick = quickAdjustProduct === item.id

                    const qtyCls = isOut ? 'text-red-600' : isLow ? 'text-amber-600' : 'text-gray-900'

                    return (
                      <div key={item.id} className={`px-3 py-3 ${isSelected ? 'bg-blue-50/60' : 'bg-white'}`}>
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              setSelectedIds((prev) =>
                                e.target.checked ? Array.from(new Set([...prev, item.id])) : prev.filter((x) => x !== item.id)
                              )
                            }}
                            className="mt-1.5 w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />

                          <button className="flex-1 min-w-0 text-left" onClick={() => setSelectedProduct(item)}>
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="text-sm font-semibold text-gray-900 truncate">
                                  {String(item.name || 'Unnamed Product')
                                    .replace(/\uFFFD/g, '')
                                    .replace(/\u0000/g, '')
                                    .trim()}
                                </div>
                                <div className="mt-0.5 flex items-center gap-2 text-[11px] text-gray-500">
                                  <span className="font-mono">{item.sku || item.id.slice(0, 8)}</span>
                                  {groupName ? (
                                    <span className="inline-flex items-center gap-1">
                                      <FolderIcon className="h-3.5 w-3.5" />
                                      <span className="truncate max-w-[120px]">{groupName}</span>
                                    </span>
                                  ) : null}
                                </div>
                              </div>

                              <div className="text-right">
                                <div className={`text-sm font-semibold ${qtyCls}`}>
                                  {qty.toLocaleString('en-GB', { maximumFractionDigits: 2 })}
                                </div>
                                <div className="text-[11px] text-gray-500">
                                  {item.uom || 'units'}
                                  {min > 0 ? ` · min ${min.toLocaleString('en-GB', { maximumFractionDigits: 0 })}` : ''}
                                </div>
                              </div>
                            </div>

                            <div className="mt-2 flex items-center gap-2">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[11px] font-medium border ${
                                  status === 'active'
                                    ? 'bg-green-50 text-green-700 border-green-200'
                                    : status === 'draft'
                                    ? 'bg-gray-50 text-gray-700 border-gray-200'
                                    : 'bg-red-50 text-red-700 border-red-200'
                                }`}
                              >
                                {status === 'active' ? (
                                  <span className="inline-flex items-center gap-1">
                                    <CheckCircleIcon className="h-3.5 w-3.5" /> Active
                                  </span>
                                ) : status === 'draft' ? (
                                  'Draft'
                                ) : (
                                  'Inactive'
                                )}
                              </span>

                              {(isOut || isLow) && (
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[11px] font-medium border ${
                                    isOut
                                      ? 'bg-red-50 text-red-700 border-red-200'
                                      : 'bg-amber-50 text-amber-700 border-amber-200'
                                  }`}
                                >
                                  {isOut ? 'Out of stock' : 'Low stock'}
                                </span>
                              )}
                            </div>
                          </button>

                          <div className="relative">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                setRowActionMenuOpen(rowActionMenuOpen === item.id ? null : item.id)
                              }}
                              className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"
                              title="Actions"
                            >
                              <EllipsisHorizontalIcon className="h-5 w-5" />
                            </button>

                            {rowActionMenuOpen === item.id && (
                              <>
                                <div className="fixed inset-0 z-40" onClick={() => setRowActionMenuOpen(null)} />
                                <div className="absolute right-0 mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-xl z-50 overflow-hidden">
                                  <button
                                    onClick={() => {
                                      setSelectedProduct(item)
                                      setRowActionMenuOpen(null)
                                    }}
                                    className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                                  >
                                    <EyeIcon className="h-4 w-4" />
                                    View
                                  </button>

                                  <button
                                    onClick={() => {
                                      setQuickAdjustProduct(item.id)
                                      setAdjustQty(1)
                                      setRowActionMenuOpen(null)
                                    }}
                                    className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                                  >
                                    <ArrowPathIcon className="h-4 w-4" />
                                    Quick adjust
                                  </button>

                                  {canManageInventory && (
                                    <>
                                      <button
                                        onClick={async () => {
                                          const next = item.status === 'active' ? 'draft' : 'active'
                                          await setProductStatus(workspaceId!, item.id, next as any)
                                          qc.invalidateQueries({ queryKey: ['products', workspaceId] })
                                          setRowActionMenuOpen(null)
                                        }}
                                        className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                                      >
                                        {item.status === 'active' ? 'Set Draft' : 'Activate'}
                                      </button>

                                      <button
                                        onClick={async () => {
                                          if (!confirm('Delete this product?')) return
                                          await deleteProduct(workspaceId!, item.id)
                                          qc.invalidateQueries({ queryKey: ['products', workspaceId] })
                                          setRowActionMenuOpen(null)
                                        }}
                                        className="w-full text-left px-4 py-2.5 text-sm text-red-700 hover:bg-red-50 border-t border-gray-200 flex items-center gap-2"
                                      >
                                        <TrashIcon className="h-4 w-4" />
                                        Delete
                                      </button>
                                    </>
                                  )}
                                </div>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Minimal quick adjust inline */}
                        {isQuick && (
                          <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-3">
                            <div className="flex items-center justify-between">
                              <div className="text-xs font-semibold text-gray-700">Quick adjust</div>
                              <button
                                onClick={() => {
                                  setQuickAdjustProduct(null)
                                  setAdjustQty(1)
                                }}
                                className="text-xs text-gray-500 hover:text-gray-700"
                              >
                                Close
                              </button>
                            </div>

                            <div className="mt-2 flex items-center gap-2">
                              <button
                                onClick={() => setAdjustQty((q) => Math.max(1, q - 1))}
                                className="h-9 w-9 inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white"
                                title="Decrease"
                              >
                                <MinusIcon className="h-4 w-4 text-gray-600" />
                              </button>

                              <input
                                type="number"
                                value={adjustQty}
                                onChange={(e) => setAdjustQty(Math.max(1, parseInt(e.target.value || '1', 10) || 1))}
                                className="h-9 w-16 text-center rounded-lg border border-gray-300 bg-white text-sm font-semibold"
                              />

                              <button
                                onClick={() => setAdjustQty((q) => q + 1)}
                                className="h-9 w-9 inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white"
                                title="Increase"
                              >
                                <PlusIcon className="h-4 w-4 text-gray-600" />
                              </button>

                              <div className="flex-1" />

                              <button
                                onClick={() => handleQuickAdjust(item.id, 'out', adjustQty)}
                                disabled={isAdjusting || qty < adjustQty}
                                className="h-9 px-3 rounded-lg bg-white border border-gray-200 text-sm font-semibold text-gray-700 disabled:opacity-50"
                              >
                                Stock out
                              </button>
                              <button
                                onClick={() => handleQuickAdjust(item.id, 'in', adjustQty)}
                                disabled={isAdjusting}
                                className="h-9 px-3 rounded-lg bg-blue-600 text-white text-sm font-semibold disabled:opacity-50"
                              >
                                Stock in
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </Card>

            {/* Mobile bulk bar (simple, product-first) */}
            {selectedIds.length > 0 && (
              <div
                className="fixed left-0 right-0 bottom-0 z-40 border-t border-gray-200 bg-white"
                style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
              >
                <div className="px-3 py-3 flex items-center gap-2">
                  <div className="text-sm font-semibold text-gray-900">{selectedIds.length} selected</div>
                  <div className="flex-1" />
                  <button className="px-3 py-2 text-sm rounded-lg border border-gray-200" onClick={() => setSelectedIds([])}>
                    Clear
                  </button>
                  {canManageInventory && (
                    <button
                      className="px-3 py-2 text-sm rounded-lg bg-red-600 text-white"
                      onClick={async () => {
                        if (!confirm(`Delete ${selectedIds.length} product(s)?`)) return
                        await Promise.all(selectedIds.map((id) => deleteProduct(workspaceId!, id)))
                        setSelectedIds([])
                        qc.invalidateQueries({ queryKey: ['products', workspaceId] })
                      }}
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Pagination (shared) */}
          {filteredProducts.length > 0 && (
            <Card className="mt-5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                  <div className="text-xs sm:text-sm text-gray-700">
                    Showing <span className="font-medium">{startIndex + 1}</span> to{' '}
                    <span className="font-medium">{Math.min(endIndex, filteredProducts.length)}</span> of{' '}
                    <span className="font-medium">{filteredProducts.length}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs sm:text-sm text-gray-700">Per page:</label>
                    <select
                      value={itemsPerPage}
                      onChange={(e) => {
                        setItemsPerPage(Number(e.target.value))
                        setCurrentPage(1)
                      }}
                      className="rounded-md border-gray-300 text-xs sm:text-sm focus:border-blue-500 focus:ring-blue-500"
                    >
                      <option value={10}>10</option>
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-2">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-2 text-xs sm:text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                  >
                    <ChevronLeftIcon className="w-4 h-4" />
                    <span className="hidden sm:inline">Previous</span>
                  </button>

                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum: number
                      if (totalPages <= 5) pageNum = i + 1
                      else if (currentPage <= 3) pageNum = i + 1
                      else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i
                      else pageNum = currentPage - 2 + i

                      return (
                        <button
                          key={pageNum}
                          onClick={() => setCurrentPage(pageNum)}
                          className={`px-3 py-2 text-xs sm:text-sm font-medium rounded-md ${
                            currentPage === pageNum ? 'bg-blue-600 text-white' : 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          {pageNum}
                        </button>
                      )
                    })}
                  </div>

                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-2 text-xs sm:text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                  >
                    <span className="hidden sm:inline">Next</span>
                    <ChevronRightIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </Card>
          )}
        </section>
      </div>

      {/* Modals */}
      {selectedProduct && (
        <ProductDetails
          product={selectedProduct as any}
          onClose={() => setSelectedProduct(null)}
          onSaved={() => qc.invalidateQueries({ queryKey: ['products', workspaceId] })}
          canManage={canManageInventory}
        />
      )}

      {showScanner && <Scanner onScan={handleScan} onClose={() => setShowScanner(false)} />}

      {showCreate && (
        <ProductForm
          workspaceId={workspaceId}
          groups={groups}
          onCreated={() => qc.invalidateQueries({ queryKey: ['products', workspaceId] })}
          onClose={() => setShowCreate(false)}
        />
      )}

      {showImport && (
        <ImportModal
          workspaceId={workspaceId}
          userId={userId}
          products={products}
          groups={groups}
          onClose={() => setShowImport(false)}
          onSuccess={() => {
            qc.invalidateQueries({ queryKey: ['products', workspaceId] })
            setShowImport(false)
          }}
        />
      )}

      {showDuplicates && (
        <DuplicatesModal
          duplicates={duplicateProducts}
          groups={groups}
          onClose={() => setShowDuplicates(false)}
          onView={(p) => {
            setSelectedProduct(p)
            setShowDuplicates(false)
          }}
          onDelete={async (productId) => {
            await deleteProduct(workspaceId!, productId)
            qc.invalidateQueries({ queryKey: ['products', workspaceId] })
          }}
        />
      )}
    </PageShell>
  )
}

// ---------------------------
// Duplicates Modal (kept)
// ---------------------------
function DuplicatesModal({
  duplicates,
  groups,
  onClose,
  onView,
  onDelete,
}: {
  duplicates: Array<{ sku: string; products: Product[] }>
  groups: Group[]
  onClose: () => void
  onView: (product: Product) => void
  onDelete: (productId: string) => Promise<void>
}) {
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const handleDelete = async (productId: string) => {
    if (!confirm('Delete this duplicate product?')) return
    setDeletingId(productId)
    try {
      await onDelete(productId)
    } catch (err) {
      console.error(err)
      alert('Failed to delete product')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-xl sm:rounded-2xl shadow-xl w-full max-w-4xl max-h-[95vh] sm:max-h-[90vh] overflow-hidden flex flex-col">
        <div className="px-4 sm:px-6 py-3 sm:py-5 border-b border-gray-200 flex items-center justify-between bg-amber-50">
          <div className="flex-1 min-w-0 pr-2">
            <h2 className="text-lg sm:text-xl font-bold text-gray-900 flex items-center gap-2">
              <ExclamationCircleIcon className="w-5 h-5 sm:w-6 sm:h-6 text-amber-600 shrink-0" />
              <span className="truncate">Duplicate Products</span>
            </h2>
            <p className="text-xs sm:text-sm text-gray-600 mt-1">
              Found {duplicates.length} duplicate SKU{duplicates.length !== 1 ? 's' : ''} with{' '}
              {duplicates.reduce((sum, d) => sum + d.products.length, 0)} total products
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-white text-gray-400 hover:text-gray-600 shrink-0">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 sm:p-6">
          <div className="space-y-4 sm:space-y-6">
            {duplicates.map((dup, idx) => (
              <div key={idx} className="bg-gray-50 rounded-lg border border-gray-200 p-3 sm:p-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-3 gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <ExclamationCircleIcon className="w-5 h-5 text-amber-600 shrink-0" />
                    <h3 className="font-semibold text-gray-900">SKU: {dup.sku}</h3>
                    <span className="bg-amber-100 text-amber-800 text-xs font-medium px-2 py-1 rounded-full">
                      {dup.products.length} duplicates
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  {dup.products.map((product) => (
                    <div
                      key={product.id}
                      className="bg-white rounded-lg border border-gray-200 p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 hover:border-amber-300 transition-colors"
                    >
                      <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                        <div>
                          <div className="text-xs text-gray-500 mb-1">Product Name</div>
                          <div className="font-medium text-gray-900 break-words">{product.name}</div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500 mb-1">ID</div>
                          <div className="font-mono text-xs text-gray-600 break-all">{product.id}</div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500 mb-1">Folder</div>
                          <div className="text-sm text-gray-700">
                            {groups.find((g) => g.id === (product as any).groupId)?.name || 'Unassigned'}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500 mb-1">Stock</div>
                          <div className={`text-sm font-medium ${(product.qtyOnHand || 0) > 0 ? 'text-green-600' : 'text-gray-500'}`}>
                            {(product.qtyOnHand || 0).toLocaleString()}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 sm:ml-4">
                        <button
                          onClick={() => onView(product)}
                          className="px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors flex items-center gap-1"
                        >
                          <EyeIcon className="w-4 h-4" />
                          View
                        </button>

                        <button
                          onClick={() => handleDelete(product.id)}
                          disabled={deletingId === product.id}
                          className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-1 disabled:opacity-50"
                        >
                          {deletingId === product.id ? (
                            <ArrowPathIcon className="w-4 h-4 animate-spin" />
                          ) : (
                            <TrashIcon className="w-4 h-4" />
                          )}
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-gray-200 bg-gray-50">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <p className="text-xs sm:text-sm text-gray-600">Keep the most complete record, delete the others.</p>
            <button onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm">
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------
// Import Modal (fixed counters + stays simple)
// ---------------------------
function ImportModal({
  workspaceId,
  userId,
  products,
  groups,
  onClose,
  onSuccess,
}: {
  workspaceId: string
  userId?: string | null
  products: Product[]
  groups: Group[]
  onClose: () => void
  onSuccess: () => void
}) {
  const [importMode, setImportMode] = useState<'create' | 'stock'>('create')
  const [file, setFile] = useState<File | null>(null)
  const [csvData, setCsvData] = useState<any[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [errors, setErrors] = useState<string[]>([])
  const [successCount, setSuccessCount] = useState(0)

  const { data: uoms = [] } = useQuery({
    queryKey: ['uoms', workspaceId],
    queryFn: () => listUOMs(workspaceId),
    enabled: !!workspaceId,
  })

  const downloadTemplate = () => {
    let referenceSection = '# ============================================\n'
    referenceSection += '# REFERENCE VALUES\n'
    referenceSection += '# ============================================\n#\n'

    if (groups.length > 0) {
      referenceSection += '# GROUPS (groupId):\n'
      groups.forEach((g) => (referenceSection += `# ${g.id} = ${g.name}\n`))
      referenceSection += '#\n'
    }

    if (uoms.length > 0) {
      referenceSection += '# UOMs (uom):\n'
      uoms.forEach((u: any) => (referenceSection += `# ${u.symbol} = ${u.name || u.symbol}\n`))
      referenceSection += '#\n'
    }

    referenceSection += '# STATUS (status): active | inactive | draft\n#\n'
    referenceSection += '# ============================================\n'
    referenceSection += '# DATA SECTION\n'
    referenceSection += '# ============================================\n'

    const template =
      importMode === 'create'
        ? `${referenceSection}name,sku,uom,status,minStock,reorderPoint,quantityBox,pricePerBox,groupId,tags\nProduct Name,SKU-001,unit,active,10,5,100,25.50,,tag1, tag2`
        : `${referenceSection}sku,quantity,reason\nSKU-001,50,Stock Adjustment`

    downloadCSV(`inventory-import-template-${importMode}.csv`, template)
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    setFile(selectedFile)
    setErrors([])
    setCsvData([])
    setSuccessCount(0)

    try {
      const text = await selectedFile.text()
      const parsed = parseCSV(text)

      if (parsed.length === 0) {
        setErrors(['CSV file is empty or invalid'])
        return
      }

      const requiredHeaders = importMode === 'create' ? ['name', 'sku'] : ['sku', 'quantity']
      const headers = Object.keys(parsed[0]).map((h) => h.toLowerCase().trim())
      const missing = requiredHeaders.filter((h) => !headers.includes(h))
      if (missing.length > 0) {
        setErrors([`Missing required columns: ${missing.join(', ')}`])
        return
      }

      setCsvData(parsed)
    } catch (err: any) {
      setErrors([`Failed to parse CSV: ${err.message}`])
    }
  }

  const handleImport = async () => {
    if (csvData.length === 0) {
      setErrors(['No data to import'])
      return
    }

    setIsProcessing(true)
    setErrors([])
    setSuccessCount(0)

    let ok = 0
    const errs: string[] = []

    try {
      if (importMode === 'create') {
        for (const row of csvData) {
          try {
            const tagsValue = row.tags || row.Tags || row.TAGS || ''
            const tags = tagsValue ? String(tagsValue).split(',').map((t) => t.trim()).filter(Boolean) : []

            await createProduct(workspaceId, {
              name: row.name || row.Name || '',
              sku: row.sku || row.SKU || '',
              uom: row.uom || row.UOM || 'unit',
              status: (row.status || row.Status || 'active') as any,
              minStock: Number(row.minStock || row['Min Stock'] || 0),
              reorderPoint: Number(row.reorderPoint || row['Reorder Point'] || 0),
              quantityBox: Number(row.quantityBox || row['Quantity Box'] || 0),
              pricePerBox: Number(row.pricePerBox || row['Price Per Box'] || 0),
              groupId: row.groupId || row['Group ID'] || null,
              tags,
            })

            ok++
            setSuccessCount(ok)
          } catch (err: any) {
            errs.push(`Failed to create ${row.sku || row.SKU || '(no sku)'}: ${err.message}`)
            setErrors([...errs])
          }
        }
      } else {
        for (const row of csvData) {
          try {
            const sku = row.sku || row.SKU || ''
            const product = products.find((p) => p.sku === sku)

            if (!product) {
              errs.push(`Product not found: ${sku}`)
              setErrors([...errs])
              continue
            }

            const quantity = Number(row.quantity || row.Quantity || 0)
            if (!quantity) continue

            await createStockTransaction({
              workspaceId,
              productId: product.id,
              type: quantity > 0 ? 'in' : 'out',
              qty: Math.abs(quantity),
              userId: userId || undefined,
              reason: row.reason || row.Reason || 'Bulk import',
            })

            window.dispatchEvent(new Event('stockTransactionCreated'))
            ok++
            setSuccessCount(ok)
          } catch (err: any) {
            errs.push(`Failed stock update for ${row.sku || row.SKU || '(no sku)'}: ${err.message}`)
            setErrors([...errs])
          }
        }
      }

      if (ok > 0) {
        showToast(
          `Successfully ${importMode === 'create' ? 'created' : 'updated'} ${ok} item${ok !== 1 ? 's' : ''}`,
          'success',
          3500
        )
        setTimeout(onSuccess, 600)
      } else if (errs.length > 0) {
        showToast(`Import completed with ${errs.length} error${errs.length !== 1 ? 's' : ''}`, 'warning', 4500)
      }
    } catch (err: any) {
      errs.push(`Import failed: ${err.message}`)
      setErrors([...errs])
      showToast(`Import failed: ${err instanceof Error ? err.message : 'Unknown error'}`, 'error', 5000)
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-xl sm:rounded-2xl shadow-xl w-full max-w-2xl max-h-[95vh] sm:max-h-[90vh] overflow-hidden flex flex-col">
        <div className="px-4 sm:px-6 py-3 sm:py-5 border-b border-gray-200 flex items-center justify-between">
          <div className="flex-1 min-w-0 pr-2">
            <h2 className="text-lg sm:text-xl font-bold text-gray-900">Bulk Import</h2>
            <p className="text-xs sm:text-sm text-gray-500 mt-1">Import products or adjust stock using CSV</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 shrink-0">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-4 sm:space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">Import Mode</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <button
                onClick={() => {
                  setImportMode('create')
                  setFile(null)
                  setCsvData([])
                  setErrors([])
                  setSuccessCount(0)
                }}
                className={`p-4 rounded-lg border-2 transition-all ${
                  importMode === 'create' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="font-medium text-gray-900">Create Products</div>
                <div className="text-xs text-gray-500 mt-1">Add new products</div>
              </button>

              <button
                onClick={() => {
                  setImportMode('stock')
                  setFile(null)
                  setCsvData([])
                  setErrors([])
                  setSuccessCount(0)
                }}
                className={`p-4 rounded-lg border-2 transition-all ${
                  importMode === 'stock' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="font-medium text-gray-900">Update Stock</div>
                <div className="text-xs text-gray-500 mt-1">Adjust quantities</div>
              </button>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="font-medium text-blue-900">Download Template</div>
                <div className="text-sm text-blue-700 mt-1">
                  {importMode === 'create'
                    ? 'Columns: name, sku, uom, status, minStock, reorderPoint, quantityBox, pricePerBox, groupId, tags'
                    : 'Columns: sku, quantity, reason'}
                </div>
              </div>
              <button
                onClick={downloadTemplate}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shrink-0"
              >
                <DocumentArrowDownIcon className="w-4 h-4" />
                Download
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Upload CSV File</label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors">
              <input type="file" accept=".csv" onChange={handleFileChange} className="hidden" id="csv-upload" />
              <label htmlFor="csv-upload" className="cursor-pointer flex flex-col items-center">
                <ArrowUpTrayIcon className="w-8 h-8 text-gray-400 mb-2" />
                <span className="text-sm font-medium text-gray-700">{file ? file.name : 'Click to upload CSV file'}</span>
                <span className="text-xs text-gray-500 mt-1">CSV files only</span>
              </label>
            </div>
          </div>

          {csvData.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">Preview ({csvData.length} rows)</label>
                <span className="text-xs text-gray-500">{successCount > 0 ? `${successCount} processed` : ''}</span>
              </div>
              <div className="border border-gray-200 rounded-lg overflow-hidden max-h-64 overflow-y-auto">
                <table className="min-w-full divide-y divide-gray-200 text-xs">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      {Object.keys(csvData[0]).map((key) => (
                        <th key={key} className="px-3 py-2 text-left font-medium text-gray-700">
                          {key}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {csvData.slice(0, 10).map((row, idx) => (
                      <tr key={idx}>
                        {Object.values(row).map((val: any, i) => (
                          <td key={i} className="px-3 py-2 text-gray-600">
                            {String(val || '').substring(0, 30)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {csvData.length > 10 && (
                  <div className="px-3 py-2 text-xs text-gray-500 bg-gray-50">… and {csvData.length - 10} more rows</div>
                )}
              </div>
            </div>
          )}

          {errors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="font-medium text-red-900 mb-2">Errors ({errors.length})</div>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {errors.map((err, idx) => (
                  <div key={idx} className="text-sm text-red-700">
                    {err}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-gray-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3">
          <button onClick={onClose} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors text-sm">
            Cancel
          </button>
          <button
            onClick={handleImport}
            disabled={!file || csvData.length === 0 || isProcessing}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 text-sm"
          >
            {isProcessing ? (
              <>
                <ArrowPathIcon className="w-4 h-4 animate-spin" />
                Processing…
              </>
            ) : (
              <>
                <ArrowUpTrayIcon className="w-4 h-4" />
                Import
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
