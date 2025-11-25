import type { FC } from 'react'
import type { DeadlinesAcceptanceData } from './utils'

interface DeadlinesReportProps {
  data: DeadlinesAcceptanceData
}

export const DeadlinesReport: FC<DeadlinesReportProps> = ({ data }) => {
  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Deadlines & Acceptance Tracking</h3>
      
      {/* Acceptance Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-blue-50 rounded-lg p-4">
          <div className="text-2xl font-bold text-blue-900">{data.acceptanceStats.totalJobs}</div>
          <div className="text-sm text-blue-700">Total Jobs</div>
        </div>
        <div className="bg-green-50 rounded-lg p-4">
          <div className="text-2xl font-bold text-green-900">{data.acceptanceStats.qaAccepted}</div>
          <div className="text-sm text-green-700">QA Accepted</div>
        </div>
        <div className="bg-purple-50 rounded-lg p-4">
          <div className="text-2xl font-bold text-purple-900">{data.acceptanceStats.customerAccepted}</div>
          <div className="text-sm text-purple-700">Customer Accepted</div>
        </div>
        <div className="bg-yellow-50 rounded-lg p-4">
          <div className="text-2xl font-bold text-yellow-900">{data.acceptanceStats.qaAcceptanceRate.toFixed(1)}%</div>
          <div className="text-sm text-yellow-700">QA Acceptance Rate</div>
        </div>
      </div>

      {/* Upcoming Deadlines */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-md font-semibold text-gray-900">Upcoming Deadlines</h4>
          <span className="text-xs text-gray-500">
            Showing {Math.min(data.upcomingDeadlines.length, 10)} of {data.upcomingDeadlines.length}
          </span>
        </div>
        
        {/* Priority Groups */}
        {data.upcomingDeadlines.length > 0 && (
          <div className="mb-4 grid grid-cols-3 gap-3">
            <div className="bg-red-50 border border-red-200 rounded-lg p-2">
              <div className="text-lg font-bold text-red-900">
                {data.upcomingDeadlines.filter(d => d.daysUntilDue < 0).length}
              </div>
              <div className="text-xs text-red-700">Overdue</div>
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-2">
              <div className="text-lg font-bold text-yellow-900">
                {data.upcomingDeadlines.filter(d => d.daysUntilDue >= 0 && d.daysUntilDue <= 3).length}
              </div>
              <div className="text-xs text-yellow-700">Due in 0-3 days</div>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-lg p-2">
              <div className="text-lg font-bold text-green-900">
                {data.upcomingDeadlines.filter(d => d.daysUntilDue > 3).length}
              </div>
              <div className="text-xs text-green-700">Due in 4+ days</div>
            </div>
          </div>
        )}
        
        <div className="space-y-2">
          {data.upcomingDeadlines.slice(0, 15).map((deadline) => {
            const isOverdue = deadline.daysUntilDue < 0
            const isUrgent = deadline.daysUntilDue >= 0 && deadline.daysUntilDue <= 3
            const isNormal = deadline.daysUntilDue > 3
            
            return (
              <div 
                key={deadline.jobCode} 
                className={`flex items-center justify-between py-3 px-4 rounded-lg border ${
                  isOverdue ? 'border-red-300 bg-red-50' :
                  isUrgent ? 'border-yellow-300 bg-yellow-50' :
                  'border-gray-200 bg-white'
                }`}
              >
                <div className="flex items-center space-x-3 flex-1">
                  <div className={`w-2 h-2 rounded-full ${
                    isOverdue ? 'bg-red-500' :
                    isUrgent ? 'bg-yellow-500' :
                    'bg-green-500'
                  }`} />
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-medium text-gray-900">{deadline.jobCode}</span>
                      <span className="text-sm text-gray-600">{deadline.productName}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        isOverdue ? 'bg-red-100 text-red-800' :
                        isUrgent ? 'bg-yellow-100 text-yellow-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {isOverdue ? `Overdue ${Math.abs(deadline.daysUntilDue)} days` : 
                         isUrgent ? `${deadline.daysUntilDue} days` :
                         `${deadline.daysUntilDue} days`}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      Due: {deadline.dueDate.toLocaleDateString()} • Status: {deadline.status.replace('_', ' ')}
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {deadline.qaAccepted && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      QA ✓
                    </span>
                  )}
                  {deadline.customerAccepted && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      Customer ✓
                    </span>
                  )}
                  {!deadline.qaAccepted && !deadline.customerAccepted && (
                    <span className="text-xs text-gray-400">Pending</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
        
        {data.upcomingDeadlines.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No upcoming deadlines in the selected date range.
          </div>
        )}
      </div>
    </div>
  )
}

