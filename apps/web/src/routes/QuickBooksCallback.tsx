/**
 * QuickBooks OAuth Callback Handler
 * 
 * This page handles the OAuth callback from QuickBooks after user authorization
 */

import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useSessionStore } from '../state/sessionStore'
import { quickBooksOAuthCallback } from '../api/quickbooks'
import { showToast } from '../components/ui/Toast'
import { PageShell } from '../components/layout/PageShell'
import { CheckCircleIcon, XCircleIcon, ArrowPathIcon } from '@heroicons/react/24/outline'

export function QuickBooksCallback() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { workspaceId } = useSessionStore()
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing')
  const [message, setMessage] = useState('Processing QuickBooks authorization...')

  useEffect(() => {
    const handleCallback = async () => {
      if (!workspaceId) {
        setStatus('error')
        setMessage('No workspace selected. Please select a workspace and try again.')
        return
      }

      const code = searchParams.get('code')
      const realmId = searchParams.get('realmId')
      const error = searchParams.get('error')

      if (error) {
        setStatus('error')
        setMessage(`Authorization failed: ${error}`)
        showToast(`QuickBooks authorization failed: ${error}`, 'error')
        return
      }

      if (!code || !realmId) {
        setStatus('error')
        setMessage('Missing authorization code or company ID. Please try connecting again.')
        showToast('Invalid callback parameters', 'error')
        return
      }

      try {
        await quickBooksOAuthCallback(workspaceId, code, realmId)
        setStatus('success')
        setMessage('Successfully connected to QuickBooks!')
        showToast('QuickBooks connected successfully!', 'success')
        
        // Redirect to settings after 2 seconds
        setTimeout(() => {
          navigate('/settings?tab=quickbooks')
        }, 2000)
      } catch (error) {
        console.error('QuickBooks callback error:', error)
        setStatus('error')
        setMessage(error instanceof Error ? error.message : 'Failed to connect to QuickBooks')
        showToast('Error connecting to QuickBooks', 'error')
      }
    }

    handleCallback()
  }, [workspaceId, searchParams, navigate])

  return (
    <PageShell title="QuickBooks Connection" subtitle="Processing authorization...">
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-8 max-w-md w-full">
          {status === 'processing' && (
            <div className="text-center">
              <ArrowPathIcon className="w-16 h-16 text-blue-600 animate-spin mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Processing...</h2>
              <p className="text-gray-600">{message}</p>
            </div>
          )}

          {status === 'success' && (
            <div className="text-center">
              <CheckCircleIcon className="w-16 h-16 text-green-600 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Connected!</h2>
              <p className="text-gray-600 mb-4">{message}</p>
              <p className="text-sm text-gray-500">Redirecting to settings...</p>
            </div>
          )}

          {status === 'error' && (
            <div className="text-center">
              <XCircleIcon className="w-16 h-16 text-red-600 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Connection Failed</h2>
              <p className="text-gray-600 mb-6">{message}</p>
              <button
                onClick={() => navigate('/settings?tab=quickbooks')}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Go to Settings
              </button>
            </div>
          )}
        </div>
      </div>
    </PageShell>
  )
}

