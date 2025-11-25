import type { FC } from 'react'
import type { QualityMetricsData } from './utils'

interface QualityReportProps {
  data: QualityMetricsData
}

export const QualityReport: FC<QualityReportProps> = ({ data }) => {
  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Quality Metrics</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-green-50 rounded-lg p-4">
          <div className="text-2xl font-bold text-green-900">{data.totalGood.toLocaleString()}</div>
          <div className="text-sm text-green-700">Total Good Units</div>
        </div>
        <div className="bg-red-50 rounded-lg p-4">
          <div className="text-2xl font-bold text-red-900">{data.totalScrap.toLocaleString()}</div>
          <div className="text-sm text-red-700">Total Scrap Units</div>
        </div>
        <div className={`rounded-lg p-4 ${data.scrapRate < 5 ? 'bg-green-50' : data.scrapRate < 10 ? 'bg-yellow-50' : 'bg-red-50'}`}>
          <div className={`text-2xl font-bold ${data.scrapRate < 5 ? 'text-green-900' : data.scrapRate < 10 ? 'text-yellow-900' : 'text-red-900'}`}>
            {data.scrapRate.toFixed(2)}%
          </div>
          <div className={`text-sm ${data.scrapRate < 5 ? 'text-green-700' : data.scrapRate < 10 ? 'text-yellow-700' : 'text-red-700'}`}>
            Overall Scrap Rate
          </div>
        </div>
      </div>
      {/* Top Scrap Jobs */}
      <div className="mb-6">
        <h4 className="text-sm font-semibold text-gray-700 mb-3">Top Scrap Jobs (Highest Scrap Rate)</h4>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Job Code</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Good</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Scrap</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Scrap Rate</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {data.jobs.slice(0, 20).map((job) => {
                const total = job.good + job.scrap
                const isCritical = job.scrapRate >= 10
                const isWarning = job.scrapRate >= 5 && job.scrapRate < 10
                
                return (
                  <tr 
                    key={job.jobCode}
                    className={isCritical ? 'bg-red-50' : isWarning ? 'bg-yellow-50' : ''}
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{job.jobCode}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-green-600 font-medium">
                      {job.good.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-red-600 font-medium">
                      {job.scrap.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-600">
                      {total.toLocaleString()}
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-semibold ${
                      job.scrapRate < 5 ? 'text-green-600' : job.scrapRate < 10 ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                      {job.scrapRate.toFixed(2)}%
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      {isCritical && (
                        <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded-full">
                          Critical
                        </span>
                      )}
                      {isWarning && (
                        <span className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full">
                          Warning
                        </span>
                      )}
                      {!isCritical && !isWarning && (
                        <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
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
      </div>
      
      {/* Insights */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-blue-900 mb-2">Quality Insights</h4>
        <ul className="space-y-1 text-sm text-blue-800">
          <li>• Overall scrap rate: <strong>{data.scrapRate.toFixed(2)}%</strong> 
            {data.scrapRate < 5 && ' ✓ Excellent quality performance'}
            {data.scrapRate >= 5 && data.scrapRate < 10 && ' ⚠ Within acceptable range'}
            {data.scrapRate >= 10 && ' ⚠ Needs immediate attention'}
          </li>
          {data.jobs.filter(j => j.scrapRate >= 10).length > 0 && (
            <li>• {data.jobs.filter(j => j.scrapRate >= 10).length} job{data.jobs.filter(j => j.scrapRate >= 10).length > 1 ? 's' : ''} with scrap rate ≥10% - investigate root causes</li>
          )}
          <li>• Total good units: <strong>{data.totalGood.toLocaleString()}</strong> | Total scrap: <strong>{data.totalScrap.toLocaleString()}</strong></li>
          {data.jobs.length > 0 && (
            <li>• {((data.jobs.filter(j => j.scrapRate < 5).length / data.jobs.length) * 100).toFixed(0)}% of jobs have scrap rate &lt;5%</li>
          )}
        </ul>
      </div>
    </div>
  )
}

