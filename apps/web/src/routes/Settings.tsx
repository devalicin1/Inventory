import React, { useState, useEffect, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSessionStore } from '../state/sessionStore'
import { hasWorkspacePermission } from '../utils/permissions'
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
import {
  getQuickBooksConfig,
  saveQuickBooksConfig,
  getQuickBooksAuthUrl,
  quickBooksOAuthCallback,
  syncProductToQuickBooks,
  syncInventoryFromQuickBooks,
  importProductsFromQuickBooks,
  getQuickBooksItems,
  type QuickBooksConfig,
  type QuickBooksConnectionStatus,
} from '../api/quickbooks'
import { listProducts } from '../api/inventory'
import { PageShell } from '../components/layout/PageShell'
import { showToast } from '../components/ui/Toast'
import {
  ArrowPathIcon,
  CheckCircleIcon,
  XCircleIcon,
  LinkIcon,
} from '@heroicons/react/24/outline'
import { collection, doc, getDoc, onSnapshot, serverTimestamp, setDoc, type Unsubscribe } from 'firebase/firestore'
import { db } from '../lib/firebase'

export function Settings() {
  // Check for tab parameter in URL
  const urlParams = new URLSearchParams(window.location.search)
  const tabParam = urlParams.get('tab')
  const initialTab = (tabParam && ['uom', 'categories', 'subcategories', 'custom-fields', 'stock-reasons', 'report-settings', 'vendors', 'addresses', 'company-information', 'quickbooks'].includes(tabParam))
    ? tabParam as any
    : 'uom'
  
  const [activeTab, setActiveTab] = useState<'uom' | 'categories' | 'subcategories' | 'custom-fields' | 'stock-reasons' | 'report-settings' | 'vendors' | 'addresses' | 'company-information' | 'quickbooks'>(initialTab)
  const [showCreate, setShowCreate] = useState(false)
  const [editingItem, setEditingItem] = useState<any>(null)
  const [formData, setFormData] = useState<any>({})
  const [canManageSettings, setCanManageSettings] = useState(false)
  const [modalError, setModalError] = useState<string | null>(null)
  const { workspaceId, userId } = useSessionStore()
  const queryClient = useQueryClient()

  // Check permission for managing settings
  useEffect(() => {
    if (!workspaceId || !userId) {
      setCanManageSettings(false)
      return
    }

    hasWorkspacePermission(workspaceId, userId, 'manage_settings')
      .then((hasPermission) => {
        setCanManageSettings(hasPermission)
      })
      .catch(() => {
        setCanManageSettings(false)
      })
  }, [workspaceId, userId])

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

  // QuickBooks queries
  const { data: quickBooksStatus, isLoading: quickBooksLoading, refetch: refetchQuickBooks } = useQuery({
    queryKey: ['quickBooksConfig', workspaceId],
    queryFn: () => getQuickBooksConfig(workspaceId!),
    enabled: !!workspaceId && activeTab === 'quickbooks'
  })

  // Products query for sync
  const { data: products = [] } = useQuery({
    queryKey: ['products', workspaceId],
    queryFn: () => listProducts(workspaceId!),
    enabled: !!workspaceId && activeTab === 'quickbooks'
  })

  const handleCreate = async () => {
    if (!workspaceId) return
    if (!canManageSettings) {
      alert('You do not have permission to manage settings.')
      return
    }
    
    try {
      setModalError(null)
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
      setModalError(null)
    } catch (error) {
      console.error('Create error:', error)
      setModalError(error instanceof Error ? error.message : 'An unknown error occurred while creating the item.')
    }
  }

  const handleUpdate = async () => {
    if (!workspaceId || !editingItem) return
    
    try {
      setModalError(null)
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
      setModalError(null)
    } catch (error) {
      console.error('Update error:', error)
      setModalError(error instanceof Error ? error.message : 'An unknown error occurred while updating the item.')
    }
  }

  const handleDelete = async (id: string) => {
    if (!canManageSettings) {
      alert('You do not have permission to manage settings.')
      return
    }
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
      alert('An error occurred while deleting the item: ' + (error instanceof Error ? error.message : 'Unknown error'))
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
    <PageShell
      title="Settings"
      subtitle="Manage units of measure, categories, subcategories, and custom fields"
    >
      {/* Tabs */}
      <div className="border-b border-gray-200">
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
            { id: 'company-information', name: 'Company Information', icon: '🏛️' },
            { id: 'quickbooks', name: 'QuickBooks', icon: '💼' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-2 px-1 border-b-2 font-medium text-sm h-11 ${
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
      <div className="bg-white rounded-[14px] border border-gray-200">
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
              {activeTab === 'quickbooks' && 'QuickBooks Integration'}
            </h2>
            {activeTab !== 'report-settings' && activeTab !== 'company-information' && activeTab !== 'quickbooks' && canManageSettings && (
              <div className="flex space-x-2">
                {activeTab === 'uom' && uoms.length === 0 && (
                  <button
                    onClick={async () => {
                      if (!workspaceId) return
                      try {
                        const defaultUoms = [
                          { name: 'Piece', symbol: 'pc', description: 'Individual units' },
                          { name: 'Box', symbol: 'box', description: 'Box of items' },
                          { name: 'Kilogram', symbol: 'kg', description: 'Weight in kilograms' },
                          { name: 'Litre', symbol: 'L', description: 'Volume in litres' },
                        ]
                        await Promise.all(defaultUoms.map(uom => createUOM(workspaceId, uom)))
                        queryClient.invalidateQueries({ queryKey: ['uoms', workspaceId] })
                        alert('Common units of measure have been created. You can edit or remove them anytime.')
                      } catch (error) {
                        console.error('Initialize UOMs error:', error)
                        alert('Error creating default units: ' + (error instanceof Error ? error.message : 'Unknown error'))
                      }
                    }}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    Use Common UOMs
                  </button>
                )}

                {activeTab === 'categories' && categories.length === 0 && (
                  <button
                    onClick={async () => {
                      if (!workspaceId) return
                      try {
                        const defaultCategories = [
                          { name: 'Raw Materials', description: 'Materials used to produce finished goods' },
                          { name: 'Work In Progress', description: 'Items currently in production' },
                          { name: 'Finished Goods', description: 'Ready-to-sell products' },
                          { name: 'Packaging', description: 'Boxes, labels and other packing materials' },
                          { name: 'Maintenance & Tools', description: 'Tools, spare parts and maintenance supplies' },
                        ]
                        await Promise.all(defaultCategories.map(cat => createCategory(workspaceId, cat)))
                        queryClient.invalidateQueries({ queryKey: ['categories', workspaceId] })
                        alert('Common categories have been created. You can edit or remove them anytime.')
                      } catch (error) {
                        console.error('Initialize categories error:', error)
                        alert('Error creating default categories: ' + (error instanceof Error ? error.message : 'Unknown error'))
                      }
                    }}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    Use Common Categories
                  </button>
                )}

                {activeTab === 'subcategories' && subcategories.length === 0 && categories.length > 0 && (
                  <button
                    onClick={async () => {
                      if (!workspaceId) return
                      try {
                        const byName = (name: string) => categories.find(c => c.name.toLowerCase() === name.toLowerCase())?.id
                        const defaultSubs = [
                          { name: 'Steel & Metals', parent: 'Raw Materials', description: 'Steel, aluminium and other metals' },
                          { name: 'Plastics & Resin', parent: 'Raw Materials', description: 'Plastic granules, resin and similar inputs' },
                          { name: 'Labels & Stickers', parent: 'Packaging', description: 'Product and shipping labels' },
                          { name: 'Cartons & Pallets', parent: 'Packaging', description: 'Outer cartons, pallets and wraps' },
                          { name: 'Spare Parts', parent: 'Maintenance & Tools', description: 'Critical spare parts and components' },
                        ].filter(sub => byName(sub.parent))

                        await Promise.all(
                          defaultSubs.map(sub =>
                            createSubcategory(workspaceId, {
                              name: sub.name,
                              categoryId: byName(sub.parent)!,
                              description: sub.description,
                            })
                          )
                        )
                        queryClient.invalidateQueries({ queryKey: ['subcategories', workspaceId] })
                        alert('Common subcategories have been created and linked to your categories. You can edit or remove them anytime.')
                      } catch (error) {
                        console.error('Initialize subcategories error:', error)
                        alert('Error creating default subcategories: ' + (error instanceof Error ? error.message : 'Unknown error'))
                      }
                    }}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    Use Common Subcategories
                  </button>
                )}

                {activeTab === 'stock-reasons' && stockReasons.length === 0 && (
                  <button
                    onClick={async () => {
                      if (!workspaceId) return
                      try {
                        await initializeDefaultStockReasons(workspaceId)
                        queryClient.invalidateQueries({ queryKey: ['stockReasons', workspaceId] })
                        alert('Default stock reasons have been initialized. You can edit or remove them anytime.')
                      } catch (error) {
                        console.error('Initialize error:', error)
                        alert('Error initializing default reasons: ' + (error instanceof Error ? error.message : 'Unknown error'))
                      }
                    }}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    Use Common Reasons
                  </button>
                )}

                <button
                  onClick={() => {
                    setShowCreate(true)
                    setEditingItem(null)
                    setFormData({})
                    setModalError(null)
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
                if (!canManageSettings) {
                  alert('You do not have permission to manage settings.')
                  return
                }
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
                if (!canManageSettings) {
                  alert('You do not have permission to manage settings.')
                  return
                }
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
          ) : activeTab === 'quickbooks' ? (
            <QuickBooksTab
              workspaceId={workspaceId || ''}
              status={quickBooksStatus}
              isLoading={quickBooksLoading}
              products={products}
              canManage={canManageSettings}
              onConfigSave={async (config) => {
                if (!workspaceId) return
                try {
                  await saveQuickBooksConfig(workspaceId, config)
                  refetchQuickBooks()
                  showToast('QuickBooks configuration saved successfully!', 'success')
                } catch (error) {
                  console.error('Save error:', error)
                  showToast('Error saving configuration: ' + (error instanceof Error ? error.message : 'Unknown error'), 'error')
                }
              }}
              onConnect={async () => {
                if (!workspaceId) return
                try {
                  const authUrl = await getQuickBooksAuthUrl(workspaceId)
                  window.open(authUrl, '_blank', 'width=600,height=700')
                } catch (error) {
                  console.error('Connect error:', error)
                  showToast('Error connecting to QuickBooks: ' + (error instanceof Error ? error.message : 'Unknown error'), 'error')
                }
              }}
              onImportProducts={async (skus?: string[]) => {
                // Note: This function is called from QuickBooksTab component
                // which handles the progress modal and job tracking
                // No toast needed here as progress modal shows all details
                if (!workspaceId) return
                try {
                  const result = await importProductsFromQuickBooks(workspaceId, skus)
                  // Progress modal will show the result, no need for toast
                  queryClient.invalidateQueries({ queryKey: ['products', workspaceId] })
                } catch (error) {
                  console.error('Import error:', error)
                  // Error will be shown in progress modal, no need for toast
                }
              }}
              onSyncInventory={async () => {
                if (!workspaceId) return
                try {
                  showToast('Syncing inventory from QuickBooks...', 'info')
                  await syncInventoryFromQuickBooks(workspaceId)
                  showToast('Inventory synced successfully!', 'success')
                  queryClient.invalidateQueries({ queryKey: ['products', workspaceId] })
                } catch (error) {
                  console.error('Sync error:', error)
                  showToast('Error syncing inventory: ' + (error instanceof Error ? error.message : 'Unknown error'), 'error')
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
                  {canManageSettings && (
                    <div className="flex space-x-2">
                      <button
                        onClick={() => {
                          setEditingItem(item)
                          setFormData(item)
                          setShowCreate(true)
                          setModalError(null)
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
                  )}
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
            <div className="p-6 space-y-4">
              {modalError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {modalError}
                </div>
              )}

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
    </PageShell>
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
  )
}

// QuickBooks Integration Tab Component
export function QuickBooksTab({
  workspaceId,
  status,
  isLoading,
  products,
  canManage,
  onConfigSave,
  onConnect,
  onImportProducts,
  onSyncInventory,
}: {
  workspaceId: string
  status: QuickBooksConnectionStatus | undefined
  isLoading: boolean
  products: any[]
  canManage: boolean
  onConfigSave: (config: QuickBooksConfig) => Promise<void>
  onConnect: () => Promise<void>
  onImportProducts: (skus?: string[]) => Promise<void>
  onSyncInventory: () => Promise<void>
}) {
  const [configForm, setConfigForm] = useState<QuickBooksConfig>({
    clientId: '',
    clientSecret: '',
    redirectUri: window.location.origin + '/quickbooks/callback',
    environment: 'sandbox',
  })
  const [showConfig, setShowConfig] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [showImportPreview, setShowImportPreview] = useState(false)
  const [previewItems, setPreviewItems] = useState<any[]>([])
  const [selectedSkus, setSelectedSkus] = useState<string[]>([])
  const [isLoadingPreview, setIsLoadingPreview] = useState(false)
  const [showImportProgress, setShowImportProgress] = useState(false)
  const [importJob, setImportJob] = useState<any | null>(null)
  const importJobUnsub = useRef<Unsubscribe | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)

  const isConnected = status?.connected || false

  // Load existing config when status changes
  useEffect(() => {
    if (status && !isConnected) {
      // Try to load existing config from Firestore via API
      // We'll need to get the full config (not just status)
      // For now, we'll keep the default redirectUri
    }
  }, [status, isConnected])

  const handleSyncInventory = async () => {
    setIsSyncing(true)
    try {
      await onSyncInventory()
    } finally {
      setIsSyncing(false)
    }
  }

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-16 bg-gray-200 rounded"></div>
        <div className="h-16 bg-gray-200 rounded"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Connection Status */}
      <div className={`p-4 rounded-lg border-2 ${
        isConnected 
          ? 'border-green-300 bg-green-50' 
          : 'border-yellow-300 bg-yellow-50'
      }`}>
          <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {isConnected ? (
              <CheckCircleIcon className="w-6 h-6 text-green-600" />
            ) : (
              <XCircleIcon className="w-6 h-6 text-yellow-600" />
            )}
            <div>
              <h3 className="font-semibold text-gray-900">
                {isConnected ? 'Connected to QuickBooks' : 'Not Connected'}
              </h3>
              <p className="text-sm text-gray-600">
                {isConnected 
                  ? `Environment: ${status?.environment || 'Unknown'} | Company ID: ${status?.realmId || 'Unknown'}`
                  : 'Connect your QuickBooks account to sync products and inventory'
                }
              </p>
            </div>
          </div>
          {canManage && (
            <button
              onClick={() => setShowConfig(!showConfig)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              {showConfig ? 'Hide' : isConnected ? 'Edit configuration' : 'Configure'}
            </button>
          )}
        </div>
      </div>

      {/* Configuration Form */}
      {showConfig && canManage && (
        <div className="bg-gray-50 rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">QuickBooks Configuration</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Client ID *
              </label>
              <input
                type="text"
                value={configForm.clientId || ''}
                onChange={(e) => setConfigForm({ ...configForm, clientId: e.target.value })}
                placeholder="Your QuickBooks Client ID"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Client Secret *
              </label>
              <input
                type="password"
                value={configForm.clientSecret || ''}
                onChange={(e) => setConfigForm({ ...configForm, clientSecret: e.target.value })}
                placeholder="Your QuickBooks Client Secret"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Redirect URI
              </label>
              <input
                type="text"
                value={configForm.redirectUri || ''}
                onChange={(e) => setConfigForm({ ...configForm, redirectUri: e.target.value })}
                placeholder="https://yourdomain.com/quickbooks/callback"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                This must match the redirect URI in your Intuit Developer app settings
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Environment
              </label>
              <select
                value={configForm.environment || 'sandbox'}
                onChange={(e) => setConfigForm({ ...configForm, environment: e.target.value as 'sandbox' | 'production' })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="sandbox">Sandbox (Testing)</option>
                <option value="production">Production (Live)</option>
              </select>
            </div>
            <div className="flex space-x-3">
              <button
                onClick={async () => {
                  if (!configForm.clientId || !configForm.clientSecret) {
                    showToast('Please fill in Client ID and Client Secret', 'error')
                    return
                  }
                  await onConfigSave(configForm)
                  setShowConfig(false)
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Save Configuration
              </button>
              <button
                onClick={() => setShowConfig(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Connect / Reconnect Button */}
      {canManage && (isConnected || (configForm.clientId && configForm.clientSecret)) && (
        <div className="bg-blue-50 rounded-lg border border-blue-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-900">
                {isConnected ? 'Reconnect to QuickBooks' : 'Ready to Connect'}
              </h3>
              <p className="text-sm text-gray-600">
                {isConnected
                  ? 'Click below to refresh the QuickBooks connection if there are authentication issues.'
                  : 'Click below to authorize this app with QuickBooks.'}
              </p>
            </div>
            <button
              onClick={onConnect}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
            >
              <LinkIcon className="w-5 h-5" />
              <span>{isConnected ? 'Reconnect QuickBooks' : 'Connect to QuickBooks'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Sync Actions */}
      {isConnected && canManage && (
        <div className="space-y-4">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Import from QuickBooks</h3>
            
            {/* Product Import */}
            <div className="mb-6">
              <h4 className="font-medium text-gray-900 mb-2">Import Products from QuickBooks</h4>
              <p className="text-sm text-gray-600 mb-4">
                Import all inventory items from QuickBooks to your system. Products will be created with their SKU, name, price, and stock levels. Existing products (by SKU) will be skipped.
              </p>
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">Create products from QuickBooks</p>
                  <p className="text-sm text-gray-600">All QuickBooks inventory items will be imported</p>
                </div>
                <button
                  onClick={async () => {
                    setShowImportPreview(true)
                    setPreviewError(null)
                    setIsLoadingPreview(true)
                    try {
                      const items = await getQuickBooksItems(workspaceId)
                      // Only inventory items with SKU and name
                      const filtered = items.filter(
                        (item: any) => item.Type === 'Inventory' && item.Sku && item.Name
                      )
                      const existingSkus = new Set(
                        (products || []).map((p: any) => (p.sku || '').toString())
                      )
                      const withFlags = filtered.map((item: any) => ({
                        ...item,
                        _isExisting: existingSkus.has((item.Sku || '').toString()),
                      }))
                      setPreviewItems(withFlags)
                      // Varsayılan: sadece yeni ürünleri seç
                      setSelectedSkus(
                        withFlags
                          .filter((i: any) => !i._isExisting)
                          .map((i: any) => (i.Sku || '').toString())
                      )
                    } catch (err: any) {
                      console.error('Preview import error:', err)
                      const message =
                        err instanceof Error
                          ? err.message
                          : typeof err === 'string'
                          ? err
                          : 'Error loading products from QuickBooks for preview.'
                      setPreviewError(message)
                    } finally {
                      setIsLoadingPreview(false)
                    }
                  }}
                  disabled={isSyncing}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                >
                  {isSyncing ? (
                    <>
                      <ArrowPathIcon className="w-5 h-5 animate-spin" />
                      <span>Importing...</span>
                    </>
                  ) : (
                    <>
                      <ArrowPathIcon className="w-5 h-5" />
                      <span>Import Products from QuickBooks</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Inventory Sync - Read Only */}
            <div>
              <h4 className="font-medium text-gray-900 mb-2">Import Inventory from QuickBooks</h4>
              <p className="text-sm text-gray-600 mb-4">
                Import inventory levels from QuickBooks to your system. Products are matched by SKU. This is a <strong>read-only</strong> operation - QuickBooks is not modified.
              </p>
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">Read-only import</p>
                  <p className="text-sm text-gray-600">Import inventory levels from QuickBooks (no changes to QuickBooks)</p>
                </div>
                <button
                  onClick={handleSyncInventory}
                  disabled={isSyncing}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                >
                  {isSyncing ? (
                    <>
                      <ArrowPathIcon className="w-5 h-5 animate-spin" />
                      <span>Syncing...</span>
                    </>
                  ) : (
                    <>
                      <ArrowPathIcon className="w-5 h-5" />
                      <span>Sync Inventory from QuickBooks</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Info Box */}
          <div className="bg-blue-50 rounded-lg border border-blue-200 p-4">
            <h4 className="font-medium text-blue-900 mb-2">How it works</h4>
            <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
              <li><strong>Import Products:</strong> Creates new products in your system from QuickBooks inventory items</li>
              <li><strong>Import Inventory:</strong> Updates stock levels for existing products (matched by SKU)</li>
              <li>Products are matched between systems using SKU codes</li>
              <li>This is a <strong>read-only</strong> operation - QuickBooks is not modified</li>
              <li>Existing products (by SKU) will be skipped during import</li>
            </ul>
          </div>
        </div>
      )}

      {!canManage && (
        <div className="text-center py-8 text-gray-500">
          You don't have permission to manage QuickBooks integration.
        </div>
      )}

      {/* Import Preview Modal */}
      {showImportPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30">
          <div className="bg-white rounded-lg shadow-lg max-w-5xl w-full max-h-[80vh] flex flex-col">
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">
                Preview Products from QuickBooks
              </h3>
              <button
                className="text-gray-500 hover:text-gray-700"
                onClick={() => setShowImportPreview(false)}
              >
                ✕
              </button>
            </div>

            <div className="px-6 py-4 flex-1 overflow-auto">
              {isLoadingPreview || isSyncing ? (
                <div className="py-8 flex flex-col items-center space-y-4 text-sm text-gray-600">
                  <div className="w-full max-w-md">
                    <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                      <div className="h-2 w-1/2 bg-blue-500 animate-pulse" />
                    </div>
                  </div>
                  <p>
                    {isSyncing
                      ? 'Importing selected products from QuickBooks. This may take a few minutes…'
                      : 'Loading products from QuickBooks. This may take a moment for larger catalogs…'}
                  </p>
                </div>
              ) : previewError ? (
                <div className="py-6">
                  <div className="mb-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                    <div className="font-semibold mb-1">Unable to load products from QuickBooks</div>
                    <p className="text-xs whitespace-pre-wrap break-words">{previewError}</p>
                  </div>
                  <p className="text-sm text-gray-600">
                    Please check your QuickBooks connection and try again. If the problem persists, share this
                    error with support.
                  </p>
                </div>
              ) : previewItems.length === 0 ? (
                <div className="py-8 text-center text-gray-500">
                  No inventory items found in QuickBooks.
                </div>
              ) : (
                <>
                  <div className="mb-3 flex items-center justify-between text-sm text-gray-600">
                    <div>
                      <span className="font-medium">
                        {selectedSkus.length} selected
                      </span>{' '}
                      out of {previewItems.length} inventory items.
                    </div>
                    <div className="space-x-2">
                      <button
                        className="px-3 py-1 rounded border border-gray-300 text-gray-700 text-xs hover:bg-gray-50"
                        onClick={() =>
                          setSelectedSkus(
                            previewItems
                              .filter((i: any) => !i._isExisting)
                              .map((i: any) => (i.Sku || '').toString())
                          )
                        }
                      >
                        Select all new
                      </button>
                      <button
                        className="px-3 py-1 rounded border border-gray-300 text-gray-700 text-xs hover:bg-gray-50"
                        onClick={() =>
                          setSelectedSkus(
                            previewItems.map((i: any) => (i.Sku || '').toString())
                          )
                        }
                      >
                        Select all
                      </button>
                      <button
                        className="px-3 py-1 rounded border border-gray-300 text-gray-700 text-xs hover:bg-gray-50"
                        onClick={() => setSelectedSkus([])}
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  <table className="min-w-full text-sm border border-gray-200 rounded">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 border-b">
                          <input
                            type="checkbox"
                            checked={
                              previewItems.length > 0 &&
                              selectedSkus.length === previewItems.length
                            }
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedSkus(
                                  previewItems.map((i: any) => (i.Sku || '').toString())
                                )
                              } else {
                                setSelectedSkus([])
                              }
                            }}
                          />
                        </th>
                        <th className="px-3 py-2 border-b text-left">SKU</th>
                        <th className="px-3 py-2 border-b text-left">Name</th>
                        <th className="px-3 py-2 border-b text-right">On Hand</th>
                        <th className="px-3 py-2 border-b text-right">Unit Price</th>
                        <th className="px-3 py-2 border-b text-left">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewItems.map((item: any) => {
                        const sku = (item.Sku || '').toString()
                        const isSelected = selectedSkus.includes(sku)
                        return (
                          <tr key={sku} className="hover:bg-gray-50">
                            <td className="px-3 py-2 border-b text-center">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedSkus((prev) =>
                                      prev.includes(sku) ? prev : [...prev, sku]
                                    )
                                  } else {
                                    setSelectedSkus((prev) =>
                                      prev.filter((s) => s !== sku)
                                    )
                                  }
                                }}
                              />
                            </td>
                            <td className="px-3 py-2 border-b font-mono text-xs">{sku}</td>
                            <td className="px-3 py-2 border-b">{item.Name}</td>
                            <td className="px-3 py-2 border-b text-right">
                              {item.QtyOnHand ?? 0}
                            </td>
                            <td className="px-3 py-2 border-b text-right">
                              {item.UnitPrice != null ? item.UnitPrice : '-'}
                            </td>
                            <td className="px-3 py-2 border-b">
                              {item._isExisting ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800 text-xs">
                                  Existing (will be skipped)
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-green-100 text-green-800 text-xs">
                                  New product
                                </span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </>
              )}
            </div>

            <div className="px-6 py-4 border-t flex items-center justify-end space-x-3">
              <button
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
                onClick={() => setShowImportPreview(false)}
              >
                Cancel
              </button>
              <button
                disabled={selectedSkus.length === 0 || isSyncing}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                onClick={async () => {
                  if (selectedSkus.length === 0) return
                  if (!workspaceId) return
                  setIsSyncing(true)
                  try {
                    // Create job document for progress tracking
                    const jobsCol = collection(db, 'workspaces', workspaceId, 'quickbooksImports')
                    const jobRef = doc(jobsCol)
                    await setDoc(jobRef, {
                      type: 'product_import',
                      trigger: 'manual',
                      status: 'running',
                      startedAt: serverTimestamp(),
                      totalItems: null,
                      processed: 0,
                      imported: 0,
                      updated: 0,
                      skipped: 0,
                      errors: 0,
                      allowedSkus: selectedSkus,
                    })

                    // Start listening for job progress BEFORE showing modal
                    if (importJobUnsub.current) {
                      importJobUnsub.current()
                    }
                    
                    // Set initial job state from document (in case it already exists)
                    const initialSnap = await getDoc(jobRef)
                    if (initialSnap.exists()) {
                      const initialData = initialSnap.data() || {}
                      setImportJob({ id: initialSnap.id, ...initialData })
                    }
                    
                    // Listen for job progress and refresh inventory when the job completes
                    importJobUnsub.current = onSnapshot(jobRef, (snap) => {
                      if (!snap.exists()) {
                        console.warn('[QuickBooks Import] Job document does not exist')
                        return
                      }
                      
                      const data = snap.data() || {}
                      // Handle null/undefined values properly
                      const processedValue = typeof data.processed === 'number' ? data.processed : 0
                      const totalItemsValue = typeof data.totalItems === 'number' ? data.totalItems : (data.totalItems === null ? null : 0)
                      const progressPercent = totalItemsValue && totalItemsValue > 0 
                        ? Math.round((processedValue / totalItemsValue) * 100) 
                        : 0
                      
                      console.log('[QuickBooks Import] Job update received:', {
                        id: snap.id,
                        status: data.status,
                        processed: processedValue,
                        totalItems: totalItemsValue,
                        totalItemsType: typeof data.totalItems,
                        progressPercent: totalItemsValue ? `${progressPercent}%` : 'N/A',
                        imported: data.imported || 0,
                        updated: data.updated || 0,
                        skipped: data.skipped || 0,
                        errors: data.errors || 0,
                        timestamp: new Date().toISOString(),
                        rawData: data, // Log raw data for debugging
                      })
                      
                      // Update state with latest data - this should trigger React re-render
                      const jobData = { 
                        id: snap.id, 
                        ...data,
                        // Ensure numeric values are properly set (preserve null for totalItems if not yet set)
                        processed: processedValue,
                        totalItems: totalItemsValue,
                      }
                      console.log('[QuickBooks Import] Updating state with:', {
                        processed: jobData.processed,
                        totalItems: jobData.totalItems,
                        totalItemsType: typeof jobData.totalItems,
                        status: jobData.status,
                      })
                      setImportJob(jobData)

                      const status = data.status
                      if (status === 'success' || status === 'failed') {
                        console.log('[QuickBooks Import] Job completed with status:', status)
                        // Force products list to refresh so Inventory screen sees latest on-hand
                        queryClient.invalidateQueries({ queryKey: ['products', workspaceId] })
                        // Also trigger the global stock update event used by Inventory.tsx
                        try {
                          window.dispatchEvent(new Event('stockTransactionCreated'))
                        } catch {
                          // Ignore if window is not available (e.g. SSR)
                        }
                      }
                    }, (error) => {
                      console.error('[QuickBooks Import] onSnapshot error:', error)
                      console.error('[QuickBooks Import] Error details:', {
                        code: error.code,
                        message: error.message,
                        stack: error.stack,
                      })
                    })

                    setShowImportProgress(true)
                    setShowImportPreview(false)

                    await onImportProducts(selectedSkus, jobRef.id)
                  } finally {
                    setIsSyncing(false)
                  }
                }}
              >
                {isSyncing ? 'Importing...' : 'Import selected products'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Progress Modal - New Design */}
      {showImportProgress && importJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full mx-4 max-h-[85vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="px-6 py-5 bg-gradient-to-r from-blue-600 to-blue-700 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold">Importing from QuickBooks</h3>
                    <p className="text-sm text-blue-100 mt-0.5">
                      {importJob.status === 'success'
                        ? 'Import completed successfully'
                        : importJob.status === 'failed'
                        ? 'Import finished with errors'
                        : 'Processing products in real-time...'}
                    </p>
                  </div>
                </div>
                <button
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={importJob.status !== 'success' && importJob.status !== 'failed'}
                  onClick={() => {
                    setShowImportProgress(false)
                    setImportJob(null)
                    if (importJobUnsub.current) {
                      importJobUnsub.current()
                      importJobUnsub.current = null
                    }
                  }}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="px-6 py-6 flex-1 overflow-auto space-y-6">
              {/* Progress Section */}
              <div className="space-y-4">
                {/* Progress Bar */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-bold text-gray-900">
                        {importJob.processed || 0}
                      </span>
                      <span className="text-lg text-gray-500">
                        / {importJob.totalItems ?? '…'} items
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {importJob.status === 'running' && (
                        <div className="flex items-center gap-2 text-blue-600">
                          <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"></div>
                          <span className="text-sm font-medium capitalize">Processing</span>
                        </div>
                      )}
                      {importJob.status === 'success' && (
                        <div className="flex items-center gap-2 text-green-600">
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          <span className="text-sm font-medium">Completed</span>
                        </div>
                      )}
                      {importJob.status === 'failed' && (
                        <div className="flex items-center gap-2 text-red-600">
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                          </svg>
                          <span className="text-sm font-medium">Failed</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Large Progress Bar */}
                  <div className="relative w-full bg-gray-200 rounded-full h-6 overflow-hidden shadow-inner">
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-500 ease-out flex items-center justify-end pr-2"
                      style={{
                        width: `${
                          importJob.totalItems
                            ? Math.min(
                                100,
                                Math.round(((importJob.processed || 0) / importJob.totalItems) * 100)
                              )
                            : 0
                        }%`,
                      }}
                    >
                      {importJob.totalItems && ((importJob.processed || 0) / importJob.totalItems) * 100 > 15 && (
                        <span className="text-xs font-semibold text-white">
                          {Math.round(((importJob.processed || 0) / importJob.totalItems) * 100)}%
                        </span>
                      )}
                    </div>
                    {importJob.totalItems && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-xs font-medium text-gray-600">
                          {importJob.totalItems
                            ? `${Math.round(((importJob.processed || 0) / importJob.totalItems) * 100)}%`
                            : '0%'}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Statistics Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="text-xs text-green-700 font-medium mb-1">Imported</div>
                    <div className="text-2xl font-bold text-green-700">
                      {importJob.imported || 0}
                    </div>
                  </div>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="text-xs text-blue-700 font-medium mb-1">Updated</div>
                    <div className="text-2xl font-bold text-blue-700">
                      {importJob.updated || 0}
                    </div>
                  </div>
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <div className="text-xs text-gray-700 font-medium mb-1">Skipped</div>
                    <div className="text-2xl font-bold text-gray-700">
                      {importJob.skipped || 0}
                    </div>
                  </div>
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="text-xs text-red-700 font-medium mb-1">Errors</div>
                    <div className="text-2xl font-bold text-red-700">
                      {importJob.errors || 0}
                    </div>
                  </div>
                </div>
              </div>

              {/* Item Details Table */}
              {importJob.details?.items && importJob.details.items.length > 0 && (
                <div className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm">
                  <div className="px-4 py-3 bg-gray-50 border-b flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                      <span className="text-sm font-semibold text-gray-700">Recent Items</span>
                    </div>
                    <span className="text-xs text-gray-500">
                      {importJob.details.items.length} {importJob.details.truncated ? '(showing first 200)' : 'items'}
                    </span>
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">SKU</th>
                          <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Name</th>
                          <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Action</th>
                          <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Reason</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 bg-white">
                        {importJob.details.items.map((item: any, idx: number) => (
                          <tr key={`${item.sku || 'no-sku'}-${item.name || 'no-name'}-${item.productId || 'no-id'}-${idx}`} className="hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-2.5 font-mono text-xs text-gray-900">{item.sku || '-'}</td>
                            <td className="px-4 py-2.5 text-gray-700">{item.name || '-'}</td>
                            <td className="px-4 py-2.5">
                              <span
                                className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                                  item.action === 'imported'
                                    ? 'bg-green-100 text-green-800'
                                    : item.action === 'updated'
                                    ? 'bg-blue-100 text-blue-800'
                                    : item.action === 'skipped'
                                    ? 'bg-gray-100 text-gray-800'
                                    : 'bg-red-100 text-red-800'
                                }`}
                              >
                                {item.action}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-gray-600 text-xs max-w-xs truncate" title={item.reason || '-'}>
                              {item.reason || '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Error Message */}
              {importJob.errorMessage && (
                <div className="rounded-xl border-2 border-red-200 bg-red-50 px-4 py-3 flex items-start gap-3">
                  <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-red-800 mb-1">Error</div>
                    <div className="text-sm text-red-700">{importJob.errorMessage}</div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-gray-50 border-t flex items-center justify-end">
              <button
                className="px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={importJob.status !== 'success' && importJob.status !== 'failed'}
                onClick={() => {
                  setShowImportProgress(false)
                  setImportJob(null)
                  if (importJobUnsub.current) {
                    importJobUnsub.current()
                    importJobUnsub.current = null
                  }
                }}
              >
                {importJob.status === 'success' ? 'Done' : importJob.status === 'failed' ? 'Close' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
