import React from 'react';
import { createPortal } from 'react-dom';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';

interface ConfirmDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    variant?: 'default' | 'warning' | 'danger';
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    variant = 'default'
}) => {
    if (!isOpen) return null;

    const variantStyles = {
        default: {
            icon: 'text-blue-600',
            button: 'bg-blue-600 hover:bg-blue-700 text-white'
        },
        warning: {
            icon: 'text-yellow-600',
            button: 'bg-yellow-600 hover:bg-yellow-700 text-white'
        },
        danger: {
            icon: 'text-red-600',
            button: 'bg-red-600 hover:bg-red-700 text-white'
        }
    };

    const styles = variantStyles[variant];

    return createPortal(
        <div className="fixed inset-0 z-[9999] overflow-y-auto">
            <div className="flex min-h-screen items-center justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0">
                {/* Backdrop */}
                <div
                    className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm transition-opacity"
                    onClick={onClose}
                    aria-hidden="true"
                />

                {/* Center modal */}
                <span className="hidden sm:inline-block sm:h-screen sm:align-middle" aria-hidden="true">&#8203;</span>

                <div
                    className="relative inline-block w-full transform overflow-hidden rounded-2xl bg-white text-left align-bottom shadow-xl transition-all sm:my-8 sm:align-middle sm:max-w-lg"
                    role="dialog"
                    aria-modal="true"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="bg-white px-6 pt-6 pb-4 sm:p-6">
                        <div className="flex items-start">
                            <div className={`flex-shrink-0 ${styles.icon}`}>
                                <ExclamationTriangleIcon className="h-6 w-6" aria-hidden="true" />
                            </div>
                            <div className="ml-4 flex-1">
                                <h3 className="text-lg font-semibold leading-6 text-gray-900 mb-2">
                                    {title}
                                </h3>
                                <div className="mt-2">
                                    <p className="text-sm text-gray-500 whitespace-pre-line">
                                        {message}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="bg-gray-50 px-6 py-4 sm:px-6 sm:flex sm:flex-row-reverse sm:gap-3">
                        <button
                            type="button"
                            onClick={() => {
                                onConfirm();
                                onClose();
                            }}
                            className={`w-full sm:w-auto sm:min-w-[100px] inline-flex justify-center rounded-lg px-4 py-2.5 text-sm font-semibold shadow-sm transition-colors ${styles.button}`}
                        >
                            {confirmText}
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="mt-3 sm:mt-0 w-full sm:w-auto sm:min-w-[100px] inline-flex justify-center rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 transition-colors"
                        >
                            {cancelText}
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};
