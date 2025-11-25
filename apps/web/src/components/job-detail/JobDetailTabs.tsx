import { type FC, type ReactNode } from 'react'

interface TabDefinition {
  id: string
  name: string
  icon: FC<React.SVGProps<SVGSVGElement>>
  count: number | null
}

interface JobDetailTabsProps {
  tabs: TabDefinition[]
  activeTab: string
  onTabChange: (tabId: string) => void
  content: ReactNode
}

export const JobDetailTabs: FC<JobDetailTabsProps> = ({ tabs, activeTab, onTabChange, content }) => {
  return (
    <>
      <div className="border-b border-gray-200 bg-white">
        <nav className="flex space-x-4 sm:space-x-8 px-4 sm:px-6 overflow-x-auto no-scrollbar">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 whitespace-nowrap transition-colors duration-200 ${
                  isActive
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.name}</span>
                {tab.count !== null && (
                  <span
                    className={`${
                      isActive ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'
                    } inline-flex items-center justify-center px-2 py-1 text-xs rounded-full`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            )
          })}
        </nav>
      </div>

      <div className="flex-1 overflow-y-auto bg-gray-50">
        <div className="p-6">
          {content}
        </div>
      </div>
    </>
  )
}



