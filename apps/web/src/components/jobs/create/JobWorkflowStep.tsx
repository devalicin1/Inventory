import React from 'react';
import { ClipboardDocumentListIcon, CalendarIcon, ClockIcon, UserGroupIcon, ExclamationTriangleIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
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
        <div className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Workflow Configuration */}
                <div className="space-y-6">
                    <Card className="overflow-hidden">
                        <div className="p-5 bg-gradient-to-r from-cyan-50 to-blue-50 border-b border-cyan-100">
                            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-3">
                                <div className="p-2 bg-cyan-500 rounded-xl shadow-lg shadow-cyan-200">
                                    <ClipboardDocumentListIcon className="h-5 w-5 text-white" />
                                </div>
                                Workflow Setup
                            </h3>
                        </div>
                        <div className="p-6 space-y-5">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Production Workflow *</label>
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
                                    className="block w-full rounded-xl border-2 border-gray-200 py-3 px-4 text-base focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100 bg-white transition-all"
                                >
                                    <option value="">Select a workflow...</option>
                                    {workflows.map(workflow => (
                                        <option key={workflow.id} value={workflow.id}>{workflow.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Workcenter</label>
                                <select
                                    value={formData.workcenterId}
                                    onChange={(e) => setFormData(prev => ({ ...prev, workcenterId: e.target.value }))}
                                    className="block w-full rounded-xl border-2 border-gray-200 py-3 px-4 text-base focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100 bg-white transition-all"
                                >
                                    <option value="">Any Workcenter</option>
                                    {workcenters.map(wc => (
                                        <option key={wc.id} value={wc.id}>{wc.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </Card>

                    <Card className="overflow-hidden">
                        <div className="p-5 bg-gradient-to-r from-purple-50 to-indigo-50 border-b border-purple-100">
                            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-3">
                                <div className="p-2 bg-purple-500 rounded-xl shadow-lg shadow-purple-200">
                                    <CalendarIcon className="h-5 w-5 text-white" />
                                </div>
                                Production Stages
                            </h3>
                        </div>
                        <div className="p-6 space-y-5">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Start Stage *</label>
                                <select
                                    value={formData.currentStageId}
                                    onChange={(e) => setFormData(prev => ({ ...prev, currentStageId: e.target.value }))}
                                    className="block w-full rounded-xl border-2 border-gray-200 py-3 px-4 text-base focus:border-purple-500 focus:ring-2 focus:ring-purple-100 bg-white transition-all"
                                >
                                    <option value="">Select starting stage...</option>
                                    {(selectedWorkflow?.stages || []).map((s: any) => (
                                        <option key={s.id} value={s.id}>{s.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Included Stages *</label>
                                <div className="bg-gray-50 border-2 border-gray-200 rounded-xl p-4 max-h-64 overflow-y-auto">
                                    <div className="space-y-2">
                                        {(selectedWorkflow?.stages || []).map((s: any) => {
                                            const checked = (formData.plannedStageIds || []).includes(s.id);
                                            return (
                                                <label key={s.id} className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all ${checked ? 'bg-purple-100 border-2 border-purple-300' : 'bg-white border-2 border-gray-100 hover:border-gray-200'}`}>
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
                                                        className="w-5 h-5 rounded-lg border-2 border-gray-300 text-purple-600 focus:ring-purple-500"
                                                    />
                                                    <span className={`text-sm font-medium ${checked ? 'text-purple-900' : 'text-gray-700'}`}>{s.name}</span>
                                                    {checked && <CheckCircleIcon className="h-5 w-5 text-purple-500 ml-auto" />}
                                                </label>
                                            );
                                        })}
                                    </div>
                                </div>
                                {(formData.plannedStageIds || []).length === 0 && (
                                    <p className="text-red-500 text-sm mt-3 flex items-center gap-2 bg-red-50 p-3 rounded-xl">
                                        <ExclamationTriangleIcon className="h-5 w-5" />
                                        Select at least one production stage
                                    </p>
                                )}
                            </div>
                        </div>
                    </Card>
                </div>

                {/* Timeline & Team */}
                <div className="space-y-6">
                    <Card className="overflow-hidden">
                        <div className="p-5 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-100">
                            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-3">
                                <div className="p-2 bg-blue-500 rounded-xl shadow-lg shadow-blue-200">
                                    <ClockIcon className="h-5 w-5 text-white" />
                                </div>
                                Production Timeline
                            </h3>
                        </div>
                        <div className="p-6 space-y-5">
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
                                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border-2 border-blue-200 p-5">
                                    <h4 className="text-sm font-bold text-blue-900 mb-3">Schedule Summary</h4>
                                    <div className="space-y-2 text-sm">
                                        {leadTimeMs !== undefined && (
                                            <div className="flex justify-between items-center p-3 bg-white rounded-lg">
                                                <span className="text-gray-600">Lead Time</span>
                                                <span className="font-bold text-blue-700">{Math.round(leadTimeMs / 36e5)} hours</span>
                                            </div>
                                        )}
                                        {scheduleSlackMs !== undefined && (
                                            <div className={`flex justify-between items-center p-3 rounded-lg ${scheduleSlackMs < 0 ? 'bg-amber-50' : 'bg-white'}`}>
                                                <span className="text-gray-600">Slack to Due Date</span>
                                                <span className={`font-bold ${scheduleSlackMs < 0 ? 'text-amber-700' : 'text-blue-700'}`}>
                                                    {Math.round(Math.abs(scheduleSlackMs) / 86400000)} days
                                                    {scheduleSlackMs < 0 && ' ⚠️'}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </Card>

                    <Card className="overflow-hidden">
                        <div className="p-5 bg-gradient-to-r from-emerald-50 to-green-50 border-b border-emerald-100">
                            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-3">
                                <div className="p-2 bg-emerald-500 rounded-xl shadow-lg shadow-emerald-200">
                                    <UserGroupIcon className="h-5 w-5 text-white" />
                                </div>
                                Team Assignment
                            </h3>
                        </div>
                        <div className="p-6 space-y-5">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Assign Team Members</label>
                                <select
                                    multiple
                                    value={formData.assignees}
                                    onChange={(e) => setFormData(prev => ({ ...prev, assignees: Array.from(e.target.selectedOptions, option => option.value) }))}
                                    className="block w-full rounded-xl border-2 border-gray-200 py-3 px-4 text-base focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 bg-white transition-all h-48"
                                >
                                    {resources.map(resource => (
                                        <option key={resource.id} value={resource.id}>
                                            {resource.name} - {resource.role || 'Team Member'}
                                        </option>
                                    ))}
                                </select>
                                <p className="text-sm text-gray-500 mt-2">
                                    Hold <kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded-lg text-xs font-mono">Ctrl</kbd> or
                                    <kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded-lg text-xs font-mono mx-1">Cmd</kbd>
                                    to select multiple
                                </p>
                            </div>

                            {formData.assignees.length > 0 && (
                                <div className="bg-gradient-to-br from-emerald-50 to-green-50 border-2 border-emerald-200 rounded-xl p-5">
                                    <h4 className="text-sm font-bold text-emerald-800 mb-3">Selected Team ({formData.assignees.length})</h4>
                                    <div className="space-y-2">
                                        {formData.assignees.map(assigneeId => {
                                            const resource = resources.find(r => r.id === assigneeId);
                                            return resource ? (
                                                <div key={assigneeId} className="flex items-center gap-3 p-3 bg-white rounded-lg">
                                                    <div className="w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                                                        {resource.name.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <span className="font-medium text-gray-900">{resource.name}</span>
                                                        <span className="text-sm text-gray-500 ml-2">({resource.role || 'Team Member'})</span>
                                                    </div>
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
