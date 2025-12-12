import { useState, useEffect, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  listPurchaseOrders,
  subscribeToPurchaseOrders,
  deletePurchaseOrder,
  type PurchaseOrder,
  type PurchaseOrderStatus,
} from '../api/purchase-orders'
import { useSessionStore } from '../state/sessionStore'
import {
  PlusIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  PencilIcon,
  TrashIcon,
  EyeIcon,
  XMarkIcon,
  DocumentDuplicateIcon,
} from '@heroicons/react/24/outline'

export function PurchaseOrders() {
  const navigate = useNavigate()
  const { workspaceId } = useSessionStore()
  const queryClient = useQueryClient()
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<PurchaseOrderStatus | 'all'>('all')
  const [itemsPerPage, setItemsPerPage] = useState(10)
  const [currentPage, setCurrentPage] = useState(1)
  const [showFilters, setShowFilters] = useState(false)

  const { data: purchaseOrdersData, isLoading } = useQuery({
    queryKey: ['purchaseOrders', workspaceId],
    queryFn: () => listPurchaseOrders(workspaceId!),
    enabled: !!workspaceId,
  })

  const purchaseOrders = purchaseOrdersData?.purchaseOrders || []

  // Real-time subscription
  useEffect(() => {
    if (!workspaceId) return

    const unsubscribe = subscribeToPurchaseOrders(
      workspaceId,
      (updatedPOs) => {
        queryClient.setQueryData(['purchaseOrders', workspaceId], { purchaseOrders: updatedPOs })
      },
      (error) => {
        console.error('[PurchaseOrders] Real-time subscription error:', error)
      }
    )

    return () => unsubscribe()
  }, [workspaceId, queryClient])

  // Filter and search
  const filteredPOs = useMemo(() => {
    return purchaseOrders.filter((po) => {
      const matchesSearch =
        po.poNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        po.vendor?.name?.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesStatus = statusFilter === 'all' || po.status === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [purchaseOrders, searchTerm, statusFilter])

  // Pagination
  const paginatedPOs = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    const end = start + itemsPerPage
    return filteredPOs.slice(start, end)
  }, [filteredPOs, currentPage, itemsPerPage])

  const totalPages = Math.ceil(filteredPOs.length / itemsPerPage)

  const handleDelete = async (poId: string) => {
    if (!workspaceId) return
    if (!confirm('Are you sure you want to delete this purchase order?')) return

    try {
      await deletePurchaseOrder(workspaceId, poId)
      queryClient.invalidateQueries({ queryKey: ['purchaseOrders', workspaceId] })
    } catch (error) {
      console.error('Failed to delete purchase order:', error)
      alert('Failed to delete purchase order. Please try again.')
    }
  }

  const getStatusColor = (status: PurchaseOrderStatus) => {
    switch (status) {
      case 'Draft':
        return 'bg-gray-100 text-gray-800'
      case 'Submitted':
        return 'bg-blue-100 text-blue-800'
      case 'Approved':
        return 'bg-purple-100 text-purple-800'
      case 'Ordered':
        return 'bg-yellow-100 text-yellow-800'
      case 'Partially Received':
        return 'bg-orange-100 text-orange-800'
      case 'Received':
        return 'bg-green-100 text-green-800'
      case 'Cancelled':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const formatDate = (date: Date | any) => {
    if (!date) return '-'
    
    // Check if it's a serverTimestamp placeholder
    if (date._methodName === 'serverTimestamp' || (typeof date === 'object' && date._methodName === 'serverTimestamp')) {
      return '-'
    }
    
    try {
      let d: Date
      if (date?.toDate && typeof date.toDate === 'function') {
        // Firestore Timestamp
        d = date.toDate()
      } else if (date.seconds !== undefined && typeof date.seconds === 'number') {
        // Firestore Timestamp object with seconds
        d = new Date(date.seconds * 1000)
      } else if (date instanceof Date) {
        d = date
      } else if (typeof date === 'string' || typeof date === 'number') {
        d = new Date(date)
      } else {
        return '-'
      }
      
      // Check if date is valid
      if (isNaN(d.getTime())) {
        return '-'
      }
      
      return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
    } catch (error) {
      console.error('Error formatting date:', error, date)
      return '-'
    }
  }

  const formatCurrency = (amount: number) => {
    return `GBP ${amount.toFixed(2)}`
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Purchase Orders</h1>
          <p className="mt-1 text-sm text-gray-500">
            Start a new Purchase Order, select items and input the desired quantity for ordering. Export as a PDF and send to your supplier. Mark as 'Received' when items have been shipped.
          </p>
        </div>
        <button
          onClick={() => navigate('/purchase-orders/new')}
          className="inline-flex items-center rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
        >
          <PlusIcon className="-ml-0.5 mr-1.5 h-5 w-5" />
          NEW PURCHASE ORDER
        </button>
      </div>

      {/* Help Section */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="text-sm font-medium text-blue-900 mb-2">Learn how to create a Purchase Order</h3>
        <div className="flex gap-4">
          <a href="#" className="text-sm text-blue-700 hover:text-blue-900 underline">
            Watch Video Tutorial
          </a>
          <a href="#" className="text-sm text-blue-700 hover:text-blue-900 underline">
            View Help Article
          </a>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search Purchase Order #"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
        >
          <FunnelIcon className="h-5 w-5 mr-2" />
          Filter
        </button>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as PurchaseOrderStatus | 'all')}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Statuses</option>
                <option value="Draft">Draft</option>
                <option value="Submitted">Submitted</option>
                <option value="Approved">Approved</option>
                <option value="Ordered">Ordered</option>
                <option value="Partially Received">Partially Received</option>
                <option value="Received">Received</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  PO #
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  VENDOR
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ORDER TOTAL
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  STATUS
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  LAST UPDATED
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  DATE ORDERED
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  DATE EXPECTED
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  DATE RECEIVED
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  SHIP TO
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ACTIONS
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {paginatedPOs.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-6 py-12 text-center">
                    <div className="text-gray-500">
                      <p className="text-sm font-medium">No purchase orders found</p>
                      <p className="text-xs mt-1">
                        {searchTerm || statusFilter !== 'all'
                          ? 'Try adjusting your search or filters'
                          : 'Create your first purchase order to get started'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedPOs.map((po) => (
                  <tr key={po.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => navigate(`/purchase-orders/${po.id}`)}
                        className="text-sm font-medium text-blue-600 hover:text-blue-800"
                      >
                        {po.poNumber}
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {po.vendor?.name || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatCurrency(po.orderTotal)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(
                          po.status
                        )}`}
                      >
                        {po.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(po.lastUpdated || po.updatedAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(
                        po.dates?.dateOrdered || 
                        po.createdAt || 
                        po.updatedAt || 
                        po.lastUpdated
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(po.dates?.dateExpected)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(po.dates?.dateReceived)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {po.shipTo?.name || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => navigate(`/purchase-orders/${po.id}`)}
                          className="text-blue-600 hover:text-blue-800"
                          title="View"
                        >
                          <EyeIcon className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => navigate(`/purchase-orders/${po.id}/edit`)}
                          className="text-gray-600 hover:text-gray-800"
                          title="Edit"
                        >
                          <PencilIcon className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => navigate(`/purchase-orders/new?duplicate=${po.id}`)}
                          className="text-purple-600 hover:text-purple-800"
                          title="Duplicate"
                        >
                          <DocumentDuplicateIcon className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => handleDelete(po.id)}
                          className="text-red-600 hover:text-red-800"
                          title="Delete"
                        >
                          <TrashIcon className="h-5 w-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {filteredPOs.length > 0 && (
          <div className="bg-gray-50 px-6 py-3 flex items-center justify-between border-t border-gray-200">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-700">Show:</span>
              <select
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(Number(e.target.value))
                  setCurrentPage(1)
                }}
                className="border border-gray-300 rounded-md px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value={10}>10 per page</option>
                <option value={25}>25 per page</option>
                <option value={50}>50 per page</option>
                <option value={100}>100 per page</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 text-sm border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Previous
              </button>
              <span className="text-sm text-gray-700">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1 text-sm border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
