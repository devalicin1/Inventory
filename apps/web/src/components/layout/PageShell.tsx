import React from 'react';

interface PageShellProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  headerClassName?: string;
  className?: string;
}

export const PageShell: React.FC<PageShellProps> = ({
  title,
  subtitle,
  actions,
  children,
  headerClassName = '',
  className = '',
}) => {
  return (
    <div className={`min-h-full ${className}`}>
      {/* Page Padding: 24px (desktop), 16px (tablet), 12px (mobile) */}
      <div className="px-3 sm:px-4 md:px-6 py-6">
        {/* Header Section */}
        <div className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 ${headerClassName}`}>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1">{title}</h1>
            {subtitle && (
              <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
            )}
          </div>
          {actions && (
            <div className="flex items-center gap-3 flex-shrink-0">
              {actions}
            </div>
          )}
        </div>

        {/* Content with Section Gap: 24px */}
        <div className="space-y-6">
          {children}
        </div>
      </div>
    </div>
  );
};

