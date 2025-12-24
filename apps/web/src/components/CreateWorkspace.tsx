import { useState, FormEvent, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSessionStore } from '../state/sessionStore'
import { createWorkspace } from '../api/workspaces'
import { BuildingOfficeIcon, ArrowRightIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { LOGO_URL } from '../utils/logo'

const CURRENCIES = [
  { code: 'USD', name: 'US Dollar ($)' },
  { code: 'EUR', name: 'Euro (€)' },
  { code: 'GBP', name: 'British Pound (£)' },
  { code: 'TRY', name: 'Turkish Lira (₺)' },
  { code: 'CAD', name: 'Canadian Dollar (C$)' },
  { code: 'AUD', name: 'Australian Dollar (A$)' },
  { code: 'JPY', name: 'Japanese Yen (¥)' },
  { code: 'CNY', name: 'Chinese Yuan (¥)' },
]

const TIMEZONES = [
  { value: 'UTC', label: 'UTC (Coordinated Universal Time)' },
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'Europe/London', label: 'London (GMT)' },
  { value: 'Europe/Istanbul', label: 'Istanbul (TRT)' },
  { value: 'Asia/Dubai', label: 'Dubai (GST)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
  { value: 'Asia/Shanghai', label: 'Shanghai (CST)' },
  { value: 'Australia/Sydney', label: 'Sydney (AEDT)' },
]

interface CreateWorkspaceProps {
  onComplete?: () => void
  onSkip?: () => void
}

export function CreateWorkspace({ onComplete, onSkip }: CreateWorkspaceProps) {
  const { userId } = useSessionStore()
  const navigate = useNavigate()
  const [workspaceName, setWorkspaceName] = useState('')
  const [currency, setCurrency] = useState('USD')
  const [timezone, setTimezone] = useState('UTC')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // Redirect to login if not authenticated (when used as standalone route)
  useEffect(() => {
    if (!userId && !onComplete) {
      // Only redirect if this is a standalone route (no onComplete callback)
      navigate('/login', { replace: true })
    }
  }, [userId, navigate, onComplete])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    
    if (!workspaceName.trim()) {
      setError('Workspace name is required')
      return
    }

    if (!userId) {
      setError('You must be logged in to create a workspace')
      return
    }

    setLoading(true)

    try {
      const workspaceId = await createWorkspace(
        {
          name: workspaceName.trim(),
          currency,
          timezone,
        },
        userId
      )

      console.log('Workspace created successfully:', workspaceId)
      
      // Refresh user workspaces by navigating to home
      // The App component will automatically reload workspaces
      if (onComplete) {
        onComplete()
      } else {
        // Force a page reload to refresh workspace list
        window.location.href = '/'
      }
    } catch (err: any) {
      console.error('Error creating workspace:', err)
      setError(err.message || 'Failed to create workspace. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleSkip = () => {
    if (onSkip) {
      onSkip()
    } else {
      navigate('/')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center mb-4">
            <img
              src={LOGO_URL}
              alt="Itory logo"
              className="h-12 w-auto object-contain"
            />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Create Your Workspace
          </h1>
          <p className="text-gray-600">
            Set up your workspace to start managing inventory and production
          </p>
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Error Message */}
            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-4">
                <p className="text-sm font-medium text-red-800">{error}</p>
              </div>
            )}

            {/* Workspace Name */}
            <div>
              <label htmlFor="workspace-name" className="block text-sm font-medium text-gray-700 mb-2">
                Workspace Name <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <BuildingOfficeIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  id="workspace-name"
                  name="workspaceName"
                  type="text"
                  required
                  value={workspaceName}
                  onChange={(e) => setWorkspaceName(e.target.value)}
                  className="block w-full pl-10 pr-4 py-3 rounded-lg border border-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  placeholder="My Company"
                  maxLength={100}
                />
              </div>
              <p className="mt-1.5 text-xs text-gray-500">
                This will be the name of your workspace. You can change it later.
              </p>
            </div>

            {/* Currency */}
            <div>
              <label htmlFor="currency" className="block text-sm font-medium text-gray-700 mb-2">
                Currency
              </label>
              <select
                id="currency"
                name="currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="block w-full rounded-lg border border-gray-300 bg-white py-3 px-4 text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              >
                {CURRENCIES.map((curr) => (
                  <option key={curr.code} value={curr.code}>
                    {curr.name}
                  </option>
                ))}
              </select>
              <p className="mt-1.5 text-xs text-gray-500">
                Default currency for your workspace
              </p>
            </div>

            {/* Timezone */}
            <div>
              <label htmlFor="timezone" className="block text-sm font-medium text-gray-700 mb-2">
                Timezone
              </label>
              <select
                id="timezone"
                name="timezone"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="block w-full rounded-lg border border-gray-300 bg-white py-3 px-4 text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              >
                {TIMEZONES.map((tz) => (
                  <option key={tz.value} value={tz.value}>
                    {tz.label}
                  </option>
                ))}
              </select>
              <p className="mt-1.5 text-xs text-gray-500">
                Timezone for your workspace operations
              </p>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 flex items-center justify-center gap-2 py-3.5 px-4 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow-md"
              >
                {loading ? (
                  <>
                    <svg
                      className="animate-spin h-5 w-5 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    <span>Creating...</span>
                  </>
                ) : (
                  <>
                    <span>Create Workspace</span>
                    <ArrowRightIcon className="h-5 w-5" />
                  </>
                )}
              </button>
              {onSkip && (
                <button
                  type="button"
                  onClick={handleSkip}
                  className="px-4 py-3.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-all"
                >
                  Skip for Now
                </button>
              )}
            </div>
          </form>

          {/* Info Box */}
          <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-sm text-blue-800">
              <strong>Tip:</strong> You can create additional workspaces later or be invited to existing ones by administrators.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
