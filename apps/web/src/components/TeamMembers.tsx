import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  listWorkspaceUsers,
  removeUserFromWorkspace,
  updateUserRole,
  type Role,
} from '../api/workspace-users'
import {
  listWorkspaceInvitations,
  inviteUserToWorkspace,
  cancelInvitation,
  resendInvitationEmail,
  type WorkspaceInvitation,
} from '../api/workspace-invitations'
import { showToast } from './ui/Toast'
import {
  UserPlusIcon,
  EnvelopeIcon,
  XMarkIcon,
  ArrowPathIcon,
  TrashIcon,
  CheckCircleIcon,
  ClockIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline'

interface TeamMembersProps {
  workspaceId: string
}

const ROLE_LABELS: Record<Role, string> = {
  owner: 'Owner',
  admin: 'Admin',
  manager: 'Manager',
  staff: 'Staff',
  operator: 'Operator',
}

const ROLE_COLORS: Record<Role, string> = {
  owner: 'bg-purple-100 text-purple-800',
  admin: 'bg-blue-100 text-blue-800',
  manager: 'bg-green-100 text-green-800',
  staff: 'bg-gray-100 text-gray-800',
  operator: 'bg-yellow-100 text-yellow-800',
}

export function TeamMembers({ workspaceId }: TeamMembersProps) {
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<Role>('staff')
  const [isInviting, setIsInviting] = useState(false)
  const queryClient = useQueryClient()

  // Fetch team members
  const { data: members = [], isLoading: membersLoading } = useQuery({
    queryKey: ['workspace-users', workspaceId],
    queryFn: () => listWorkspaceUsers(workspaceId),
    enabled: !!workspaceId,
  })

  // Fetch invitations
  const { data: invitations = [], isLoading: invitationsLoading } = useQuery({
    queryKey: ['workspace-invitations', workspaceId],
    queryFn: () => listWorkspaceInvitations(workspaceId),
    enabled: !!workspaceId,
  })

  const handleInvite = async () => {
    if (!inviteEmail.trim()) {
      showToast('Please enter an email address', 'error')
      return
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(inviteEmail)) {
      showToast('Please enter a valid email address', 'error')
      return
    }

    setIsInviting(true)
    try {
      await inviteUserToWorkspace(workspaceId, {
        email: inviteEmail.trim(),
        role: inviteRole,
      })
      showToast('Invitation sent successfully!', 'success')
      setShowInviteModal(false)
      setInviteEmail('')
      setInviteRole('staff')
      queryClient.invalidateQueries({ queryKey: ['workspace-invitations', workspaceId] })
    } catch (error: any) {
      showToast(error.message || 'Failed to send invitation', 'error')
    } finally {
      setIsInviting(false)
    }
  }

  const handleCancelInvitation = async (invitationId: string) => {
    try {
      await cancelInvitation(workspaceId, invitationId)
      showToast('Invitation cancelled', 'success')
      queryClient.invalidateQueries({ queryKey: ['workspace-invitations', workspaceId] })
    } catch (error: any) {
      showToast(error.message || 'Failed to cancel invitation', 'error')
    }
  }

  const handleResendInvitation = async (invitationId: string) => {
    try {
      await resendInvitationEmail(workspaceId, invitationId)
      showToast('Invitation email resent', 'success')
    } catch (error: any) {
      showToast(error.message || 'Failed to resend invitation', 'error')
    }
  }

  const handleRemoveMember = async (userId: string, userName: string) => {
    if (!confirm(`Are you sure you want to remove ${userName || 'this user'} from the workspace?`)) {
      return
    }

    try {
      await removeUserFromWorkspace(workspaceId, userId)
      showToast('User removed successfully', 'success')
      queryClient.invalidateQueries({ queryKey: ['workspace-users', workspaceId] })
    } catch (error: any) {
      showToast(error.message || 'Failed to remove user', 'error')
    }
  }

  const handleUpdateRole = async (userId: string, newRole: Role) => {
    try {
      await updateUserRole(workspaceId, userId, newRole)
      showToast('User role updated', 'success')
      queryClient.invalidateQueries({ queryKey: ['workspace-users', workspaceId] })
    } catch (error: any) {
      showToast(error.message || 'Failed to update role', 'error')
    }
  }

  const getInvitationStatusIcon = (status: WorkspaceInvitation['status']) => {
    switch (status) {
      case 'pending':
        return <ClockIcon className="w-4 h-4 text-yellow-500" />
      case 'accepted':
        return <CheckCircleIcon className="w-4 h-4 text-green-500" />
      case 'expired':
        return <XCircleIcon className="w-4 h-4 text-red-500" />
      case 'cancelled':
        return <XCircleIcon className="w-4 h-4 text-gray-500" />
      default:
        return null
    }
  }

  const isInvitationExpired = (invitation: WorkspaceInvitation) => {
    if (invitation.status !== 'pending') return false
    const expiresAt = invitation.expiresAt
    if (!expiresAt) return false
    const expiresTimestamp = expiresAt instanceof Date ? expiresAt.getTime() : expiresAt.toMillis()
    return expiresTimestamp < Date.now()
  }

  return (
    <div className="space-y-6">
      {/* Header with Invite Button */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Team Members</h3>
          <p className="text-sm text-gray-500 mt-1">
            Manage team members and send invitations to join your workspace
          </p>
        </div>
        <button
          onClick={() => setShowInviteModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <UserPlusIcon className="w-5 h-5" />
          Invite Member
        </button>
      </div>

      {/* Current Members */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-3">Current Members ({members.length})</h4>
        {membersLoading ? (
          <div className="animate-pulse space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-gray-100 rounded-lg" />
            ))}
          </div>
        ) : members.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>No team members yet. Invite someone to get started!</p>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {members.map((member) => (
                  <tr key={member.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div>
                        <div className="font-medium text-gray-900">
                          {member.displayName || member.email || 'Unknown User'}
                        </div>
                        {member.email && (
                          <div className="text-sm text-gray-500">{member.email}</div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={member.role}
                        onChange={(e) => handleUpdateRole(member.id, e.target.value as Role)}
                        className={`text-xs font-medium px-2 py-1 rounded ${
                          ROLE_COLORS[member.role as Role] || ROLE_COLORS.staff
                        } border-0 cursor-pointer`}
                        disabled={member.role === 'owner'}
                      >
                        {Object.entries(ROLE_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      {member.role !== 'owner' && (
                        <button
                          onClick={() => handleRemoveMember(member.id, member.displayName || member.email || 'User')}
                          className="text-red-600 hover:text-red-800 p-1"
                          title="Remove member"
                        >
                          <TrashIcon className="w-5 h-5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pending Invitations */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-3">
          Pending Invitations ({invitations.filter((i) => i.status === 'pending').length})
        </h4>
        {invitationsLoading ? (
          <div className="animate-pulse space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="h-16 bg-gray-100 rounded-lg" />
            ))}
          </div>
        ) : invitations.filter((i) => i.status === 'pending').length === 0 ? (
          <div className="text-center py-4 text-gray-500 text-sm">
            No pending invitations
          </div>
        ) : (
          <div className="space-y-2">
            {invitations
              .filter((invitation) => invitation.status === 'pending')
              .map((invitation) => (
                <div
                  key={invitation.id}
                  className={`bg-white border rounded-lg p-4 flex items-center justify-between ${
                    isInvitationExpired(invitation) ? 'border-red-300 bg-red-50' : 'border-gray-200'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {getInvitationStatusIcon(invitation.status)}
                    <div>
                      <div className="font-medium text-gray-900">{invitation.email}</div>
                      <div className="text-sm text-gray-500">
                        Role: <span className={ROLE_COLORS[invitation.role] || ROLE_COLORS.staff}>
                          {ROLE_LABELS[invitation.role]}
                        </span>
                        {isInvitationExpired(invitation) && (
                          <span className="ml-2 text-red-600">(Expired)</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleResendInvitation(invitation.id)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                      title="Resend invitation"
                    >
                      <ArrowPathIcon className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleCancelInvitation(invitation.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded"
                      title="Cancel invitation"
                    >
                      <XMarkIcon className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Invite Team Member</h3>
              <button
                onClick={() => setShowInviteModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="colleague@example.com"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as Role)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {Object.entries(ROLE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  )))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Select the role for this team member. You can change it later.
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowInviteModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleInvite}
                  disabled={isInviting || !inviteEmail.trim()}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isInviting ? 'Sending...' : 'Send Invitation'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
