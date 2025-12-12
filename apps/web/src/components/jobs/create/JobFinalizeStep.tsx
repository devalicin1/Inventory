import React from 'react';
import { PhotoIcon, WrenchScrewdriverIcon, TrashIcon, PlusIcon, DocumentIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import type { JobFormData } from './types';
import { Card } from '../../ui/Card';
import { Button } from '../../ui/Button';

interface JobFinalizeStepProps {
    formData: JobFormData;
    setFormData: React.Dispatch<React.SetStateAction<JobFormData>>;
}

export const JobFinalizeStep: React.FC<JobFinalizeStepProps> = ({
    formData,
    setFormData,
}) => {
    const addAttachment = () => {
        setFormData(prev => ({
            ...prev,
            attachments: [...prev.attachments, { name: '', storagePath: '', type: '' }]
        }));
    };

    const removeAttachment = (index: number) => {
        setFormData(prev => ({
            ...prev,
            attachments: prev.attachments.filter((_, i) => i !== index)
        }));
    };

    const updateAttachment = (index: number, field: string, value: string) => {
        setFormData(prev => ({
            ...prev,
            attachments: prev.attachments.map((a, i) => i === index ? { ...a, [field]: value } : a)
        }));
    };

    const addSpecialComponent = () => {
        setFormData(prev => ({
            ...prev,
            specialComponents: [...prev.specialComponents, { description: '', supplier: '', ordered: '', due: '', received: false }]
        }));
    };

    const removeSpecialComponent = (index: number) => {
        setFormData(prev => ({
            ...prev,
            specialComponents: prev.specialComponents.filter((_, i) => i !== index)
        }));
    };

    const updateSpecialComponent = (index: number, field: string, value: any) => {
        setFormData(prev => ({
            ...prev,
            specialComponents: prev.specialComponents.map((c, i) => i === index ? { ...c, [field]: value } : c)
        }));
    };

    return (
        <div className="space-y-4">
            {/* Attachments Section */}
            <Card className="overflow-hidden">
                <div className="flex items-center justify-between p-4 bg-gradient-to-r from-violet-50 to-purple-50 border-b border-violet-100">
                    <h3 className="text-lg font-bold text-gray-900 flex items-center gap-3">
                        <div className="p-2 bg-violet-500 rounded-xl shadow-lg shadow-violet-200">
                            <PhotoIcon className="h-5 w-5 text-white" />
                        </div>
                        Attachments
                        {formData.attachments.length > 0 && (
                            <span className="ml-2 px-2.5 py-0.5 bg-violet-500 text-white text-xs font-bold rounded-full">
                                {formData.attachments.length}
                            </span>
                        )}
                    </h3>
                    <Button 
                        size="sm" 
                        variant="secondary" 
                        onClick={addAttachment} 
                        leftIcon={<PlusIcon className="h-4 w-4" />}
                        className="shadow-sm"
                    >
                        Add File
                    </Button>
                </div>

                <div className="p-4">
                    {formData.attachments.length === 0 ? (
                        <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                            <DocumentIcon className="h-12 w-12 mx-auto text-gray-300 mb-3" />
                            <p className="text-gray-500 font-medium">No attachments added</p>
                            <p className="text-sm text-gray-400 mt-1">Add dielines, artwork, or other relevant files</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {/* Table Header - Desktop */}
                            <div className="hidden md:grid md:grid-cols-12 gap-4 px-4 py-2 bg-gray-50 rounded-lg text-xs font-bold text-gray-500 uppercase tracking-wider">
                                <div className="col-span-4">File Name</div>
                                <div className="col-span-5">Storage Path / URL</div>
                                <div className="col-span-2">Type</div>
                                <div className="col-span-1"></div>
                            </div>
                            
                            {formData.attachments.map((a, index) => (
                                <div 
                                    key={index} 
                                    className="group bg-white rounded-xl border-2 border-gray-100 hover:border-violet-200 hover:shadow-md transition-all duration-200"
                                >
                                    {/* Desktop View */}
                                    <div className="hidden md:grid md:grid-cols-12 gap-4 items-center p-4">
                                        <div className="col-span-4">
                                            <input
                                                type="text"
                                                value={a.name}
                                                onChange={(e) => updateAttachment(index, 'name', e.target.value)}
                                                placeholder="File name..."
                                                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-violet-400 focus:ring-2 focus:ring-violet-100 text-sm font-medium transition-all"
                                            />
                                        </div>
                                        <div className="col-span-5">
                                            <input
                                                type="text"
                                                value={a.storagePath}
                                                onChange={(e) => updateAttachment(index, 'storagePath', e.target.value)}
                                                placeholder="URL or path..."
                                                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-violet-400 focus:ring-2 focus:ring-violet-100 text-sm transition-all"
                                            />
                                        </div>
                                        <div className="col-span-2">
                                            <input
                                                type="text"
                                                value={a.type}
                                                onChange={(e) => updateAttachment(index, 'type', e.target.value)}
                                                placeholder="Type..."
                                                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-violet-400 focus:ring-2 focus:ring-violet-100 text-sm transition-all"
                                            />
                                        </div>
                                        <div className="col-span-1 flex justify-end">
                                            <button
                                                onClick={() => removeAttachment(index)}
                                                className="p-2.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                                            >
                                                <TrashIcon className="h-5 w-5" />
                                            </button>
                                        </div>
                                    </div>
                                    
                                    {/* Mobile View */}
                                    <div className="md:hidden p-4 space-y-3">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-bold text-gray-400 uppercase">File #{index + 1}</span>
                                            <button
                                                onClick={() => removeAttachment(index)}
                                                className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                            >
                                                <TrashIcon className="h-4 w-4" />
                                            </button>
                                        </div>
                                        <input
                                            type="text"
                                            value={a.name}
                                            onChange={(e) => updateAttachment(index, 'name', e.target.value)}
                                            placeholder="File name"
                                            className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-violet-400 text-sm font-medium"
                                        />
                                        <input
                                            type="text"
                                            value={a.storagePath}
                                            onChange={(e) => updateAttachment(index, 'storagePath', e.target.value)}
                                            placeholder="Storage Path / URL"
                                            className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-violet-400 text-sm"
                                        />
                                        <input
                                            type="text"
                                            value={a.type}
                                            onChange={(e) => updateAttachment(index, 'type', e.target.value)}
                                            placeholder="Type"
                                            className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-violet-400 text-sm"
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </Card>

            {/* Special Components */}
            <Card className="overflow-hidden">
                <div className="flex items-center justify-between p-5 bg-gradient-to-r from-orange-50 to-amber-50 border-b border-orange-100">
                    <h3 className="text-lg font-bold text-gray-900 flex items-center gap-3">
                        <div className="p-2 bg-orange-500 rounded-xl shadow-lg shadow-orange-200">
                            <WrenchScrewdriverIcon className="h-5 w-5 text-white" />
                        </div>
                        Special Components
                        {formData.specialComponents.length > 0 && (
                            <span className="ml-2 px-2.5 py-0.5 bg-orange-500 text-white text-xs font-bold rounded-full">
                                {formData.specialComponents.length}
                            </span>
                        )}
                    </h3>
                    <Button 
                        size="sm" 
                        variant="secondary" 
                        onClick={addSpecialComponent} 
                        leftIcon={<PlusIcon className="h-4 w-4" />}
                        className="shadow-sm"
                    >
                        Add Component
                    </Button>
                </div>

                <div className="p-5">
                    {formData.specialComponents.length === 0 ? (
                        <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                            <WrenchScrewdriverIcon className="h-12 w-12 mx-auto text-gray-300 mb-3" />
                            <p className="text-gray-500 font-medium">No special components</p>
                            <p className="text-sm text-gray-400 mt-1">Add any special components or materials</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {formData.specialComponents.map((c, index) => (
                                <div 
                                    key={index} 
                                    className="group bg-white rounded-xl border-2 border-gray-100 hover:border-orange-200 hover:shadow-md transition-all duration-200 p-5"
                                >
                                    <div className="flex items-center justify-between mb-4">
                                        <span className="text-xs font-bold text-gray-400 uppercase">Component #{index + 1}</span>
                                        <button
                                            onClick={() => removeSpecialComponent(index)}
                                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                                        >
                                            <TrashIcon className="h-5 w-5" />
                                        </button>
                                    </div>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                        <div>
                                            <label className="block text-sm font-semibold text-gray-700 mb-2">Description</label>
                                            <input
                                                type="text"
                                                value={c.description}
                                                onChange={(e) => updateSpecialComponent(index, 'description', e.target.value)}
                                                placeholder="Component description..."
                                                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-orange-400 focus:ring-2 focus:ring-orange-100 text-sm transition-all"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-semibold text-gray-700 mb-2">Supplier</label>
                                            <input
                                                type="text"
                                                value={c.supplier}
                                                onChange={(e) => updateSpecialComponent(index, 'supplier', e.target.value)}
                                                placeholder="Supplier name..."
                                                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-orange-400 focus:ring-2 focus:ring-orange-100 text-sm transition-all"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-semibold text-gray-700 mb-2">Ordered Date</label>
                                            <input
                                                type="date"
                                                value={c.ordered}
                                                onChange={(e) => updateSpecialComponent(index, 'ordered', e.target.value)}
                                                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-orange-400 focus:ring-2 focus:ring-orange-100 text-sm transition-all"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-semibold text-gray-700 mb-2">Due Date</label>
                                            <input
                                                type="date"
                                                value={c.due}
                                                onChange={(e) => updateSpecialComponent(index, 'due', e.target.value)}
                                                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-orange-400 focus:ring-2 focus:ring-orange-100 text-sm transition-all"
                                            />
                                        </div>
                                    </div>
                                    
                                    <div className="mt-4 pt-4 border-t border-gray-100">
                                        <label className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all ${c.received ? 'bg-emerald-50 border-2 border-emerald-200' : 'bg-gray-50 border-2 border-gray-200 hover:border-gray-300'}`}>
                                            <input
                                                type="checkbox"
                                                checked={c.received}
                                                onChange={(e) => updateSpecialComponent(index, 'received', e.target.checked)}
                                                className="w-5 h-5 rounded-lg border-2 border-gray-300 text-emerald-600 focus:ring-emerald-500"
                                            />
                                            <span className={`font-medium ${c.received ? 'text-emerald-700' : 'text-gray-600'}`}>
                                                {c.received ? 'Received' : 'Mark as Received'}
                                            </span>
                                            {c.received && <CheckCircleIcon className="h-5 w-5 text-emerald-500 ml-auto" />}
                                        </label>
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
