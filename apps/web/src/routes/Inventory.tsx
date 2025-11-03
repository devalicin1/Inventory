import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { DataTable } from '../components/DataTable'
import { Scanner } from '../components/Scanner'
import { listProducts } from '../api/inventory'
import { listGroups, type Group, setProductStatus, deleteProduct, moveProductToGroup, createGroup, deleteGroup, renameGroup, moveGroupParent } from '../api/products'
import { ProductForm } from '../components/ProductForm'
import { ProductDetails } from '../components/ProductDetails'
import { useSessionStore } from '../state/sessionStore'
import { 
  PlusIcon, 
  QrCodeIcon, 
  ArrowDownTrayIcon,
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
  ChartBarIcon,
  CubeIcon,
  CurrencyDollarIcon,
  XMarkIcon,
  ChevronDownIcon,
  ChevronRightIcon
} from '@heroicons/react/24/outline'
import { toCSV, downloadCSV } from '../utils/csv'

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
  const [selectedGroup, setSelectedGroup] = useState<string>('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [lowStockFilter, setLowStockFilter] = useState<boolean>(false)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const [showFilters, setShowFilters] = useState(false)
  const qc = useQueryClient()
  const { workspaceId } = useSessionStore()

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
        p.sku.toLowerCase().includes(term)
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

  // Get current group name
  const currentGroupName = useMemo(() => {
    if (!selectedGroup) return 'All Products'
    const group = groups.find(g => g.id === selectedGroup)
    return group?.name || 'Unknown Group'
  }, [selectedGroup, groups])

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
      sortable: true
    },
    { 
      key: 'uom' as keyof Product, 
      label: 'Unit',
      sortable: true
    },
    { 
      key: 'qtyOnHand' as keyof Product, 
      label: 'On Hand',
      render: (value: number) => (
        <span className={`font-medium ${
          (value || 0) === 0 ? 'text-red-600' : 
          (value || 0) < (() => {
            const product = products.find(p => p.id === (this as any)?.id)
            return product?.minStock || 0
          })() ? 'text-orange-600' : 'text-gray-900'
        }`}>
          {(value || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      ),
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
        <span className={`px-3 py-1.5 rounded-full text-xs font-medium inline-flex items-center gap-1 ${
          value === 'active' 
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
                className={`group flex items-center gap-2 px-3 py-2 rounded-lg transition-colors cursor-pointer ${
                  isSelected 
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
                  } catch {}
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
                  onClick={() => setSelectedGroup(group.id)}
                >
                  <FolderIcon className={`h-4 w-4 flex-shrink-0 ${
                    isSelected ? 'text-blue-600' : 'text-gray-400'
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
      <div className="min-h-screen bg-gray-50 py-6">
        <div className="w-full px-6 lg:px-10">
          <div className="animate-pulse space-y-6">
            {/* Header Skeleton */}
            <div className="flex items-center justify-between">
              <div className="space-y-3">
                <div className="h-8 bg-gray-200 rounded w-64"></div>
                <div className="h-4 bg-gray-200 rounded w-96"></div>
              </div>
              <div className="flex gap-3">
                <div className="h-10 bg-gray-200 rounded w-32"></div>
                <div className="h-10 bg-gray-200 rounded w-36"></div>
              </div>
            </div>
            
            {/* Stats Skeleton */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-24 bg-gray-200 rounded-lg"></div>
              ))}
            </div>
            
            {/* Content Skeleton */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="md:col-span-1 h-96 bg-gray-200 rounded-lg"></div>
              <div className="md:col-span-3 h-96 bg-gray-200 rounded-lg"></div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-6">
      <div className="w-full px-6 lg:px-10">
        {/* Enhanced Header */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <ArchiveBoxIcon className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Inventory Management</h1>
                  <p className="text-gray-600 mt-1">
                    {filteredProducts.length} product{filteredProducts.length !== 1 ? 's' : ''} • {currentGroupName} • {stats.lowStockCount} low stock
                  </p>
                </div>
              </div>
            </div>
            
            <div className="flex flex-wrap gap-3">
              {/* Search Bar */}
              <div className="relative flex-1 min-w-[280px]">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search products by name or SKU..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <XMarkIcon className="h-4 w-4" />
                  </button>
                )}
              </div>

              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border transition-colors ${
                  showFilters 
                    ? 'bg-blue-50 border-blue-200 text-blue-700' 
                    : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                <FunnelIcon className="h-4 w-4" />
                Filters
                {(statusFilter !== 'all' || lowStockFilter) && (
                  <span className="bg-blue-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                    {(statusFilter !== 'all' ? 1 : 0) + (lowStockFilter ? 1 : 0)}
                  </span>
                )}
              </button>

              <button
                onClick={() => downloadCSV('inventory.csv', toCSV(products))}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <ArrowDownTrayIcon className="h-4 w-4" />
                Export
              </button>

              <button
                onClick={() => setShowScanner(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <QrCodeIcon className="h-4 w-4" />
                Scan
              </button>

              <button
                onClick={() => setShowCreate(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
              >
                <PlusIcon className="h-4 w-4" />
                New Product
              </button>
            </div>
          </div>

          {/* Enhanced Filters */}
          {showFilters && (
            <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="w-full rounded-lg border-gray-300 focus:border-blue-500 focus:ring-blue-500 py-2.5"
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
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-gray-700">Show Low Stock Only</span>
                  </label>
                </div>
              </div>
              
              <div className="flex justify-between items-center mt-4 pt-4 border-t border-gray-200">
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
            </div>
          )}
        </div>

        {/* Enhanced KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Products</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{stats.totalProducts}</p>
              </div>
              <div className="p-3 bg-blue-50 rounded-lg">
                <CubeIcon className="h-6 w-6 text-blue-600" />
              </div>
            </div>
            <div className="mt-4 flex items-center text-sm text-gray-500">
              <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs">
                Active
              </span>
              <span className="ml-2">{stats.activeCount} products</span>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Low Stock</p>
                <p className="text-3xl font-bold text-red-600 mt-1">{stats.lowStockCount}</p>
              </div>
              <div className="p-3 bg-red-50 rounded-lg">
                <ExclamationTriangleIcon className="h-6 w-6 text-red-600" />
              </div>
            </div>
            <div className="mt-4 text-sm text-gray-500">
              {stats.outOfStockCount} out of stock
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Inventory Value</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">
                  £{stats.inventoryValue.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
              <div className="p-3 bg-green-50 rounded-lg">
                <CurrencyDollarIcon className="h-6 w-6 text-green-600" />
              </div>
            </div>
            <div className="mt-4 text-sm text-gray-500">
              Total inventory worth
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Products</p>
                <p className="text-3xl font-bold text-green-600 mt-1">{stats.activeCount}</p>
              </div>
              <div className="p-3 bg-green-50 rounded-lg">
                <CheckCircleIcon className="h-6 w-6 text-green-600" />
              </div>
            </div>
            <div className="mt-4 text-sm text-gray-500">
              {Math.round((stats.activeCount / stats.totalProducts) * 100)}% of total
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {/* Enhanced Sidebar */}
          <aside className="md:col-span-1">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 h-full">
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
                  } catch {}
                }}
              >
                {/* All Products */}
                <div 
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                    selectedGroup === '' 
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
            </div>
          </aside>

          {/* Main Content */}
          <section className="md:col-span-3">
            {/* Bulk Actions */}
            {selectedIds.length > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="bg-blue-100 text-blue-800 px-3 py-1.5 rounded-full text-sm font-medium">
                      {selectedIds.length} product{selectedIds.length !== 1 ? 's' : ''} selected
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <select
                      className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                      className="text-sm px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                      onClick={async () => {
                        await Promise.all(selectedIds.map(id => setProductStatus(workspaceId!, id, 'active')))
                        setSelectedIds([])
                        qc.invalidateQueries({ queryKey: ['products', workspaceId] })
                      }}
                    >
                      Activate
                    </button>

                    <button
                      className="text-sm px-3 py-1.5 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                      onClick={async () => {
                        await Promise.all(selectedIds.map(id => setProductStatus(workspaceId!, id, 'draft')))
                        setSelectedIds([])
                        qc.invalidateQueries({ queryKey: ['products', workspaceId] })
                      }}
                    >
                      Make Draft
                    </button>

                    <button
                      className="text-sm px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-1"
                      onClick={async () => {
                        if (!confirm(`Delete ${selectedIds.length} product(s)? This action cannot be undone.`)) return
                        await Promise.all(selectedIds.map(id => deleteProduct(workspaceId!, id)))
                        setSelectedIds([])
                        qc.invalidateQueries({ queryKey: ['products', workspaceId] })
                      }}
                    >
                      <TrashIcon className="h-3 w-3" />
                      Delete
                    </button>

                    <button
                      onClick={() => setSelectedIds([])}
                      className="text-sm px-3 py-1.5 text-gray-600 hover:text-gray-800"
                    >
                      Clear
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Products Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <DataTable
                data={filteredProducts}
                columns={columns}
                onRowClick={setSelectedProduct}
                selectable
                getId={(p) => (p as any).id}
                selectedIds={selectedIds}
                onToggleSelect={(id, _item, checked) => {
                  setSelectedIds(prev => checked ? Array.from(new Set([...prev, id])) : prev.filter(x => x !== id))
                }}
                onToggleSelectAll={(checked) => {
                  setSelectedIds(checked ? filteredProducts.map((p: any) => p.id) : [])
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
            </div>
          </section>
        </div>
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

      {showCreate && (
        <ProductForm
          workspaceId={workspaceId}
          groups={groups}
          onCreated={() => qc.invalidateQueries({ queryKey: ['products', workspaceId] })}
          onClose={() => setShowCreate(false)}
        />
      )}
    </div>
  )
}