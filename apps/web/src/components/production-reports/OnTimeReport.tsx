import type { FC } from 'react'
import type { OnTimeData } from './utils'
import { CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline'

interface OnTimeReportProps {
  data: OnTimeData
}

export const OnTimeReport: FC<OnTimeReportProps> = ({ data }) => {
  const late = data.total - data.onTime
  const latePercentage = data.total > 0 ? (late / data.total) * 100 : 0
  
  // Performance rating
  const getPerformanceRating = (percentage: number) => {
    if (percentage >= 95) return { label: 'Excellent', color: 'green' }
    if (percentage >= 85) return { label: 'Good', color: 'blue' }
    if (percentage >= 75) return { label: 'Fair', color: 'yellow' }
    return { label: 'Needs Improvement', color: 'red' }
  }
  
  const rating = getPerformanceRating(data.percentage)
  
  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-900 mb-4">On-Time Delivery Performance</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold text-blue-900">{data.total}</div>
              <div className="text-sm text-blue-700">Total Completed</div>
            </div>
            <div className="h-10 w-10 rounded-full bg-blue-200 flex items-center justify-center">
              <span className="text-blue-700 font-bold">{data.total}</span>
            </div>
          </div>
        </div>
        <div className="bg-green-50 rounded-lg p-4 border border-green-200">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold text-green-900">{data.onTime}</div>
              <div className="text-sm text-green-700">On Time</div>
            </div>
            <CheckCircleIcon className="h-8 w-8 text-green-600" />
          </div>
          <div className="text-xs text-green-600 mt-2">
            {data.onTime > 0 && `${((data.onTime / data.total) * 100).toFixed(1)}% of total`}
          </div>
        </div>
        <div className="bg-red-50 rounded-lg p-4 border border-red-200">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold text-red-900">{late}</div>
              <div className="text-sm text-red-700">Late</div>
            </div>
            <XCircleIcon className="h-8 w-8 text-red-600" />
          </div>
          <div className="text-xs text-red-600 mt-2">
            {latePercentage.toFixed(1)}% of total
          </div>
        </div>
      </div>
      
      {/* Performance Rating */}
      <div className={`mb-6 rounded-lg p-4 border-2 ${
        rating.color === 'green' ? 'bg-green-50 border-green-300' :
        rating.color === 'blue' ? 'bg-blue-50 border-blue-300' :
        rating.color === 'yellow' ? 'bg-yellow-50 border-yellow-300' :
        'bg-red-50 border-red-300'
      }`}>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-gray-700 mb-1">Performance Rating</div>
            <div className={`text-2xl font-bold ${
              rating.color === 'green' ? 'text-green-900' :
              rating.color === 'blue' ? 'text-blue-900' :
              rating.color === 'yellow' ? 'text-yellow-900' :
              'text-red-900'
            }`}>
              {rating.label}
            </div>
          </div>
          <div className="text-right">
            <div className="text-4xl font-bold text-gray-900">{data.percentage.toFixed(1)}%</div>
            <div className="text-sm text-gray-600">On-Time Rate</div>
          </div>
        </div>
      </div>
      
      {/* Progress Visualization */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">On-Time Delivery Rate</span>
          <span className="text-sm font-semibold text-gray-900">{data.percentage.toFixed(1)}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-6 relative overflow-hidden">
          <div
            className="bg-green-500 h-6 rounded-full flex items-center justify-end pr-2 transition-all duration-500"
            style={{ width: `${data.percentage}%` }}
          >
            {data.percentage > 10 && (
              <span className="text-xs font-medium text-white">{data.percentage.toFixed(0)}%</span>
            )}
          </div>
          {latePercentage > 0 && (
            <div
              className="absolute top-0 right-0 bg-red-500 h-6 flex items-center justify-start pl-2"
              style={{ width: `${latePercentage}%` }}
            >
              {latePercentage > 10 && (
                <span className="text-xs font-medium text-white">{latePercentage.toFixed(0)}%</span>
              )}
            </div>
          )}
        </div>
        <div className="flex justify-between mt-2 text-xs text-gray-600">
          <span>Target: 95%+</span>
          <span className={data.percentage >= 95 ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
            {data.percentage >= 95 ? '✓ Target Met' : `⚠ ${(95 - data.percentage).toFixed(1)}% below target`}
          </span>
        </div>
      </div>
      
      {/* Breakdown */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-sm font-medium text-gray-700 mb-2">On-Time Jobs</div>
          <div className="text-3xl font-bold text-green-600">{data.onTime}</div>
          <div className="text-xs text-gray-500 mt-1">
            {data.total > 0 && `${((data.onTime / data.total) * 100).toFixed(1)}% of completed jobs`}
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-sm font-medium text-gray-700 mb-2">Late Jobs</div>
          <div className="text-3xl font-bold text-red-600">{late}</div>
          <div className="text-xs text-gray-500 mt-1">
            {latePercentage.toFixed(1)}% of completed jobs
          </div>
        </div>
      </div>
    </div>
  )
}

