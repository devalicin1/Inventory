import { useState, type FC } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { 
  listWorkflows, 
  listWorkcenters, 
  listResources,
  listCustomers,
  createWorkflow,
  createWorkcenter,
  createResource,
  createCustomer,
  updateWorkflow,
  updateWorkcenter,
  updateResource,
  updateCustomer,
  deleteWorkflow,
  deleteWorkcenter,
  deleteResource,
  deleteCustomer
} from '../api/production-jobs'
import { 
  PlusIcon,
  PencilIcon,
  TrashIcon,
  CogIcon,
  UserGroupIcon,
  BuildingOfficeIcon,
  ArrowPathIcon,
  UserIcon
} from '@heroicons/react/24/outline'

interface ProductionSettingsProps {
  workspaceId: string
}

type SettingsTab = 'workflows' | 'workcenters' | 'resources' | 'customers' | 'general'

export function ProductionSettings({ workspaceId }: ProductionSettingsProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('workflows')
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingItem, setEditingItem] = useState<any>(null)
  const [formType, setFormType] = useState<'workflow' | 'workcenter' | 'resource' | 'customer' | null>(null)
  
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

  const { data: customers = [] } = useQuery({
    queryKey: ['customers', workspaceId],
    queryFn: () => listCustomers(workspaceId),
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

  const createCustomerMutation = useMutation({
    mutationFn: (data: any) => createCustomer(workspaceId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers', workspaceId] })
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

  const updateCustomerMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => updateCustomer(workspaceId, id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers', workspaceId] })
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

  const deleteCustomerMutation = useMutation({
    mutationFn: (id: string) => deleteCustomer(workspaceId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers', workspaceId] })
    },
  })

  const handleCreate = (type: 'workflow' | 'workcenter' | 'resource' | 'customer') => {
    setFormType(type)
    setEditingItem(null)
    setShowCreateForm(true)
  }

  const handleEdit = (item: any, type: 'workflow' | 'workcenter' | 'resource' | 'customer') => {
    setFormType(type)
    setEditingItem(item)
    setShowCreateForm(true)
  }

  const handleDelete = (id: string, type: 'workflow' | 'workcenter' | 'resource' | 'customer') => {
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
        case 'customer':
          deleteCustomerMutation.mutate(id)
          break
      }
    }
  }

  const tabs = [
    { id: 'workflows', name: 'Workflows', icon: ArrowPathIcon, description: 'Manage production workflows and stages' },
    { id: 'workcenters', name: 'Workcenters', icon: BuildingOfficeIcon, description: 'Configure work centers and stations' },
    { id: 'resources', name: 'Resources', icon: UserGroupIcon, description: 'Manage people and equipment resources' },
    { id: 'customers', name: 'Customers', icon: UserIcon, description: 'Manage customer information and addresses' },
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

        {activeTab === 'customers' && (
          <CustomersTab
            customers={customers}
            onEdit={(item) => handleEdit(item, 'customer')}
            onDelete={(id) => handleDelete(id, 'customer')}
            onCreate={() => handleCreate('customer')}
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
                case 'customer':
                  updateCustomerMutation.mutate({ id: editingItem.id, data })
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
                case 'customer':
                  createCustomerMutation.mutate(data)
                  break
              }
            }
          }}
          isLoading={
            createWorkflowMutation.isPending ||
            createWorkcenterMutation.isPending ||
            createResourceMutation.isPending ||
            createCustomerMutation.isPending ||
            updateWorkflowMutation.isPending ||
            updateWorkcenterMutation.isPending ||
            updateResourceMutation.isPending ||
            updateCustomerMutation.isPending
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

const CustomersTab: FC<{
  customers: any[]
  onEdit: (item: any) => void
  onDelete: (id: string) => void
  onCreate: () => void
}> = ({ customers, onEdit, onDelete, onCreate }) => {
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Customers</h3>
          <p className="text-sm text-gray-600">Manage customer information and addresses</p>
        </div>
        <button
          onClick={onCreate}
          className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
        >
          <PlusIcon className="h-4 w-4 mr-1" />
          Create Customer
        </button>
      </div>

      <div className="space-y-4">
        {customers.map((customer) => (
          <div key={customer.id} className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <h4 className="text-sm font-medium text-gray-900">{customer.name}</h4>
                {customer.companyName && (
                  <p className="text-sm text-gray-500">Company: {customer.companyName}</p>
                )}
                {customer.contactPerson && (
                  <p className="text-sm text-gray-500">Contact: {customer.contactPerson}</p>
                )}
                {customer.email && (
                  <p className="text-sm text-gray-500">Email: {customer.email}</p>
                )}
                {customer.phone && (
                  <p className="text-sm text-gray-500">Phone: {customer.phone}</p>
                )}
                {customer.mobile && (
                  <p className="text-sm text-gray-500">Mobile: {customer.mobile}</p>
                )}
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => onEdit(customer)}
                  className="p-2 text-gray-400 hover:text-gray-600"
                >
                  <PencilIcon className="h-4 w-4" />
                </button>
                <button
                  onClick={() => onDelete(customer.id)}
                  className="p-2 text-gray-400 hover:text-red-600"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
        {customers.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No customers found. Click "Create Customer" to add your first customer.
          </div>
        )}
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
  type: 'workflow' | 'workcenter' | 'resource' | 'customer' | null
  item: any
  onClose: () => void
  onSubmit: (data: any) => void
  isLoading: boolean
}> = ({ type, item, onClose, onSubmit, isLoading }) => {
  const [formData, setFormData] = useState(() => {
    if (item) {
      return { ...item }
    }
    
    // Initialize based on type
    if (type === 'workflow') {
      return {
        name: '',
        version: '1.0',
        isDefault: false,
        stages: [],
        allowedTransitions: [],
      }
    } else if (type === 'workcenter') {
      return {
        name: '',
        code: '',
        skills: [],
        location: '',
        capacityPerHour: 1,
        active: true,
      }
    } else if (type === 'resource') {
      return {
        name: '',
        type: 'person',
        skills: [],
        hourlyCost: 0,
        active: true,
      }
    } else if (type === 'customer') {
      return {
        name: '',
        code: '',
        companyName: '',
        contactPerson: '',
        email: '',
        phone: '',
        mobile: '',
        fax: '',
        billingAddress: {
          street: '',
          city: '',
          state: '',
          zipCode: '',
          country: '',
        },
        shippingAddress: {
          street: '',
          city: '',
          state: '',
          zipCode: '',
          country: '',
        },
        taxId: '',
        paymentTerms: '',
        creditLimit: 0,
        notes: '',
        active: true,
      }
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

  // Stage management state for workflows
  const [editingStage, setEditingStage] = useState<any>(null)
  const [showStageForm, setShowStageForm] = useState(false)
  const [stageFormData, setStageFormData] = useState({
    name: '',
    color: 'bg-blue-200',
    order: 1,
    wipLimit: 5,
    expectedSLAHours: 0,
    exitChecks: [] as string[],
    inputUOM: '' as '' | 'box' | 'sheets' | 'cartoon' | 'pieces',
    outputUOM: '' as '' | 'box' | 'sheets' | 'cartoon' | 'pieces',
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(formData)
  }

  // Stage management functions
  const handleAddStage = () => {
    setEditingStage(null)
    setStageFormData({
      name: '',
      color: 'bg-blue-200',
      order: (formData.stages?.length || 0) + 1,
      wipLimit: 5,
      expectedSLAHours: 0,
      exitChecks: [],
      inputUOM: '',
      outputUOM: '',
    })
    setShowStageForm(true)
  }

  const handleEditStage = (stage: any, index: number) => {
    setEditingStage(index)
    setStageFormData({
      name: stage.name,
      color: stage.color,
      order: stage.order,
      wipLimit: stage.wipLimit || 5,
      expectedSLAHours: stage.expectedSLAHours || 0,
      exitChecks: stage.exitChecks || [],
      inputUOM: stage.inputUOM || '',
      outputUOM: stage.outputUOM || '',
    })
    setShowStageForm(true)
  }

  const handleDeleteStage = (index: number) => {
    const newStages = formData.stages.filter((_: any, i: number) => i !== index)
    setFormData({...formData, stages: newStages})
  }

  const handleSaveStage = () => {
    const stage = {
      ...stageFormData,
      id: editingStage !== null ? formData.stages[editingStage].id : `stage${Date.now()}`,
    }
    
    let newStages
    if (editingStage !== null) {
      newStages = formData.stages.map((s: any, i: number) => i === editingStage ? stage : s)
    } else {
      newStages = [...(formData.stages || []), stage]
    }
    
    setFormData({...formData, stages: newStages})
    setShowStageForm(false)
    setEditingStage(null)
  }

  const handleToggleDefaultTransitions = () => {
    if (!formData.stages || formData.stages.length < 2) return
    const stages = formData.stages as any[]
    const transitions = stages.slice(0, -1).map((stage, index) => {
      const next = stages[index + 1]
      return {
        fromStageId: stage.id,
        toStageId: next.id,
        requireOutputToAdvance: true,
        minQtyToStartNextStage: undefined,
        unit: 'sheet',
        allowPartial: true,
      }
    })
    setFormData({
      ...formData,
      allowedTransitions: transitions,
    })
  }

  if (!type) return null

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className={`relative top-10 mx-auto p-5 border shadow-lg rounded-md bg-white ${type === 'workflow' ? 'w-full max-w-4xl' : type === 'customer' ? 'w-full max-w-3xl' : 'w-96'}`}>
        <div className="mt-3">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            {item ? 'Edit' : 'Create'} {type}
          </h3>
          
          {/* Stage & transition management UI for workflows */}
          {type === 'workflow' && !showStageForm && (
            <div className="mb-6 border border-gray-200 rounded-lg p-4 bg-gray-50">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-medium text-gray-900">Workflow Stages</h4>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleToggleDefaultTransitions}
                    className="inline-flex items-center px-2 py-1 text-xs font-medium text-blue-700 bg-white border border-blue-200 rounded hover:bg-blue-50"
                  >
                    Auto-generate transitions
                  </button>
                  <button
                    type="button"
                    onClick={handleAddStage}
                    className="inline-flex items-center px-2 py-1 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700"
                  >
                    <PlusIcon className="h-3 w-3 mr-1" />
                    Add Stage
                  </button>
                </div>
              </div>
              {formData.stages && formData.stages.length > 0 ? (
                <div className="space-y-2">
                  {formData.stages.map((stage: any, index: number) => (
                    <div key={index} className="flex items-center justify-between bg-white border border-gray-200 rounded p-2">
                      <div className="flex items-center space-x-3">
                        <div className={`w-3 h-3 rounded ${stage.color}`}></div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{stage.name}</p>
                          <p className="text-xs text-gray-500">
                            Order: {stage.order} • WIP Limit: {stage.wipLimit || 'Unlimited'}
                            {stage.inputUOM && stage.outputUOM && (
                              <span className="ml-2">• {stage.inputUOM} → {stage.outputUOM}</span>
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          type="button"
                          onClick={() => handleEditStage(stage, index)}
                          className="p-1 text-gray-400 hover:text-gray-600"
                        >
                          <PencilIcon className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteStage(index)}
                          className="p-1 text-gray-400 hover:text-red-600"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500 text-center py-4">No stages yet. Click "Add Stage" to create one.</p>
              )}
            </div>
          )}

          {type === 'workflow' && !showStageForm && (
            <div className="mb-6 border border-gray-200 rounded-lg p-4 bg-white">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h4 className="text-sm font-medium text-gray-900">Stage Transition Rules</h4>
                  <p className="text-xs text-gray-500">
                    Configure how jobs can move between stages and when the next stage is allowed to start.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={!formData.stages || formData.stages.length < 2}
                  onClick={() => {
                    if (!formData.stages || formData.stages.length < 2) return
                    const stages = formData.stages as any[]
                    const defaultFrom = stages[0]?.id
                    const defaultTo = stages[1]?.id
                    if (!defaultFrom || !defaultTo) return
                    const next = [...(formData.allowedTransitions as any[] || [])]
                    next.push({
                      fromStageId: defaultFrom,
                      toStageId: defaultTo,
                      requireOutputToAdvance: true,
                      minQtyToStartNextStage: undefined,
                      unit: 'sheet',
                      allowPartial: true,
                    })
                    setFormData({ ...formData, allowedTransitions: next })
                  }}
                  className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-md border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  <PlusIcon className="h-3 w-3 mr-1" />
                  Add transition
                </button>
              </div>

              {(!formData.allowedTransitions || formData.allowedTransitions.length === 0) && (
                <p className="text-sm text-gray-500 mb-2">
                  No transitions defined. Use &quot;Auto-generate transitions&quot; above for a linear path or &quot;Add transition&quot;
                  to define custom routes (e.g. stage 3 → stage 7).
                </p>
              )}

              {formData.allowedTransitions && formData.allowedTransitions.length > 0 && (
                <div className="space-y-2">
                  <div className="hidden md:flex text-xs font-semibold text-gray-500 uppercase tracking-wider px-1">
                    <span className="flex-1">From / To</span>
                    <span className="flex-[2] text-center">Rules</span>
                  </div>
                  <div className="divide-y divide-gray-100 border border-gray-200 rounded-md bg-white">
                    {(formData.allowedTransitions as any[]).map((t, idx: number) => {
                      const stages = (formData.stages || []) as any[]

                      const updateTransition = (patch: any) => {
                        const next = [...(formData.allowedTransitions as any[] || [])]
                        next[idx] = { ...t, ...patch }
                        setFormData({ ...formData, allowedTransitions: next })
                      }

                      const removeTransition = () => {
                        const next = (formData.allowedTransitions as any[] || []).filter((_: any, i: number) => i !== idx)
                        setFormData({ ...formData, allowedTransitions: next })
                      }

                      return (
                        <div
                          key={`${t.fromStageId}-${t.toStageId}-${idx}`}
                          className="px-3 py-3 space-y-2 text-sm"
                        >
                          {/* From / To row */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            <div className="flex flex-col">
                              <span className="text-xs text-gray-500 mb-1 md:hidden">From</span>
                              <select
                                className="w-full rounded-md border-2 border-gray-200 px-2 py-1 text-sm focus:border-blue-500 focus:ring-blue-100"
                                value={t.fromStageId || ''}
                                onChange={(e) => updateTransition({ fromStageId: e.target.value })}
                              >
                                <option value="">Select...</option>
                                {stages.map((s: any) => (
                                  <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                              </select>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-xs text-gray-500 mb-1 md:hidden">To</span>
                              <select
                                className="w-full rounded-md border-2 border-gray-200 px-2 py-1 text-sm focus:border-blue-500 focus:ring-blue-100"
                                value={t.toStageId || ''}
                                onChange={(e) => updateTransition({ toStageId: e.target.value })}
                              >
                                <option value="">Select...</option>
                                {stages.map((s: any) => (
                                  <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                              </select>
                            </div>
                          </div>

                          {/* Rule row */}
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                            <label className="flex items-center gap-2 text-xs text-gray-700">
                              <input
                                type="checkbox"
                                checked={!!t.requireOutputToAdvance}
                                onChange={(e) => updateTransition({ requireOutputToAdvance: e.target.checked })}
                                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              />
                              <span>Require output</span>
                            </label>
                            <div className="flex flex-col">
                              <span className="text-xs text-gray-500 mb-1">Min qty to start</span>
                              <input
                                type="number"
                                min={0}
                                value={t.minQtyToStartNextStage ?? ''}
                                onChange={(e) => {
                                  const raw = e.target.value
                                  updateTransition({
                                    minQtyToStartNextStage: raw === '' ? undefined : Number(raw),
                                  })
                                }}
                                className="w-full rounded-md border-2 border-gray-200 px-2 py-1 text-sm focus:border-blue-500 focus:ring-blue-100"
                                placeholder="Auto from plan"
                              />
                            </div>
                            <div className="flex flex-col">
                              <span className="text-xs text-gray-500 mb-1">Unit</span>
                              <input
                                type="text"
                                value={t.unit || 'sheet'}
                                onChange={(e) => updateTransition({ unit: e.target.value || 'sheet' })}
                                className="w-full rounded-md border-2 border-gray-200 px-2 py-1 text-sm focus:border-blue-500 focus:ring-blue-100"
                              />
                            </div>
                            <div className="flex items-center justify-between md:justify-start gap-2">
                              <label className="flex items-center gap-2 text-xs text-gray-700">
                                <input
                                  type="checkbox"
                                  checked={t.allowPartial !== false}
                                  onChange={(e) => updateTransition({ allowPartial: e.target.checked })}
                                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                                <span>Allow partial</span>
                              </label>
                              <button
                                type="button"
                                onClick={removeTransition}
                                className="p-1 text-gray-400 hover:text-red-600"
                                title="Remove transition"
                              >
                                <TrashIcon className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

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

            {type === 'workflow' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Version
                  </label>
                  <input
                    type="text"
                    value={formData.version || '1.0'}
                    onChange={(e) => setFormData({...formData, version: e.target.value})}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    required
                  />
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.isDefault !== false}
                    onChange={(e) => setFormData({...formData, isDefault: e.target.checked})}
                    className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                  <label className="ml-2 text-sm text-gray-700">Set as default workflow</label>
                </div>
              </>
            )}

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

            {type === 'customer' && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Customer Code
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
                      Company Name
                    </label>
                    <input
                      type="text"
                      value={formData.companyName || ''}
                      onChange={(e) => setFormData({...formData, companyName: e.target.value})}
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Contact Person
                  </label>
                  <input
                    type="text"
                    value={formData.contactPerson || ''}
                    onChange={(e) => setFormData({...formData, contactPerson: e.target.value})}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      value={formData.email || ''}
                      onChange={(e) => setFormData({...formData, email: e.target.value})}
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Phone
                    </label>
                    <input
                      type="text"
                      value={formData.phone || ''}
                      onChange={(e) => setFormData({...formData, phone: e.target.value})}
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Mobile
                    </label>
                    <input
                      type="text"
                      value={formData.mobile || ''}
                      onChange={(e) => setFormData({...formData, mobile: e.target.value})}
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div className="border-t pt-4">
                  <h4 className="text-sm font-semibold text-gray-900 mb-3">Billing Address</h4>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Street</label>
                      <input
                        type="text"
                        value={formData.billingAddress?.street || ''}
                        onChange={(e) => setFormData({...formData, billingAddress: {...formData.billingAddress, street: e.target.value}})}
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      />
                    </div>
                    <div className="grid grid-cols-4 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                        <input
                          type="text"
                          value={formData.billingAddress?.city || ''}
                          onChange={(e) => setFormData({...formData, billingAddress: {...formData.billingAddress, city: e.target.value}})}
                          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                        <input
                          type="text"
                          value={formData.billingAddress?.state || ''}
                          onChange={(e) => setFormData({...formData, billingAddress: {...formData.billingAddress, state: e.target.value}})}
                          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">ZIP Code</label>
                        <input
                          type="text"
                          value={formData.billingAddress?.zipCode || ''}
                          onChange={(e) => setFormData({...formData, billingAddress: {...formData.billingAddress, zipCode: e.target.value}})}
                          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
                        <input
                          type="text"
                          value={formData.billingAddress?.country || ''}
                          onChange={(e) => setFormData({...formData, billingAddress: {...formData.billingAddress, country: e.target.value}})}
                          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="border-t pt-4">
                  <h4 className="text-sm font-semibold text-gray-900 mb-3">Shipping Address</h4>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Street</label>
                      <input
                        type="text"
                        value={formData.shippingAddress?.street || ''}
                        onChange={(e) => setFormData({...formData, shippingAddress: {...formData.shippingAddress, street: e.target.value}})}
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      />
                    </div>
                    <div className="grid grid-cols-4 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                        <input
                          type="text"
                          value={formData.shippingAddress?.city || ''}
                          onChange={(e) => setFormData({...formData, shippingAddress: {...formData.shippingAddress, city: e.target.value}})}
                          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                        <input
                          type="text"
                          value={formData.shippingAddress?.state || ''}
                          onChange={(e) => setFormData({...formData, shippingAddress: {...formData.shippingAddress, state: e.target.value}})}
                          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">ZIP Code</label>
                        <input
                          type="text"
                          value={formData.shippingAddress?.zipCode || ''}
                          onChange={(e) => setFormData({...formData, shippingAddress: {...formData.shippingAddress, zipCode: e.target.value}})}
                          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
                        <input
                          type="text"
                          value={formData.shippingAddress?.country || ''}
                          onChange={(e) => setFormData({...formData, shippingAddress: {...formData.shippingAddress, country: e.target.value}})}
                          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Tax ID
                    </label>
                    <input
                      type="text"
                      value={formData.taxId || ''}
                      onChange={(e) => setFormData({...formData, taxId: e.target.value})}
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Credit Limit
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.creditLimit || 0}
                      onChange={(e) => setFormData({...formData, creditLimit: parseFloat(e.target.value)})}
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Payment Terms
                  </label>
                  <input
                    type="text"
                    value={formData.paymentTerms || ''}
                    onChange={(e) => setFormData({...formData, paymentTerms: e.target.value})}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notes
                  </label>
                  <textarea
                    value={formData.notes || ''}
                    onChange={(e) => setFormData({...formData, notes: e.target.value})}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    rows={3}
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
      
      {/* Stage Form Modal (nested) */}
      {showStageForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              {editingStage !== null ? 'Edit Stage' : 'Add Stage'}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Stage Name
                </label>
                <input
                  type="text"
                  value={stageFormData.name}
                  onChange={(e) => setStageFormData({...stageFormData, name: e.target.value})}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Color
                </label>
                <select
                  value={stageFormData.color}
                  onChange={(e) => setStageFormData({...stageFormData, color: e.target.value})}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                >
                  <option value="bg-blue-200">Blue</option>
                  <option value="bg-green-200">Green</option>
                  <option value="bg-yellow-200">Yellow</option>
                  <option value="bg-red-200">Red</option>
                  <option value="bg-purple-200">Purple</option>
                  <option value="bg-gray-200">Gray</option>
                </select>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Order
                  </label>
                  <input
                    type="number"
                    value={stageFormData.order}
                    onChange={(e) => setStageFormData({...stageFormData, order: parseInt(e.target.value)})}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    WIP Limit
                  </label>
                  <input
                    type="number"
                    value={stageFormData.wipLimit}
                    onChange={(e) => setStageFormData({...stageFormData, wipLimit: parseInt(e.target.value)})}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Expected SLA (Hours)
                </label>
                <input
                  type="number"
                  value={stageFormData.expectedSLAHours}
                  onChange={(e) => setStageFormData({...stageFormData, expectedSLAHours: parseInt(e.target.value)})}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Input UOM
                  </label>
                  <select
                    value={stageFormData.inputUOM}
                    onChange={(e) => setStageFormData({...stageFormData, inputUOM: e.target.value as any})}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  >
                    <option value="">Select Input</option>
                    <option value="box">Box</option>
                    <option value="sheets">Sheets</option>
                    <option value="cartoon">Cartoon</option>
                    <option value="pieces">Pieces</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Output UOM
                  </label>
                  <select
                    value={stageFormData.outputUOM}
                    onChange={(e) => setStageFormData({...stageFormData, outputUOM: e.target.value as any})}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  >
                    <option value="">Select Output</option>
                    <option value="box">Box</option>
                    <option value="sheets">Sheets</option>
                    <option value="cartoon">Cartoon</option>
                    <option value="pieces">Pieces</option>
                  </select>
                </div>
              </div>
            </div>
            
            <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={() => {
                  setShowStageForm(false)
                  setEditingStage(null)
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveStage}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700"
              >
                {editingStage !== null ? 'Update' : 'Add'} Stage
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}