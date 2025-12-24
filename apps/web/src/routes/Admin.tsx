import { useState, useEffect } from 'react'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { useSessionStore } from '../state/sessionStore'
import {
  listWorkspaces,
  createWorkspace,
  updateWorkspace,
  type Workspace,
  type WorkspaceInput,
} from '../api/workspaces'
import {
  listWorkspaceUsers,
  addUserToWorkspace,
  updateUserRole,
  removeUserFromWorkspace,
  listAllUsers,
  type WorkspaceUser,
  type Role,
} from '../api/workspace-users'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  UserPlusIcon,
  XMarkIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline'
import { PageShell } from '../components/layout/PageShell'
import { showToast } from '../components/ui/Toast'

// Component to preview role permissions and screens
function RolePermissionsPreview({ workspaceId, role }: { workspaceId: string; role: string }) {
  const { data: permissions = [], isLoading: permissionsLoading } = useQuery({
    queryKey: ['role-permissions-preview', workspaceId, role],
    queryFn: () => getRolePermissions(workspaceId, role),
    enabled: !!workspaceId && !!role,
  })
  
  const { data: screens = [], isLoading: screensLoading } = useQuery({
    queryKey: ['role-screens-preview', workspaceId, role],
    queryFn: () => getRoleScreens(workspaceId, role),
    enabled: !!workspaceId && !!role,
  })

  if (permissionsLoading || screensLoading) {
    return <p className="text-xs text-gray-400">Loading...</p>
  }

  if (permissions.length === 0 && screens.length === 0) {
    return <p className="text-xs text-gray-400">No permissions or screens set</p>
  }

  return (
    <div className="space-y-2">
      {permissions.length > 0 && (
        <div>
          <p className="text-xs font-medium text-gray-600 mb-1">Permissions:</p>
          <div className="flex flex-wrap gap-1">
            {permissions.map((permission) => (
              <span
                key={permission}
                className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-primary-100 text-primary-800"
              >
                {permission === '*' ? 'All Permissions' : permission.replace(/_/g, ' ')}
              </span>
            ))}
          </div>
        </div>
      )}
      {screens.length > 0 && (
        <div>
          <p className="text-xs font-medium text-gray-600 mb-1">Screens:</p>
          <div className="flex flex-wrap gap-1">
            {screens.map((screenId) => {
              const screen = AVAILABLE_SCREENS.find(s => s.id === screenId)
              return (
                <span
                  key={screenId}
                  className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800"
                >
                  {screenId === '*' ? 'All Screens' : (screen?.name || screenId)}
                </span>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
import {
  getAllRoles,
  getAllRolePermissions,
  updateRolePermissions,
  resetRolePermissionsToDefault,
  getAvailablePermissions,
  getRolePermissions,
  getRoleScreens,
  createCustomRole,
  deleteCustomRole,
  AVAILABLE_SCREENS,
  STANDARD_ROLES,
  type RolePermission,
} from '../api/role-permissions'

export function Admin() {
  const { userId, email } = useSessionStore()
  const queryClient = useQueryClient()
  const [selectedWorkspace, setSelectedWorkspace] = useState<Workspace | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showUserModal, setShowUserModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showRolePermissionsModal, setShowRolePermissionsModal] = useState(false)
  const [showCreateRoleModal, setShowCreateRoleModal] = useState(false)
  const [editingRole, setEditingRole] = useState<string | null>(null)
  const [rolePermissions, setRolePermissions] = useState<Record<string, string[]>>({})
  const [roleScreens, setRoleScreens] = useState<Record<string, string[]>>({})
  const [newRoleName, setNewRoleName] = useState('')
  const [newRolePermissions, setNewRolePermissions] = useState<string[]>([])
  const [newRoleScreens, setNewRoleScreens] = useState<string[]>([])
  const [workspaceForm, setWorkspaceForm] = useState<WorkspaceInput>({
    name: '',
    currency: 'USD',
    timezone: 'America/New_York',
  })
  const [editWorkspaceForm, setEditWorkspaceForm] = useState<WorkspaceInput>({
    name: '',
    currency: 'USD',
    timezone: 'America/New_York',
  })
  const [selectedRole, setSelectedRole] = useState<string>('staff')
  const [selectedUserId, setSelectedUserId] = useState<string>('')
  const [userSearchTerm, setUserSearchTerm] = useState('')
  
  // Available roles for user creation (standard + custom)
  const { data: availableRolesForUser = [] } = useQuery({
    queryKey: ['all-roles', selectedWorkspace?.id],
    queryFn: () => getAllRoles(selectedWorkspace!.id),
    enabled: !!selectedWorkspace && showUserModal,
  })

  // Workspace listesi
  const { data: workspaces = [], isLoading: workspacesLoading, error: workspacesError } = useQuery({
    queryKey: ['admin-workspaces'],
    queryFn: async () => {
      try {
        const wsList = await listWorkspaces()
        console.log('Fetched workspaces:', wsList)
        // Her workspace için kullanıcı sayısını al
        const workspacesWithUserCount = await Promise.all(
          wsList.map(async (ws) => {
            try {
              const users = await listWorkspaceUsers(ws.id)
              return { ...ws, userCount: users.length }
            } catch (err) {
              console.warn(`Could not fetch users for workspace ${ws.id}:`, err)
              return { ...ws, userCount: 0 }
            }
          })
        )
        return workspacesWithUserCount
      } catch (error) {
        console.error('Error fetching workspaces:', error)
        throw error
      }
    },
    retry: 1,
  })

  // Seçili workspace kullanıcıları
  const { data: workspaceUsers = [], isLoading: usersLoading } = useQuery({
    queryKey: ['workspace-users', selectedWorkspace?.id],
    queryFn: () => listWorkspaceUsers(selectedWorkspace!.id),
    enabled: !!selectedWorkspace,
  })

  // All roles (standard + custom) for selected workspace
  const { data: allRoles = [], isLoading: rolePermissionsLoading } = useQuery({
    queryKey: ['all-roles', selectedWorkspace?.id],
    queryFn: () => getAllRoles(selectedWorkspace!.id),
    enabled: !!selectedWorkspace, // Always load when workspace is selected
  })

  // Update rolePermissions and roleScreens when allRoles changes
  useEffect(() => {
    if (allRoles.length > 0) {
      const permissions: Record<string, string[]> = {}
      const screens: Record<string, string[]> = {}
      
      allRoles.forEach((role) => {
        permissions[role.role] = role.permissions || []
        screens[role.role] = role.screens || []
      })
      
      setRolePermissions(permissions)
      setRoleScreens(screens)
    }
  }, [allRoles])

  // Workspace oluşturma
  const createMutation = useMutation({
    mutationFn: (input: WorkspaceInput) => createWorkspace(input, userId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-workspaces'] })
      setShowCreateModal(false)
      setWorkspaceForm({ name: '', currency: 'USD', timezone: 'America/New_York' })
    },
  })

  // Workspace güncelleme
  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<WorkspaceInput> }) =>
      updateWorkspace(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-workspaces'] })
      queryClient.invalidateQueries({ queryKey: ['workspace', selectedWorkspace?.id] })
      setShowEditModal(false)
      // Update selected workspace in state
      if (selectedWorkspace) {
        setSelectedWorkspace({
          ...selectedWorkspace,
          ...editWorkspaceForm,
        })
      }
    },
  })

  // Tüm kullanıcıları getir
  const { data: allUsers = [], isLoading: allUsersLoading } = useQuery({
    queryKey: ['all-users'],
    queryFn: listAllUsers,
    enabled: showUserModal, // Sadece modal açıkken yükle
  })

  // Workspace'de olmayan kullanıcıları filtrele
  const availableUsers = allUsers.filter(
    user => !workspaceUsers.some(wsUser => wsUser.userId === user.id)
  )

  // Arama terimine göre filtrele
  const filteredUsers = availableUsers.filter(user => {
    const searchLower = userSearchTerm.toLowerCase()
    const email = (user.email || '').toLowerCase()
    const displayName = (user.displayName || '').toLowerCase()
    return email.includes(searchLower) || displayName.includes(searchLower)
  })

  // Kullanıcı ekleme (mevcut kullanıcıyı workspace'e ekle)
  const addUserMutation = useMutation({
    mutationFn: async ({
      userId: targetUserId,
      role,
    }: {
      userId: string
      role: Role
    }) => {
      console.log('[Admin] Adding existing user to workspace...')
      console.log('  - User ID:', targetUserId)
      console.log('  - Workspace ID:', selectedWorkspace?.id)
      console.log('  - Role:', role)
      
      if (!selectedWorkspace) {
        throw new Error('No workspace selected')
      }
      
      if (!userId) {
        throw new Error('Current user ID is missing')
      }

      // Workspace'e ekle
      console.log('[Admin] Adding user to workspace...')
      try {
        await addUserToWorkspace(selectedWorkspace.id, targetUserId, role, userId)
        console.log('[Admin] ✓ User successfully added to workspace')
      } catch (error) {
        console.error('[Admin] ❌ Error adding user to workspace:', error)
        throw new Error(`Failed to add user to workspace: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }

      return targetUserId
    },
    onSuccess: () => {
      console.log('[Admin] User added to workspace successfully')
      queryClient.invalidateQueries({ queryKey: ['workspace-users', selectedWorkspace?.id] })
      queryClient.invalidateQueries({ queryKey: ['all-users'] })
      setShowUserModal(false)
      setSelectedUserId('')
      setSelectedRole('staff')
      setUserSearchTerm('')
      showToast('User added to workspace successfully!', 'success')
    },
    onError: (error: any) => {
      console.error('[Admin] ❌ Error adding user:', error)
      console.error('Error details:', {
        message: error?.message || 'Unknown error',
        code: error?.code,
        stack: error?.stack,
      })
      showToast(`Error adding user: ${error?.message || 'Unknown error'}`, 'error', 5000)
    },
  })

  // Rol güncelleme
  const updateRoleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      updateUserRole(selectedWorkspace!.id, userId, role as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace-users', selectedWorkspace?.id] })
    },
  })

  // Kullanıcı silme
  const removeUserMutation = useMutation({
    mutationFn: (userId: string) => removeUserFromWorkspace(selectedWorkspace!.id, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace-users', selectedWorkspace?.id] })
    },
  })

  // Role permissions update
  const updateRolePermissionsMutation = useMutation({
    mutationFn: ({ role, permissions, screens }: { role: string; permissions: string[]; screens: string[] }) =>
      updateRolePermissions(selectedWorkspace!.id, role, permissions, screens),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-roles', selectedWorkspace?.id] })
      queryClient.invalidateQueries({ queryKey: ['role-permissions', selectedWorkspace?.id] })
      queryClient.invalidateQueries({ queryKey: ['workspace-users', selectedWorkspace?.id] })
      setEditingRole(null)
    },
  })

  // Reset role permissions to default
  const resetRolePermissionsMutation = useMutation({
    mutationFn: (role: string) => resetRolePermissionsToDefault(selectedWorkspace!.id, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-roles', selectedWorkspace?.id] })
      queryClient.invalidateQueries({ queryKey: ['role-permissions', selectedWorkspace?.id] })
    },
  })

  // Create custom role
  const createCustomRoleMutation = useMutation({
    mutationFn: ({ name, permissions, screens }: { name: string; permissions: string[]; screens: string[] }) =>
      createCustomRole(selectedWorkspace!.id, name, permissions, screens),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-roles', selectedWorkspace?.id] })
      setShowCreateRoleModal(false)
      setNewRoleName('')
      setNewRolePermissions([])
      setNewRoleScreens([])
      showToast('Custom role created successfully!', 'success')
    },
    onError: (error: any) => {
      showToast(`Error creating role: ${error?.message || 'Unknown error'}`, 'error')
    },
  })

  // Delete custom role
  const deleteCustomRoleMutation = useMutation({
    mutationFn: (roleName: string) => deleteCustomRole(selectedWorkspace!.id, roleName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-roles', selectedWorkspace?.id] })
      queryClient.invalidateQueries({ queryKey: ['workspace-users', selectedWorkspace?.id] })
    },
    onError: (error: any) => {
      showToast(`Error deleting role: ${error?.message || 'Unknown error'}`, 'error')
    },
  })

  // Demo workspace oluşturma
  const createDemoWorkspaceMutation = useMutation({
    mutationFn: async () => {
      console.log('Creating demo-workspace...')
      // demo-workspace'i oluştur
      const workspaceRef = doc(db, 'workspaces', 'demo-workspace')
      const now = serverTimestamp()
      
      console.log('Setting workspace document...')
      await setDoc(workspaceRef, {
        name: 'Demo Manufacturing Co.',
        currency: 'USD',
        timezone: 'America/New_York',
        plan: {
          tier: 'free-dev',
          limits: {
            users: 10,
            skus: 1000,
          },
        },
        createdBy: userId!,
        createdAt: now,
        updatedAt: now,
      })
      console.log('✓ Workspace document created')
      
      // Mevcut kullanıcıyı owner olarak ekle
      if (userId) {
        console.log('Adding user to workspace...')
        await addUserToWorkspace('demo-workspace', userId, 'owner', userId)
        console.log('✓ User added to workspace')
      }
      
      return 'demo-workspace'
    },
    onSuccess: () => {
      console.log('Demo workspace created successfully!')
      queryClient.invalidateQueries({ queryKey: ['admin-workspaces'] })
      showToast('Demo workspace created successfully!', 'success')
    },
    onError: (error: any) => {
      console.error('Error creating demo workspace:', error)
      showToast(`Error: ${error?.message || 'Failed to create demo workspace'}`, 'error')
    },
  })

  const handleCreateWorkspace = (e: React.FormEvent) => {
    e.preventDefault()
    createMutation.mutate(workspaceForm)
  }

  const handleAddUser = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedUserId) {
      showToast('Please select a user', 'warning')
      return
    }
    addUserMutation.mutate({
      userId: selectedUserId,
      role: selectedRole as Role,
    })
  }

  const handleEditWorkspace = (e: React.FormEvent) => {
    e.preventDefault()
    if (selectedWorkspace) {
      updateMutation.mutate({
        id: selectedWorkspace.id,
        input: editWorkspaceForm,
      })
    }
  }

  const handleOpenEditModal = () => {
    if (selectedWorkspace) {
      setEditWorkspaceForm({
        name: selectedWorkspace.name,
        currency: selectedWorkspace.currency,
        timezone: selectedWorkspace.timezone,
      })
      setShowEditModal(true)
    }
  }

  const handleOpenRolePermissionsModal = () => {
    setShowRolePermissionsModal(true)
  }

  const handleTogglePermission = (role: string, permission: string) => {
    setRolePermissions((prev) => {
      const current = prev[role] || []
      let updated: string[]
      
      if (permission === '*') {
        // If selecting '*', remove all others
        updated = current.includes('*') ? [] : ['*']
      } else {
        // Remove '*' if selecting specific permission
        updated = current.filter((p) => p !== '*')
        
        if (current.includes(permission)) {
          updated = updated.filter((p) => p !== permission)
        } else {
          updated = [...updated, permission]
        }
      }
      
      return {
        ...prev,
        [role]: updated,
      }
    })
  }

  const handleToggleScreen = (role: string, screenId: string) => {
    setRoleScreens((prev) => {
      const current = prev[role] || []
      let updated: string[]
      
      if (screenId === '*') {
        // If selecting '*', remove all others
        updated = current.includes('*') ? [] : ['*']
      } else {
        // Remove '*' if selecting specific screen
        updated = current.filter((s) => s !== '*')
        
        if (current.includes(screenId)) {
          updated = updated.filter((s) => s !== screenId)
        } else {
          updated = [...updated, screenId]
        }
      }
      
      return {
        ...prev,
        [role]: updated,
      }
    })
  }

  const handleSaveRolePermissions = (role: string) => {
    updateRolePermissionsMutation.mutate({
      role,
      permissions: rolePermissions[role] || [],
      screens: roleScreens[role] || [],
    })
  }

  const handleResetRolePermissions = (role: string) => {
    if (confirm(`Reset ${role} permissions to default?`)) {
      resetRolePermissionsMutation.mutate(role)
    }
  }

  const handleDeleteCustomRole = (roleName: string) => {
    if (confirm(`Delete custom role "${roleName}"? This cannot be undone.`)) {
      deleteCustomRoleMutation.mutate(roleName)
    }
  }

  const handleCreateCustomRole = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newRoleName.trim()) {
      showToast('Role name is required', 'warning')
      return
    }
    if (newRolePermissions.length === 0 && newRoleScreens.length === 0) {
      showToast('Please select at least one permission or screen', 'warning')
      return
    }
    createCustomRoleMutation.mutate({
      name: newRoleName.trim(),
      permissions: newRolePermissions,
      screens: newRoleScreens,
    })
  }

  if (workspacesLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading workspaces...</p>
        </div>
      </div>
    )
  }

  return (
    <PageShell
      title="Workspace Management"
      subtitle={email ? `User: ${email} | To become super admin: add your email to apps/web/src/utils/permissions.ts` : "View and manage all workspaces"}
      actions={
        <div className="flex gap-2">
          <button
            onClick={() => createDemoWorkspaceMutation.mutate()}
            disabled={createDemoWorkspaceMutation.isPending}
            className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-[14px] shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 h-10"
          >
            {createDemoWorkspaceMutation.isPending ? 'Creating...' : 'Create Demo Workspace'}
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-[14px] shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 h-10"
          >
            <PlusIcon className="h-5 w-5 mr-2" />
            New Workspace
          </button>
        </div>
      }
    >

      {/* Error Message */}
      {workspacesError && (
        <div className="mb-4 rounded-md bg-red-50 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">
                Error loading workspaces
              </h3>
              <div className="mt-2 text-sm text-red-700">
                <p>{workspacesError instanceof Error ? workspacesError.message : 'An unknown error occurred'}</p>
                <p className="mt-1">Check browser console (F12) or refresh the page.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Workspace Listesi */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Workspace Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Currency
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Timezone
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                User Count
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {workspaces.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center">
                  <div className="flex flex-col items-center">
                    <svg className="h-12 w-12 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                    </svg>
                    <h3 className="text-sm font-medium text-gray-900 mb-1">No workspaces yet</h3>
                    <p className="text-sm text-gray-500 mb-4">Click the "New Workspace" button above to create your first workspace.</p>
                    <button
                      onClick={() => setShowCreateModal(true)}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700"
                    >
                      <PlusIcon className="h-4 w-4 mr-2" />
                      Create First Workspace
                    </button>
                  </div>
                </td>
              </tr>
            ) : (
              workspaces.map((workspace) => (
                <tr key={workspace.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {workspace.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {workspace.currency}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {workspace.timezone}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {(workspace as any).userCount || 0}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => setSelectedWorkspace(workspace)}
                      className="text-primary-600 hover:text-primary-900 mr-4"
                    >
                      Details
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Workspace Detail Modal */}
      {selectedWorkspace && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">{selectedWorkspace.name}</h3>
              <button
                onClick={() => {
                  setSelectedWorkspace(null)
                  setShowEditModal(false)
                }}
                className="text-gray-400 hover:text-gray-500"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            {/* Workspace Properties Section */}
            <div className="mb-6 border-b pb-6">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-md font-semibold text-gray-700">Workspace Properties</h4>
                <button
                  onClick={handleOpenEditModal}
                  className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                >
                  <PencilIcon className="h-4 w-4 mr-1.5" />
                  Edit
                </button>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Name:</span>
                  <span className="ml-2 font-medium text-gray-900">{selectedWorkspace.name}</span>
                </div>
                <div>
                  <span className="text-gray-500">Currency:</span>
                  <span className="ml-2 font-medium text-gray-900">{selectedWorkspace.currency}</span>
                </div>
                <div>
                  <span className="text-gray-500">Timezone:</span>
                  <span className="ml-2 font-medium text-gray-900">{selectedWorkspace.timezone}</span>
                </div>
                <div>
                  <span className="text-gray-500">Plan:</span>
                  <span className="ml-2 font-medium text-gray-900">{selectedWorkspace.plan.tier}</span>
                </div>
              </div>
            </div>

            {/* Role Permissions Section */}
            <div className="mb-6 border-b pb-6">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-md font-semibold text-gray-700">Role Permissions</h4>
                <button
                  onClick={handleOpenRolePermissionsModal}
                  className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                >
                  <ShieldCheckIcon className="h-4 w-4 mr-1.5" />
                  Manage Permissions
                </button>
              </div>
              <p className="text-sm text-gray-500">
                Configure what each role can do in this workspace
              </p>
            </div>

            {/* Users Section */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-md font-semibold text-gray-700">Users</h4>
                <button
                  onClick={() => setShowUserModal(true)}
                  className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700"
                >
                  <UserPlusIcon className="h-4 w-4 mr-1.5" />
                  Add User
                </button>
              </div>

              {usersLoading ? (
                <div className="text-center py-4">Loading...</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                          Email
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                          Name
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                          Role
                        </th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {workspaceUsers.map((user) => (
                        <tr key={user.id}>
                          <td className="px-4 py-2 text-sm text-gray-900">{user.email || '-'}</td>
                          <td className="px-4 py-2 text-sm text-gray-500">
                            {user.displayName || '-'}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-500">
                            {allRoles.length > 0 ? (
                              <select
                                value={user.role || 'staff'}
                                onChange={(e) =>
                                  updateRoleMutation.mutate({
                                    userId: user.userId,
                                    role: e.target.value,
                                  })
                                }
                                className="border border-gray-300 rounded-md px-2 py-1 text-sm"
                              >
                                {allRoles.map((roleData) => (
                                  <option key={roleData.role} value={roleData.role}>
                                    {roleData.role.charAt(0).toUpperCase() + roleData.role.slice(1)}
                                    {roleData.isCustom && ' (Custom)'}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span className="text-gray-500">{user.role || 'staff'}</span>
                            )}
                          </td>
                          <td className="px-4 py-2 text-right text-sm">
                            <button
                              onClick={() => removeUserMutation.mutate(user.userId)}
                              className="text-red-600 hover:text-red-900"
                            >
                              <TrashIcon className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Workspace Edit Modal */}
      {showEditModal && selectedWorkspace && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-1/2 shadow-lg rounded-md bg-white">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Edit Workspace</h3>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-gray-400 hover:text-gray-500"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleEditWorkspace} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Workspace Name</label>
                <input
                  type="text"
                  required
                  value={editWorkspaceForm.name}
                  onChange={(e) =>
                    setEditWorkspaceForm({ ...editWorkspaceForm, name: e.target.value })
                  }
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Currency</label>
                <select
                  value={editWorkspaceForm.currency}
                  onChange={(e) =>
                    setEditWorkspaceForm({ ...editWorkspaceForm, currency: e.target.value })
                  }
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="TRY">TRY</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Timezone</label>
                <select
                  value={editWorkspaceForm.timezone}
                  onChange={(e) =>
                    setEditWorkspaceForm({ ...editWorkspaceForm, timezone: e.target.value })
                  }
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="America/New_York">America/New_York</option>
                  <option value="Europe/Istanbul">Europe/Istanbul</option>
                  <option value="UTC">UTC</option>
                </select>
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updateMutation.isPending}
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
                >
                  {updateMutation.isPending ? 'Updating...' : 'Update'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Workspace Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-1/2 shadow-lg rounded-md bg-white">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Create New Workspace</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-400 hover:text-gray-500"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleCreateWorkspace} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Workspace Name</label>
                <input
                  type="text"
                  required
                  value={workspaceForm.name}
                  onChange={(e) =>
                    setWorkspaceForm({ ...workspaceForm, name: e.target.value })
                  }
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Currency</label>
                <select
                  value={workspaceForm.currency}
                  onChange={(e) =>
                    setWorkspaceForm({ ...workspaceForm, currency: e.target.value })
                  }
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="TRY">TRY</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Timezone</label>
                <select
                  value={workspaceForm.timezone}
                  onChange={(e) =>
                    setWorkspaceForm({ ...workspaceForm, timezone: e.target.value })
                  }
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="America/New_York">America/New_York</option>
                  <option value="Europe/Istanbul">Europe/Istanbul</option>
                  <option value="UTC">UTC</option>
                </select>
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
                >
                  {createMutation.isPending ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Role Permissions Modal */}
      {showRolePermissionsModal && selectedWorkspace && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-10 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-2/3 shadow-lg rounded-md bg-white max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Role & Screen Permissions - {selectedWorkspace.name}</h3>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setShowCreateRoleModal(true)
                  }}
                  className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-md"
                >
                  <PlusIcon className="h-4 w-4 mr-1.5" />
                  Create Custom Role
                </button>
                <button
                  onClick={() => {
                    setShowRolePermissionsModal(false)
                    setEditingRole(null)
                  }}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>
            </div>

            {rolePermissionsLoading ? (
              <div className="text-center py-8">Loading permissions...</div>
            ) : (
              <div className="space-y-6">
                {allRoles.map((roleData) => {
                  const role = roleData.role
                  const permissions = rolePermissions[role] || []
                  const screens = roleScreens[role] || []
                  const isEditing = editingRole === role
                  const availablePermissions = getAvailablePermissions()
                  const isStandardRole = STANDARD_ROLES.includes(role as Role)

                  return (
                    <div key={role} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-md font-semibold text-gray-900 capitalize">{role}</h4>
                            {roleData.isCustom && (
                              <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                                Custom
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-500">
                            {permissions.length} permission{permissions.length !== 1 ? 's' : ''}, {screens.length} screen{screens.length !== 1 ? 's' : ''}
                            {(permissions.includes('*') || screens.includes('*')) && ' (All access)'}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          {isEditing ? (
                            <>
                              <button
                                onClick={() => handleSaveRolePermissions(role)}
                                disabled={updateRolePermissionsMutation.isPending}
                                className="px-3 py-1.5 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-md disabled:opacity-50"
                              >
                                {updateRolePermissionsMutation.isPending ? 'Saving...' : 'Save'}
                              </button>
                              <button
                                onClick={() => {
                                  setEditingRole(null)
                                  // Reset to original
                                  if (allRoles.length > 0) {
                                    const originalRole = allRoles.find(r => r.role === role)
                                    if (originalRole) {
                                      setRolePermissions({ ...rolePermissions, [role]: originalRole.permissions })
                                      setRoleScreens({ ...roleScreens, [role]: originalRole.screens })
                                    }
                                  }
                                }}
                                className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => {
                                  setEditingRole(role)
                                }}
                                className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                              >
                                <PencilIcon className="h-4 w-4 inline mr-1" />
                                Edit
                              </button>
                              {isStandardRole && (
                                <button
                                  onClick={() => handleResetRolePermissions(role)}
                                  disabled={resetRolePermissionsMutation.isPending}
                                  className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
                                >
                                  Reset
                                </button>
                              )}
                              {!isStandardRole && (
                                <button
                                  onClick={() => handleDeleteCustomRole(role)}
                                  disabled={deleteCustomRoleMutation.isPending}
                                  className="px-3 py-1.5 text-sm font-medium text-red-700 bg-white border border-red-300 rounded-md hover:bg-red-50 disabled:opacity-50"
                                >
                                  <TrashIcon className="h-4 w-4 inline mr-1" />
                                  Delete
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </div>

                      {isEditing ? (
                        <div className="mt-4 space-y-4">
                          {/* Permissions Section */}
                          <div>
                            <div className="text-sm font-medium text-gray-700 mb-2">Permissions:</div>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                              {availablePermissions.map((permission) => {
                                const isChecked = permissions.includes(permission)
                                const isAllPermission = permission === '*'

                                return (
                                  <label
                                    key={permission}
                                    className={`flex items-center p-2 border rounded-md cursor-pointer ${
                                      isChecked
                                        ? 'bg-primary-50 border-primary-300'
                                        : 'bg-white border-gray-300 hover:bg-gray-50'
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={() => handleTogglePermission(role, permission)}
                                      className="mr-2 h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                                    />
                                    <span className="text-sm text-gray-700">
                                      {isAllPermission ? 'All Permissions' : permission.replace(/_/g, ' ')}
                                    </span>
                                  </label>
                                )
                              })}
                            </div>
                          </div>

                          {/* Screens Section */}
                          <div>
                            <div className="text-sm font-medium text-gray-700 mb-2">Screen Access:</div>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                              {AVAILABLE_SCREENS.map((screen) => {
                                const isChecked = screens.includes(screen.id) || screens.includes('*')

                                return (
                                  <label
                                    key={screen.id}
                                    className={`flex items-center p-2 border rounded-md cursor-pointer ${
                                      isChecked
                                        ? 'bg-green-50 border-green-300'
                                        : 'bg-white border-gray-300 hover:bg-gray-50'
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={() => handleToggleScreen(role, screen.id)}
                                      className="mr-2 h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                                    />
                                    <span className="text-sm text-gray-700">{screen.name}</span>
                                  </label>
                                )
                              })}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-3 space-y-3">
                          {/* Permissions Display */}
                          <div>
                            <div className="text-xs font-medium text-gray-500 mb-1">Permissions:</div>
                            <div className="flex flex-wrap gap-2">
                              {permissions.length === 0 ? (
                                <span className="text-sm text-gray-400">No permissions set</span>
                              ) : (
                                permissions.map((permission) => (
                                  <span
                                    key={permission}
                                    className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-800"
                                  >
                                    {permission === '*' ? 'All Permissions' : permission.replace(/_/g, ' ')}
                                  </span>
                                ))
                              )}
                            </div>
                          </div>
                          {/* Screens Display */}
                          <div>
                            <div className="text-xs font-medium text-gray-500 mb-1">Screens:</div>
                            <div className="flex flex-wrap gap-2">
                              {screens.length === 0 ? (
                                <span className="text-sm text-gray-400">No screens set</span>
                              ) : (
                                screens.map((screenId) => {
                                  const screen = AVAILABLE_SCREENS.find(s => s.id === screenId)
                                  return (
                                    <span
                                      key={screenId}
                                      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800"
                                    >
                                      {screenId === '*' ? 'All Screens' : (screen?.name || screenId)}
                                    </span>
                                  )
                                })
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            <div className="mt-6 pt-4 border-t">
              <p className="text-sm text-gray-500">
                <strong>Note:</strong> When you update role permissions or screens, existing users with that role will automatically get the new access.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Create Custom Role Modal */}
      {showCreateRoleModal && selectedWorkspace && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-1/2 shadow-lg rounded-md bg-white max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Create Custom Role</h3>
              <button
                onClick={() => {
                  setShowCreateRoleModal(false)
                  setNewRoleName('')
                  setNewRolePermissions([])
                  setNewRoleScreens([])
                }}
                className="text-gray-400 hover:text-gray-500"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleCreateCustomRole} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Role Name</label>
                <input
                  type="text"
                  required
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value)}
                  placeholder="e.g., warehouse-manager, sales-rep"
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Use lowercase letters, numbers, and hyphens only
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Permissions:</label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-48 overflow-y-auto border rounded-md p-2">
                  {getAvailablePermissions().map((permission) => {
                    const isChecked = newRolePermissions.includes(permission)
                    return (
                      <label
                        key={permission}
                        className={`flex items-center p-2 border rounded-md cursor-pointer ${
                          isChecked
                            ? 'bg-primary-50 border-primary-300'
                            : 'bg-white border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              if (permission === '*') {
                                setNewRolePermissions(['*'])
                              } else {
                                setNewRolePermissions(prev => prev.filter(p => p !== '*').concat(permission))
                              }
                            } else {
                              setNewRolePermissions(prev => prev.filter(p => p !== permission))
                            }
                          }}
                          className="mr-2 h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                        />
                        <span className="text-sm text-gray-700">
                          {permission === '*' ? 'All Permissions' : permission.replace(/_/g, ' ')}
                        </span>
                      </label>
                    )
                  })}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Screen Access:</label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-48 overflow-y-auto border rounded-md p-2">
                  {AVAILABLE_SCREENS.map((screen) => {
                    const isChecked = newRoleScreens.includes(screen.id)
                    return (
                      <label
                        key={screen.id}
                        className={`flex items-center p-2 border rounded-md cursor-pointer ${
                          isChecked
                            ? 'bg-green-50 border-green-300'
                            : 'bg-white border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              if (screen.id === '*') {
                                setNewRoleScreens(['*'])
                              } else {
                                setNewRoleScreens(prev => prev.filter(s => s !== '*').concat(screen.id))
                              }
                            } else {
                              setNewRoleScreens(prev => prev.filter(s => s !== screen.id))
                            }
                          }}
                          className="mr-2 h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                        />
                        <span className="text-sm text-gray-700">{screen.name}</span>
                      </label>
                    )
                  })}
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateRoleModal(false)
                    setNewRoleName('')
                    setNewRolePermissions([])
                    setNewRoleScreens([])
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createCustomRoleMutation.isPending}
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
                >
                  {createCustomRoleMutation.isPending ? 'Creating...' : 'Create Role'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add User Modal */}
      {showUserModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-10 mx-auto p-6 border w-11/12 md:w-2/3 lg:w-1/2 shadow-lg rounded-lg bg-white max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xl font-bold text-gray-900">Add User to Workspace</h3>
                <p className="text-sm text-gray-500 mt-1">Select an existing user and assign a role for this workspace</p>
              </div>
              <button
                onClick={() => {
                  setShowUserModal(false)
                  setSelectedUserId('')
                  setUserSearchTerm('')
                  setSelectedRole('staff')
                }}
                className="text-gray-400 hover:text-gray-500 transition-colors"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleAddUser} className="space-y-6">
              {/* User Search */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Search Users</label>
                <input
                  type="text"
                  placeholder="Search by email or name..."
                  value={userSearchTerm}
                  onChange={(e) => setUserSearchTerm(e.target.value)}
                  className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                />
              </div>

              {/* User List */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select User <span className="text-red-500">*</span>
                </label>
                {allUsersLoading ? (
                  <div className="text-center py-8 text-gray-500">Loading users...</div>
                ) : filteredUsers.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    {userSearchTerm 
                      ? 'No users found matching your search'
                      : availableUsers.length === 0
                        ? 'All users are already in this workspace'
                        : 'No users available'
                    }
                  </div>
                ) : (
                  <div className="border border-gray-200 rounded-md max-h-64 overflow-y-auto">
                    {filteredUsers.map((user) => {
                      const isSelected = selectedUserId === user.id
                      return (
                        <button
                          key={user.id}
                          type="button"
                          onClick={() => setSelectedUserId(user.id)}
                          className={`
                            w-full text-left px-4 py-3 border-b border-gray-100 last:border-b-0
                            transition-colors hover:bg-gray-50
                            ${isSelected ? 'bg-blue-50 border-blue-200' : ''}
                          `}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">
                                {user.displayName || 'No name'}
                              </p>
                              <p className="text-xs text-gray-500 truncate">{user.email || 'No email'}</p>
                            </div>
                            {isSelected && (
                              <div className="ml-3 flex-shrink-0">
                                <div className="w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center">
                                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                </div>
                              </div>
                            )}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Role Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Role <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value)}
                  required
                  disabled={!selectedUserId}
                  className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                >
                  {availableRolesForUser.map((roleData) => (
                    <option key={roleData.role} value={roleData.role}>
                      {roleData.role.charAt(0).toUpperCase() + roleData.role.slice(1)}
                      {roleData.isCustom && ' (Custom)'}
                    </option>
                  ))}
                </select>
                {selectedWorkspace && selectedRole && (
                  <div className="mt-3 p-3 bg-gray-50 rounded-md">
                    <p className="text-xs font-medium text-gray-600 mb-2">This role will have access to:</p>
                    <RolePermissionsPreview workspaceId={selectedWorkspace.id} role={selectedRole} />
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => {
                    setShowUserModal(false)
                    setSelectedUserId('')
                    setUserSearchTerm('')
                    setSelectedRole('staff')
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addUserMutation.isPending || !selectedUserId}
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {addUserMutation.isPending ? 'Adding...' : 'Add to Workspace'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </PageShell>
  )
}
