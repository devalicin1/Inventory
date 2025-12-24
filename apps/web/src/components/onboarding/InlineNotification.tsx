import { Link } from 'react-router-dom'
import { 
  InformationCircleIcon,
  ExclamationTriangleIcon,
  ArrowRightIcon,
  XMarkIcon
} from '@heroicons/react/24/outline'
import { useState } from 'react'

interface InlineNotificationProps {
  type?: 'info' | 'warning'
  title: string
  message: string
  actionLabel?: string
  actionPath?: string
  onDismiss?: () => void
  dismissible?: boolean
}

export function InlineNotification({
  type = 'info',
  title,
  message,
  actionLabel = 'Configure',
  actionPath,
  onDismiss,
  dismissible = true,
}: InlineNotificationProps) {
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null

  const handleDismiss = () => {
    setDismissed(true)
    onDismiss?.()
  }

  const Icon = type === 'warning' ? ExclamationTriangleIcon : InformationCircleIcon
  const bgColor = type === 'warning' ? 'bg-amber-50 border-amber-200' : 'bg-blue-50 border-blue-200'
  const iconColor = type === 'warning' ? 'text-amber-600' : 'text-blue-600'
  const textColor = type === 'warning' ? 'text-amber-800' : 'text-blue-800'

  return (
    <div className={`${bgColor} border rounded-lg p-3 mb-4`}>
      <div className="flex items-start">
        <Icon className={`h-5 w-5 ${iconColor} mt-0.5 flex-shrink-0`} />
        <div className="ml-3 flex-1 min-w-0">
          <p className={`text-sm font-medium ${textColor}`}>
            {title}
          </p>
          <p className={`text-sm ${textColor.replace('800', '700')} mt-1`}>
            {message}
          </p>
          {actionPath && (
            <Link
              to={actionPath}
              className="mt-2 inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              {actionLabel}
              <ArrowRightIcon className="h-4 w-4 ml-1" />
            </Link>
          )}
        </div>
        {dismissible && (
          <button
            onClick={handleDismiss}
            className={`ml-2 ${textColor.replace('800', '600')} hover:opacity-70`}
          >
            <XMarkIcon className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  )
}
