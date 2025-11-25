import type { FC } from 'react'
import type { StageOutputData } from './utils'

interface StageOutputReportProps {
  data: StageOutputData[]
}

export const StageOutputReport: FC<StageOutputReportProps> = ({ data }) => {
  if (data.length === 0) {
    return (
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Stage Output Report</h3>
        <p className="text-gray-500">No production outputs found for the selected date range.</p>
      </div>
    )
  }

  // Group by job for summary
  const jobSummary: { [jobCode: string]: { totalGood: number; totalScrap: number; stages: string[] } } = {}
  data.forEach(item => {
    if (!jobSummary[item.jobCode]) {
      jobSummary[item.jobCode] = { totalGood: 0, totalScrap: 0, stages: [] }
    }
    jobSummary[item.jobCode].totalGood += item.qtyGood
    jobSummary[item.jobCode].totalScrap += item.qtyScrap
    if (!jobSummary[item.jobCode].stages.includes(item.stageName)) {
      jobSummary[item.jobCode].stages.push(item.stageName)
    }
  })

  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Stage Output Report</h3>
      <p className="text-sm text-gray-600 mb-6">
        Showing {data.length} output entries across {Object.keys(jobSummary).length} jobs
      </p>

      {/* Summary */}
      <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-blue-50 rounded-lg p-4">
          <div className="text-2xl font-bold text-blue-900">{Object.keys(jobSummary).length}</div>
          <div className="text-sm text-blue-700">Jobs with Output</div>
        </div>
        <div className="bg-green-50 rounded-lg p-4">
          <div className="text-2xl font-bold text-green-900">
            {data.reduce((sum, item) => sum + item.qtyGood, 0).toLocaleString()}
          </div>
          <div className="text-sm text-green-700">Total Good Quantity</div>
        </div>
        <div className="bg-red-50 rounded-lg p-4">
          <div className="text-2xl font-bold text-red-900">
            {data.reduce((sum, item) => sum + item.qtyScrap, 0).toLocaleString()}
          </div>
          <div className="text-sm text-red-700">Total Scrap</div>
        </div>
      </div>

      {/* Detailed Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Job Code</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stage</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Workcenter</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Qty Good</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Qty Scrap</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Lot</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Operator</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Notes</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {data.map((item, idx) => (
              <tr key={idx} className="hover:bg-gray-50">
                <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">{item.jobCode}</td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{item.productName}</td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{item.stageName}</td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{item.workcenterName}</td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-medium text-green-600">{item.qtyGood.toLocaleString()}</td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-red-600">
                  {item.qtyScrap > 0 ? item.qtyScrap.toLocaleString() : '-'}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{item.lot || '-'}</td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                  {new Date(item.date).toLocaleDateString()}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{item.operatorId || '-'}</td>
                <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate" title={item.notes}>
                  {item.notes || '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

