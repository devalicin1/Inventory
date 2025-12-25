import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useSessionStore } from '../state/sessionStore'
import { acceptWorkspaceInvitation } from '../api/workspace-invitations'
import { signUp, signIn } from '../lib/auth'
import { showToast } from '../components/ui/Toast'
import { LOGO_URL } from '../utils/logo'
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline'
import { PasswordStrengthIndicator } from '../components/PasswordStrengthIndicator'

export function AcceptInvitation() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const workspaceId = searchParams.get('workspaceId')
  const navigate = useNavigate()
  const { userId, email: sessionEmail } = useSessionStore()
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState<'check' | 'login' | 'signup' | 'accepting'>('check')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token || !workspaceId) {
      setError('Invalid invitation link. Missing token or workspace ID.')
      return
    }

    // Check if user is already logged in
    if (userId) {
      // User is logged in, try to accept invitation
      handleAcceptInvitation()
    } else {
      // User needs to login or signup
      setStep('login')
    }
  }, [token, workspaceId, userId])

  const handleAcceptInvitation = async () => {
    if (!token || !workspaceId) {
      setError('Invalid invitation link')
      return
    }

    setLoading(true)
    setError(null)

    try {
      await acceptWorkspaceInvitation(token, workspaceId)
      showToast('Invitation accepted! Welcome to the workspace.', 'success')
      
      // Refresh session to get updated workspaces
      window.location.href = '/'
    } catch (error: any) {
      console.error('Error accepting invitation:', error)
      setError(error.message || 'Failed to accept invitation')
      showToast(error.message || 'Failed to accept invitation', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      await signIn(email, password)
      // After login, accept invitation
      setStep('accepting')
      await handleAcceptInvitation()
    } catch (err: any) {
      setError(err.message || 'Login failed')
      showToast(err.message || 'Login failed', 'error')
      setLoading(false)
    }
  }

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      await signUp(email, password, displayName || undefined)
      showToast('Account created! Please verify your email if needed.', 'info')
      // After signup, accept invitation
      setStep('accepting')
      await handleAcceptInvitation()
    } catch (err: any) {
      setError(err.message || 'Sign up failed')
      showToast(err.message || 'Sign up failed', 'error')
      setLoading(false)
    }
  }

  if (!token || !workspaceId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full">
          <div className="text-center">
            <div className="text-red-600 text-6xl mb-4">⚠️</div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Invalid Invitation</h1>
            <p className="text-gray-600 mb-6">
              This invitation link is invalid or has expired. Please contact the workspace owner for a new invitation.
            </p>
            <button
              onClick={() => navigate('/login')}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Go to Login
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (step === 'accepting') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Accepting invitation...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full">
        <div className="text-center mb-6">
          <img src={LOGO_URL} alt="Logo" className="h-12 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {step === 'login' ? 'Sign In to Accept' : 'Create Account to Accept'}
          </h1>
          <p className="text-gray-600">
            {step === 'login'
              ? 'Sign in to accept the workspace invitation'
              : 'Create an account to accept the workspace invitation'}
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        {step === 'login' ? (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="your@email.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 pr-10"
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? (
                    <EyeSlashIcon className="w-5 h-5" />
                  ) : (
                    <EyeIcon className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep('signup')}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Create Account
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleSignUp} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Display Name</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Your name (optional)"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="your@email.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 pr-10"
                  placeholder="Create a password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? (
                    <EyeSlashIcon className="w-5 h-5" />
                  ) : (
                    <EyeIcon className="w-5 h-5" />
                  )}
                </button>
              </div>
              <PasswordStrengthIndicator password={password} />
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep('login')}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Already have account?
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Creating...' : 'Create Account'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
