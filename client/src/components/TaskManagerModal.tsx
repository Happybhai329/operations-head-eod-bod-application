import React, { useState, useEffect } from 'react';
import {
  X,
  Plus,
  ListTodo,
  BarChart3,
  Search,
  Download,
  Calendar,
  User,
  Building2,
  Paperclip,
  CheckCircle2,
  Clock,
  AlertTriangle,
  RotateCw,
  Eye,
  Trash2,
  Edit,
  Share2,
  Check,
  Copy,
} from 'lucide-react';
import { TaskDashboardData, TaskItem, TaskDetailData } from '../types/admin';
import { fetchTaskDashboard, fetchTaskDetail, createTask, triggerInboundSync, deleteTask } from '../api/admin';
import { TaskDetailModal } from './TaskDetailModal';
import { EditTaskModal } from './EditTaskModal';
import { generateWhatsAppTaskMessage, copyTextToClipboard } from '../utils/whatsappFormatter';

interface TaskManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TaskManagerModal: React.FC<TaskManagerModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'assign' | 'list' | 'analytics'>('list');
  const [dashboardData, setDashboardData] = useState<TaskDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Filter state for All Tasks tab
  const [statusFilter, setStatusFilter] = useState('All');
  const [assigneeFilter, setAssigneeFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  // Assign Task Form State
  const [assigneeId, setAssigneeId] = useState('');
  const [assigneeName, setAssigneeName] = useState('');
  const [department, setDepartment] = useState('');
  const [priority, setPriority] = useState('Medium');
  const [deadline, setDeadline] = useState('');
  const [taskName, setTaskName] = useState('');
  const [instructions, setInstructions] = useState('');
  const [taskMode, setTaskMode] = useState('Checklist');
  const [subTasks, setSubTasks] = useState<Array<{ name: string; checklist: string[] }>>([
    { name: '', checklist: [''] },
  ]);
  const [attUrls, setAttUrls] = useState('');
  const [isSubmittingTask, setIsSubmittingTask] = useState(false);

  // Detail Modal
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [taskDetail, setTaskDetail] = useState<TaskDetailData | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);

  // Edit Task Modal
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [copiedTaskId, setCopiedTaskId] = useState<string | null>(null);

  const loadData = async (withSync = false) => {
    try {
      setIsLoading(true);
      if (withSync) {
        await triggerInboundSync().catch(() => {});
      }
      const res = await fetchTaskDashboard();
      if (res.success) {
        setDashboardData(res.data);
      }
    } catch (err) {
      console.error('Failed to load tasks:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadData(true);
    }
  }, [isOpen]);

  const handleAssigneeChange = (empId: string) => {
    setAssigneeId(empId);
    const emp = dashboardData?.employees.find((e) => e.id === empId);
    if (emp) {
      setAssigneeName(emp.name);
      setDepartment(emp.dept);
    } else {
      setAssigneeName('');
      setDepartment('');
    }
  };

  const handleAddSubTask = () => {
    setSubTasks((prev) => [...prev, { name: '', checklist: [''] }]);
  };

  const handleRemoveSubTask = (subIdx: number) => {
    setSubTasks((prev) => prev.filter((_, idx) => idx !== subIdx));
  };

  const handleSubTaskNameChange = (subIdx: number, val: string) => {
    setSubTasks((prev) => {
      const copy = [...prev];
      copy[subIdx].name = val;
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

  const handleChecklistItemChange = (subIdx: number, itemIdx: number, val: string) => {
    setSubTasks((prev) => {
      const copy = [...prev];
      copy[subIdx].checklist[itemIdx] = val;
      return copy;
    });
  };

  const handleRemoveChecklistItem = (subIdx: number, itemIdx: number) => {
    setSubTasks((prev) => {
      const copy = [...prev];
      copy[subIdx].checklist = copy[subIdx].checklist.filter((_, idx) => idx !== itemIdx);
      return copy;
    });
  };

  const handleCreateTask = async () => {
    if (!assigneeId) {
      alert('Please select an employee to assign this task to.');
      return;
    }
    if (!deadline) {
      alert('Please select a deadline date and time.');
      return;
    }

    try {
      setIsSubmittingTask(true);
      const urlList = attUrls
        .split('\n')
        .map((u) => u.trim())
        .filter((u) => u.startsWith('http://') || u.startsWith('https://'))
        .map((u) => ({ name: 'Attachment Link', url: u, type: 'url' }));

      const res = await createTask({
        taskName: taskName.trim() || instructions.trim().substring(0, 40) || 'Assigned Task',
        instructions: instructions.trim(),
        assignTo: assigneeId,
        assignToName: assigneeName,
        dept: department,
        priority,
        deadline,
        mode: taskMode,
        assignedBy: 'Branch Head',
        subTasks: subTasks
          .filter((st) => st.name.trim() !== '' || st.checklist.some((c) => c.trim() !== ''))
          .map((st) => ({
            name: st.name.trim() || 'General Tasks',
            checklist: st.checklist.map((c) => c.trim()).filter((c) => c !== ''),
          })),
        attachments: urlList,
      });

      if (res.success) {
        alert('Task assigned successfully!');
        // Reset form
        setTaskName('');
        setInstructions('');
        setAttUrls('');
        setSubTasks([{ name: '', checklist: [''] }]);
        setActiveTab('list');
        await loadData(false);
      }
    } catch (err: any) {
      alert('Failed to create task: ' + err.message);
    } finally {
      setIsSubmittingTask(false);
    }
  };

  const handleOpenDetail = async (taskId: string) => {
    try {
      setSelectedTaskId(taskId);
      setIsDetailLoading(true);
      const res = await fetchTaskDetail(taskId);
      if (res.success) {
        setTaskDetail(res.data);
      }
    } catch (err) {
      console.error('Failed to load task detail:', err);
    } finally {
      setIsDetailLoading(false);
    }
  };

  const handleOpenEdit = (taskId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditingTaskId(taskId);
    setIsEditModalOpen(true);
  };

  const handleDeleteTaskDirect = async (t: TaskItem, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const ok = window.confirm(
      `⚠️ Delete task "${t.taskId}: ${t.taskName}"?\n\nThis will remove the task, all sub-tasks, checklist items, and remarks. This action cannot be undone.`
    );
    if (!ok) return;

    try {
      setIsLoading(true);
      const res = await deleteTask(t.taskId);
      if (res.success) {
        await loadData(false);
      }
    } catch (err: any) {
      alert('Failed to delete task: ' + (err.message || 'Unknown error'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyWhatsApp = async (t: TaskItem, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      let fullTask: TaskDetailData | null = null;
      try {
        const res = await fetchTaskDetail(t.taskId);
        if (res.success && res.data) {
          fullTask = res.data;
        }
      } catch (_) {}

      const msg = generateWhatsAppTaskMessage(fullTask || t, fullTask);
      const success = await copyTextToClipboard(msg);
      if (success) {
        setCopiedTaskId(t.taskId);
        setTimeout(() => setCopiedTaskId(null), 2500);
      } else {
        alert('Could not copy automatically. Please copy the text manually.');
      }
    } catch (err) {
      console.error('Error copying WhatsApp message:', err);
    }
  };

  const handleExportCSV = () => {
    if (!dashboardData || dashboardData.tasks.length === 0) return;
    const headers = ['Task ID', 'Task Name', 'Assignee ID', 'Assignee Name', 'Department', 'Priority', 'Deadline', 'Status', 'Progress %', 'Created At'];
    const rows = dashboardData.tasks.map((t) => [
      `"${t.taskId}"`,
      `"${t.taskName.replace(/"/g, '""')}"`,
      `"${t.assignToId}"`,
      `"${t.assignToName.replace(/"/g, '""')}"`,
      `"${t.department.replace(/"/g, '""')}"`,
      `"${t.priority}"`,
      `"${t.deadline || ''}"`,
      `"${t.status}"`,
      t.progress,
      `"${t.createdAt}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Task_List_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!isOpen) return null;

  const filteredTasks = (dashboardData?.tasks || []).filter((t) => {
    if (statusFilter !== 'All') {
      if (statusFilter === 'Overdue') {
        if (!t.overDue) return false;
      } else if (t.derivedStatus !== statusFilter && t.status !== statusFilter) {
        return false;
      }
    }
    if (assigneeFilter !== 'All' && t.assignToId !== assigneeFilter) {
      return false;
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        t.taskName.toLowerCase().includes(q) ||
        t.taskId.toLowerCase().includes(q) ||
        t.assignToName.toLowerCase().includes(q) ||
        t.department.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <>
      <div className="fixed inset-0 z-40 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
        <div className="bg-[#F4F7F6] rounded-2xl shadow-2xl border border-slate-200 w-full max-w-7xl max-h-[94vh] flex flex-col overflow-hidden">
          {/* Header */}
          <div className="bg-[#041C32] text-white px-6 py-4 flex items-center justify-between border-b border-slate-700">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-[#F5D042] text-[#041C32] rounded-lg">
                <ListTodo className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-base sm:text-xl text-white">
                  📝 Task <span className="text-[#F5D042]">Manager & Checklists</span>
                </h3>
                <p className="text-xs text-slate-300">
                  Assign, track, and scrutinize branch tasks across departments
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => loadData(true)}
                disabled={isLoading}
                title="Sync Live with Google Sheets & Supabase"
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-[#041C32] bg-[#F5D042] hover:bg-yellow-400 transition-colors shadow-sm disabled:opacity-50"
              >
                <RotateCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                <span>Sync Live</span>
              </button>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="bg-white px-6 border-b border-slate-200 flex items-center space-x-4">
            <button
              onClick={() => setActiveTab('list')}
              className={`py-3.5 px-2 text-xs sm:text-sm font-bold border-b-2 flex items-center space-x-1.5 transition-all ${
                activeTab === 'list'
                  ? 'border-[#041C32] text-[#041C32]'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <ListTodo className="w-4 h-4" />
              <span>📋 All Tasks ({dashboardData?.tasks.length || 0})</span>
            </button>
            <button
              onClick={() => setActiveTab('assign')}
              className={`py-3.5 px-2 text-xs sm:text-sm font-bold border-b-2 flex items-center space-x-1.5 transition-all ${
                activeTab === 'assign'
                  ? 'border-[#041C32] text-[#041C32]'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Plus className="w-4 h-4" />
              <span>＋ Assign New Task</span>
            </button>
            <button
              onClick={() => setActiveTab('analytics')}
              className={`py-3.5 px-2 text-xs sm:text-sm font-bold border-b-2 flex items-center space-x-1.5 transition-all ${
                activeTab === 'analytics'
                  ? 'border-[#041C32] text-[#041C32]'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span>📊 Analytics & Performance</span>
            </button>
          </div>

          {/* Tab Content */}
          <div className="p-6 overflow-y-auto flex-1 space-y-6">
            {isLoading && !dashboardData ? (
              <div className="text-center py-20 space-y-3">
                <div className="w-8 h-8 border-4 border-[#041C32] border-t-[#F5D042] rounded-full animate-spin mx-auto"></div>
                <div className="text-slate-500 font-semibold text-sm">Loading task workspace...</div>
              </div>
            ) : (
              <>
                {/* ─── TAB: ALL TASKS ────────────────────────────────────────── */}
                {activeTab === 'list' && (
                  <div className="space-y-4">
                    {/* Filter Bar */}
                    <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        {/* Status Filter */}
                        <select
                          value={statusFilter}
                          onChange={(e) => setStatusFilter(e.target.value)}
                          className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-700 font-semibold focus:outline-none"
                        >
                          <option value="All">All Status</option>
                          <option value="Open">Open</option>
                          <option value="In Progress">In Progress</option>
                          <option value="Overdue">Overdue</option>
                          <option value="Completed">Completed</option>
                          <option value="Cancelled">Cancelled</option>
                        </select>

                        {/* Assignee Filter */}
                        <select
                          value={assigneeFilter}
                          onChange={(e) => setAssigneeFilter(e.target.value)}
                          className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-700 font-semibold focus:outline-none"
                        >
                          <option value="All">All Assignees</option>
                          {(dashboardData?.employees || []).map((e) => (
                            <option key={e.id} value={e.id}>
                              {e.name} ({e.id})
                            </option>
                          ))}
                        </select>

                        {/* Search Input */}
                        <div className="relative">
                          <input
                            type="text"
                            placeholder="Search tasks..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#041C32]"
                          />
                          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                        </div>
                      </div>

                      <button
                        onClick={handleExportCSV}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors flex items-center space-x-1"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Export CSV</span>
                      </button>
                    </div>

                    {/* Tasks Table */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                      <div className="overflow-x-auto max-h-[500px]">
                        <table className="w-full text-xs text-left">
                          <thead className="bg-[#041C32] text-white font-bold sticky top-0 z-10">
                            <tr>
                              <th className="p-3">Task ID</th>
                              <th className="p-3">Task Name</th>
                              <th className="p-3">Assignee</th>
                              <th className="p-3">Department</th>
                              <th className="p-3">Deadline</th>
                              <th className="p-3 text-center">Status</th>
                              <th className="p-3 text-center">Progress</th>
                              <th className="p-3 text-right">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {filteredTasks.length === 0 ? (
                              <tr>
                                <td colSpan={8} className="p-12 text-center text-slate-400 italic">
                                  No tasks found matching criteria.
                                </td>
                              </tr>
                            ) : (
                              filteredTasks.map((t) => (
                                <tr key={t.taskId} className="hover:bg-slate-50/80">
                                  <td className="p-3 font-mono font-bold text-slate-700">{t.taskId}</td>
                                  <td className="p-3 font-bold text-[#041C32]">{t.taskName}</td>
                                  <td className="p-3 text-slate-700">
                                    <div className="font-semibold">{t.assignToName}</div>
                                    <div className="text-[10px] text-slate-400 font-mono">{t.assignToId}</div>
                                  </td>
                                  <td className="p-3 text-slate-600">{t.department}</td>
                                  <td className="p-3 text-slate-600">
                                    {t.deadline ? new Date(t.deadline).toLocaleString() : '—'}
                                  </td>
                                  <td className="p-3 text-center">
                                    <span
                                      className={`px-2.5 py-1 rounded-full font-bold text-[10px] ${
                                        t.status === 'Completed'
                                          ? 'bg-emerald-100 text-emerald-800'
                                          : t.status === 'Cancelled'
                                          ? 'bg-slate-200 text-slate-700'
                                          : t.overDue
                                          ? 'bg-rose-100 text-rose-800'
                                          : t.progress > 0
                                          ? 'bg-indigo-100 text-indigo-800'
                                          : 'bg-amber-100 text-amber-800'
                                      }`}
                                    >
                                      {t.derivedStatus}
                                    </span>
                                  </td>
                                  <td className="p-3 text-center">
                                    <div className="flex items-center space-x-2">
                                      <div className="w-16 bg-slate-200 rounded-full h-2 overflow-hidden">
                                        <div
                                          className={`h-2 rounded-full ${
                                            t.progress === 100
                                              ? 'bg-emerald-500'
                                              : t.progress > 50
                                              ? 'bg-[#041C32]'
                                              : 'bg-[#F5D042]'
                                          }`}
                                          style={{ width: `${t.progress}%` }}
                                        ></div>
                                      </div>
                                      <span className="font-bold text-[11px] text-slate-600">{t.progress}%</span>
                                    </div>
                                  </td>
                                  <td className="p-3 text-right whitespace-nowrap">
                                    <div className="flex items-center justify-end space-x-1.5">
                                      {/* WhatsApp Copy */}
                                      <button
                                        onClick={(e) => handleCopyWhatsApp(t, e)}
                                        title="Copy formatted task message for WhatsApp"
                                        className={`px-2 py-1 rounded text-[11px] font-bold transition-all flex items-center space-x-1 border shadow-2xs ${
                                          copiedTaskId === t.taskId
                                            ? 'bg-emerald-600 text-white border-emerald-600'
                                            : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200'
                                        }`}
                                      >
                                        {copiedTaskId === t.taskId ? (
                                          <>
                                            <Check className="w-3 h-3 text-white" />
                                            <span>Copied!</span>
                                          </>
                                        ) : (
                                          <>
                                            <Share2 className="w-3 h-3 text-emerald-600" />
                                            <span>WhatsApp</span>
                                          </>
                                        )}
                                      </button>

                                      {/* View */}
                                      <button
                                        onClick={() => handleOpenDetail(t.taskId)}
                                        title="View Task Details"
                                        className="px-2 py-1 bg-slate-100 hover:bg-[#041C32] hover:text-[#F5D042] text-slate-700 font-bold rounded text-[11px] transition-colors flex items-center space-x-1 border border-slate-200 shadow-2xs"
                                      >
                                        <Eye className="w-3 h-3" />
                                        <span>View</span>
                                      </button>

                                      {/* Edit */}
                                      <button
                                        onClick={(e) => handleOpenEdit(t.taskId, e)}
                                        title="Edit Task"
                                        className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded text-[11px] transition-colors flex items-center space-x-1 border border-indigo-200 shadow-2xs"
                                      >
                                        <Edit className="w-3 h-3 text-indigo-600" />
                                        <span>Edit</span>
                                      </button>

                                      {/* Delete */}
                                      <button
                                        onClick={(e) => handleDeleteTaskDirect(t, e)}
                                        title="Delete Task"
                                        className="p-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded transition-colors border border-rose-200 shadow-2xs"
                                      >
                                        <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

                {/* ─── TAB: ASSIGN NEW TASK ─────────────────────────────────── */}
                {activeTab === 'assign' && (
                  <div className="max-w-4xl mx-auto space-y-4">
                    <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm space-y-4">
                      <h4 className="font-extrabold text-sm text-[#041C32] border-b border-slate-100 pb-2">
                        1. Task Basics & Assignee
                      </h4>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                        <div>
                          <label className="font-bold text-slate-700 block mb-1">👤 Assign To *</label>
                          <select
                            value={assigneeId}
                            onChange={(e) => handleAssigneeChange(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs focus:outline-none"
                          >
                            <option value="">— Select Employee —</option>
                            {(dashboardData?.employees || []).map((e) => (
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
                            readOnly
                            placeholder="Auto-filled"
                            className="w-full bg-slate-100 border border-slate-200 rounded-lg p-2 text-xs text-slate-500 font-semibold"
                          />
                        </div>

                        <div>
                          <label className="font-bold text-slate-700 block mb-1">⚡ Priority</label>
                          <select
                            value={priority}
                            onChange={(e) => setPriority(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs focus:outline-none"
                          >
                            <option value="High">High</option>
                            <option value="Medium">Medium</option>
                            <option value="Low">Low</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        <div>
                          <label className="font-bold text-slate-700 block mb-1">⏰ Deadline (Date & Time) *</label>
                          <input
                            type="datetime-local"
                            value={deadline}
                            onChange={(e) => setDeadline(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs focus:outline-none"
                          />
                        </div>

                        <div>
                          <label className="font-bold text-slate-700 block mb-1">📝 Task Name</label>
                          <input
                            type="text"
                            placeholder="e.g. Prepare Question Papers or Database Update"
                            value={taskName}
                            onChange={(e) => setTaskName(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs focus:outline-none"
                          />
                        </div>
                      </div>

                      <div className="text-xs space-y-1">
                        <label className="font-bold text-slate-700 block">📋 Instructions / Description</label>
                        <textarea
                          rows={3}
                          placeholder="Provide detailed instructions..."
                          value={instructions}
                          onChange={(e) => setInstructions(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-700 focus:outline-none"
                        ></textarea>
                      </div>

                      <div className="text-xs space-y-1">
                        <label className="font-bold text-slate-700 block">📎 Attachment URLs (one per line)</label>
                        <textarea
                          rows={2}
                          placeholder="https://drive.google.com/..."
                          value={attUrls}
                          onChange={(e) => setAttUrls(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs text-slate-700 focus:outline-none font-mono"
                        ></textarea>
                      </div>
                    </div>

                    {/* Sub-tasks & Checklist */}
                    <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm space-y-4">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                        <h4 className="font-extrabold text-sm text-[#041C32]">
                          2. Sub-Tasks & Checklists
                        </h4>

                        <div className="flex items-center space-x-4 text-xs font-semibold text-slate-700">
                          <label className="flex items-center space-x-1.5 cursor-pointer">
                            <input
                              type="radio"
                              name="taskMode"
                              value="Checklist"
                              checked={taskMode === 'Checklist'}
                              onChange={() => setTaskMode('Checklist')}
                            />
                            <span>Checklist mode</span>
                          </label>
                          <label className="flex items-center space-x-1.5 cursor-pointer">
                            <input
                              type="radio"
                              name="taskMode"
                              value="Open"
                              checked={taskMode === 'Open'}
                              onChange={() => setTaskMode('Open')}
                            />
                            <span>Open mode</span>
                          </label>
                        </div>
                      </div>

                      {subTasks.map((sub, sIdx) => (
                        <div key={sIdx} className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                          <div className="flex items-center justify-between gap-2">
                            <input
                              type="text"
                              placeholder={`Subtask #${sIdx + 1} Name`}
                              value={sub.name}
                              onChange={(e) => handleSubTaskNameChange(sIdx, e.target.value)}
                              className="flex-1 bg-white border border-slate-200 rounded-lg p-2 text-xs font-bold text-slate-800"
                            />
                            {subTasks.length > 1 && (
                              <button
                                onClick={() => handleRemoveSubTask(sIdx)}
                                className="p-1.5 text-rose-500 hover:bg-rose-50 rounded"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>

                          {/* Checklist items */}
                          <div className="space-y-1.5 pl-3 border-l-2 border-slate-200">
                            {sub.checklist.map((item, iIdx) => (
                              <div key={iIdx} className="flex items-center space-x-2">
                                <span className="text-[10px] text-slate-400 font-mono">•</span>
                                <input
                                  type="text"
                                  placeholder={`Checklist Item #${iIdx + 1}`}
                                  value={item}
                                  onChange={(e) => handleChecklistItemChange(sIdx, iIdx, e.target.value)}
                                  className="flex-1 bg-white border border-slate-200 rounded p-1.5 text-xs text-slate-700"
                                />
                                {sub.checklist.length > 1 && (
                                  <button
                                    onClick={() => handleRemoveChecklistItem(sIdx, iIdx)}
                                    className="text-slate-300 hover:text-rose-500 text-xs"
                                  >
                                    ✕
                                  </button>
                                )}
                              </div>
                            ))}
                            <button
                              onClick={() => handleAddChecklistItem(sIdx)}
                              className="text-xs font-bold text-indigo-600 hover:text-indigo-800 pt-1 flex items-center space-x-1"
                            >
                              <Plus className="w-3 h-3" />
                              <span>Add item</span>
                            </button>
                          </div>
                        </div>
                      ))}

                      <button
                        onClick={handleAddSubTask}
                        className="px-3 py-1.5 border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 text-xs font-bold rounded-lg transition-colors flex items-center space-x-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>＋ Add Sub-Task</span>
                      </button>
                    </div>

                    <button
                      onClick={handleCreateTask}
                      disabled={isSubmittingTask}
                      className="w-full py-3 bg-[#F5D042] hover:bg-yellow-400 text-[#041C32] font-extrabold text-sm rounded-xl shadow transition-all disabled:opacity-50"
                    >
                      {isSubmittingTask ? 'Assigning Task...' : '✅ Assign Task (Save to DB & Sheets)'}
                    </button>
                  </div>
                )}

                {/* ─── TAB: ANALYTICS ───────────────────────────────────────── */}
                {activeTab === 'analytics' && dashboardData && (
                  <div className="space-y-6">
                    {/* Summary Cards */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                      <div className="bg-white rounded-xl p-3 border border-slate-200 shadow-sm text-center">
                        <div className="text-[11px] font-bold text-slate-400 uppercase">Total Tasks</div>
                        <div className="text-xl font-extrabold text-[#041C32]">{dashboardData.summary.total}</div>
                      </div>
                      <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-200 shadow-sm text-center">
                        <div className="text-[11px] font-bold text-emerald-800 uppercase">Completed</div>
                        <div className="text-xl font-extrabold text-emerald-700">{dashboardData.summary.completed}</div>
                      </div>
                      <div className="bg-blue-50 rounded-xl p-3 border border-blue-200 shadow-sm text-center">
                        <div className="text-[11px] font-bold text-blue-800 uppercase">In Progress</div>
                        <div className="text-xl font-extrabold text-blue-700">{dashboardData.summary.inProgress}</div>
                      </div>
                      <div className="bg-amber-50 rounded-xl p-3 border border-amber-200 shadow-sm text-center">
                        <div className="text-[11px] font-bold text-amber-800 uppercase">Open</div>
                        <div className="text-xl font-extrabold text-amber-700">{dashboardData.summary.open}</div>
                      </div>
                      <div className="bg-rose-50 rounded-xl p-3 border border-rose-200 shadow-sm text-center">
                        <div className="text-[11px] font-bold text-rose-800 uppercase">Overdue</div>
                        <div className="text-xl font-extrabold text-rose-700">{dashboardData.summary.overdue}</div>
                      </div>
                      <div className="bg-white rounded-xl p-3 border border-slate-200 shadow-sm text-center">
                        <div className="text-[11px] font-bold text-slate-400 uppercase">On-Time</div>
                        <div className="text-xl font-extrabold text-emerald-600">{dashboardData.summary.onTime}</div>
                      </div>
                      <div className="bg-white rounded-xl p-3 border border-slate-200 shadow-sm text-center">
                        <div className="text-[11px] font-bold text-slate-400 uppercase">Late Done</div>
                        <div className="text-xl font-extrabold text-amber-600">{dashboardData.summary.lateCompleted}</div>
                      </div>
                    </div>

                    {/* Assignee-wise Performance Table */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                      <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
                        <h4 className="font-extrabold text-xs text-[#041C32]">
                          👥 Assignee-wise Task Completion Metrics
                        </h4>
                      </div>
                      <div className="overflow-x-auto max-h-60">
                        <table className="w-full text-xs text-left">
                          <thead className="bg-slate-100/75 text-slate-600 font-bold sticky top-0">
                            <tr>
                              <th className="p-2.5">Assignee</th>
                              <th className="p-2.5">Department</th>
                              <th className="p-2.5 text-center">Total</th>
                              <th className="p-2.5 text-center text-emerald-700">Completed</th>
                              <th className="p-2.5 text-center text-blue-700">In Progress</th>
                              <th className="p-2.5 text-center text-amber-700">Open</th>
                              <th className="p-2.5 text-center text-rose-700">Overdue</th>
                              <th className="p-2.5 text-center">Late</th>
                              <th className="p-2.5 text-center text-emerald-600">On-Time</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {dashboardData.assigneeSummary.map((a) => (
                              <tr key={a.name} className="hover:bg-slate-50/80">
                                <td className="p-2.5 font-bold text-slate-800">{a.name}</td>
                                <td className="p-2.5 text-slate-600">{a.dept}</td>
                                <td className="p-2.5 text-center font-bold text-slate-700">{a.total}</td>
                                <td className="p-2.5 text-center font-bold text-emerald-700">{a.completed}</td>
                                <td className="p-2.5 text-center text-blue-700">{a.inProgress}</td>
                                <td className="p-2.5 text-center text-amber-700">{a.open}</td>
                                <td className="p-2.5 text-center text-rose-700">{a.overdue}</td>
                                <td className="p-2.5 text-center text-slate-400">{a.late}</td>
                                <td className="p-2.5 text-center font-bold text-emerald-600">{a.onTime}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Department-wise Table */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                      <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
                        <h4 className="font-extrabold text-xs text-[#041C32]">
                          🏢 Department-wise Task Analytics
                        </h4>
                      </div>
                      <div className="overflow-x-auto max-h-60">
                        <table className="w-full text-xs text-left">
                          <thead className="bg-slate-100/75 text-slate-600 font-bold sticky top-0">
                            <tr>
                              <th className="p-2.5">Department</th>
                              <th className="p-2.5 text-center">Total Tasks</th>
                              <th className="p-2.5 text-center text-emerald-700">Completed</th>
                              <th className="p-2.5 text-center text-rose-700">Overdue</th>
                              <th className="p-2.5 text-center text-blue-700">Active Tasks</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {dashboardData.deptSummary.map((d) => (
                              <tr key={d.dept} className="hover:bg-slate-50/80">
                                <td className="p-2.5 font-bold text-slate-800">{d.dept}</td>
                                <td className="p-2.5 text-center font-bold text-slate-700">{d.total}</td>
                                <td className="p-2.5 text-center font-bold text-emerald-700">{d.completed}</td>
                                <td className="p-2.5 text-center text-rose-700">{d.overdue}</td>
                                <td className="p-2.5 text-center font-bold text-blue-700">{d.active}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          <div className="bg-white px-6 py-3 border-t border-slate-200 flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium">
              Tasks synchronized bidirectionally with Google Sheets & Supabase
            </span>
            <button
              onClick={onClose}
              className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-lg transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {/* Task Detail Modal */}
      <TaskDetailModal
        isOpen={!!selectedTaskId}
        onClose={() => {
          setSelectedTaskId(null);
          setTaskDetail(null);
        }}
        task={taskDetail}
        onTaskUpdated={() => {
          loadData(false);
          if (selectedTaskId) handleOpenDetail(selectedTaskId);
        }}
        onOpenEdit={(taskId) => {
          handleOpenEdit(taskId);
        }}
        onTaskDeleted={() => {
          setSelectedTaskId(null);
          setTaskDetail(null);
          loadData(false);
        }}
        isLoading={isDetailLoading}
      />

      {/* Edit Task Modal */}
      <EditTaskModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingTaskId(null);
        }}
        taskId={editingTaskId}
        employees={dashboardData?.employees || []}
        onTaskUpdated={() => {
          loadData(false);
          if (selectedTaskId && selectedTaskId === editingTaskId) {
            handleOpenDetail(selectedTaskId);
          }
        }}
        onTaskDeleted={() => {
          loadData(false);
          if (selectedTaskId && selectedTaskId === editingTaskId) {
            setSelectedTaskId(null);
            setTaskDetail(null);
          }
        }}
      />
    </>
  );
};
