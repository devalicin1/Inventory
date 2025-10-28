import { useState, type FC } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { DataTable } from '../components/DataTable'
import { createProductionOrder } from '../api/production'
import { toCSV, downloadCSV } from '../utils/csv'
import { 
  PlusIcon, 
  ArrowDownTrayIcon
} from '@heroicons/react/24/outline'

interface ProductionOrder {
  id: string
  code: string
  productId: string
  productName?: string
  plannedQty: number
  bomVersion: string
  dueDate: string
  status: 'Draft' | 'Released' | 'In-Progress' | 'QA' | 'Completed' | 'Cancelled'
  notes?: string
  createdAt: string
}

export function Production() {
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [selectedPO, setSelectedPO] = useState<ProductionOrder | null>(null)
  const queryClient = useQueryClient()

  // Mock workspace ID - in real app, get from context
  const workspaceId = 'demo-workspace'

  // Mock data - in real app, fetch from Firestore
  const { data: productionOrders = [], isLoading } = useQuery({
    queryKey: ['productionOrders', workspaceId],
    queryFn: async () => {
      // Mock data for demo
      return [
        {
          id: '1',
          code: 'PO-0001',
          productId: 'prod-1',
          productName: 'Widget A',
          plannedQty: 100,
          bomVersion: '1.0',
          dueDate: '2024-01-15',
          status: 'Draft',
          notes: 'Initial production run',
          createdAt: '2024-01-01'
        },
        {
          id: '2',
          code: 'PO-0002',
          productId: 'prod-2',
          productName: 'Widget B',
          plannedQty: 50,
          bomVersion: '1.1',
          dueDate: '2024-01-20',
          status: 'In-Progress',
          notes: 'Urgent order',
          createdAt: '2024-01-05'
        }
      ] as ProductionOrder[]
    },
  })

  const createPOMutation = useMutation({
    mutationFn: createProductionOrder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['productionOrders', workspaceId] })
      setShowCreateForm(false)
    },
  })

  const handleCreatePO = async (data: any) => {
    await createPOMutation.mutateAsync({
      workspaceId,
      ...data
    })
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Draft': return 'bg-gray-100 text-gray-800'
      case 'Released': return 'bg-blue-100 text-blue-800'
      case 'In-Progress': return 'bg-yellow-100 text-yellow-800'
      case 'QA': return 'bg-purple-100 text-purple-800'
      case 'Completed': return 'bg-green-100 text-green-800'
      case 'Cancelled': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const columns = [
    { key: 'code' as keyof ProductionOrder, label: 'Code' },
    { key: 'productName' as keyof ProductionOrder, label: 'Product' },
    { key: 'plannedQty' as keyof ProductionOrder, label: 'Qty' },
    { key: 'dueDate' as keyof ProductionOrder, label: 'Due Date' },
    { 
      key: 'status' as keyof ProductionOrder, 
      label: 'Status',
      render: (value: string) => (
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(value)}`}>
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
      <div className="w-full px-6 lg:px-10">
          {/* Header */}
          <div className="md:flex md:items-center md:justify-between border-b border-gray-100 pb-4 mb-6">
            <div className="min-w-0 flex-1">
              <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:truncate sm:text-3xl sm:tracking-tight">
                Production Orders
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                Manage manufacturing workflows and track production progress
              </p>
            </div>
            <div className="mt-4 md:mt-0 flex gap-2">
              <button
                onClick={() => downloadCSV('production_orders.csv', toCSV(productionOrders))}
                className="inline-flex items-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-200 hover:bg-gray-50"
              >
                <ArrowDownTrayIcon className="-ml-0.5 mr-1.5 h-5 w-5 text-gray-400" />
                Export CSV
              </button>
              <button
                onClick={() => setShowCreateForm(true)}
                className="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
              >
                <PlusIcon className="-ml-0.5 mr-1.5 h-5 w-5" />
                Create PO
              </button>
            </div>
          </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
          <h3 className="text-sm font-medium text-gray-500">Total POs</h3>
          <p className="text-2xl font-semibold text-gray-900">{productionOrders.length}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
          <h3 className="text-sm font-medium text-gray-500">In Progress</h3>
          <p className="text-2xl font-semibold text-yellow-600">
            {productionOrders.filter(po => po.status === 'In-Progress').length}
          </p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
          <h3 className="text-sm font-medium text-gray-500">Completed</h3>
          <p className="text-2xl font-semibold text-green-600">
            {productionOrders.filter(po => po.status === 'Completed').length}
          </p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
          <h3 className="text-sm font-medium text-gray-500">Draft</h3>
          <p className="text-2xl font-semibold text-gray-600">
            {productionOrders.filter(po => po.status === 'Draft').length}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-100 shadow-sm">
        <DataTable
          data={productionOrders}
          columns={columns}
          onRowClick={setSelectedPO}
        />
      </div>

      {showCreateForm && (
        <CreatePOForm
          onSubmit={handleCreatePO}
          onClose={() => setShowCreateForm(false)}
          isLoading={createPOMutation.isPending}
        />
      )}

      {selectedPO && (
        <PODetail
          po={selectedPO}
          onClose={() => setSelectedPO(null)}
        />
      )}
    </div>
  </div>
  )
}

type CreatePOFormProps = {
  onSubmit: (data: any) => void
  onClose: () => void
  isLoading: boolean
}

const CreatePOForm: FC<CreatePOFormProps> = (props) => {
  const { onSubmit, onClose, isLoading } = props
  const [formData, setFormData] = useState({
    productId: '',
    plannedQty: 0,
    bomVersion: '1.0',
    dueDate: '',
    notes: ''
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(formData)
  }

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg p-6 max-w-md w-full">
        <h3 className="text-lg font-semibold mb-4">Create Production Order</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Product ID</label>
            <input
              type="text"
              value={formData.productId}
              onChange={(e) => setFormData({...formData, productId: e.target.value})}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Planned Quantity</label>
            <input
              type="number"
              value={formData.plannedQty}
              onChange={(e) => setFormData({...formData, plannedQty: Number(e.target.value)})}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">BOM Version</label>
            <input
              type="text"
              value={formData.bomVersion}
              onChange={(e) => setFormData({...formData, bomVersion: e.target.value})}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Due Date</label>
            <input
              type="date"
              value={formData.dueDate}
              onChange={(e) => setFormData({...formData, dueDate: e.target.value})}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({...formData, notes: e.target.value})}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              rows={3}
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {isLoading ? 'Creating...' : 'Create'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

type PODetailProps = { po: ProductionOrder; onClose: () => void }

const PODetail: FC<PODetailProps> = (props) => {
  const { po, onClose } = props
  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg p-6 max-w-lg w-full">
        <h3 className="text-lg font-semibold mb-4">Production Order Details</h3>
        <div className="space-y-2">
          <p><strong>Code:</strong> {po.code}</p>
          <p><strong>Product:</strong> {po.productName}</p>
          <p><strong>Quantity:</strong> {po.plannedQty}</p>
          <p><strong>BOM Version:</strong> {po.bomVersion}</p>
          <p><strong>Due Date:</strong> {new Date(po.dueDate).toLocaleDateString()}</p>
          <p><strong>Status:</strong> 
            <span className={`ml-2 px-2 py-1 rounded-full text-xs font-medium ${
              po.status === 'Draft' ? 'bg-gray-100 text-gray-800' :
              po.status === 'In-Progress' ? 'bg-yellow-100 text-yellow-800' :
              po.status === 'Completed' ? 'bg-green-100 text-green-800' :
              'bg-gray-100 text-gray-800'
            }`}>
              {po.status}
            </span>
          </p>
          {po.notes && <p><strong>Notes:</strong> {po.notes}</p>}
        </div>
        <div className="flex gap-2 mt-4">
          <button className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
            Release
          </button>
          <button className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">
            Start Production
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
