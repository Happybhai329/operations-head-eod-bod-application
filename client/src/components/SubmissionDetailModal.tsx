import React from 'react';
import { X, Calendar, User, Building2, CheckCircle, XCircle, CheckCircle2, Clock, AlertCircle, Layers } from 'lucide-react';
import { SubmissionDetail } from '../types/admin';

interface SubmissionDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  detail: SubmissionDetail | null;
  isLoading: boolean;
}

export const SubmissionDetailModal: React.FC<SubmissionDetailModalProps> = ({
  isOpen,
  onClose,
  detail,
  isLoading,
}) => {
  if (!isOpen) return null;

  const renderTaskSection = (data: any, title: string, badgeBg: string, badgeText: string) => {
    if (!data || (typeof data === 'object' && Object.keys(data).length === 0)) {
      return (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-8 text-center text-slate-400">
          <AlertCircle className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="font-semibold text-sm">No {title} submitted for this date.</p>
        </div>
      );
    }

    let parsed = data;
    if (typeof data === 'string') {
      try {
        parsed = JSON.parse(data);
      } catch {
        return (
          <div className="bg-white p-4 rounded-xl border border-slate-200 text-xs font-mono whitespace-pre-wrap">
            {data}
          </div>
        );
      }
    }

    const isBod = title.toUpperCase().includes('BOD');

    return (
      <div className="space-y-4">
        {Object.entries(parsed).map(([kraName, kraVal]: [string, any]) => {
          const task = typeof kraVal === 'object' && kraVal !== null ? kraVal : { value: kraVal };
          const isDynamicList = task.type === 'dynamicList' || Array.isArray(task.list);
          const isCheckbox = task.type === 'checkbox';
          const taskList = Array.isArray(task.list) ? task.list : [];
          const remarks = task.remarks || kraVal?.remarks || '';
          const hasSubCategories =
            task.subCategories &&
            typeof task.subCategories === 'object' &&
            Object.keys(task.subCategories).length > 0;

          // Compute header task count badge
          let headerBadge = '1 Item';
          if (isDynamicList && taskList.length > 0) {
            headerBadge = `${taskList.length} Task(s)`;
          } else if (isDynamicList) {
            headerBadge = '0 Task(s)';
          } else if (task.value !== undefined && task.value !== null && String(task.value).trim() !== '') {
            headerBadge = isBod ? `Target: ${task.value}` : `Achieved: ${task.value}`;
          } else if (isCheckbox) {
            headerBadge = 'Checkbox';
          } else if (task.target !== undefined || task.achieved !== undefined) {
            headerBadge = isBod ? `Target: ${task.target ?? 'N/A'}` : `Achieved: ${task.achieved ?? '0'}`;
          }

          // Checkbox status calculation
          const isDone =
            task.status === 'Done' ||
            task.status === 'done' ||
            task.status === true ||
            task.status === 'true' ||
            task.status === '1' ||
            task.value === 'Done' ||
            task.value === 'done' ||
            task.value === true ||
            task.value === '1';

          return (
            <div key={kraName} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-3">
                <span className="font-extrabold text-xs text-[#041C32] uppercase tracking-wide">
                  📌 {kraName}
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${badgeBg} ${badgeText}`}>
                  {headerBadge}
                </span>
              </div>

              {/* Body: Dynamic List */}
              {isDynamicList ? (
                taskList.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No tasks listed under this category.</p>
                ) : (
                  <div className="space-y-2">
                    {taskList.map((item: any, idx: number) => {
                      const hasTarget =
                        item.hasTarget === true || item.hasTarget === 'true' || item.hasTarget === undefined;
                      const itemDone =
                        item.status === 'Done' ||
                        item.status === 'done' ||
                        item.status === true ||
                        item.status === 'true' ||
                        item.status === '1';

                      return (
                        <div
                          key={idx}
                          className="p-2.5 bg-slate-50 border border-slate-200/80 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-2"
                        >
                          <div className="flex items-start space-x-1.5">
                            <span className="text-slate-400 font-bold">•</span>
                            <div>
                              <span className="font-semibold text-slate-700">
                                {item.title || `Task #${idx + 1}`}
                              </span>
                              {item.isVoluntary && (
                                <span className="ml-1.5 px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[10px] inline-flex items-center">
                                  ⭐ Voluntary
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center flex-wrap gap-2 text-[11px] text-slate-500 flex-shrink-0">
                            {hasTarget && (
                              <span className="bg-white px-2 py-0.5 rounded border border-slate-200 font-mono text-slate-700">
                                {isBod ? (
                                  <>
                                    Target: <strong className="text-emerald-700">{item.target || 'N/A'}</strong>
                                  </>
                                ) : (
                                  <>
                                    Target: <span className="text-slate-600">{item.target || 'N/A'}</span>
                                    <span className="mx-1 text-slate-300">|</span>
                                    Achieved:{' '}
                                    <strong className="text-indigo-700 font-bold">{item.achieved ?? 0}</strong>
                                  </>
                                )}
                              </span>
                            )}

                            {item.status && (
                              <span
                                className={`px-2 py-0.5 rounded font-bold inline-flex items-center gap-1 ${
                                  itemDone ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                                }`}
                              >
                                {itemDone ? (
                                  <CheckCircle className="w-3.5 h-3.5 inline" />
                                ) : (
                                  <XCircle className="w-3.5 h-3.5 inline" />
                                )}
                                <span>{item.status}</span>
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )
              ) : isCheckbox ? (
                /* Body: Checkbox Task */
                <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-lg flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-700">
                    {isBod ? 'Task Requirement:' : 'Completion Status:'}
                  </span>
                  {isBod && !task.status && task.value === undefined ? (
                    <span className="px-2.5 py-1 rounded bg-slate-100 text-slate-600 font-medium text-xs">
                      Yes / No Checklist
                    </span>
                  ) : isDone ? (
                    <span className="px-2.5 py-1 rounded-md font-bold bg-emerald-100 text-emerald-800 inline-flex items-center gap-1.5 shadow-2xs">
                      <CheckCircle className="w-4 h-4 text-emerald-600 inline" />
                      <span>Done</span>
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 rounded-md font-bold bg-rose-100 text-rose-800 inline-flex items-center gap-1.5 shadow-2xs">
                      <XCircle className="w-4 h-4 text-rose-600 inline" />
                      <span>Not Done</span>
                    </span>
                  )}
                </div>
              ) : (
                /* Body: Number / Standard / CategoryNumber Task */
                <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-lg flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-700">
                    {isBod ? 'Planned Target:' : 'Reported Accomplishment:'}
                  </span>
                  <span className="bg-white px-3 py-1 rounded-md border border-slate-200 font-mono text-xs sm:text-sm font-extrabold text-slate-800 shadow-2xs">
                    {isBod ? (
                      <>
                        Target: <span className="text-emerald-700">{task.value ?? task.target ?? 'N/A'}</span>
                      </>
                    ) : (
                      <>
                        Achieved:{' '}
                        <span className="text-indigo-700">{task.value ?? task.achieved ?? 'N/A'}</span>
                      </>
                    )}
                  </span>
                </div>
              )}

              {/* Sub-Categories Breakdown */}
              {hasSubCategories && (
                <div className="mt-2.5 p-3 rounded-lg bg-slate-50/80 border border-slate-200">
                  <div className="text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Sub-Categories Breakdown</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(task.subCategories).map(([subK, subV]) => (
                      <div
                        key={subK}
                        className="px-2.5 py-1 rounded-md bg-white border border-slate-200 shadow-2xs text-xs flex items-center gap-1.5"
                      >
                        <span className="font-semibold text-slate-600 uppercase text-[10px]">{subK}:</span>
                        <span className="font-extrabold text-indigo-600 font-mono">{String(subV)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Task Remarks */}
              {remarks && (
                <div className="mt-2.5 p-2.5 bg-amber-50/80 border border-amber-200/80 rounded-lg text-xs text-amber-900 flex items-start gap-1.5">
                  <span className="font-bold shrink-0">Remarks:</span>
                  <span className="break-words">{remarks}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-[#F4F7F6] rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-[#041C32] text-white px-6 py-4 flex items-center justify-between border-b border-slate-700">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-[#F5D042] text-[#041C32] rounded-lg">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base sm:text-xl text-white flex items-center gap-2">
                <span>👁 Submission Detail:</span>
                <span className="text-[#F5D042]">{detail?.empName || 'Loading...'}</span>
              </h3>
              <p className="text-xs text-slate-300 flex items-center gap-3">
                <span>ID: <span className="font-mono text-white">{detail?.empId}</span></span>
                <span>•</span>
                <span>Dept: <span className="text-white">{detail?.dept}</span></span>
                {detail?.headName && (
                  <>
                    <span>•</span>
                    <span>Head: <span className="text-[#F5D042] font-semibold">{detail.headName}</span></span>
                  </>
                )}
                <span>•</span>
                <span>Date: <span className="font-mono text-[#F5D042]">{detail?.date}</span></span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {isLoading ? (
            <div className="text-center py-20 space-y-3">
              <div className="w-8 h-8 border-4 border-[#041C32] border-t-[#F5D042] rounded-full animate-spin mx-auto"></div>
              <div className="text-slate-500 font-semibold text-sm">Loading submission records...</div>
            </div>
          ) : !detail ? (
            <div className="text-center py-16 text-slate-500 font-semibold">
              Submission record could not be loaded.
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* BOD Content */}
              <div className="space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                  <h4 className="font-extrabold text-sm text-emerald-800 flex items-center gap-1.5">
                    <span>🌅 Beginning of Day (BOD)</span>
                  </h4>
                  <span className="text-xs font-semibold text-slate-400">Target Plan</span>
                </div>
                {renderTaskSection(detail.bodContent, 'BOD', 'bg-emerald-100', 'text-emerald-800')}
              </div>

              {/* EOD Content */}
              <div className="space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                  <h4 className="font-extrabold text-sm text-indigo-800 flex items-center gap-1.5">
                    <span>🌙 End of Day (EOD)</span>
                  </h4>
                  <span className="text-xs font-semibold text-slate-400">Accomplishment</span>
                </div>
                {renderTaskSection(detail.eodContent, 'EOD', 'bg-indigo-100', 'text-indigo-800')}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-white px-6 py-3 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
