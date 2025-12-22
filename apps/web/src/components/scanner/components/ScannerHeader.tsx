import { QrCodeIcon, XMarkIcon } from '@heroicons/react/24/outline'

interface ScannerHeaderProps {
  onClose?: () => void
}

export function ScannerHeader({ onClose }: ScannerHeaderProps) {
  return (
    <div className="relative">
      {/* Glass morphism header */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-4 sm:py-5 bg-white/70 dark:bg-gray-900/70 backdrop-blur-xl rounded-2xl sm:rounded-3xl border border-white/20 dark:border-white/10 shadow-lg shadow-black/5">
        <div className="flex items-center gap-3 sm:gap-4">
          {/* Animated glass icon container */}
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-400/40 to-purple-500/40 rounded-2xl blur-xl animate-pulse" />
            <div className="relative w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-blue-500 via-blue-600 to-purple-600 rounded-2xl sm:rounded-3xl flex items-center justify-center shadow-lg shadow-blue-500/30 ring-2 ring-white/20">
              <QrCodeIcon className="h-6 w-6 sm:h-8 sm:w-8 text-white drop-shadow-lg" />
            </div>
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
              Scanner
            </h1>
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 font-medium">
              Scan jobs or products
            </p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="group relative w-12 h-12 sm:w-14 sm:h-14 bg-white/60 dark:bg-gray-800/60 backdrop-blur-md rounded-2xl sm:rounded-3xl flex items-center justify-center border border-white/30 dark:border-white/10 shadow-md hover:shadow-lg active:scale-95 transition-all duration-200 touch-manipulation hover:bg-white/80 dark:hover:bg-gray-800/80"
          >
            <XMarkIcon className="h-6 w-6 sm:h-7 sm:w-7 text-gray-700 dark:text-gray-300 group-active:scale-110 transition-transform" />
          </button>
        )}
      </div>
    </div>
  )
}

