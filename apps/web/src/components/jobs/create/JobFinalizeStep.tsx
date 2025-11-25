import React from 'react';
import { PhotoIcon, WrenchScrewdriverIcon, TrashIcon, PlusIcon } from '@heroicons/react/24/outline';
import type { JobFormData } from './types';
import { Card } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { Input } from '../../ui/Input';

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
        <div className="max-w-6xl mx-auto space-y-6">
            <div className="mb-8">
                <h2 className="text-2xl font-bold text-gray-900">Finalize Job</h2>
                <p className="text-gray-600 mt-2">Add attachments, special components, and production actuals</p>
            </div>

            <div className="grid grid-cols-1 gap-6">
                {/* Attachments Section */}
                <Card>
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                            <PhotoIcon className="h-5 w-5 text-primary-600" />
                            Attachments
                        </h3>
                        <Button size="sm" variant="secondary" onClick={addAttachment} leftIcon={<PlusIcon className="h-4 w-4" />}>
                            Add File
                        </Button>
                    </div>

                    <div className="space-y-4">
                        {formData.attachments.length === 0 ? (
                            <div className="text-center py-8 bg-gray-50 rounded-lg border border-dashed border-gray-300 text-gray-500">
                                No attachments added. Add dielines, artwork, or other relevant files.
                            </div>
                        ) : (
                            formData.attachments.map((a, index) => (
                                <div key={index} className="flex gap-4 items-start p-4 bg-gray-50 rounded-lg border border-gray-200">
                                    <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <Input
                                            label="Name"
                                            value={a.name}
                                            onChange={(e) => updateAttachment(index, 'name', e.target.value)}
                                        />
                                        <Input
                                            label="Storage Path / URL"
                                            value={a.storagePath}
                                            onChange={(e) => updateAttachment(index, 'storagePath', e.target.value)}
                                        />
                                        <Input
                                            label="Type"
                                            value={a.type}
                                            onChange={(e) => updateAttachment(index, 'type', e.target.value)}
                                        />
                                    </div>
                                    <button
                                        onClick={() => removeAttachment(index)}
                                        className="mt-8 p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                    >
                                        <TrashIcon className="h-5 w-5" />
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </Card>

                {/* Special Components */}
                <Card>
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                            <WrenchScrewdriverIcon className="h-5 w-5 text-primary-600" />
                            Special Components
                        </h3>
                        <Button size="sm" variant="secondary" onClick={addSpecialComponent} leftIcon={<PlusIcon className="h-4 w-4" />}>
                            Add Component
                        </Button>
                    </div>

                    <div className="space-y-4">
                        {formData.specialComponents.length === 0 ? (
                            <div className="text-center py-8 bg-gray-50 rounded-lg border border-dashed border-gray-300 text-gray-500">
                                No special components. Add any special components or materials.
                            </div>
                        ) : (
                            formData.specialComponents.map((c, index) => (
                                <div key={index} className="flex gap-4 items-start p-4 bg-gray-50 rounded-lg border border-gray-200">
                                    <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                        <Input
                                            label="Description"
                                            value={c.description}
                                            onChange={(e) => updateSpecialComponent(index, 'description', e.target.value)}
                                        />
                                        <Input
                                            label="Supplier"
                                            value={c.supplier}
                                            onChange={(e) => updateSpecialComponent(index, 'supplier', e.target.value)}
                                        />
                                        <Input
                                            type="date"
                                            label="Ordered"
                                            value={c.ordered}
                                            onChange={(e) => updateSpecialComponent(index, 'ordered', e.target.value)}
                                        />
                                        <Input
                                            type="date"
                                            label="Due"
                                            value={c.due}
                                            onChange={(e) => updateSpecialComponent(index, 'due', e.target.value)}
                                        />
                                        <div className="flex items-center mt-8">
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={c.received}
                                                    onChange={(e) => updateSpecialComponent(index, 'received', e.target.checked)}
                                                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                                                />
                                                <span className="text-sm font-medium text-gray-700">Received</span>
                                            </label>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => removeSpecialComponent(index)}
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
