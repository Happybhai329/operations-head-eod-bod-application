import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Download,
  FileText,
  FileSpreadsheet,
  Calendar,
  User,
  Building2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  Search,
  ChevronDown,
  Layers,
  Award,
} from 'lucide-react';
import { ActiveEmployeeItem, EmployeeBodEodReportData } from '../types/admin';
import { fetchActiveEmployees, fetchEmployeeBodEodReport } from '../api/admin';
import { exportEmployeeBodEodToPDF, exportEmployeeBodEodToCSV } from '../utils/employeeBodEodExport';

interface EmployeeBodEodDownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialEmployeeId?: string;
  initialStartDate?: string;
  initialEndDate?: string;
}

export const EmployeeBodEodDownloadModal: React.FC<EmployeeBodEodDownloadModalProps> = ({
  isOpen,
  onClose,
  initialEmployeeId,
  initialStartDate,
  initialEndDate,
}) => {
  // Helpers
  const formatDateISO = (d: Date) => d.toISOString().split('T')[0];
  const today = new Date();

  // State
  const [employees, setEmployees] = useState<ActiveEmployeeItem[]>([]);
  const [selectedEmpId, setSelectedEmpId] = useState<string>(initialEmployeeId || '');
  const [empSearch, setEmpSearch] = useState<string>('');
  const [isEmpDropdownOpen, setIsEmpDropdownOpen] = useState(false);

  const [startDate, setStartDate] = useState<string>(
    initialStartDate || formatDateISO(new Date(today.getTime() - 7 * 86400000))
  );
  const [endDate, setEndDate] = useState<string>(initialEndDate || formatDateISO(today));
  const [activePreset, setActivePreset] = useState<string>('7days');

  // Preview & export state
  const [previewData, setPreviewData] = useState<EmployeeBodEodReportData | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState<boolean>(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState<boolean>(false);
  const [isGeneratingCsv, setIsGeneratingCsv] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Load employee list on open
  useEffect(() => {
    if (!isOpen) return;

    if (initialEmployeeId) {
      setSelectedEmpId(initialEmployeeId);
    }
    if (initialStartDate) {
      setStartDate(initialStartDate);
    }
    if (initialEndDate) {
      setEndDate(initialEndDate);
    }

    const loadEmps = async () => {
      try {
        const res = await fetchActiveEmployees();
        if (res.success && Array.isArray(res.data)) {
          setEmployees(res.data);
          // If no initial employee, default to first one
          if (!initialEmployeeId && res.data.length > 0 && !selectedEmpId) {
            setSelectedEmpId(res.data[0].id);
          }
        }
      } catch (err) {
        console.error('Failed to load active employees:', err);
      }
    };

    loadEmps();
  }, [isOpen, initialEmployeeId, initialStartDate, initialEndDate]);

  // Load preview data whenever selectedEmpId, startDate, or endDate changes
  useEffect(() => {
    if (!isOpen || !selectedEmpId || !startDate || !endDate) return;

    let isMounted = true;
    const fetchPreview = async () => {
      try {
        setIsLoadingPreview(true);
        setErrorMessage(null);
        const res = await fetchEmployeeBodEodReport(selectedEmpId, startDate, endDate);
        if (isMounted) {
          if (res.success && res.data) {
            setPreviewData(res.data);
          } else {
            setPreviewData(null);
          }
        }
      } catch (err: any) {
        if (isMounted) {
          console.error('Error fetching employee report:', err);
          setErrorMessage(err.message || 'Failed to fetch employee report.');
          setPreviewData(null);
        }
      } finally {
        if (isMounted) {
          setIsLoadingPreview(false);
        }
      }
    };

    const timer = setTimeout(() => {
      fetchPreview();
    }, 200);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [isOpen, selectedEmpId, startDate, endDate]);

  // Presets
  const handleApplyPreset = (preset: string) => {
    setActivePreset(preset);
    const now = new Date();
    if (preset === 'today') {
      setStartDate(formatDateISO(now));
      setEndDate(formatDateISO(now));
    } else if (preset === 'yesterday') {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      setStartDate(formatDateISO(y));
      setEndDate(formatDateISO(y));
    } else if (preset === '7days') {
      const s = new Date(now);
      s.setDate(s.getDate() - 7);
      setStartDate(formatDateISO(s));
      setEndDate(formatDateISO(now));
    } else if (preset === '30days') {
      const s = new Date(now);
      s.setDate(s.getDate() - 30);
      setStartDate(formatDateISO(s));
      setEndDate(formatDateISO(now));
    } else if (preset === 'thisMonth') {
      const s = new Date(now.getFullYear(), now.getMonth(), 1);
      setStartDate(formatDateISO(s));
      setEndDate(formatDateISO(now));
    } else if (preset === 'lastMonth') {
      const s = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const e = new Date(now.getFullYear(), now.getMonth(), 0);
      setStartDate(formatDateISO(s));
      setEndDate(formatDateISO(e));
    }
  };

  // Filtered employees for dropdown
  const filteredEmployees = useMemo(() => {
    if (!empSearch.trim()) return employees;
    const term = empSearch.toLowerCase();
    return employees.filter(
      (e) =>
        e.name.toLowerCase().includes(term) ||
        e.id.toLowerCase().includes(term) ||
        e.dept.toLowerCase().includes(term)
    );
  }, [employees, empSearch]);

  const selectedEmployeeObj = useMemo(() => {
    return employees.find((e) => e.id === selectedEmpId) || null;
  }, [employees, selectedEmpId]);

  // Handlers
  const handleDownloadPDF = async () => {
    if (!previewData) {
      alert('No submission data loaded to export.');
      return;
    }
    try {
      setIsGeneratingPdf(true);
      await exportEmployeeBodEodToPDF(previewData);
    } catch (err: any) {
      alert('Failed to generate PDF: ' + (err.message || 'Unknown error'));
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleDownloadCSV = () => {
    if (!previewData) {
      alert('No submission data loaded to export.');
      return;
    }
    try {
      setIsGeneratingCsv(true);
      exportEmployeeBodEodToCSV(previewData);
    } catch (err: any) {
      alert('Failed to export CSV: ' + (err.message || 'Unknown error'));
    } finally {
      setIsGeneratingCsv(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-1 sm:p-4 bg-slate-950/75 backdrop-blur-sm animate-fadeIn">
      <div className="bg-[#F8FAFC] rounded-xl sm:rounded-2xl shadow-2xl border-0 sm:border border-slate-200 w-full max-w-full sm:max-w-3xl h-full sm:max-h-[92vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="bg-[#041C32] text-white px-3.5 sm:px-6 py-2.5 sm:py-4 flex items-center justify-between border-b border-slate-700 gap-2 shrink-0">
          <div className="flex items-center space-x-2.5 sm:space-x-3 min-w-0 flex-1">
            <div className="p-2 bg-[#F5D042] text-[#041C32] rounded-xl shadow-2xs shrink-0">
              <Download className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-extrabold text-sm sm:text-lg text-white tracking-tight truncate">
                Download Employee BOD / EOD
              </h3>
              <p className="text-[11px] text-slate-300 hidden sm:block truncate">
                Export complete daily targets, achievements, checkboxes, and remarks across filtered dates
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors shrink-0"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-3.5 sm:p-6 overflow-y-auto space-y-4 sm:space-y-5 flex-1">
          
          {/* Step 1: Employee Selection */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-2">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-indigo-600" />
              <span>Step 1: Select Employee</span>
            </label>

            <div className="relative">
              <div
                onClick={() => setIsEmpDropdownOpen(!isEmpDropdownOpen)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 flex items-center justify-between cursor-pointer hover:bg-slate-100 transition-colors"
              >
                {selectedEmployeeObj ? (
                  <div className="flex items-center space-x-2.5">
                    <span className="font-mono text-xs font-extrabold bg-[#041C32] text-[#F5D042] px-2 py-0.5 rounded">
                      {selectedEmployeeObj.id}
                    </span>
                    <span className="font-bold text-slate-800 text-sm">{selectedEmployeeObj.name}</span>
                    <span className="text-xs text-slate-500 bg-slate-200/80 px-2 py-0.5 rounded-full font-medium">
                      {selectedEmployeeObj.dept}
                    </span>
                  </div>
                ) : (
                  <span className="text-sm text-slate-400 italic">Select an employee...</span>
                )}
                <ChevronDown className="w-4 h-4 text-slate-500" />
              </div>

              {/* Dropdown Menu */}
              {isEmpDropdownOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-30 max-h-60 overflow-hidden flex flex-col">
                  <div className="p-2 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
                    <Search className="w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search by name, ID, or department..."
                      value={empSearch}
                      onChange={(e) => setEmpSearch(e.target.value)}
                      className="w-full bg-transparent text-xs text-slate-700 focus:outline-none"
                      autoFocus
                    />
                  </div>
                  <div className="overflow-y-auto max-h-48 divide-y divide-slate-100">
                    {filteredEmployees.length === 0 ? (
                      <div className="p-3 text-center text-xs text-slate-400 italic">
                        No employees found matching &quot;{empSearch}&quot;
                      </div>
                    ) : (
                      filteredEmployees.map((emp) => (
                        <div
                          key={emp.id}
                          onClick={() => {
                            setSelectedEmpId(emp.id);
                            setIsEmpDropdownOpen(false);
                            setEmpSearch('');
                          }}
                          className={`p-2.5 flex items-center justify-between cursor-pointer transition-colors text-xs ${
                            emp.id === selectedEmpId
                              ? 'bg-indigo-50 text-indigo-900 font-bold'
                              : 'hover:bg-slate-50 text-slate-700'
                          }`}
                        >
                          <div className="flex items-center space-x-2">
                            <span className="font-mono font-bold bg-slate-100 px-1.5 py-0.5 rounded text-slate-700 text-[11px]">
                              {emp.id}
                            </span>
                            <span className="font-semibold text-slate-900">{emp.name}</span>
                          </div>
                          <span className="text-[11px] text-slate-500 font-medium">{emp.dept}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Step 2: Date Range Filter */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-indigo-600" />
              <span>Step 2: Filter Dates</span>
            </label>

            {/* Quick Presets */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 -mx-1 px-1">
              {[
                { id: 'today', label: 'Today' },
                { id: 'yesterday', label: 'Yesterday' },
                { id: '7days', label: 'Last 7 Days' },
                { id: 'thisMonth', label: 'This Month' },
                { id: 'lastMonth', label: 'Last Month' },
                { id: '30days', label: 'Last 30 Days' },
              ].map((p) => (
                <button
                  key={p.id}
                  onClick={() => handleApplyPreset(p.id)}
                  type="button"
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                    activePreset === p.id
                      ? 'bg-[#041C32] text-[#F5D042] shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Date Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <span className="text-[11px] font-semibold text-slate-500 mb-1 block">From (Start Date):</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setActivePreset('custom');
                  }}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs text-slate-800 font-medium focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
              <div>
                <span className="text-[11px] font-semibold text-slate-500 mb-1 block">To (End Date):</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setActivePreset('custom');
                  }}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs text-slate-800 font-medium focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Step 3: Dossier Summary Preview */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>Period Summary Preview</span>
              </label>
              {isLoadingPreview && (
                <span className="text-xs text-slate-400 animate-pulse font-medium">Fetching records...</span>
              )}
            </div>

            {previewData ? (
              <div className="space-y-3">
                {/* Stats grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                  <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-[10px] text-slate-500 uppercase font-bold block">Period Days</span>
                    <strong className="text-base text-slate-800 font-extrabold">{previewData.stats.totalDays}</strong>
                  </div>
                  <div className="p-2.5 bg-emerald-50 rounded-lg border border-emerald-200">
                    <span className="text-[10px] text-emerald-700 uppercase font-bold block">Submitted Days</span>
                    <strong className="text-base text-emerald-800 font-extrabold">{previewData.stats.submittedDays}</strong>
                  </div>
                  <div className="p-2.5 bg-purple-50 rounded-lg border border-purple-200">
                    <span className="text-[10px] text-purple-700 uppercase font-bold block">Both BOD+EOD</span>
                    <strong className="text-base text-purple-800 font-extrabold">{previewData.stats.bothSubmittedDays}</strong>
                  </div>
                  <div className="p-2.5 bg-amber-50 rounded-lg border border-amber-200">
                    <span className="text-[10px] text-amber-700 uppercase font-bold block">Average Score</span>
                    <strong className="text-base text-amber-800 font-extrabold">
                      {previewData.stats.avgScore !== null ? `${previewData.stats.avgScore}%` : 'N/A'}
                    </strong>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-600 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-3.5 h-3.5 text-slate-400" />
                    <span>
                      Dept Head: <strong className="text-slate-800">{previewData.headName}</strong>
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-[11px]">
                    <span className="text-emerald-700 font-bold">
                      ✅ {previewData.stats.approvedDays + previewData.stats.autoApprovedDays} Approved
                    </span>
                    <span className="text-amber-700 font-bold">
                      ⏳ {previewData.stats.pendingReviewDays} Pending Review
                    </span>
                    <span className="text-rose-700 font-bold">
                      ❌ {previewData.stats.missedDays} Missed
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-6 text-slate-400 text-xs italic">
                {isLoadingPreview ? 'Analyzing submission records...' : 'No submission data available for this range.'}
              </div>
            )}
          </div>
        </div>

        {/* Footer / Actions */}
        <div className="bg-slate-100 px-3.5 sm:px-6 py-3 sm:py-4 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shrink-0">
          <div className="text-xs text-slate-600 truncate">
            Selected: <strong className="text-slate-900">{selectedEmployeeObj?.name || selectedEmpId}</strong>
            <span className="text-slate-400 ml-1">({startDate} to {endDate})</span>
          </div>

          <div className="grid grid-cols-3 sm:flex sm:items-center gap-1.5 sm:gap-2 w-full sm:w-auto">
            <button
              onClick={onClose}
              type="button"
              className="px-3 py-2 rounded-lg text-xs font-bold bg-white hover:bg-slate-200 active:bg-slate-300 text-slate-700 border border-slate-300 transition-colors min-h-[40px] text-center"
            >
              Cancel
            </button>

            <button
              onClick={handleDownloadCSV}
              disabled={!previewData || isGeneratingCsv}
              type="button"
              className="px-3 py-2 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white shadow-2xs transition-all flex items-center justify-center space-x-1 disabled:opacity-50 min-h-[40px] text-center"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{isGeneratingCsv ? 'Exporting...' : 'Excel CSV'}</span>
            </button>

            <button
              onClick={handleDownloadPDF}
              disabled={!previewData || isGeneratingPdf}
              type="button"
              className="px-3 py-2 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white shadow-2xs transition-all flex items-center justify-center space-x-1 disabled:opacity-50 min-h-[40px] text-center"
            >
              <FileText className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{isGeneratingPdf ? 'Building...' : 'PDF Dossier'}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
