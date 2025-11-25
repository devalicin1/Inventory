import type { FC } from 'react'
import type { OutputPalletizationData } from './utils'
import { CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline'

interface OutputReportProps {
  data: OutputPalletizationData[]
}

export const OutputReport: FC<OutputReportProps> = ({ data }) => {
  if (data.length === 0) {
    return (
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Output & Palletization Analysis</h3>
        <p className="text-gray-500">No output data available.</p>
      </div>
    )
  }
  
  const totalPlanned = data.reduce((sum, item) => sum + item.totalPlanned, 0)
  const totalProduced = data.reduce((sum, item) => sum + item.totalProduced, 0)
  const avgProductionPercent = data.reduce((sum, item) => sum + item.productionPercentage, 0) / data.length
  const completedJobs = data.filter(item => item.productionPercentage >= 100).length
  const totalPlannedBoxes = data.reduce((sum, item) => sum + item.plannedBoxes, 0)
  const totalActualBoxes = data.reduce((sum, item) => sum + item.actualBoxes, 0)
  const totalPlannedPallets = data.reduce((sum, item) => sum + item.plannedPallets, 0)
  const totalActualPallets = data.reduce((sum, item) => sum + item.actualPallets, 0)
  
  const onTargetProduction = data.filter(item => item.productionPercentage >= 95 && item.productionPercentage <= 105).length
  const overProduction = data.filter(item => item.productionPercentage > 105).length
  const underProduction = data.filter(item => item.productionPercentage < 95).length
  
  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Output & Palletization Analysis</h3>
      
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
          <div className="text-2xl font-bold text-blue-900">
            {avgProductionPercent.toFixed(1)}%
          </div>
          <div className="text-sm text-blue-700">Avg Production %</div>
          <div className="text-xs text-blue-600 mt-1">
            {totalProduced.toLocaleString()} / {totalPlanned.toLocaleString()} units
          </div>
        </div>
        <div className="bg-green-50 rounded-lg p-4 border border-green-200">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold text-green-900">{completedJobs}</div>
              <div className="text-sm text-green-700">Completed Jobs</div>
            </div>
            <CheckCircleIcon className="h-8 w-8 text-green-600" />
          </div>
          <div className="text-xs text-green-600 mt-1">
            {((completedJobs / data.length) * 100).toFixed(0)}% of total
          </div>
        </div>
        <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
          <div className="text-2xl font-bold text-purple-900">
            {totalActualBoxes.toLocaleString()}
          </div>
          <div className="text-sm text-purple-700">Total Boxes</div>
          <div className="text-xs text-purple-600 mt-1">
            {totalPlannedBoxes > 0 && (
              <span>
                {totalActualBoxes >= totalPlannedBoxes ? '+' : ''}
                {((totalActualBoxes - totalPlannedBoxes) / totalPlannedBoxes * 100).toFixed(1)}% variance
              </span>
            )}
          </div>
        </div>
        <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
          <div className="text-2xl font-bold text-orange-900">
            {totalActualPallets.toLocaleString()}
          </div>
          <div className="text-sm text-orange-700">Total Pallets</div>
          <div className="text-xs text-orange-600 mt-1">
            {totalPlannedPallets > 0 && (
              <span>
                {totalActualPallets >= totalPlannedPallets ? '+' : ''}
                {((totalActualPallets - totalPlannedPallets) / totalPlannedPallets * 100).toFixed(1)}% variance
              </span>
            )}
          </div>
        </div>
      </div>
      
      {/* Production Status Breakdown */}
      <div className="mb-6 grid grid-cols-3 gap-4">
        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
          <div className="text-lg font-bold text-green-900">{onTargetProduction}</div>
          <div className="text-xs text-green-700">On Target (95-105%)</div>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <div className="text-lg font-bold text-yellow-900">{underProduction}</div>
          <div className="text-xs text-yellow-700">Under Production (&lt;95%)</div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <div className="text-lg font-bold text-red-900">{overProduction}</div>
          <div className="text-xs text-red-700">Over Production (&gt;105%)</div>
        </div>
      </div>
      
      {/* Detailed Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Job Code</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SKU</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Production %</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Boxes</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Box Variance</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Pallets</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Pallet Variance</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {data.map((item) => {
              const isOnTarget = item.productionPercentage >= 95 && item.productionPercentage <= 105
              const isUnder = item.productionPercentage < 95
              const isOver = item.productionPercentage > 105
              
              return (
                <tr 
                  key={item.jobCode}
                  className={isUnder ? 'bg-yellow-50' : isOver ? 'bg-red-50' : ''}
                >
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{item.jobCode}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.sku}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <div className="flex items-center justify-center space-x-2">
                      <div className="w-20 bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${
                            isOnTarget ? 'bg-green-500' : isUnder ? 'bg-yellow-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${Math.min(item.productionPercentage, 100)}%` }}
                        />
                      </div>
                      <span className={`text-sm font-medium ${
                        isOnTarget ? 'text-green-600' : isUnder ? 'text-yellow-600' : 'text-red-600'
                      }`}>
                        {item.productionPercentage.toFixed(1)}%
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-900">
                    {item.actualBoxes}/{item.plannedBoxes}
                  </td>
                  <td className={`px-6 py-4 whitespace-nowrap text-sm text-center font-medium ${
                    item.boxVariance > 0 ? 'text-red-600' : item.boxVariance < 0 ? 'text-green-600' : 'text-gray-900'
                  }`}>
                    {item.boxVariance > 0 ? '+' : ''}{item.boxVariance}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-900">
                    {item.actualPallets}/{item.plannedPallets}
                  </td>
                  <td className={`px-6 py-4 whitespace-nowrap text-sm text-center font-medium ${
                    item.palletVariance > 0 ? 'text-red-600' : item.palletVariance < 0 ? 'text-green-600' : 'text-gray-900'
                  }`}>
                    {item.palletVariance > 0 ? '+' : ''}{item.palletVariance}
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
          <li>• Overall production: <strong>{((totalProduced / totalPlanned) * 100).toFixed(1)}%</strong> of planned output</li>
          {onTargetProduction === data.length && (
            <li>• ✓ All jobs are within target production range (95-105%)</li>
          )}
          {underProduction > 0 && (
            <li>• {underProduction} job{underProduction > 1 ? 's' : ''} under-producing - investigate bottlenecks or quality issues</li>
          )}
          {overProduction > 0 && (
            <li>• {overProduction} job{overProduction > 1 ? 's' : ''} over-producing - verify planning accuracy</li>
          )}
          <li>• Box variance: {totalActualBoxes - totalPlannedBoxes >= 0 ? '+' : ''}{(totalActualBoxes - totalPlannedBoxes).toLocaleString()} boxes</li>
          <li>• Pallet variance: {totalActualPallets - totalPlannedPallets >= 0 ? '+' : ''}{(totalActualPallets - totalPlannedPallets).toLocaleString()} pallets</li>
        </ul>
      </div>
    </div>
  )
}

