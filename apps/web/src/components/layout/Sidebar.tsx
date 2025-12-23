import React, { useEffect, useState, useMemo } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
    HomeIcon,
    CubeIcon,
    CogIcon,
    QrCodeIcon,
    ChartBarIcon,
    ShoppingCartIcon,
    MagnifyingGlassIcon,
    ShieldCheckIcon,
    BuildingOfficeIcon,
    ChevronDownIcon,
    CheckIcon,
    ClockIcon,
    ChevronDoubleLeftIcon,
    ChevronDoubleRightIcon
} from '@heroicons/react/24/outline';
import { useUIStore } from '../../state/uiStore';
import { useSessionStore } from '../../state/sessionStore';
import { signOut } from '../../lib/auth';
import { hasScreenAccess } from '../../utils/permissions';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { LOGO_URL, LOGO_ICON_URL } from '../../utils/logo';
import { listProducts } from '../../api/products';
import { listJobs } from '../../api/production-jobs';
import { listPurchaseOrders } from '../../api/purchase-orders';

export const Sidebar: React.FC = () => {
    const { openSearch, isSidebarCollapsed, toggleSidebar } = useUIStore();
    const { displayName, email, isSuperAdmin, roles, workspaceId, userId, userWorkspaces, switchWorkspace } = useSessionStore();
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const [accessibleScreens, setAccessibleScreens] = useState<Set<string>>(new Set(['home'])); // Default: home always accessible
    const [showWorkspaceDropdown, setShowWorkspaceDropdown] = useState(false);
    const [showWorkspaceConfirm, setShowWorkspaceConfirm] = useState(false);
    const [pendingWorkspaceId, setPendingWorkspaceId] = useState<string | null>(null);

    // Fetch data for badges
    const { data: products = [] } = useQuery({
        queryKey: ['products', workspaceId],
        queryFn: () => listProducts(workspaceId!),
        enabled: !!workspaceId,
        staleTime: 30000, // Cache for 30 seconds
    });

    const { data: jobsData } = useQuery({
        queryKey: ['jobs', workspaceId],
        queryFn: () => listJobs(workspaceId!),
        enabled: !!workspaceId,
        staleTime: 30000,
    });

    const { data: purchaseOrdersData } = useQuery({
        queryKey: ['purchaseOrders', workspaceId],
        queryFn: () => listPurchaseOrders(workspaceId!),
        enabled: !!workspaceId,
        staleTime: 30000,
    });

    const jobs = jobsData?.jobs || [];
    const purchaseOrders = purchaseOrdersData?.purchaseOrders || [];

    // Calculate badge counts
    const lowStockCount = useMemo(() => {
        return products.filter(p => {
            const qty = p.qtyOnHand || 0;
            const reorderPoint = p.reorderPoint || 0;
            return reorderPoint > 0 && qty <= reorderPoint;
        }).length;
    }, [products]);

    const overdueCount = useMemo(() => {
        const now = new Date();
        return jobs.filter(j => {
            if (j.status === 'done' || j.status === 'cancelled') return false;
            if (!j.dueDate) return false;
            try {
                const dueDate = j.dueDate?.toDate ? j.dueDate.toDate() : new Date(j.dueDate);
                return dueDate < now;
            } catch {
                return false;
            }
        }).length;
    }, [jobs]);

    const pendingPOCount = useMemo(() => {
        return purchaseOrders.filter(po => 
            po.status === 'Draft' || po.status === 'Submitted'
        ).length;
    }, [purchaseOrders]);

    // Check screen access for current user
    useEffect(() => {
        if (!workspaceId || !userId) return

        const checkAccess = async () => {
            const screens = ['home', 'inventory', 'production', 'scan', 'find', 'purchase-orders', 'reports', 'settings']
            const accessible = new Set<string>(['home']) // Home is always accessible

            for (const screen of screens) {
                try {
                    const hasAccess = await hasScreenAccess(workspaceId, userId, screen)
                    if (hasAccess) {
                        accessible.add(screen)
                    }
                } catch (error) {
                    console.error(`Error checking access for ${screen}:`, error)
                }
            }

            setAccessibleScreens(accessible)
        }

        checkAccess()
    }, [workspaceId, userId])

    // Navigation structure with categories
    const operationsNav = [
        { name: 'Dashboard', to: '/', icon: HomeIcon, screenId: 'home', badge: null },
        { name: 'Inventory', to: '/inventory', icon: CubeIcon, screenId: 'inventory', badge: lowStockCount > 0 ? { count: lowStockCount, label: 'Low Stock', color: 'blue' } : null },
        { name: 'Production', to: '/production', icon: ClockIcon, screenId: 'production', badge: overdueCount > 0 ? { count: overdueCount, label: 'Overdue', color: 'yellow' } : null },
        { name: 'Purchase Orders', to: '/purchase-orders', icon: ShoppingCartIcon, screenId: 'purchase-orders', badge: pendingPOCount > 0 ? { count: pendingPOCount, label: 'Pending', color: 'green' } : null },
        { name: 'Scan', to: '/scan', icon: QrCodeIcon, screenId: 'scan', badge: null },
    ];

    const insightsNav = [
        { name: 'Reports', to: '/reports', icon: ChartBarIcon, screenId: 'reports', badge: null },
    ];

    const systemNav = [
        { name: 'Settings', to: '/settings', icon: CogIcon, screenId: 'settings', badge: null },
        { name: 'Integrations', to: '/integrations', icon: CogIcon, screenId: 'settings', badge: null },
    ];

    // Filter navigation based on screen access
    const filteredOperations = operationsNav.filter(item => 
        accessibleScreens.has(item.screenId) || item.screenId === 'home'
    );
    const filteredInsights = insightsNav.filter(item => 
        accessibleScreens.has(item.screenId)
    );
    const filteredSystem = systemNav.filter(item => 
        accessibleScreens.has(item.screenId)
    );

    // Super admin ise Admin menü öğesi ekle
    if (isSuperAdmin) {
        filteredSystem.push({ name: 'Admin', to: '/admin', icon: ShieldCheckIcon, screenId: 'admin', badge: null });
    }

    const handleSignOut = async () => {
        try {
            await signOut();
            navigate('/login', { replace: true });
        } catch (error) {
            console.error('Sign out error:', error);
        }
    };

    // Kullanıcı adının baş harflerini al
    const getInitials = () => {
        if (displayName) {
            return displayName
                .split(' ')
                .map(n => n[0])
                .join('')
                .toUpperCase()
                .slice(0, 2);
        }
        if (email) {
            return email[0].toUpperCase();
        }
        return 'U';
    };

    const getRoleName = () => {
        if (roles.length === 0) return 'User';
        const role = roles[0];
        const roleNames: Record<string, string> = {
            owner: 'Owner',
            admin: 'Admin',
            manager: 'Manager',
            staff: 'Staff',
            operator: 'Operator',
        };
        return roleNames[role] || role;
    };

    // Mevcut workspace bilgisi
    const currentWorkspace = userWorkspaces.find(ws => ws.workspaceId === workspaceId);

    // Workspace değiştirme - kusursuz geçiş
    const handleWorkspaceChange = (newWorkspaceId: string) => {
        if (newWorkspaceId === workspaceId) {
            setShowWorkspaceDropdown(false);
            return;
        }

        // Yeni workspace bilgisini al ve confirmation dialog'u göster
        setPendingWorkspaceId(newWorkspaceId);
        setShowWorkspaceConfirm(true);
        setShowWorkspaceDropdown(false);
    };

    // Workspace değiştirmeyi onayla
    const confirmWorkspaceChange = async () => {
        if (!pendingWorkspaceId) return;

        const newWorkspaceId = pendingWorkspaceId;
        
        // Eski workspace'in tüm cache'lerini temizle
        if (workspaceId) {
            // Tüm workspace-specific query'leri kaldır
            queryClient.removeQueries({ 
                predicate: (query) => {
                    const key = query.queryKey
                    if (!Array.isArray(key)) return false
                    // Workspace ID'yi içeren tüm query'leri bul
                    const keyString = JSON.stringify(key)
                    return keyString.includes(workspaceId)
                }
            })
        }

        // Workspace'i değiştir
        switchWorkspace(newWorkspaceId);

        // Yeni workspace için tüm ilgili query'leri invalidate et (yeniden yüklensin)
        // Bu, React Query'nin otomatik olarak yeni verileri yüklemesini sağlar
        queryClient.invalidateQueries({ 
            predicate: (query) => {
                const key = query.queryKey
                if (!Array.isArray(key)) return false
                // Workspace ID'yi içeren tüm query'leri bul
                const keyString = JSON.stringify(key)
                return keyString.includes(newWorkspaceId)
            }
        })

        // Mevcut sayfada kal ama verileri yenile
        // Eğer kullanıcı ana sayfada değilse, ana sayfaya yönlendir
        const currentPath = window.location.pathname
        if (currentPath !== '/' && currentPath !== '/inventory' && currentPath !== '/production') {
            navigate('/');
        }

        setPendingWorkspaceId(null);
    };

    const getBadgeColor = (color: string) => {
        switch (color) {
            case 'blue':
                return 'bg-blue-100 text-blue-700';
            case 'yellow':
                return 'bg-yellow-100 text-yellow-700';
            case 'green':
                return 'bg-green-100 text-green-700';
            default:
                return 'bg-gray-100 text-gray-700';
        }
    };

    const renderNavItem = (item: typeof filteredOperations[0]) => (
        <NavLink
            key={item.name}
            to={item.to}
            className={({ isActive }) => `
                group flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200
                ${isActive
                    ? 'bg-primary-50 text-primary-700 shadow-sm'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }
                ${isSidebarCollapsed ? 'justify-center' : ''}
            `}
            title={isSidebarCollapsed ? item.name : undefined}
        >
            {({ isActive }) => (
                <>
                    <item.icon
                        className={`${isSidebarCollapsed ? '' : 'mr-3'} h-5 w-5 flex-shrink-0 transition-colors duration-200 ${isActive ? 'text-primary-600' : 'text-gray-400 group-hover:text-gray-500'}`}
                    />
                    {!isSidebarCollapsed && (
                        <>
                            <span className="flex-1">{item.name}</span>
                            {item.badge && (
                                <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-semibold ${getBadgeColor(item.badge.color)}`}>
                                    {item.badge.count} {item.badge.label}
                                </span>
                            )}
                        </>
                    )}
                </>
            )}
        </NavLink>
    );

    const renderCategoryHeader = (title: string) => {
        if (isSidebarCollapsed) return null;
        return (
            <div className="px-3 py-2">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    {title}
                </h3>
            </div>
        );
    };

    return (
        <div className={`sidebar ${isSidebarCollapsed ? 'collapsed' : ''}`}>
            <div className={`flex h-20 flex-shrink-0 items-center justify-center ${isSidebarCollapsed ? 'px-2' : 'px-6'} border-b border-gray-200 bg-white`}>
                {!isSidebarCollapsed ? (
                    <NavLink to="/" className="inline-flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white rounded-md">
                        <img
                            src={LOGO_URL}
                            alt="Itory logo"
                            className="h-12 w-auto max-w-full object-contain"
                            style={{ minHeight: '48px', maxHeight: '64px' }}
                        />
                    </NavLink>
                ) : (
                    <NavLink to="/" className="inline-flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white rounded-md">
                        <img
                            src={LOGO_ICON_URL}
                            alt="Itory icon"
                            className="h-8 w-8 rounded object-contain"
                        />
                    </NavLink>
                )}
            </div>

            <div className="flex flex-1 flex-col overflow-y-auto pt-5 pb-4">
                <nav className="flex-1 space-y-1 px-3">
                    {accessibleScreens.has('find') && !isSidebarCollapsed && (
                        <button
                            onClick={openSearch}
                            className="group flex w-full items-center px-3 py-2.5 text-sm font-medium rounded-lg text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-all duration-200 text-left mb-2 border border-gray-200/50"
                        >
                            <MagnifyingGlassIcon
                                className="mr-3 h-5 w-5 flex-shrink-0 text-gray-400 group-hover:text-gray-500 transition-colors duration-200"
                            />
                            <span className="flex-1">Find...</span>
                            <span className="text-xs text-gray-400 group-hover:text-gray-500 border border-gray-200 rounded px-1.5 py-0.5 shadow-sm bg-white">⌘K</span>
                        </button>
                    )}

                    {renderCategoryHeader('OPERATIONS')}
                    {filteredOperations.map(renderNavItem)}

                    {filteredInsights.length > 0 && (
                        <>
                            {renderCategoryHeader('INSIGHTS')}
                            {filteredInsights.map(renderNavItem)}
                        </>
                    )}

                    {filteredSystem.length > 0 && (
                        <>
                            {renderCategoryHeader('SYSTEM')}
                            {filteredSystem.map(renderNavItem)}
                        </>
                    )}
                </nav>
            </div>

            <div className={`border-t border-gray-200 p-4 space-y-3 ${isSidebarCollapsed ? 'px-2' : ''}`}>
                {/* Workspace Selector */}
                {userWorkspaces.length > 1 && !isSidebarCollapsed && (
                    <div className="relative">
                        <button
                            onClick={() => setShowWorkspaceDropdown(!showWorkspaceDropdown)}
                            className="w-full flex items-center justify-between px-2 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-md transition-colors border border-gray-200"
                        >
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                                <BuildingOfficeIcon className="h-4 w-4 text-gray-400 flex-shrink-0" />
                                <span className="truncate text-xs font-medium">
                                    {currentWorkspace?.name || 'Workspace'}
                                </span>
                            </div>
                            <ChevronDownIcon className={`h-4 w-4 text-gray-400 transition-transform ${showWorkspaceDropdown ? 'rotate-180' : ''}`} />
                        </button>
                        
                        {showWorkspaceDropdown && (
                            <>
                                <div 
                                    className="fixed inset-0 z-10" 
                                    onClick={() => setShowWorkspaceDropdown(false)}
                                />
                                <div className="absolute bottom-full left-0 right-0 mb-2 bg-white rounded-lg shadow-lg border border-gray-200 z-20 max-h-48 overflow-y-auto">
                                    {userWorkspaces.map((ws) => (
                                        <button
                                            key={ws.workspaceId}
                                            onClick={() => handleWorkspaceChange(ws.workspaceId)}
                                            className={`w-full flex items-center justify-between px-3 py-2.5 text-sm hover:bg-gray-50 transition-colors ${
                                                ws.workspaceId === workspaceId ? 'bg-blue-50' : ''
                                            }`}
                                        >
                                            <div className="flex items-center gap-2 flex-1 min-w-0">
                                                <BuildingOfficeIcon className="h-4 w-4 text-gray-400 flex-shrink-0" />
                                                <div className="flex-1 min-w-0 text-left">
                                                    <p className="text-xs font-medium text-gray-900 truncate">{ws.name}</p>
                                                    <p className="text-[10px] text-gray-500">{ws.role}</p>
                                                </div>
                                            </div>
                                            {ws.workspaceId === workspaceId && (
                                                <CheckIcon className="h-4 w-4 text-blue-600 flex-shrink-0" />
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                )}

                {/* User Info */}
                {!isSidebarCollapsed ? (
                    <>
                        <div className="flex items-center px-2">
                            <div className="h-8 w-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold text-xs">
                                {getInitials()}
                            </div>
                            <div className="ml-3 flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-700 truncate">
                                    {displayName || email || 'User'}
                                </p>
                                <p className="text-xs text-gray-500">{getRoleName()}</p>
                            </div>
                        </div>
                        
                        <button
                            onClick={handleSignOut}
                            className="w-full text-left px-2 py-1.5 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-md transition-colors"
                        >
                            Logout
                        </button>
                    </>
                ) : (
                    <div className="flex flex-col items-center space-y-2">
                        <div className="h-8 w-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold text-xs">
                            {getInitials()}
                        </div>
                    </div>
                )}

                {/* Collapse Toggle Button */}
                <button
                    onClick={toggleSidebar}
                    className="w-full flex items-center justify-center p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-md transition-colors"
                    title={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                >
                    {isSidebarCollapsed ? (
                        <ChevronDoubleRightIcon className="h-5 w-5" />
                    ) : (
                        <ChevronDoubleLeftIcon className="h-5 w-5" />
                    )}
                </button>
            </div>

            {/* Workspace Switch Confirmation Dialog */}
            {pendingWorkspaceId && (
                <ConfirmDialog
                    isOpen={showWorkspaceConfirm}
                    onClose={() => {
                        setShowWorkspaceConfirm(false);
                        setPendingWorkspaceId(null);
                    }}
                    onConfirm={confirmWorkspaceChange}
                    title="Switch workspace?"
                    message={`You are about to switch to "${
                        userWorkspaces.find(ws => ws.workspaceId === pendingWorkspaceId)?.name || 'this workspace'
                    }".\n\nYour current view will be refreshed with data from the new workspace. No inventory or settings will be deleted.\n\nAny unsaved changes on this page will be lost.`}
                    confirmText="Switch"
                    cancelText="Cancel"
                    variant="warning"
                />
            )}
        </div>
    );
};
