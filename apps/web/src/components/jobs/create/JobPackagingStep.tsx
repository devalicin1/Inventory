import React from 'react';
import { TruckIcon, TagIcon, CubeIcon, ScaleIcon, CheckCircleIcon, ExclamationCircleIcon } from '@heroicons/react/24/outline';
import type { JobFormData } from './types';
import { Card } from '../../ui/Card';
import { Input } from '../../ui/Input';

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
        <div className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-6">
                    <Card className="overflow-hidden">
                        <div className="p-5 bg-gradient-to-r from-emerald-50 to-green-50 border-b border-emerald-100">
                            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-3">
                                <div className="p-2 bg-emerald-500 rounded-xl shadow-lg shadow-emerald-200">
                                    <TruckIcon className="h-5 w-5 text-white" />
                                </div>
                                Delivery Information
                            </h3>
                        </div>
                        <div className="p-6 space-y-6">
                            {/* Packaging Configuration Card */}
                            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border-2 border-blue-200 p-5">
                                <div className="flex items-center gap-2 mb-4">
                                    <CubeIcon className="h-5 w-5 text-blue-600" />
                                    <h4 className="text-sm font-bold text-gray-900">Packaging Configuration</h4>
                                </div>
                                <div className="grid grid-cols-2 gap-4 mb-5">
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">
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
                                            className="block w-full rounded-xl border-2 border-gray-200 py-3 px-4 text-base focus:border-blue-500 focus:ring-2 focus:ring-blue-100 bg-white transition-all"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">
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
                                            className="block w-full rounded-xl border-2 border-gray-200 py-3 px-4 text-base focus:border-blue-500 focus:ring-2 focus:ring-blue-100 bg-white transition-all"
                                        />
                                    </div>
                                </div>
                                <div className="pt-4 border-t-2 border-blue-200">
                                    <h4 className="text-sm font-bold text-blue-900 mb-3">Packing Plan Summary</h4>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="bg-white rounded-xl p-3 text-center">
                                            <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">EA/Outer</div>
                                            <div className="text-xl font-bold text-gray-900">{formData.packaging?.pcsPerBox || '-'}</div>
                                        </div>
                                        <div className="bg-white rounded-xl p-3 text-center">
                                            <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Outers/Pallet</div>
                                            <div className="text-xl font-bold text-gray-900">{formData.packaging?.boxesPerPallet || '-'}</div>
                                        </div>
                                        <div className="bg-white rounded-xl p-3 text-center">
                                            <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Planned Outers</div>
                                            <div className="text-xl font-bold text-blue-600">{planned.plannedOuters}</div>
                                        </div>
                                        <div className="bg-white rounded-xl p-3 text-center">
                                            <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Planned Pallets</div>
                                            <div className="text-xl font-bold text-blue-600">{planned.pallets}</div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">Outer Type *</label>
                                    <select
                                        value={formData.outerType}
                                        onChange={(e) => setFormData(prev => ({ ...prev, outerType: e.target.value as any }))}
                                        className="block w-full rounded-xl border-2 border-gray-200 py-3 px-4 text-base focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 bg-white transition-all"
                                    >
                                        <option value="plain">Plain</option>
                                        <option value="std_ptd">Std Ptd</option>
                                        <option value="bespoke">Bespoke</option>
                                    </select>
                                </div>
                                <Input
                                    label="Outer Code"
                                    placeholder="Code"
                                    value={formData.outerCode}
                                    onChange={(e) => setFormData(prev => ({ ...prev, outerCode: e.target.value }))}
                                />
                            </div>

                            <Input
                                label="RS/Order Ref"
                                placeholder="e.g., RS.BENT"
                                value={formData.rsOrderRef}
                                onChange={(e) => setFormData(prev => ({ ...prev, rsOrderRef: e.target.value }))}
                            />

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Delivery Address</label>
                                <textarea
                                    placeholder="Enter full delivery address"
                                    value={formData.deliveryAddress}
                                    onChange={(e) => setFormData(prev => ({ ...prev, deliveryAddress: e.target.value }))}
                                    className="block w-full rounded-xl border-2 border-gray-200 py-3 px-4 text-base focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 transition-all"
                                    rows={3}
                                />
                            </div>

                            <Input
                                label="Delivery Method"
                                placeholder="e.g., Our Van"
                                value={formData.deliveryMethod}
                                onChange={(e) => setFormData(prev => ({ ...prev, deliveryMethod: e.target.value }))}
                            />
                        </div>
                    </Card>
                </div>

                <div className="space-y-6">
                    <Card className="overflow-hidden">
                        <div className="p-5 bg-gradient-to-r from-purple-50 to-indigo-50 border-b border-purple-100">
                            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-3">
                                <div className="p-2 bg-purple-500 rounded-xl shadow-lg shadow-purple-200">
                                    <TagIcon className="h-5 w-5 text-white" />
                                </div>
                                Packaging Details
                            </h3>
                        </div>
                        <div className="p-6 space-y-5">
                            <Input
                                type="number"
                                label="Weight per Box (kg)"
                                placeholder="Box weight"
                                value={formData.weightPerBox}
                                onChange={(e) => setFormData(prev => ({ ...prev, weightPerBox: e.target.value ? Number(e.target.value) : undefined }))}
                            />

                            {formData.weightPerBox !== undefined && formData.weightPerBox >= 0 && (
                                <div className="bg-gradient-to-br from-purple-50 to-indigo-50 border-2 border-purple-200 rounded-xl p-5">
                                    <div className="flex items-center gap-2 mb-3">
                                        <ScaleIcon className="h-5 w-5 text-purple-600" />
                                        <h4 className="text-sm font-bold text-purple-900">Weight Calculation</h4>
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center p-3 bg-white rounded-lg">
                                            <span className="text-gray-600">Planned total weight</span>
                                            <span className="font-bold text-purple-700">{(planned.plannedOuters * (formData.weightPerBox || 0)).toFixed(2)} kg</span>
                                        </div>
                                        <div className="flex justify-between items-center p-3 bg-white rounded-lg">
                                            <span className="text-gray-600">Full pallet weight</span>
                                            <span className="font-bold text-purple-700">{((formData.packaging?.boxesPerPallet || 0) * (formData.weightPerBox || 0)).toFixed(2)} kg</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <Input
                                label="Strap/Banding Spec"
                                placeholder="e.g., 15 mm GRP"
                                value={formData.packaging?.strapSpec || ''}
                                onChange={(e) => setFormData(prev => ({
                                    ...prev,
                                    packaging: { ...prev.packaging, strapSpec: e.target.value }
                                }))}
                            />
                        </div>
                    </Card>

                    <Card className="overflow-hidden">
                        <div className="p-5 bg-gradient-to-r from-slate-50 to-gray-50 border-b border-slate-100">
                            <h3 className="text-lg font-bold text-gray-900">Delivery Validation</h3>
                        </div>
                        <div className="p-6 space-y-3">
                            <div className={`flex items-center gap-3 p-4 rounded-xl ${formData.outerType ? 'bg-emerald-50 border-2 border-emerald-200' : 'bg-gray-50 border-2 border-gray-200'}`}>
                                {formData.outerType ? (
                                    <CheckCircleIcon className="h-6 w-6 text-emerald-500" />
                                ) : (
                                    <ExclamationCircleIcon className="h-6 w-6 text-gray-400" />
                                )}
                                <span className={`font-medium ${formData.outerType ? 'text-emerald-700' : 'text-gray-500'}`}>
                                    Outer type {formData.outerType ? 'selected' : 'required'}
                                </span>
                            </div>
                            <div className={`flex items-center gap-3 p-4 rounded-xl ${formData.deliveryAddress ? 'bg-emerald-50 border-2 border-emerald-200' : 'bg-amber-50 border-2 border-amber-200'}`}>
                                {formData.deliveryAddress ? (
                                    <CheckCircleIcon className="h-6 w-6 text-emerald-500" />
                                ) : (
                                    <ExclamationCircleIcon className="h-6 w-6 text-amber-500" />
                                )}
                                <span className={`font-medium ${formData.deliveryAddress ? 'text-emerald-700' : 'text-amber-700'}`}>
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
