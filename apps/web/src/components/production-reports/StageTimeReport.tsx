import type { FC } from 'react'
import type { StageTimeData } from './utils'

interface StageTimeReportProps {
  data: StageTimeData[]
}

export const StageTimeReport: FC<StageTimeReportProps> = ({ data }) => {
  if (data.length === 0) {
    return (
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Stage Time Analysis</h3>
        <p className="text-gray-500">No stage time data available. Stage progress tracking needs to be enabled for jobs.</p>
      </div>
    )
  }
  
  const maxTime = Math.max(...data.map(d => d.avgTime), 1)
  const minTime = Math.min(...data.map(d => d.avgTime), Infinity)
  const avgTime = data.reduce((sum, item) => sum + item.avgTime, 0) / data.length
  const totalTime = data.reduce((sum, item) => sum + item.totalTime, 0)
  const totalJobs = data.reduce((sum, item) => sum + item.jobCount, 0)
  
  // Identify bottlenecks (stages taking significantly longer than average)
  const bottlenecks = data.filter(item => item.avgTime > avgTime * 1.5)
  
  // Sort by average time (longest first)
  const sortedData = [...data].sort((a, b) => b.avgTime - a.avgTime)
  
  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Stage Time Analysis</h3>
      
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
          <div className="text-2xl font-bold text-blue-900">{avgTime.toFixed(1)}</div>
          <div className="text-sm text-blue-700">Average Time (hours)</div>
          <div className="text-xs text-blue-600 mt-1">
            Across {data.length} stage{data.length > 1 ? 's' : ''}
          </div>
        </div>
        <div className="bg-red-50 rounded-lg p-4 border border-red-200">
          <div className="text-2xl font-bold text-red-900">{maxTime.toFixed(1)}</div>
          <div className="text-sm text-red-700">Longest Stage</div>
          <div className="text-xs text-red-600 mt-1">
            {sortedData[0]?.name}
          </div>
        </div>
        <div className="bg-green-50 rounded-lg p-4 border border-green-200">
          <div className="text-2xl font-bold text-green-900">{minTime.toFixed(1)}</div>
          <div className="text-sm text-green-700">Shortest Stage</div>
          <div className="text-xs text-green-600 mt-1">
            {sortedData[sortedData.length - 1]?.name}
          </div>
        </div>
        <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
          <div className="text-2xl font-bold text-purple-900">{bottlenecks.length}</div>
          <div className="text-sm text-purple-700">Potential Bottlenecks</div>
          <div className="text-xs text-purple-600 mt-1">
            {bottlenecks.length > 0 && '&gt;1.5x average'}
          </div>
        </div>
      </div>
      
      {/* Bottleneck Alert */}
      {bottlenecks.length > 0 && (
        <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <div className="text-sm font-semibold text-yellow-900 mb-1">
            ⚠ {bottlenecks.length} Stage{bottlenecks.length > 1 ? 's' : ''} Identified as Potential Bottlenecks
          </div>
          <div className="text-xs text-yellow-700">
            {bottlenecks.map(b => b.name).join(', ')} - Consider process optimization
          </div>
        </div>
      )}
      
      {/* Stage Details */}
      <div className="space-y-3">
        {sortedData.map((item) => {
          const isBottleneck = item.avgTime > avgTime * 1.5
          const isFast = item.avgTime < avgTime * 0.7
          
          return (
            <div 
              key={item.stageId} 
              className={`p-4 border rounded-lg ${
                isBottleneck ? 'border-red-300 bg-red-50' :
                isFast ? 'border-green-300 bg-green-50' :
                'border-gray-200 bg-white'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <span className="text-sm font-semibold text-gray-900">{item.name}</span>
                  {isBottleneck && (
                    <span className="px-2 py-0.5 text-xs font-medium bg-red-100 text-red-800 rounded-full">
                      Bottleneck
                    </span>
                  )}
                  {isFast && (
                    <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                      Fast
                    </span>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-xl font-bold text-gray-900">{item.avgTime.toFixed(1)}</div>
                  <div className="text-xs text-gray-500">hours avg</div>
                </div>
              </div>
              
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs text-gray-600">
                  {item.jobCount} job{item.jobCount !== 1 ? 's' : ''} • {item.totalTime.toFixed(1)} total hours
                </div>
                <div className="text-xs text-gray-600">
                  {((item.avgTime / avgTime) * 100).toFixed(0)}% of average
                </div>
              </div>
              
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className={`h-3 rounded-full ${
                    isBottleneck ? 'bg-red-500' :
                    isFast ? 'bg-green-500' : 'bg-blue-500'
                  }`}
                  style={{ width: `${Math.min((item.avgTime / maxTime) * 100, 100)}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
      
      {/* Optimization Suggestions */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-blue-900 mb-2">Optimization Insights</h4>
        <ul className="space-y-1 text-sm text-blue-800">
          <li>• Average stage time: <strong>{avgTime.toFixed(1)} hours</strong> across {data.length} stage{data.length > 1 ? 's' : ''}</li>
          {bottlenecks.length > 0 && (
            <li>• {bottlenecks.length} stage{bottlenecks.length > 1 ? 's' : ''} taking {((bottlenecks[0]?.avgTime || 0) / avgTime).toFixed(1)}x longer than average - focus optimization efforts here</li>
          )}
          {sortedData.length > 0 && (
            <li>• Longest stage: <strong>{sortedData[0].name}</strong> at {sortedData[0].avgTime.toFixed(1)} hours ({((sortedData[0].avgTime / avgTime) * 100).toFixed(0)}% above average)</li>
          )}
          {sortedData.length > 0 && (
            <li>• Shortest stage: <strong>{sortedData[sortedData.length - 1].name}</strong> at {sortedData[sortedData.length - 1].avgTime.toFixed(1)} hours - use as benchmark</li>
          )}
          <li>• Total time tracked: <strong>{totalTime.toFixed(1)} hours</strong> across {totalJobs} job{totalJobs !== 1 ? 's' : ''}</li>
        </ul>
      </div>
    </div>
  )
}

