import { useState, type FC } from 'react'
import { TrashIcon, XMarkIcon } from '@heroicons/react/24/outline'

interface ConfirmDeleteConsumptionModalProps {
  onClose: () => void
  onConfirm: (restock: boolean) => void
}

export const ConfirmDeleteConsumptionModal: FC<ConfirmDeleteConsumptionModalProps> = ({
  onClose,
  onConfirm,
}) => {
  const [restock, setRestock] = useState(true)

  return (
    <div className="fixed inset-0 z-50 backdrop-blur-sm bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-sm w-full border border-gray-200">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <TrashIcon className="h-5 w-5 text-red-500" />
            Delete consumption
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-3">
          <p className="text-sm text-gray-700">
            Are you sure you want to delete this material consumption record? This action cannot be
            undone.
          </p>

          <label className="mt-1 flex items-start gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              checked={restock}
              onChange={(e) => setRestock(e.target.checked)}
            />
            <span>
              Return the consumed quantity back to stock
              <span className="block text-xs text-gray-500">
                If checked, on-hand inventory for this item will be increased by the deleted quantity.
              </span>
            </span>
          </label>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(restock)}
            className="px-3 py-1.5 rounded-lg text-sm font-medium text-white bg-red-600 hover:bg-red-700 shadow-sm"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}

