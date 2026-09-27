import React, { useState } from 'react';
import {
  X,
  CheckSquare,
  Square,
  Plus,
  Paperclip,
  MessageSquare,
  CheckCircle2,
  XCircle,
  Clock,
  User,
  Building2,
  Star,
  Send,
  Trash2,
  Edit,
  Share2,
  Check,
  Copy,
} from 'lucide-react';
import { TaskDetailData } from '../types/admin';
import {
  toggleChecklistItem,
  addChecklistItem,
  addTaskRemark,
  updateTaskStatus,
  deleteTask,
} from '../api/admin';
import { generateWhatsAppTaskMessage, copyTextToClipboard } from '../utils/whatsappFormatter';

interface TaskDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: TaskDetailData | null;
  onTaskUpdated: () => void;
  onOpenEdit?: (taskId: string) => void;
  onTaskDeleted?: () => void;
  isLoading: boolean;
}

export const TaskDetailModal: React.FC<TaskDetailModalProps> = ({
  isOpen,
  onClose,
  task,
  onTaskUpdated,
  onOpenEdit,
  onTaskDeleted,
  isLoading,
}) => {
  const [newRemark, setNewRemark] = useState('');
  const [newItemTexts, setNewItemTexts] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedWhatsApp, setCopiedWhatsApp] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Complete / Cancel state
  const [completionRating, setCompletionRating] = useState('100');
  const [completionRemark, setCompletionRemark] = useState('');

  if (!isOpen) return null;

  const handleToggle = async (itemId: string, currentDone: boolean) => {
    try {
      await toggleChecklistItem(itemId, !currentDone, 'Branch Head');
      onTaskUpdated();
    } catch (err) {
      console.error('Failed to toggle checklist:', err);
    }
  };

  const handleAddItem = async (subTaskId: string) => {
    const text = newItemTexts[subTaskId];
    if (!text || !text.trim() || !task) return;
    try {
      await addChecklistItem(task.taskId, subTaskId, text.trim());
      setNewItemTexts((prev) => ({ ...prev, [subTaskId]: '' }));
      onTaskUpdated();
    } catch (err) {
      console.error('Failed to add checklist item:', err);
    }
  };

  const handleAddRemark = async () => {
    if (!newRemark.trim() || !task) return;
    try {
      setIsSubmitting(true);
      await addTaskRemark(task.taskId, newRemark.trim(), 'Branch Head');
      setNewRemark('');
      onTaskUpdated();
    } catch (err) {
      console.error('Failed to add remark:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCompleteTask = async () => {
    if (!task) return;
    try {
      setIsSubmitting(true);
      const ratingVal = parseInt(completionRating, 10);
      await updateTaskStatus(
        task.taskId,
        'Completed',
        isNaN(ratingVal) ? 100 : ratingVal,
        completionRemark.trim(),
        completionRemark.trim() ? `Completed with rating ${ratingVal}%: ${completionRemark}` : undefined,
        'Branch Head'
      );
      onTaskUpdated();
    } catch (err) {
      console.error('Failed to complete task:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelTask = async () => {
    if (!task) return;
    if (!confirm(`Are you sure you want to cancel task ${task.taskId}?`)) return;
    try {
      setIsSubmitting(true);
      await updateTaskStatus(task.taskId, 'Cancelled', undefined, undefined, 'Task cancelled by Branch Head', 'Branch Head');
      onTaskUpdated();
    } catch (err) {
      console.error('Failed to cancel task:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyWhatsApp = async () => {
    if (!task) return;
    const text = generateWhatsAppTaskMessage(task, task);
    const success = await copyTextToClipboard(text);
    if (success) {
      setCopiedWhatsApp(true);
      setTimeout(() => setCopiedWhatsApp(false), 2500);
    } else {
      alert('Could not copy automatically. Please copy the text manually.');
    }
  };

  const handleDeleteTask = async () => {
    if (!task) return;
    const confirmDelete = window.confirm(
      `⚠️ Are you sure you want to permanently delete task "${task.taskId}: ${task.taskName}"?\n\nThis will remove the task, all sub-tasks, checklist items, and remarks. This action cannot be undone.`
    );
    if (!confirmDelete) return;

    try {
      setIsDeleting(true);
      const res = await deleteTask(task.taskId);
      if (res.success) {
        alert(`Task ${task.taskId} was deleted successfully.`);
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
      <div className="bg-[#F4F7F6] rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-[#041C32] text-white px-6 py-4 flex items-center justify-between border-b border-slate-700">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-[#F5D042] text-[#041C32] rounded-lg">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base sm:text-xl text-white flex items-center gap-2">
                <span>Task:</span>
                <span className="text-[#F5D042]">{task?.taskName || 'Loading...'}</span>
                <span className="text-xs font-mono bg-white/20 px-2 py-0.5 rounded text-white">
                  {task?.taskId}
                </span>
              </h3>
              <p className="text-xs text-slate-300 flex items-center gap-3">
                <span>Assignee: <span className="text-white font-semibold">{task?.assignToName}</span></span>
                <span>•</span>
                <span>Dept: <span className="text-white">{task?.department}</span></span>
                <span>•</span>
                <span>Priority: <span className="font-bold text-[#F5D042]">{task?.priority}</span></span>
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {/* Copy WhatsApp */}
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

            {/* Edit Task */}
            {onOpenEdit && task && (
              <button
                onClick={() => {
                  onClose();
                  onOpenEdit(task.taskId);
                }}
                title="Edit Task"
                className="flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition-all shadow-xs"
              >
                <Edit className="w-3.5 h-3.5" />
                <span>Edit Task</span>
              </button>
            )}

            {/* Delete Task */}
            <button
              onClick={handleDeleteTask}
              disabled={isDeleting}
              title="Delete Task"
              className="p-1.5 rounded-lg text-rose-300 hover:text-white hover:bg-rose-600 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
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
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {isLoading ? (
            <div className="text-center py-20 space-y-3">
              <div className="w-8 h-8 border-4 border-[#041C32] border-t-[#F5D042] rounded-full animate-spin mx-auto"></div>
              <div className="text-slate-500 font-semibold text-sm">Loading task details...</div>
            </div>
          ) : !task ? (
            <div className="text-center py-16 text-slate-500 font-semibold">Task could not be loaded.</div>
          ) : (
            <>
              {/* Progress & Metadata Header Card */}
              <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center space-x-2">
                    <span
                      className={`px-3 py-1 rounded-full font-extrabold text-xs ${
                        task.status === 'Completed'
                          ? 'bg-emerald-100 text-emerald-800'
                          : task.status === 'Cancelled'
                          ? 'bg-slate-200 text-slate-700'
                          : task.overDue
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {task.status}
                    </span>
                    <span className="text-xs text-slate-500">
                      Deadline: <span className="font-semibold text-slate-700">{task.deadline || 'No Deadline'}</span>
                    </span>
                  </div>

                  <div className="flex items-center space-x-2 text-xs font-bold text-slate-600">
                    <span>Progress:</span>
                    <span className="text-sm font-extrabold text-[#041C32]">{task.progress}%</span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden border border-slate-200">
                  <div
                    className={`h-3 rounded-full transition-all duration-500 ${
                      task.progress === 100
                        ? 'bg-emerald-500'
                        : task.progress > 50
                        ? 'bg-[#041C32]'
                        : 'bg-[#F5D042]'
                    }`}
                    style={{ width: `${task.progress}%` }}
                  ></div>
                </div>

                {task.instructions && (
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-700">
                    <div className="font-bold text-slate-500 mb-1">Instructions:</div>
                    <div className="whitespace-pre-wrap">{task.instructions}</div>
                  </div>
                )}
              </div>

              {/* Sub-tasks & Checklist Section */}
              <div className="space-y-4">
                <h4 className="font-extrabold text-sm text-[#041C32] flex items-center justify-between">
                  <span>🧩 Sub-Tasks & Checklists</span>
                  <span className="text-xs text-slate-500 font-normal">
                    Click checkbox to toggle item status
                  </span>
                </h4>

                {task.subTasks.length === 0 ? (
                  <div className="bg-white rounded-xl p-6 border border-slate-200 text-center text-slate-400 text-xs">
                    No sub-tasks defined for this task.
                  </div>
                ) : (
                  task.subTasks.map((sub) => (
                    <div key={sub.sid} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-3">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                        <div className="font-extrabold text-xs text-[#041C32]">
                          #{sub.orderNo}. {sub.name || 'Subtask'}
                        </div>
                        <span className="text-[11px] font-bold text-slate-500">
                          {sub.progress}% Complete
                        </span>
                      </div>

                      {/* Checklist Items */}
                      <div className="space-y-2">
                        {sub.items.map((item) => (
                          <div
                            key={item.itemId}
                            onClick={() => handleToggle(item.itemId, item.done)}
                            className={`p-2.5 rounded-lg border flex items-center justify-between cursor-pointer transition-colors text-xs ${
                              item.done
                                ? 'bg-emerald-50/60 border-emerald-200 text-emerald-900 line-through opacity-80'
                                : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-700'
                            }`}
                          >
                            <div className="flex items-center space-x-2.5">
                              {item.done ? (
                                <CheckSquare className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                              ) : (
                                <Square className="w-4 h-4 text-slate-400 flex-shrink-0" />
                              )}
                              <span>{item.text}</span>
                            </div>
                            {item.done && item.doneBy && (
                              <span className="text-[10px] text-emerald-700 font-semibold flex-shrink-0">
                                by {item.doneBy}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Add Item form */}
                      <div className="flex items-center space-x-2 pt-1">
                        <input
                          type="text"
                          placeholder="Add new checklist item..."
                          value={newItemTexts[sub.sid] || ''}
                          onChange={(e) =>
                            setNewItemTexts((prev) => ({ ...prev, [sub.sid]: e.target.value }))
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleAddItem(sub.sid);
                          }}
                          className="flex-1 bg-slate-50 border border-slate-200 rounded px-2.5 py-1 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#041C32]"
                        />
                        <button
                          onClick={() => handleAddItem(sub.sid)}
                          className="px-3 py-1 bg-slate-800 hover:bg-slate-900 text-white rounded text-xs font-bold transition-colors"
                        >
                          Add
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Attachments Section */}
              {task.attachments && task.attachments.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-extrabold text-sm text-[#041C32] flex items-center space-x-1.5">
                    <Paperclip className="w-4 h-4 text-slate-500" />
                    <span>Attachments ({task.attachments.length})</span>
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {task.attachments.map((att) => (
                      <a
                        key={att.attachId}
                        href={att.url}
                        target="_blank"
                        rel="noreferrer"
                        className="p-2.5 bg-white border border-slate-200 hover:border-indigo-400 rounded-lg flex items-center justify-between text-xs text-indigo-700 font-semibold shadow-sm transition-all"
                      >
                        <span className="truncate">{att.fileName}</span>
                        <span className="text-[10px] text-slate-400 ml-2 uppercase">{att.type}</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Remarks / Discussion Section */}
              <div className="space-y-3">
                <h4 className="font-extrabold text-sm text-[#041C32] flex items-center space-x-1.5">
                  <MessageSquare className="w-4 h-4 text-slate-500" />
                  <span>Activity & Remarks ({task.remarks.length})</span>
                </h4>

                <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-3">
                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      placeholder="Add an administrative remark or instruction..."
                      value={newRemark}
                      onChange={(e) => setNewRemark(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleAddRemark();
                      }}
                      className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#041C32]"
                    />
                    <button
                      onClick={handleAddRemark}
                      disabled={isSubmitting || !newRemark.trim()}
                      className="px-4 py-2 bg-[#041C32] hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition-colors disabled:opacity-50 flex items-center space-x-1"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Post</span>
                    </button>
                  </div>

                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {task.remarks.length === 0 ? (
                      <div className="text-center py-4 text-slate-400 text-xs italic">No remarks recorded yet.</div>
                    ) : (
                      task.remarks.map((rmk) => (
                        <div key={rmk.remarkId} className="p-2.5 bg-slate-50 border border-slate-100 rounded-lg text-xs space-y-1">
                          <div className="flex items-center justify-between text-[10px] text-slate-400">
                            <span className="font-bold text-slate-700">{rmk.by}</span>
                            <span>{new Date(rmk.at).toLocaleString()}</span>
                          </div>
                          <div className="text-slate-700">{rmk.text}</div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons: Complete Task / Cancel Task */}
              {task.status !== 'Completed' && task.status !== 'Cancelled' && (
                <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-4 space-y-3">
                  <h4 className="font-extrabold text-xs text-amber-950 uppercase tracking-wide flex items-center gap-1.5">
                    <Star className="w-4 h-4 text-amber-600" />
                    <span>Complete or Close Task</span>
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div>
                      <label className="text-[11px] font-bold text-slate-600">Completion Rating (%):</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={completionRating}
                        onChange={(e) => setCompletionRating(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded p-1.5 text-xs font-bold text-slate-700"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="text-[11px] font-bold text-slate-600">Completion Remarks:</label>
                      <input
                        type="text"
                        placeholder="Feedback or completion notes..."
                        value={completionRemark}
                        onChange={(e) => setCompletionRemark(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded p-1.5 text-xs text-slate-700"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-end space-x-2 pt-2">
                    <button
                      onClick={handleCancelTask}
                      disabled={isSubmitting}
                      className="px-3.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-lg transition-colors"
                    >
                      Cancel Task
                    </button>
                    <button
                      onClick={handleCompleteTask}
                      disabled={isSubmitting}
                      className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg shadow-sm transition-colors"
                    >
                      ✅ Mark as Completed
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="bg-white px-6 py-3 border-t border-slate-200 flex items-center justify-between">
          <button
            onClick={handleDeleteTask}
            disabled={isDeleting}
            className="px-3.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs rounded-lg transition-colors flex items-center space-x-1.5 disabled:opacity-50"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-600" />
            <span>{isDeleting ? 'Deleting...' : 'Delete Task'}</span>
          </button>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleCopyWhatsApp}
              className="px-3.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold text-xs rounded-lg transition-colors flex items-center space-x-1.5 shadow-2xs"
            >
              {copiedWhatsApp ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Share2 className="w-3.5 h-3.5 text-emerald-600" />}
              <span>{copiedWhatsApp ? 'Copied WhatsApp!' : 'Copy for WhatsApp'}</span>
            </button>

            {onOpenEdit && task && (
              <button
                onClick={() => {
                  onClose();
                  onOpenEdit(task.taskId);
                }}
                className="px-3.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-bold text-xs rounded-lg transition-colors flex items-center space-x-1.5 shadow-2xs"
              >
                <Edit className="w-3.5 h-3.5 text-indigo-600" />
                <span>Edit Task</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="px-5 py-1.5 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-lg transition-colors shadow-2xs"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
