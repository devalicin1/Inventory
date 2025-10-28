import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { DataTable } from '../components/DataTable'
import { Scanner } from '../components/Scanner'
import { listProducts } from '../api/inventory'
import { listGroups, type Group } from '../api/products'
import { ProductForm } from '../components/ProductForm'
import { ProductDetails } from '../components/ProductDetails'
import { 
  PlusIcon, 
  QrCodeIcon, 
  ArrowDownTrayIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon
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
  const [showEdit, setShowEdit] = useState(false)
  const [selectedGroup, setSelectedGroup] = useState<string>('')
  const qc = useQueryClient()

  // Mock workspace ID - in real app, get from context
  const workspaceId = 'demo-workspace'

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['products', workspaceId],
    queryFn: () => listProducts(workspaceId),
  })

  const { data: groups = [] } = useQuery<Group[]>({
    queryKey: ['groups', workspaceId],
    queryFn: () => listGroups(workspaceId),
  })

  const handleScan = (result: string) => {
    console.log('Scanned:', result)
    // Parse QR/barcode result and find product
    const product = products.find(p => p.sku === result || p.id === result)
    if (product) {
      setSelectedProduct(product)
    }
    setShowScanner(false)
  }

  const columns = [
    { key: 'sku' as keyof Product, label: 'SKU' },
    { key: 'name' as keyof Product, label: 'Name' },
    { key: 'uom' as keyof Product, label: 'UOM' },
    { 
      key: 'qtyOnHand' as keyof Product, 
      label: 'On Hand',
      render: (value: number) => value?.toFixed(2) || '0.00'
    },
    { 
      key: 'minStock' as keyof Product, 
      label: 'Min Stock',
      render: (value: number) => value?.toFixed(2) || '0.00'
    },
    { 
      key: 'status' as keyof Product, 
      label: 'Status',
      render: (value: string) => (
        <span className={`px-2 py-1 rounded-full text-xs ${
          value === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
        }`}>
          {value}
        </span>
      )
    },
  ]

  if (isLoading) {
    return (
      <div className="p-4">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="py-6">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 md:px-8">
          {/* Header */}
          <div className="md:flex md:items-center md:justify-between">
            <div className="min-w-0 flex-1">
              <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:truncate sm:text-3xl sm:tracking-tight">
                Inventory Management
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                Manage your products, track stock levels, and monitor inventory health
              </p>
            </div>
            <div className="mt-4 flex md:ml-4 md:mt-0">
              <button
                onClick={() => downloadCSV('products.csv', toCSV(products))}
                className="inline-flex items-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
              >
                <ArrowDownTrayIcon className="-ml-0.5 mr-1.5 h-5 w-5 text-gray-400" />
                Export CSV
              </button>
              <button
                onClick={() => setShowScanner(true)}
                className="ml-3 inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
              >
                <QrCodeIcon className="-ml-0.5 mr-1.5 h-5 w-5" />
                Scan
              </button>
              <button
                onClick={() => setShowCreate(true)}
                className="ml-3 inline-flex items-center rounded-md bg-green-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-green-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600">
                <PlusIcon className="-ml-0.5 mr-1.5 h-5 w-5" />
                Add Product
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <div className="overflow-hidden rounded-lg bg-white px-4 py-5 shadow sm:p-6">
            <dt className="truncate text-sm font-medium text-gray-500">Total Products</dt>
            <dd className="mt-1 text-3xl font-semibold tracking-tight text-gray-900">{products.length}</dd>
            </div>
            <div className="overflow-hidden rounded-lg bg-white px-4 py-5 shadow sm:p-6">
              <dt className="truncate text-sm font-medium text-gray-500">Low Stock</dt>
              <dd className="mt-1 flex items-baseline">
                <p className="text-3xl font-semibold tracking-tight text-red-600">
                  {products.filter(p => (p.qtyOnHand || 0) < p.minStock).length}
                </p>
                <ExclamationTriangleIcon className="ml-2 h-5 w-5 text-red-500" />
              </dd>
            </div>
            <div className="overflow-hidden rounded-lg bg-white px-4 py-5 shadow sm:p-6">
            <dt className="truncate text-sm font-medium text-gray-500">Inventory Value</dt>
            <dd className="mt-1 text-3xl font-semibold tracking-tight text-gray-900">
              £{products.reduce((sum, p: any) => sum + (p.totalValue || 0), 0).toFixed(2)}
            </dd>
            </div>
            <div className="overflow-hidden rounded-lg bg-white px-4 py-5 shadow sm:p-6">
            <dt className="truncate text-sm font-medium text-gray-500">Active</dt>
            <dd className="mt-1 flex items-baseline">
              <p className="text-3xl font-semibold tracking-tight text-green-600">
                {products.filter(p => p.status === 'active').length}
              </p>
              <CheckCircleIcon className="ml-2 h-5 w-5 text-green-500" />
            </dd>
            </div>
          </div>

          {/* Group Filter */}
          <div className="mt-6 flex items-center gap-3">
            <label className="text-sm text-gray-600">Group:</label>
            <select
              value={selectedGroup}
              onChange={(e) => setSelectedGroup(e.target.value)}
              className="rounded-md border-gray-300 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="">All</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>

          {/* Products Table */}
          <div className="mt-8 flow-root">
            <div className="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
              <div className="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
                <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
                  <DataTable
                    data={selectedGroup ? products.filter(p => (p as any).groupId === selectedGroup) : products}
                    columns={columns}
                    onRowClick={setSelectedProduct}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

      {selectedProduct && (
        <ProductDetails
          product={selectedProduct as any}
          onClose={() => setSelectedProduct(null)}
          onEdit={() => setShowEdit(true)}
          onAdjustStock={() => {
            // TODO: Implement adjust stock functionality
            console.log('Adjust stock for:', selectedProduct.id)
          }}
          onTransfer={() => {
            // TODO: Implement transfer functionality
            console.log('Transfer for:', selectedProduct.id)
          }}
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

      {showEdit && selectedProduct && (
        <ProductForm
          workspaceId={workspaceId}
          groups={groups}
          productId={(selectedProduct as any).id}
          initialValues={selectedProduct as any}
          onCreated={() => qc.invalidateQueries({ queryKey: ['products', workspaceId] })}
          onClose={() => setShowEdit(false)}
        />
      )}
    </div>
  )
}
