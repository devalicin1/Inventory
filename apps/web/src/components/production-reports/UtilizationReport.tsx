import type { FC } from 'react'
import type { ResourceUtilizationData } from './utils'
import { UserGroupIcon } from '@heroicons/react/24/outline'

interface UtilizationReportProps {
  data: ResourceUtilizationData[]
}

export const UtilizationReport: FC<UtilizationReportProps> = ({ data }) => {
  if (data.length === 0) {
    return (
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Resource Utilization</h3>
        <p className="text-gray-500">No resource data available.</p>
      </div>
    )
  }
  
  const avgUtilization = data.reduce((sum, item) => sum + item.utilization, 0) / data.length
  const overUtilized = data.filter(item => item.utilization > 80)
  const underUtilized = data.filter(item => item.utilization < 40)
  const optimal = data.filter(item => item.utilization >= 40 && item.utilization <= 80)
  const totalAssigned = data.reduce((sum, item) => sum + item.assigned, 0)
  
  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Resource Utilization</h3>
      
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
          <div className="text-2xl font-bold text-blue-900">{avgUtilization.toFixed(1)}%</div>
          <div className="text-sm text-blue-700">Average Utilization</div>
          <div className="text-xs text-blue-600 mt-1">
            Across {data.length} resource{data.length > 1 ? 's' : ''}
          </div>
        </div>
        <div className="bg-green-50 rounded-lg p-4 border border-green-200">
          <div className="text-2xl font-bold text-green-900">{optimal.length}</div>
          <div className="text-sm text-green-700">Optimal (40-80%)</div>
          <div className="text-xs text-green-600 mt-1">
            {data.length > 0 && `${((optimal.length / data.length) * 100).toFixed(0)}% of resources`}
          </div>
        </div>
        <div className="bg-red-50 rounded-lg p-4 border border-red-200">
          <div className="text-2xl font-bold text-red-900">{overUtilized.length}</div>
          <div className="text-sm text-red-700">Over-Utilized (&gt;80%)</div>
          <div className="text-xs text-red-600 mt-1">
            {overUtilized.length > 0 && 'May need additional resources'}
          </div>
        </div>
        <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
          <div className="text-2xl font-bold text-yellow-900">{underUtilized.length}</div>
          <div className="text-sm text-yellow-700">Under-Utilized (&lt;40%)</div>
          <div className="text-xs text-yellow-600 mt-1">
            {underUtilized.length > 0 && 'Consider reassignment'}
          </div>
        </div>
      </div>
      
      {/* Resource List */}
      <div className="space-y-3">
        {data
          .sort((a, b) => b.utilization - a.utilization)
          .map((item) => {
            const status = item.utilization > 80 ? 'over' : item.utilization < 40 ? 'under' : 'optimal'
            return (
              <div 
                key={item.resourceId} 
                className={`p-4 rounded-lg border ${
                  status === 'over' ? 'border-red-200 bg-red-50' :
                  status === 'under' ? 'border-yellow-200 bg-yellow-50' :
                  'border-gray-200 bg-white'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-3">
                    <UserGroupIcon className={`h-5 w-5 ${
                      status === 'over' ? 'text-red-600' :
                      status === 'under' ? 'text-yellow-600' :
                      'text-gray-600'
                    }`} />
                    <div>
                      <span className="text-sm font-medium text-gray-900">{item.resourceName}</span>
                      {status === 'over' && (
                        <span className="ml-2 px-2 py-0.5 text-xs font-medium bg-red-100 text-red-800 rounded-full">
                          Over-Utilized
                        </span>
                      )}
                      {status === 'under' && (
                        <span className="ml-2 px-2 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full">
                          Under-Utilized
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-gray-900">{item.utilization.toFixed(1)}%</div>
                    <div className="text-xs text-gray-500">{item.assigned} / {item.total} assigned</div>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="flex-1 bg-gray-200 rounded-full h-3">
                    <div
                      className={`h-3 rounded-full transition-all ${
                        status === 'over' ? 'bg-red-500' : 
                        status === 'under' ? 'bg-yellow-500' : 'bg-green-500'
                      }`}
                      style={{ width: `${Math.min(item.utilization, 100)}%` }}
                    />
                  </div>
                  <div className="text-xs text-gray-600 w-20 text-right">
                    {item.assigned} job{item.assigned !== 1 ? 's' : ''}
                  </div>
                </div>
              </div>
            )
          })}
      </div>
      
      {/* Insights */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-blue-900 mb-2">Key Insights</h4>
        <ul className="space-y-1 text-sm text-blue-800">
          <li>• Total jobs assigned: <strong>{totalAssigned}</strong> across {data.length} resource{data.length > 1 ? 's' : ''}</li>
          {overUtilized.length > 0 && (
            <li>• {overUtilized.length} resource{overUtilized.length > 1 ? 's' : ''} over-utilized - consider load balancing or adding capacity</li>
          )}
          {underUtilized.length > 0 && (
            <li>• {underUtilized.length} resource{underUtilized.length > 1 ? 's' : ''} under-utilized - opportunity for better resource allocation</li>
          )}
          {optimal.length === data.length && (
            <li>• ✓ All resources are optimally utilized</li>
          )}
        </ul>
      </div>
    </div>
  )
}

