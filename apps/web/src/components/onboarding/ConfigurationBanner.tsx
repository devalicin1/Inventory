import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useSessionStore } from '../../state/sessionStore'
import { getWorkspaceConfigurationStatus } from '../../api/onboarding'
import { 
  ExclamationTriangleIcon, 
  CheckCircleIcon,
  XMarkIcon,
  CogIcon,
  ArrowRightIcon
} from '@heroicons/react/24/outline'

interface ConfigurationBannerProps {
  onDismiss?: () => void
  showOnlyCritical?: boolean
  compact?: boolean
}

export function ConfigurationBanner({ 
  onDismiss, 
  showOnlyCritical = false,
  compact = false 
}: ConfigurationBannerProps) {
  const { workspaceId, roles } = useSessionStore()
  const [dismissed, setDismissed] = useState(false)
  const isOwner = roles.includes('owner')

  const { data: configStatus, isLoading } = useQuery({
    queryKey: ['workspace-config-status', workspaceId],
    queryFn: () => getWorkspaceConfigurationStatus(workspaceId!),
    enabled: !!workspaceId && isOwner,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  // Don't show if not owner or dismissed
  if (!isOwner || dismissed || !configStatus) {
    return null
  }

  // Filter checks based on props
  const missingChecks = showOnlyCritical 
    ? configStatus.criticalMissing 
    : [...configStatus.criticalMissing, ...configStatus.recommendedMissing].slice(0, 3)

  if (missingChecks.length === 0) {
    return null
  }

  const handleDismiss = () => {
    setDismissed(true)
    onDismiss?.()
  }

  if (compact) {
    return (
      <div className="bg-amber-50 border-l-4 border-amber-400 p-3 rounded-r-lg">
        <div className="flex items-start">
          <ExclamationTriangleIcon className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
          <div className="ml-3 flex-1">
            <p className="text-sm font-medium text-amber-800">
              Setup incomplete ({configStatus.completionPercentage}%)
            </p>
            <p className="text-xs text-amber-700 mt-1">
              {missingChecks[0]?.name} needs configuration
            </p>
            <Link
              to={missingChecks[0]?.settingsPath || '/settings'}
              className="text-xs font-medium text-amber-900 hover:text-amber-950 mt-1 inline-flex items-center"
            >
              Configure now
              <ArrowRightIcon className="h-3 w-3 ml-1" />
            </Link>
          </div>
          {onDismiss && (
            <button
              onClick={handleDismiss}
              className="ml-2 text-amber-600 hover:text-amber-800"
            >
              <XMarkIcon className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4 mb-6">
      <div className="flex items-start justify-between">
        <div className="flex items-start flex-1">
          <div className="flex-shrink-0">
            <div className="flex items-center justify-center h-10 w-10 rounded-full bg-blue-100">
              <CogIcon className="h-6 w-6 text-blue-600" />
            </div>
          </div>
          <div className="ml-4 flex-1">
            <h3 className="text-sm font-semibold text-gray-900">
              Complete Your Workspace Setup
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              {configStatus.completionPercentage}% complete. Configure essential settings to get the most out of Itory.
            </p>
            <div className="mt-3 space-y-2">
              {missingChecks.map((check) => (
                <Link
                  key={check.id}
                  to={check.settingsPath || '/settings'}
                  className="flex items-center justify-between p-2 bg-white rounded border border-gray-200 hover:border-blue-300 hover:shadow-sm transition-all group"
                >
                  <div className="flex items-center">
                    {check.priority === 'critical' ? (
                      <ExclamationTriangleIcon className="h-4 w-4 text-amber-500 mr-2" />
                    ) : (
                      <CheckCircleIcon className="h-4 w-4 text-gray-400 mr-2" />
                    )}
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {check.name}
                        {check.priority === 'critical' && (
                          <span className="ml-2 text-xs text-amber-600 font-normal">Required</span>
                        )}
                      </p>
                      <p className="text-xs text-gray-500">{check.description}</p>
                    </div>
                  </div>
                  <ArrowRightIcon className="h-4 w-4 text-gray-400 group-hover:text-blue-600 transition-colors" />
                </Link>
              ))}
            </div>
            {configStatus.recommendedMissing.length > missingChecks.length && (
              <Link
                to="/settings"
                className="mt-3 inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-700"
              >
                View all setup items
                <ArrowRightIcon className="h-4 w-4 ml-1" />
              </Link>
            )}
          </div>
        </div>
        {onDismiss && (
          <button
            onClick={handleDismiss}
            className="ml-4 text-gray-400 hover:text-gray-600"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        )}
      </div>
    </div>
  )
}
