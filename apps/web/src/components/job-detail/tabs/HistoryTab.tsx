import { useState, type FC } from 'react'
import { CalendarIcon } from '@heroicons/react/24/outline'
import type { HistoryEvent, Workflow } from '../../../api/production-jobs'

interface HistoryTabProps {
  history: HistoryEvent[]
  workflows: Workflow[]
}

export const HistoryTab: FC<HistoryTabProps> = ({ history, workflows }) => {
  const stageName = (id?: string | null) => {
    if (!id) return '-'
    for (const wf of workflows) {
      const s = wf.stages?.find(st => st.id === id)
      if (s) return s.name
    }
    return id
  }
  const [typeFilter, setTypeFilter] = useState<'all' | 'stage_change' | 'status_change'>('all')
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium text-gray-900">History ({history.length})</h3>
      <div className="flex items-center gap-2">
        <label className="text-sm text-gray-600">Filter:</label>
        <select
          className="rounded-md border-gray-300 text-sm"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as any)}
        >
          <option value="all">All</option>
          <option value="stage_change">Stage changes</option>
          <option value="status_change">Status changes</option>
        </select>
      </div>
      <div className="space-y-3">
        {history.filter(e => typeFilter === 'all' || e.type === typeFilter).map((event) => (
          <div key={event.id} className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center space-x-2">
                  <CalendarIcon className="h-4 w-4 text-gray-400" />
                  <span className="text-sm font-medium text-gray-900">{event.type.replace('_', ' ').toUpperCase()}</span>
                </div>
                <p className="text-sm text-gray-600 mt-1">Actor: {event.actorId}</p>
                {event.type === 'stage_change' && (
                  <p className="text-sm text-gray-800 mt-2">
                    Moved from <span className="font-medium">{stageName(event.payload?.previousStageId)}</span>
                    {' '}to{' '}
                    <span className="font-medium">{stageName(event.payload?.newStageId)}</span>
                    {event.payload?.note && (
                      <>
                        {' '}— <span className="text-gray-600">{event.payload.note}</span>
                      </>
                    )}
                  </p>
                )}
                {event.type === 'status_change' && (
                  <p className="text-sm text-gray-800 mt-2">
                    Status changed from <span className="font-medium">{event.payload?.previousStatus || 'unknown'}</span>
                    {' '}to{' '}
                    <span className="font-medium">{event.payload?.newStatus || 'unknown'}</span>
                    {event.payload?.reason && (
                      <>
                        {' '}— <span className="text-gray-600">{event.payload.reason}</span>
                      </>
                    )}
                  </p>
                )}
                {event.type !== 'stage_change' && event.type !== 'status_change' && event.payload && (
                  <div className="mt-2">
                    <pre className="text-xs text-gray-500 bg-gray-50 p-2 rounded">
                      {JSON.stringify(event.payload, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-900">
                  {new Date(event.at.seconds * 1000).toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

