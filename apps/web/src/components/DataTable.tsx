import { type ReactNode } from 'react'

interface Column<T> {
  key: keyof T
  label: string
  render?: (value: any, item: T) => ReactNode
  className?: string
}

interface DataTableProps<T> {
  data: T[]
  columns: Column<T>[]
  onRowClick?: (item: T) => void
  className?: string
  renderActions?: (item: T) => ReactNode
  // Selection
  selectable?: boolean
  getId?: (item: T) => string
  selectedIds?: string[]
  onToggleSelect?: (id: string, item: T, checked: boolean) => void
  onToggleSelectAll?: (checked: boolean) => void
}

export function DataTable<T extends Record<string, any>>({ 
  data, 
  columns, 
  onRowClick,
  className = '',
  renderActions,
  selectable = false,
  getId,
  selectedIds = [],
  onToggleSelect,
  onToggleSelectAll,
}: DataTableProps<T>) {
  return (
    <div className={`overflow-hidden rounded-[14px] ${className}`}>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gradient-to-r from-gray-50 to-slate-50 border-b border-gray-200">
            <tr>
              {selectable && (
                <th className="w-12 px-4 h-11">
                  <input
                    type="checkbox"
                    aria-label="Select all"
                    checked={data.length > 0 && selectedIds.length === data.length}
                    onChange={(e) => onToggleSelectAll?.(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500 focus:ring-offset-0 cursor-pointer"
                  />
                </th>
              )}
              {columns.map((column) => (
                <th
                  key={String(column.key)}
                  scope="col"
                  className={`px-4 h-11 text-left text-xs font-bold text-gray-700 uppercase tracking-wider ${column.className || ''}`}
                >
                  {column.label}
                </th>
              ))}
              <th scope="col" className="w-auto px-4 h-11 text-right">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {data.map((item, index) => {
              const isSelected = selectable && selectedIds.includes(getId ? getId(item) : String(index))
              return (
                <tr
                  key={index}
                  className={`transition-all duration-150 ${
                    isSelected 
                      ? 'bg-blue-50 hover:bg-blue-100' 
                      : 'hover:bg-gray-50'
                  } ${onRowClick ? 'cursor-pointer' : ''}`}
                >
                  {selectable && (
                    <td className="px-4 py-4 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => onToggleSelect?.(getId ? getId(item) : String(index), item, e.target.checked)}
                        onClick={(e) => e.stopPropagation()}
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500 focus:ring-offset-0 cursor-pointer"
                      />
                    </td>
                  )}
                  {columns.map((column) => (
                    <td
                      key={String(column.key)}
                      className={`px-4 py-4 text-sm text-gray-900 ${column.className || ''}`}
                      onClick={() => onRowClick?.(item)}
                    >
                      {column.render 
                        ? column.render(item[column.key], item)
                        : (item[column.key] != null && item[column.key] !== '' ? String(item[column.key]) : <span className="text-gray-400">—</span>)
                      }
                    </td>
                  ))}
                  <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium">
                    {renderActions ? (
                      <div onClick={(e) => e.stopPropagation()}>
                        {renderActions(item)}
                      </div>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onRowClick?.(item)
                        }}
                        className="text-blue-600 hover:text-blue-900 font-medium transition-colors"
                      >
                        View
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {data.length === 0 && (
        <div className="text-center py-16 bg-white">
          <div className="mx-auto h-16 w-16 text-gray-300 mb-4">
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" className="h-16 w-16">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
          </div>
          <h3 className="mt-2 text-base font-semibold text-gray-900">No products found</h3>
          <p className="mt-1 text-sm text-gray-500">Get started by creating a new product.</p>
        </div>
      )}
    </div>
  )
}
