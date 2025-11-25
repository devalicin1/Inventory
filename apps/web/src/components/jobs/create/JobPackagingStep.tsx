import React from 'react';
import { TruckIcon, TagIcon } from '@heroicons/react/24/outline';
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
        <div className="max-w-6xl mx-auto space-y-6">
            <div className="mb-8">
                <h2 className="text-2xl font-bold text-gray-900">Logistics & Delivery</h2>
                <p className="text-gray-600 mt-2">Configure delivery details and packaging information</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-6">
                    <Card>
                        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                            <TruckIcon className="h-5 w-5 text-primary-600" />
                            Delivery Information
                        </h3>
                        <div className="space-y-4">
                            <div className="bg-primary-50 rounded-lg border border-primary-200 p-4 mb-4">
                                <h4 className="text-sm font-semibold text-primary-900 mb-3">Packaging Configuration</h4>
                                <div className="grid grid-cols-2 gap-4 mb-4">
                                    <div>
                                        <label className="block text-xs font-medium text-primary-900 mb-1.5">
                                            Pieces per Box (PCS/Box) *
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
                                            className="block w-full rounded-lg border-primary-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 py-2 px-3 border bg-white text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-primary-900 mb-1.5">
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
                                            className="block w-full rounded-lg border-primary-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 py-2 px-3 border bg-white text-sm"
                                        />
                                    </div>
                                </div>
                                <div className="pt-3 border-t border-primary-300">
                                    <h4 className="text-sm font-semibold text-primary-900 mb-2">Packing Plan Summary</h4>
                                    <div className="grid grid-cols-2 gap-2 text-sm text-primary-900">
                                        <div className="flex justify-between"><span>EA/Outer</span><span className="font-medium">{formData.packaging?.pcsPerBox || '-'}</span></div>
                                        <div className="flex justify-between"><span>Outers/Pallet</span><span className="font-medium">{formData.packaging?.boxesPerPallet || '-'}</span></div>
                                        <div className="flex justify-between"><span>Planned Outers</span><span className="font-medium">{planned.plannedOuters}</span></div>
                                        <div className="flex justify-between"><span>Planned Pallets</span><span className="font-medium">{planned.pallets}</span></div>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Outer Type *</label>
                                    <select
                                        value={formData.outerType}
                                        onChange={(e) => setFormData(prev => ({ ...prev, outerType: e.target.value as any }))}
                                        className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 py-2.5 px-3 border bg-white"
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
                                <label className="block text-sm font-medium text-gray-700 mb-2">Delivery Address</label>
                                <textarea
                                    placeholder="Enter full delivery address"
                                    value={formData.deliveryAddress}
                                    onChange={(e) => setFormData(prev => ({ ...prev, deliveryAddress: e.target.value }))}
                                    className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 transition-colors py-2.5 px-3 border"
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
                    <Card>
                        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                            <TagIcon className="h-5 w-5 text-primary-600" />
                            Packaging Details
                        </h3>
                        <div className="space-y-4">
                            <Input
                                type="number"
                                label="Weight per Box (kg)"
                                placeholder="Box weight"
                                value={formData.weightPerBox}
                                onChange={(e) => setFormData(prev => ({ ...prev, weightPerBox: e.target.value ? Number(e.target.value) : undefined }))}
                            />

                            {formData.weightPerBox !== undefined && formData.weightPerBox >= 0 && (
                                <div className="bg-primary-50 border border-primary-200 rounded-lg p-4 text-sm text-primary-900">
                                    <div className="font-semibold mb-1">Weight Calculation</div>
                                    <div className="space-y-1">
                                        <div className="flex justify-between">
                                            <span>Planned total weight:</span>
                                            <span className="font-medium">{(planned.plannedOuters * (formData.weightPerBox || 0)).toFixed(2)} kg</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>Full pallet weight:</span>
                                            <span className="font-medium">{((formData.packaging?.boxesPerPallet || 0) * (formData.weightPerBox || 0)).toFixed(2)} kg</span>
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

                    <Card>
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Delivery Validation</h3>
                        <div className="space-y-3 text-sm text-gray-600">
                            <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${formData.outerType ? 'bg-green-500' : 'bg-gray-300'
                                    }`}></div>
                                <span>Outer type {formData.outerType ? 'selected' : 'required'}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${formData.deliveryAddress ? 'bg-green-500' : 'bg-amber-500'
                                    }`}></div>
                                <span>Delivery address {formData.deliveryAddress ? 'provided' : 'recommended'}</span>
                            </div>
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
};
