import type { FC } from 'react'
import type { ThroughputData } from './utils'
import { ArrowTrendingUpIcon, ArrowTrendingDownIcon } from '@heroicons/react/24/outline'

interface ThroughputReportProps {
  data: ThroughputData[]
}

export const ThroughputReport: FC<ThroughputReportProps> = ({ data }) => {
  const total = data.reduce((sum, item) => sum + item.count, 0)
  const average = data.length > 0 ? total / data.length : 0
  const maxDaily = Math.max(...data.map(d => d.count), 0)
  const minDaily = Math.min(...data.map(d => d.count), 0)
  
  // Calculate trend (last 7 days vs previous 7 days)
  const recent7Days = data.slice(-7).reduce((sum, d) => sum + d.count, 0)
  const previous7Days = data.slice(-14, -7).reduce((sum, d) => sum + d.count, 0)
  const trend = previous7Days > 0 ? ((recent7Days - previous7Days) / previous7Days) * 100 : 0
  const isTrendingUp = trend > 0
  
  // Calculate weekly average
  const weeklyAverage = data.length >= 7 ? recent7Days / 7 : average
  
  // Simple bar chart visualization
  const maxCount = Math.max(...data.map(d => d.count), 1)
  
  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Throughput Analysis</h3>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
          <div className="text-2xl font-bold text-blue-900">{total}</div>
          <div className="text-sm text-blue-700">Total Completed</div>
          <div className="text-xs text-blue-600 mt-1">
            {data.length > 0 && (
              <span>From {new Date(data[0].date).toLocaleDateString()} to {new Date(data[data.length - 1].date).toLocaleDateString()}</span>
            )}
          </div>
        </div>
        <div className="bg-green-50 rounded-lg p-4 border border-green-200">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold text-green-900">{average.toFixed(1)}</div>
              <div className="text-sm text-green-700">Average per Day</div>
            </div>
            {isTrendingUp ? (
              <ArrowTrendingUpIcon className="h-6 w-6 text-green-600" />
            ) : (
              <ArrowTrendingDownIcon className="h-6 w-6 text-red-600" />
            )}
          </div>
          {data.length >= 7 && (
            <div className="text-xs text-green-600 mt-1">
              Last 7 days: {weeklyAverage.toFixed(1)}/day
              {trend !== 0 && (
                <span className={`ml-2 ${isTrendingUp ? 'text-green-700' : 'text-red-700'}`}>
                  ({isTrendingUp ? '+' : ''}{trend.toFixed(1)}%)
                </span>
              )}
            </div>
          )}
        </div>
        <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
          <div className="text-2xl font-bold text-purple-900">{maxDaily}</div>
          <div className="text-sm text-purple-700">Peak Day</div>
          <div className="text-xs text-purple-600 mt-1">
            Min: {minDaily} jobs/day
          </div>
        </div>
        <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
          <div className="text-2xl font-bold text-orange-900">{data.length}</div>
          <div className="text-sm text-orange-700">Active Days</div>
          <div className="text-xs text-orange-600 mt-1">
            {data.length > 0 && data.length < 30 && (
              <span>Last {data.length} days</span>
            )}
          </div>
        </div>
      </div>
      
      {/* Visual Chart */}
      <div className="mb-6 bg-gray-50 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-gray-700 mb-3">Daily Throughput Trend</h4>
        <div className="flex items-end justify-between gap-1 h-32">
          {data.slice(-14).map((item, idx) => {
            const height = (item.count / maxCount) * 100
            return (
              <div key={item.date} className="flex-1 flex flex-col items-center">
                <div className="w-full bg-gray-200 rounded-t relative" style={{ height: `${height}%` }}>
                  <div className="absolute inset-0 bg-blue-500 rounded-t hover:bg-blue-600 transition-colors" />
                </div>
                <div className="text-xs text-gray-500 mt-1 transform -rotate-45 origin-top-left whitespace-nowrap">
                  {new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </div>
                <div className="text-xs font-medium text-gray-700 mt-1">{item.count}</div>
              </div>
            )
          })}
        </div>
      </div>
      
      {/* Recent Days List */}
      <div>
        <h4 className="text-sm font-semibold text-gray-700 mb-3">Recent Activity</h4>
        <div className="space-y-2">
          {data.slice(-10).reverse().map((item) => {
            const isAboveAverage = item.count > average
            return (
              <div key={item.date} className="flex items-center justify-between py-2 px-3 border border-gray-200 rounded-lg hover:bg-gray-50">
                <div className="flex items-center space-x-3">
                  <span className="text-sm text-gray-700 font-medium">
                    {new Date(item.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                  </span>
                  {isAboveAverage && (
                    <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                      Above avg
                    </span>
                  )}
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-24 bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full"
                      style={{ width: `${Math.min((item.count / maxCount) * 100, 100)}%` }}
                    />
                  </div>
                  <span className="text-sm font-semibold text-gray-900 w-12 text-right">{item.count} jobs</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

