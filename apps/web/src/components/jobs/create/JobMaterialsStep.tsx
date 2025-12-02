import React from 'react';
import { ShoppingCartIcon, TrashIcon, PlusIcon, CubeIcon, ArchiveBoxIcon } from '@heroicons/react/24/outline';
import type { JobFormData } from './types';
import { Card } from '../../ui/Card';
import { Button } from '../../ui/Button';

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
        <div className="space-y-8">
            {/* Materials Section */}
            <Card className="overflow-hidden">
                <div className="flex items-center justify-between p-5 bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-100">
                    <h3 className="text-lg font-bold text-gray-900 flex items-center gap-3">
                        <div className="p-2 bg-amber-500 rounded-xl shadow-lg shadow-amber-200">
                            <CubeIcon className="h-5 w-5 text-white" />
                        </div>
                        Required Materials
                        {formData.bom.length > 0 && (
                            <span className="ml-2 px-2.5 py-0.5 bg-amber-500 text-white text-xs font-bold rounded-full">
                                {formData.bom.length}
                            </span>
                        )}
                    </h3>
                    <Button 
                        size="sm" 
                        variant="secondary" 
                        onClick={addMaterial} 
                        leftIcon={<PlusIcon className="h-4 w-4" />}
                        className="shadow-sm"
                    >
                        Add Material
                    </Button>
                </div>

                <div className="p-5">
                    {formData.bom.length === 0 ? (
                        <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                            <CubeIcon className="h-12 w-12 mx-auto text-gray-300 mb-3" />
                            <p className="text-gray-500 font-medium">No materials added yet</p>
                            <p className="text-sm text-gray-400 mt-1">Click "Add Material" to start building your BOM</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {/* Table Header - Desktop */}
                            <div className="hidden md:grid md:grid-cols-12 gap-4 px-4 py-2 bg-gray-50 rounded-lg text-xs font-bold text-gray-500 uppercase tracking-wider">
                                <div className="col-span-3">SKU / Material</div>
                                <div className="col-span-5">Description</div>
                                <div className="col-span-2">Quantity</div>
                                <div className="col-span-1">Unit</div>
                                <div className="col-span-1"></div>
                            </div>
                            
                            {formData.bom.map((item, index) => (
                                <div 
                                    key={index} 
                                    className="group bg-white rounded-xl border-2 border-gray-100 hover:border-amber-200 hover:shadow-md transition-all duration-200"
                                >
                                    {/* Desktop View */}
                                    <div className="hidden md:grid md:grid-cols-12 gap-4 items-center p-4">
                                        <div className="col-span-3">
                                            <input
                                                type="text"
                                                value={item.sku}
                                                onChange={(e) => updateMaterial(index, 'sku', e.target.value)}
                                                placeholder="Enter SKU..."
                                                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-amber-400 focus:ring-2 focus:ring-amber-100 text-sm font-medium transition-all"
                                            />
                                        </div>
                                        <div className="col-span-5">
                                            <input
                                                type="text"
                                                value={item.name}
                                                onChange={(e) => updateMaterial(index, 'name', e.target.value)}
                                                placeholder="Material description..."
                                                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-amber-400 focus:ring-2 focus:ring-amber-100 text-sm transition-all"
                                            />
                                        </div>
                                        <div className="col-span-2">
                                            <input
                                                type="number"
                                                value={item.qty}
                                                onChange={(e) => updateMaterial(index, 'qty', Number(e.target.value))}
                                                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-amber-400 focus:ring-2 focus:ring-amber-100 text-sm font-bold text-center transition-all"
                                            />
                                        </div>
                                        <div className="col-span-1">
                                            <input
                                                type="text"
                                                value={item.uom}
                                                onChange={(e) => updateMaterial(index, 'uom', e.target.value)}
                                                className="w-full px-3 py-3 rounded-xl border-2 border-gray-200 focus:border-amber-400 focus:ring-2 focus:ring-amber-100 text-sm text-center transition-all"
                                            />
                                        </div>
                                        <div className="col-span-1 flex justify-end">
                                            <button
                                                onClick={() => removeMaterial(index)}
                                                className="p-2.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                                            >
                                                <TrashIcon className="h-5 w-5" />
                                            </button>
                                        </div>
                                    </div>
                                    
                                    {/* Mobile View */}
                                    <div className="md:hidden p-4 space-y-3">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-bold text-gray-400 uppercase">Material #{index + 1}</span>
                                            <button
                                                onClick={() => removeMaterial(index)}
                                                className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                            >
                                                <TrashIcon className="h-4 w-4" />
                                            </button>
                                        </div>
                                        <input
                                            type="text"
                                            value={item.sku}
                                            onChange={(e) => updateMaterial(index, 'sku', e.target.value)}
                                            placeholder="SKU / Material"
                                            className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-amber-400 text-sm font-medium"
                                        />
                                        <input
                                            type="text"
                                            value={item.name}
                                            onChange={(e) => updateMaterial(index, 'name', e.target.value)}
                                            placeholder="Description"
                                            className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-amber-400 text-sm"
                                        />
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-xs font-medium text-gray-500 mb-1">Quantity</label>
                                                <input
                                                    type="number"
                                                    value={item.qty}
                                                    onChange={(e) => updateMaterial(index, 'qty', Number(e.target.value))}
                                                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-amber-400 text-sm font-bold"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-gray-500 mb-1">Unit</label>
                                                <input
                                                    type="text"
                                                    value={item.uom}
                                                    onChange={(e) => updateMaterial(index, 'uom', e.target.value)}
                                                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-amber-400 text-sm"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </Card>

            {/* Outputs Section */}
            <Card className="overflow-hidden">
                <div className="flex items-center justify-between p-5 bg-gradient-to-r from-emerald-50 to-green-50 border-b border-emerald-100">
                    <h3 className="text-lg font-bold text-gray-900 flex items-center gap-3">
                        <div className="p-2 bg-emerald-500 rounded-xl shadow-lg shadow-emerald-200">
                            <ArchiveBoxIcon className="h-5 w-5 text-white" />
                        </div>
                        Planned Outputs
                        {formData.output.length > 0 && (
                            <span className="ml-2 px-2.5 py-0.5 bg-emerald-500 text-white text-xs font-bold rounded-full">
                                {formData.output.length}
                            </span>
                        )}
                    </h3>
                    <Button 
                        size="sm" 
                        variant="secondary" 
                        onClick={addOutput} 
                        leftIcon={<PlusIcon className="h-4 w-4" />}
                        className="shadow-sm"
                    >
                        Add Output
                    </Button>
                </div>

                <div className="p-5">
                    {formData.output.length === 0 ? (
                        <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                            <ArchiveBoxIcon className="h-12 w-12 mx-auto text-gray-300 mb-3" />
                            <p className="text-gray-500 font-medium">No additional outputs defined</p>
                            <p className="text-sm text-gray-400 mt-1">The main product will be the primary output</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {/* Table Header - Desktop */}
                            <div className="hidden md:grid md:grid-cols-12 gap-4 px-4 py-2 bg-gray-50 rounded-lg text-xs font-bold text-gray-500 uppercase tracking-wider">
                                <div className="col-span-3">Output SKU</div>
                                <div className="col-span-5">Name</div>
                                <div className="col-span-2">Planned Qty</div>
                                <div className="col-span-1">Unit</div>
                                <div className="col-span-1"></div>
                            </div>
                            
                            {formData.output.map((item, index) => (
                                <div 
                                    key={index} 
                                    className="group bg-white rounded-xl border-2 border-gray-100 hover:border-emerald-200 hover:shadow-md transition-all duration-200"
                                >
                                    {/* Desktop View */}
                                    <div className="hidden md:grid md:grid-cols-12 gap-4 items-center p-4">
                                        <div className="col-span-3">
                                            <input
                                                type="text"
                                                value={item.sku}
                                                onChange={(e) => updateOutput(index, 'sku', e.target.value)}
                                                placeholder="Output SKU..."
                                                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 text-sm font-medium transition-all"
                                            />
                                        </div>
                                        <div className="col-span-5">
                                            <input
                                                type="text"
                                                value={item.name}
                                                onChange={(e) => updateOutput(index, 'name', e.target.value)}
                                                placeholder="Product name..."
                                                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 text-sm transition-all"
                                            />
                                        </div>
                                        <div className="col-span-2">
                                            <input
                                                type="number"
                                                value={item.qtyPlanned}
                                                onChange={(e) => updateOutput(index, 'qtyPlanned', Number(e.target.value))}
                                                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 text-sm font-bold text-center transition-all"
                                            />
                                        </div>
                                        <div className="col-span-1">
                                            <input
                                                type="text"
                                                value={item.uom}
                                                onChange={(e) => updateOutput(index, 'uom', e.target.value)}
                                                className="w-full px-3 py-3 rounded-xl border-2 border-gray-200 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 text-sm text-center transition-all"
                                            />
                                        </div>
                                        <div className="col-span-1 flex justify-end">
                                            <button
                                                onClick={() => removeOutput(index)}
                                                className="p-2.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                                            >
                                                <TrashIcon className="h-5 w-5" />
                                            </button>
                                        </div>
                                    </div>
                                    
                                    {/* Mobile View */}
                                    <div className="md:hidden p-4 space-y-3">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-bold text-gray-400 uppercase">Output #{index + 1}</span>
                                            <button
                                                onClick={() => removeOutput(index)}
                                                className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                            >
                                                <TrashIcon className="h-4 w-4" />
                                            </button>
                                        </div>
                                        <input
                                            type="text"
                                            value={item.sku}
                                            onChange={(e) => updateOutput(index, 'sku', e.target.value)}
                                            placeholder="Output SKU"
                                            className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-emerald-400 text-sm font-medium"
                                        />
                                        <input
                                            type="text"
                                            value={item.name}
                                            onChange={(e) => updateOutput(index, 'name', e.target.value)}
                                            placeholder="Product Name"
                                            className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-emerald-400 text-sm"
                                        />
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-xs font-medium text-gray-500 mb-1">Planned Qty</label>
                                                <input
                                                    type="number"
                                                    value={item.qtyPlanned}
                                                    onChange={(e) => updateOutput(index, 'qtyPlanned', Number(e.target.value))}
                                                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-emerald-400 text-sm font-bold"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-gray-500 mb-1">Unit</label>
                                                <input
                                                    type="text"
                                                    value={item.uom}
                                                    onChange={(e) => updateOutput(index, 'uom', e.target.value)}
                                                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-emerald-400 text-sm"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </Card>
        </div>
    );
};
