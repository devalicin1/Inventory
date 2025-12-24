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
import { hasWorkspacePermission } from '../utils/permissions'
import { showToast } from '../components/ui/Toast'
import { PageShell } from '../components/layout/PageShell'
import { Button } from '../components/ui/Button'
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
  const { workspaceId, userId } = useSessionStore()
  const queryClient = useQueryClient()
  const [canManagePOs, setCanManagePOs] = useState(false)
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

  // Check permission for managing purchase orders
  useEffect(() => {
    if (!workspaceId || !userId) {
      console.log('[PurchaseOrders] Missing workspaceId or userId:', { workspaceId, userId })
      setCanManagePOs(false)
      return
    }

    console.log('[PurchaseOrders] Checking permission for:', { workspaceId, userId, permission: 'manage_purchase_orders' })
    hasWorkspacePermission(workspaceId, userId, 'manage_purchase_orders')
      .then((hasPermission) => {
        console.log('[PurchaseOrders] Permission check result:', hasPermission)
        setCanManagePOs(hasPermission)
      })
      .catch((error) => {
        console.error('[PurchaseOrders] Permission check error:', error)
        setCanManagePOs(false)
      })
  }, [workspaceId, userId])

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
      showToast('Failed to delete purchase order. Please try again.', 'error')
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
    <PageShell
      title="Purchase Orders"
      subtitle="Start a new Purchase Order, select items and input the desired quantity for ordering. Export as a PDF and send to your supplier. Mark as 'Received' when items have been shipped."
      actions={
        canManagePOs ? (
          <Button
            variant="primary"
            size="md"
            onClick={() => navigate('/purchase-orders/new')}
          >
            <PlusIcon className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">NEW PURCHASE ORDER</span>
            <span className="sm:hidden">NEW PO</span>
          </Button>
        ) : undefined
      }
    >

      {/* Help Section */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4">
        <h3 className="text-xs sm:text-sm font-medium text-blue-900 mb-2">Learn how to create a Purchase Order</h3>
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
          <a href="#" className="text-xs sm:text-sm text-blue-700 hover:text-blue-900 underline">
            Watch Video Tutorial
          </a>
          <a href="#" className="text-xs sm:text-sm text-blue-700 hover:text-blue-900 underline">
            View Help Article
          </a>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
        <div className="flex-1 relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search PO #"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 sm:pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-[14px] focus:ring-2 focus:ring-blue-500 focus:border-blue-500 h-11"
          />
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="inline-flex items-center justify-center px-3 py-2 sm:px-4 sm:py-2 border border-gray-300 rounded-[14px] text-xs sm:text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 w-full sm:w-auto h-11"
        >
          <FunnelIcon className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
          Filter
        </button>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div className="bg-white border border-gray-200 rounded-lg p-3 sm:p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as PurchaseOrderStatus | 'all')}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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

      {/* Table - Desktop */}
      <div className="bg-white shadow-sm rounded-[14px] border border-gray-200 overflow-hidden hidden md:block">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 sm:px-6 h-11 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  PO #
                </th>
                <th className="px-4 sm:px-6 h-11 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  VENDOR
                </th>
                <th className="px-4 sm:px-6 h-11 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ORDER TOTAL
                </th>
                <th className="px-4 sm:px-6 h-11 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  STATUS
                </th>
                <th className="px-4 sm:px-6 h-11 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  LAST UPDATED
                </th>
                <th className="px-4 sm:px-6 h-11 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  DATE ORDERED
                </th>
                <th className="px-4 sm:px-6 h-11 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  DATE EXPECTED
                </th>
                <th className="px-4 sm:px-6 h-11 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  DATE RECEIVED
                </th>
                <th className="px-4 sm:px-6 h-11 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  SHIP TO
                </th>
                <th className="px-4 sm:px-6 h-11 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ACTIONS
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {paginatedPOs.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 sm:px-6 py-12 text-center">
                    <div className="text-gray-500">
                      <p className="text-xs sm:text-sm font-medium">No purchase orders found</p>
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
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => navigate(`/purchase-orders/${po.id}`)}
                        className="text-sm font-medium text-blue-600 hover:text-blue-800"
                      >
                        {po.poNumber}
                      </button>
                    </td>
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {po.vendor?.name || '-'}
                    </td>
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatCurrency(po.orderTotal)}
                    </td>
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(
                          po.status
                        )}`}
                      >
                        {po.status}
                      </span>
                    </td>
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(po.lastUpdated || po.updatedAt)}
                    </td>
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(
                        po.dates?.dateOrdered ||
                        po.createdAt ||
                        po.updatedAt ||
                        po.lastUpdated
                      )}
                    </td>
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(po.dates?.dateExpected)}
                    </td>
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(po.dates?.dateReceived)}
                    </td>
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {po.shipTo?.name || '-'}
                    </td>
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-1 sm:gap-2">
                        <button
                          onClick={() => navigate(`/purchase-orders/${po.id}`)}
                          className="text-blue-600 hover:text-blue-800 p-1"
                          title="View"
                        >
                          <EyeIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                        </button>
                        {canManagePOs && (
                          <>
                            <button
                              onClick={() => navigate(`/purchase-orders/${po.id}/edit`)}
                              className="text-gray-600 hover:text-gray-800 p-1"
                              title="Edit"
                            >
                              <PencilIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                            </button>
                            <button
                              onClick={() => navigate(`/purchase-orders/new?duplicate=${po.id}`)}
                              className="text-purple-600 hover:text-purple-800 p-1"
                              title="Duplicate"
                            >
                              <DocumentDuplicateIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                            </button>
                            <button
                              onClick={() => handleDelete(po.id)}
                              className="text-red-600 hover:text-red-800 p-1"
                              title="Delete"
                            >
                              <TrashIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                            </button>
                          </>
                        )}
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
          <div className="bg-gray-50 px-4 sm:px-6 py-3 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-gray-200">
            <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-start">
              <span className="text-xs sm:text-sm text-gray-700">Show:</span>
              <select
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(Number(e.target.value))
                  setCurrentPage(1)
                }}
                className="border border-gray-300 rounded-md px-2 py-1 text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value={10}>10 per page</option>
                <option value={25}>25 per page</option>
                <option value={50}>50 per page</option>
                <option value={100}>100 per page</option>
              </select>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 text-xs sm:text-sm border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Previous
              </button>
              <span className="text-xs sm:text-sm text-gray-700">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1 text-xs sm:text-sm border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-3">
        {paginatedPOs.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
            <div className="text-gray-500">
              <p className="text-sm font-medium">No purchase orders found</p>
              <p className="text-xs mt-1">
                {searchTerm || statusFilter !== 'all'
                  ? 'Try adjusting your search or filters'
                  : 'Create your first purchase order to get started'}
              </p>
            </div>
          </div>
        ) : (
          paginatedPOs.map((po) => (
            <div key={po.id} className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
              <div className="p-4">
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <button
                      onClick={() => navigate(`/purchase-orders/${po.id}`)}
                      className="text-base font-semibold text-blue-600 hover:text-blue-800 mb-1"
                    >
                      {po.poNumber}
                    </button>
                    <div className="text-sm text-gray-600">{po.vendor?.name || 'No Vendor'}</div>
                  </div>
                  <span
                    className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(
                      po.status
                    )}`}
                  >
                    {po.status}
                  </span>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <div className="text-xs text-gray-500 mb-0.5">Order Total</div>
                    <div className="text-sm font-semibold text-gray-900">{formatCurrency(po.orderTotal)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 mb-0.5">Last Updated</div>
                    <div className="text-xs text-gray-700">{formatDate(po.lastUpdated || po.updatedAt)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 mb-0.5">Date Ordered</div>
                    <div className="text-xs text-gray-700">
                      {formatDate(
                        po.dates?.dateOrdered ||
                        po.createdAt ||
                        po.updatedAt ||
                        po.lastUpdated
                      )}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 mb-0.5">Date Expected</div>
                    <div className="text-xs text-gray-700">{formatDate(po.dates?.dateExpected)}</div>
                  </div>
                  {po.dates?.dateReceived && (
                    <div>
                      <div className="text-xs text-gray-500 mb-0.5">Date Received</div>
                      <div className="text-xs text-gray-700">{formatDate(po.dates.dateReceived)}</div>
                    </div>
                  )}
                  {po.shipTo?.name && (
                    <div>
                      <div className="text-xs text-gray-500 mb-0.5">Ship To</div>
                      <div className="text-xs text-gray-700">{po.shipTo.name}</div>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                  <button
                    onClick={() => navigate(`/purchase-orders/${po.id}`)}
                    className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-md transition-colors"
                    title="View"
                  >
                    <EyeIcon className="h-5 w-5" />
                  </button>
                  {canManagePOs && (
                    <>
                      <button
                        onClick={() => navigate(`/purchase-orders/${po.id}/edit`)}
                        className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-50 rounded-md transition-colors"
                        title="Edit"
                      >
                        <PencilIcon className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => navigate(`/purchase-orders/new?duplicate=${po.id}`)}
                        className="p-2 text-purple-600 hover:text-purple-800 hover:bg-purple-50 rounded-md transition-colors"
                        title="Duplicate"
                      >
                        <DocumentDuplicateIcon className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => handleDelete(po.id)}
                        className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-md transition-colors"
                        title="Delete"
                      >
                        <TrashIcon className="h-5 w-5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))
        )}

        {/* Mobile Pagination */}
        {filteredPOs.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-700">Show:</span>
                <select
                  value={itemsPerPage}
                  onChange={(e) => {
                    setItemsPerPage(Number(e.target.value))
                    setCurrentPage(1)
                  }}
                  className="border border-gray-300 rounded-md px-2 py-1 text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value={10}>10 per page</option>
                  <option value={25}>25 per page</option>
                  <option value={50}>50 per page</option>
                  <option value={100}>100 per page</option>
                </select>
              </div>
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 text-xs border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  Previous
                </button>
                <span className="text-xs text-gray-700">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 text-xs border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </PageShell>
  )
}
