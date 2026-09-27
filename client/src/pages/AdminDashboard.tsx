import React, { useState, useEffect } from 'react';
import { DashboardData, FilterParams } from '../types/admin';
import { fetchAdminDashboard, triggerInboundSync } from '../api/admin';
import { DashboardControls } from '../components/DashboardControls';
import { OrganizationScoreCard } from '../components/OrganizationScoreCard';
import { Leaderboards } from '../components/Leaderboards';
import { DepartmentGrid } from '../components/DepartmentGrid';
import { DepartmentScrutinyModal } from '../components/DepartmentScrutinyModal';
import { SubmissionTrackerModal } from '../components/SubmissionTrackerModal';
import { TaskManagerModal } from '../components/TaskManagerModal';
import { exportDashboardToPDF } from '../utils/pdfExport';

export const AdminDashboard: React.FC = () => {
  const [filter, setFilter] = useState<FilterParams>({ type: 'Weekly' });
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Scrutiny Modal state
  const [scrutinyDept, setScrutinyDept] = useState<string | null>(null);
  const [scrutinyHeadId, setScrutinyHeadId] = useState<string | null>(null);

  // New Modals state (eod and bod head parity)
  const [isTrackerOpen, setIsTrackerOpen] = useState(false);
  const [isTaskManagerOpen, setIsTaskManagerOpen] = useState(false);

  const loadData = async (currentFilter: FilterParams = filter) => {
    try {
      setIsLoading(true);
      const res = await fetchAdminDashboard(currentFilter);
      if (res.success) {
        setData(res.data);
      }
    } catch (err: any) {
      console.error('Failed to fetch dashboard metrics:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData(filter);

    // Live auto-polling: refresh dashboard data every 30 seconds automatically
    const pollInterval = setInterval(() => {
      loadData(filter);
    }, 30000);

    return () => clearInterval(pollInterval);
  }, [filter]);

  const handleFilterChange = (newFilter: FilterParams) => {
    setFilter(newFilter);
  };

  const handleRefresh = async () => {
    try {
      setIsLoading(true);
      // Trigger background sync pass from Google Sheets
      await triggerInboundSync().catch(() => {});
    } finally {
      await loadData(filter);
    }
  };

  const handleDownloadPDF = () => {
    exportDashboardToPDF('pdf-export-area', filter.type);
  };

  const handleOpenScrutiny = (deptName: string, headId: string | null) => {
    setScrutinyDept(deptName);
    setScrutinyHeadId(headId);
  };

  const handleCloseScrutiny = () => {
    setScrutinyDept(null);
    setScrutinyHeadId(null);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* 1. TOP DASHBOARD CONTROLS */}
      <DashboardControls
        currentFilter={filter}
        onFilterChange={handleFilterChange}
        onRefresh={handleRefresh}
        onDownloadPDF={handleDownloadPDF}
        onOpenTracker={() => setIsTrackerOpen(true)}
        onOpenTaskManager={() => setIsTaskManagerOpen(true)}
        isLoading={isLoading}
      />

      {/* 2. PDF EXPORT AREA (Contains main visual cards) */}
      <div id="pdf-export-area" className="space-y-6">
        {/* Overall Organization Performance */}
        <OrganizationScoreCard
          score={data ? data.orgAverage : 0}
          isLoading={isLoading}
        />

        {/* 4 Leaderboards (Top/Bottom Employees & Top/Bottom Heads) */}
        <Leaderboards
          topEmps={data ? data.topEmps : []}
          bottomEmps={data ? data.bottomEmps : []}
          topHeads={data ? data.topHeads : []}
          bottomHeads={data ? data.bottomHeads : []}
          isLoading={isLoading}
        />

        {/* Department & Head Analytics Grid */}
        <DepartmentGrid
          departments={data ? data.departments : []}
          onSelectDepartment={handleOpenScrutiny}
          isLoading={isLoading}
        />
      </div>

      {/* 3. DEPARTMENT DRILL-DOWN SCRUTINY MODAL */}
      {scrutinyDept && (
        <DepartmentScrutinyModal
          isOpen={!!scrutinyDept}
          onClose={handleCloseScrutiny}
          departmentName={scrutinyDept}
          headId={scrutinyHeadId}
          currentFilter={filter}
          onRatingSaved={handleRefresh}
        />
      )}

      {/* 4. BOD/EOD SUBMISSION TRACKER MODAL */}
      <SubmissionTrackerModal
        isOpen={isTrackerOpen}
        onClose={() => setIsTrackerOpen(false)}
      />

      {/* 5. TASK MANAGER & CHECKLISTS MODAL */}
      <TaskManagerModal
        isOpen={isTaskManagerOpen}
        onClose={() => setIsTaskManagerOpen(false)}
      />
    </div>
  );
};
