import { ClockIcon, CubeIcon, ExclamationTriangleIcon, ArrowPathIcon } from '@heroicons/react/24/outline'
import type { RecentScan } from '../types'

interface RecentScansProps {
  recentScans: RecentScan[]
  onScanClick: (code: string) => void
}

export function RecentScans({ recentScans, onScanClick }: RecentScansProps) {
  return (
    <div className="bg-white rounded-2xl sm:rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="p-4 sm:p-5 border-b border-gray-100">
        <h3 className="text-sm sm:text-base font-bold text-gray-900">Recent Scans</h3>
      </div>
      <div className="divide-y divide-gray-100 max-h-[300px] sm:max-h-[400px] overflow-y-auto">
        {recentScans.length === 0 && (
          <div className="p-6 sm:p-8 text-center">
            <div className="w-14 h-14 sm:w-16 sm:h-16 bg-gray-100 rounded-xl sm:rounded-2xl flex items-center justify-center mx-auto mb-2 sm:mb-3">
              <ClockIcon className="h-7 w-7 sm:h-8 sm:w-8 text-gray-400" />
            </div>
            <p className="text-gray-500 font-medium text-sm sm:text-base">No scans yet</p>
            <p className="text-gray-400 text-xs sm:text-sm mt-1">Scans will appear here</p>
          </div>
        )}
        {recentScans.map((scan, i) => (
          <div
            key={i}
            onClick={() => scan.type !== 'none' && onScanClick(scan.code)}
            className={`p-3 sm:p-4 flex items-center gap-3 sm:gap-4 transition-colors touch-manipulation ${
              scan.type === 'none' 
                ? 'bg-red-50 cursor-default' 
                : 'active:bg-gray-50 cursor-pointer'
            }`}
          >
            <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl flex items-center justify-center flex-shrink-0 ${
              scan.type === 'job' 
                ? 'bg-blue-100' 
                : scan.type === 'product'
                ? 'bg-green-100'
                : 'bg-red-100'
            }`}>
              {scan.type === 'job' ? (
                <ClockIcon className="h-6 w-6 sm:h-7 sm:w-7 text-blue-600" />
              ) : scan.type === 'product' ? (
                <CubeIcon className="h-6 w-6 sm:h-7 sm:w-7 text-green-600" />
              ) : (
                <ExclamationTriangleIcon className="h-6 w-6 sm:h-7 sm:w-7 text-red-600" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-gray-900 text-sm sm:text-base truncate">{scan.code}</p>
              <p className={`text-xs sm:text-sm ${
                scan.type === 'none' ? 'text-red-600 font-medium' : 'text-gray-500'
              }`}>
                {scan.type === 'none' ? 'Not Found' : scan.type === 'job' ? 'Job' : 'Product'} • {scan.timestamp.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
            {scan.type !== 'none' && (
              <div className="w-9 h-9 sm:w-10 sm:h-10 bg-gray-100 rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0">
                <ArrowPathIcon className="h-4 w-4 sm:h-5 sm:w-5 text-gray-500" />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

