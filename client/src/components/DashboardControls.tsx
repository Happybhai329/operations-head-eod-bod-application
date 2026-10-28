import React, { useState } from 'react';
import { FilterParams, FilterType } from '../types/admin';
import { SyncStatusBadge } from './SyncStatusBadge';
import { Sliders, RefreshCw, FileDown, Calendar, FileText, CheckSquare, ClipboardList } from 'lucide-react';

interface DashboardControlsProps {
  currentFilter: FilterParams;
  onFilterChange: (filter: FilterParams) => void;
  onRefresh: () => void;
  onDownloadPDF: () => void;
  onOpenTracker?: () => void;
  onOpenTaskManager?: () => void;
  onOpenEmployeeReport?: () => void;
  isLoading: boolean;
}

export const DashboardControls: React.FC<DashboardControlsProps> = ({
  currentFilter,
  onFilterChange,
  onRefresh,
  onDownloadPDF,
  onOpenTracker,
  onOpenTaskManager,
  onOpenEmployeeReport,
  isLoading,
}) => {
  const [customStart, setCustomStart] = useState(currentFilter.start || '');
  const [customEnd, setCustomEnd] = useState(currentFilter.end || '');

  const handleFilterType = (type: FilterType) => {
    if (type !== 'Custom') {
      setCustomStart('');
      setCustomEnd('');
      onFilterChange({ type });
    }
  };

  const handleApplyCustom = () => {
    if (!customStart || !customEnd) {
      alert('Please select both Start and End dates.');
      return;
    }
    onFilterChange({
      type: 'Custom',
      start: customStart,
      end: customEnd,
    });
  };

  return (
    <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-3 sm:p-4 mb-4 sm:mb-6 transition-all">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 sm:gap-4">
        {/* Header title & Sync Badge on mobile */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-indigo-50 text-[#041C32] rounded-lg shrink-0">
              <Sliders className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-700" />
            </div>
            <div>
              <h2 className="font-bold text-slate-800 text-sm sm:text-base">Dashboard Controls</h2>
              <p className="text-[11px] sm:text-xs text-slate-500 hidden xs:block">
                Filter performance metrics & export reports
              </p>
            </div>
          </div>

          <div className="lg:hidden">
            <SyncStatusBadge />
          </div>
        </div>

        {/* Action controls */}
        <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2.5 sm:gap-3">
          {/* Preset Filter Buttons (Full-width Segmented Bar on mobile) */}
          <div className="grid grid-cols-3 sm:inline-flex rounded-lg shadow-2xs border border-slate-200 bg-slate-50 p-1 w-full sm:w-auto">
            {(['Daily', 'Weekly', 'Monthly'] as FilterType[]).map((fType) => (
              <button
                key={fType}
                type="button"
                onClick={() => handleFilterType(fType)}
                className={`py-1.5 sm:py-1.5 px-3 text-xs sm:text-sm font-bold rounded-md transition-all text-center ${
                  currentFilter.type === fType
                    ? 'bg-[#041C32] text-[#F5D042] shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                {fType}
              </button>
            ))}
          </div>

          {/* Custom Date Range Picker */}
          <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg p-1 gap-1 text-xs w-full sm:w-auto">
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="flex-1 sm:w-28 bg-white border border-slate-200 rounded px-2 py-1.5 sm:py-1 text-slate-700 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
              title="Start Date"
            />
            <span className="text-slate-400 font-medium text-[11px] px-0.5">To</span>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="flex-1 sm:w-28 bg-white border border-slate-200 rounded px-2 py-1.5 sm:py-1 text-slate-700 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
              title="End Date"
            />
            <button
              onClick={handleApplyCustom}
              className={`px-3 py-1.5 sm:py-1 text-xs font-bold rounded shrink-0 transition-all ${
                currentFilter.type === 'Custom'
                  ? 'bg-[#041C32] text-[#F5D042]'
                  : 'bg-slate-800 text-white hover:bg-slate-900'
              }`}
            >
              Go
            </button>
          </div>

          {/* Action Buttons: 2-column touch grid on mobile, row on tablet/desktop */}
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 sm:gap-2.5 w-full sm:w-auto">
            {/* Refresh button */}
            <button
              onClick={onRefresh}
              disabled={isLoading}
              className="flex items-center justify-center space-x-1.5 px-3 py-2 rounded-lg text-xs sm:text-sm font-bold bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white shadow-2xs transition-all disabled:opacity-50 min-h-[38px]"
              title="Refresh Performance Matrix"
            >
              <RefreshCw className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>

            {/* BOD/EOD Tracker button */}
            {onOpenTracker && (
              <button
                onClick={onOpenTracker}
                className="flex items-center justify-center space-x-1.5 px-3 py-2 rounded-lg text-xs sm:text-sm font-bold bg-cyan-600 hover:bg-cyan-700 active:bg-cyan-800 text-white shadow-2xs transition-all min-h-[38px]"
                title="Open BOD/EOD Submission Compliance Tracker"
              >
                <ClipboardList className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span>BOD/EOD Tracker</span>
              </button>
            )}

            {/* Employee BOD/EOD Download button */}
            {onOpenEmployeeReport && (
              <button
                onClick={onOpenEmployeeReport}
                className="flex items-center justify-center space-x-1.5 px-3 py-2 rounded-lg text-xs sm:text-sm font-bold bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white shadow-2xs transition-all min-h-[38px]"
                title="Download BOD/EOD dossier for any employee within filtered dates"
              >
                <FileDown className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span>Emp BOD/EOD</span>
              </button>
            )}

            {/* Task Manager button */}
            {onOpenTaskManager && (
              <button
                onClick={onOpenTaskManager}
                className="flex items-center justify-center space-x-1.5 px-3 py-2 rounded-lg text-xs sm:text-sm font-bold bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-slate-900 shadow-2xs transition-all min-h-[38px]"
                title="Open Task Manager & Checklists"
              >
                <CheckSquare className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span>Task Manager</span>
              </button>
            )}

            {/* Download PDF button */}
            <button
              onClick={onDownloadPDF}
              className="col-span-2 sm:col-span-1 flex items-center justify-center space-x-1.5 px-3 py-2 rounded-lg text-xs sm:text-sm font-bold bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white shadow-2xs transition-all min-h-[38px]"
              title="Download Report as PDF"
            >
              <FileDown className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span>Download PDF</span>
            </button>
          </div>

          {/* Sync Status - desktop view */}
          <div className="hidden lg:block">
            <SyncStatusBadge />
          </div>
        </div>
      </div>
    </div>
  );
};
