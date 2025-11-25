import React from 'react';
import { ShoppingCartIcon, TrashIcon, PlusIcon } from '@heroicons/react/24/outline';
import type { JobFormData } from './types';
import { Card } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { Input } from '../../ui/Input';

interface JobMaterialsStepProps {
    formData: JobFormData;
    setFormData: React.Dispatch<React.SetStateAction<JobFormData>>;
    products: any[];
}

export const JobMaterialsStep: React.FC<JobMaterialsStepProps> = ({
    formData,
    setFormData,
    products: _products,
}) => {
    const addMaterial = () => {
        setFormData(prev => ({
            ...prev,
            bom: [...prev.bom, { sku: '', name: '', qty: 1, uom: 'pcs' }]
        }));
    };

    const removeMaterial = (index: number) => {
        setFormData(prev => ({
            ...prev,
            bom: prev.bom.filter((_, i) => i !== index)
        }));
    };

    const updateMaterial = (index: number, field: string, value: any) => {
        setFormData(prev => ({
            ...prev,
            bom: prev.bom.map((item, i) => i === index ? { ...item, [field]: value } : item)
        }));
    };

    const addOutput = () => {
        setFormData(prev => ({
            ...prev,
            output: [...prev.output, { sku: '', name: '', qtyPlanned: 0, uom: 'pcs' }]
        }));
    };

    const removeOutput = (index: number) => {
        setFormData(prev => ({
            ...prev,
            output: prev.output.filter((_, i) => i !== index)
        }));
    };

    const updateOutput = (index: number, field: string, value: any) => {
        setFormData(prev => ({
            ...prev,
            output: prev.output.map((item, i) => i === index ? { ...item, [field]: value } : item)
        }));
    };

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            <div className="mb-8">
                <h2 className="text-2xl font-bold text-gray-900">Materials & Outputs</h2>
                <p className="text-gray-600 mt-2">Manage bill of materials and planned outputs</p>
            </div>

            <div className="grid grid-cols-1 gap-6">
                {/* Materials Section */}
                <Card>
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                            <ShoppingCartIcon className="h-5 w-5 text-primary-600" />
                            Required Materials
                        </h3>
                        <Button size="sm" variant="secondary" onClick={addMaterial} leftIcon={<PlusIcon className="h-4 w-4" />}>
                            Add Material
                        </Button>
                    </div>

                    <div className="space-y-4">
                        {formData.bom.length === 0 ? (
                            <div className="text-center py-8 bg-gray-50 rounded-lg border border-dashed border-gray-300 text-gray-500">
                                No materials added yet. Click "Add Material" to start.
                            </div>
                        ) : (
                            formData.bom.map((item, index) => (
                                <div key={index} className="flex gap-4 items-start p-4 bg-gray-50 rounded-lg border border-gray-200">
                                    <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <Input
                                            label="SKU / Material"
                                            value={item.sku}
                                            onChange={(e) => updateMaterial(index, 'sku', e.target.value)}
                                            placeholder="Search material..."
                                        />
                                        <Input
                                            label="Description"
                                            value={item.name}
                                            onChange={(e) => updateMaterial(index, 'name', e.target.value)}
                                            placeholder="Material description"
                                        />
                                        <div className="grid grid-cols-2 gap-2">
                                            <Input
                                                type="number"
                                                label="Qty"
                                                value={item.qty}
                                                onChange={(e) => updateMaterial(index, 'qty', Number(e.target.value))}
                                            />
                                            <Input
                                                label="Unit"
                                                value={item.uom}
                                                onChange={(e) => updateMaterial(index, 'uom', e.target.value)}
                                            />
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => removeMaterial(index)}
                                        className="mt-8 p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                    >
                                        <TrashIcon className="h-5 w-5" />
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </Card>

                {/* Outputs Section */}
                <Card>
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                            <ShoppingCartIcon className="h-5 w-5 text-primary-600" />
                            Planned Outputs
                        </h3>
                        <Button size="sm" variant="secondary" onClick={addOutput} leftIcon={<PlusIcon className="h-4 w-4" />}>
                            Add Output
                        </Button>
                    </div>

                    <div className="space-y-4">
                        {formData.output.length === 0 ? (
                            <div className="text-center py-8 bg-gray-50 rounded-lg border border-dashed border-gray-300 text-gray-500">
                                No additional outputs defined. The main product will be the primary output.
                            </div>
                        ) : (
                            formData.output.map((item, index) => (
                                <div key={index} className="flex gap-4 items-start p-4 bg-gray-50 rounded-lg border border-gray-200">
                                    <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <Input
                                            label="Output SKU"
                                            value={item.sku}
                                            onChange={(e) => updateOutput(index, 'sku', e.target.value)}
                                        />
                                        <Input
                                            label="Name"
                                            value={item.name}
                                            onChange={(e) => updateOutput(index, 'name', e.target.value)}
                                        />
                                        <div className="grid grid-cols-2 gap-2">
                                            <Input
                                                type="number"
                                                label="Planned Qty"
                                                value={item.qtyPlanned}
                                                onChange={(e) => updateOutput(index, 'qtyPlanned', Number(e.target.value))}
                                            />
                                            <Input
                                                label="Unit"
                                                value={item.uom}
                                                onChange={(e) => updateOutput(index, 'uom', e.target.value)}
                                            />
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => removeOutput(index)}
                                        className="mt-8 p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                    >
                                        <TrashIcon className="h-5 w-5" />
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </Card>
            </div>
        </div>
    );
};
