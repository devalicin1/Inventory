import { useState, type FC } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { 
  listWorkflows, 
  listWorkcenters, 
  listResources,
  createWorkflow,
  createWorkcenter,
  createResource,
  updateWorkflow,
  updateWorkcenter,
  updateResource,
  deleteWorkflow,
  deleteWorkcenter,
  deleteResource
} from '../api/production-jobs'
import { 
  PlusIcon,
  PencilIcon,
  TrashIcon,
  CogIcon,
  UserGroupIcon,
  BuildingOfficeIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline'

interface ProductionSettingsProps {
  workspaceId: string
}

type SettingsTab = 'workflows' | 'workcenters' | 'resources' | 'general'

export function ProductionSettings({ workspaceId }: ProductionSettingsProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('workflows')
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingItem, setEditingItem] = useState<any>(null)
  const [formType, setFormType] = useState<'workflow' | 'workcenter' | 'resource' | null>(null)
  
  const queryClient = useQueryClient()

  // Fetch data
  const { data: workflows = [] } = useQuery({
    queryKey: ['workflows', workspaceId],
    queryFn: () => listWorkflows(workspaceId),
  })

  const { data: workcenters = [] } = useQuery({
    queryKey: ['workcenters', workspaceId],
    queryFn: () => listWorkcenters(workspaceId),
  })

  const { data: resources = [] } = useQuery({
    queryKey: ['resources', workspaceId],
    queryFn: () => listResources(workspaceId),
  })

  // Mutations
  const createWorkflowMutation = useMutation({
    mutationFn: (data: any) => createWorkflow(workspaceId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflows', workspaceId] })
      setShowCreateForm(false)
    },
  })

  const createWorkcenterMutation = useMutation({
    mutationFn: (data: any) => createWorkcenter(workspaceId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workcenters', workspaceId] })
      setShowCreateForm(false)
    },
  })

  const createResourceMutation = useMutation({
    mutationFn: (data: any) => createResource(workspaceId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resources', workspaceId] })
      setShowCreateForm(false)
    },
  })

  const updateWorkflowMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => updateWorkflow(workspaceId, id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflows', workspaceId] })
      setEditingItem(null)
    },
  })

  const updateWorkcenterMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => updateWorkcenter(workspaceId, id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workcenters', workspaceId] })
      setEditingItem(null)
    },
  })

  const updateResourceMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => updateResource(workspaceId, id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resources', workspaceId] })
      setEditingItem(null)
    },
  })

  const deleteWorkflowMutation = useMutation({
    mutationFn: (id: string) => deleteWorkflow(workspaceId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflows', workspaceId] })
    },
  })

  const deleteWorkcenterMutation = useMutation({
    mutationFn: (id: string) => deleteWorkcenter(workspaceId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workcenters', workspaceId] })
    },
  })

  const deleteResourceMutation = useMutation({
    mutationFn: (id: string) => deleteResource(workspaceId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resources', workspaceId] })
    },
  })

  const handleCreate = (type: 'workflow' | 'workcenter' | 'resource') => {
    setFormType(type)
    setEditingItem(null)
    setShowCreateForm(true)
  }

  const handleEdit = (item: any, type: 'workflow' | 'workcenter' | 'resource') => {
    setFormType(type)
    setEditingItem(item)
    setShowCreateForm(true)
  }

  const handleDelete = (id: string, type: 'workflow' | 'workcenter' | 'resource') => {
    if (confirm('Are you sure you want to delete this item?')) {
      switch (type) {
        case 'workflow':
          deleteWorkflowMutation.mutate(id)
          break
        case 'workcenter':
          deleteWorkcenterMutation.mutate(id)
          break
        case 'resource':
          deleteResourceMutation.mutate(id)
          break
      }
    }
  }

  const tabs = [
    { id: 'workflows', name: 'Workflows', icon: ArrowPathIcon, description: 'Manage production workflows and stages' },
    { id: 'workcenters', name: 'Workcenters', icon: BuildingOfficeIcon, description: 'Configure work centers and stations' },
    { id: 'resources', name: 'Resources', icon: UserGroupIcon, description: 'Manage people and equipment resources' },
    { id: 'general', name: 'General', icon: CogIcon, description: 'System settings and preferences' },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Production Settings</h2>
          <p className="text-sm text-gray-600">Configure workflows, workcenters, and system settings</p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8">
          {tabs.map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as SettingsTab)}
                className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
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

      {/* Tab Content */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        {activeTab === 'workflows' && (
          <WorkflowsTab
            workflows={workflows}
            onEdit={(item) => handleEdit(item, 'workflow')}
            onDelete={(id) => handleDelete(id, 'workflow')}
            onCreate={() => handleCreate('workflow')}
          />
        )}

        {activeTab === 'workcenters' && (
          <WorkcentersTab
            workcenters={workcenters}
            onEdit={(item) => handleEdit(item, 'workcenter')}
            onDelete={(id) => handleDelete(id, 'workcenter')}
            onCreate={() => handleCreate('workcenter')}
          />
        )}

        {activeTab === 'resources' && (
          <ResourcesTab
            resources={resources}
            onEdit={(item) => handleEdit(item, 'resource')}
            onDelete={(id) => handleDelete(id, 'resource')}
            onCreate={() => handleCreate('resource')}
          />
        )}

        {activeTab === 'general' && (
          <GeneralTab />
        )}
      </div>

      {/* Create/Edit Modal */}
      {showCreateForm && (
        <CreateEditModal
          type={formType}
          item={editingItem}
          onClose={() => {
            setShowCreateForm(false)
            setEditingItem(null)
            setFormType(null)
          }}
          onSubmit={(data) => {
            if (editingItem) {
              switch (formType) {
                case 'workflow':
                  updateWorkflowMutation.mutate({ id: editingItem.id, data })
                  break
                case 'workcenter':
                  updateWorkcenterMutation.mutate({ id: editingItem.id, data })
                  break
                case 'resource':
                  updateResourceMutation.mutate({ id: editingItem.id, data })
                  break
              }
            } else {
              switch (formType) {
                case 'workflow':
                  createWorkflowMutation.mutate(data)
                  break
                case 'workcenter':
                  createWorkcenterMutation.mutate(data)
                  break
                case 'resource':
                  createResourceMutation.mutate(data)
                  break
              }
            }
          }}
          isLoading={
            createWorkflowMutation.isPending ||
            createWorkcenterMutation.isPending ||
            createResourceMutation.isPending ||
            updateWorkflowMutation.isPending ||
            updateWorkcenterMutation.isPending ||
            updateResourceMutation.isPending
          }
        />
      )}
    </div>
  )
}

// Tab Components
const WorkflowsTab: FC<{
  workflows: any[]
  onEdit: (item: any) => void
  onDelete: (id: string) => void
  onCreate: () => void
}> = ({ workflows, onEdit, onDelete, onCreate }) => {
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Workflows</h3>
          <p className="text-sm text-gray-600">Define production workflows and stage transitions</p>
        </div>
        <button
          onClick={onCreate}
          className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
        >
          <PlusIcon className="h-4 w-4 mr-1" />
          Create Workflow
        </button>
      </div>

      <div className="space-y-4">
        {workflows.map((workflow) => (
          <div key={workflow.id} className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-medium text-gray-900">{workflow.name}</h4>
                <p className="text-sm text-gray-500">Version {workflow.version}</p>
                <p className="text-sm text-gray-500">{workflow.stages?.length || 0} stages</p>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => onEdit(workflow)}
                  className="p-2 text-gray-400 hover:text-gray-600"
                >
                  <PencilIcon className="h-4 w-4" />
                </button>
                <button
                  onClick={() => onDelete(workflow.id)}
                  className="p-2 text-gray-400 hover:text-red-600"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

const WorkcentersTab: FC<{
  workcenters: any[]
  onEdit: (item: any) => void
  onDelete: (id: string) => void
  onCreate: () => void
}> = ({ workcenters, onEdit, onDelete, onCreate }) => {
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Workcenters</h3>
          <p className="text-sm text-gray-600">Configure production stations and equipment</p>
        </div>
        <button
          onClick={onCreate}
          className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
        >
          <PlusIcon className="h-4 w-4 mr-1" />
          Create Workcenter
        </button>
      </div>

      <div className="space-y-4">
        {workcenters.map((workcenter) => (
          <div key={workcenter.id} className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-medium text-gray-900">{workcenter.name}</h4>
                <p className="text-sm text-gray-500">Code: {workcenter.code}</p>
                <p className="text-sm text-gray-500">Location: {workcenter.location}</p>
                <p className="text-sm text-gray-500">Capacity: {workcenter.capacityPerHour}/hour</p>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => onEdit(workcenter)}
                  className="p-2 text-gray-400 hover:text-gray-600"
                >
                  <PencilIcon className="h-4 w-4" />
                </button>
                <button
                  onClick={() => onDelete(workcenter.id)}
                  className="p-2 text-gray-400 hover:text-red-600"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

const ResourcesTab: FC<{
  resources: any[]
  onEdit: (item: any) => void
  onDelete: (id: string) => void
  onCreate: () => void
}> = ({ resources, onEdit, onDelete, onCreate }) => {
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Resources</h3>
          <p className="text-sm text-gray-600">Manage people and equipment resources</p>
        </div>
        <button
          onClick={onCreate}
          className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
        >
          <PlusIcon className="h-4 w-4 mr-1" />
          Create Resource
        </button>
      </div>

      <div className="space-y-4">
        {resources.map((resource) => (
          <div key={resource.id} className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-medium text-gray-900">{resource.name}</h4>
                <p className="text-sm text-gray-500">Type: {resource.type}</p>
                <p className="text-sm text-gray-500">Skills: {resource.skills?.join(', ') || 'None'}</p>
                <p className="text-sm text-gray-500">Cost: ${resource.hourlyCost}/hour</p>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => onEdit(resource)}
                  className="p-2 text-gray-400 hover:text-gray-600"
                >
                  <PencilIcon className="h-4 w-4" />
                </button>
                <button
                  onClick={() => onDelete(resource.id)}
                  className="p-2 text-gray-400 hover:text-red-600"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

const GeneralTab: FC = () => {
  return (
    <div className="p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-6">General Settings</h3>
      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Default Workflow
          </label>
          <select className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500">
            <option>Select a default workflow</option>
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Default Workcenter
          </label>
          <select className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500">
            <option>Select a default workcenter</option>
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Auto-assign Resources
          </label>
          <input
            type="checkbox"
            className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          />
          <span className="ml-2 text-sm text-gray-600">Automatically assign available resources to new jobs</span>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            SLA Warning Hours
          </label>
          <input
            type="number"
            defaultValue={24}
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          />
          <p className="mt-1 text-sm text-gray-500">Hours before due date to show warning</p>
        </div>
      </div>
    </div>
  )
}

// Create/Edit Modal
const CreateEditModal: FC<{
  type: 'workflow' | 'workcenter' | 'resource' | null
  item: any
  onClose: () => void
  onSubmit: (data: any) => void
  isLoading: boolean
}> = ({ type, item, onClose, onSubmit, isLoading }) => {
  const [formData, setFormData] = useState(() => {
    if (item) {
      return { ...item }
    }
    return {
      name: '',
      code: '',
      description: '',
      type: 'person',
      skills: [],
      location: '',
      capacityPerHour: 1,
      hourlyCost: 0,
      active: true,
    }
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(formData)
  }

  if (!type) return null

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
        <div className="mt-3">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            {item ? 'Edit' : 'Create'} {type}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Name
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                required
              />
            </div>

            {type === 'workcenter' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Code
                  </label>
                  <input
                    type="text"
                    value={formData.code || ''}
                    onChange={(e) => setFormData({...formData, code: e.target.value})}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Location
                  </label>
                  <input
                    type="text"
                    value={formData.location || ''}
                    onChange={(e) => setFormData({...formData, location: e.target.value})}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Capacity per Hour
                  </label>
                  <input
                    type="number"
                    value={formData.capacityPerHour || 1}
                    onChange={(e) => setFormData({...formData, capacityPerHour: parseInt(e.target.value)})}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
              </>
            )}

            {type === 'resource' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Type
                  </label>
                  <select
                    value={formData.type || 'person'}
                    onChange={(e) => setFormData({...formData, type: e.target.value})}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  >
                    <option value="person">Person</option>
                    <option value="machine">Machine</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Skills (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={formData.skills?.join(', ') || ''}
                    onChange={(e) => setFormData({...formData, skills: e.target.value.split(',').map(s => s.trim()).filter(Boolean)})}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Hourly Cost
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.hourlyCost || 0}
                    onChange={(e) => setFormData({...formData, hourlyCost: parseFloat(e.target.value)})}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
              </>
            )}

            <div className="flex items-center">
              <input
                type="checkbox"
                checked={formData.active !== false}
                onChange={(e) => setFormData({...formData, active: e.target.checked})}
                className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
              <label className="ml-2 text-sm text-gray-700">Active</label>
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {isLoading ? 'Saving...' : (item ? 'Update' : 'Create')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}