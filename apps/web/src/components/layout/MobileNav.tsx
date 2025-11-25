import React from 'react';
import { NavLink } from 'react-router-dom';
import {
    HomeIcon,
    CubeIcon,
    UserIcon,
    QrCodeIcon,
} from '@heroicons/react/24/outline';

export const MobileNav: React.FC = () => {
    const navigation = [
        { name: 'Dashboard', to: '/', icon: HomeIcon },
        { name: 'Inventory', to: '/inventory', icon: CubeIcon },
        { name: 'Scan', to: '/scan', icon: QrCodeIcon },
        { name: 'My Work', to: '/my', icon: UserIcon },
    ];

    return (
        <div className="bottom-nav">
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
    );
};
