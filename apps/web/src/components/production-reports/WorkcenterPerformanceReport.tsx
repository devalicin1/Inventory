import type { FC } from 'react'
import type { WorkcenterPerformanceData } from './utils'

interface WorkcenterPerformanceReportProps {
  data: WorkcenterPerformanceData[]
}

export const WorkcenterPerformanceReport: FC<WorkcenterPerformanceReportProps> = ({ data }) => {
  if (data.length === 0) {
    return (
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Workcenter Performance</h3>
        <p className="text-gray-500">No workcenter performance data available.</p>
      </div>
    )
  }
  
  const totalJobs = data.reduce((sum, item) => sum + item.jobs, 0)
  const totalGood = data.reduce((sum, item) => sum + item.totalGood, 0)
  const totalScrap = data.reduce((sum, item) => sum + item.totalScrap, 0)
  const avgEfficiency = data.reduce((sum, item) => sum + item.efficiency, 0) / data.length
  const topPerformers = data.filter(item => item.efficiency >= 95).length
  const needsImprovement = data.filter(item => item.efficiency < 85).length
  
  // Sort by efficiency
  const sortedData = [...data].sort((a, b) => b.efficiency - a.efficiency)
  
  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Workcenter Performance</h3>
      
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
          <div className="text-2xl font-bold text-blue-900">{avgEfficiency.toFixed(1)}%</div>
          <div className="text-sm text-blue-700">Average Efficiency</div>
          <div className="text-xs text-blue-600 mt-1">
            Across {data.length} workcenter{data.length > 1 ? 's' : ''}
          </div>
        </div>
        <div className="bg-green-50 rounded-lg p-4 border border-green-200">
          <div className="text-2xl font-bold text-green-900">{topPerformers}</div>
          <div className="text-sm text-green-700">Top Performers (≥95%)</div>
          <div className="text-xs text-green-600 mt-1">
            {data.length > 0 && `${((topPerformers / data.length) * 100).toFixed(0)}% of workcenters`}
          </div>
        </div>
        <div className="bg-red-50 rounded-lg p-4 border border-red-200">
          <div className="text-2xl font-bold text-red-900">{needsImprovement}</div>
          <div className="text-sm text-red-700">Needs Improvement (&lt;85%)</div>
          <div className="text-xs text-red-600 mt-1">
            {needsImprovement > 0 && 'Review processes'}
          </div>
        </div>
        <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
          <div className="text-2xl font-bold text-purple-900">{totalJobs}</div>
          <div className="text-sm text-purple-700">Total Jobs</div>
          <div className="text-xs text-purple-600 mt-1">
            {totalGood.toLocaleString()} good, {totalScrap.toLocaleString()} scrap
          </div>
        </div>
      </div>
      
      {/* Performance Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rank</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Workcenter</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Jobs</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Good Units</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Scrap Units</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Efficiency</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sortedData.map((item, index) => {
              const isTopPerformer = item.efficiency >= 95
              const needsImprovement = item.efficiency < 85
              
              return (
                <tr 
                  key={item.workcenterId}
                  className={isTopPerformer ? 'bg-green-50' : needsImprovement ? 'bg-red-50' : ''}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`text-sm font-bold ${
                      index === 0 ? 'text-yellow-600' :
                      index === 1 ? 'text-gray-500' :
                      index === 2 ? 'text-orange-600' :
                      'text-gray-400'
                    }`}>
                      #{index + 1}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{item.workcenterName}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">{item.jobs}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-green-600 font-medium">
                    {item.totalGood.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-red-600 font-medium">
                    {item.totalScrap.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                    <div className="flex items-center justify-end space-x-2">
                      <div className="w-24 bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${
                            item.efficiency >= 95 ? 'bg-green-500' :
                            item.efficiency >= 85 ? 'bg-yellow-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${Math.min(item.efficiency, 100)}%` }}
                        />
                      </div>
                      <span className={`text-sm font-semibold w-12 ${
                        item.efficiency >= 95 ? 'text-green-600' :
                        item.efficiency >= 85 ? 'text-yellow-600' : 'text-red-600'
                      }`}>
                        {item.efficiency.toFixed(1)}%
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    {isTopPerformer && (
                      <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                        Top Performer
                      </span>
                    )}
                    {needsImprovement && (
                      <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded-full">
                        Needs Improvement
                      </span>
                    )}
                    {!isTopPerformer && !needsImprovement && (
                      <span className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full">
                        Good
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
        <h4 className="text-sm font-semibold text-blue-900 mb-2">Performance Insights</h4>
        <ul className="space-y-1 text-sm text-blue-800">
          <li>• Average efficiency: <strong>{avgEfficiency.toFixed(1)}%</strong> across all workcenters</li>
          {topPerformers > 0 && (
            <li>• {topPerformers} workcenter{topPerformers > 1 ? 's' : ''} achieving ≥95% efficiency - excellent performance</li>
          )}
          {needsImprovement > 0 && (
            <li>• {needsImprovement} workcenter{needsImprovement > 1 ? 's' : ''} below 85% efficiency - review processes and training</li>
          )}
          {sortedData.length > 0 && (
            <li>• Best performer: <strong>{sortedData[0].workcenterName}</strong> at {sortedData[0].efficiency.toFixed(1)}% efficiency</li>
          )}
        </ul>
      </div>
    </div>
  )
}

