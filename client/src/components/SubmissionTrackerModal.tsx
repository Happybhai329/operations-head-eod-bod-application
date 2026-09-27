import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Search,
  Download,
  Calendar,
  Building2,
  Users,
  CheckCircle2,
  Clock,
  AlertTriangle,
  RotateCw,
  Eye,
  ChevronDown,
  ChevronUp,
  Star,
  Award,
  Zap,
  ShieldCheck,
  Filter,
  UserCheck,
  User,
  ListFilter,
  Sparkles,
} from 'lucide-react';
import { TrackerData, TrackerRecord, SubmissionDetail } from '../types/admin';
import { fetchSubmissionTracker, fetchSubmissionDetail, triggerInboundSync } from '../api/admin';
import { SubmissionDetailModal } from './SubmissionDetailModal';

interface SubmissionTrackerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SubmissionTrackerModal: React.FC<SubmissionTrackerModalProps> = ({
  isOpen,
  onClose,
}) => {
  // Preset helper
  const getPresetRange = (preset: string) => {
    const today = new Date();
    const formatDate = (d: Date) => d.toISOString().split('T')[0];

    if (preset === 'Today') {
      return { start: formatDate(today), end: formatDate(today) };
    } else if (preset === 'Yesterday') {
      const y = new Date(today);
      y.setDate(y.getDate() - 1);
      return { start: formatDate(y), end: formatDate(y) };
    } else if (preset === '7days') {
      const s = new Date(today);
      s.setDate(s.getDate() - 7);
      return { start: formatDate(s), end: formatDate(today) };
    } else if (preset === '30days') {
      const s = new Date(today);
      s.setDate(s.getDate() - 30);
      return { start: formatDate(s), end: formatDate(today) };
    } else if (preset === 'thisMonth') {
      const s = new Date(today.getFullYear(), today.getMonth(), 1);
      return { start: formatDate(s), end: formatDate(today) };
    } else if (preset === 'lastMonth') {
      const s = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const e = new Date(today.getFullYear(), today.getMonth(), 0);
      return { start: formatDate(s), end: formatDate(e) };
    }
    return { start: formatDate(today), end: formatDate(today) };
  };

  const initialRange = getPresetRange('7days');
  const [startDate, setStartDate] = useState(initialRange.start);
  const [endDate, setEndDate] = useState(initialRange.end);
  const [selectedDept, setSelectedDept] = useState('All');
  const [activePreset, setActivePreset] = useState('7days');

  const [trackerData, setTrackerData] = useState<TrackerData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Active Main Tab: 'compliance' (All Submissions) or 'ratings' (Head Ratings & Auto Approvals)
  const [activeTab, setActiveTab] = useState<'compliance' | 'ratings'>('compliance');

  // Clickable Card Filters: 'ALL' | 'BOD_DONE' | 'EOD_DONE' | 'BOTH' | 'BOD_ONLY' | 'NOT_SUBMITTED' | 'HEAD_RATED' | 'AUTO_APPROVED' | 'PENDING_REVIEW'
  const [activeCardFilter, setActiveCardFilter] = useState<string>('ALL');

  // Sub-filter for Ratings & Approvals Tab
  const [approvalSubFilter, setApprovalSubFilter] = useState<'ALL' | 'HEAD_RATED' | 'AUTO_APPROVED' | 'PENDING_REVIEW'>('ALL');

  // Sections collapsible state
  const [showDeptSummary, setShowDeptSummary] = useState(true);

  // Detail Modal
  const [selectedDetail, setSelectedDetail] = useState<SubmissionDetail | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isDetailLoading, setIsDetailLoading] = useState(false);

  const loadTracker = async (withSync = false) => {
    if (!startDate || !endDate) return;
    try {
      setIsLoading(true);
      if (withSync) {
        await triggerInboundSync().catch(() => {});
      }
      const res = await fetchSubmissionTracker(startDate, endDate, selectedDept);
      if (res.success) {
        setTrackerData(res.data);
      }
    } catch (err: any) {
      console.error('Failed to load tracker:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadTracker(true);
    }
  }, [isOpen]);

  const handleApplyPreset = (preset: string) => {
    setActivePreset(preset);
    const range = getPresetRange(preset);
    setStartDate(range.start);
    setEndDate(range.end);
  };

  const handleCardClick = (filterKey: string) => {
    if (activeCardFilter === filterKey) {
      setActiveCardFilter('ALL');
    } else {
      setActiveCardFilter(filterKey);
      if (filterKey === 'HEAD_RATED' || filterKey === 'AUTO_APPROVED' || filterKey === 'PENDING_REVIEW') {
        setApprovalSubFilter(filterKey as any);
      }
    }
  };

  const handleOpenDetail = async (dateStr: string, empId: string) => {
    try {
      setIsDetailOpen(true);
      setIsDetailLoading(true);
      const res = await fetchSubmissionDetail(dateStr, empId);
      if (res.success) {
        setSelectedDetail(res.data);
      }
    } catch (err) {
      console.error('Failed to load detail:', err);
    } finally {
      setIsDetailLoading(false);
    }
  };

  // Filtered records for Table 1: All Submissions Tracker
  const complianceFilteredRecords = useMemo(() => {
    if (!trackerData) return [];
    return trackerData.records.filter((r) => {
      // Card Filter
      if (activeCardFilter === 'BOD_DONE' && !r.bod) return false;
      if (activeCardFilter === 'EOD_DONE' && !r.eod) return false;
      if (activeCardFilter === 'BOTH' && r.status !== 'Both') return false;
      if (activeCardFilter === 'BOD_ONLY' && r.status !== 'BOD Only') return false;
      if (activeCardFilter === 'NOT_SUBMITTED' && r.status !== 'Not Submitted') return false;
      if (activeCardFilter === 'HEAD_RATED' && r.approvalStatus !== 'Approved') return false;
      if (activeCardFilter === 'AUTO_APPROVED' && r.approvalStatus !== 'Auto Approved') return false;
      if (activeCardFilter === 'PENDING_REVIEW' && r.approvalStatus !== 'Pending Review') return false;
      if (activeCardFilter === 'EOD_MISSED' && r.approvalStatus !== 'EOD Missed') return false;
      if (activeCardFilter === 'PENDING_EOD' && r.approvalStatus !== 'Pending EOD') return false;

      // Search term
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matches =
          r.empName.toLowerCase().includes(term) ||
          r.empId.toLowerCase().includes(term) ||
          r.dept.toLowerCase().includes(term) ||
          r.date.includes(term) ||
          r.status.toLowerCase().includes(term) ||
          (r.headName && r.headName.toLowerCase().includes(term)) ||
          (r.approvalStatus && r.approvalStatus.toLowerCase().includes(term));
        if (!matches) return false;
      }

      return true;
    });
  }, [trackerData, activeCardFilter, searchTerm]);

  // Filtered records for Table 2: Head Ratings & Auto-Approvals List
  const ratingsFilteredRecords = useMemo(() => {
    if (!trackerData) return [];
    return trackerData.records.filter((r) => {
      // Must have submitted BOD or EOD or have an evaluation
      const hasSubmission = r.bod || r.eod || (r.approvalStatus && r.approvalStatus !== 'Not Submitted');
      if (!hasSubmission) return false;

      // Approval sub-filter
      if (approvalSubFilter === 'HEAD_RATED' && r.approvalStatus !== 'Approved') return false;
      if (approvalSubFilter === 'AUTO_APPROVED' && r.approvalStatus !== 'Auto Approved') return false;
      if (approvalSubFilter === 'PENDING_REVIEW' && r.approvalStatus !== 'Pending Review') return false;

      // Card filter override if clicked
      if (activeCardFilter === 'HEAD_RATED' && r.approvalStatus !== 'Approved') return false;
      if (activeCardFilter === 'AUTO_APPROVED' && r.approvalStatus !== 'Auto Approved') return false;
      if (activeCardFilter === 'PENDING_REVIEW' && r.approvalStatus !== 'Pending Review') return false;

      // Search term
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matches =
          r.empName.toLowerCase().includes(term) ||
          r.empId.toLowerCase().includes(term) ||
          r.dept.toLowerCase().includes(term) ||
          r.date.includes(term) ||
          (r.headName && r.headName.toLowerCase().includes(term)) ||
          (r.approvalStatus && r.approvalStatus.toLowerCase().includes(term));
        if (!matches) return false;
      }

      return true;
    });
  }, [trackerData, approvalSubFilter, activeCardFilter, searchTerm]);

  // CSV Export
  const handleExportCSV = () => {
    if (!trackerData || trackerData.records.length === 0) return;
    const recordsToExport = activeTab === 'compliance' ? complianceFilteredRecords : ratingsFilteredRecords;

    const headers = [
      'Date',
      'Employee ID',
      'Employee Name',
      'Department',
      'Evaluating Branch Head',
      'BOD Submitted',
      'EOD Submitted',
      'Compliance Status',
      'System Score',
      'Head Rating',
      'Final Score',
      'Approval Status',
    ];

    const rows = recordsToExport.map((r) => [
      `"${r.date}"`,
      `"${r.empId}"`,
      `"${r.empName.replace(/"/g, '""')}"`,
      `"${r.dept.replace(/"/g, '""')}"`,
      `"${(r.headName || 'Not Assigned').replace(/"/g, '""')}"`,
      r.bod ? 'YES' : 'NO',
      r.eod ? 'YES' : 'NO',
      `"${r.status}"`,
      r.systemScore !== null && r.systemScore !== undefined ? r.systemScore : '',
      `"${r.headRating || ''}"`,
      r.finalScore !== null && r.finalScore !== undefined ? r.finalScore : '',
      `"${r.approvalStatus || 'Not Submitted'}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `BOD_EOD_${activeTab === 'ratings' ? 'Ratings_Approvals' : 'Compliance'}_${startDate}_to_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getCardFilterLabel = (key: string) => {
    switch (key) {
      case 'BOD_DONE': return '✅ BOD Done';
      case 'EOD_DONE': return '✅ EOD Done';
      case 'BOTH': return '🌿 Both Submitted';
      case 'BOD_ONLY': return '⚡ BOD Only (Missing EOD)';
      case 'NOT_SUBMITTED': return '❌ Not Submitted';
      case 'HEAD_RATED': return '👨‍💼 Head Rated (Approved)';
      case 'AUTO_APPROVED': return '⚡ Auto Approved (24h Rule)';
      case 'PENDING_REVIEW': return '⏳ Pending Review';
      case 'EOD_MISSED': return '❌ EOD Missed';
      case 'PENDING_EOD': return '⏳ Pending EOD';
      default: return 'All Records';
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 flex items-center justify-center p-2 sm:p-4 bg-slate-950/75 backdrop-blur-sm animate-fadeIn">
        <div className="bg-[#F4F7F6] rounded-2xl shadow-2xl border border-slate-200 w-full max-w-[96vw] xl:max-w-7xl max-h-[96vh] flex flex-col overflow-hidden">
          
          {/* Header */}
          <div className="bg-[#041C32] text-white px-6 py-3.5 flex items-center justify-between border-b border-slate-700">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-[#F5D042] text-[#041C32] rounded-xl shadow-sm">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-base sm:text-xl text-white tracking-tight">
                  📋 BOD / EOD <span className="text-[#F5D042]">Submission Compliance & Ratings Tracker</span>
                </h3>
                <p className="text-xs text-slate-300">
                  Real-time analytics for Employee Morning & Evening Work Submissions, Branch Head Ratings, and Auto-Approvals
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => loadTracker(true)}
                disabled={isLoading}
                title="Sync Live with Google Sheets & Supabase"
                className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold text-[#041C32] bg-[#F5D042] hover:bg-yellow-400 transition-colors shadow-sm disabled:opacity-50"
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

          {/* Filter Bar */}
          <div className="bg-white px-6 py-3 border-b border-slate-200 space-y-2.5">
            {/* Presets */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-bold text-slate-500 mr-1">Presets:</span>
                {[
                  { id: 'Today', label: 'Today' },
                  { id: 'Yesterday', label: 'Yesterday' },
                  { id: '7days', label: 'Last 7 Days' },
                  { id: '30days', label: 'Last 30 Days' },
                  { id: 'thisMonth', label: 'This Month' },
                  { id: 'lastMonth', label: 'Last Month' },
                ].map((p) => (
                  <button
                    key={p.id}
                    onClick={() => handleApplyPreset(p.id)}
                    className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all ${
                      activePreset === p.id
                        ? 'bg-[#041C32] text-[#F5D042] shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {/* View Switcher Tabs */}
              <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
                <button
                  onClick={() => {
                    setActiveTab('compliance');
                    setActiveCardFilter('ALL');
                  }}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    activeTab === 'compliance'
                      ? 'bg-[#041C32] text-[#F5D042] shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <ListFilter className="w-3.5 h-3.5" />
                  <span>📋 All Submissions List</span>
                </button>
                <button
                  onClick={() => {
                    setActiveTab('ratings');
                    setActiveCardFilter('ALL');
                  }}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    activeTab === 'ratings'
                      ? 'bg-[#041C32] text-[#F5D042] shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                  <span>⭐ Head Ratings & Approvals</span>
                  {(trackerData?.summary.headRated || 0) + (trackerData?.summary.autoApproved || 0) > 0 && (
                    <span className="ml-1 px-1.5 py-0.2 rounded-full bg-emerald-500 text-white text-[10px] font-extrabold">
                      {(trackerData?.summary.headRated || 0) + (trackerData?.summary.autoApproved || 0)}
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* Date Inputs & Department Filter */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <div className="flex items-center space-x-1 bg-slate-50 border border-slate-200 rounded-lg p-1">
                  <span className="text-slate-400 px-1 font-semibold">From:</span>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => {
                      setStartDate(e.target.value);
                      setActivePreset('');
                    }}
                    className="bg-white border border-slate-200 rounded px-2 py-1 text-slate-700 text-xs focus:outline-none"
                  />
                  <span className="text-slate-400 px-1 font-semibold">To:</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => {
                      setEndDate(e.target.value);
                      setActivePreset('');
                    }}
                    className="bg-white border border-slate-200 rounded px-2 py-1 text-slate-700 text-xs focus:outline-none"
                  />
                </div>

                <div className="flex items-center space-x-1 bg-slate-50 border border-slate-200 rounded-lg p-1">
                  <span className="text-slate-400 px-1 font-semibold">Dept:</span>
                  <select
                    value={selectedDept}
                    onChange={(e) => setSelectedDept(e.target.value)}
                    className="bg-white border border-slate-200 rounded px-2 py-1 text-slate-700 text-xs focus:outline-none"
                  >
                    <option value="All">All Departments</option>
                    {(trackerData?.departments || []).map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  onClick={() => loadTracker(false)}
                  disabled={isLoading}
                  className="px-4 py-1.5 bg-[#041C32] hover:bg-slate-800 text-white font-bold rounded-lg text-xs flex items-center space-x-1 shadow-sm transition-all"
                >
                  <Search className="w-3.5 h-3.5 text-[#F5D042]" />
                  <span>Load Data</span>
                </button>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={handleExportCSV}
                  disabled={!trackerData || trackerData.records.length === 0}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs flex items-center space-x-1.5 shadow-sm transition-all disabled:opacity-50"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export CSV</span>
                </button>
              </div>
            </div>
          </div>

          {/* Modal Content */}
          <div className="p-5 overflow-y-auto flex-1 space-y-4">
            {isLoading ? (
              <div className="text-center py-20 space-y-3">
                <div className="w-8 h-8 border-4 border-[#041C32] border-t-[#F5D042] rounded-full animate-spin mx-auto"></div>
                <div className="text-slate-500 font-semibold text-sm">
                  Querying live submissions from Supabase PostgreSQL...
                </div>
              </div>
            ) : !trackerData ? (
              <div className="bg-white rounded-xl p-16 text-center text-slate-400 border border-slate-200">
                <Calendar className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="font-semibold text-sm">Select a date range and click Load Data to view compliance.</p>
              </div>
            ) : (
              <>
                {/* Clickable KPI Summary Cards */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-500 font-semibold px-1">
                    <span className="flex items-center gap-1">
                      <Filter className="w-3.5 h-3.5 text-[#041C32]" />
                      <span>Click any summary card to instantly filter employee list:</span>
                    </span>
                    {activeCardFilter !== 'ALL' && (
                      <button
                        onClick={() => setActiveCardFilter('ALL')}
                        className="text-indigo-600 hover:text-indigo-800 font-bold underline text-xs"
                      >
                        Reset / Show All Records
                      </button>
                    )}
                  </div>

                  {/* Top Row: Submission Compliance Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
                    {/* Total Records */}
                    <div
                      onClick={() => handleCardClick('ALL')}
                      className={`bg-white rounded-xl p-3 border shadow-xs cursor-pointer transition-all duration-200 hover:shadow-md hover:scale-[1.01] ${
                        activeCardFilter === 'ALL'
                          ? 'border-[#041C32] ring-2 ring-[#041C32]/30 bg-slate-50/80'
                          : 'border-slate-200'
                      }`}
                    >
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Records</div>
                      <div className="text-xl font-extrabold text-[#041C32]">{trackerData.summary.totalRecords}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">All Days × Emps</div>
                    </div>

                    {/* Unique Employees */}
                    <div
                      onClick={() => handleCardClick('ALL')}
                      className={`bg-white rounded-xl p-3 border shadow-xs cursor-pointer transition-all duration-200 hover:shadow-md hover:scale-[1.01] ${
                        activeCardFilter === 'ALL'
                          ? 'border-indigo-600 ring-2 ring-indigo-500/20'
                          : 'border-slate-200'
                      }`}
                    >
                      <div className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider">Unique Emps</div>
                      <div className="text-xl font-extrabold text-indigo-600">{trackerData.summary.uniqueEmployees}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">Active Staff</div>
                    </div>

                    {/* BOD Done */}
                    <div
                      onClick={() => handleCardClick('BOD_DONE')}
                      className={`bg-white rounded-xl p-3 border shadow-xs cursor-pointer transition-all duration-200 hover:shadow-md hover:scale-[1.01] ${
                        activeCardFilter === 'BOD_DONE'
                          ? 'border-emerald-600 ring-2 ring-emerald-500/30 bg-emerald-50/50'
                          : 'border-slate-200'
                      }`}
                    >
                      <div className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">✅ BOD Done</div>
                      <div className="text-xl font-extrabold text-emerald-700">{trackerData.summary.bodDone}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">Pending: {trackerData.summary.bodPending}</div>
                    </div>

                    {/* EOD Done */}
                    <div
                      onClick={() => handleCardClick('EOD_DONE')}
                      className={`bg-white rounded-xl p-3 border shadow-xs cursor-pointer transition-all duration-200 hover:shadow-md hover:scale-[1.01] ${
                        activeCardFilter === 'EOD_DONE'
                          ? 'border-blue-600 ring-2 ring-blue-500/30 bg-blue-50/50'
                          : 'border-slate-200'
                      }`}
                    >
                      <div className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">✅ EOD Done</div>
                      <div className="text-xl font-extrabold text-blue-700">{trackerData.summary.eodDone}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">Pending: {trackerData.summary.eodPending}</div>
                    </div>

                    {/* Both Submitted */}
                    <div
                      onClick={() => handleCardClick('BOTH')}
                      className={`bg-emerald-50/80 rounded-xl p-3 border shadow-xs cursor-pointer transition-all duration-200 hover:shadow-md hover:scale-[1.01] ${
                        activeCardFilter === 'BOTH'
                          ? 'border-emerald-700 ring-2 ring-emerald-600/40 bg-emerald-100/70'
                          : 'border-emerald-200'
                      }`}
                    >
                      <div className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">Both Submitted</div>
                      <div className="text-xl font-extrabold text-emerald-800">{trackerData.summary.bothDone}</div>
                      <div className="text-[10px] text-emerald-600 mt-0.5">100% Compliant</div>
                    </div>

                    {/* BOD Only */}
                    <div
                      onClick={() => handleCardClick('BOD_ONLY')}
                      className={`bg-amber-50/80 rounded-xl p-3 border shadow-xs cursor-pointer transition-all duration-200 hover:shadow-md hover:scale-[1.01] ${
                        activeCardFilter === 'BOD_ONLY'
                          ? 'border-amber-600 ring-2 ring-amber-500/40 bg-amber-100/70'
                          : 'border-amber-200'
                      }`}
                    >
                      <div className="text-[10px] font-bold text-amber-800 uppercase tracking-wider">BOD Only</div>
                      <div className="text-xl font-extrabold text-amber-800">{trackerData.summary.bodOnly}</div>
                      <div className="text-[10px] text-amber-600 mt-0.5">Missing EOD</div>
                    </div>

                    {/* Not Submitted */}
                    <div
                      onClick={() => handleCardClick('NOT_SUBMITTED')}
                      className={`bg-rose-50/80 rounded-xl p-3 border shadow-xs cursor-pointer transition-all duration-200 hover:shadow-md hover:scale-[1.01] col-span-2 sm:col-span-1 ${
                        activeCardFilter === 'NOT_SUBMITTED'
                          ? 'border-rose-600 ring-2 ring-rose-500/40 bg-rose-100/70'
                          : 'border-rose-200'
                      }`}
                    >
                      <div className="text-[10px] font-bold text-rose-800 uppercase tracking-wider">Not Submitted</div>
                      <div className="text-xl font-extrabold text-rose-800">{trackerData.summary.none}</div>
                      <div className="text-[10px] text-rose-600 mt-0.5">Zero Activity</div>
                    </div>
                  </div>

                  {/* Second Row: Evaluation & Approval Breakdown Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {/* Head Rated (Approved) */}
                    <div
                      onClick={() => {
                        handleCardClick('HEAD_RATED');
                      }}
                      className={`rounded-xl p-3 border shadow-xs cursor-pointer transition-all duration-200 hover:shadow-md hover:scale-[1.01] flex items-center justify-between ${
                        activeCardFilter === 'HEAD_RATED'
                          ? 'border-emerald-700 ring-2 ring-emerald-500/40 bg-emerald-100/80'
                          : 'bg-white border-slate-200'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <div className="p-2 rounded-lg bg-emerald-100 text-emerald-800">
                          <UserCheck className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">
                            👨‍💼 Head Rated (Approved)
                          </div>
                          <div className="text-lg font-extrabold text-slate-800">
                            {trackerData.summary.headRated || 0} Submissions
                          </div>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                        Manual Review
                      </span>
                    </div>

                    {/* Auto Approved */}
                    <div
                      onClick={() => {
                        handleCardClick('AUTO_APPROVED');
                      }}
                      className={`rounded-xl p-3 border shadow-xs cursor-pointer transition-all duration-200 hover:shadow-md hover:scale-[1.01] flex items-center justify-between ${
                        activeCardFilter === 'AUTO_APPROVED'
                          ? 'border-purple-700 ring-2 ring-purple-500/40 bg-purple-100/80'
                          : 'bg-white border-slate-200'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <div className="p-2 rounded-lg bg-purple-100 text-purple-800">
                          <Zap className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="text-[10px] font-bold text-purple-700 uppercase tracking-wider">
                            ⚡ Auto Approved (24h Engine)
                          </div>
                          <div className="text-lg font-extrabold text-slate-800">
                            {trackerData.summary.autoApproved || 0} Submissions
                          </div>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-full">
                        100% Score
                      </span>
                    </div>

                    {/* Pending Review */}
                    <div
                      onClick={() => {
                        handleCardClick('PENDING_REVIEW');
                      }}
                      className={`rounded-xl p-3 border shadow-xs cursor-pointer transition-all duration-200 hover:shadow-md hover:scale-[1.01] flex items-center justify-between ${
                        activeCardFilter === 'PENDING_REVIEW'
                          ? 'border-amber-700 ring-2 ring-amber-500/40 bg-amber-100/80'
                          : 'bg-white border-slate-200'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <div className="p-2 rounded-lg bg-amber-100 text-amber-800">
                          <Clock className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">
                            ⏳ Pending Head Review
                          </div>
                          <div className="text-lg font-extrabold text-slate-800">
                            {trackerData.summary.pendingReview || 0} Submissions
                          </div>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                        Awaiting Rating
                      </span>
                    </div>
                  </div>
                </div>

                {/* Active Filter Notification Banner */}
                {activeCardFilter !== 'ALL' && (
                  <div className="bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-2.5 flex items-center justify-between shadow-2xs">
                    <div className="flex items-center space-x-2 text-xs font-bold text-indigo-950">
                      <Filter className="w-4 h-4 text-indigo-600" />
                      <span>
                        Active Filter:{' '}
                        <span className="bg-indigo-200/70 text-indigo-900 px-2 py-0.5 rounded-md">
                          {getCardFilterLabel(activeCardFilter)}
                        </span>
                      </span>
                      <span className="text-indigo-600 font-normal">
                        ({activeTab === 'compliance' ? complianceFilteredRecords.length : ratingsFilteredRecords.length} records matching)
                      </span>
                    </div>
                    <button
                      onClick={() => setActiveCardFilter('ALL')}
                      className="text-xs font-bold text-indigo-700 hover:text-indigo-900 bg-white border border-indigo-200 hover:border-indigo-300 px-2.5 py-1 rounded-lg transition-colors"
                    >
                      Clear Filter (Show All)
                    </button>
                  </div>
                )}

                {/* Department-wise Summary Collapsible */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                  <div
                    onClick={() => setShowDeptSummary(!showDeptSummary)}
                    className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between cursor-pointer hover:bg-slate-100 transition-colors"
                  >
                    <div className="flex items-center space-x-2">
                      <Building2 className="w-4 h-4 text-indigo-600" />
                      <span className="font-extrabold text-xs text-[#041C32]">🏢 Department-wise Compliance Summary</span>
                    </div>
                    {showDeptSummary ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                  </div>

                  {showDeptSummary && (
                    <div className="overflow-x-auto max-h-56">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-slate-100 text-slate-600 font-bold sticky top-0">
                          <tr>
                            <th className="p-2">Department</th>
                            <th className="p-2 text-center">Total</th>
                            <th className="p-2 text-center text-emerald-700">✅ BOD Done</th>
                            <th className="p-2 text-center text-rose-700">❌ BOD Pend</th>
                            <th className="p-2 text-center text-blue-700">✅ EOD Done</th>
                            <th className="p-2 text-center text-rose-700">❌ EOD Pend</th>
                            <th className="p-2 text-center text-emerald-800">Both</th>
                            <th className="p-2 text-center text-amber-800">BOD Only</th>
                            <th className="p-2 text-center text-rose-800">None</th>
                            <th className="p-2 text-right">Compliance %</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {trackerData.deptSummary.map((d) => {
                            const compliance = d.total > 0 ? Math.round((d.bothDone / d.total) * 100) : 0;
                            return (
                              <tr key={d.dept} className="hover:bg-slate-50/80">
                                <td className="p-2 font-bold text-slate-800">{d.dept}</td>
                                <td className="p-2 text-center font-semibold text-slate-600">{d.total}</td>
                                <td className="p-2 text-center font-semibold text-emerald-700">{d.bodDone}</td>
                                <td className="p-2 text-center text-slate-400">{d.bodPending}</td>
                                <td className="p-2 text-center font-semibold text-blue-700">{d.eodDone}</td>
                                <td className="p-2 text-center text-slate-400">{d.eodPending}</td>
                                <td className="p-2 text-center font-bold text-emerald-700">{d.bothDone}</td>
                                <td className="p-2 text-center text-amber-700">{d.bodOnly}</td>
                                <td className="p-2 text-center text-rose-700">{d.none}</td>
                                <td className="p-2 text-right font-extrabold text-indigo-700">{compliance}%</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* VIEW TAB 1: ALL SUBMISSIONS COMPLIANCE LIST */}
                {activeTab === 'compliance' && (
                  <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                    <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center space-x-2">
                        <Users className="w-4 h-4 text-emerald-600" />
                        <span className="font-extrabold text-xs text-[#041C32]">
                          👥 Employee Submission List ({complianceFilteredRecords.length} Entries)
                        </span>
                      </div>

                      <div className="flex items-center space-x-2">
                        <input
                          type="text"
                          placeholder="Search employee, ID, or department..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-700 w-52 sm:w-72 focus:outline-none focus:ring-1 focus:ring-[#041C32]"
                        />
                      </div>
                    </div>

                    <div className="overflow-x-auto max-h-[440px]">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-[#041C32] text-white font-bold sticky top-0 z-10">
                          <tr>
                            <th className="p-2.5">Date</th>
                            <th className="p-2.5">Employee ID</th>
                            <th className="p-2.5">Employee Name</th>
                            <th className="p-2.5">Department & Evaluating Head</th>
                            <th className="p-2.5 text-center">BOD</th>
                            <th className="p-2.5 text-center">EOD</th>
                            <th className="p-2.5 text-center">Submission Status</th>
                            <th className="p-2.5 text-center">Head Rating / Approval</th>
                            <th className="p-2.5 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {complianceFilteredRecords.length === 0 ? (
                            <tr>
                              <td colSpan={9} className="p-10 text-center text-slate-400 italic">
                                No submission records matching filter.
                              </td>
                            </tr>
                          ) : (
                            complianceFilteredRecords.map((r, idx) => (
                              <tr key={`${r.date}_${r.empId}_${idx}`} className="hover:bg-slate-50/80 transition-colors">
                                <td className="p-2.5 font-mono text-slate-600 whitespace-nowrap">{r.date}</td>
                                <td className="p-2.5 font-mono font-bold text-slate-700 whitespace-nowrap">{r.empId}</td>
                                <td className="p-2.5 font-bold text-slate-900 whitespace-nowrap">{r.empName}</td>
                                <td className="p-2.5">
                                  <div className="font-semibold text-slate-800">{r.dept}</div>
                                  <div className="text-[11px] text-slate-500 flex items-center gap-1">
                                    <span className="font-medium">Head:</span>
                                    <span className="text-indigo-700 font-semibold">{r.headName || 'Not Assigned'}</span>
                                  </div>
                                </td>
                                <td className="p-2.5 text-center whitespace-nowrap">
                                  {r.bod ? (
                                    <span className="text-emerald-700 font-bold bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                                      ✅ Done
                                    </span>
                                  ) : (
                                    <span className="text-slate-400 font-medium bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-md">
                                      ❌ None
                                    </span>
                                  )}
                                </td>
                                <td className="p-2.5 text-center whitespace-nowrap">
                                  {r.eod ? (
                                    <span className="text-emerald-700 font-bold bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                                      ✅ Done
                                    </span>
                                  ) : (
                                    <span className="text-slate-400 font-medium bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-md">
                                      ❌ None
                                    </span>
                                  )}
                                </td>
                                <td className="p-2.5 text-center whitespace-nowrap">
                                  <span
                                    className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                                      r.status === 'Both'
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : r.status === 'BOD Only'
                                        ? 'bg-amber-100 text-amber-800'
                                        : r.status === 'EOD Only (Missing BOD)'
                                        ? 'bg-orange-100 text-orange-800'
                                        : 'bg-rose-100 text-rose-800'
                                    }`}
                                  >
                                    {r.status}
                                  </span>
                                </td>
                                <td className="p-2.5 text-center whitespace-nowrap">
                                  {r.approvalStatus === 'Approved' ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-bold">
                                      <UserCheck className="w-3 h-3 text-emerald-600" />
                                      <span>Rated: {r.headRating || '100%'}</span>
                                      {r.finalScore !== null && r.finalScore !== undefined && (
                                        <span className="ml-1 text-emerald-950">({r.finalScore})</span>
                                      )}
                                    </span>
                                  ) : r.approvalStatus === 'Auto Approved' ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-50 text-purple-800 border border-purple-200 text-[11px] font-bold">
                                      <Zap className="w-3 h-3 text-purple-600" />
                                      <span>Auto Approved (100%)</span>
                                    </span>
                                  ) : r.approvalStatus === 'Pending Review' ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 text-[11px] font-bold">
                                      <Clock className="w-3 h-3 text-amber-600" />
                                      <span>Pending Review</span>
                                    </span>
                                  ) : r.approvalStatus === 'EOD Missed' ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-50 text-rose-800 border border-rose-200 text-[11px] font-bold">
                                      <span>❌ EOD Missed</span>
                                    </span>
                                  ) : r.approvalStatus === 'Pending EOD' ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 text-[11px] font-bold">
                                      <span>⏳ Pending EOD</span>
                                    </span>
                                  ) : (
                                    <span className="text-slate-300 font-mono">—</span>
                                  )}
                                </td>
                                <td className="p-2.5 text-right whitespace-nowrap">
                                  <button
                                    onClick={() => handleOpenDetail(r.date, r.empId)}
                                    className="px-2.5 py-1 bg-slate-100 hover:bg-[#041C32] hover:text-[#F5D042] text-slate-700 font-bold rounded text-[11px] transition-colors inline-flex items-center space-x-1"
                                  >
                                    <Eye className="w-3 h-3" />
                                    <span>View</span>
                                  </button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* VIEW TAB 2: HEAD RATINGS & AUTO-APPROVALS LIST */}
                {activeTab === 'ratings' && (
                  <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                    <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
                      <div className="space-y-0.5">
                        <div className="flex items-center space-x-2">
                          <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                          <span className="font-extrabold text-xs text-[#041C32]">
                            ⭐ Branch Head Ratings & Auto-Approvals Directory ({ratingsFilteredRecords.length} Records)
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500">
                          Identifies which Branch Head evaluated each employee and which submissions were auto-approved.
                        </p>
                      </div>

                      {/* Sub-Filter Pills */}
                      <div className="flex flex-wrap items-center gap-1.5">
                        {[
                          { id: 'ALL', label: 'All Submissions' },
                          { id: 'HEAD_RATED', label: '👨‍💼 Head Rated (Approved)' },
                          { id: 'AUTO_APPROVED', label: '⚡ Auto Approved (24h)' },
                          { id: 'PENDING_REVIEW', label: '⏳ Pending Review' },
                        ].map((btn) => (
                          <button
                            key={btn.id}
                            onClick={() => {
                              setApprovalSubFilter(btn.id as any);
                              setActiveCardFilter('ALL');
                            }}
                            className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all ${
                              approvalSubFilter === btn.id
                                ? 'bg-[#041C32] text-[#F5D042] shadow-xs'
                                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                            }`}
                          >
                            {btn.label}
                          </button>
                        ))}
                      </div>

                      <div className="flex items-center space-x-2">
                        <input
                          type="text"
                          placeholder="Search employee, ID, or head..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-700 w-52 sm:w-64 focus:outline-none focus:ring-1 focus:ring-[#041C32]"
                        />
                      </div>
                    </div>

                    <div className="overflow-x-auto max-h-[440px]">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-[#041C32] text-white font-bold sticky top-0 z-10">
                          <tr>
                            <th className="p-2.5">Date</th>
                            <th className="p-2.5">Employee ID</th>
                            <th className="p-2.5">Employee Name</th>
                            <th className="p-2.5">Department</th>
                            <th className="p-2.5">Evaluating Branch Head</th>
                            <th className="p-2.5 text-center">System Score</th>
                            <th className="p-2.5 text-center">Head Rating</th>
                            <th className="p-2.5 text-center">Final Score</th>
                            <th className="p-2.5 text-center">Approval Type & Status</th>
                            <th className="p-2.5 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {ratingsFilteredRecords.length === 0 ? (
                            <tr>
                              <td colSpan={10} className="p-10 text-center text-slate-400 italic">
                                No evaluations found matching the selected filters.
                              </td>
                            </tr>
                          ) : (
                            ratingsFilteredRecords.map((r, idx) => (
                              <tr key={`eval_${r.date}_${r.empId}_${idx}`} className="hover:bg-slate-50/80 transition-colors">
                                <td className="p-2.5 font-mono text-slate-600 whitespace-nowrap">{r.date}</td>
                                <td className="p-2.5 font-mono font-bold text-slate-700 whitespace-nowrap">{r.empId}</td>
                                <td className="p-2.5 font-bold text-slate-900 whitespace-nowrap">{r.empName}</td>
                                <td className="p-2.5 font-semibold text-slate-700 whitespace-nowrap">{r.dept}</td>
                                <td className="p-2.5 whitespace-nowrap">
                                  {r.headName ? (
                                    <span className="inline-flex items-center gap-1.5 font-bold text-indigo-900 bg-indigo-50 border border-indigo-200/80 px-2 py-0.5 rounded-md">
                                      <User className="w-3.5 h-3.5 text-indigo-600" />
                                      <span>{r.headName}</span>
                                    </span>
                                  ) : (
                                    <span className="text-slate-400 italic">Head Not Assigned</span>
                                  )}
                                </td>
                                <td className="p-2.5 text-center font-mono font-semibold text-slate-700 whitespace-nowrap">
                                  {r.systemScore !== null && r.systemScore !== undefined ? `${r.systemScore} / 100` : '—'}
                                </td>
                                <td className="p-2.5 text-center whitespace-nowrap">
                                  {r.headRating ? (
                                    <span className="font-bold text-slate-800 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md font-mono">
                                      {r.headRating}%
                                    </span>
                                  ) : (
                                    <span className="text-slate-400 font-mono italic">Pending</span>
                                  )}
                                </td>
                                <td className="p-2.5 text-center font-mono font-extrabold whitespace-nowrap">
                                  {r.finalScore !== null && r.finalScore !== undefined ? (
                                    <span
                                      className={`px-2 py-0.5 rounded-md ${
                                        r.finalScore >= 80
                                          ? 'bg-emerald-100 text-emerald-800'
                                          : r.finalScore >= 50
                                          ? 'bg-amber-100 text-amber-800'
                                          : 'bg-rose-100 text-rose-800'
                                      }`}
                                    >
                                      {r.finalScore} / 100
                                    </span>
                                  ) : (
                                    <span className="text-slate-400">—</span>
                                  )}
                                </td>
                                <td className="p-2.5 text-center whitespace-nowrap">
                                  {r.approvalStatus === 'Approved' ? (
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-300 font-bold text-xs shadow-2xs">
                                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                      <span>👨‍💼 Head Rated</span>
                                    </span>
                                  ) : r.approvalStatus === 'Auto Approved' ? (
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-purple-50 text-purple-800 border border-purple-300 font-bold text-xs shadow-2xs">
                                      <Zap className="w-3.5 h-3.5 text-purple-600" />
                                      <span>⚡ Auto Approved (24h)</span>
                                    </span>
                                  ) : r.approvalStatus === 'Pending Review' ? (
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-50 text-amber-800 border border-amber-300 font-bold text-xs shadow-2xs">
                                      <Clock className="w-3.5 h-3.5 text-amber-600" />
                                      <span>⏳ Pending Review</span>
                                    </span>
                                  ) : r.approvalStatus === 'EOD Missed' ? (
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-rose-50 text-rose-800 border border-rose-300 font-bold text-xs shadow-2xs">
                                      <span>❌ EOD Missed</span>
                                    </span>
                                  ) : r.approvalStatus === 'Pending EOD' ? (
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-50 text-amber-800 border border-amber-300 font-bold text-xs shadow-2xs">
                                      <span>⏳ Pending EOD</span>
                                    </span>
                                  ) : (
                                    <span className="text-slate-400 italic">Not Submitted</span>
                                  )}
                                </td>
                                <td className="p-2.5 text-right whitespace-nowrap">
                                  <button
                                    onClick={() => handleOpenDetail(r.date, r.empId)}
                                    className="px-2.5 py-1 bg-slate-100 hover:bg-[#041C32] hover:text-[#F5D042] text-slate-700 font-bold rounded text-[11px] transition-colors inline-flex items-center space-x-1"
                                  >
                                    <Eye className="w-3 h-3" />
                                    <span>View</span>
                                  </button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          <div className="bg-white px-6 py-2.5 border-t border-slate-200 flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium">
              Data synchronized real-time with Supabase PostgreSQL & Google Sheets
            </span>
            <button
              onClick={onClose}
              className="px-5 py-1.5 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-lg transition-colors shadow-sm"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {/* Submission Detail Modal */}
      <SubmissionDetailModal
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        detail={selectedDetail}
        isLoading={isDetailLoading}
      />
    </>
  );
};
