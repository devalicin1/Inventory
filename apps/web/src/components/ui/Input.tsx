import React, { forwardRef } from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
    helperText?: string;
    leftIcon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(({
    label,
    error,
    helperText,
    className = '',
    leftIcon,
    ...props
}, ref) => {
    return (
        <div className="w-full">
            {label && (
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                    {label}
                </label>
            )}
            <div className="relative">
                {leftIcon && (
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-500">
                        {leftIcon}
                    </div>
                )}
                <input
                    ref={ref}
                    className={`
                        block w-full rounded-xl border-2 border-gray-200 
                        py-3 px-4 text-base
                        focus:border-primary-500 focus:ring-2 focus:ring-primary-100 
                        disabled:bg-gray-50 disabled:text-gray-500
                        transition-all duration-200
                        placeholder:text-gray-400
                        ${leftIcon ? 'pl-12' : ''}
                        ${error ? 'border-red-300 focus:border-red-500 focus:ring-red-100' : ''}
                        ${className}
                    `}
                    {...props}
                />
            </div>
            {error && (
                <p className="mt-1.5 text-sm text-red-600">{error}</p>
            )}
            {helperText && !error && (
                <p className="mt-1.5 text-sm text-gray-500">{helperText}</p>
            )}
        </div>
    );
});

Input.displayName = 'Input';
