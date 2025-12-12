import React from 'react';
import { TruckIcon, TagIcon, CubeIcon, ScaleIcon, CheckCircleIcon, ExclamationCircleIcon } from '@heroicons/react/24/outline';
import type { JobFormData } from './types';
import { Card } from '../../ui/Card';


interface JobPackagingStepProps {
    formData: JobFormData;
    setFormData: React.Dispatch<React.SetStateAction<JobFormData>>;
    planned: {
        plannedOuters: number;
        pallets: number;
    };
}

export const JobPackagingStep: React.FC<JobPackagingStepProps> = ({
    formData,
    setFormData,
    planned,
}) => {
    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="space-y-4">
                    <Card className="overflow-hidden">
                        <div className="p-3 bg-gradient-to-r from-emerald-50 to-green-50 border-b border-emerald-100">
                            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                                <div className="p-1.5 bg-emerald-500 rounded-lg shadow-sm shadow-emerald-200">
                                    <TruckIcon className="h-4 w-4 text-white" />
                                </div>
                                Delivery Information
                            </h3>
                        </div>
                        <div className="p-3 space-y-3">
                            {/* Packaging Configuration Card */}
                            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border border-blue-200 p-3">
                                <div className="flex items-center gap-2 mb-2">
                                    <CubeIcon className="h-4 w-4 text-blue-600" />
                                    <h4 className="text-xs font-bold text-gray-900">Packaging Configuration</h4>
                                </div>
                                <div className="grid grid-cols-2 gap-3 mb-3">
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                                            Pieces per Box *
                                        </label>
                                        <input
                                            type="number"
                                            min="1"
                                            value={formData.packaging?.pcsPerBox || ''}
                                            onChange={(e) => setFormData(prev => ({
                                                ...prev,
                                                packaging: {
                                                    ...prev.packaging,
                                                    pcsPerBox: e.target.value ? Number(e.target.value) : undefined
                                                }
                                            }))}
                                            placeholder="e.g., 100"
                                            className="block w-full rounded-lg border-gray-200 py-1.5 px-3 text-sm focus:border-blue-500 focus:ring-blue-100 bg-white transition-all"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                                            Boxes per Pallet *
                                        </label>
                                        <input
                                            type="number"
                                            min="1"
                                            value={formData.packaging?.boxesPerPallet || ''}
                                            onChange={(e) => setFormData(prev => ({
                                                ...prev,
                                                packaging: {
                                                    ...prev.packaging,
                                                    boxesPerPallet: e.target.value ? Number(e.target.value) : undefined
                                                }
                                            }))}
                                            placeholder="e.g., 50"
                                            className="block w-full rounded-lg border-gray-200 py-1.5 px-3 text-sm focus:border-blue-500 focus:ring-blue-100 bg-white transition-all"
                                        />
                                    </div>
                                </div>
                                <div className="pt-2 border-t border-blue-200">
                                    <h4 className="text-xs font-bold text-blue-900 mb-2">Packing Plan Summary</h4>
                                    <div className="grid grid-cols-4 gap-2">
                                        <div className="bg-white rounded-lg p-2 text-center">
                                            <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-0.5">EA/Outer</div>
                                            <div className="text-sm font-bold text-gray-900">{formData.packaging?.pcsPerBox || '-'}</div>
                                        </div>
                                        <div className="bg-white rounded-lg p-2 text-center">
                                            <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-0.5">Outers/Pallet</div>
                                            <div className="text-sm font-bold text-gray-900">{formData.packaging?.boxesPerPallet || '-'}</div>
                                        </div>
                                        <div className="bg-white rounded-lg p-2 text-center">
                                            <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-0.5">Planned Outers</div>
                                            <div className="text-sm font-bold text-blue-600">{planned.plannedOuters}</div>
                                        </div>
                                        <div className="bg-white rounded-lg p-2 text-center">
                                            <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-0.5">Planned Pallets</div>
                                            <div className="text-sm font-bold text-blue-600">{planned.pallets}</div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-700 mb-1">Outer Type *</label>
                                    <select
                                        value={formData.outerType}
                                        onChange={(e) => setFormData(prev => ({ ...prev, outerType: e.target.value as any }))}
                                        className="block w-full rounded-lg border-gray-200 py-1.5 px-3 text-sm focus:border-emerald-500 focus:ring-emerald-100 bg-white transition-all"
                                    >
                                        <option value="plain">Plain</option>
                                        <option value="std_ptd">Std Ptd</option>
                                        <option value="bespoke">Bespoke</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-700 mb-1">Outer Code</label>
                                    <input
                                        placeholder="Code"
                                        value={formData.outerCode}
                                        onChange={(e) => setFormData(prev => ({ ...prev, outerCode: e.target.value }))}
                                        className="block w-full rounded-lg border-gray-200 py-1.5 px-3 text-sm focus:border-emerald-500 focus:ring-emerald-100 bg-white transition-all"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1">RS/Order Ref</label>
                                <input
                                    placeholder="e.g., RS.BENT"
                                    value={formData.rsOrderRef}
                                    onChange={(e) => setFormData(prev => ({ ...prev, rsOrderRef: e.target.value }))}
                                    className="block w-full rounded-lg border-gray-200 py-1.5 px-3 text-sm focus:border-emerald-500 focus:ring-emerald-100 bg-white transition-all"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1">Delivery Address</label>
                                <textarea
                                    placeholder="Enter full delivery address"
                                    value={formData.deliveryAddress}
                                    onChange={(e) => setFormData(prev => ({ ...prev, deliveryAddress: e.target.value }))}
                                    className="block w-full rounded-lg border-gray-200 py-1.5 px-3 text-sm focus:border-emerald-500 focus:ring-emerald-100 transition-all"
                                    rows={2}
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1">Delivery Method</label>
                                <input
                                    placeholder="e.g., Our Van"
                                    value={formData.deliveryMethod}
                                    onChange={(e) => setFormData(prev => ({ ...prev, deliveryMethod: e.target.value }))}
                                    className="block w-full rounded-lg border-gray-200 py-1.5 px-3 text-sm focus:border-emerald-500 focus:ring-emerald-100 bg-white transition-all"
                                />
                            </div>
                        </div>
                    </Card>
                </div>

                <div className="space-y-6">
                    <Card className="overflow-hidden">
                        <div className="p-3 bg-gradient-to-r from-purple-50 to-indigo-50 border-b border-purple-100">
                            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                                <div className="p-1.5 bg-purple-500 rounded-lg shadow-sm shadow-purple-200">
                                    <TagIcon className="h-4 w-4 text-white" />
                                </div>
                                Packaging Details
                            </h3>
                        </div>
                        <div className="p-3 space-y-3">
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1">Weight per Box (kg)</label>
                                <input
                                    type="number"
                                    placeholder="Box weight"
                                    value={formData.weightPerBox}
                                    onChange={(e) => setFormData(prev => ({ ...prev, weightPerBox: e.target.value ? Number(e.target.value) : undefined }))}
                                    className="block w-full rounded-lg border-gray-200 py-1.5 px-3 text-sm focus:border-purple-500 focus:ring-purple-100 bg-white transition-all"
                                />
                            </div>

                            {formData.weightPerBox !== undefined && formData.weightPerBox >= 0 && (
                                <div className="bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-200 rounded-lg p-3">
                                    <div className="flex items-center gap-2 mb-2">
                                        <ScaleIcon className="h-4 w-4 text-purple-600" />
                                        <h4 className="text-xs font-bold text-purple-900">Weight Calculation</h4>
                                    </div>
                                    <div className="space-y-1">
                                        <div className="flex justify-between items-center p-2 bg-white rounded shadow-sm">
                                            <span className="text-xs text-gray-600">Planned total weight</span>
                                            <span className="text-xs font-bold text-purple-700">{(planned.plannedOuters * (formData.weightPerBox || 0)).toFixed(2)} kg</span>
                                        </div>
                                        <div className="flex justify-between items-center p-2 bg-white rounded shadow-sm">
                                            <span className="text-xs text-gray-600">Full pallet weight</span>
                                            <span className="text-xs font-bold text-purple-700">{((formData.packaging?.boxesPerPallet || 0) * (formData.weightPerBox || 0)).toFixed(2)} kg</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1">Strap/Banding Spec</label>
                                <input
                                    placeholder="e.g., 15 mm GRP"
                                    value={formData.packaging?.strapSpec || ''}
                                    onChange={(e) => setFormData(prev => ({
                                        ...prev,
                                        packaging: { ...prev.packaging, strapSpec: e.target.value }
                                    }))}
                                    className="block w-full rounded-lg border-gray-200 py-1.5 px-3 text-sm focus:border-purple-500 focus:ring-purple-100 bg-white transition-all"
                                />
                            </div>
                        </div>
                    </Card>

                    <Card className="overflow-hidden">
                        <div className="p-3 bg-gradient-to-r from-slate-50 to-gray-50 border-b border-slate-100">
                            <h3 className="text-sm font-bold text-gray-900">Delivery Validation</h3>
                        </div>
                        <div className="p-3 space-y-2">
                            <div className={`flex items-center gap-2 p-2 rounded-lg ${formData.outerType ? 'bg-emerald-50 border border-emerald-200' : 'bg-gray-50 border border-gray-200'}`}>
                                {formData.outerType ? (
                                    <CheckCircleIcon className="h-5 w-5 text-emerald-500" />
                                ) : (
                                    <ExclamationCircleIcon className="h-5 w-5 text-gray-400" />
                                )}
                                <span className={`text-xs font-medium ${formData.outerType ? 'text-emerald-700' : 'text-gray-500'}`}>
                                    Outer type {formData.outerType ? 'selected' : 'required'}
                                </span>
                            </div>
                            <div className={`flex items-center gap-2 p-2 rounded-lg ${formData.deliveryAddress ? 'bg-emerald-50 border border-emerald-200' : 'bg-amber-50 border border-amber-200'}`}>
                                {formData.deliveryAddress ? (
                                    <CheckCircleIcon className="h-5 w-5 text-emerald-500" />
                                ) : (
                                    <ExclamationCircleIcon className="h-5 w-5 text-amber-500" />
                                )}
                                <span className={`text-xs font-medium ${formData.deliveryAddress ? 'text-emerald-700' : 'text-amber-700'}`}>
                                    Delivery address {formData.deliveryAddress ? 'provided' : 'recommended'}
                                </span>
                            </div>
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
};
