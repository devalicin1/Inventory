import React, { useState, useRef, useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
    HomeIcon,
    CubeIcon,
    CogIcon,
    QrCodeIcon,
    ChartBarIcon,
    Bars3Icon,
    XMarkIcon,
    WrenchScrewdriverIcon,
    ShoppingCartIcon,
    MagnifyingGlassIcon,
    BuildingOfficeIcon,
    ChevronDownIcon,
    CheckIcon,
    ArrowRightOnRectangleIcon
} from '@heroicons/react/24/outline';
import { useUIStore } from '../../state/uiStore';
import { useSessionStore } from '../../state/sessionStore';
import { signOut } from '../../lib/auth';
import { ConfirmDialog } from '../ui/ConfirmDialog';

import {
    HomeIcon as HomeIconSolid,
    CubeIcon as CubeIconSolid,
    CogIcon as CogIconSolid,
    QrCodeIcon as QrCodeIconSolid,
    Bars3Icon as Bars3IconSolid,
    ShoppingCartIcon as ShoppingCartIconSolid,
    MagnifyingGlassIcon as MagnifyingGlassIconSolid,
    WrenchScrewdriverIcon as WrenchScrewdriverIconSolid
} from '@heroicons/react/24/solid';

export const MobileNav: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { openSearch } = useUIStore();
    const { workspaceId, userId, userWorkspaces, switchWorkspace, displayName, email, roles } = useSessionStore();
    const [showMoreMenu, setShowMoreMenu] = useState(false);
    const [showWorkspaceDropdown, setShowWorkspaceDropdown] = useState(false);
    const [showWorkspaceConfirm, setShowWorkspaceConfirm] = useState(false);
    const [pendingWorkspaceId, setPendingWorkspaceId] = useState<string | null>(null);
    const [accessibleScreens, setAccessibleScreens] = useState<Set<string>>(new Set(['home']));
    const menuRef = useRef<HTMLDivElement>(null);
    const workspaceDropdownRef = useRef<HTMLDivElement>(null);

    // Check screen access for current user
    useEffect(() => {
        if (!workspaceId || !userId) return

        const checkAccess = async () => {
            const { hasScreenAccess } = await import('../../utils/permissions')
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

    // Main navigation items (visible in bottom bar)
    // REQ: "production yerine find, PO yerine ise Scan"
    const allMainNavigation = [
        { name: 'Home', shortName: 'Home', to: '/', icon: HomeIcon, iconSolid: HomeIconSolid, screenId: 'home' },
        { name: 'Inventory', shortName: 'Inventory', to: '/inventory', icon: CubeIcon, iconSolid: CubeIconSolid, screenId: 'inventory' },
        { name: 'Find', shortName: 'Find', action: 'search', icon: MagnifyingGlassIcon, iconSolid: MagnifyingGlassIconSolid, screenId: 'find' },
        { name: 'Scan', shortName: 'Scan', to: '/scan', icon: QrCodeIcon, iconSolid: QrCodeIconSolid, screenId: 'scan' },
    ];

    // Filter based on screen access
    const mainNavigation = allMainNavigation.filter(item => 
        accessibleScreens.has(item.screenId) || item.screenId === 'home'
    );

    // Secondary navigation items (shown in "More" menu)
    // Moved Production and PO here
    const allMoreNavigation = [
        { name: 'Production', to: '/production', icon: WrenchScrewdriverIcon, screenId: 'production' },
        { name: 'Purchase Orders', to: '/purchase-orders', icon: ShoppingCartIcon, screenId: 'purchase-orders' },
        { name: 'Reports', to: '/reports', icon: ChartBarIcon, screenId: 'reports' },
        { name: 'Settings', to: '/settings', icon: CogIcon, screenId: 'settings' },
    ];

    // Filter based on screen access
    const moreNavigation = allMoreNavigation.filter(item => 
        accessibleScreens.has(item.screenId)
    );

    const isActive = (path: string) => {
        if (path === '/') {
            return location.pathname === '/';
        }
        return location.pathname.startsWith(path);
    };

    const isMoreActive = () => {
        return moreNavigation.some(item => isActive(item.to));
    };

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setShowMoreMenu(false);
            }
        };

        if (showMoreMenu) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showMoreMenu]);

    // Close menu on navigation
    useEffect(() => {
        setShowMoreMenu(false);
    }, [location.pathname]);

    // Close workspace dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (workspaceDropdownRef.current && !workspaceDropdownRef.current.contains(event.target as Node)) {
                setShowWorkspaceDropdown(false);
            }
        };

        if (showWorkspaceDropdown) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showWorkspaceDropdown]);

    // Get current workspace
    const currentWorkspace = userWorkspaces.find(ws => ws.workspaceId === workspaceId);

    // Get user initials
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

    // Get role name
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

    // Handle workspace change
    const handleWorkspaceChange = (newWorkspaceId: string) => {
        if (newWorkspaceId === workspaceId) {
            setShowWorkspaceDropdown(false);
            return;
        }

        // Show confirmation dialog
        setPendingWorkspaceId(newWorkspaceId);
        setShowWorkspaceConfirm(true);
        setShowWorkspaceDropdown(false);
    };

    // Confirm workspace change
    const confirmWorkspaceChange = async () => {
        if (!pendingWorkspaceId) return;

        const newWorkspaceId = pendingWorkspaceId;
        setShowMoreMenu(false);
        
        if (workspaceId) {
            queryClient.removeQueries({ 
                predicate: (query) => {
                    const key = query.queryKey
                    if (!Array.isArray(key)) return false
                    const keyString = JSON.stringify(key)
                    return keyString.includes(workspaceId)
                }
            })
        }

        switchWorkspace(newWorkspaceId);

        queryClient.invalidateQueries({ 
            predicate: (query) => {
                const key = query.queryKey
                if (!Array.isArray(key)) return false
                const keyString = JSON.stringify(key)
                return keyString.includes(newWorkspaceId)
            }
        })

        const currentPath = window.location.pathname
        if (currentPath !== '/' && currentPath !== '/inventory' && currentPath !== '/production') {
            navigate('/');
        }

        setPendingWorkspaceId(null);
    };

    // Handle sign out
    const handleSignOut = async () => {
        try {
            await signOut();
            setShowMoreMenu(false);
        } catch (error) {
            console.error('Sign out error:', error);
        }
    };

    return (
        <>
            {/* Backdrop overlay */}
            {showMoreMenu && (
                <div
                    className="fixed inset-0 bg-black/40 z-40 md:hidden backdrop-blur-sm transition-opacity duration-200"
                    onClick={() => setShowMoreMenu(false)}
                />
            )}

            {/* More Menu Popup */}
            {showMoreMenu && (
                <div
                    ref={menuRef}
                    className="fixed bottom-[80px] right-2 left-2 z-50 md:hidden animate-slide-up"
                    style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
                >
                    <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden mx-auto max-w-sm">
                        {/* Header */}
                        <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-100">
                            <span className="font-semibold text-gray-800">More Options</span>
                            <button
                                onClick={() => setShowMoreMenu(false)}
                                className="p-1.5 rounded-full hover:bg-gray-200 transition-colors"
                            >
                                <XMarkIcon className="h-5 w-5 text-gray-500" />
                            </button>
                        </div>

                        {/* Menu Items */}
                        <div className="p-2">
                            <div className="grid grid-cols-2 gap-2">
                                {moreNavigation.map((item) => {
                                    const active = isActive(item.to);
                                    return (
                                        <NavLink
                                            key={item.name}
                                            to={item.to}
                                            onClick={() => setShowMoreMenu(false)}
                                            className={`
                                                flex flex-col items-center justify-center p-4 rounded-xl transition-all duration-200
                                                ${active
                                                    ? 'bg-blue-50 text-blue-600 ring-2 ring-blue-200'
                                                    : 'bg-gray-50 text-gray-700 hover:bg-gray-100 active:bg-gray-200'
                                                }
                                            `}
                                        >
                                            <item.icon className={`h-7 w-7 mb-2 ${active ? 'text-blue-600' : 'text-gray-600'}`} />
                                            <span className={`text-sm font-medium ${active ? 'text-blue-600' : 'text-gray-700'}`}>
                                                {item.name}
                                            </span>
                                        </NavLink>
                                    );
                                })}
                            </div>

                            {/* User Section */}
                            <div className="mt-4 pt-4 border-t border-gray-200 space-y-2">
                                {/* User Info */}
                                <div className="flex items-center px-3 py-2 rounded-lg bg-gray-50">
                                    <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm">
                                        {getInitials()}
                                    </div>
                                    <div className="ml-3 flex-1 min-w-0">
                                        <p className="text-sm font-medium text-gray-900 truncate">
                                            {displayName || email || 'User'}
                                        </p>
                                        <p className="text-xs text-gray-500">{getRoleName()}</p>
                                    </div>
                                </div>

                                {/* Workspace Selector */}
                                {userWorkspaces.length > 1 && (
                                    <div className="relative" ref={workspaceDropdownRef}>
                                        <button
                                            onClick={() => setShowWorkspaceDropdown(!showWorkspaceDropdown)}
                                            className="w-full flex items-center justify-between px-3 py-2.5 text-sm text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors border border-gray-200"
                                        >
                                            <div className="flex items-center gap-2 flex-1 min-w-0">
                                                <BuildingOfficeIcon className="h-4 w-4 text-gray-400 flex-shrink-0" />
                                                <span className="truncate text-sm font-medium">
                                                    {currentWorkspace?.name || 'Workspace'}
                                                </span>
                                            </div>
                                            <ChevronDownIcon className={`h-4 w-4 text-gray-400 transition-transform flex-shrink-0 ${showWorkspaceDropdown ? 'rotate-180' : ''}`} />
                                        </button>
                                        
                                        {showWorkspaceDropdown && (
                                            <div className="absolute bottom-full left-0 right-0 mb-2 bg-white rounded-lg shadow-lg border border-gray-200 z-30 max-h-48 overflow-y-auto">
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
                                        )}
                                    </div>
                                )}

                                {/* Logout Button */}
                                <button
                                    onClick={handleSignOut}
                                    className="w-full flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors border border-red-200"
                                >
                                    <ArrowRightOnRectangleIcon className="h-5 w-5" />
                                    <span>Sign Out</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Bottom Navigation Bar */}
            <nav className="bottom-nav">
                <div className="flex items-end justify-around px-1" style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))', minHeight: '72px' }}>
                    {/* Main Navigation Items */}
                    {mainNavigation.map((item) => {
                        const isAction = item.action === 'search';
                        const active = isAction ? false : isActive(item.to!); // Search never "active" in route sense
                        const IconComponent = active ? item.iconSolid : item.icon;

                        if (isAction) {
                            return (
                                <button
                                    key={item.name}
                                    onClick={openSearch}
                                    className="flex flex-col items-center justify-end py-1.5 px-3 flex-1 relative group"
                                >
                                    <div className="absolute -top-6 left-1/2 -translate-x-1/2 p-3.5 rounded-full bg-blue-600 shadow-lg shadow-blue-600/30 border-4 border-white transition-transform duration-200 active:scale-95">
                                        <IconComponent className="h-6 w-6 text-white" />
                                    </div>
                                    <span className="text-[11px] font-medium mt-8 leading-tight text-gray-500 group-hover:text-blue-600">
                                        {item.shortName}
                                    </span>
                                </button>
                            );
                        }

                        return (
                            <NavLink
                                key={item.name}
                                to={item.to!}
                                className={`
                                    flex flex-col items-center justify-center py-1.5 px-3 flex-1 relative
                                    transition-all duration-200 ease-out
                                    ${active
                                        ? 'text-blue-600'
                                        : 'text-gray-500 hover:text-gray-700 active:text-blue-600'
                                    }
                                `}
                            >
                                {/* Active indicator */}
                                {active && (
                                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-10 h-1 bg-blue-600 rounded-b-full" />
                                )}

                                <div className={`
                                    p-1.5 rounded-xl transition-all duration-200
                                    ${active ? 'bg-blue-50' : ''}
                                `}>
                                    <IconComponent className={`
                                        transition-all duration-200
                                        ${active ? 'h-6 w-6' : 'h-5 w-5'}
                                    `} />
                                </div>

                                <span className={`
                                    text-[11px] font-medium mt-0.5 leading-tight
                                    ${active ? 'font-semibold' : ''}
                                `}>
                                    {item.shortName}
                                </span>
                            </NavLink>
                        );
                    })}

                    {/* More Button */}
                    <button
                        onClick={() => setShowMoreMenu(!showMoreMenu)}
                        className={`
                            flex flex-col items-center justify-center py-1.5 px-3 flex-1 relative
                            transition-all duration-200 ease-out
                            ${showMoreMenu || isMoreActive()
                                ? 'text-blue-600'
                                : 'text-gray-500 hover:text-gray-700 active:text-blue-600'
                            }
                        `}
                    >
                        {/* Active indicator for more menu items */}
                        {isMoreActive() && !showMoreMenu && (
                            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-10 h-1 bg-blue-600 rounded-b-full" />
                        )}

                        <div className={`
                            p-1.5 rounded-xl transition-all duration-200
                            ${showMoreMenu || isMoreActive() ? 'bg-blue-50' : ''}
                        `}>
                            {showMoreMenu ? (
                                <XMarkIcon className="h-6 w-6" />
                            ) : (
                                <Bars3Icon className={`transition-all duration-200 ${isMoreActive() ? 'h-6 w-6' : 'h-5 w-5'}`} />
                            )}
                        </div>

                        <span className={`
                            text-[11px] font-medium mt-0.5 leading-tight
                            ${showMoreMenu || isMoreActive() ? 'font-semibold' : ''}
                        `}>
                            More
                        </span>

                        {/* Notification dot if any more item is active */}
                        {isMoreActive() && !showMoreMenu && (
                            <div className="absolute top-2 right-3 w-2 h-2 bg-blue-600 rounded-full" />
                        )}
                    </button>
                </div>
            </nav>

            {/* Workspace Switch Confirmation Dialog */}
            {pendingWorkspaceId && (
                <ConfirmDialog
                    isOpen={showWorkspaceConfirm}
                    onClose={() => {
                        setShowWorkspaceConfirm(false);
                        setPendingWorkspaceId(null);
                    }}
                    onConfirm={confirmWorkspaceChange}
                    title="Switch Workspace"
                    message={`Are you sure you want to switch to "${userWorkspaces.find(ws => ws.workspaceId === pendingWorkspaceId)?.name || 'this workspace'}"?\n\nAll current workspace data will be cleared and the new workspace data will be loaded.`}
                    confirmText="Switch"
                    cancelText="Cancel"
                    variant="warning"
                />
            )}
        </>
    );
};
