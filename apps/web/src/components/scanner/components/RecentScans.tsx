import { ClockIcon, CubeIcon, ExclamationTriangleIcon, ArrowPathIcon } from '@heroicons/react/24/outline'
import type { RecentScan } from '../types'

interface RecentScansProps {
  recentScans: RecentScan[]
  onScanClick: (code: string) => void
}

export function RecentScans({ recentScans, onScanClick }: RecentScansProps) {
  return (
    <div className="relative bg-white/70 dark:bg-gray-900/70 backdrop-blur-xl rounded-3xl sm:rounded-[2rem] shadow-xl border border-white/40 dark:border-white/10 overflow-hidden ring-1 ring-black/5">
      {/* Header with glass effect */}
      <div className="p-5 sm:p-6 border-b border-white/30 dark:border-white/10 bg-gradient-to-r from-white/50 to-transparent">
        <h3 className="text-base sm:text-lg font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
          Recent Scans
        </h3>
      </div>
      <div className="divide-y divide-white/20 dark:divide-white/10 max-h-[300px] sm:max-h-[400px] overflow-y-auto">
        {recentScans.length === 0 && (
          <div className="p-8 sm:p-10 text-center">
            <div className="relative inline-block mb-4 sm:mb-5">
              <div className="absolute inset-0 bg-gradient-to-br from-gray-300/40 to-gray-400/40 rounded-2xl blur-xl" />
              <div className="relative w-16 h-16 sm:w-20 sm:h-20 bg-white/60 backdrop-blur-md rounded-2xl sm:rounded-3xl flex items-center justify-center mx-auto border border-white/40 shadow-lg">
                <ClockIcon className="h-8 w-8 sm:h-10 sm:w-10 text-gray-400" />
              </div>
            </div>
            <p className="text-gray-600 dark:text-gray-400 font-semibold text-sm sm:text-base mb-1">No scans yet</p>
            <p className="text-gray-500 dark:text-gray-500 text-xs sm:text-sm">Scans will appear here</p>
          </div>
        )}
        {recentScans.map((scan, i) => (
          <div
            key={i}
            onClick={() => scan.type !== 'none' && onScanClick(scan.code)}
            className={`group relative p-4 sm:p-5 flex items-center gap-4 sm:gap-5 transition-all duration-200 touch-manipulation ${
              scan.type === 'none' 
                ? 'bg-gradient-to-r from-red-50/80 to-red-50/40 cursor-default' 
                : 'hover:bg-white/40 active:bg-white/60 cursor-pointer active:scale-[0.98]'
            }`}
          >
            {/* Glass morphism icon container */}
            <div className={`relative w-14 h-14 sm:w-16 sm:h-16 rounded-2xl sm:rounded-3xl flex items-center justify-center flex-shrink-0 backdrop-blur-md border ${
              scan.type === 'job' 
                ? 'bg-gradient-to-br from-blue-400/30 to-blue-500/30 border-blue-300/30 shadow-lg shadow-blue-500/20' 
                : scan.type === 'product'
                ? 'bg-gradient-to-br from-green-400/30 to-green-500/30 border-green-300/30 shadow-lg shadow-green-500/20'
                : 'bg-gradient-to-br from-red-400/30 to-red-500/30 border-red-300/30 shadow-lg shadow-red-500/20'
            }`}>
              {scan.type === 'job' ? (
                <ClockIcon className="h-7 w-7 sm:h-8 sm:w-8 text-blue-600 drop-shadow-sm" />
              ) : scan.type === 'product' ? (
                <CubeIcon className="h-7 w-7 sm:h-8 sm:w-8 text-green-600 drop-shadow-sm" />
              ) : (
                <ExclamationTriangleIcon className="h-7 w-7 sm:h-8 sm:w-8 text-red-600 drop-shadow-sm" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-gray-900 dark:text-gray-100 text-sm sm:text-base truncate mb-1">
                {scan.code}
              </p>
              <p className={`text-xs sm:text-sm font-medium ${
                scan.type === 'none' 
                  ? 'text-red-600 dark:text-red-400' 
                  : 'text-gray-600 dark:text-gray-400'
              }`}>
                {scan.type === 'none' ? 'Not Found' : scan.type === 'job' ? 'Job' : 'Product'} • {scan.timestamp.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
            {scan.type !== 'none' && (
              <div className="w-11 h-11 sm:w-12 sm:h-12 bg-white/60 backdrop-blur-md hover:bg-white/80 rounded-xl sm:rounded-2xl flex items-center justify-center flex-shrink-0 border border-white/40 shadow-md group-hover:scale-110 transition-transform duration-200">
                <ArrowPathIcon className="h-5 w-5 sm:h-6 sm:w-6 text-gray-600 dark:text-gray-400" />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

