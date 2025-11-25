import type { FC } from 'react'
import type { WIPStageData } from './utils'
import { ExclamationTriangleIcon, LightBulbIcon } from '@heroicons/react/24/outline'

interface BottleneckReportProps {
  data: WIPStageData[]
}

export const BottleneckReport: FC<BottleneckReportProps> = ({ data }) => {
  const sortedData = [...data].sort((a, b) => {
    // Sort by over limit first, then by count
    if (a.overLimit && !b.overLimit) return -1
    if (!a.overLimit && b.overLimit) return 1
    return b.count - a.count
  })
  const maxCount = Math.max(...data.map(item => item.count), 1)
  const overLimitStages = sortedData.filter(item => item.overLimit)
  const highWIPStages = sortedData.filter(item => !item.overLimit && item.count > maxCount * 0.7)
  
  // Calculate recommendations
  const getRecommendations = (item: WIPStageData) => {
    const recommendations: string[] = []
    if (item.overLimit) {
      recommendations.push(`Increase WIP limit from ${item.wipLimit} to ${Math.ceil(item.count * 1.2)}`)
      recommendations.push('Add resources to this stage')
    }
    if (item.avgDaysInStage > 7) {
      recommendations.push('Review process efficiency - high average days in stage')
    }
    if (item.overdueCount > 0) {
      recommendations.push(`Address ${item.overdueCount} overdue job(s)`)
    }
    if (Object.keys(item.workcenters).length === 0) {
      recommendations.push('Assign workcenters to improve throughput')
    }
    return recommendations
  }
  
  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Bottleneck Analysis</h3>
      <p className="text-sm text-gray-600 mb-4">
        Stages are ranked by WIP count and limit violations. Red indicates stages over their WIP limit.
      </p>
      
      {/* Summary Alerts */}
      {(overLimitStages.length > 0 || highWIPStages.length > 0) && (
        <div className="mb-6 space-y-2">
          {overLimitStages.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start space-x-3">
              <ExclamationTriangleIcon className="h-5 w-5 text-red-600 mt-0.5" />
              <div>
                <div className="text-sm font-semibold text-red-900">
                  {overLimitStages.length} Stage{overLimitStages.length > 1 ? 's' : ''} Over WIP Limit
                </div>
                <div className="text-xs text-red-700 mt-1">
                  {overLimitStages.map(s => s.name).join(', ')} need immediate attention
                </div>
              </div>
            </div>
          )}
          {highWIPStages.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex items-start space-x-3">
              <ExclamationTriangleIcon className="h-5 w-5 text-yellow-600 mt-0.5" />
              <div>
                <div className="text-sm font-semibold text-yellow-900">
                  {highWIPStages.length} Stage{highWIPStages.length > 1 ? 's' : ''} Near Capacity
                </div>
                <div className="text-xs text-yellow-700 mt-1">
                  Monitor these stages closely
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      <div className="space-y-3">
        {sortedData.map((item, index) => {
          const utilizationPercent = item.wipLimit ? (item.count / item.wipLimit) * 100 : 0
          const recommendations = getRecommendations(item)
          const isCritical = item.overLimit || index < 2
          
          return (
            <div 
              key={item.stageId} 
              className={`rounded-lg border ${
                item.overLimit ? 'border-red-300 bg-red-50' : 
                index < 3 ? 'border-yellow-300 bg-yellow-50' : 
                'border-gray-200 bg-white'
              }`}
            >
              <div className="flex items-center justify-between p-3">
                <div className="flex items-center space-x-3 flex-1">
                  <span className={`text-sm font-bold w-8 ${
                    index === 0 ? 'text-red-600' : index === 1 ? 'text-yellow-600' : 'text-gray-600'
                  }`}>
                    #{index + 1}
                  </span>
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-medium text-gray-900">{item.name}</span>
                      {item.overLimit && (
                        <span className="px-2 py-0.5 text-xs font-medium bg-red-100 text-red-800 rounded-full">
                          Over Limit
                        </span>
                      )}
                      {item.overdueCount > 0 && (
                        <span className="px-2 py-0.5 text-xs font-medium bg-orange-100 text-orange-800 rounded-full">
                          {item.overdueCount} Overdue
                        </span>
                      )}
                      {isCritical && (
                        <span className="px-2 py-0.5 text-xs font-medium bg-red-100 text-red-800 rounded-full">
                          Critical
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {item.wipLimit ? `${utilizationPercent.toFixed(1)}% of limit` : 'No limit'} • 
                      Avg {item.avgDaysInStage > 0 ? item.avgDaysInStage.toFixed(1) : '-'} days in stage
                      {Object.keys(item.workcenters).length > 0 && (
                        <span> • {Object.keys(item.workcenters).length} workcenter(s)</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-32 bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${
                        item.overLimit ? 'bg-red-500' : 
                        index === 0 ? 'bg-red-500' : 
                        index === 1 ? 'bg-yellow-500' : 'bg-blue-500'
                      }`}
                      style={{ width: `${Math.min((item.count / maxCount) * 100, 100)}%` }}
                    />
                  </div>
                  <span className="text-sm font-bold text-gray-900 w-12 text-right">{item.count}</span>
                </div>
              </div>
              
              {/* Recommendations */}
              {recommendations.length > 0 && (
                <div className="px-3 pb-3 border-t border-gray-200 mt-2 pt-2">
                  <div className="flex items-start space-x-2">
                    <LightBulbIcon className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <div className="text-xs font-medium text-gray-700 mb-1">Recommendations:</div>
                      <ul className="space-y-0.5">
                        {recommendations.map((rec, idx) => (
                          <li key={idx} className="text-xs text-gray-600">• {rec}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
      
      {/* Overall Insights */}
      {sortedData.length > 0 && (
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-blue-900 mb-2">Overall Insights</h4>
          <ul className="space-y-1 text-sm text-blue-800">
            <li>• Top bottleneck: <strong>{sortedData[0]?.name}</strong> with {sortedData[0]?.count} jobs</li>
            {overLimitStages.length > 0 && (
              <li>• {overLimitStages.length} stage(s) exceeding WIP limits - consider capacity adjustments</li>
            )}
            {sortedData[0] && sortedData[0].avgDaysInStage > 7 && (
              <li>• Average days in top bottleneck stage: {sortedData[0].avgDaysInStage.toFixed(1)} days - process review recommended</li>
            )}
          </ul>
        </div>
      )}
    </div>
  )
}

