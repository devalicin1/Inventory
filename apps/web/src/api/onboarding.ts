import { listUOMs } from './settings'
import { listCategories } from './settings'
import { getCompanyInformation } from './company'
import { listVendors } from './vendors'
import { listAddresses } from './addresses'
import { getReportSettings } from './settings'

export interface ConfigurationCheck {
  id: string
  name: string
  description: string
  required: boolean
  completed: boolean
  settingsTab?: string
  settingsPath?: string
  priority: 'critical' | 'high' | 'medium' | 'low'
}

export interface WorkspaceConfigurationStatus {
  checks: ConfigurationCheck[]
  completionPercentage: number
  criticalMissing: ConfigurationCheck[]
  recommendedMissing: ConfigurationCheck[]
  isComplete: boolean
}

/**
 * Check if workspace has required configurations
 */
export async function getWorkspaceConfigurationStatus(
  workspaceId: string
): Promise<WorkspaceConfigurationStatus> {
  const checks: ConfigurationCheck[] = []

  // 1. Units of Measure (CRITICAL)
  try {
    const uoms = await listUOMs(workspaceId)
    checks.push({
      id: 'uom',
      name: 'Units of Measure',
      description: 'Add units of measure (e.g., pieces, boxes, kg) for your products',
      required: true,
      completed: uoms.length > 0,
      settingsTab: 'uom',
      settingsPath: '/settings?tab=uom',
      priority: 'critical',
    })
  } catch {
    checks.push({
      id: 'uom',
      name: 'Units of Measure',
      description: 'Add units of measure (e.g., pieces, boxes, kg) for your products',
      required: true,
      completed: false,
      settingsTab: 'uom',
      settingsPath: '/settings?tab=uom',
      priority: 'critical',
    })
  }

  // 2. Company Information (CRITICAL)
  try {
    const companyInfo = await getCompanyInformation(workspaceId)
    const hasCompanyInfo = companyInfo !== null && companyInfo.name && companyInfo.name.trim() !== ''
    checks.push({
      id: 'company-information',
      name: 'Company Information',
      description: 'Set up your company name and contact details for reports and documents',
      required: true,
      completed: hasCompanyInfo,
      settingsTab: 'company-information',
      settingsPath: '/settings?tab=company-information',
      priority: 'critical',
    })
  } catch {
    checks.push({
      id: 'company-information',
      name: 'Company Information',
      description: 'Set up your company name and contact details for reports and documents',
      required: true,
      completed: false,
      settingsTab: 'company-information',
      settingsPath: '/settings?tab=company-information',
      priority: 'critical',
    })
  }

  // 3. Categories (HIGH)
  try {
    const categories = await listCategories(workspaceId)
    checks.push({
      id: 'categories',
      name: 'Product Categories',
      description: 'Organize your products with categories for better inventory management',
      required: false,
      completed: categories.length > 0,
      settingsTab: 'categories',
      settingsPath: '/settings?tab=categories',
      priority: 'high',
    })
  } catch {
    checks.push({
      id: 'categories',
      name: 'Product Categories',
      description: 'Organize your products with categories for better inventory management',
      required: false,
      completed: categories.length > 0,
      settingsTab: 'categories',
      settingsPath: '/settings?tab=categories',
      priority: 'high',
    })
  }

  // 4. Vendors (HIGH)
  try {
    const vendors = await listVendors(workspaceId)
    checks.push({
      id: 'vendors',
      name: 'Vendors',
      description: 'Add vendor information for purchase orders and supplier management',
      required: false,
      completed: vendors.length > 0,
      settingsTab: 'vendors',
      settingsPath: '/settings?tab=vendors',
      priority: 'high',
    })
  } catch {
    checks.push({
      id: 'vendors',
      name: 'Vendors',
      description: 'Add vendor information for purchase orders and supplier management',
      required: false,
      completed: false,
      settingsTab: 'vendors',
      settingsPath: '/settings?tab=vendors',
      priority: 'high',
    })
  }

  // 5. Addresses (MEDIUM)
  try {
    const addresses = await listAddresses(workspaceId)
    checks.push({
      id: 'addresses',
      name: 'Shipping Addresses',
      description: 'Add shipping and billing addresses for purchase orders',
      required: false,
      completed: addresses.length > 0,
      settingsTab: 'addresses',
      settingsPath: '/settings?tab=addresses',
      priority: 'medium',
    })
  } catch {
    checks.push({
      id: 'addresses',
      name: 'Shipping Addresses',
      description: 'Add shipping and billing addresses for purchase orders',
      required: false,
      completed: false,
      settingsTab: 'addresses',
      settingsPath: '/settings?tab=addresses',
      priority: 'medium',
    })
  }

  // 6. Report Settings (MEDIUM)
  try {
    const reportSettings = await getReportSettings(workspaceId)
    checks.push({
      id: 'report-settings',
      name: 'Report Settings',
      description: 'Configure report settings for accurate inventory analysis',
      required: false,
      completed: reportSettings.rawMaterialGroupIds.length > 0,
      settingsTab: 'report-settings',
      settingsPath: '/settings?tab=report-settings',
      priority: 'medium',
    })
  } catch {
    checks.push({
      id: 'report-settings',
      name: 'Report Settings',
      description: 'Configure report settings for accurate inventory analysis',
      required: false,
      completed: false,
      settingsTab: 'report-settings',
      settingsPath: '/settings?tab=report-settings',
      priority: 'medium',
    })
  }

  // Calculate completion
  const completedCount = checks.filter(c => c.completed).length
  const totalCount = checks.length
  const completionPercentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

  // Separate by priority
  const criticalMissing = checks.filter(c => !c.completed && c.priority === 'critical')
  const recommendedMissing = checks.filter(c => !c.completed && c.priority !== 'critical')

  const isComplete = criticalMissing.length === 0

  return {
    checks,
    completionPercentage,
    criticalMissing,
    recommendedMissing,
    isComplete,
  }
}

/**
 * Get specific configuration check
 */
export async function getConfigurationCheck(
  workspaceId: string,
  checkId: string
): Promise<ConfigurationCheck | null> {
  const status = await getWorkspaceConfigurationStatus(workspaceId)
  return status.checks.find(c => c.id === checkId) || null
}
