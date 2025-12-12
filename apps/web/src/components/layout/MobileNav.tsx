import React, { useState, useRef, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
    HomeIcon,
    CubeIcon,
    CogIcon,
    ClipboardDocumentListIcon,
    UserIcon,
    QrCodeIcon,
    ChartBarIcon,
    Bars3Icon,
    XMarkIcon,
    WrenchScrewdriverIcon,
    ShoppingCartIcon
} from '@heroicons/react/24/outline';
import {
    HomeIcon as HomeIconSolid,
    CubeIcon as CubeIconSolid,
    CogIcon as CogIconSolid,
    QrCodeIcon as QrCodeIconSolid,
    Bars3Icon as Bars3IconSolid,
    ShoppingCartIcon as ShoppingCartIconSolid
} from '@heroicons/react/24/solid';

export const MobileNav: React.FC = () => {
    const location = useLocation();
    const [showMoreMenu, setShowMoreMenu] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    
    // Main navigation items (visible in bottom bar)
    const mainNavigation = [
        { name: 'Home', shortName: 'Home', to: '/', icon: HomeIcon, iconSolid: HomeIconSolid },
        { name: 'Inventory', shortName: 'Inventory', to: '/inventory', icon: CubeIcon, iconSolid: CubeIconSolid },
        { name: 'Production', shortName: 'Prod', to: '/production', icon: WrenchScrewdriverIcon, iconSolid: CogIconSolid },
        { name: 'Purchase Orders', shortName: 'PO', to: '/purchase-orders', icon: ShoppingCartIcon, iconSolid: ShoppingCartIconSolid },
    ];
    
    // Secondary navigation items (shown in "More" menu)
    const moreNavigation = [
        { name: 'Scan', to: '/scan', icon: QrCodeIcon },
        { name: 'Work Orders', to: '/work', icon: ClipboardDocumentListIcon },
        { name: 'My Work', to: '/my', icon: UserIcon },
        { name: 'Reports', to: '/reports', icon: ChartBarIcon },
        { name: 'Settings', to: '/settings', icon: CogIcon },
    ];

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
                        </div>
                    </div>
                </div>
            )}

            {/* Bottom Navigation Bar */}
            <nav className="bottom-nav">
                <div className="flex items-stretch justify-around h-full px-1">
                    {/* Main Navigation Items */}
                    {mainNavigation.map((item) => {
                        const active = isActive(item.to);
                        const IconComponent = active ? item.iconSolid : item.icon;
                        return (
                            <NavLink
                                key={item.name}
                                to={item.to}
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
        </>
    );
};
