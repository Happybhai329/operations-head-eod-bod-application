import React, { useState, useEffect } from 'react';
import {
  X,
  Save,
  Trash2,
  Plus,
  Paperclip,
  CheckCircle2,
  Clock,
  User,
  Building2,
  AlertTriangle,
  RotateCw,
  Copy,
  Check,
  Share2,
} from 'lucide-react';
import { TaskDetailData } from '../types/admin';
import { fetchTaskDetail, updateTask, deleteTask } from '../api/admin';
import { generateWhatsAppTaskMessage, copyTextToClipboard } from '../utils/whatsappFormatter';

interface EditTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  taskId: string | null;
  employees: Array<{ id: string; name: string; dept: string }>;
  onTaskUpdated: () => void;
  onTaskDeleted?: () => void;
}

export const EditTaskModal: React.FC<EditTaskModalProps> = ({
  isOpen,
  onClose,
  taskId,
  employees,
  onTaskUpdated,
  onTaskDeleted,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [copiedWhatsApp, setCopiedWhatsApp] = useState(false);

  // Form fields
  const [taskName, setTaskName] = useState('');
  const [instructions, setInstructions] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [assigneeName, setAssigneeName] = useState('');
  const [department, setDepartment] = useState('');
  const [priority, setPriority] = useState('Medium');
  const [deadline, setDeadline] = useState('');
  const [taskMode, setTaskMode] = useState('Checklist');
  const [subTasks, setSubTasks] = useState<Array<{ name: string; checklist: string[] }>>([]);
  const [taskDetail, setTaskDetail] = useState<TaskDetailData | null>(null);

  // Format ISO or date string to YYYY-MM-DDTHH:mm for datetime-local input
  const formatDatetimeForInput = (dStr: string | null | undefined): string => {
    if (!dStr) return '';
    try {
      const d = new Date(dStr);
      if (isNaN(d.getTime())) return '';
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    } catch {
      return '';
    }
  };

  useEffect(() => {
    if (isOpen && taskId) {
      loadTaskData(taskId);
    }
  }, [isOpen, taskId]);

  const loadTaskData = async (id: string) => {
    try {
      setIsLoading(true);
      const res = await fetchTaskDetail(id);
      if (res.success && res.data) {
        const t = res.data;
        setTaskDetail(t);
        setTaskName(t.taskName || '');
        setInstructions(t.instructions || '');
        setAssigneeId(t.assignToId || '');
        setAssigneeName(t.assignToName || '');
        setDepartment(t.department || '');
        setPriority(t.priority || 'Medium');
        setDeadline(formatDatetimeForInput(t.deadline));
        setTaskMode(t.mode || 'Checklist');

        if (t.subTasks && t.subTasks.length > 0) {
          setSubTasks(
            t.subTasks.map((st: any) => ({
              name: st.name || '',
              checklist: st.items && st.items.length > 0 ? st.items.map((it: any) => it.text) : [''],
            }))
          );
        } else {
          setSubTasks([{ name: '', checklist: [''] }]);
        }
      }
    } catch (err: any) {
      alert('Failed to load task details: ' + (err.message || 'Unknown error'));
      onClose();
    } finally {
      setIsLoading(false);
    }
  };

  const handleAssigneeChange = (empId: string) => {
    setAssigneeId(empId);
    const emp = employees.find((e) => e.id === empId);
    if (emp) {
      setAssigneeName(emp.name);
      setDepartment(emp.dept);
    }
  };

  const handleAddSubTask = () => {
    setSubTasks((prev) => [...prev, { name: '', checklist: [''] }]);
  };

  const handleRemoveSubTask = (idx: number) => {
    setSubTasks((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubTaskNameChange = (idx: number, val: string) => {
    setSubTasks((prev) => {
      const copy = [...prev];
      copy[idx].name = val;
      return copy;
    });
  };

  const handleAddChecklistItem = (subIdx: number) => {
    setSubTasks((prev) => {
      const copy = [...prev];
      copy[subIdx].checklist.push('');
      return copy;
    });
  };

  const handleRemoveChecklistItem = (subIdx: number, itemIdx: number) => {
    setSubTasks((prev) => {
      const copy = [...prev];
      copy[subIdx].checklist = copy[subIdx].checklist.filter((_, i) => i !== itemIdx);
      return copy;
    });
  };

  const handleChecklistItemChange = (subIdx: number, itemIdx: number, val: string) => {
    setSubTasks((prev) => {
      const copy = [...prev];
      copy[subIdx].checklist[itemIdx] = val;
      return copy;
    });
  };

  const handleSaveChanges = async () => {
    if (!taskId) return;
    if (!taskName.trim()) {
      alert('Task name cannot be empty.');
      return;
    }
    if (!assigneeId) {
      alert('Please select an employee.');
      return;
    }

    try {
      setIsSaving(true);
      const cleanSubTasks = subTasks
        .filter((st) => st.name.trim() !== '' || st.checklist.some((c) => c.trim() !== ''))
        .map((st) => ({
          name: st.name.trim() || 'General Tasks',
          checklist: st.checklist.map((c) => c.trim()).filter((c) => c !== ''),
        }));

      const res = await updateTask(taskId, {
        taskName: taskName.trim(),
        instructions: instructions.trim(),
        assignTo: assigneeId,
        assignToName: assigneeName,
        dept: department,
        priority,
        deadline: deadline || null,
        mode: taskMode,
        subTasks: cleanSubTasks,
      });

      if (res.success) {
        alert('Task updated successfully!');
        onTaskUpdated();
        onClose();
      }
    } catch (err: any) {
      alert('Failed to update task: ' + (err.message || 'Unknown error'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteTask = async () => {
    if (!taskId) return;
    const confirmDelete = window.confirm(
      `⚠️ Are you sure you want to permanently delete task "${taskId}: ${taskName}"?\n\nThis will remove the task, all sub-tasks, checklist items, and remarks. This action cannot be undone.`
    );
    if (!confirmDelete) return;

    try {
      setIsDeleting(true);
      const res = await deleteTask(taskId);
      if (res.success) {
        alert(`Task ${taskId} was successfully deleted.`);
        if (onTaskDeleted) onTaskDeleted();
        else onTaskUpdated();
        onClose();
      }
    } catch (err: any) {
      alert('Failed to delete task: ' + (err.message || 'Unknown error'));
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCopyWhatsApp = async () => {
    if (!taskDetail) return;
    const currentFullTask: TaskDetailData = {
      ...taskDetail,
      taskName: taskName.trim() || taskDetail.taskName,
      instructions: instructions.trim(),
      assignToId: assigneeId,
      assignToName: assigneeName,
      department,
      priority,
      deadline,
      subTasks: subTasks.map((st, i) => ({
        sid: `sub_${i}`,
        name: st.name,
        orderNo: i + 1,
        status: 'Open',
        progress: 0,
        items: st.checklist.map((c, j) => ({
          itemId: `itm_${i}_${j}`,
          text: c,
          done: false,
          doneAt: '',
          doneBy: '',
        })),
      })),
    };

    const text = generateWhatsAppTaskMessage(currentFullTask, currentFullTask);
    const success = await copyTextToClipboard(text);
    if (success) {
      setCopiedWhatsApp(true);
      setTimeout(() => setCopiedWhatsApp(false), 2500);
    } else {
      alert('Could not copy automatically. Please copy the text manually.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/75 backdrop-blur-sm animate-fadeIn">
      <div className="bg-[#F4F7F6] rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="bg-[#041C32] text-white px-6 py-3.5 flex items-center justify-between border-b border-slate-700">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-[#F5D042] text-[#041C32] rounded-xl shadow-xs font-bold text-sm">
              ✏️
            </div>
            <div>
              <h3 className="font-extrabold text-base sm:text-lg text-white tracking-tight flex items-center gap-2">
                <span>Edit Task:</span>
                <span className="text-[#F5D042] font-mono">{taskId}</span>
              </h3>
              <p className="text-xs text-slate-300">
                Update task details, modify instructions, change assignee, or update subtasks & checklist
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleCopyWhatsApp}
              title="Copy formatted task message for WhatsApp"
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-xs ${
                copiedWhatsApp
                  ? 'bg-emerald-600 text-white'
                  : 'bg-emerald-500 hover:bg-emerald-600 text-white'
              }`}
            >
              {copiedWhatsApp ? <Check className="w-3.5 h-3.5" /> : <Share2 className="w-3.5 h-3.5" />}
              <span>{copiedWhatsApp ? 'Copied WhatsApp!' : 'Copy WhatsApp'}</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {isLoading ? (
            <div className="text-center py-20 space-y-3">
              <div className="w-8 h-8 border-4 border-[#041C32] border-t-[#F5D042] rounded-full animate-spin mx-auto"></div>
              <div className="text-slate-500 font-semibold text-sm">Loading task details...</div>
            </div>
          ) : (
            <>
              {/* Basics Card */}
              <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-2xs space-y-3">
                <div className="font-extrabold text-xs text-[#041C32] uppercase tracking-wider pb-1 border-b border-slate-100 flex items-center gap-1.5">
                  <User className="w-4 h-4 text-indigo-600" />
                  <span>1. Task Info & Assignee</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">👤 Assign To *</label>
                    <select
                      value={assigneeId}
                      onChange={(e) => handleAssigneeChange(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs focus:outline-none font-medium"
                    >
                      <option value="">— Select Employee —</option>
                      {employees.map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.name} ({e.id} - {e.dept})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">🏢 Department</label>
                    <input
                      type="text"
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      placeholder="Department Name"
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs text-slate-700 font-semibold"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">⚡ Priority</label>
                    <select
                      value={priority}
                      onChange={(e) => setPriority(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs focus:outline-none font-bold"
                    >
                      <option value="High">🔴 High Priority</option>
                      <option value="Medium">🟡 Medium Priority</option>
                      <option value="Low">🟢 Low Priority</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="sm:col-span-2">
                    <label className="font-bold text-slate-700 block mb-1">📝 Task Title *</label>
                    <input
                      type="text"
                      placeholder="e.g. Prepare Question Papers or Database Update"
                      value={taskName}
                      onChange={(e) => setTaskName(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs focus:outline-none font-semibold text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">⏰ Deadline (Date & Time)</label>
                    <input
                      type="datetime-local"
                      value={deadline}
                      onChange={(e) => setDeadline(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs focus:outline-none"
                    />
                  </div>
                </div>

                <div className="text-xs space-y-1">
                  <label className="font-bold text-slate-700 block">📋 Instructions & Description</label>
                  <textarea
                    rows={3}
                    placeholder="Enter detailed task instructions, expectations, and reference requirements..."
                    value={instructions}
                    onChange={(e) => setInstructions(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none resize-y"
                  />
                </div>
              </div>

              {/* Subtasks & Checklist Card */}
              <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-2xs space-y-3">
                <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                  <div className="font-extrabold text-xs text-[#041C32] uppercase tracking-wider flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>2. Sub-Tasks & Checklist Items</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => setTaskMode(taskMode === 'Checklist' ? 'Open' : 'Checklist')}
                      className={`text-[11px] font-bold px-2 py-0.5 rounded border transition-colors ${
                        taskMode === 'Checklist'
                          ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                          : 'bg-slate-50 border-slate-200 text-slate-600'
                      }`}
                    >
                      Mode: {taskMode}
                    </button>
                    <button
                      type="button"
                      onClick={handleAddSubTask}
                      className="text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2.5 py-1 rounded-lg transition-colors flex items-center space-x-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Sub-Task</span>
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  {subTasks.map((sub, sIdx) => (
                    <div
                      key={sIdx}
                      className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5 relative group"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex-1 flex items-center space-x-2">
                          <span className="text-xs font-extrabold text-indigo-700 bg-white px-2 py-0.5 rounded border border-slate-200">
                            #{sIdx + 1}
                          </span>
                          <input
                            type="text"
                            placeholder="Sub-task title (e.g. Chapter 1, Database Backup)"
                            value={sub.name}
                            onChange={(e) => handleSubTaskNameChange(sIdx, e.target.value)}
                            className="flex-1 bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-800 font-bold focus:outline-none"
                          />
                        </div>
                        {subTasks.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveSubTask(sIdx)}
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                            title="Delete Sub-Task"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      {/* Checklist items under this subtask */}
                      <div className="space-y-1.5 pl-6 border-l-2 border-indigo-200">
                        <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                          Checklist Items:
                        </div>
                        {sub.checklist.map((item, cIdx) => (
                          <div key={cIdx} className="flex items-center space-x-1.5">
                            <span className="text-slate-400 text-xs">▫</span>
                            <input
                              type="text"
                              placeholder={`Checklist item ${cIdx + 1}...`}
                              value={item}
                              onChange={(e) => handleChecklistItemChange(sIdx, cIdx, e.target.value)}
                              className="flex-1 bg-white border border-slate-200 rounded-md px-2 py-0.5 text-xs text-slate-700 focus:outline-none"
                            />
                            {sub.checklist.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveChecklistItem(sIdx, cIdx)}
                                className="p-0.5 text-slate-400 hover:text-rose-600 rounded"
                                title="Remove Item"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        ))}

                        <button
                          type="button"
                          onClick={() => handleAddChecklistItem(sIdx)}
                          className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center space-x-1 pt-0.5"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Add Item</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="bg-white px-6 py-3 border-t border-slate-200 flex items-center justify-between">
          <div>
            <button
              onClick={handleDeleteTask}
              disabled={isDeleting || isSaving || isLoading}
              className="px-3.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs rounded-lg transition-colors flex items-center space-x-1.5 disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-600" />
              <span>{isDeleting ? 'Deleting...' : 'Delete Task'}</span>
            </button>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={onClose}
              className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveChanges}
              disabled={isSaving || isDeleting || isLoading}
              className="px-5 py-1.5 bg-[#041C32] hover:bg-slate-800 text-[#F5D042] font-bold text-xs rounded-lg transition-all shadow-sm flex items-center space-x-1.5 disabled:opacity-50"
            >
              {isSaving ? <RotateCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              <span>{isSaving ? 'Saving Changes...' : 'Save Changes'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
