import type { FC } from 'react'
import type { MaterialUsageData } from './utils'
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline'

interface MaterialUsageReportProps {
  data: MaterialUsageData[]
}

export const MaterialUsageReport: FC<MaterialUsageReportProps> = ({ data }) => {
  if (data.length === 0) {
    return (
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Material Usage Analysis</h3>
        <p className="text-gray-500">No material usage data available.</p>
      </div>
    )
  }
  
  const totalRequired = data.reduce((sum, item) => sum + item.required, 0)
  const totalConsumed = data.reduce((sum, item) => sum + item.consumed, 0)
  const totalVariance = totalConsumed - totalRequired
  const totalVariancePercent = totalRequired > 0 ? (totalVariance / totalRequired) * 100 : 0
  
  const overConsumed = data.filter(item => item.variance > 0 && Math.abs(item.variancePercentage) > 5)
  const underConsumed = data.filter(item => item.variance < 0 && Math.abs(item.variancePercentage) > 5)
  const onTarget = data.filter(item => Math.abs(item.variancePercentage) <= 5)
  
  // Sort by variance percentage (absolute)
  const sortedData = [...data].sort((a, b) => Math.abs(b.variancePercentage) - Math.abs(a.variancePercentage))
  
  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Material Usage Analysis</h3>
      
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
          <div className="text-2xl font-bold text-blue-900">{totalRequired.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
          <div className="text-sm text-blue-700">Total Required</div>
          <div className="text-xs text-blue-600 mt-1">
            {data.length} material{data.length > 1 ? 's' : ''}
          </div>
        </div>
        <div className="bg-green-50 rounded-lg p-4 border border-green-200">
          <div className="text-2xl font-bold text-green-900">{totalConsumed.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
          <div className="text-sm text-green-700">Total Consumed</div>
          <div className="text-xs text-green-600 mt-1">
            {totalVariancePercent >= 0 ? '+' : ''}{totalVariancePercent.toFixed(1)}% variance
          </div>
        </div>
        <div className="bg-red-50 rounded-lg p-4 border border-red-200">
          <div className="text-2xl font-bold text-red-900">{overConsumed.length}</div>
          <div className="text-sm text-red-700">Over-Consumed</div>
          <div className="text-xs text-red-600 mt-1">
            {overConsumed.length > 0 && '&gt;5% variance'}
          </div>
        </div>
        <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
          <div className="text-2xl font-bold text-yellow-900">{onTarget.length}</div>
          <div className="text-sm text-yellow-700">On Target</div>
          <div className="text-xs text-yellow-600 mt-1">
            ±5% variance
          </div>
        </div>
      </div>
      
      {/* Critical Variances Alert */}
      {overConsumed.length > 0 && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-3 flex items-start space-x-3">
          <ExclamationTriangleIcon className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
          <div>
            <div className="text-sm font-semibold text-red-900">
              {overConsumed.length} Material{overConsumed.length > 1 ? 's' : ''} Over-Consumed
            </div>
            <div className="text-xs text-red-700 mt-1">
              Review consumption patterns for: {overConsumed.slice(0, 3).map(m => m.sku).join(', ')}
              {overConsumed.length > 3 && ` and ${overConsumed.length - 3} more`}
            </div>
          </div>
        </div>
      )}
      
      {/* Material Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SKU</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Required</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Consumed</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Variance</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Variance %</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sortedData.map((item) => {
              const isOver = item.variance > 0 && Math.abs(item.variancePercentage) > 5
              const isUnder = item.variance < 0 && Math.abs(item.variancePercentage) > 5
              const isOnTarget = Math.abs(item.variancePercentage) <= 5
              
              return (
                <tr 
                  key={item.sku}
                  className={isOver ? 'bg-red-50' : isUnder ? 'bg-yellow-50' : ''}
                >
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{item.sku}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                    {item.required.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                    {item.consumed.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </td>
                  <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${
                    isOver ? 'text-red-600' : isUnder ? 'text-yellow-600' : 'text-gray-900'
                  }`}>
                    {item.variance > 0 ? '+' : ''}{item.variance.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </td>
                  <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${
                    isOver ? 'text-red-600' : isUnder ? 'text-yellow-600' : 'text-gray-900'
                  }`}>
                    {item.variancePercentage > 0 ? '+' : ''}{item.variancePercentage.toFixed(1)}%
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    {isOver && (
                      <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded-full">
                        Over
                      </span>
                    )}
                    {isUnder && (
                      <span className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full">
                        Under
                      </span>
                    )}
                    {isOnTarget && (
                      <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                        On Target
                      </span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      
      {/* Insights */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-blue-900 mb-2">Key Insights</h4>
        <ul className="space-y-1 text-sm text-blue-800">
          <li>• Overall variance: <strong>{totalVariance >= 0 ? '+' : ''}{totalVariance.toLocaleString(undefined, { maximumFractionDigits: 2 })}</strong> ({totalVariancePercent >= 0 ? '+' : ''}{totalVariancePercent.toFixed(1)}%)</li>
          {overConsumed.length > 0 && (
            <li>• {overConsumed.length} material{overConsumed.length > 1 ? 's' : ''} significantly over-consumed - investigate waste or measurement issues</li>
          )}
          {underConsumed.length > 0 && (
            <li>• {underConsumed.length} material{underConsumed.length > 1 ? 's' : ''} under-consumed - verify BOM accuracy</li>
          )}
          {onTarget.length === data.length && (
            <li>• ✓ All materials are within acceptable variance range</li>
          )}
        </ul>
      </div>
    </div>
  )
}

