import { type FC } from 'react'
import { PlusIcon, ArchiveBoxIcon } from '@heroicons/react/24/outline'
import type { Ticket } from '../../../api/production-jobs'

interface TicketsTabProps {
  tickets: Ticket[]
  isLoading: boolean
  onCreateTicket: () => void
}

export const TicketsTab: FC<TicketsTabProps> = ({
  tickets,
  isLoading,
  onCreateTicket
}) => {
  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Tickets</h3>
          <p className="text-sm text-gray-600 mt-1">Manage production tickets and issues</p>
        </div>
        <button
          onClick={onCreateTicket}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
        >
          <PlusIcon className="h-4 w-4 mr-2" />
          New Ticket
        </button>
      </div>

      {tickets.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200 shadow-sm">
          <ArchiveBoxIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No tickets</h3>
          <p className="mt-1 text-sm text-gray-500">Get started by creating a new ticket.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Assignees</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Due Date</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {tickets.map((ticket) => (
                  <tr key={ticket.id} className="hover:bg-gray-50 transition-colors duration-150">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{ticket.title}</div>
                        {ticket.description && (
                          <div className="text-sm text-gray-500 truncate max-w-xs">{ticket.description}</div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`${ticket.status === 'open' ? 'bg-gray-100 text-gray-800' :
                        ticket.status === 'in_progress' ? 'bg-amber-100 text-amber-800' :
                          ticket.status === 'done' ? 'bg-green-100 text-green-800' :
                            'bg-red-100 text-red-800'
                        } inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium`}>
                        {ticket.status.replace('_', ' ').toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {ticket.assignees.length} assignees
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {ticket.dueDate ? new Date(ticket.dueDate).toLocaleDateString() : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

