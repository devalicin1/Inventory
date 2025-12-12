import type { FC } from 'react'
import type { WIPInventoryData } from './utils'
import { CubeIcon, ArrowRightIcon } from '@heroicons/react/24/outline'

interface WIPInventoryReportProps {
  data: WIPInventoryData[]
  onJobClick?: (jobId: string) => void
}

export const WIPInventoryReport: FC<WIPInventoryReportProps> = ({ data, onJobClick }) => {
  const totalQuantity = data.reduce((sum, item) => sum + item.quantity, 0)
  const totalJobs = data.reduce((sum, item) => sum + item.jobCount, 0)
  const avgDaysInTransition = data.length > 0
    ? data.reduce((sum, item) => {
        const avgDays = item.jobs.reduce((s, j) => s + j.daysInTransition, 0) / item.jobs.length
        return sum + avgDays
      }, 0) / data.length
    : 0
  
  const sortedData = [...data].sort((a, b) => b.quantity - a.quantity)
  
  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-900 mb-4">WIP Inventory Report (Stock View)</h3>
      <p className="text-sm text-gray-600 mb-4">
        Physical inventory quantities that have been produced in one stage but haven't been processed in the next stage yet.
      </p>
      
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold text-blue-900">{totalQuantity.toLocaleString()}</div>
              <div className="text-sm text-blue-700">Total WIP Quantity</div>
            </div>
            <CubeIcon className="h-8 w-8 text-blue-400" />
          </div>
        </div>
        <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold text-purple-900">{totalJobs}</div>
              <div className="text-sm text-purple-700">Jobs in Transition</div>
            </div>
            <div className="h-8 w-8 rounded-full bg-purple-200 flex items-center justify-center">
              <span className="text-purple-700 font-bold text-xs">#</span>
            </div>
          </div>
        </div>
        <div className="bg-indigo-50 rounded-lg p-4 border border-indigo-200">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold text-indigo-900">{avgDaysInTransition.toFixed(1)}</div>
              <div className="text-sm text-indigo-700">Avg Days in Transition</div>
            </div>
            <div className="h-8 w-8 rounded-full bg-indigo-200 flex items-center justify-center">
              <span className="text-indigo-700 font-bold text-xs">d</span>
            </div>
          </div>
        </div>
      </div>
      
      {/* WIP Inventory Table */}
      {sortedData.length > 0 ? (
        <div className="space-y-4">
          {sortedData.map((wip, idx) => (
            <div key={idx} className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-semibold text-gray-900">{wip.fromStageName}</span>
                    <ArrowRightIcon className="h-4 w-4 text-gray-400" />
                    <span className="text-sm font-semibold text-blue-600">{wip.toStageName}</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xl font-bold text-gray-900">
                    {wip.quantity.toLocaleString()} {wip.uom}
                  </div>
                  <div className="text-xs text-gray-500">{wip.jobCount} jobs</div>
                </div>
              </div>
              
              {/* Job Details */}
              {wip.jobs.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <div className="text-xs font-medium text-gray-500 mb-2">Job Details:</div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    {wip.jobs.slice(0, 6).map((job, jobIdx) => (
                      <div 
                        key={jobIdx} 
                        onClick={() => onJobClick?.(job.jobId)}
                        className="text-xs bg-gray-50 rounded px-2 py-1 hover:bg-blue-50 cursor-pointer transition-colors"
                      >
                        <span className="font-medium text-gray-900">{job.jobCode}:</span>
                        <span className="text-gray-600 ml-1">{job.quantity.toLocaleString()} {wip.uom}</span>
                        {job.daysInTransition > 1 && (
                          <span className="text-amber-600 ml-1">({job.daysInTransition.toFixed(1)}d)</span>
                        )}
                      </div>
                    ))}
                    {wip.jobs.length > 6 && (
                      <div className="text-xs text-gray-500 italic">
                        +{wip.jobs.length - 6} more jobs
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
          <CubeIcon className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-600 font-medium">No WIP inventory between stages</p>
          <p className="text-sm text-gray-500 mt-1">All production is flowing smoothly between stages.</p>
        </div>
      )}
    </div>
  )
}

