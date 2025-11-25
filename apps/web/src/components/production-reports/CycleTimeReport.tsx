import type { FC } from 'react'
import type { CycleTimeData } from './utils'

interface CycleTimeReportProps {
  data: CycleTimeData
}

export const CycleTimeReport: FC<CycleTimeReportProps> = ({ data }) => {
  if (data.cycleTimes.length === 0) {
    return (
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Cycle Time Analysis</h3>
        <p className="text-gray-500">No completed jobs available for cycle time analysis.</p>
      </div>
    )
  }
  
  const sorted = [...data.cycleTimes].sort((a, b) => a - b)
  const min = sorted[0]
  const max = sorted[sorted.length - 1]
  const median = sorted.length % 2 === 0
    ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
    : sorted[Math.floor(sorted.length / 2)]
  
  // Percentiles
  const p25 = sorted[Math.floor(sorted.length * 0.25)]
  const p75 = sorted[Math.floor(sorted.length * 0.75)]
  
  // Distribution buckets
  const buckets = [0, 5, 10, 15, 20, 30, 50, Infinity]
  const distribution = buckets.map((bucket, idx) => {
    const prev = idx > 0 ? buckets[idx - 1] : 0
    return {
      range: idx === buckets.length - 1 ? `${prev}+` : `${prev}-${bucket}`,
      count: data.cycleTimes.filter(ct => ct >= prev && ct < bucket).length
    }
  })
  
  const maxDist = Math.max(...distribution.map(d => d.count), 1)
  
  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Cycle Time Analysis</h3>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
          <div className="text-2xl font-bold text-blue-900">{data.average.toFixed(1)}</div>
          <div className="text-sm text-blue-700">Average (days)</div>
          <div className="text-xs text-blue-600 mt-1">
            Median: {median.toFixed(1)} days
          </div>
        </div>
        <div className="bg-green-50 rounded-lg p-4 border border-green-200">
          <div className="text-2xl font-bold text-green-900">{min.toFixed(1)}</div>
          <div className="text-sm text-green-700">Minimum (days)</div>
          <div className="text-xs text-green-600 mt-1">
            Best performance
          </div>
        </div>
        <div className="bg-red-50 rounded-lg p-4 border border-red-200">
          <div className="text-2xl font-bold text-red-900">{max.toFixed(1)}</div>
          <div className="text-sm text-red-700">Maximum (days)</div>
          <div className="text-xs text-red-600 mt-1">
            {max > data.average * 2 && '⚠ Needs attention'}
          </div>
        </div>
        <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
          <div className="text-2xl font-bold text-purple-900">{data.cycleTimes.length}</div>
          <div className="text-sm text-purple-700">Sample Size</div>
          <div className="text-xs text-purple-600 mt-1">
            Completed jobs
          </div>
        </div>
      </div>
      
      {/* Percentiles */}
      <div className="mb-6 bg-gray-50 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-gray-700 mb-3">Percentile Analysis</h4>
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-lg p-3 border border-gray-200">
            <div className="text-xs text-gray-500 mb-1">25th Percentile</div>
            <div className="text-lg font-bold text-gray-900">{p25.toFixed(1)} days</div>
            <div className="text-xs text-gray-600 mt-1">25% complete faster</div>
          </div>
          <div className="bg-white rounded-lg p-3 border border-gray-200">
            <div className="text-xs text-gray-500 mb-1">50th Percentile (Median)</div>
            <div className="text-lg font-bold text-blue-600">{median.toFixed(1)} days</div>
            <div className="text-xs text-gray-600 mt-1">50% complete faster</div>
          </div>
          <div className="bg-white rounded-lg p-3 border border-gray-200">
            <div className="text-xs text-gray-500 mb-1">75th Percentile</div>
            <div className="text-lg font-bold text-gray-900">{p75.toFixed(1)} days</div>
            <div className="text-xs text-gray-600 mt-1">75% complete faster</div>
          </div>
        </div>
      </div>
      
      {/* Distribution */}
      <div className="mb-6">
        <h4 className="text-sm font-semibold text-gray-700 mb-3">Cycle Time Distribution</h4>
        <div className="space-y-2">
          {distribution.map((item, idx) => (
            <div key={idx} className="flex items-center space-x-3">
              <div className="w-20 text-xs text-gray-600 font-medium">
                {item.range} days
              </div>
              <div className="flex-1 bg-gray-200 rounded-full h-6 relative">
                <div
                  className="bg-blue-500 h-6 rounded-full flex items-center justify-end pr-2"
                  style={{ width: `${(item.count / maxDist) * 100}%` }}
                >
                  {item.count > 0 && item.count / maxDist > 0.15 && (
                    <span className="text-xs font-medium text-white">{item.count}</span>
                  )}
                </div>
                {item.count > 0 && item.count / maxDist <= 0.15 && (
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-medium text-gray-700">
                    {item.count}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Insights */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-blue-900 mb-2">Key Insights</h4>
        <ul className="space-y-1 text-sm text-blue-800">
          <li>• Average cycle time: <strong>{data.average.toFixed(1)} days</strong></li>
          <li>• {((data.cycleTimes.filter(ct => ct <= data.average).length / data.cycleTimes.length) * 100).toFixed(0)}% of jobs complete in {data.average.toFixed(1)} days or less</li>
          <li>• Range: {min.toFixed(1)} - {max.toFixed(1)} days (variation: {(max - min).toFixed(1)} days)</li>
          {max > data.average * 2 && (
            <li className="text-orange-700">• ⚠ High variation detected - consider process standardization</li>
          )}
        </ul>
      </div>
    </div>
  )
}

