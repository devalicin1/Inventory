import React from 'react';
import { ClipboardDocumentListIcon, CalendarIcon, ClockIcon, UserGroupIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import type { JobFormData } from './types';
import { Card } from '../../ui/Card';
import { Input } from '../../ui/Input';

interface JobWorkflowStepProps {
    formData: JobFormData;
    setFormData: React.Dispatch<React.SetStateAction<JobFormData>>;
    workflows: any[];
    workcenters: any[];
    resources: any[];
}

export const JobWorkflowStep: React.FC<JobWorkflowStepProps> = ({
    formData,
    setFormData,
    workflows,
    workcenters,
    resources,
}) => {
    const selectedWorkflow = workflows.find(w => w.id === formData.workflowId);

    // Helper to calculate schedule slack (simplified version of original logic)
    const scheduleSlackMs = React.useMemo(() => {
        if (!formData.plannedEnd || !formData.dueDate) return undefined;
        return new Date(formData.dueDate).getTime() - new Date(formData.plannedEnd).getTime();
    }, [formData.plannedEnd, formData.dueDate]);

    const leadTimeMs = React.useMemo(() => {
        if (!formData.plannedStart || !formData.plannedEnd) return undefined;
        return new Date(formData.plannedEnd).getTime() - new Date(formData.plannedStart).getTime();
    }, [formData.plannedStart, formData.plannedEnd]);

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            <div className="mb-8">
                <h2 className="text-2xl font-bold text-gray-900">Workflow & Team</h2>
                <p className="text-gray-600 mt-2">Configure production workflow and assign team members</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Workflow Configuration */}
                <div className="space-y-6">
                    <Card>
                        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                            <ClipboardDocumentListIcon className="h-5 w-5 text-primary-600" />
                            Workflow Setup
                        </h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Production Workflow *</label>
                                <select
                                    value={formData.workflowId}
                                    onChange={(e) => {
                                        const wf = workflows.find(w => w.id === e.target.value);
                                        setFormData(prev => ({
                                            ...prev,
                                            workflowId: e.target.value,
                                            currentStageId: wf?.stages?.[0]?.id || '',
                                            plannedStageIds: (wf?.stages || []).map((s: any) => s.id)
                                        }));
                                    }}
                                    className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 py-2.5 px-3 border bg-white"
                                >
                                    <option value="">Select a workflow...</option>
                                    {workflows.map(workflow => (
                                        <option key={workflow.id} value={workflow.id}>{workflow.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Workcenter</label>
                                <select
                                    value={formData.workcenterId}
                                    onChange={(e) => setFormData(prev => ({ ...prev, workcenterId: e.target.value }))}
                                    className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 py-2.5 px-3 border bg-white"
                                >
                                    <option value="">Any Workcenter</option>
                                    {workcenters.map(wc => (
                                        <option key={wc.id} value={wc.id}>{wc.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </Card>

                    <Card>
                        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                            <CalendarIcon className="h-5 w-5 text-primary-600" />
                            Production Stages
                        </h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Start Stage *</label>
                                <select
                                    value={formData.currentStageId}
                                    onChange={(e) => setFormData(prev => ({ ...prev, currentStageId: e.target.value }))}
                                    className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 py-2.5 px-3 border bg-white"
                                >
                                    <option value="">Select starting stage...</option>
                                    {(selectedWorkflow?.stages || []).map((s: any) => (
                                        <option key={s.id} value={s.id}>{s.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Included Stages *</label>
                                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 max-h-48 overflow-y-auto">
                                    <div className="space-y-2">
                                        {(selectedWorkflow?.stages || []).map((s: any) => {
                                            const checked = (formData.plannedStageIds || []).includes(s.id);
                                            return (
                                                <label key={s.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white transition-colors cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={!!checked}
                                                        onChange={(e) => {
                                                            const next = new Set(formData.plannedStageIds || []);
                                                            if (e.target.checked) next.add(s.id); else next.delete(s.id);
                                                            const nextArr = Array.from(next);
                                                            setFormData(prev => ({
                                                                ...prev,
                                                                plannedStageIds: nextArr,
                                                                currentStageId: nextArr.includes(prev.currentStageId) ? prev.currentStageId : (nextArr[0] || '')
                                                            }));
                                                        }}
                                                        className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                                                    />
                                                    <span className="text-sm font-medium text-gray-700">{s.name}</span>
                                                </label>
                                            );
                                        })}
                                    </div>
                                </div>
                                {(formData.plannedStageIds || []).length === 0 && (
                                    <p className="text-red-500 text-sm mt-2 flex items-center gap-1">
                                        <ExclamationTriangleIcon className="h-4 w-4" />
                                        Select at least one production stage
                                    </p>
                                )}
                            </div>
                        </div>
                    </Card>
                </div>

                {/* Timeline & Team */}
                <div className="space-y-6">
                    <Card>
                        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                            <ClockIcon className="h-5 w-5 text-primary-600" />
                            Production Timeline
                        </h3>
                        <div className="space-y-4">
                            <Input
                                type="datetime-local"
                                label="Planned Start Date"
                                value={formData.plannedStart}
                                onChange={(e) => setFormData(prev => ({ ...prev, plannedStart: e.target.value }))}
                            />
                            <Input
                                type="datetime-local"
                                label="Planned Completion"
                                value={formData.plannedEnd}
                                onChange={(e) => setFormData(prev => ({ ...prev, plannedEnd: e.target.value }))}
                            />
                            <Input
                                type="datetime-local"
                                label="Due Date"
                                value={formData.dueDate}
                                onChange={(e) => setFormData(prev => ({ ...prev, dueDate: e.target.value }))}
                            />

                            {(leadTimeMs !== undefined || scheduleSlackMs !== undefined) && (
                                <div className="bg-primary-50 rounded-lg border border-primary-200 p-4">
                                    <h4 className="text-sm font-semibold text-primary-900 mb-2">Schedule Summary</h4>
                                    <div className="space-y-1 text-sm text-primary-900">
                                        {leadTimeMs !== undefined && (
                                            <div className="flex justify-between">
                                                <span>Lead Time:</span>
                                                <span className="font-medium">{Math.round(leadTimeMs / 36e5)} hours</span>
                                            </div>
                                        )}
                                        {scheduleSlackMs !== undefined && (
                                            <div className={`flex justify-between ${scheduleSlackMs < 0 ? 'text-amber-700' : ''}`}>
                                                <span>Slack to Due Date:</span>
                                                <span className="font-medium">
                                                    {Math.round(Math.abs(scheduleSlackMs) / 86400000)} days
                                                    {scheduleSlackMs < 0 && ' (late risk)'}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </Card>

                    <Card>
                        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                            <UserGroupIcon className="h-5 w-5 text-primary-600" />
                            Team Assignment
                        </h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Assign Team Members</label>
                                <select
                                    multiple
                                    value={formData.assignees}
                                    onChange={(e) => setFormData(prev => ({ ...prev, assignees: Array.from(e.target.selectedOptions, option => option.value) }))}
                                    className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 transition-colors py-2.5 px-3 border bg-white h-48"
                                >
                                    {resources.map(resource => (
                                        <option key={resource.id} value={resource.id}>
                                            {resource.name} - {resource.role || 'Team Member'}
                                        </option>
                                    ))}
                                </select>
                                <p className="text-xs text-gray-500 mt-2">
                                    Hold <kbd className="px-1 py-0.5 bg-gray-100 border border-gray-300 rounded text-xs">Ctrl</kbd> or
                                    <kbd className="px-1 py-0.5 bg-gray-100 border border-gray-300 rounded text-xs mx-1">Cmd</kbd>
                                    to select multiple team members
                                </p>
                            </div>

                            {formData.assignees.length > 0 && (
                                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                                    <h4 className="text-sm font-semibold text-green-800 mb-2">Selected Team Members</h4>
                                    <div className="space-y-2">
                                        {formData.assignees.map(assigneeId => {
                                            const resource = resources.find(r => r.id === assigneeId);
                                            return resource ? (
                                                <div key={assigneeId} className="flex items-center gap-2 text-sm text-green-700">
                                                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                                    <span className="font-medium">{resource.name}</span>
                                                    <span className="text-green-600">({resource.role || 'Team Member'})</span>
                                                </div>
                                            ) : null;
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
};
