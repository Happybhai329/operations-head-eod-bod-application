import React from 'react';
import { X, CheckCircle, XCircle, FileText, Sparkles, Clock, Target } from 'lucide-react';

interface RawTaskReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  employeeName: string;
  employeeId: string;
  bodData: any;
  eodData: any;
}

export const RawTaskReportModal: React.FC<RawTaskReportModalProps> = ({
  isOpen,
  onClose,
  employeeName,
  employeeId,
  bodData,
  eodData,
}) => {
  if (!isOpen) return null;

  const parseData = (raw: any) => {
    if (!raw) return {};
    if (typeof raw === 'object') return raw;
    try {
      return JSON.parse(raw);
    } catch (_) {
      return {};
    }
  };

  const parsedBod = parseData(bodData);
  const parsedEod = parseData(eodData);

  const bodKeys = Object.keys(parsedBod);
  const eodKeys = Object.keys(parsedEod);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-[#F4F7F6] rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="bg-[#041C32] text-white px-6 py-4 flex items-center justify-between border-b border-slate-700">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-[#F5D042] text-[#041C32] rounded-lg">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base sm:text-lg text-white">
                👁️ Employee Task Report: <span className="text-[#F5D042]">{employeeName}</span>
              </h3>
              <p className="text-xs text-slate-300 font-mono">Employee ID: {employeeId}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body - 2 Columns */}
        <div className="p-6 overflow-y-auto flex-1">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 1. MORNING TARGET (BOD) COLUMN */}
            <div className="bg-white rounded-xl p-5 shadow-sm border border-indigo-200 flex flex-col">
              <div className="flex items-center space-x-2 border-b border-indigo-100 pb-3 mb-4">
                <Clock className="w-5 h-5 text-indigo-600" />
                <h4 className="font-extrabold text-indigo-950 text-sm sm:text-base">
                  📋 Morning Target (BOD)
                </h4>
              </div>

              <div className="space-y-3 flex-1">
                {bodKeys.length === 0 ? (
                  eodKeys.length > 0 ? (
                    <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-start space-x-2.5 my-auto">
                      <span className="text-base leading-none">⚠️</span>
                      <div className="space-y-1">
                        <strong className="font-bold text-amber-900 block">
                          ⚠️ Warning: Evening EOD was submitted without Morning BOD planning! (Missing Morning BOD)
                        </strong>
                        <p className="text-amber-700 text-[11px]">
                          The employee submitted evening accomplishments directly without registering morning planned tasks.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-10 text-slate-400 text-xs italic">
                      No Morning Data Found
                    </div>
                  )
                ) : (
                  bodKeys.map((key) => {
                    const task = parsedBod[key];
                    return (
                      <div
                        key={key}
                        className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700"
                      >
                        <div className="font-bold text-slate-900 text-xs sm:text-sm mb-1.5">
                          {key}
                        </div>

                        {task.type === 'dynamicList' ? (
                          task.list && task.list.length > 0 ? (
                            <ul className="space-y-1.5 pl-2">
                              {task.list.map((item: any, idx: number) => (
                                <li key={idx} className="flex items-start space-x-1.5">
                                  <span className="text-indigo-600 font-bold">•</span>
                                  <div>
                                    <strong className="text-slate-800">{item.title}</strong>
                                    {item.hasTarget === true ||
                                    item.hasTarget === 'true' ||
                                    item.hasTarget === undefined ? (
                                      <span className="text-slate-500 ml-1">
                                        (Target: <span className="font-semibold text-indigo-600">{item.target || 'N/A'}</span>)
                                      </span>
                                    ) : (
                                      <span className="text-slate-500 ml-1">(Yes/No Task)</span>
                                    )}
                                  </div>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <span className="text-slate-400 italic">No list items added.</span>
                          )
                        ) : (
                          <div className="text-slate-600">
                            Target/Value: <strong className="text-indigo-600">{task.value || 'N/A'}</strong>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* 2. EVENING STATUS (EOD) COLUMN */}
            <div className="bg-white rounded-xl p-5 shadow-sm border border-emerald-200 flex flex-col">
              <div className="flex items-center space-x-2 border-b border-emerald-100 pb-3 mb-4">
                <Target className="w-5 h-5 text-emerald-600" />
                <h4 className="font-extrabold text-emerald-950 text-sm sm:text-base">
                  📊 Evening Status (EOD)
                </h4>
              </div>

              <div className="space-y-3 flex-1">
                {eodKeys.length === 0 ? (
                  <div className="text-center py-10 text-slate-400 text-xs italic">
                    No Evening Data Found
                  </div>
                ) : (
                  eodKeys.map((key) => {
                    const task = parsedEod[key];
                    return (
                      <div
                        key={key}
                        className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700 space-y-2"
                      >
                        <div className="font-bold text-slate-900 text-xs sm:text-sm">
                          {key}
                        </div>

                        {task.type === 'dynamicList' ? (
                          task.list && task.list.length > 0 ? (
                            <ul className="space-y-1.5 pl-2">
                              {task.list.map((item: any, idx: number) => (
                                <li key={idx} className="flex items-start space-x-1.5">
                                  <span className="text-emerald-600 font-bold">•</span>
                                  <div>
                                    <strong className="text-slate-800">{item.title}: </strong>
                                    {item.hasTarget === true ||
                                    item.hasTarget === 'true' ||
                                    item.hasTarget === undefined ? (
                                      <span>
                                        Achieved:{' '}
                                        <strong className="text-emerald-600 font-bold">
                                          {item.achieved || 0}
                                        </strong>
                                      </span>
                                    ) : (
                                      <span>
                                        Status:{' '}
                                        {item.status === 'Done' ? (
                                          <span className="text-emerald-600 font-bold inline-flex items-center gap-0.5">
                                            <CheckCircle className="w-3.5 h-3.5 inline" /> Done
                                          </span>
                                        ) : (
                                          <span className="text-rose-600 font-bold inline-flex items-center gap-0.5">
                                            <XCircle className="w-3.5 h-3.5 inline" /> Not Done
                                          </span>
                                        )}
                                      </span>
                                    )}

                                    {item.isVoluntary && (
                                      <span className="ml-1.5 px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                                        ⭐ Voluntary
                                      </span>
                                    )}
                                  </div>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <span className="text-slate-400 italic">No list items added.</span>
                          )
                        ) : task.type === 'checkbox' ? (
                          <div>
                            Status:{' '}
                            {task.status === 'Done' ? (
                              <span className="text-emerald-600 font-bold inline-flex items-center gap-0.5">
                                <CheckCircle className="w-3.5 h-3.5 inline" /> Done
                              </span>
                            ) : (
                              <span className="text-rose-600 font-bold inline-flex items-center gap-0.5">
                                <XCircle className="w-3.5 h-3.5 inline" /> Not Done
                              </span>
                            )}
                          </div>
                        ) : (
                          <div>
                            Achieved: <strong className="text-emerald-600">{task.value || 'N/A'}</strong>
                          </div>
                        )}

                        {/* Sub Categories */}
                        {task.subCategories && Object.keys(task.subCategories).length > 0 && (
                          <div className="p-2.5 rounded bg-white border border-slate-200 text-slate-600 text-[11px] space-y-1">
                            <strong className="text-slate-700 block">Sub-Categories:</strong>
                            {Object.entries(task.subCategories).map(([subK, subV]) => (
                              <div key={subK}>
                                • {subK}: <strong>{String(subV)}</strong>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Remarks */}
                        {task.remarks && (
                          <div className="p-2.5 rounded bg-amber-50 border border-amber-200 text-amber-900 text-[11px]">
                            <strong>Remarks:</strong> {task.remarks}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="bg-white px-6 py-3 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 text-xs sm:text-sm font-bold bg-[#041C32] text-[#F5D042] rounded-lg hover:bg-slate-900 transition-all"
          >
            Close Report
          </button>
        </div>
      </div>
    </div>
  );
};
