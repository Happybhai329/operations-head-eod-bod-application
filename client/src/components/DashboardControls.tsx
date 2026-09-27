import React, { useState } from 'react';
import { FilterParams, FilterType } from '../types/admin';
import { SyncStatusBadge } from './SyncStatusBadge';
import { Sliders, RefreshCw, FileDown, Calendar } from 'lucide-react';

interface DashboardControlsProps {
  currentFilter: FilterParams;
  onFilterChange: (filter: FilterParams) => void;
  onRefresh: () => void;
  onDownloadPDF: () => void;
  onOpenTracker?: () => void;
  onOpenTaskManager?: () => void;
  isLoading: boolean;
}

export const DashboardControls: React.FC<DashboardControlsProps> = ({
  currentFilter,
  onFilterChange,
  onRefresh,
  onDownloadPDF,
  onOpenTracker,
  onOpenTaskManager,
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
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6 transition-all">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        {/* Title */}
        <div className="flex items-center space-x-2">
          <div className="p-2 bg-indigo-50 text-[#041C32] rounded-lg">
            <Sliders className="w-5 h-5 text-indigo-700" />
          </div>
          <div>
            <h2 className="font-bold text-slate-800 text-base">Dashboard Controls</h2>
            <p className="text-xs text-slate-500">Filter performance metrics & export reports</p>
          </div>
        </div>

        {/* Action controls */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Preset Filter Buttons */}
          <div className="inline-flex rounded-lg shadow-sm border border-slate-200 bg-slate-50 p-1">
            {(['Daily', 'Weekly', 'Monthly'] as FilterType[]).map((fType) => (
              <button
                key={fType}
                type="button"
                onClick={() => handleFilterType(fType)}
                className={`px-3.5 py-1.5 text-xs sm:text-sm font-bold rounded-md transition-all ${
                  currentFilter.type === fType
                    ? 'bg-[#041C32] text-[#F5D042] shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                {fType}
              </button>
            ))}
          </div>

          {/* Custom Date Range Picker */}
          <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg p-1 space-x-1.5 text-xs">
            <Calendar className="w-3.5 h-3.5 text-slate-400 ml-1.5 hidden sm:block" />
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="bg-white border border-slate-200 rounded px-2 py-1 text-slate-700 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
              title="Start Date"
            />
            <span className="text-slate-400 font-medium text-xs">To</span>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="bg-white border border-slate-200 rounded px-2 py-1 text-slate-700 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
              title="End Date"
            />
            <button
              onClick={handleApplyCustom}
              className={`px-3 py-1 text-xs font-bold rounded transition-all ${
                currentFilter.type === 'Custom'
                  ? 'bg-[#041C32] text-[#F5D042]'
                  : 'bg-slate-800 text-white hover:bg-slate-900'
              }`}
            >
              Go
            </button>
          </div>

          {/* Refresh button */}
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-all disabled:opacity-50"
            title="Refresh Performance Matrix"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          {/* BOD/EOD Tracker button */}
          {onOpenTracker && (
            <button
              onClick={onOpenTracker}
              className="flex items-center space-x-1.5 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-bold bg-cyan-600 hover:bg-cyan-700 text-white shadow-sm transition-all"
              title="Open BOD/EOD Submission Compliance Tracker"
            >
              <span>📋 BOD/EOD Tracker</span>
            </button>
          )}

          {/* Task Manager button */}
          {onOpenTaskManager && (
            <button
              onClick={onOpenTaskManager}
              className="flex items-center space-x-1.5 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-bold bg-amber-500 hover:bg-amber-600 text-slate-900 shadow-sm transition-all"
              title="Open Task Manager & Checklists"
            >
              <span>📝 Task Manager</span>
            </button>
          )}

          {/* Download PDF button */}
          <button
            onClick={onDownloadPDF}
            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-sm transition-all"
            title="Download Report as PDF"
          >
            <FileDown className="w-4 h-4" />
            <span>Download PDF</span>
          </button>

          {/* Sync Status */}
          <SyncStatusBadge />
        </div>
      </div>
    </div>
  );
};
