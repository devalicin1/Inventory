import type { FC } from 'react'
import type { JobStatusData } from './utils'

interface JobStatusReportProps {
  data: JobStatusData[]
}

export const JobStatusReport: FC<JobStatusReportProps> = ({ data }) => {
  const statusColors: { [key: string]: { bg: string; text: string; border: string } } = {
    'draft': { bg: 'bg-gray-100', text: 'text-gray-800', border: 'border-gray-300' },
    'released': { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-300' },
    'in_progress': { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-300' },
    'blocked': { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-300' },
    'done': { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-300' },
    'cancelled': { bg: 'bg-gray-100', text: 'text-gray-800', border: 'border-gray-300' }
  }
  
  const statusIcons: { [key: string]: string } = {
    'draft': '📝',
    'released': '🚀',
    'in_progress': '⚙️',
    'blocked': '🚫',
    'done': '✅',
    'cancelled': '❌'
  }
  
  const total = data.reduce((sum, item) => sum + item.count, 0)
  const activeJobs = data.filter(item => !['done', 'cancelled'].includes(item.status))
    .reduce((sum, item) => sum + item.count, 0)
  const completedJobs = data.find(item => item.status === 'done')?.count || 0
  const blockedJobs = data.find(item => item.status === 'blocked')?.count || 0
  
  // Sort by count (descending)
  const sortedData = [...data].sort((a, b) => b.count - a.count)
  
  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Job Status Summary</h3>
      
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
          <div className="text-2xl font-bold text-blue-900">{total}</div>
          <div className="text-sm text-blue-700">Total Jobs</div>
          <div className="text-xs text-blue-600 mt-1">
            All statuses combined
          </div>
        </div>
        <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
          <div className="text-2xl font-bold text-yellow-900">{activeJobs}</div>
          <div className="text-sm text-yellow-700">Active Jobs</div>
          <div className="text-xs text-yellow-600 mt-1">
            In production pipeline
          </div>
        </div>
        <div className="bg-green-50 rounded-lg p-4 border border-green-200">
          <div className="text-2xl font-bold text-green-900">{completedJobs}</div>
          <div className="text-sm text-green-700">Completed</div>
          <div className="text-xs text-green-600 mt-1">
            {total > 0 && `${((completedJobs / total) * 100).toFixed(1)}% completion rate`}
          </div>
        </div>
        <div className="bg-red-50 rounded-lg p-4 border border-red-200">
          <div className="text-2xl font-bold text-red-900">{blockedJobs}</div>
          <div className="text-sm text-red-700">Blocked</div>
          <div className="text-xs text-red-600 mt-1">
            {blockedJobs > 0 && 'Requires attention'}
          </div>
        </div>
      </div>
      
      {/* Status Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {sortedData.map((item) => {
          const colors = statusColors[item.status] || statusColors['draft']
          const icon = statusIcons[item.status] || '📋'
          
          return (
            <div 
              key={item.status} 
              className={`bg-white border-2 ${colors.border} rounded-lg p-4 hover:shadow-md transition-shadow`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2">
                  <span className="text-xl">{icon}</span>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors.bg} ${colors.text}`}>
                    {item.status.replace('_', ' ').toUpperCase()}
                  </span>
                </div>
                <span className="text-2xl font-bold text-gray-900">{item.count}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
                <div
                  className={`h-3 rounded-full ${colors.bg.replace('100', '500')}`}
                  style={{ width: `${item.percentage}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500">{item.percentage.toFixed(1)}% of total</span>
                {item.status === 'done' && total > 0 && (
                  <span className="text-green-600 font-medium">
                    {((item.count / total) * 100).toFixed(0)}% completion
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
      
      {/* Insights */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-blue-900 mb-2">Status Insights</h4>
        <ul className="space-y-1 text-sm text-blue-800">
          <li>• Total jobs: <strong>{total}</strong> across {data.length} status{data.length > 1 ? 'es' : ''}</li>
          <li>• Active jobs: <strong>{activeJobs}</strong> ({((activeJobs / total) * 100).toFixed(1)}% of total) in production pipeline</li>
          {completedJobs > 0 && (
            <li>• Completion rate: <strong>{((completedJobs / total) * 100).toFixed(1)}%</strong> ({completedJobs} completed)</li>
          )}
          {blockedJobs > 0 && (
            <li>• ⚠ {blockedJobs} job{blockedJobs > 1 ? 's' : ''} blocked - requires immediate attention</li>
          )}
          {sortedData.length > 0 && (
            <li>• Most common status: <strong>{sortedData[0].status.replace('_', ' ')}</strong> with {sortedData[0].count} job{sortedData[0].count > 1 ? 's' : ''}</li>
          )}
        </ul>
      </div>
    </div>
  )
}

