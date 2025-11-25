import React from 'react';
import { NavLink } from 'react-router-dom';
import {
    HomeIcon,
    CubeIcon,
    CogIcon,
    ClipboardDocumentListIcon,
    UserIcon,
    QrCodeIcon,
    ChartBarIcon
} from '@heroicons/react/24/outline';

export const Sidebar: React.FC = () => {
    const navigation = [
        { name: 'Dashboard', to: '/', icon: HomeIcon },
        { name: 'Inventory', to: '/inventory', icon: CubeIcon },
        { name: 'Production', to: '/production', icon: CogIcon },
        { name: 'Scan', to: '/scan', icon: QrCodeIcon },
        { name: 'Work Management', to: '/work', icon: ClipboardDocumentListIcon },
        { name: 'My Work', to: '/my', icon: UserIcon },
        { name: 'Reports', to: '/reports', icon: ChartBarIcon },
        { name: 'Settings', to: '/settings', icon: CogIcon },
    ];

    return (
        <div className="sidebar">
            <div className="flex h-16 flex-shrink-0 items-center px-6 border-b border-gray-200 bg-white">
                <div className="h-8 w-8 rounded-lg bg-primary-600 flex items-center justify-center shadow-sm">
                    <CubeIcon className="h-5 w-5 text-white" />
                </div>
                <span className="ml-3 text-xl font-bold text-gray-900 tracking-tight">Inventory</span>
            </div>

            <div className="flex flex-1 flex-col overflow-y-auto pt-5 pb-4">
                <nav className="flex-1 space-y-1 px-3">
                    {navigation.map((item) => (
                        <NavLink
                            key={item.name}
                            to={item.to}
                            className={({ isActive }) => `
                group flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200
                ${isActive
                                    ? 'bg-primary-50 text-primary-700 shadow-sm'
                                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                                }
              `}
                        >
                            {({ isActive }) => (
                                <>
                                    <item.icon
                                        className={`mr-3 h-5 w-5 flex-shrink-0 transition-colors duration-200 ${isActive ? 'text-primary-600' : 'text-gray-400 group-hover:text-gray-500'}`}
                                    />
                                    {item.name}
                                </>
                            )}
                        </NavLink>
                    ))}
                </nav>
            </div>

            <div className="border-t border-gray-200 p-4">
                <div className="flex items-center px-2">
                    <div className="h-8 w-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold text-xs">
                        JD
                    </div>
                    <div className="ml-3">
                        <p className="text-sm font-medium text-gray-700">John Doe</p>
                        <p className="text-xs text-gray-500">Admin</p>
                    </div>
                </div>
            </div>
        </div>
    );
};
