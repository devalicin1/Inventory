import type { FC } from 'react'
import type { EfficiencyData } from './utils'
import { ChartBarIcon, TrophyIcon } from '@heroicons/react/24/outline'

interface EfficiencyReportProps {
  data: EfficiencyData
}

export const EfficiencyReport: FC<EfficiencyReportProps> = ({ data }) => {
  const getScoreRating = (score: number) => {
    if (score >= 90) return { label: 'Excellent', color: 'green', icon: TrophyIcon }
    if (score >= 75) return { label: 'Good', color: 'blue', icon: ChartBarIcon }
    if (score >= 60) return { label: 'Fair', color: 'yellow', icon: ChartBarIcon }
    return { label: 'Needs Improvement', color: 'red', icon: ChartBarIcon }
  }
  
  const rating = getScoreRating(data.overallScore)
  const RatingIcon = rating.icon
  
  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Production Efficiency Analysis</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm text-blue-700">Production Efficiency</div>
            <div className={`h-3 w-3 rounded-full ${
              data.efficiency >= 95 ? 'bg-green-500' :
              data.efficiency >= 85 ? 'bg-yellow-500' : 'bg-red-500'
            }`} />
          </div>
          <div className="text-2xl font-bold text-blue-900">{data.efficiency.toFixed(1)}%</div>
          <div className="text-xs text-blue-600 mt-1">
            {data.totalProduced.toLocaleString()} / {data.totalPlanned.toLocaleString()} units
          </div>
          <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full ${
                data.efficiency >= 95 ? 'bg-green-500' :
                data.efficiency >= 85 ? 'bg-yellow-500' : 'bg-red-500'
              }`}
              style={{ width: `${Math.min(data.efficiency, 100)}%` }}
            />
          </div>
        </div>
        <div className="bg-green-50 rounded-lg p-4 border border-green-200">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm text-green-700">On-Time Delivery Rate</div>
            <div className={`h-3 w-3 rounded-full ${
              data.onTimeRate >= 95 ? 'bg-green-500' :
              data.onTimeRate >= 85 ? 'bg-yellow-500' : 'bg-red-500'
            }`} />
          </div>
          <div className="text-2xl font-bold text-green-900">{data.onTimeRate.toFixed(1)}%</div>
          <div className="text-xs text-green-600 mt-1">
            Target: 95%+
          </div>
          <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full ${
                data.onTimeRate >= 95 ? 'bg-green-500' :
                data.onTimeRate >= 85 ? 'bg-yellow-500' : 'bg-red-500'
              }`}
              style={{ width: `${Math.min(data.onTimeRate, 100)}%` }}
            />
          </div>
        </div>
        <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm text-purple-700">Avg Cycle Time</div>
            <div className={`h-3 w-3 rounded-full ${
              data.avgCycleTime <= 5 ? 'bg-green-500' :
              data.avgCycleTime <= 10 ? 'bg-yellow-500' : 'bg-red-500'
            }`} />
          </div>
          <div className="text-2xl font-bold text-purple-900">{data.avgCycleTime.toFixed(1)}</div>
          <div className="text-xs text-purple-600 mt-1">
            days per job
          </div>
          <div className="mt-2 text-xs text-purple-600">
            {data.avgCycleTime <= 5 ? '✓ Excellent' : data.avgCycleTime <= 10 ? 'Good' : 'Needs improvement'}
          </div>
        </div>
      </div>
      
      {/* Overall Score */}
      <div className={`mb-6 rounded-lg p-6 border-2 ${
        rating.color === 'green' ? 'bg-green-50 border-green-300' :
        rating.color === 'blue' ? 'bg-blue-50 border-blue-300' :
        rating.color === 'yellow' ? 'bg-yellow-50 border-yellow-300' :
        'bg-red-50 border-red-300'
      }`}>
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center space-x-2 mb-2">
              <RatingIcon className={`h-6 w-6 ${
                rating.color === 'green' ? 'text-green-600' :
                rating.color === 'blue' ? 'text-blue-600' :
                rating.color === 'yellow' ? 'text-yellow-600' :
                'text-red-600'
              }`} />
              <div className="text-sm font-medium text-gray-700">Overall Performance Rating</div>
            </div>
            <div className={`text-3xl font-bold ${
              rating.color === 'green' ? 'text-green-900' :
              rating.color === 'blue' ? 'text-blue-900' :
              rating.color === 'yellow' ? 'text-yellow-900' :
              'text-red-900'
            }`}>
              {rating.label}
            </div>
          </div>
          <div className="text-right">
            <div className="text-5xl font-bold text-gray-900">{data.overallScore.toFixed(1)}</div>
            <div className="text-sm text-gray-600">Performance Score</div>
            <div className="mt-3 w-48 bg-gray-200 rounded-full h-3">
              <div
                className={`h-3 rounded-full ${
                  rating.color === 'green' ? 'bg-green-500' :
                  rating.color === 'blue' ? 'bg-blue-500' :
                  rating.color === 'yellow' ? 'bg-yellow-500' :
                  'bg-red-500'
                }`}
                style={{ width: `${Math.min(data.overallScore, 100)}%` }}
              />
            </div>
          </div>
        </div>
      </div>
      
      {/* Score Breakdown */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-gray-700 mb-3">Score Components</h4>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Production Efficiency (40%)</span>
            <span className="text-sm font-medium text-gray-900">{(data.efficiency * 0.4).toFixed(1)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">On-Time Delivery (40%)</span>
            <span className="text-sm font-medium text-gray-900">{((data.onTimeRate / 100) * 40).toFixed(1)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Cycle Time (20%)</span>
            <span className="text-sm font-medium text-gray-900">
              {(data.avgCycleTime > 0 ? Math.max(0, 100 - (data.avgCycleTime / 10) * 20) * 0.2 : 0).toFixed(1)}
            </span>
          </div>
          <div className="border-t border-gray-300 pt-2 flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-900">Total Score</span>
            <span className="text-lg font-bold text-gray-900">{data.overallScore.toFixed(1)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

