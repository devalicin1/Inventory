import { useMemo, useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { DataTable } from '../components/DataTable'
import { Scanner } from '../components/Scanner'
import { listProducts } from '../api/inventory'
import { listGroups, type Group, setProductStatus, deleteProduct, moveProductToGroup, createGroup, deleteGroup, renameGroup, moveGroupParent, createProduct } from '../api/products'
import { listUOMs } from '../api/settings'
import { createStockTransaction } from '../api/inventory'
import { ProductForm } from '../components/ProductForm'
import { ProductDetails } from '../components/ProductDetails'
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
  CubeIcon,
  CurrencyDollarIcon,
  XMarkIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  DocumentArrowDownIcon,
  ArrowPathIcon,
  ExclamationCircleIcon,
  ChevronLeftIcon,
  Bars3Icon,
  EllipsisVerticalIcon
} from '@heroicons/react/24/outline'
import { toCSV, downloadCSV, parseCSV } from '../utils/csv'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'

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
  const [showScanner, setShowScanner] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [showDuplicates, setShowDuplicates] = useState(false)
  const [selectedGroup, setSelectedGroup] = useState<string>('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [lowStockFilter, setLowStockFilter] = useState<boolean>(false)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const [showFilters, setShowFilters] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)
  const [showMobileSidebar, setShowMobileSidebar] = useState(false)
  const [showMobileActions, setShowMobileActions] = useState(false)
  const qc = useQueryClient()
  const { workspaceId, userId } = useSessionStore()

  const { data: products = [], isLoading: productsLoading } = useQuery({
    queryKey: ['products', workspaceId],
    queryFn: () => listProducts(workspaceId!),
    enabled: !!workspaceId,
  })

  const { data: groups = [], isLoading: groupsLoading } = useQuery<Group[]>({
    queryKey: ['groups', workspaceId],
    queryFn: () => listGroups(workspaceId!),
    enabled: !!workspaceId,
  })

  const isLoading = productsLoading || groupsLoading

  // Auto-open product details from URL parameter
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const productId = params.get('productId')

    if (productId && products.length > 0 && !selectedProduct) {
      const product = products.find(p => p.id === productId)
      if (product) {
        setSelectedProduct(product)
        // Clean up URL
        window.history.replaceState({}, '', '/inventory')
      }
    }
  }, [products, selectedProduct])

  // Filter products based on search and filters
  const filteredProducts = useMemo(() => {
    let filtered = products

    if (selectedGroup) {
      filtered = filtered.filter(p => (p as any).groupId === selectedGroup)
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(term) ||
        p.sku.toLowerCase().includes(term) ||
        p.id.toLowerCase().includes(term)
      )
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(p => p.status === statusFilter)
    }

    if (lowStockFilter) {
      filtered = filtered.filter(p => (p.qtyOnHand || 0) < p.minStock)
    }

    return filtered
  }, [products, selectedGroup, searchTerm, statusFilter, lowStockFilter])

  // Pagination
  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedProducts = useMemo(() => {
    return filteredProducts.slice(startIndex, endIndex)
  }, [filteredProducts, startIndex, endIndex])

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [selectedGroup, searchTerm, statusFilter, lowStockFilter])

  // Find duplicate products by SKU
  const duplicateProducts = useMemo(() => {
    const skuMap = new Map<string, Product[]>()

    products.forEach(p => {
      const sku = p.sku.toLowerCase().trim()
      if (!skuMap.has(sku)) {
        skuMap.set(sku, [])
      }
      skuMap.get(sku)!.push(p)
    })

    // Return only SKUs with more than one product
    const duplicates: Array<{ sku: string; products: Product[] }> = []
    skuMap.forEach((products, sku) => {
      if (products.length > 1) {
        duplicates.push({ sku, products })
      }
    })

    return duplicates.sort((a, b) => a.sku.localeCompare(b.sku))
  }, [products])

  // Calculate statistics
  const stats = useMemo(() => {
    const totalProducts = products.length
    const lowStockCount = products.filter(p => (p.qtyOnHand || 0) < p.minStock).length
    const inventoryValue = products.reduce((sum, p: any) => sum + (p.totalValue || 0), 0)
    const activeCount = products.filter(p => p.status === 'active').length
    const outOfStockCount = products.filter(p => (p.qtyOnHand || 0) <= 0).length

    return {
      totalProducts,
      lowStockCount,
      inventoryValue,
      activeCount,
      outOfStockCount
    }
  }, [products])


  const handleScan = (result: string) => {
    console.log('Scanned:', result)
    const product = products.find(p => p.sku === result || p.id === result)
    if (product) {
      setSelectedProduct(product)
    }
    setShowScanner(false)
  }

  const toggleGroupExpansion = (groupId: string) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev)
      if (newSet.has(groupId)) {
        newSet.delete(groupId)
      } else {
        newSet.add(groupId)
      }
      return newSet
    })
  }

  const columns = [
    {
      key: 'sku' as keyof Product,
      label: 'SKU',
      sortable: true
    },
    {
      key: 'name' as keyof Product,
      label: 'Product Name',
      sortable: true,
      render: (value: string) => {
        if (!value) return ''
        // Clean up encoding issues - remove replacement characters and invalid unicode
        let cleaned = value
          .replace(/\uFFFD/g, '') // Remove replacement characters ()
          .replace(/\u0000/g, '') // Remove null characters
          .trim()

        // Try to decode HTML entities if any
        try {
          const textarea = document.createElement('textarea')
          textarea.innerHTML = cleaned
          cleaned = textarea.value || cleaned
        } catch (e) {
          // If decoding fails, use original
        }

        // Return cleaned value or fallback to original
        return cleaned || value
      }
    },
    {
      key: 'uom' as keyof Product,
      label: 'Unit',
      sortable: true
    },
    {
      key: 'qtyOnHand' as keyof Product,
      label: 'On Hand',
      render: (value: number, item: Product) => {
        const product = products.find(p => p.id === item.id)
        const minStock = product?.minStock || 0
        const qty = value || 0
        return (
          <span className={`font-medium ${qty === 0 ? 'text-red-600' :
            qty < minStock ? 'text-orange-600' : 'text-gray-900'
            }`}>
            {qty.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        )
      },
      sortable: true
    },
    {
      key: 'minStock' as keyof Product,
      label: 'Min Stock',
      render: (value: number) => value?.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00',
      sortable: true
    },
    {
      key: 'status' as keyof Product,
      label: 'Status',
      render: (value: string) => (
        <span className={`px-3 py-1.5 rounded-full text-xs font-medium inline-flex items-center gap-1 ${value === 'active'
          ? 'bg-green-100 text-green-800 border border-green-200'
          : value === 'draft'
            ? 'bg-gray-100 text-gray-800 border border-gray-200'
            : 'bg-red-100 text-red-800 border border-red-200'
          }`}>
          {value === 'active' && <CheckCircleIcon className="h-3 w-3" />}
          {value.charAt(0).toUpperCase() + value.slice(1)}
        </span>
      ),
      sortable: true
    },
  ]

  // Folder tree component
  const FolderTree = ({ groups, parentId = null, depth = 0 }: { groups: Group[], parentId?: string | null, depth?: number }) => {
    // Normalize null/undefined so root groups (parentId null) render correctly
    const normalizedParent = parentId ?? null
    const childGroups = groups.filter(g => (g.parentId ?? null) === normalizedParent)

    return (
      <div className="space-y-1">
        {childGroups.sort((a, b) => a.name.localeCompare(b.name)).map(group => {
          const hasChildren = groups.some(g => g.parentId === group.id)
          const isExpanded = expandedGroups.has(group.id)
          const isSelected = selectedGroup === group.id

          return (
            <div key={group.id} className="select-none">
              {/* Group Item */}
              <div
                className={`group flex items-center gap-2 px-3 py-2 rounded-lg transition-colors cursor-pointer ${isSelected
                  ? 'bg-blue-50 border border-blue-200 text-blue-700'
                  : 'hover:bg-gray-50 text-gray-700'
                  }`}
                style={{ paddingLeft: `${depth * 16 + 12}px` }}
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
                  } catch { }
                }}
              >
                {/* Expand/Collapse Button */}
                {hasChildren && (
                  <button
                    onClick={() => toggleGroupExpansion(group.id)}
                    className="p-1 hover:bg-white rounded transition-colors"
                  >
                    {isExpanded ? (
                      <ChevronDownIcon className="h-3 w-3 text-gray-500" />
                    ) : (
                      <ChevronRightIcon className="h-3 w-3 text-gray-500" />
                    )}
                  </button>
                )}

                {/* Placeholder for groups without children */}
                {!hasChildren && <div className="w-5" />}

                {/* Folder Icon and Name */}
                <div
                  className="flex items-center gap-2 flex-1 min-w-0"
                  onClick={() => {
                    setSelectedGroup(group.id)
                    setShowMobileSidebar(false)
                  }}
                >
                  <FolderIcon className={`h-4 w-4 flex-shrink-0 ${isSelected ? 'text-blue-600' : 'text-gray-400'
                    }`} />
                  <span className="truncate text-sm font-medium">{group.name}</span>
                  <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                    {products.filter(p => (p as any).groupId === group.id).length}
                  </span>
                </div>

                {/* Group Actions */}
                <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                  <button
                    onClick={async (e) => {
                      e.stopPropagation()
                      const name = prompt('New subfolder name?')
                      if (!name) return
                      await createGroup(workspaceId!, name, group.id)
                      qc.invalidateQueries({ queryKey: ['groups', workspaceId] })
                      setExpandedGroups(prev => new Set(prev).add(group.id))
                    }}
                    className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                    title="New subfolder"
                  >
                    <FolderPlusIcon className="h-3 w-3" />
                  </button>
                  <button
                    onClick={async (e) => {
                      e.stopPropagation()
                      const name = prompt('Rename folder', group.name)
                      if (!name) return
                      await renameGroup(workspaceId!, group.id, name)
                      qc.invalidateQueries({ queryKey: ['groups', workspaceId] })
                    }}
                    className="p-1 text-gray-400 hover:text-green-600 transition-colors"
                    title="Rename folder"
                  >
                    <PencilIcon className="h-3 w-3" />
                  </button>
                  <button
                    onClick={async (e) => {
                      e.stopPropagation()
                      if (!confirm('Delete this folder and all its contents?')) return
                      await deleteGroup(workspaceId!, group.id)
                      qc.invalidateQueries({ queryKey: ['groups', workspaceId] })
                    }}
                    className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                    title="Delete folder"
                  >
                    <TrashIcon className="h-3 w-3" />
                  </button>
                </div>
              </div>

              {/* Children */}
              {hasChildren && isExpanded && (
                <FolderTree groups={groups} parentId={group.id} depth={depth + 1} />
              )}
            </div>
          )
        })}
      </div>
    )
  }

  if (!workspaceId) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading workspace...</p>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="space-y-8">
        {/* Header Skeleton */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="h-8 bg-gray-200 rounded w-64 animate-pulse"></div>
            <div className="h-4 bg-gray-200 rounded w-96 mt-2 animate-pulse"></div>
          </div>
          <div className="flex gap-3">
            <div className="h-9 bg-gray-200 rounded w-24 animate-pulse"></div>
            <div className="h-9 bg-gray-200 rounded w-28 animate-pulse"></div>
          </div>
        </div>

        {/* Stats Skeleton */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="relative overflow-hidden">
              <div className="p-1">
                <div className="flex items-center justify-between">
                  <div className="h-4 bg-gray-200 rounded w-24 animate-pulse"></div>
                  <div className="h-10 w-10 bg-gray-200 rounded-md animate-pulse"></div>
                </div>
                <div className="mt-4">
                  <div className="h-8 bg-gray-200 rounded w-16 animate-pulse"></div>
                </div>
                <div className="mt-1">
                  <div className="h-3 bg-gray-200 rounded w-32 animate-pulse"></div>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Content Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-20 gap-6">
          <div className="hidden lg:block lg:col-span-5">
            <Card>
              <div className="h-96 bg-gray-100 rounded animate-pulse"></div>
            </Card>
          </div>
          <div className="lg:col-span-15">
            <Card>
              <div className="h-96 bg-gray-100 rounded animate-pulse"></div>
            </Card>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
          {/* Header Section - Matching Dashboard Style */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-gray-900">Inventory Management</h1>
              <p className="mt-1 text-sm text-gray-500">
                Manage your product catalog, track stock levels, and monitor inventory performance.
              </p>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              {/* Mobile Menu Button */}
              <button
                onClick={() => setShowMobileSidebar(!showMobileSidebar)}
                className="sm:hidden p-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Bars3Icon className="h-5 w-5 text-gray-700" />
              </button>
              
              {/* Mobile Actions Menu */}
              <div className="sm:hidden relative">
                <button
                  onClick={() => setShowMobileActions(!showMobileActions)}
                  className="p-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <EllipsisVerticalIcon className="h-5 w-5 text-gray-700" />
                </button>
                {showMobileActions && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowMobileActions(false)}></div>
                    <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                      <button
                        onClick={() => {
                          setShowScanner(true)
                          setShowMobileActions(false)
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                      >
                        <QrCodeIcon className="h-4 w-4" />
                        Scan
                      </button>
                      <button
                        onClick={() => {
                          setShowImport(true)
                          setShowMobileActions(false)
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                      >
                        <ArrowUpTrayIcon className="h-4 w-4" />
                        Import
                      </button>
                      <button
                        onClick={() => {
                          downloadCSV('inventory.csv', toCSV(products))
                          setShowMobileActions(false)
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                      >
                        <ArrowDownTrayIcon className="h-4 w-4" />
                        Export
                      </button>
                      {duplicateProducts.length > 0 && (
                        <button
                          onClick={() => {
                            setShowDuplicates(true)
                            setShowMobileActions(false)
                          }}
                          className="w-full text-left px-4 py-2 text-sm text-amber-700 hover:bg-amber-50 flex items-center gap-2"
                        >
                          <ExclamationCircleIcon className="h-4 w-4" />
                          Duplicates ({duplicateProducts.length})
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* Desktop Action Buttons */}
              <div className="hidden sm:flex items-center gap-3">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowFilters(!showFilters)}
                >
                  <FunnelIcon className="h-4 w-4 mr-2" />
                  Filters
                  {(statusFilter !== 'all' || lowStockFilter) && (
                    <span className="ml-2 bg-blue-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                      {(statusFilter !== 'all' ? 1 : 0) + (lowStockFilter ? 1 : 0)}
                    </span>
                  )}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowImport(true)}
                >
                  <ArrowUpTrayIcon className="h-4 w-4 mr-2" />
                  Import
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => downloadCSV('inventory.csv', toCSV(products))}
                >
                  <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
                  Export
                </Button>
                {duplicateProducts.length > 0 && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setShowDuplicates(true)}
                    className="bg-amber-50 border-amber-300 text-amber-700 hover:bg-amber-100"
                  >
                    <ExclamationCircleIcon className="h-4 w-4 mr-2" />
                    Duplicates
                    <span className="ml-2 bg-amber-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                      {duplicateProducts.length}
                    </span>
                  </Button>
                )}
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowScanner(true)}
                >
                  <QrCodeIcon className="h-4 w-4 mr-2" />
                  Scan
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setShowCreate(true)}
                >
                  <PlusIcon className="h-4 w-4 mr-2" />
                  New Product
                </Button>
              </div>
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search products by name, SKU, or ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-10 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors text-sm"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            )}
          </div>

          {/* Filters Panel */}
          {showFilters && (
            <Card className="bg-gray-50">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="w-full rounded-lg border-gray-300 focus:border-primary-500 focus:ring-primary-500 py-2 text-sm"
                  >
                    <option value="all">All Status</option>
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
                    <span className="text-sm font-medium text-gray-700">Show Low Stock Only</span>
                  </label>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mt-4 pt-4 border-t border-gray-200">
                <button
                  onClick={() => {
                    setStatusFilter('all')
                    setLowStockFilter(false)
                  }}
                  className="text-sm text-gray-600 hover:text-gray-800 transition-colors"
                >
                  Clear all filters
                </button>
                <span className="text-sm text-gray-500">
                  Showing {filteredProducts.length} of {products.length} products
                </span>
              </div>
            </Card>
          )}

          {/* Primary Stats Grid - Matching Dashboard Style */}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {/* Total Products */}
            <Card className="relative overflow-hidden border-l-4 border-l-primary-500">
              <div className="p-1">
                <div className="flex items-center justify-between">
                  <p className="truncate text-sm font-medium text-gray-500">Total Products</p>
                  <div className="rounded-md bg-primary-50 p-2">
                    <CubeIcon className="h-5 w-5 text-primary-600" aria-hidden="true" />
                  </div>
                </div>
                <div className="mt-4 flex items-baseline">
                  {isLoading ? (
                    <div className="h-8 w-16 animate-pulse bg-gray-200 rounded" />
                  ) : (
                    <p className="text-3xl font-semibold text-gray-900">{stats.totalProducts}</p>
                  )}
                </div>
                <div className="mt-1">
                  <p className="text-xs text-gray-500">{stats.activeCount} active products</p>
                </div>
              </div>
            </Card>

            {/* Low Stock */}
            <Card className={`relative overflow-hidden border-l-4 ${stats.lowStockCount > 0 ? 'border-l-amber-500' : 'border-l-green-500'}`}>
              <div className="p-1">
                <div className="flex items-center justify-between">
                  <p className="truncate text-sm font-medium text-gray-500">Low Stock Items</p>
                  <div className={`rounded-md p-2 ${stats.lowStockCount > 0 ? 'bg-amber-50' : 'bg-green-50'}`}>
                    <ExclamationTriangleIcon className={`h-5 w-5 ${stats.lowStockCount > 0 ? 'text-amber-600' : 'text-green-600'}`} aria-hidden="true" />
                  </div>
                </div>
                <div className="mt-4 flex items-baseline">
                  {isLoading ? (
                    <div className="h-8 w-16 animate-pulse bg-gray-200 rounded" />
                  ) : (
                    <>
                      <p className="text-3xl font-semibold text-gray-900">{stats.lowStockCount}</p>
                      {stats.outOfStockCount > 0 && (
                        <span className="ml-2 text-sm font-medium text-red-600">
                          ({stats.outOfStockCount} out)
                        </span>
                      )}
                    </>
                  )}
                </div>
                <div className="mt-1">
                  <p className="text-xs text-gray-500">Items below reorder point</p>
                </div>
              </div>
            </Card>

            {/* Inventory Value */}
            <Card className="relative overflow-hidden border-l-4 border-l-emerald-500">
              <div className="p-1">
                <div className="flex items-center justify-between">
                  <p className="truncate text-sm font-medium text-gray-500">Inventory Value</p>
                  <div className="rounded-md bg-emerald-50 p-2">
                    <CurrencyDollarIcon className="h-5 w-5 text-emerald-600" aria-hidden="true" />
                  </div>
                </div>
                <div className="mt-4 flex items-baseline">
                  {isLoading ? (
                    <div className="h-8 w-24 animate-pulse bg-gray-200 rounded" />
                  ) : (
                    <p className="text-3xl font-semibold text-gray-900">
                      £{stats.inventoryValue.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </p>
                  )}
                </div>
                <div className="mt-1">
                  <p className="text-xs text-gray-500">Total asset value</p>
                </div>
              </div>
            </Card>

            {/* Active Products */}
            <Card className="relative overflow-hidden border-l-4 border-l-blue-500">
              <div className="p-1">
                <div className="flex items-center justify-between">
                  <p className="truncate text-sm font-medium text-gray-500">Active Products</p>
                  <div className="rounded-md bg-blue-50 p-2">
                    <CheckCircleIcon className="h-5 w-5 text-blue-600" aria-hidden="true" />
                  </div>
                </div>
                <div className="mt-4 flex items-baseline">
                  {isLoading ? (
                    <div className="h-8 w-16 animate-pulse bg-gray-200 rounded" />
                  ) : (
                    <p className="text-3xl font-semibold text-gray-900">{stats.activeCount}</p>
                  )}
                </div>
                <div className="mt-1">
                  <p className="text-xs text-gray-500">
                    {stats.totalProducts > 0 ? Math.round((stats.activeCount / stats.totalProducts) * 100) : 0}% of total
                  </p>
                </div>
              </div>
            </Card>
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-20 gap-6">
          {/* Mobile Sidebar Overlay */}
          {showMobileSidebar && (
            <>
              <div
                className="fixed inset-0 bg-black/50 z-40 lg:hidden"
                onClick={() => setShowMobileSidebar(false)}
              ></div>
              <aside className="fixed inset-y-0 left-0 w-72 bg-white shadow-xl z-50 lg:hidden overflow-y-auto">
                <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <FolderIcon className="h-5 w-5 text-blue-600" />
                    Folders
                  </h3>
                  <button
                    onClick={() => setShowMobileSidebar(false)}
                    className="p-2 text-gray-400 hover:text-gray-600 rounded-lg transition-colors"
                  >
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                </div>
                <div className="p-4">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm font-medium text-gray-700">Product Folders</span>
                    <button
                      onClick={async () => {
                        const name = prompt('New folder name?')
                        if (!name) return
                        await createGroup(workspaceId!, name)
                        qc.invalidateQueries({ queryKey: ['groups', workspaceId] })
                        setShowMobileSidebar(false)
                      }}
                      className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="New folder"
                    >
                      <FolderPlusIcon className="h-4 w-4" />
                    </button>
                  </div>

                  <div
                    className="space-y-1 max-h-[calc(100vh-200px)] overflow-y-auto"
                    onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }}
                    onDrop={async (e) => {
                      const data = e.dataTransfer.getData('text/plain')
                      try {
                        const parsed = JSON.parse(data)
                        if (parsed?.type === 'group' && parsed?.id) {
                          await moveGroupParent(workspaceId!, parsed.id, null)
                          qc.invalidateQueries({ queryKey: ['groups', workspaceId] })
                        }
                      } catch { }
                    }}
                  >
                    {/* All Products */}
                    <div
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${selectedGroup === ''
                        ? 'bg-blue-50 border border-blue-200 text-blue-700'
                        : 'hover:bg-gray-50 text-gray-700'
                        }`}
                      onClick={() => {
                        setSelectedGroup('')
                        setShowMobileSidebar(false)
                      }}
                    >
                      <ArchiveBoxIcon className="h-4 w-4 text-gray-500" />
                      <span className="text-sm font-medium flex-1">All Products</span>
                      <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                        {products.length}
                      </span>
                    </div>

                    {/* Folder Tree */}
                    <FolderTree groups={groups} />
                  </div>
                </div>
              </aside>
            </>
          )}

          {/* Enhanced Sidebar - Desktop */}
          <aside className="hidden lg:block lg:col-span-5 min-w-[280px]">
            <Card className="h-full">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <FolderIcon className="h-5 w-5 text-blue-600" />
                  Product Folders
                </h3>
                <button
                  onClick={async () => {
                    const name = prompt('New folder name?')
                    if (!name) return
                    await createGroup(workspaceId!, name)
                    qc.invalidateQueries({ queryKey: ['groups', workspaceId] })
                  }}
                  className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  title="New folder"
                >
                  <FolderPlusIcon className="h-4 w-4" />
                </button>
              </div>

              <div
                className="space-y-1 max-h-[calc(100vh-400px)] overflow-y-auto"
                onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }}
                onDrop={async (e) => {
                  const data = e.dataTransfer.getData('text/plain')
                  try {
                    const parsed = JSON.parse(data)
                    if (parsed?.type === 'group' && parsed?.id) {
                      await moveGroupParent(workspaceId!, parsed.id, null)
                      qc.invalidateQueries({ queryKey: ['groups', workspaceId] })
                    }
                  } catch { }
                }}
              >
                {/* All Products */}
                <div
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${selectedGroup === ''
                    ? 'bg-blue-50 border border-blue-200 text-blue-700'
                    : 'hover:bg-gray-50 text-gray-700'
                    }`}
                  onClick={() => setSelectedGroup('')}
                >
                  <ArchiveBoxIcon className="h-4 w-4 text-gray-500" />
                  <span className="text-sm font-medium flex-1">All Products</span>
                  <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                    {products.length}
                  </span>
                </div>

                {/* Folder Tree */}
                <FolderTree groups={groups} />
              </div>
            </Card>
          </aside>

          {/* Main Content */}
          <section className="lg:col-span-15">
            {/* Bulk Actions */}
            {selectedIds.length > 0 && (
              <Card className="bg-blue-50 border-blue-200 mb-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="bg-blue-100 text-blue-800 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full text-xs sm:text-sm font-medium">
                      {selectedIds.length} product{selectedIds.length !== 1 ? 's' : ''} selected
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                    <select
                      className="text-xs sm:text-sm border border-gray-300 rounded-lg px-2 sm:px-3 py-1 sm:py-1.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 flex-1 sm:flex-none min-w-0"
                      onChange={async (e) => {
                        const target = e.target.value
                        if (!target) return
                        await Promise.all(selectedIds.map(id => moveProductToGroup(workspaceId!, id, target || null)))
                        setSelectedIds([])
                        qc.invalidateQueries({ queryKey: ['products', workspaceId] })
                        e.currentTarget.selectedIndex = 0
                      }}
                    >
                      <option value="">Move to folder...</option>
                      <option value="">No Folder</option>
                      {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                    </select>

                    <button
                      className="text-xs sm:text-sm px-2 sm:px-3 py-1 sm:py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                      onClick={async () => {
                        await Promise.all(selectedIds.map(id => setProductStatus(workspaceId!, id, 'active')))
                        setSelectedIds([])
                        qc.invalidateQueries({ queryKey: ['products', workspaceId] })
                      }}
                    >
                      Activate
                    </button>

                    <button
                      className="text-xs sm:text-sm px-2 sm:px-3 py-1 sm:py-1.5 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                      onClick={async () => {
                        await Promise.all(selectedIds.map(id => setProductStatus(workspaceId!, id, 'draft')))
                        setSelectedIds([])
                        qc.invalidateQueries({ queryKey: ['products', workspaceId] })
                      }}
                    >
                      Draft
                    </button>

                    <button
                      className="text-xs sm:text-sm px-2 sm:px-3 py-1 sm:py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-1"
                      onClick={async () => {
                        if (!confirm(`Delete ${selectedIds.length} product(s)? This action cannot be undone.`)) return
                        await Promise.all(selectedIds.map(id => deleteProduct(workspaceId!, id)))
                        setSelectedIds([])
                        qc.invalidateQueries({ queryKey: ['products', workspaceId] })
                      }}
                    >
                      <TrashIcon className="h-3 w-3" />
                      <span className="hidden sm:inline">Delete</span>
                    </button>

                    <button
                      onClick={() => setSelectedIds([])}
                      className="text-xs sm:text-sm px-2 sm:px-3 py-1 sm:py-1.5 text-gray-600 hover:text-gray-800"
                    >
                      Clear
                    </button>
                  </div>
                </div>
              </Card>
            )}

            {/* Products Table - Desktop */}
            <Card noPadding className="hidden md:block overflow-hidden">
              <DataTable
                data={paginatedProducts}
                columns={columns}
                onRowClick={setSelectedProduct}
                selectable
                getId={(p) => (p as any).id}
                selectedIds={selectedIds}
                onToggleSelect={(id, _item, checked) => {
                  setSelectedIds(prev => checked ? Array.from(new Set([...prev, id])) : prev.filter(x => x !== id))
                }}
                onToggleSelectAll={(checked) => {
                  setSelectedIds(checked ? paginatedProducts.map((p: any) => p.id) : [])
                }}
                renderActions={(item) => (
                  <div className="flex items-center justify-end gap-3">
                    <button
                      onClick={() => setSelectedProduct(item)}
                      className="text-blue-600 hover:text-blue-900 font-medium text-sm px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors flex items-center gap-1"
                    >
                      <EyeIcon className="h-3 w-3" />
                      View
                    </button>

                    <button
                      onClick={async () => {
                        const next = (item as any).status === 'active' ? 'draft' : 'active'
                        await setProductStatus(workspaceId!, (item as any).id, next as any)
                        qc.invalidateQueries({ queryKey: ['products', workspaceId] })
                      }}
                      className="text-gray-600 hover:text-gray-900 text-sm px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      {(item as any).status === 'active' ? 'Make Draft' : 'Activate'}
                    </button>

                    <button
                      onClick={async () => {
                        if (!confirm('Are you sure you want to delete this product?')) return
                        await deleteProduct(workspaceId!, (item as any).id)
                        qc.invalidateQueries({ queryKey: ['products', workspaceId] })
                      }}
                      className="text-red-600 hover:text-red-900 text-sm px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors flex items-center gap-1"
                    >
                      <TrashIcon className="h-3 w-3" />
                      Delete
                    </button>
                  </div>
                )}
              />
            </Card>

            {/* Products Cards - Mobile */}
            <div className="md:hidden space-y-3 pb-4">
              {paginatedProducts.length === 0 ? (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8">
                  <div className="text-center">
                    <div className="mx-auto h-12 w-12 text-gray-400">
                      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" className="h-12 w-12">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                      </svg>
                    </div>
                    <h3 className="mt-2 text-sm font-medium text-gray-900">No products</h3>
                    <p className="mt-1 text-sm text-gray-500">Get started by creating a new product.</p>
                  </div>
                </div>
              ) : (
                <>
                  {/* Select All on Mobile */}
                  <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={paginatedProducts.length > 0 && selectedIds.length === paginatedProducts.length}
                        onChange={(e) => {
                          setSelectedIds(e.target.checked ? paginatedProducts.map((p: any) => p.id) : [])
                        }}
                        className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500 focus:ring-offset-0"
                      />
                      <span className="text-sm font-semibold text-gray-900">Select All ({paginatedProducts.length})</span>
                    </label>
                  </div>

                  {paginatedProducts.map((item: any) => {
                    const isSelected = selectedIds.includes(item.id)
                    const qtyOnHand = item.qtyOnHand || 0
                    const isLowStock = qtyOnHand < item.minStock
                    const isOutOfStock = qtyOnHand === 0

                    return (
                      <div
                        key={item.id}
                        className={`bg-white rounded-xl shadow-sm border-2 transition-all duration-200 ${isSelected
                            ? 'border-blue-500 shadow-md bg-blue-50/50'
                            : 'border-gray-100 hover:border-gray-200 hover:shadow-md'
                          } ${isOutOfStock ? 'ring-2 ring-red-100' : isLowStock ? 'ring-2 ring-orange-100' : ''}`}
                      >
                        <div className="p-4">
                          {/* Header Section */}
                          <div className="flex items-start gap-3 mb-3">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                e.stopPropagation()
                                setSelectedIds(prev =>
                                  e.target.checked
                                    ? Array.from(new Set([...prev, item.id]))
                                    : prev.filter(x => x !== item.id)
                                )
                              }}
                              onClick={(e) => e.stopPropagation()}
                              className="w-5 h-5 mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500 focus:ring-offset-0 shrink-0"
                            />

                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2 mb-1">
                                <h3
                                  className="text-base font-bold text-gray-900 leading-tight line-clamp-2 cursor-pointer hover:text-blue-600 transition-colors"
                                  onClick={() => setSelectedProduct(item)}
                                >
                                  {(() => {
                                    const name = item.name || 'Unnamed Product'
                                    // Clean up encoding issues - remove replacement characters and invalid unicode
                                    let cleaned = name
                                      .replace(/\uFFFD/g, '') // Remove replacement characters
                                      .replace(/\u0000/g, '') // Remove null characters
                                      .trim()

                                    // Try to decode HTML entities if any
                                    try {
                                      const textarea = document.createElement('textarea')
                                      textarea.innerHTML = cleaned
                                      cleaned = textarea.value || cleaned
                                    } catch (e) {
                                      // If decoding fails, use original
                                    }

                                    return cleaned || name
                                  })()}
                                </h3>
                                <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold shrink-0 flex items-center gap-1 ${item.status === 'active'
                                    ? 'bg-green-100 text-green-800 border border-green-200'
                                    : item.status === 'draft'
                                      ? 'bg-gray-100 text-gray-800 border border-gray-200'
                                      : 'bg-red-100 text-red-800 border border-red-200'
                                  }`}>
                                  {item.status === 'active' && <CheckCircleIcon className="h-3 w-3" />}
                                  {item.status?.charAt(0).toUpperCase() + item.status?.slice(1)}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                <p className="text-xs text-gray-500 font-mono">SKU: {item.sku}</p>
                              </div>
                            </div>
                          </div>

                          {/* Stock Information Card */}
                          <div className={`rounded-lg p-3 mb-3 ${isOutOfStock
                              ? 'bg-red-50 border border-red-200'
                              : isLowStock
                                ? 'bg-orange-50 border border-orange-200'
                                : 'bg-gray-50 border border-gray-200'
                            }`}>
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-medium text-gray-600">Stock Level</span>
                              {isOutOfStock && (
                                <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-[10px] font-semibold">
                                  OUT OF STOCK
                                </span>
                              )}
                              {!isOutOfStock && isLowStock && (
                                <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full text-[10px] font-semibold">
                                  LOW STOCK
                                </span>
                              )}
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <div className="text-[10px] text-gray-500 mb-0.5 font-medium">On Hand</div>
                                <div className={`text-lg font-bold ${isOutOfStock
                                    ? 'text-red-600'
                                    : isLowStock
                                      ? 'text-orange-600'
                                      : 'text-gray-900'
                                  }`}>
                                  {qtyOnHand.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </div>
                              </div>
                              <div>
                                <div className="text-[10px] text-gray-500 mb-0.5 font-medium">Min Stock</div>
                                <div className="text-lg font-bold text-gray-700">
                                  {(item.minStock || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </div>
                              </div>
                            </div>
                            <div className="mt-2 pt-2 border-t border-gray-200">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] text-gray-500 font-medium">Unit</span>
                                <span className="text-xs font-semibold text-gray-700">{item.uom || 'N/A'}</span>
                              </div>
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                setSelectedProduct(item)
                              }}
                              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors active:scale-95"
                            >
                              <EyeIcon className="h-4 w-4" />
                              View
                            </button>
                            <button
                              onClick={async (e) => {
                                e.stopPropagation()
                                const next = item.status === 'active' ? 'draft' : 'active'
                                await setProductStatus(workspaceId!, item.id, next as any)
                                qc.invalidateQueries({ queryKey: ['products', workspaceId] })
                              }}
                              className="flex-1 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors active:scale-95"
                            >
                              {item.status === 'active' ? 'Draft' : 'Activate'}
                            </button>
                            <button
                              onClick={async (e) => {
                                e.stopPropagation()
                                if (!confirm('Are you sure you want to delete this product?')) return
                                await deleteProduct(workspaceId!, item.id)
                                qc.invalidateQueries({ queryKey: ['products', workspaceId] })
                              }}
                              className="flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors active:scale-95"
                            >
                              <TrashIcon className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </>
              )}
            </div>

            {/* Pagination */}
            {filteredProducts.length > 0 && (
              <Card className="mt-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                  <div className="text-xs sm:text-sm text-gray-700">
                    Showing <span className="font-medium">{startIndex + 1}</span> to{' '}
                    <span className="font-medium">{Math.min(endIndex, filteredProducts.length)}</span> of{' '}
                    <span className="font-medium">{filteredProducts.length}</span> products
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
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                  >
                    <ChevronLeftIcon className="w-3 h-3 sm:w-4 sm:h-4" />
                    <span className="hidden sm:inline">Previous</span>
                  </button>

                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum: number
                      if (totalPages <= 5) {
                        pageNum = i + 1
                      } else if (currentPage <= 3) {
                        pageNum = i + 1
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i
                      } else {
                        pageNum = currentPage - 2 + i
                      }

                      return (
                        <button
                          key={pageNum}
                          onClick={() => setCurrentPage(pageNum)}
                          className={`px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm font-medium rounded-md ${currentPage === pageNum
                            ? 'bg-blue-600 text-white'
                            : 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50'
                            }`}
                        >
                          {pageNum}
                        </button>
                      )
                    })}
                  </div>

                  <button
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                  >
                    <span className="hidden sm:inline">Next</span>
                    <ChevronRightIcon className="w-3 h-3 sm:w-4 sm:h-4" />
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
          />
        )}

        {showScanner && (
          <Scanner
            onScan={handleScan}
            onClose={() => setShowScanner(false)}
          />
        )}

        {showCreate && workspaceId && (
          <ProductForm
            workspaceId={workspaceId}
            groups={groups}
            onCreated={() => qc.invalidateQueries({ queryKey: ['products', workspaceId] })}
            onClose={() => setShowCreate(false)}
          />
        )}

        {showImport && (
          <ImportModal
            workspaceId={workspaceId!}
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
            onView={(product) => {
              setSelectedProduct(product)
              setShowDuplicates(false)
            }}
            onDelete={async (productId) => {
              await deleteProduct(workspaceId!, productId)
              qc.invalidateQueries({ queryKey: ['products', workspaceId] })
            }}
          />
        )}
      </div>
    )
  }

// Duplicates Modal Component
function DuplicatesModal({
  duplicates,
  groups,
  onClose,
  onView,
  onDelete
}: {
  duplicates: Array<{ sku: string; products: Product[] }>
  groups: Group[]
  onClose: () => void
  onView: (product: Product) => void
  onDelete: (productId: string) => Promise<void>
}) {
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const handleDelete = async (productId: string) => {
    if (!confirm('Are you sure you want to delete this duplicate product?')) return

    setDeletingId(productId)
    try {
      await onDelete(productId)
    } catch (err) {
      alert('Failed to delete product')
      console.error(err)
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-xl sm:rounded-2xl shadow-xl w-full max-w-4xl max-h-[95vh] sm:max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-4 sm:px-6 py-3 sm:py-5 border-b border-gray-200 flex items-center justify-between bg-amber-50">
          <div className="flex-1 min-w-0 pr-2">
            <h2 className="text-lg sm:text-xl font-bold text-gray-900 flex items-center gap-2">
              <ExclamationCircleIcon className="w-5 h-5 sm:w-6 sm:h-6 text-amber-600 shrink-0" />
              <span className="truncate">Duplicate Products</span>
            </h2>
            <p className="text-xs sm:text-sm text-gray-600 mt-1">
              Found {duplicates.length} duplicate SKU{duplicates.length !== 1 ? 's' : ''} with {duplicates.reduce((sum, d) => sum + d.products.length, 0)} total products
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-white text-gray-400 hover:text-gray-600 shrink-0"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
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
                          <div className="text-xs text-gray-500 mb-1">Group</div>
                          <div className="text-sm text-gray-700">
                            {groups.find(g => g.id === (product as any).groupId)?.name || 'Unassigned'}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500 mb-1">Stock</div>
                          <div className={`text-sm font-medium ${(product.qtyOnHand || 0) > 0 ? 'text-green-600' : 'text-gray-500'
                            }`}>
                            {(product.qtyOnHand || 0).toLocaleString()}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 sm:ml-4">
                        <button
                          onClick={() => onView(product)}
                          className="px-2 sm:px-3 py-1.5 text-xs sm:text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors flex items-center gap-1"
                        >
                          <EyeIcon className="w-4 h-4" />
                          <span className="hidden sm:inline">View</span>
                        </button>
                        <button
                          onClick={() => handleDelete(product.id)}
                          disabled={deletingId === product.id}
                          className="px-2 sm:px-3 py-1.5 text-xs sm:text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-1 disabled:opacity-50"
                        >
                          {deletingId === product.id ? (
                            <ArrowPathIcon className="w-4 h-4 animate-spin" />
                          ) : (
                            <TrashIcon className="w-4 h-4" />
                          )}
                          <span className="hidden sm:inline">Delete</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-gray-200 bg-gray-50">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <p className="text-xs sm:text-sm text-gray-600">
              Keep the product with the most stock or most complete information, delete the others.
            </p>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// Import Modal Component
function ImportModal({
  workspaceId,
  userId,
  products,
  groups,
  onClose,
  onSuccess
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

  // Fetch UOMs
  const { data: uoms = [] } = useQuery({
    queryKey: ['uoms', workspaceId],
    queryFn: () => listUOMs(workspaceId),
    enabled: !!workspaceId
  })

  const downloadTemplate = () => {
    // Build reference section with all available values
    let referenceSection = '# ============================================\n'
    referenceSection += '# REFERENCE VALUES - Use these in your import\n'
    referenceSection += '# ============================================\n#\n'

    // Groups
    if (groups.length > 0) {
      referenceSection += '# GROUPS (use in groupId column):\n'
      groups.forEach(g => {
        referenceSection += `# ${g.id} = ${g.name}\n`
      })
      referenceSection += '#\n'
    }

    // UOMs
    if (uoms.length > 0) {
      referenceSection += '# UOMs (use in uom column):\n'
      uoms.forEach(u => {
        referenceSection += `# ${u.symbol} = ${u.name || u.symbol}\n`
      })
      referenceSection += '#\n'
    }

    // Status values
    referenceSection += '# STATUS (use in status column):\n'
    referenceSection += '# active = Active\n'
    referenceSection += '# inactive = Inactive\n'
    referenceSection += '# draft = Draft\n'
    referenceSection += '#\n'

    // Current products with stock (for create mode)
    if (importMode === 'create' && products.length > 0) {
      referenceSection += '# CURRENT PRODUCTS & STOCK (for reference):\n'
      referenceSection += '# sku,name,currentStock\n'
      products.slice(0, 50).forEach(p => {
        const stock = (p as any).qtyOnHand || 0
        referenceSection += `# ${p.sku},${p.name},${stock}\n`
      })
      if (products.length > 50) {
        referenceSection += `# ... and ${products.length - 50} more products\n`
      }
      referenceSection += '#\n'
    }

    referenceSection += '# ============================================\n'
    referenceSection += '# DATA SECTION - Enter your data below\n'
    referenceSection += '# ============================================\n'

    const template = importMode === 'create'
      ? `${referenceSection}name,sku,uom,status,minStock,reorderPoint,quantityBox,pricePerBox,groupId,tags\nProduct Name,SKU-001,unit,active,10,5,100,25.50,tag1, tag2, tag3`
      : `${referenceSection}sku,quantity,reason\nSKU-001,50,Stock Adjustment`

    downloadCSV(`inventory-import-template-${importMode}.csv`, template)
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    setFile(selectedFile)
    setErrors([])
    setCsvData([])

    try {
      const text = await selectedFile.text()
      const parsed = parseCSV(text)

      if (parsed.length === 0) {
        setErrors(['CSV file is empty or invalid'])
        return
      }

      // Validate headers
      const requiredHeaders = importMode === 'create'
        ? ['name', 'sku']
        : ['sku', 'quantity']

      const headers = Object.keys(parsed[0])
      const missingHeaders = requiredHeaders.filter(h => !headers.includes(h.toLowerCase()))

      if (missingHeaders.length > 0) {
        setErrors([`Missing required columns: ${missingHeaders.join(', ')}`])
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

    try {
      if (importMode === 'create') {
        // Create new products
        for (const row of csvData) {
          try {
            // Parse tags (comma-separated string to array)
            const tagsValue = row.tags || row.Tags || row.TAGS || ''
            const tags = tagsValue
              ? tagsValue.split(',').map((t: string) => t.trim()).filter(Boolean)
              : []

            const product = await createProduct(workspaceId, {
              name: row.name || row.Name || '',
              sku: row.sku || row.SKU || '',
              uom: row.uom || row.UOM || 'unit',
              status: (row.status || row.Status || 'active') as 'active' | 'inactive',
              minStock: Number(row.minStock || row['Min Stock'] || 0),
              reorderPoint: Number(row.reorderPoint || row['Reorder Point'] || 0),
              quantityBox: Number(row.quantityBox || row['Quantity Box'] || 0),
              pricePerBox: Number(row.pricePerBox || row['Price Per Box'] || 0),
              groupId: row.groupId || row['Group ID'] || null,
              tags: tags,
            })
            setSuccessCount(prev => prev + 1)
          } catch (err: any) {
            setErrors(prev => [...prev, `Failed to create ${row.sku || row.SKU}: ${err.message}`])
          }
        }
      } else {
        // Update stock
        for (const row of csvData) {
          try {
            const sku = row.sku || row.SKU || ''
            const product = products.find(p => p.sku === sku)

            if (!product) {
              setErrors(prev => [...prev, `Product not found: ${sku}`])
              continue
            }

            const quantity = Number(row.quantity || row.Quantity || 0)
            if (quantity === 0) continue

            await createStockTransaction({
              workspaceId,
              productId: product.id,
              type: quantity > 0 ? 'in' : 'out',
              qty: Math.abs(quantity),
              userId: userId || undefined,
              reason: row.reason || row.Reason || 'Bulk import',
            })
            setSuccessCount(prev => prev + 1)
          } catch (err: any) {
            setErrors(prev => [...prev, `Failed to update stock for ${row.sku || row.SKU}: ${err.message}`])
          }
        }
      }

      if (successCount > 0 || csvData.length === successCount) {
        setTimeout(() => {
          onSuccess()
        }, 1000)
      }
    } catch (err: any) {
      setErrors(prev => [...prev, `Import failed: ${err.message}`])
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-xl sm:rounded-2xl shadow-xl w-full max-w-2xl max-h-[95vh] sm:max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-4 sm:px-6 py-3 sm:py-5 border-b border-gray-200 flex items-center justify-between">
          <div className="flex-1 min-w-0 pr-2">
            <h2 className="text-lg sm:text-xl font-bold text-gray-900">Bulk Import</h2>
            <p className="text-xs sm:text-sm text-gray-500 mt-1">Import products or update stock from CSV</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 shrink-0"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-4 sm:space-y-6">
          {/* Import Mode Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">Import Mode</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <button
                onClick={() => {
                  setImportMode('create')
                  setFile(null)
                  setCsvData([])
                  setErrors([])
                }}
                className={`p-4 rounded-lg border-2 transition-all ${importMode === 'create'
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
                  }`}
              >
                <div className="font-medium text-gray-900">Create Products</div>
                <div className="text-xs text-gray-500 mt-1">Add new products from CSV</div>
              </button>
              <button
                onClick={() => {
                  setImportMode('stock')
                  setFile(null)
                  setCsvData([])
                  setErrors([])
                }}
                className={`p-4 rounded-lg border-2 transition-all ${importMode === 'stock'
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
                  }`}
              >
                <div className="font-medium text-gray-900">Update Stock</div>
                <div className="text-xs text-gray-500 mt-1">Adjust stock quantities</div>
              </button>
            </div>
          </div>

          {/* Template Download */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="font-medium text-blue-900">Download Template</div>
                <div className="text-sm text-blue-700 mt-1">
                  {importMode === 'create'
                    ? 'Template includes: name, sku, uom, status, minStock, reorderPoint, quantityBox, pricePerBox, groupId'
                    : 'Template includes: sku, quantity, reason'}
                </div>
                <div className="mt-3 space-y-2 text-xs">
                  {groups.length > 0 && (
                    <div className="bg-white/50 rounded p-2">
                      <div className="font-medium text-blue-900 mb-1">Groups ({groups.length}):</div>
                      <div className="max-h-16 overflow-y-auto space-y-0.5 font-mono text-blue-700">
                        {groups.slice(0, 5).map(g => (
                          <div key={g.id}>{g.id} = {g.name}</div>
                        ))}
                        {groups.length > 5 && <div className="text-blue-600">... {groups.length - 5} more</div>}
                      </div>
                    </div>
                  )}
                  {uoms.length > 0 && (
                    <div className="bg-white/50 rounded p-2">
                      <div className="font-medium text-blue-900 mb-1">UOMs ({uoms.length}):</div>
                      <div className="max-h-16 overflow-y-auto space-y-0.5 font-mono text-blue-700">
                        {uoms.slice(0, 5).map(u => (
                          <div key={u.id}>{u.symbol} = {u.name || u.symbol}</div>
                        ))}
                        {uoms.length > 5 && <div className="text-blue-600">... {uoms.length - 5} more</div>}
                      </div>
                    </div>
                  )}
                  <div className="bg-white/50 rounded p-2">
                    <div className="font-medium text-blue-900 mb-1">Status Values:</div>
                    <div className="font-mono text-blue-700 space-y-0.5">
                      <div>active = Active</div>
                      <div>inactive = Inactive</div>
                      <div>draft = Draft</div>
                    </div>
                  </div>
                  <div className="bg-white/50 rounded p-2">
                    <div className="font-medium text-blue-900 mb-1">Tags Format:</div>
                    <div className="text-blue-700 text-[10px]">
                      Comma-separated values: tag1, tag2, tag3
                    </div>
                  </div>
                  {importMode === 'create' && products.length > 0 && (
                    <div className="bg-white/50 rounded p-2">
                      <div className="font-medium text-blue-900 mb-1">Current Products ({products.length}):</div>
                      <div className="max-h-16 overflow-y-auto text-blue-700 text-[10px] font-mono">
                        {products.slice(0, 3).map(p => (
                          <div key={p.id}>
                            {p.sku} = {p.name} (Stock: {(p as any).qtyOnHand || 0})
                          </div>
                        ))}
                        {products.length > 3 && <div className="text-blue-600">... {products.length - 3} more (see template file)</div>}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <button
                onClick={downloadTemplate}
                className="ml-4 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shrink-0"
              >
                <DocumentArrowDownIcon className="w-4 h-4" />
                Download
              </button>
            </div>
          </div>

          {/* File Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Upload CSV File</label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors">
              <input
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="hidden"
                id="csv-upload"
              />
              <label
                htmlFor="csv-upload"
                className="cursor-pointer flex flex-col items-center"
              >
                <ArrowUpTrayIcon className="w-8 h-8 text-gray-400 mb-2" />
                <span className="text-sm font-medium text-gray-700">
                  {file ? file.name : 'Click to upload CSV file'}
                </span>
                <span className="text-xs text-gray-500 mt-1">CSV files only</span>
              </label>
            </div>
          </div>

          {/* Preview */}
          {csvData.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  Preview ({csvData.length} rows)
                </label>
                <span className="text-xs text-gray-500">
                  {successCount > 0 && `${successCount} processed`}
                </span>
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
                  <div className="px-3 py-2 text-xs text-gray-500 bg-gray-50">
                    ... and {csvData.length - 10} more rows
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Errors */}
          {errors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="font-medium text-red-900 mb-2">Errors ({errors.length})</div>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {errors.map((err, idx) => (
                  <div key={idx} className="text-sm text-red-700">{err}</div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-gray-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors text-sm"
          >
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
                Processing...
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