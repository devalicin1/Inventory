import type { FC } from 'react'
import type { WIPStageData } from './utils'
import { ExclamationTriangleIcon, CheckCircleIcon } from '@heroicons/react/24/outline'

interface WIPReportProps {
  data: WIPStageData[]
}

export const WIPReport: FC<WIPReportProps> = ({ data }) => {
  const total = data.reduce((sum, item) => sum + item.count, 0)
  const totalOverLimit = data.filter(item => item.overLimit).length
  const totalOverdue = data.reduce((sum, item) => sum + item.overdueCount, 0)
  const avgWIPPerStage = data.length > 0 ? total / data.length : 0
  const totalValue = data.reduce((sum, item) => sum + item.totalValue, 0)
  
  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Work in Progress by Stage</h3>
      
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold text-blue-900">{total}</div>
              <div className="text-sm text-blue-700">Total WIP Jobs</div>
            </div>
            <CheckCircleIcon className="h-8 w-8 text-blue-400" />
          </div>
          <div className="mt-2 text-xs text-blue-600">
            Avg {avgWIPPerStage.toFixed(1)} per stage
          </div>
        </div>
        <div className="bg-red-50 rounded-lg p-4 border border-red-200">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold text-red-900">{totalOverLimit}</div>
              <div className="text-sm text-red-700">Stages Over Limit</div>
            </div>
            <ExclamationTriangleIcon className="h-8 w-8 text-red-400" />
          </div>
          {totalOverLimit > 0 && (
            <div className="mt-2 text-xs text-red-600">
              {((totalOverLimit / data.length) * 100).toFixed(0)}% of stages
            </div>
          )}
        </div>
        <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold text-orange-900">{totalOverdue}</div>
              <div className="text-sm text-orange-700">Overdue Jobs</div>
            </div>
            <ExclamationTriangleIcon className="h-8 w-8 text-orange-400" />
          </div>
          {totalOverdue > 0 && (
            <div className="mt-2 text-xs text-orange-600">
              {((totalOverdue / total) * 100).toFixed(1)}% of WIP
            </div>
          )}
        </div>
        <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold text-purple-900">{data.length}</div>
              <div className="text-sm text-purple-700">Active Stages</div>
            </div>
            <div className="h-8 w-8 rounded-full bg-purple-200 flex items-center justify-center">
              <span className="text-purple-700 font-bold text-sm">{data.length}</span>
            </div>
          </div>
          {totalValue > 0 && (
            <div className="mt-2 text-xs text-purple-600">
              ${totalValue.toLocaleString()} total value
            </div>
          )}
        </div>
      </div>
      
      {/* Stage Details */}
      <div className="space-y-4">
        {data.map((item) => {
          const utilizationPercent = item.wipLimit ? (item.count / item.wipLimit) * 100 : 0
          const isOverLimit = item.overLimit
          const isNearLimit = item.wipLimit && utilizationPercent >= 80 && !isOverLimit
          
          return (
            <div 
              key={item.stageId} 
              className={`border rounded-lg p-4 ${
                isOverLimit ? 'border-red-300 bg-red-50' : 
                isNearLimit ? 'border-yellow-300 bg-yellow-50' : 
                'border-gray-200 bg-white'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <h4 className="text-base font-semibold text-gray-900">{item.name}</h4>
                  {isOverLimit && (
                    <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded-full">
                      Over Limit
                    </span>
                  )}
                  {isNearLimit && (
                    <span className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full">
                      Near Limit
                    </span>
                  )}
                  {item.overdueCount > 0 && (
                    <span className="px-2 py-1 text-xs font-medium bg-orange-100 text-orange-800 rounded-full">
                      {item.overdueCount} Overdue
                    </span>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-gray-900">{item.count}</div>
                  {item.wipLimit && (
                    <div className="text-xs text-gray-500">Limit: {item.wipLimit}</div>
                  )}
                </div>
              </div>
              
              {/* Progress Bar */}
              <div className="mb-3">
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className={`h-3 rounded-full ${
                      isOverLimit ? 'bg-red-500' : 
                      isNearLimit ? 'bg-yellow-500' : 
                      'bg-blue-500'
                    }`}
                    style={{ width: `${Math.min(utilizationPercent, 100)}%` }}
                  />
                </div>
                {item.wipLimit && (
                  <div className="text-xs text-gray-600 mt-1">
                    {utilizationPercent.toFixed(1)}% of limit ({item.count} / {item.wipLimit})
                  </div>
                )}
              </div>
              
              {/* Additional Metrics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div>
                  <div className="text-xs text-gray-500 mb-1">Avg Days in Stage</div>
                  <div className={`font-semibold ${item.avgDaysInStage > 7 ? 'text-orange-600' : item.avgDaysInStage > 14 ? 'text-red-600' : 'text-gray-900'}`}>
                    {item.avgDaysInStage > 0 ? `${item.avgDaysInStage.toFixed(1)} days` : '-'}
                  </div>
                  {item.avgDaysInStage > 7 && (
                    <div className="text-xs text-orange-600 mt-0.5">⚠ Above target</div>
                  )}
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-1">Priority Breakdown</div>
                  <div className="font-medium text-gray-900 flex flex-wrap gap-1">
                    {Object.entries(item.priorityBreakdown)
                      .sort(([a], [b]) => Number(a) - Number(b))
                      .slice(0, 3)
                      .map(([priority, count]) => (
                        <span key={priority} className="px-1.5 py-0.5 bg-gray-100 rounded text-xs">
                          P{priority}: {count}
                        </span>
                      ))}
                    {Object.keys(item.priorityBreakdown).length > 3 && (
                      <span className="text-xs text-gray-500">+{Object.keys(item.priorityBreakdown).length - 3}</span>
                    )}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-1">Workcenters</div>
                  <div className="font-medium text-gray-900">
                    {Object.keys(item.workcenters).length > 0 ? (
                      <div className="flex flex-col">
                        <span>{Object.keys(item.workcenters).length} workcenter(s)</span>
                        <span className="text-xs text-gray-500 mt-0.5">
                          Max: {Math.max(...Object.values(item.workcenters), 0)} jobs
                        </span>
                      </div>
                    ) : (
                      <span className="text-orange-600">Unassigned</span>
                    )}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-1">Overdue</div>
                  <div className={`font-semibold ${item.overdueCount > 0 ? 'text-red-600' : 'text-gray-900'}`}>
                    {item.overdueCount}
                  </div>
                  {item.overdueCount > 0 && (
                    <div className="text-xs text-red-600 mt-0.5">
                      {((item.overdueCount / item.count) * 100).toFixed(0)}% of stage
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
      
      {/* Total Summary */}
      <div className="mt-6 pt-4 border-t border-gray-200">
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium text-gray-700">Total WIP Jobs</span>
          <span className="text-2xl font-bold text-gray-900">{total}</span>
        </div>
      </div>
    </div>
  )
}

