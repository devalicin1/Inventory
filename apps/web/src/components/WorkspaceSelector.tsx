import { useState } from 'react'
import { useSessionStore, type UserWorkspace } from '../state/sessionStore'
import { BuildingOfficeIcon, ChevronDownIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline'
import { LOGO_URL } from '../utils/logo'
import { signOut } from '../lib/auth'

interface WorkspaceSelectorProps {
  workspaces: UserWorkspace[]
  onSelect: (workspaceId: string) => void
}

export function WorkspaceSelector({ workspaces, onSelect }: WorkspaceSelectorProps) {
  const { displayName, email } = useSessionStore()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [showAccountDropdown, setShowAccountDropdown] = useState(false)
  const [filterType, setFilterType] = useState<'all' | 'recent'>('recent')

  const handleSelect = async (workspaceId: string) => {
    if (isSubmitting) return
    setSelectedId(workspaceId)
    setIsSubmitting(true)
    
    // Small delay for better UX
    await new Promise(resolve => setTimeout(resolve, 200))
    onSelect(workspaceId)
  }

  const getInitials = () => {
    if (displayName) {
      return displayName
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    }
    if (email) {
      return email[0].toUpperCase()
    }
    return 'U'
  }

  const getLastOpenedText = (workspaceId: string) => {
    // For now, return placeholder. In future, this could be stored in localStorage or user preferences
    const lastOpened = localStorage.getItem(`workspace_last_opened_${workspaceId}`)
    if (lastOpened) {
      const date = new Date(lastOpened)
      const now = new Date()
      const diffTime = Math.abs(now.getTime() - date.getTime())
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
      
      if (diffDays === 0) return 'Today'
      if (diffDays === 1) return 'Yesterday'
      if (diffDays < 7) return `${diffDays} days ago`
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    }
    return 'Today' // Default for first time
  }

  const filteredWorkspaces = workspaces.filter(ws => 
    ws.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const displayedWorkspaces = filterType === 'recent' 
    ? filteredWorkspaces.sort((a, b) => {
        const aLast = localStorage.getItem(`workspace_last_opened_${a.workspaceId}`) || '0'
        const bLast = localStorage.getItem(`workspace_last_opened_${b.workspaceId}`) || '0'
        return new Date(bLast).getTime() - new Date(aLast).getTime()
      })
    : filteredWorkspaces

  const handleWorkspaceSelect = async (workspaceId: string) => {
    // Store last opened time
    localStorage.setItem(`workspace_last_opened_${workspaceId}`, new Date().toISOString())
    await handleSelect(workspaceId)
  }

  const handleSignOut = async () => {
    try {
      await signOut()
    } catch (error) {
      console.error('Sign out error:', error)
    }
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Top Header */}
      <div className="border-b border-gray-200 bg-white">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center">
            <img
              src={LOGO_URL}
              alt="Itory logo"
              className="h-8 w-auto object-contain"
            />
          </div>

          {/* User Profile Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowAccountDropdown(!showAccountDropdown)}
              className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div className="h-8 w-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold text-xs">
                {getInitials()}
              </div>
              <div className="text-left hidden sm:block">
                <p className="text-sm font-medium text-gray-900">{displayName || email || 'User'}</p>
                <p className="text-xs text-gray-500">Switch account</p>
              </div>
              <ChevronDownIcon className="h-4 w-4 text-gray-400" />
            </button>

            {showAccountDropdown && (
              <>
                <div 
                  className="fixed inset-0 z-10" 
                  onClick={() => setShowAccountDropdown(false)}
                />
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-20">
                  <button
                    onClick={handleSignOut}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
                  >
                    Sign out
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-6 py-12">
        {/* Center Logo and Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center mb-6">
            <img
              src={LOGO_URL}
              alt="Itory logo"
              className="h-20 w-auto object-contain"
            />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-3">Select workspace</h1>
          <p className="text-gray-600 text-lg">
            Choose where you want to work today. You can switch anytime from the sidebar.
          </p>
        </div>

        {/* Search and Filter */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex-1 relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search workspaces..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div className="relative">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as 'all' | 'recent')}
              className="appearance-none pl-4 pr-10 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
            >
              <option value="recent">Recent</option>
              <option value="all">All</option>
            </select>
            <ChevronDownIcon className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
          </div>
        </div>

        {/* Workspace Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {displayedWorkspaces.map((workspace) => {
            const isSelected = selectedId === workspace.workspaceId
            const lastOpened = getLastOpenedText(workspace.workspaceId)
            
            return (
              <button
                key={workspace.workspaceId}
                onClick={() => handleWorkspaceSelect(workspace.workspaceId)}
                disabled={isSubmitting}
                className={`
                  relative p-6 rounded-xl border-2 transition-all duration-200 text-left bg-white
                  ${isSelected 
                    ? 'border-l-4 border-l-blue-600 border-r-2 border-r-gray-200 border-t-2 border-t-gray-200 border-b-2 border-b-gray-200 shadow-md' 
                    : 'border-gray-200 hover:border-blue-300 hover:shadow-md'
                  }
                  ${isSubmitting && !isSelected ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                `}
              >
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                      <BuildingOfficeIcon className="w-5 h-5 text-gray-600" />
                    </div>
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900 truncate">
                        {workspace.name}
                      </h3>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                        {workspace.role}
                      </span>
                      <span className="text-xs text-gray-500">
                        Last opened: {lastOpened}
                      </span>
                    </div>
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        {/* Footer Info */}
        <div className="text-center space-y-2">
          <p className="text-sm text-gray-500">
            Showing {displayedWorkspaces.length} of {workspaces.length}
          </p>
          <p className="text-sm text-gray-500">
            Need access?{' '}
            <a href="#" className="text-blue-600 hover:text-blue-700 font-medium">
              Request access
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
