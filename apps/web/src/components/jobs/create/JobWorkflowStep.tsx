import React from 'react';
import { ClipboardDocumentListIcon, CalendarIcon, ClockIcon, UserGroupIcon, ExclamationTriangleIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import type { JobFormData, StageTransitionRule } from './types';
import { Card } from '../../ui/Card';


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

    const transitions: StageTransitionRule[] = (selectedWorkflow?.allowedTransitions || []).map((t: any) => ({
        fromStageId: t.fromStageId,
        toStageId: t.toStageId,
        requireOutputToAdvance: t.requireOutputToAdvance ?? formData.requireOutputToAdvance,
        minQtyToStartNextStage: t.minQtyToStartNextStage,
        unit: t.unit || 'sheet',
        allowPartial: t.allowPartial !== false,
        allowRework: false,
    }));

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
        <div className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Workflow Configuration */}
                <div className="space-y-3">
                    <Card className="overflow-hidden">
                        <div className="p-3 bg-gradient-to-r from-cyan-50 to-blue-50 border-b border-cyan-100">
                            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                                <div className="p-1.5 bg-cyan-500 rounded-lg shadow-sm shadow-cyan-200">
                                    <ClipboardDocumentListIcon className="h-4 w-4 text-white" />
                                </div>
                                Workflow Setup
                            </h3>
                        </div>
                        <div className="p-3 space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-700 mb-1">Production Workflow *</label>
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
                                        className="block w-full rounded-lg border-gray-200 py-1.5 px-3 text-sm focus:border-cyan-500 focus:ring-cyan-100 bg-white transition-all"
                                    >
                                        <option value="">Select a workflow...</option>
                                        {workflows.map(workflow => (
                                            <option key={workflow.id} value={workflow.id}>{workflow.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-700 mb-1">Workcenter</label>
                                    <select
                                        value={formData.workcenterId}
                                        onChange={(e) => setFormData(prev => ({ ...prev, workcenterId: e.target.value }))}
                                        className="block w-full rounded-lg border-gray-200 py-1.5 px-3 text-sm focus:border-cyan-500 focus:ring-cyan-100 bg-white transition-all"
                                    >
                                        <option value="">Any Workcenter</option>
                                        {workcenters.map(wc => (
                                            <option key={wc.id} value={wc.id}>{wc.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>
                    </Card>

                    <Card className="overflow-hidden">
                        <div className="p-3 bg-gradient-to-r from-purple-50 to-indigo-50 border-b border-purple-100">
                            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                                <div className="p-1.5 bg-purple-500 rounded-lg shadow-sm shadow-purple-200">
                                    <CalendarIcon className="h-4 w-4 text-white" />
                                </div>
                                Production Stages
                            </h3>
                        </div>
                        <div className="p-3 space-y-3">
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1">Start Stage *</label>
                                <select
                                    value={formData.currentStageId}
                                    onChange={(e) => setFormData(prev => ({ ...prev, currentStageId: e.target.value }))}
                                    className="block w-full rounded-lg border-gray-200 py-1.5 px-3 text-sm focus:border-purple-500 focus:ring-purple-100 bg-white transition-all"
                                >
                                    <option value="">Select starting stage...</option>
                                    {(selectedWorkflow?.stages || []).map((s: any) => (
                                        <option key={s.id} value={s.id}>{s.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1">Included Stages *</label>
                                <div className="bg-gray-50 border border-gray-200 rounded-lg p-2 max-h-48 overflow-y-auto">
                                    <div className="grid grid-cols-2 gap-2">
                                        {(selectedWorkflow?.stages || []).map((s: any) => {
                                            const checked = (formData.plannedStageIds || []).includes(s.id);
                                            return (
                                                <label key={s.id} className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-all ${checked ? 'bg-purple-100 border border-purple-300' : 'bg-white border border-gray-100 hover:border-gray-200'}`}>
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
                                                        className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                                                    />
                                                    <span className={`text-xs font-medium ${checked ? 'text-purple-900' : 'text-gray-700'}`}>{s.name}</span>
                                                    {checked && <CheckCircleIcon className="h-4 w-4 text-purple-500 ml-auto" />}
                                                </label>
                                            );
                                        })}
                                    </div>
                                </div>
                                {(formData.plannedStageIds || []).length === 0 && (
                                    <p className="text-red-500 text-xs mt-2 flex items-center gap-1 bg-red-50 p-2 rounded-lg">
                                        <ExclamationTriangleIcon className="h-4 w-4" />
                                        Select at least one production stage
                                    </p>
                                )}
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1">Stage Transition Rules</label>
                                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                                    <div className="hidden md:grid grid-cols-5 gap-2 px-3 py-1.5 bg-gray-50 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                                        <span>From → To</span>
                                        <span>Req Output</span>
                                        <span>Min Qty</span>
                                        <span>Unit</span>
                                        <span>Partial</span>
                                    </div>
                                    <div className="divide-y divide-gray-100">
                                        {transitions.length === 0 && (
                                            <div className="px-3 py-2 text-xs text-gray-500">
                                                No transitions configured.
                                            </div>
                                        )}
                                        {transitions.map((rule) => {
                                            const stages: any[] = selectedWorkflow?.stages || [];
                                            const fromStage = stages.find(s => s.id === rule.fromStageId);
                                            const toStage = stages.find(s => s.id === rule.toStageId);
                                            const label = fromStage && toStage
                                                ? `${fromStage.name} → ${toStage.name}`
                                                : `${rule.fromStageId} → ${rule.toStageId}`;

                                            return (
                                                <div
                                                    key={`${rule.fromStageId}-${rule.toStageId}`}
                                                    className="px-3 py-1.5 flex flex-col md:grid md:grid-cols-5 md:items-center gap-2 text-xs"
                                                >
                                                    <div className="font-medium text-gray-900 truncate" title={label}>
                                                        {label}
                                                    </div>
                                                    <div className="text-gray-700">
                                                        {rule.requireOutputToAdvance ? 'Yes' : 'No'}
                                                    </div>
                                                    <div className="text-gray-700">
                                                        {rule.minQtyToStartNextStage ?? '-'}
                                                    </div>
                                                    <div className="text-gray-700">
                                                        {rule.unit}
                                                    </div>
                                                    <div className="text-gray-700">
                                                        {rule.allowPartial ? 'Yes' : 'No'}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </Card>
                </div>

                {/* Timeline & Team */}
                <div className="space-y-3">
                    <Card className="overflow-hidden">
                        <div className="p-3 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-100">
                            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                                <div className="p-1.5 bg-blue-500 rounded-lg shadow-sm shadow-blue-200">
                                    <ClockIcon className="h-4 w-4 text-white" />
                                </div>
                                Production Timeline
                            </h3>
                        </div>
                        <div className="p-3 space-y-3">
                            <div className="grid grid-cols-3 gap-3">
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">Planned Start</label>
                                    <input
                                        type="datetime-local"
                                        value={formData.plannedStart}
                                        onChange={(e) => {
                                            const startDate = e.target.value;
                                            if (startDate) {
                                                // Calculate end date: 2 weeks after start date
                                                const start = new Date(startDate);
                                                const end = new Date(start);
                                                end.setDate(end.getDate() + 14); // Add 2 weeks (14 days)
                                                
                                                // Calculate due date: 1 day after end date
                                                const due = new Date(end);
                                                due.setDate(due.getDate() + 1); // Add 1 day
                                                
                                                // Format dates for datetime-local input (YYYY-MM-DDTHH:mm)
                                                const formatDateTimeLocal = (date: Date) => {
                                                    const year = date.getFullYear();
                                                    const month = String(date.getMonth() + 1).padStart(2, '0');
                                                    const day = String(date.getDate()).padStart(2, '0');
                                                    const hours = String(date.getHours()).padStart(2, '0');
                                                    const minutes = String(date.getMinutes()).padStart(2, '0');
                                                    return `${year}-${month}-${day}T${hours}:${minutes}`;
                                                };
                                                
                                                setFormData(prev => ({
                                                    ...prev,
                                                    plannedStart: startDate,
                                                    plannedEnd: formatDateTimeLocal(end),
                                                    dueDate: formatDateTimeLocal(due)
                                                }));
                                            } else {
                                                setFormData(prev => ({ ...prev, plannedStart: startDate }));
                                            }
                                        }}
                                        className="block w-full rounded-lg border-gray-200 py-1.5 px-2 text-xs focus:border-blue-500 focus:ring-blue-100"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">Planned End</label>
                                    <input
                                        type="datetime-local"
                                        value={formData.plannedEnd}
                                        onChange={(e) => {
                                            const endDate = e.target.value;
                                            if (endDate) {
                                                // Calculate due date: 1 day after end date
                                                const end = new Date(endDate);
                                                const due = new Date(end);
                                                due.setDate(due.getDate() + 1); // Add 1 day
                                                
                                                // Format date for datetime-local input
                                                const formatDateTimeLocal = (date: Date) => {
                                                    const year = date.getFullYear();
                                                    const month = String(date.getMonth() + 1).padStart(2, '0');
                                                    const day = String(date.getDate()).padStart(2, '0');
                                                    const hours = String(date.getHours()).padStart(2, '0');
                                                    const minutes = String(date.getMinutes()).padStart(2, '0');
                                                    return `${year}-${month}-${day}T${hours}:${minutes}`;
                                                };
                                                
                                                setFormData(prev => ({
                                                    ...prev,
                                                    plannedEnd: endDate,
                                                    dueDate: formatDateTimeLocal(due)
                                                }));
                                            } else {
                                                setFormData(prev => ({ ...prev, plannedEnd: endDate }));
                                            }
                                        }}
                                        className="block w-full rounded-lg border-gray-200 py-1.5 px-2 text-xs focus:border-blue-500 focus:ring-blue-100"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">Due Date</label>
                                    <input
                                        type="datetime-local"
                                        value={formData.dueDate}
                                        onChange={(e) => setFormData(prev => ({ ...prev, dueDate: e.target.value }))}
                                        className="block w-full rounded-lg border-gray-200 py-1.5 px-2 text-xs focus:border-blue-500 focus:ring-blue-100"
                                    />
                                </div>
                            </div>

                            {(leadTimeMs !== undefined || scheduleSlackMs !== undefined) && (
                                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border border-blue-200 p-3">
                                    <h4 className="text-xs font-bold text-blue-900 mb-2">Schedule Summary</h4>
                                    <div className="grid grid-cols-2 gap-3 text-xs">
                                        {leadTimeMs !== undefined && (
                                            <div className="flex justify-between items-center p-2 bg-white rounded shadow-sm">
                                                <span className="text-gray-600">Lead Time</span>
                                                <span className="font-bold text-blue-700">{Math.round(leadTimeMs / 36e5)} hrs</span>
                                            </div>
                                        )}
                                        {scheduleSlackMs !== undefined && (
                                            <div className={`flex justify-between items-center p-2 rounded shadow-sm ${scheduleSlackMs < 0 ? 'bg-amber-50' : 'bg-white'}`}>
                                                <span className="text-gray-600">Slack</span>
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
                        <div className="p-3 bg-gradient-to-r from-emerald-50 to-green-50 border-b border-emerald-100">
                            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                                <div className="p-1.5 bg-emerald-500 rounded-lg shadow-sm shadow-emerald-200">
                                    <UserGroupIcon className="h-4 w-4 text-white" />
                                </div>
                                Team Assignment
                            </h3>
                        </div>
                        <div className="p-3 space-y-3">
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1">Assign Team Members</label>
                                <select
                                    multiple
                                    value={formData.assignees}
                                    onChange={(e) => setFormData(prev => ({ ...prev, assignees: Array.from(e.target.selectedOptions, option => option.value) }))}
                                    className="block w-full rounded-lg border-gray-200 py-1.5 px-3 text-xs focus:border-emerald-500 focus:ring-emerald-100 bg-white transition-all h-24"
                                >
                                    {resources.map(resource => (
                                        <option key={resource.id} value={resource.id}>
                                            {resource.name} - {resource.role || 'Team Member'}
                                        </option>
                                    ))}
                                </select>
                                <p className="text-[10px] text-gray-500 mt-1">
                                    Hold Ctrl/Cmd to select multiple
                                </p>
                            </div>

                            {formData.assignees.length > 0 && (
                                <div className="bg-gradient-to-br from-emerald-50 to-green-50 border border-emerald-200 rounded-lg p-3">
                                    <h4 className="text-xs font-bold text-emerald-800 mb-2">Selected Team ({formData.assignees.length})</h4>
                                    <div className="flex flex-wrap gap-2">
                                        {formData.assignees.map(assigneeId => {
                                            const resource = resources.find(r => r.id === assigneeId);
                                            return resource ? (
                                                <div key={assigneeId} className="flex items-center gap-2 p-1.5 bg-white rounded border border-emerald-100 shadow-sm">
                                                    <div className="w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center text-white font-bold text-[10px]">
                                                        {resource.name.charAt(0)}
                                                    </div>
                                                    <span className="text-xs font-medium text-gray-900">{resource.name}</span>
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
