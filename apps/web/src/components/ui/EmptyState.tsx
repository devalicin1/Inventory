import { ReactNode } from 'react'
import {
  CubeIcon,
  DocumentTextIcon,
  ChartBarIcon,
  CogIcon,
  InboxIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline'

interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description: string
  action?: {
    label: string
    onClick: () => void
  }
  secondaryAction?: {
    label: string
    onClick: () => void
  }
}

const defaultIcons = {
  inventory: CubeIcon,
  products: CubeIcon,
  orders: DocumentTextIcon,
  reports: ChartBarIcon,
  jobs: CogIcon,
  tasks: InboxIcon,
  search: MagnifyingGlassIcon,
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  secondaryAction,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
        {icon || <InboxIcon className="h-8 w-8 text-gray-400" />}
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-sm text-gray-500 max-w-sm mb-6">{description}</p>
      {action && (
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={action.onClick}
            className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all"
          >
            {action.label}
          </button>
          {secondaryAction && (
            <button
              onClick={secondaryAction.onClick}
              className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all"
            >
              {secondaryAction.label}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// Pre-built empty states
export function EmptyInventory({ onCreate, onImport }: { onCreate?: () => void; onImport?: () => void }) {
  return (
    <EmptyState
      icon={<CubeIcon className="h-8 w-8 text-gray-400" />}
      title="No products yet"
      description="Get started by adding your first product to track inventory levels and manage stock."
      action={onCreate ? { label: 'Add First Product', onClick: onCreate } : undefined}
      secondaryAction={onImport ? { label: 'Import from CSV', onClick: onImport } : undefined}
    />
  )
}

export function EmptyProducts({ onCreate }: { onCreate?: () => void }) {
  return (
    <EmptyState
      icon={<CubeIcon className="h-8 w-8 text-gray-400" />}
      title="No products found"
      description="Try adjusting your search or filters, or create a new product."
      action={onCreate ? { label: 'Create Product', onClick: onCreate } : undefined}
    />
  )
}

export function EmptyOrders({ onCreate }: { onCreate?: () => void }) {
  return (
    <EmptyState
      icon={<DocumentTextIcon className="h-8 w-8 text-gray-400" />}
      title="No purchase orders"
      description="Create your first purchase order to start managing vendor relationships and procurement."
      action={onCreate ? { label: 'Create Purchase Order', onClick: onCreate } : undefined}
    />
  )
}

export function EmptyJobs({ onCreate }: { onCreate?: () => void }) {
  return (
    <EmptyState
      icon={<CogIcon className="h-8 w-8 text-gray-400" />}
      title="No production jobs"
      description="Create your first production job to start tracking manufacturing processes."
      action={onCreate ? { label: 'Create Job', onClick: onCreate } : undefined}
    />
  )
}

export function EmptySearch({ query }: { query: string }) {
  return (
    <EmptyState
      icon={<MagnifyingGlassIcon className="h-8 w-8 text-gray-400" />}
      title="No results found"
      description={`No items match "${query}". Try different search terms or clear your filters.`}
    />
  )
}
