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

export const MobileNav: React.FC = () => {
    const navigation = [
        { name: 'Dashboard', to: '/', icon: HomeIcon },
        { name: 'Inventory', to: '/inventory', icon: CubeIcon },
        { name: 'Production', to: '/production', icon: CogIcon },
        { name: 'Scan', to: '/scan', icon: QrCodeIcon },
        { name: 'Work', to: '/work', icon: ClipboardDocumentListIcon },
        { name: 'My Work', to: '/my', icon: UserIcon },
        { name: 'Reports', to: '/reports', icon: ChartBarIcon },
        { name: 'Settings', to: '/settings', icon: CogIcon },
    ];

    return (
        <div className="bottom-nav overflow-x-auto scrollbar-hide">
            <div className="flex items-center justify-around min-w-full">
                {navigation.map((item) => (
                    <NavLink
                        key={item.name}
                        to={item.to}
                        className={({ isActive }) => `
                            flex flex-col items-center justify-center py-1.5 px-2 text-[10px] font-medium transition-colors duration-200 min-w-0 flex-1
                            ${isActive ? 'text-primary-600' : 'text-gray-500 hover:text-gray-700'}
                        `}
                    >
                        <item.icon className="h-5 w-5 mb-0.5 flex-shrink-0" />
                        <span className="truncate w-full text-center">{item.name}</span>
                    </NavLink>
                ))}
            </div>
        </div>
    );
};
