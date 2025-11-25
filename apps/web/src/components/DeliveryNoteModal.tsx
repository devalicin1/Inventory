import { useState, type FC } from 'react'
import { XMarkIcon } from '@heroicons/react/24/outline'
import type { Job } from '../api/production-jobs'
import { downloadDeliveryNotePDF, type DeliveryNoteOverrides, type DeliveryNoteOptions } from '../utils/deliveryNoteGenerator'

interface DeliveryNoteModalProps {
  job: Job
  onClose: () => void
  productionRuns?: any[]
  workflows?: Array<{ id: string; stages?: Array<{ id: string; outputUOM?: string }> }>
}

export const DeliveryNoteModal: FC<DeliveryNoteModalProps> = ({
  job,
  onClose,
  productionRuns = [],
  workflows = []
}) => {
  const [formData, setFormData] = useState<DeliveryNoteOverrides>({
    deliveryDate: new Date().toISOString().split('T')[0],
    deliveryMethod: job.deliveryMethod || '',
    deliveryAddress: job.deliveryAddress || '',
    driverName: '',
    vehicleNumber: '',
    notes: job.notes || '',
    // Job Information
    jobCode: job.code || '',
    customerName: job.customer?.name || '',
    customerPO: job.customer?.orderNo || '',
    orderReference: job.customer?.orderNo || job.customer?.ref || '',
    estimateNo: job.customer?.estNo || '',
    // Product Information
    productName: job.productName || '',
    sku: job.sku || '',
    quantity: job.quantity || 0,
    unit: job.unit || 'units',
    // Packaging
    pcsPerBox: job.packaging?.pcsPerBox || 0,
    boxesPerPallet: job.packaging?.boxesPerPallet || 0,
    plannedBoxes: job.packaging?.plannedBoxes || 0,
    actualBoxes: job.packaging?.actualBoxes || undefined,
    plannedPallets: job.packaging?.plannedPallets || 0,
    actualPallets: job.packaging?.actualPallets || undefined
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await downloadDeliveryNotePDF(job, formData, {
        productionRuns,
        workflows
      })
      onClose()
    } catch (error) {
      console.error('Delivery Note download failed:', error)
      alert('Delivery Note indirilemedi. Lütfen tekrar deneyin.')
    }
  }

  return (
    <div className="fixed inset-0 z-50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl border border-gray-200 w-full max-w-3xl max-h-[95vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">Delivery Note</h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Delivery Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Delivery Date
            </label>
            <input
              type="date"
              value={formData.deliveryDate}
              onChange={(e) => setFormData({ ...formData, deliveryDate: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>

          {/* Delivery Method */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Delivery Method
            </label>
            <input
              type="text"
              value={formData.deliveryMethod}
              onChange={(e) => setFormData({ ...formData, deliveryMethod: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="e.g., OUR VAN"
            />
          </div>

          {/* Delivery Address */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Delivery Address
            </label>
            <textarea
              value={formData.deliveryAddress}
              onChange={(e) => setFormData({ ...formData, deliveryAddress: e.target.value })}
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter delivery address"
            />
          </div>

          {/* Driver Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Driver Name
              </label>
              <input
                type="text"
                value={formData.driverName}
                onChange={(e) => setFormData({ ...formData, driverName: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Driver name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Vehicle Number
              </label>
              <input
                type="text"
                value={formData.vehicleNumber}
                onChange={(e) => setFormData({ ...formData, vehicleNumber: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Vehicle registration"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Delivery Notes
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={4}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Additional delivery notes or instructions"
            />
          </div>

          {/* Job Information Section */}
          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Job Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Job Code
                </label>
                <input
                  type="text"
                  value={formData.jobCode}
                  onChange={(e) => setFormData({ ...formData, jobCode: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Customer Name
                </label>
                <input
                  type="text"
                  value={formData.customerName}
                  onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Customer PO
                </label>
                <input
                  type="text"
                  value={formData.customerPO}
                  onChange={(e) => setFormData({ ...formData, customerPO: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Order Reference
                </label>
                <input
                  type="text"
                  value={formData.orderReference}
                  onChange={(e) => setFormData({ ...formData, orderReference: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Estimate No
                </label>
                <input
                  type="text"
                  value={formData.estimateNo}
                  onChange={(e) => setFormData({ ...formData, estimateNo: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Product Information Section */}
          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Product Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Product Name
                </label>
                <input
                  type="text"
                  value={formData.productName}
                  onChange={(e) => setFormData({ ...formData, productName: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  SKU
                </label>
                <input
                  type="text"
                  value={formData.sku}
                  onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Quantity
                  </label>
                  <input
                    type="number"
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: Number(e.target.value) || 0 })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Unit
                  </label>
                  <input
                    type="text"
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Packaging Information Section */}
          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Packaging Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Pieces per Box
                </label>
                <input
                  type="number"
                  value={formData.pcsPerBox || ''}
                  onChange={(e) => setFormData({ ...formData, pcsPerBox: Number(e.target.value) || 0 })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  min="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Boxes per Pallet
                </label>
                <input
                  type="number"
                  value={formData.boxesPerPallet || ''}
                  onChange={(e) => setFormData({ ...formData, boxesPerPallet: Number(e.target.value) || 0 })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  min="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Planned Boxes
                </label>
                <input
                  type="number"
                  value={formData.plannedBoxes || ''}
                  onChange={(e) => setFormData({ ...formData, plannedBoxes: Number(e.target.value) || 0 })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  min="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Actual Boxes
                </label>
                <input
                  type="number"
                  value={formData.actualBoxes !== undefined ? formData.actualBoxes : ''}
                  onChange={(e) => setFormData({ ...formData, actualBoxes: e.target.value ? Number(e.target.value) : undefined })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  min="0"
                  placeholder="Auto-calculated if empty"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Planned Pallets
                </label>
                <input
                  type="number"
                  value={formData.plannedPallets || ''}
                  onChange={(e) => setFormData({ ...formData, plannedPallets: Number(e.target.value) || 0 })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  min="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Actual Pallets
                </label>
                <input
                  type="number"
                  value={formData.actualPallets !== undefined ? formData.actualPallets : ''}
                  onChange={(e) => setFormData({ ...formData, actualPallets: e.target.value ? Number(e.target.value) : undefined })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  min="0"
                  placeholder="Auto-calculated if empty"
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-medium"
            >
              Download PDF
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

