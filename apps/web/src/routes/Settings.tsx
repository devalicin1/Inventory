import React, { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSessionStore } from '../state/sessionStore'
import { 
  listUOMs, createUOM, updateUOM, deleteUOM,
  listCategories, createCategory, updateCategory, deleteCategory,
  listSubcategories, createSubcategory, updateSubcategory, deleteSubcategory,
  listCustomFields, createCustomField, updateCustomField, deleteCustomField,
  listStockReasons, createStockReason, updateStockReason, deleteStockReason,
  initializeDefaultStockReasons,
  getReportSettings, updateReportSettings
} from '../api/settings'
import { listGroups } from '../api/products'
import {
  listVendors,
  createVendor,
  updateVendor,
  deleteVendor,
  type Vendor,
  type VendorInput,
} from '../api/vendors'
import {
  listAddresses,
  createAddress,
  updateAddress,
  deleteAddress,
  type Address,
  type AddressInput,
} from '../api/addresses'
import {
  getCompanyInformation,
  updateCompanyInformation,
  type CompanyInformation,
  type CompanyInformationInput,
} from '../api/company'

export function Settings() {
  const [activeTab, setActiveTab] = useState<'uom' | 'categories' | 'subcategories' | 'custom-fields' | 'stock-reasons' | 'report-settings' | 'vendors' | 'addresses' | 'company-information'>('uom')
  const [showCreate, setShowCreate] = useState(false)
  const [editingItem, setEditingItem] = useState<any>(null)
  const [formData, setFormData] = useState<any>({})
  const { workspaceId } = useSessionStore()
  const queryClient = useQueryClient()

  // UOM queries
  const { data: uoms = [], isLoading: uomsLoading } = useQuery({
    queryKey: ['uoms', workspaceId],
    queryFn: () => listUOMs(workspaceId!),
    enabled: !!workspaceId && activeTab === 'uom'
  })

  // Categories queries
  const { data: categories = [], isLoading: categoriesLoading } = useQuery({
    queryKey: ['categories', workspaceId],
    queryFn: () => listCategories(workspaceId!),
    enabled: !!workspaceId && activeTab === 'categories'
  })

  // Subcategories queries
  const { data: subcategories = [], isLoading: subcategoriesLoading } = useQuery({
    queryKey: ['subcategories', workspaceId],
    queryFn: () => listSubcategories(workspaceId!),
    enabled: !!workspaceId && activeTab === 'subcategories'
  })

  // Groups queries
  const { data: groups = [] } = useQuery({
    queryKey: ['groups', workspaceId],
    queryFn: () => listGroups(workspaceId!),
    enabled: !!workspaceId && (activeTab === 'custom-fields' || activeTab === 'report-settings')
  })

  // Report settings queries
  const { data: reportSettings, isLoading: reportSettingsLoading } = useQuery({
    queryKey: ['reportSettings', workspaceId],
    queryFn: () => getReportSettings(workspaceId!),
    enabled: !!workspaceId && activeTab === 'report-settings'
  })

  // Custom fields queries
  const { data: customFields = [], isLoading: customFieldsLoading } = useQuery({
    queryKey: ['customFields', workspaceId],
    queryFn: () => listCustomFields(workspaceId!),
    enabled: !!workspaceId && activeTab === 'custom-fields'
  })

  // Stock reasons queries
  const { data: stockReasons = [], isLoading: stockReasonsLoading } = useQuery({
    queryKey: ['stockReasons', workspaceId],
    queryFn: () => listStockReasons(workspaceId!),
    enabled: !!workspaceId && activeTab === 'stock-reasons'
  })

  // Vendors queries
  const { data: vendors = [], isLoading: vendorsLoading } = useQuery({
    queryKey: ['vendors', workspaceId],
    queryFn: () => listVendors(workspaceId!),
    enabled: !!workspaceId && activeTab === 'vendors'
  })

  // Addresses queries
  const { data: addresses = [], isLoading: addressesLoading } = useQuery({
    queryKey: ['addresses', workspaceId],
    queryFn: () => listAddresses(workspaceId!),
    enabled: !!workspaceId && (activeTab === 'addresses' || activeTab === 'vendors')
  })

  // Company information queries
  const { data: companyInfo, isLoading: companyInfoLoading } = useQuery({
    queryKey: ['companyInformation', workspaceId],
    queryFn: () => getCompanyInformation(workspaceId!),
    enabled: !!workspaceId && activeTab === 'company-information'
  })

  const handleCreate = async () => {
    if (!workspaceId) return
    
    try {
      switch (activeTab) {
        case 'uom':
          await createUOM(workspaceId, formData)
          break
        case 'categories':
          await createCategory(workspaceId, formData)
          break
        case 'subcategories':
          await createSubcategory(workspaceId, formData)
          break
        case 'custom-fields':
          await createCustomField(workspaceId, {
            name: String(formData.name || '').trim(),
            type: formData.type,
            options: formData.type === 'select'
              ? String(formData.options || '')
                  .split('\n')
                  .map((s: string) => s.trim())
                  .filter(Boolean)
              : undefined,
            required: Boolean(formData.required),
            active: formData.active === undefined ? true : Boolean(formData.active),
            groupId: formData.groupId ? String(formData.groupId) : undefined,
          })
          break
        case 'stock-reasons':
          await createStockReason(workspaceId, {
            name: String(formData.name || '').trim(),
            operationType: formData.operationType,
            description: formData.description?.trim() || undefined,
            active: formData.active === undefined ? true : Boolean(formData.active),
          })
          break
        case 'vendors':
          await createVendor(workspaceId, {
            name: String(formData.name || '').trim(),
            address1: formData.address1?.trim() || undefined,
            address2: formData.address2?.trim() || undefined,
            city: formData.city?.trim() || undefined,
            state: formData.state?.trim() || undefined,
            zipCode: formData.zipCode?.trim() || undefined,
            country: formData.country?.trim() || undefined,
            email: formData.email?.trim() || undefined,
            phoneNumber: formData.phoneNumber?.trim() || undefined,
            notes: formData.notes?.trim() || undefined,
          } as any)
          break
        case 'addresses':
          await createAddress(workspaceId, {
            name: String(formData.name || '').trim(),
            address1: String(formData.address1 || '').trim(),
            address2: formData.address2?.trim() || undefined,
            city: String(formData.city || '').trim(),
            state: formData.state?.trim() || undefined,
            zipCode: String(formData.zipCode || '').trim(),
            country: String(formData.country || '').trim(),
            type: formData.type || 'both',
            notes: formData.notes?.trim() || undefined,
          } as any)
          break
      }
      
      queryClient.invalidateQueries({ queryKey: [activeTab === 'custom-fields' ? 'customFields' : activeTab + 's', workspaceId] })
      setShowCreate(false)
      setFormData({})
    } catch (error) {
      console.error('Create error:', error)
      alert('Oluşturulurken hata oluştu: ' + (error instanceof Error ? error.message : 'Bilinmeyen hata'))
    }
  }

  const handleUpdate = async () => {
    if (!workspaceId || !editingItem) return
    
    try {
      switch (activeTab) {
        case 'uom':
          await updateUOM(workspaceId, editingItem.id, formData)
          break
        case 'categories':
          await updateCategory(workspaceId, editingItem.id, formData)
          break
        case 'subcategories':
          await updateSubcategory(workspaceId, editingItem.id, formData)
          break
        case 'custom-fields':
          await updateCustomField(workspaceId, editingItem.id, {
            name: String(formData.name || '').trim(),
            type: formData.type,
            options: formData.type === 'select'
              ? String(formData.options || '')
                  .split('\n')
                  .map((s: string) => s.trim())
                  .filter(Boolean)
              : undefined,
            required: Boolean(formData.required),
            active: formData.active === undefined ? true : Boolean(formData.active),
            groupId: formData.groupId ? String(formData.groupId) : undefined,
          })
          break
        case 'stock-reasons':
          await updateStockReason(workspaceId, editingItem.id, {
            name: String(formData.name || '').trim(),
            operationType: formData.operationType,
            description: formData.description?.trim() || undefined,
            active: formData.active === undefined ? true : Boolean(formData.active),
          })
          break
        case 'vendors':
          await updateVendor(workspaceId, editingItem.id, {
            name: String(formData.name || '').trim(),
            address1: formData.address1?.trim() || undefined,
            address2: formData.address2?.trim() || undefined,
            city: formData.city?.trim() || undefined,
            state: formData.state?.trim() || undefined,
            zipCode: formData.zipCode?.trim() || undefined,
            country: formData.country?.trim() || undefined,
            email: formData.email?.trim() || undefined,
            phoneNumber: formData.phoneNumber?.trim() || undefined,
            notes: formData.notes?.trim() || undefined,
          } as any)
          break
        case 'addresses':
          await updateAddress(workspaceId, editingItem.id, {
            name: String(formData.name || '').trim(),
            address1: String(formData.address1 || '').trim(),
            address2: formData.address2?.trim() || undefined,
            city: String(formData.city || '').trim(),
            state: formData.state?.trim() || undefined,
            zipCode: String(formData.zipCode || '').trim(),
            country: String(formData.country || '').trim(),
            type: formData.type || 'both',
            notes: formData.notes?.trim() || undefined,
          } as any)
          break
        case 'company-information':
          await updateCompanyInformation(workspaceId, {
            name: String(formData.name || '').trim(),
            address1: formData.address1?.trim() || undefined,
            address2: formData.address2?.trim() || undefined,
            city: formData.city?.trim() || undefined,
            state: formData.state?.trim() || undefined,
            zipCode: formData.zipCode?.trim() || undefined,
            country: formData.country?.trim() || undefined,
            email: formData.email?.trim() || undefined,
            phoneNumber: formData.phoneNumber?.trim() || undefined,
            taxId: formData.taxId?.trim() || undefined,
            registrationNumber: formData.registrationNumber?.trim() || undefined,
            website: formData.website?.trim() || undefined,
            notes: formData.notes?.trim() || undefined,
          } as any)
          break
      }
      
      queryClient.invalidateQueries({ queryKey: [activeTab === 'custom-fields' ? 'customFields' : activeTab + 's', workspaceId] })
      setEditingItem(null)
      setFormData({})
    } catch (error) {
      console.error('Update error:', error)
      alert('Güncellenirken hata oluştu: ' + (error instanceof Error ? error.message : 'Bilinmeyen hata'))
    }
  }

  const handleDelete = async (id: string) => {
    if (!workspaceId || !confirm('Bu öğeyi silmek istediğinizden emin misiniz?')) return
    
    try {
      switch (activeTab) {
        case 'uom':
          await deleteUOM(workspaceId, id)
          break
        case 'categories':
          await deleteCategory(workspaceId, id)
          break
        case 'subcategories':
          await deleteSubcategory(workspaceId, id)
          break
        case 'custom-fields':
          await deleteCustomField(workspaceId, id)
          break
        case 'stock-reasons':
          await deleteStockReason(workspaceId, id)
          break
        case 'vendors':
          await deleteVendor(workspaceId, id)
          break
        case 'addresses':
          await deleteAddress(workspaceId, id)
          break
      }
      
      queryClient.invalidateQueries({ queryKey: [activeTab === 'custom-fields' ? 'customFields' : activeTab + 's', workspaceId] })
    } catch (error) {
      console.error('Delete error:', error)
      alert('Silinirken hata oluştu: ' + (error instanceof Error ? error.message : 'Bilinmeyen hata'))
    }
  }

  const getCurrentData = () => {
    switch (activeTab) {
      case 'uom': return uoms
      case 'categories': return categories
      case 'subcategories': return subcategories
      case 'custom-fields': return customFields
      case 'stock-reasons': return stockReasons
      case 'vendors': return vendors
      case 'addresses': return addresses
      default: return []
    }
  }

  const getCurrentLoading = () => {
    switch (activeTab) {
      case 'uom': return uomsLoading
      case 'categories': return categoriesLoading
      case 'subcategories': return subcategoriesLoading
      case 'custom-fields': return customFieldsLoading
      case 'stock-reasons': return stockReasonsLoading
      case 'vendors': return vendorsLoading
      case 'addresses': return addressesLoading
      case 'company-information': return companyInfoLoading
      default: return false
    }
  }

  const getFormFields = () => {
    switch (activeTab) {
      case 'uom':
        return [
          { name: 'name', label: 'Unit Name', type: 'text', required: true },
          { name: 'symbol', label: 'Symbol', type: 'text', required: true },
          { name: 'description', label: 'Description', type: 'textarea' }
        ]
      case 'categories':
        return [
          { name: 'name', label: 'Category Name', type: 'text', required: true },
          { name: 'description', label: 'Description', type: 'textarea' }
        ]
      case 'subcategories':
        return [
          { name: 'name', label: 'Subcategory Name', type: 'text', required: true },
          { name: 'categoryId', label: 'Category', type: 'select', required: true, options: categories },
          { name: 'description', label: 'Description', type: 'textarea' }
        ]
      case 'custom-fields':
        return [
          { name: 'name', label: 'Field Name', type: 'text', required: true },
          { name: 'type', label: 'Field Type', type: 'select', required: true, options: [
            { id: 'text', name: 'Text' },
            { id: 'number', name: 'Number' },
            { id: 'date', name: 'Date' },
            { id: 'boolean', name: 'Yes/No' },
            { id: 'select', name: 'Dropdown' }
          ]},
          { name: 'groupId', label: 'Apply to Group', type: 'select', options: [
            { id: '', name: 'All Groups' },
            ...groups.map(g => ({ id: g.id, name: g.name }))
          ]},
          { name: 'options', label: 'Options (for dropdown)', type: 'textarea', placeholder: 'Option 1\nOption 2\nOption 3' },
          { name: 'required', label: 'Required', type: 'checkbox' },
          { name: 'active', label: 'Active', type: 'checkbox' }
        ]
      case 'stock-reasons':
        return [
          { name: 'name', label: 'Reason Name', type: 'text', required: true },
          { name: 'operationType', label: 'Operation Type', type: 'select', required: true, options: [
            { id: 'stock_in', name: 'Stock In' },
            { id: 'stock_out', name: 'Stock Out' },
            { id: 'transfer', name: 'Transfer' },
            { id: 'adjustment', name: 'Adjustment' }
          ]},
          { name: 'description', label: 'Description', type: 'textarea', placeholder: 'Optional description for this reason' },
          { name: 'active', label: 'Active', type: 'checkbox' }
        ]
      case 'vendors':
        return [
          { name: 'name', label: 'Vendor Name', type: 'text', required: true },
          { name: 'address1', label: 'Address 1', type: 'text' },
          { name: 'address2', label: 'Address 2', type: 'text' },
          { name: 'city', label: 'City', type: 'text' },
          { name: 'state', label: 'State / Province / Region', type: 'text' },
          { name: 'zipCode', label: 'Zip / Postal Code', type: 'text' },
          { name: 'country', label: 'Country', type: 'text' },
          { name: 'email', label: 'Email', type: 'email' },
          { name: 'phoneNumber', label: 'Phone Number', type: 'tel' },
          { name: 'notes', label: 'Notes', type: 'textarea' }
        ]
      case 'addresses':
        return [
          { name: 'name', label: 'Address Name', type: 'text', required: true },
          { name: 'address1', label: 'Address 1', type: 'text', required: true },
          { name: 'address2', label: 'Address 2', type: 'text' },
          { name: 'city', label: 'City', type: 'text', required: true },
          { name: 'state', label: 'State / Province / Region', type: 'text' },
          { name: 'zipCode', label: 'Zip / Postal Code', type: 'text', required: true },
          { name: 'country', label: 'Country', type: 'text', required: true },
          { name: 'type', label: 'Address Type', type: 'select', required: true, options: [
            { id: 'ship', name: 'Ship To' },
            { id: 'bill', name: 'Bill To' },
            { id: 'both', name: 'Both' }
          ]},
          { name: 'notes', label: 'Notes', type: 'textarea' }
        ]
      default:
        return []
    }
  }

  if (!workspaceId) {
    return (
      <div className="p-4">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600">Manage units of measure, categories, subcategories, and custom fields</p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'uom', name: 'Units of Measure', icon: '📏' },
            { id: 'categories', name: 'Categories', icon: '📁' },
            { id: 'subcategories', name: 'Subcategories', icon: '📂' },
            { id: 'custom-fields', name: 'Custom Fields', icon: '⚙️' },
            { id: 'stock-reasons', name: 'Stock Reasons', icon: '📋' },
            { id: 'report-settings', name: 'Report Settings', icon: '📊' },
            { id: 'vendors', name: 'Vendors', icon: '🏢' },
            { id: 'addresses', name: 'Addresses', icon: '📍' },
            { id: 'company-information', name: 'Company Information', icon: '🏛️' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.name}
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-900">
              {activeTab === 'uom' && 'Units of Measure'}
              {activeTab === 'categories' && 'Categories'}
              {activeTab === 'subcategories' && 'Subcategories'}
              {activeTab === 'custom-fields' && 'Custom Fields'}
              {activeTab === 'stock-reasons' && 'Stock Operation Reasons'}
              {activeTab === 'report-settings' && 'Report Customization'}
              {activeTab === 'vendors' && 'Vendors'}
              {activeTab === 'addresses' && 'Addresses'}
              {activeTab === 'company-information' && 'Company Information'}
            </h2>
            {activeTab !== 'report-settings' && activeTab !== 'company-information' && (
              <div className="flex space-x-2">
                {activeTab === 'stock-reasons' && stockReasons.length === 0 && (
                  <button
                    onClick={async () => {
                      if (!workspaceId) return
                      try {
                        await initializeDefaultStockReasons(workspaceId)
                        queryClient.invalidateQueries({ queryKey: ['stockReasons', workspaceId] })
                        alert('Default stock reasons have been initialized!')
                      } catch (error) {
                        console.error('Initialize error:', error)
                        alert('Error initializing default reasons: ' + (error instanceof Error ? error.message : 'Unknown error'))
                      }
                    }}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    Initialize Defaults
                  </button>
                )}
                <button
                  onClick={() => {
                    setShowCreate(true)
                    setEditingItem(null)
                    setFormData({})
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Add New
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="p-6">
          {activeTab === 'company-information' ? (
            <CompanyInformationTab
              companyInfo={companyInfo}
              isLoading={companyInfoLoading}
              onSave={async (data) => {
                if (!workspaceId) return
                try {
                  await updateCompanyInformation(workspaceId, data)
                  queryClient.invalidateQueries({ queryKey: ['companyInformation', workspaceId] })
                  alert('Company information saved successfully!')
                } catch (error) {
                  console.error('Save error:', error)
                  alert('Error saving company information: ' + (error instanceof Error ? error.message : 'Unknown error'))
                }
              }}
            />
          ) : activeTab === 'report-settings' ? (
            <ReportSettingsTab 
              groups={groups}
              reportSettings={reportSettings}
              isLoading={reportSettingsLoading}
              onSave={async (rawMaterialGroupIds) => {
                if (!workspaceId) return
                try {
                  await updateReportSettings(workspaceId, { rawMaterialGroupIds })
                  queryClient.invalidateQueries({ queryKey: ['reportSettings', workspaceId] })
                  alert('Report settings saved successfully!')
                } catch (error) {
                  console.error('Save error:', error)
                  alert('Error saving report settings: ' + (error instanceof Error ? error.message : 'Unknown error'))
                }
              }}
            />
          ) : getCurrentLoading() ? (
            <div className="animate-pulse space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-16 bg-gray-200 rounded"></div>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {getCurrentData().map((item: any) => (
                <div key={item.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900">{item.name}</h3>
                    {item.description && (
                      <p className="text-sm text-gray-600 mt-1">{item.description}</p>
                    )}
                    {item.symbol && (
                      <p className="text-sm text-gray-500 mt-1">Symbol: {item.symbol}</p>
                    )}
                    {item.categoryId && (
                      <p className="text-sm text-gray-500 mt-1">
                        Category: {categories.find(c => c.id === item.categoryId)?.name || 'Unknown'}
                      </p>
                    )}
                    {item.type && (
                      <p className="text-sm text-gray-500 mt-1">Type: {item.type}</p>
                    )}
                    {item.operationType && (
                      <p className="text-sm text-gray-500 mt-1">
                        Operation: {item.operationType.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </p>
                    )}
                    {item.groupId && (
                      <p className="text-sm text-gray-500 mt-1">
                        Group: {groups.find(g => g.id === item.groupId)?.name || 'Unknown'}
                      </p>
                    )}
                    {!item.groupId && activeTab !== 'stock-reasons' && activeTab !== 'vendors' && activeTab !== 'addresses' && (
                      <p className="text-sm text-gray-500 mt-1">Group: All Groups</p>
                    )}
                    {activeTab === 'vendors' && (
                      <>
                        {item.address1 && (
                          <p className="text-sm text-gray-500 mt-1">Address: {item.address1}</p>
                        )}
                        {item.city && (
                          <p className="text-sm text-gray-500 mt-1">City: {item.city}</p>
                        )}
                        {item.email && (
                          <p className="text-sm text-gray-500 mt-1">Email: {item.email}</p>
                        )}
                        {item.phoneNumber && (
                          <p className="text-sm text-gray-500 mt-1">Phone: {item.phoneNumber}</p>
                        )}
                      </>
                    )}
                    {activeTab === 'addresses' && (
                      <>
                        <p className="text-sm text-gray-500 mt-1">Address: {item.address1}</p>
                        {item.city && item.country && (
                          <p className="text-sm text-gray-500 mt-1">{item.city}, {item.country}</p>
                        )}
                        <p className="text-sm text-gray-500 mt-1">
                          Type: {item.type === 'ship' ? 'Ship To' : item.type === 'bill' ? 'Bill To' : 'Both'}
                        </p>
                      </>
                    )}
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => {
                        setEditingItem(item)
                        setFormData(item)
                        setShowCreate(true)
                      }}
                      className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="px-3 py-1 text-sm border border-red-300 text-red-700 rounded hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
              {getCurrentData().length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No items found. Click "Add New" to create your first item.
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Create/Edit Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-xl">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">
                    {editingItem ? 'Edit' : 'Create'} {
                      activeTab === 'uom' ? 'Unit of Measure' : 
                      activeTab === 'custom-fields' ? 'Custom Field' : 
                      activeTab === 'stock-reasons' ? 'Stock Reason' :
                      activeTab === 'vendors' ? 'Vendor' :
                      activeTab === 'addresses' ? 'Address' :
                      activeTab.slice(0, -1)
                    }
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    {editingItem ? 'Update the details below' : 'Fill in the details to create a new item'}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowCreate(false)
                    setEditingItem(null)
                    setFormData({})
                  }}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6">
            
              <form onSubmit={(e) => {
                e.preventDefault()
                if (editingItem) {
                  handleUpdate()
                } else {
                  handleCreate()
                }
              }}>
                <div className="space-y-6">
                  {getFormFields().map((field) => (
                    <div key={field.name} className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">
                        {field.label} {field.required && <span className="text-red-500">*</span>}
                      </label>
                      {field.type === 'textarea' ? (
                        <textarea
                          name={field.name}
                          value={formData[field.name] || ''}
                          onChange={(e) => setFormData({ ...formData, [field.name]: e.target.value })}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                          rows={3}
                          placeholder={field.placeholder}
                          required={field.required}
                        />
                      ) : field.type === 'select' ? (
                        <select
                          name={field.name}
                          value={formData[field.name] || ''}
                          onChange={(e) => setFormData({ ...formData, [field.name]: e.target.value })}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                          required={field.required}
                        >
                          <option value="">Select {field.label}</option>
                          {field.options?.map((option: any) => (
                            <option key={option.id} value={option.id}>
                              {option.name}
                            </option>
                          ))}
                        </select>
                      ) : field.type === 'checkbox' ? (
                        <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                          <input
                            type="checkbox"
                            name={field.name}
                            checked={formData[field.name] || false}
                            onChange={(e) => setFormData({ ...formData, [field.name]: e.target.checked })}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          <label className="text-sm font-medium text-gray-700">{field.label}</label>
                        </div>
                      ) : (
                        <input
                          type={field.type}
                          name={field.name}
                          value={formData[field.name] || ''}
                          onChange={(e) => setFormData({ ...formData, [field.name]: e.target.value })}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                          required={field.required}
                          placeholder={field.placeholder}
                        />
                      )}
                    </div>
                  ))}
                </div>
                
                {/* Modal Footer */}
                <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 rounded-b-xl">
                  <div className="flex justify-end space-x-3">
                    <button
                      type="button"
                      onClick={() => {
                        setShowCreate(false)
                        setEditingItem(null)
                        setFormData({})
                      }}
                      className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors font-medium"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center"
                    >
                      {editingItem ? (
                        <>
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          Update
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                          Create
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Report Settings Tab Component
function ReportSettingsTab({ 
  groups, 
  reportSettings, 
  isLoading,
  onSave 
}: { 
  groups: any[]
  reportSettings: any
  isLoading: boolean
  onSave: (rawMaterialGroupIds: string[]) => void
}) {
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([])

  React.useEffect(() => {
    if (reportSettings?.rawMaterialGroupIds) {
      setSelectedGroupIds(reportSettings.rawMaterialGroupIds)
    }
  }, [reportSettings])

  const handleToggleGroup = (groupId: string) => {
    setSelectedGroupIds(prev => 
      prev.includes(groupId)
        ? prev.filter(id => id !== groupId)
        : [...prev, groupId]
    )
  }

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-16 bg-gray-200 rounded"></div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="text-sm font-medium text-blue-900 mb-2">Report Customization</h3>
        <p className="text-sm text-blue-700">
          Select product folders (groups) that should be treated as raw materials. 
          Products in these folders will be excluded from reports.
        </p>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">Raw Material Folders</h3>
        {groups.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No product folders found. Create folders in the Inventory page first.
          </div>
        ) : (
          <div className="space-y-2">
            {groups.map((group) => (
              <label
                key={group.id}
                className="flex items-center space-x-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selectedGroupIds.includes(group.id)}
                  onChange={() => handleToggleGroup(group.id)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <div className="flex-1">
                  <span className="text-sm font-medium text-gray-900">{group.name}</span>
                  {selectedGroupIds.includes(group.id) && (
                    <span className="ml-2 text-xs text-red-600 font-medium">(Raw Material)</span>
                  )}
                </div>
              </label>
            ))}
          </div>
        )}
      </div>

      <div className="flex justify-end pt-4 border-t border-gray-200">
        <button
          onClick={() => onSave(selectedGroupIds)}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          Save Settings
        </button>
      </div>
    </div>
  )
}

// Company Information Tab Component
function CompanyInformationTab({
  companyInfo,
  isLoading,
  onSave
}: {
  companyInfo: CompanyInformation | null | undefined
  isLoading: boolean
  onSave: (data: CompanyInformationInput) => void
}) {
  const [formData, setFormData] = useState<CompanyInformationInput>({
    name: '',
    address1: '',
    address2: '',
    city: '',
    state: '',
    zipCode: '',
    country: '',
    email: '',
    phoneNumber: '',
    taxId: '',
    registrationNumber: '',
    website: '',
    notes: '',
  })

  useEffect(() => {
    if (companyInfo) {
      setFormData({
        name: companyInfo.name || '',
        address1: companyInfo.address1 || '',
        address2: companyInfo.address2 || '',
        city: companyInfo.city || '',
        state: companyInfo.state || '',
        zipCode: companyInfo.zipCode || '',
        country: companyInfo.country || '',
        email: companyInfo.email || '',
        phoneNumber: companyInfo.phoneNumber || '',
        taxId: companyInfo.taxId || '',
        registrationNumber: companyInfo.registrationNumber || '',
        website: companyInfo.website || '',
        notes: companyInfo.notes || '',
      })
    }
  }, [companyInfo])

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-16 bg-gray-200 rounded"></div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <form onSubmit={(e) => {
        e.preventDefault()
        onSave(formData)
      }}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Company Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Address 1</label>
            <input
              type="text"
              value={formData.address1}
              onChange={(e) => setFormData({ ...formData, address1: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Address 2</label>
            <input
              type="text"
              value={formData.address2}
              onChange={(e) => setFormData({ ...formData, address2: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
            <input
              type="text"
              value={formData.city}
              onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">State / Province / Region</label>
            <input
              type="text"
              value={formData.state}
              onChange={(e) => setFormData({ ...formData, state: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Zip / Postal Code</label>
            <input
              type="text"
              value={formData.zipCode}
              onChange={(e) => setFormData({ ...formData, zipCode: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
            <input
              type="text"
              value={formData.country}
              onChange={(e) => setFormData({ ...formData, country: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
            <input
              type="tel"
              value={formData.phoneNumber}
              onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tax ID</label>
            <input
              type="text"
              value={formData.taxId}
              onChange={(e) => setFormData({ ...formData, taxId: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Registration Number</label>
            <input
              type="text"
              value={formData.registrationNumber}
              onChange={(e) => setFormData({ ...formData, registrationNumber: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
            <input
              type="url"
              value={formData.website}
              onChange={(e) => setFormData({ ...formData, website: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={4}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        <div className="flex justify-end pt-6 border-t border-gray-200 mt-6">
          <button
            type="submit"
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Save Company Information
          </button>
        </div>
      </form>
    </div>
  )
}
