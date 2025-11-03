import { useState } from 'react'
import { useSessionStore } from '../state/sessionStore'
import { 
  CubeIcon,
  ClockIcon,
  ArrowPathIcon,
  ArrowTrendingUpIcon,
  DocumentTextIcon,
  CheckCircleIcon,
  CurrencyDollarIcon,
  ArrowUturnLeftIcon
} from '@heroicons/react/24/outline'
import { StockOnHand } from '../components/reports/StockOnHand'
import { InventoryAging } from '../components/reports/InventoryAging'
import { Replenishment } from '../components/reports/Replenishment'
import { SkuVelocity } from '../components/reports/SkuVelocity'
import { InventoryLedger } from '../components/reports/InventoryLedger'
import { CycleCountAccuracy } from '../components/reports/CycleCountAccuracy'
import { CogsGrossProfit } from '../components/reports/CogsGrossProfit'
import { Returns } from '../components/reports/Returns'

const reportTabs = [
  { id: 'stock-on-hand', name: 'Stock On-Hand', icon: CubeIcon, description: 'Current inventory levels and reorder points' },
  { id: 'aging', name: 'Inventory Aging', icon: ClockIcon, description: 'Stock age analysis and dead stock identification' },
  { id: 'replenishment', name: 'Replenishment', icon: ArrowPathIcon, description: 'Purchase suggestions and safety stock calculations' },
  { id: 'velocity-abc', name: 'SKU Velocity & ABC', icon: ArrowTrendingUpIcon, description: 'Sales velocity and ABC classification analysis' },
  { id: 'ledger', name: 'Inventory Ledger', icon: DocumentTextIcon, description: 'Complete transaction history and running balances' },
  { id: 'cycle-count', name: 'Cycle Count', icon: CheckCircleIcon, description: 'Stock accuracy and variance analysis' },
  { id: 'cogs-gp', name: 'COGS & Gross Profit', icon: CurrencyDollarIcon, description: 'Cost analysis and profitability by SKU' },
  { id: 'returns', name: 'Returns & Credits', icon: ArrowUturnLeftIcon, description: 'Return analysis and credit note tracking' }
]

export function Reports() {
  const { workspaceId } = useSessionStore()
  const [activeTab, setActiveTab] = useState('stock-on-hand')

  if (!workspaceId) {
    return (
      <div className="p-4">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-gray-200 pb-4">
        <h1 className="text-2xl font-bold text-gray-900">Inventory Reports</h1>
        <p className="mt-1 text-sm text-gray-500">
          Comprehensive inventory analysis and reporting tools
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8 overflow-x-auto">
          {reportTabs.map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.name}</span>
              </button>
            )
          })}
        </nav>
      </div>

      {/* Report Content */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-6">
          {/* Report Description */}
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-900">
              {reportTabs.find(tab => tab.id === activeTab)?.name}
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {reportTabs.find(tab => tab.id === activeTab)?.description}
            </p>
          </div>

          {/* Report Content */}
          {activeTab === 'stock-on-hand' && (
            <StockOnHand workspaceId={workspaceId} />
          )}
          {activeTab === 'aging' && (
            <InventoryAging workspaceId={workspaceId} />
          )}
          {activeTab === 'replenishment' && (
            <Replenishment workspaceId={workspaceId} />
          )}
          {activeTab === 'velocity-abc' && (
            <SkuVelocity workspaceId={workspaceId} />
          )}
          {activeTab === 'ledger' && (
            <InventoryLedger workspaceId={workspaceId} />
          )}
          {activeTab === 'cycle-count' && (
            <CycleCountAccuracy workspaceId={workspaceId} />
          )}
          {activeTab === 'cogs-gp' && (
            <CogsGrossProfit workspaceId={workspaceId} />
          )}
          {activeTab === 'returns' && (
            <Returns workspaceId={workspaceId} />
          )}
        </div>
      </div>
    </div>
  )
}
