import React, { useState, useEffect } from 'react';
import { X, Search, Calendar, User, Eye, Check, AlertCircle, Crown, RotateCw } from 'lucide-react';
import { DepartmentScrutinyDateGroup, FilterParams } from '../types/admin';
import { fetchDepartmentScrutiny, saveSuperAdminRating, triggerInboundSync } from '../api/admin';
import { RawTaskReportModal } from './RawTaskReportModal';

interface DepartmentScrutinyModalProps {
  isOpen: boolean;
  onClose: () => void;
  departmentName: string;
  headId: string | null;
  currentFilter: FilterParams;
  onRatingSaved: () => void;
}

export const DepartmentScrutinyModal: React.FC<DepartmentScrutinyModalProps> = ({
  isOpen,
  onClose,
  departmentName,
  headId,
  currentFilter,
  onRatingSaved,
}) => {
  const [dateGroups, setDateGroups] = useState<DepartmentScrutinyDateGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [ratingInputs, setRatingInputs] = useState<Record<string, string>>({});
  const [isApplying, setIsApplying] = useState<Record<string, boolean>>({});

  // Raw Viewer Modal state
  const [selectedTaskEmp, setSelectedTaskEmp] = useState<{
    name: string;
    id: string;
    bod: any;
    eod: any;
  } | null>(null);

  const loadScrutiny = async (withSync = false) => {
    if (!departmentName) return;
    try {
      setIsLoading(true);
      if (withSync) {
        await triggerInboundSync().catch(() => {});
      }
      const res = await fetchDepartmentScrutiny(departmentName, currentFilter);
      if (res.success) {
        setDateGroups(res.data);

        // Pre-fill rating inputs
        const initialRatings: Record<string, string> = {};
        res.data.forEach((d) => {
          initialRatings[d.date] = d.adminRating !== '' ? String(d.adminRating) : '100';
        });
        setRatingInputs(initialRatings);
      }
    } catch (err: any) {
      console.error('Failed to load scrutiny data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && departmentName) {
      // Auto-sync on open to ensure 100% freshest data from Google Sheets
      loadScrutiny(true);

      // Auto-poll every 30 seconds while modal is open
      const interval = setInterval(() => {
        loadScrutiny(false);
      }, 30000);

      return () => clearInterval(interval);
    }
  }, [isOpen, departmentName, currentFilter]);

  const handleRatingChange = (date: string, value: string) => {
    setRatingInputs((prev) => ({ ...prev, [date]: value }));
  };

  const handleApplyRating = async (dateStr: string) => {
    const valStr = ratingInputs[dateStr];
    const val = parseFloat(valStr);

    if (isNaN(val) || val < 0 || val > 200) {
      alert('Valid multiplier range is 0% to 200%.');
      return;
    }

    try {
      setIsApplying((prev) => ({ ...prev, [dateStr]: true }));
      const res = await saveSuperAdminRating(departmentName, headId, dateStr, val);
      if (res.success) {
        await loadScrutiny();
        onRatingSaved(); // Trigger parent dashboard refresh
      }
    } catch (err: any) {
      alert(`Failed to save rating: ${err.message}`);
    } finally {
      setIsApplying((prev) => ({ ...prev, [dateStr]: false }));
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-1.5 sm:p-4 bg-slate-950/75 backdrop-blur-sm animate-fadeIn">
        <div className="bg-[#F4F7F6] rounded-xl sm:rounded-2xl shadow-2xl border border-slate-200 w-full max-w-6xl max-h-[96vh] sm:max-h-[92vh] flex flex-col overflow-hidden">
          {/* Header */}
          <div className="bg-[#041C32] text-white px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between border-b border-slate-700 gap-2 shrink-0">
            <div className="flex items-center space-x-2.5 sm:space-x-3 min-w-0 flex-1">
              <div className="p-1.5 sm:p-2 bg-[#F5D042] text-[#041C32] rounded-lg shrink-0">
                <Search className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-extrabold text-sm sm:text-xl text-white truncate">
                  🔍 Scrutiny: <span className="text-[#F5D042]">{departmentName}</span>
                </h3>
                <p className="text-[11px] sm:text-xs text-slate-300 truncate">
                  Head ID: <span className="font-mono">{headId || 'Not Assigned'}</span>
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-1.5 sm:space-x-2 shrink-0">
              <button
                onClick={() => loadScrutiny(true)}
                disabled={isLoading}
                title="Sync & Refresh live from Google Sheets"
                className="flex items-center space-x-1 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold text-[#041C32] bg-[#F5D042] hover:bg-yellow-400 active:bg-yellow-500 transition-colors shadow-2xs disabled:opacity-50 min-h-[34px]"
              >
                <RotateCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                <span>Sync Live</span>
              </button>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 active:bg-white/20 transition-colors"
                title="Close Scrutiny Window"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Modal Body */}
          <div className="p-3 sm:p-6 overflow-y-auto flex-1 space-y-4 sm:space-y-6">
            {isLoading ? (
              <div className="text-center py-16 space-y-3">
                <div className="w-8 h-8 border-4 border-[#041C32] border-t-[#F5D042] rounded-full animate-spin mx-auto"></div>
                <div className="text-slate-500 font-semibold text-xs sm:text-sm">
                  Loading Department Records & Scrutiny Engine...
                </div>
              </div>
            ) : dateGroups.length === 0 ? (
              <div className="bg-white rounded-xl p-8 sm:p-12 text-center text-slate-400 border border-slate-200">
                <AlertCircle className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="font-medium text-xs sm:text-sm">
                  No reports found for this department in the selected period.
                </p>
              </div>
            ) : (
              dateGroups.map((group) => (
                <div
                  key={group.date}
                  className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden"
                >
                  {/* Date Card Header */}
                  <div className="bg-[#041C32] text-white px-3.5 sm:px-5 py-2.5 sm:py-3 flex items-center justify-between gap-2">
                    <div className="flex items-center space-x-1.5 sm:space-x-2">
                      <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#F5D042]" />
                      <span className="font-bold text-xs sm:text-base">📅 Date: {group.date}</span>
                    </div>
                    <span className="px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full bg-white/10 border border-white/20 text-xs sm:text-sm font-extrabold text-[#F5D042] shrink-0">
                      Base Avg: {group.baseAvg}%
                    </span>
                  </div>

                  <div className="p-3 sm:p-5">
                    {/* Employee Records Table with Touch Horizontal Scrolling */}
                    <div className="overflow-x-auto -mx-1 sm:mx-0">
                      <table className="w-full text-left text-xs sm:text-sm border-collapse mb-4 sm:mb-5 min-w-[550px]">
                        <thead>
                          <tr className="bg-slate-100/80 text-slate-700 border-b border-slate-200">
                            <th className="py-2 px-2.5 sm:px-3 font-bold">Employee</th>
                            <th className="py-2 px-2.5 sm:px-3 font-bold text-center">System Score</th>
                            <th className="py-2 px-2.5 sm:px-3 font-bold text-center">Head's Scrutiny</th>
                            <th className="py-2 px-2.5 sm:px-3 font-bold">Final Score & Tasks</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {group.records.map((r) => (
                            <tr key={r.empId} className="hover:bg-slate-50 transition-colors">
                              <td className="py-2.5 px-2.5 sm:px-3">
                                <div className="font-bold text-slate-800 text-xs sm:text-sm">{r.empName}</div>
                                <div className="text-[10px] sm:text-[11px] text-slate-400 font-mono">{r.empId}</div>
                              </td>
                              <td className="py-2.5 px-2.5 sm:px-3 text-center font-bold text-slate-700">
                                {r.headRating === 'Pending EOD' ? (
                                  <span className="text-slate-400 font-normal italic">-</span>
                                ) : (
                                  `${r.sysScore}%`
                                )}
                              </td>
                              <td className="py-2.5 px-2.5 sm:px-3 text-center">
                                {r.headRating === 'Pending EOD' ? (
                                  <span className="px-2 py-0.5 rounded-full bg-amber-100 border border-amber-300 text-amber-800 font-bold text-[10px] sm:text-xs whitespace-nowrap">
                                    ⏳ Pending EOD
                                  </span>
                                ) : r.headRating === 'EOD Missed' ? (
                                  <span className="px-2 py-0.5 rounded-full bg-rose-100 border border-rose-300 text-rose-800 font-bold text-[10px] sm:text-xs whitespace-nowrap">
                                    ❌ EOD Missed
                                  </span>
                                ) : r.headRating === 'Pending' ? (
                                  <span className="px-2 py-0.5 rounded-full bg-blue-100 border border-blue-300 text-blue-800 font-bold text-[10px] sm:text-xs whitespace-nowrap">
                                    Pending Review
                                  </span>
                                ) : r.headRating !== 'Auto' ? (
                                  <span className="font-extrabold text-indigo-600 text-xs sm:text-sm">
                                    {r.headRating}%
                                  </span>
                                ) : (
                                  <span className="text-slate-400 font-medium text-[11px] sm:text-xs whitespace-nowrap">
                                    Auto-Approved (100%)
                                  </span>
                                )}
                              </td>
                              <td className="py-2.5 px-2.5 sm:px-3">
                                <button
                                  onClick={() =>
                                    setSelectedTaskEmp({
                                      name: r.empName,
                                      id: r.empId,
                                      bod: r.bodData,
                                      eod: r.eodData,
                                    })
                                  }
                                  className={`w-full text-left flex items-center justify-between px-2.5 sm:px-3 py-1.5 rounded-lg border font-bold text-xs transition-all min-h-[36px] ${
                                    r.headRating === 'Pending EOD'
                                      ? 'border-amber-300 bg-amber-50/70 hover:bg-amber-100 text-amber-900'
                                      : r.headRating === 'EOD Missed'
                                      ? 'border-rose-300 bg-rose-50/70 hover:bg-rose-100 text-rose-900'
                                      : 'border-emerald-300 bg-emerald-50/60 hover:bg-emerald-100/70 text-emerald-800'
                                  }`}
                                >
                                  <span>
                                    {r.headRating === 'Pending EOD'
                                      ? 'Pending EOD'
                                      : r.headRating === 'EOD Missed'
                                      ? '0% (Missed)'
                                      : `${r.finalScore}%`}
                                  </span>
                                  <span
                                    className={`flex items-center gap-1 text-[11px] shrink-0 ml-1.5 ${
                                      r.headRating === 'Pending EOD'
                                        ? 'text-amber-700'
                                        : r.headRating === 'EOD Missed'
                                        ? 'text-rose-700'
                                        : 'text-emerald-700'
                                    }`}
                                  >
                                    <Eye className="w-3.5 h-3.5" />{' '}
                                    <span className="hidden xs:inline">
                                      {r.headRating === 'Pending EOD' || r.headRating === 'EOD Missed'
                                        ? 'View BOD'
                                        : 'View Tasks'}
                                    </span>
                                  </span>
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Super Admin Scrutiny (Rate the Head) Section - Responsive mobile layout */}
                    <div className="p-3.5 sm:p-4 rounded-xl bg-amber-50/80 border border-amber-200 flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
                      <div>
                        <div className="flex items-center space-x-1.5 text-amber-900 font-extrabold text-xs sm:text-sm mb-1">
                          <Crown className="w-4 h-4 text-[#F5D042] fill-current" />
                          <span>👑 Super Admin Scrutiny (Rate the Head)</span>
                        </div>
                        <div className="text-xs text-slate-600 flex flex-wrap items-center gap-x-4 gap-y-1">
                          <div>
                            Admin Rating:{' '}
                            <strong className="text-slate-900 font-bold">
                              {group.adminRating !== '' ? `${group.adminRating}%` : 'Not Rated'}
                            </strong>
                          </div>
                          <div>
                            Final Head Score:{' '}
                            <strong className="text-emerald-700 font-extrabold text-sm sm:text-base">
                              {group.finalScore}%
                            </strong>
                          </div>
                        </div>
                      </div>

                      {/* Scrutiny input & button - Full Width on Mobile */}
                      <div className="flex items-center gap-2 w-full md:w-auto">
                        <div className="relative flex-1 md:w-36">
                          <input
                            type="number"
                            min="0"
                            max="200"
                            value={ratingInputs[group.date] ?? ''}
                            onChange={(e) => handleRatingChange(group.date, e.target.value)}
                            placeholder="Rating (0-200%)"
                            className="w-full bg-white border border-amber-300 rounded-lg px-3 py-2 text-sm font-bold text-slate-800 text-center md:text-left focus:outline-none focus:ring-2 focus:ring-amber-500 min-h-[42px]"
                          />
                        </div>
                        <button
                          onClick={() => handleApplyRating(group.date)}
                          disabled={isApplying[group.date]}
                          className="px-4 py-2 text-xs sm:text-sm font-bold bg-[#F5D042] text-[#041C32] hover:bg-[#e3be30] active:scale-[0.98] rounded-lg shadow-2xs transition-all disabled:opacity-50 flex items-center justify-center space-x-1 min-h-[42px] shrink-0"
                        >
                          {isApplying[group.date] ? (
                            <span>Applying...</span>
                          ) : (
                            <>
                              <Check className="w-4 h-4" />
                              <span>Apply Rating</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Modal Footer */}
          <div className="bg-white px-4 sm:px-6 py-2.5 sm:py-3 border-t border-slate-200 flex justify-end shrink-0">
            <button
              onClick={onClose}
              className="w-full sm:w-auto px-5 py-2 text-xs sm:text-sm font-bold bg-slate-700 hover:bg-slate-800 active:bg-slate-900 text-white rounded-lg transition-all min-h-[38px]"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {/* Nested Raw Task Viewer Modal */}
      {selectedTaskEmp && (
        <RawTaskReportModal
          isOpen={!!selectedTaskEmp}
          onClose={() => setSelectedTaskEmp(null)}
          employeeName={selectedTaskEmp.name}
          employeeId={selectedTaskEmp.id}
          bodData={selectedTaskEmp.bod}
          eodData={selectedTaskEmp.eod}
        />
      )}
    </>
  );
};
