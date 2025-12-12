import { QrCodeIcon, XMarkIcon } from '@heroicons/react/24/outline'

interface ScannerHeaderProps {
  onClose?: () => void
}

export function ScannerHeader({ onClose }: ScannerHeaderProps) {
  return (
    <div className="flex items-center justify-between px-2 sm:px-1">
      <div className="flex items-center gap-2 sm:gap-3">
        <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl sm:rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/25">
          <QrCodeIcon className="h-5 w-5 sm:h-7 sm:w-7 text-white" />
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900">Scanner</h1>
          <p className="text-xs sm:text-sm text-gray-500">Scan jobs or products</p>
        </div>
      </div>
      {onClose && (
        <button
          onClick={onClose}
          className="w-10 h-10 sm:w-12 sm:h-12 bg-gray-100 rounded-xl sm:rounded-2xl flex items-center justify-center active:bg-gray-200 transition-colors touch-manipulation"
        >
          <XMarkIcon className="h-5 w-5 sm:h-6 sm:w-6 text-gray-600" />
        </button>
      )}
    </div>
  )
}

