/**
 * SheetsInboundSync — Periodically pulls NEW data from Google Sheets
 * (Daily_Reports, Head_Ratings, Departments, Employees) into Supabase.
 *
 * This bridges the gap: employees/heads still submit via Google Apps Script
 * forms, and this worker ensures the full-stack dashboard stays current.
 *
 * Runs every INBOUND_SYNC_INTERVAL_MS (default 3 minutes).
 */

import { env } from '../config/env';
import { prisma } from '../prisma/client';
import { GoogleSheetsClient } from './sheetsClient';
import { dateToDDMMYYYY, getTimeFromDDMMYYYY, parseSafeDate } from '../utils/dateUtils';
import { parseScoreHelper, calculateEmployeeDailyFinalScore, calculatePerformance } from '../utils/scoreEngine';

const INBOUND_SYNC_INTERVAL_MS = parseInt(process.env.INBOUND_SYNC_INTERVAL_MS || '180000', 10); // 3 minutes default
const SYNC_LOOKBACK_DAYS = parseInt(process.env.SYNC_LOOKBACK_DAYS || '7', 10); // Only sync last N days

export class SheetsInboundSync {
  private static timer: NodeJS.Timeout | null = null;
  private static isRunning = false;
  private static lastSyncTime: Date | null = null;

  /**
   * Start periodic inbound sync from Google Sheets → Supabase.
   */
  public static start(): void {
    const client = GoogleSheetsClient.getClient();
    if (!client) {
      console.log('ℹ️ Inbound Sync disabled: No Google Sheets credentials found.');
      return;
    }

    if (this.timer) clearInterval(this.timer);

    console.log(`🔄 Starting Inbound Google Sheets Sync (Interval: ${INBOUND_SYNC_INTERVAL_MS / 1000}s, Lookback: ${SYNC_LOOKBACK_DAYS} days)`);

    // Run immediately on startup after 5 seconds
    setTimeout(() => {
      this.syncAll().catch(err => console.error('❌ Initial inbound sync error:', err));
    }, 5000);

    // Then on interval
    this.timer = setInterval(() => {
      this.syncAll().catch(err => console.error('❌ Inbound sync cycle error:', err));
    }, INBOUND_SYNC_INTERVAL_MS);
  }

  /**
   * Stop periodic sync.
   */
  public static stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      console.log('🛑 Stopped Inbound Google Sheets Sync.');
    }
  }

  /**
   * Get status for the sync badge.
   */
  public static getStatus() {
    return {
      enabled: !!this.timer,
      lastSync: this.lastSyncTime,
      intervalMs: INBOUND_SYNC_INTERVAL_MS,
      isRunning: this.isRunning,
    };
  }

  /**
   * Run a full sync pass: Departments, Employees, Daily Reports, Head Ratings.
   */
  public static async syncAll(): Promise<{
    departments: number;
    employees: number;
    dailyReports: number;
    headRatings: number;
  }> {
    if (this.isRunning) {
      console.log('⏳ Inbound sync already in progress, skipping...');
      return { departments: 0, employees: 0, dailyReports: 0, headRatings: 0 };
    }

    this.isRunning = true;
    const startTime = Date.now();
    let results = { departments: 0, employees: 0, dailyReports: 0, headRatings: 0 };

    try {
      console.log(`\n🔄 [${new Date().toLocaleTimeString()}] Inbound sync started...`);

      // 1. Sync Departments
      results.departments = await this.syncDepartments();

      // 2. Sync Employees
      results.employees = await this.syncEmployees();

      // 3. Sync Daily Reports (only recent)
      results.dailyReports = await this.syncDailyReports();

      // 4. Sync Head Ratings (only recent)
      results.headRatings = await this.syncHeadRatings();

      // 5. Sync Tasks
      const tasksCount = await this.syncTasks();

      this.lastSyncTime = new Date();
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`✅ Inbound sync complete in ${elapsed}s — Depts: ${results.departments}, Emps: ${results.employees}, Reports: ${results.dailyReports}, Ratings: ${results.headRatings}, Tasks: ${tasksCount}`);
    } catch (err) {
      console.error('💥 Inbound sync fatal error:', err);
    } finally {
      this.isRunning = false;
    }

    return results;
  }

  // ─── DEPARTMENTS ──────────────────────────────────────────────

  private static async syncDepartments(): Promise<number> {
    try {
      const rows = await GoogleSheetsClient.getValues(env.MASTER_DB_SPREADSHEET_ID, 'Departments!A:Z');
      if (!rows || rows.length <= 1) return 0;

      const headers = rows[0].map((h: any) => String(h).trim());
      const nameIdx = headers.indexOf('DepartmentName');
      const headIdIdx = headers.indexOf('HeadId');
      const headNameIdx = headers.indexOf('HeadName');
      const parentDeptIdx = headers.indexOf('ParentDepartment');
      const deptIdIdx = headers.indexOf('DepartmentID');

      let count = 0;
      const validDeptRows = rows.slice(1).filter((r: any) => nameIdx !== -1 && r[nameIdx]);
      const deptBatchSize = 5;
      for (let i = 0; i < validDeptRows.length; i += deptBatchSize) {
        const chunk = validDeptRows.slice(i, i + deptBatchSize);
        await Promise.all(chunk.map(async (row: any) => {
          const deptName = String(row[nameIdx]).trim();
          const deptId = (deptIdIdx !== -1 && row[deptIdIdx]) ? String(row[deptIdIdx]).trim() : `DEPT_${deptName.replace(/[^A-Z0-9]/gi, '_').toUpperCase()}`;
          const headId = (headIdIdx !== -1 && row[headIdIdx]) ? String(row[headIdIdx]).trim() : null;
          const headName = (headNameIdx !== -1 && row[headNameIdx]) ? String(row[headNameIdx]).trim() : null;
          const parentDept = (parentDeptIdx !== -1 && row[parentDeptIdx]) ? String(row[parentDeptIdx]).trim() : null;

          try {
            await prisma.department.upsert({
              where: { departmentName: deptName },
              create: { departmentId: deptId, departmentName: deptName, headId, headName, parentDepartment: parentDept },
              update: { departmentId: deptId, headId, headName, parentDepartment: parentDept },
            });
            count++;
          } catch (_) {}
        }));
      }
      return count;
    } catch (err) {
      console.warn('⚠️ Dept sync error:', err);
      return 0;
    }
  }

  // ─── EMPLOYEES ────────────────────────────────────────────────

  private static async syncEmployees(): Promise<number> {
    try {
      const rows = await GoogleSheetsClient.getValues(env.MASTER_DB_SPREADSHEET_ID, 'Employees!A:Z');
      if (!rows || rows.length <= 1) return 0;

      const headers = rows[0].map((h: any) => String(h).trim());
      const empIdIdx = headers.indexOf('EmployeeID');
      const nameIdx = headers.indexOf('Name');
      const deptIdx = headers.indexOf('Department');
      const subDeptIdx = headers.indexOf('Sub_Department') !== -1 ? headers.indexOf('Sub_Department') : headers.indexOf('SubDepartment');
      const statusIdx = headers.indexOf('Status');
      const roleIdx = headers.indexOf('Role');
      const contactIdx = headers.indexOf('Contact');

      let count = 0;
      const validEmpRows = rows.slice(1).filter((r: any) => empIdIdx !== -1 && r[empIdIdx] && nameIdx !== -1 && r[nameIdx]);
      const empBatchSize = 5;
      for (let i = 0; i < validEmpRows.length; i += empBatchSize) {
        const chunk = validEmpRows.slice(i, i + empBatchSize);
        await Promise.all(chunk.map(async (row: any) => {
          const empId = String(row[empIdIdx]).trim();
          const name = String(row[nameIdx]).trim();
          const dept = deptIdx !== -1 && row[deptIdx] ? String(row[deptIdx]).trim() : '';
          const subDept = subDeptIdx !== -1 && row[subDeptIdx] ? String(row[subDeptIdx]).trim() : null;
          const status = statusIdx !== -1 && row[statusIdx] ? String(row[statusIdx]).trim().toLowerCase() : 'active';
          const role = roleIdx !== -1 && row[roleIdx] ? String(row[roleIdx]).trim().toLowerCase() : 'employee';
          const contact = contactIdx !== -1 && row[contactIdx] ? String(row[contactIdx]).trim() : null;

          try {
            await prisma.employee.upsert({
              where: { employeeId: empId },
              create: { employeeId: empId, name, department: dept, subDepartment: subDept, status, role, contact },
              update: { name, department: dept, subDepartment: subDept, status, role, contact },
            });
            count++;
          } catch (_) {}
        }));
      }
      return count;
    } catch (err) {
      console.warn('⚠️ Employee sync error:', err);
      return 0;
    }
  }

  // ─── DAILY REPORTS ────────────────────────────────────────────

  private static async syncDailyReports(): Promise<number> {
    try {
      // Read ALL columns (A:Z) to capture the full dataset from the employee app
      const rows = await GoogleSheetsClient.getValues(env.APP_DB_SPREADSHEET_ID, 'Daily_Reports!A:Z');
      if (!rows || rows.length <= 1) return 0;

      // Calculate cutoff date for lookback window
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - SYNC_LOOKBACK_DAYS);
      const cutoffTimestamp = cutoffDate.getTime();

      // Dynamically map column indices from header row 0 with positional fallbacks
      const headerRow = rows[0] || [];
      const colMap: Record<string, number> = {};
      headerRow.forEach((col: any, idx: number) => {
        if (col && typeof col === 'string') {
          const clean = col.trim().toLowerCase().replace(/[\s_\-%]/g, '');
          colMap[clean] = idx;
        }
      });

      const getColIdx = (names: string[], fallbackIdx: number): number => {
        for (const name of names) {
          const clean = name.trim().toLowerCase().replace(/[\s_\-%]/g, '');
          if (colMap[clean] !== undefined) return colMap[clean];
        }
        return fallbackIdx;
      };

      const dateCol = getColIdx(['Date', 'report_date'], 0);
      const empIdCol = getColIdx(['EmployeeID', 'Employee_ID', 'EmpID'], 1);
      const deptCol = getColIdx(['Department', 'Dept'], 2);
      const bodCol = getColIdx(['BOD_Data', 'bodData', 'BOD'], 3);
      const eodCol = getColIdx(['EOD_Data', 'eodData', 'EOD'], 4);
      const sysScoreCol = getColIdx(['Daily_Score_%', 'DailyScore', 'System_Score', 'Score'], 5);
      const lastUpdatedCol = getColIdx(['Last_Updated', 'lastUpdated', 'Updated_At'], 6);
      const headRatingCol = getColIdx(['Head_Rating', 'headRating', 'Rating'], 7);
      const finalScoreCol = getColIdx(['Final_Score_%', 'finalScore', 'Final_Score'], 8);
      const approvalStatusCol = getColIdx(['Approval_Status', 'approvalStatus', 'Status'], 13);
      const approvalTimestampCol = getColIdx(['Approval_Timestamp', 'approvalTimestamp'], 14);
      const expiryTimestampCol = getColIdx(['Expiry_Timestamp', 'expiryTimestamp'], 15);

      // Collect valid records within lookback window (from newest to oldest)
      const validRecords: any[] = [];
      for (let i = rows.length - 1; i >= 1; i--) {
        const row = rows[i];
        const rawDate = row[dateCol];
        const empId = row[empIdCol] ? String(row[empIdCol]).trim() : '';
        if (!empId || !rawDate) continue;

        const reportDate = dateToDDMMYYYY(rawDate);
        const dateTimestamp = getTimeFromDDMMYYYY(reportDate);

        // Skip old records outside lookback window
        if (dateTimestamp < cutoffTimestamp) continue;

        const dept = row[deptCol] ? String(row[deptCol]).trim() : '';
        const bodStr = row[bodCol];
        const eodStr = row[eodCol];
        const rawSysScore = row[sysScoreCol];
        const rawLastUpdated = row[lastUpdatedCol];
        const rawHeadRating = row[headRatingCol] ? String(row[headRatingCol]).trim() : null;
        const rawFinalScore = row[finalScoreCol];
        const rawApprovalStatus = row[approvalStatusCol] ? String(row[approvalStatusCol]).trim() : null;
        const rawApprovalTimestamp = row[approvalTimestampCol] ? String(row[approvalTimestampCol]).trim() : null;
        const rawExpiryTimestamp = row[expiryTimestampCol] ? String(row[expiryTimestampCol]).trim() : null;

        let bodData: any = {};
        let eodData: any = {};
        try { if (typeof bodStr === 'string' && bodStr.trim().startsWith('{')) bodData = JSON.parse(bodStr); } catch (_) {}
        try { if (typeof eodStr === 'string' && eodStr.trim().startsWith('{')) eodData = JSON.parse(eodStr); } catch (_) {}

        const lastUpdated = parseSafeDate(rawLastUpdated);
        const hoursSinceUpdate = (Date.now() - lastUpdated.getTime()) / (1000 * 60 * 60);

        const hasEodTasks = eodData && typeof eodData === 'object' && Object.keys(eodData).length > 0;
        const hasBodTasks = bodData && typeof bodData === 'object' && Object.keys(bodData).length > 0;

        let sysScore: number | null = null;
        let headRating: string | null = rawHeadRating;
        let approvalStatus: string | null = rawApprovalStatus || null;
        let finalScore: number | null = null;

        if (hasEodTasks) {
          sysScore = parseScoreHelper(rawSysScore);
          if (sysScore === 0) {
            const computed = calculatePerformance(bodData, eodData);
            if (computed > 0) sysScore = computed;
          }

          const isTodayReport = reportDate === dateToDDMMYYYY(new Date());

          if (approvalStatus === 'Auto Approved' || headRating === 'Auto') {
            if (isTodayReport) {
              approvalStatus = 'Pending Review';
              headRating = null;
            } else {
              approvalStatus = 'Auto Approved';
              headRating = '100';
            }
          } else if ((!headRating || headRating === '' || headRating === 'Auto') && approvalStatus !== 'Approved' && hoursSinceUpdate >= 24 && !isTodayReport) {
            approvalStatus = 'Auto Approved';
            headRating = '100';
          }

          if (approvalStatus === 'Auto Approved' || headRating === '100' || headRating === 'Auto') {
            finalScore = sysScore;
          } else if (approvalStatus === 'Approved' || (headRating && headRating !== '')) {
            const parsedRating = headRating ? parseFloat(headRating) : NaN;
            const explicitFinal = rawFinalScore && String(rawFinalScore).trim() !== '' ? parseScoreHelper(rawFinalScore) : 0;
            finalScore = explicitFinal > 0 ? explicitFinal : (!isNaN(parsedRating) ? Math.round((sysScore * parsedRating) / 100) : sysScore);
          } else {
            finalScore = rawFinalScore && String(rawFinalScore).trim() !== '' ? parseScoreHelper(rawFinalScore) : sysScore;
          }
        } else {
          // Incomplete report: No EOD submitted. Do NOT auto-approve with 0%!
          sysScore = null;
          finalScore = null;
          headRating = null;
          const isPastDay = dateTimestamp < Date.now() - 24 * 60 * 60 * 1000;
          if (hasBodTasks) {
            approvalStatus = isPastDay ? 'EOD Missed' : 'Pending EOD';
          } else {
            approvalStatus = 'Not Submitted';
          }
        }

        const headRatingNum = headRating && !isNaN(parseFloat(headRating)) ? parseFloat(headRating) : (headRating === 'Auto' ? 100 : null);
        const lastUpdatedStr = rawLastUpdated ? String(rawLastUpdated).trim() : lastUpdated.toISOString();

        validRecords.push({
          reportDate,
          dateTimestamp,
          empId,
          dept,
          bodData,
          eodData,
          bodStr: typeof bodStr === 'string' ? bodStr : JSON.stringify(bodData),
          eodStr: typeof eodStr === 'string' ? eodStr : JSON.stringify(eodData),
          sysScore,
          headRating,
          headRatingNum,
          finalScore,
          lastUpdated,
          lastUpdatedStr,
          approvalStatus,
          approvalTimestamp: rawApprovalTimestamp,
          expiryTimestamp: rawExpiryTimestamp,
        });
      }

      let count = 0;
      const reportBatchSize = 5;
      for (let i = 0; i < validRecords.length; i += reportBatchSize) {
        const chunk = validRecords.slice(i, i + reportBatchSize);
        await Promise.all(chunk.map(async (rec) => {
          try {
            await prisma.dailyReport.upsert({
              where: { employeeId_reportDate: { employeeId: rec.empId, reportDate: rec.reportDate } },
              create: {
                reportDate: rec.reportDate,
                dateTimestamp: BigInt(rec.dateTimestamp),
                employeeId: rec.empId,
                departmentName: rec.dept,
                bodData: rec.bodData,
                eodData: rec.eodData,
                systemScore: rec.sysScore,
                headRating: rec.headRating || null,
                finalScore: rec.finalScore,
                lastUpdated: rec.lastUpdated,
                // snake_case columns for full parity with employee app & PostgreSQL
                date: rec.reportDate,
                employee_id: rec.empId,
                department: rec.dept,
                bod_data: rec.bodStr,
                eod_data: rec.eodStr,
                system_score: rec.sysScore,
                head_rating: rec.headRatingNum,
                final_score: rec.finalScore,
                last_updated: rec.lastUpdatedStr,
                approval_status: rec.approvalStatus,
                approval_timestamp: rec.approvalTimestamp,
                expiry_timestamp: rec.expiryTimestamp,
              },
              update: {
                departmentName: rec.dept,
                bodData: rec.bodData,
                eodData: rec.eodData,
                systemScore: rec.sysScore,
                headRating: rec.headRating || null,
                finalScore: rec.finalScore,
                lastUpdated: rec.lastUpdated,
                // snake_case columns
                date: rec.reportDate,
                employee_id: rec.empId,
                department: rec.dept,
                bod_data: rec.bodStr,
                eod_data: rec.eodStr,
                system_score: rec.sysScore,
                head_rating: rec.headRatingNum,
                final_score: rec.finalScore,
                last_updated: rec.lastUpdatedStr,
                approval_status: rec.approvalStatus,
                approval_timestamp: rec.approvalTimestamp,
                expiry_timestamp: rec.expiryTimestamp,
              },
            });
            count++;
          } catch (_) {}
        }));
      }

      return count;
    } catch (err) {
      console.warn('⚠️ Daily Reports sync error:', err);
      return 0;
    }
  }

  // ─── HEAD RATINGS ─────────────────────────────────────────────

  private static async syncHeadRatings(): Promise<number> {
    try {
      const rows = await GoogleSheetsClient.getValues(env.APP_DB_SPREADSHEET_ID, 'Head_Ratings!A:G');
      if (!rows || rows.length <= 1) return 0;

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - SYNC_LOOKBACK_DAYS);
      const cutoffTimestamp = cutoffDate.getTime();

      const validRatings: any[] = [];
      for (let i = rows.length - 1; i >= 1; i--) {
        const row = rows[i];
        const rawDate = row[0];
        const dept = row[1] ? String(row[1]).trim() : '';
        if (!dept || !rawDate) continue;

        const ratingDate = dateToDDMMYYYY(rawDate);
        const dateTimestamp = getTimeFromDDMMYYYY(ratingDate);

        // Skip old records outside lookback window
        if (dateTimestamp < cutoffTimestamp) continue;

        const headId = row[2] ? String(row[2]).trim() : null;
        const baseScore = parseScoreHelper(row[3]);
        const adminRating = row[4] ? parseFloat(String(row[4]).replace('%', '').trim()) : 100;
        const finalHeadScore = parseScoreHelper(row[5]) || Math.round(baseScore * adminRating / 100);

        validRatings.push({
          ratingDate,
          dateTimestamp,
          dept,
          headId,
          baseScore,
          adminRating,
          finalHeadScore,
        });
      }

      let count = 0;
      const ratingBatchSize = 5;
      for (let i = 0; i < validRatings.length; i += ratingBatchSize) {
        const chunk = validRatings.slice(i, i + ratingBatchSize);
        await Promise.all(chunk.map(async (item) => {
          try {
            await prisma.headRating.upsert({
              where: { departmentName_ratingDate: { departmentName: item.dept, ratingDate: item.ratingDate } },
              create: {
                ratingDate: item.ratingDate,
                dateTimestamp: BigInt(item.dateTimestamp),
                departmentName: item.dept,
                headId: item.headId,
                baseScore: item.baseScore,
                adminRating: item.adminRating,
                finalHeadScore: item.finalHeadScore,
              },
              update: {
                headId: item.headId,
                baseScore: item.baseScore,
                adminRating: item.adminRating,
                finalHeadScore: item.finalHeadScore,
              },
            });
            count++;
          } catch (_) {}
        }));
      }

      return count;
    } catch (err) {
      console.warn('⚠️ Head Ratings sync error:', err);
      return 0;
    }
  }

  // ─── TASKS ──────────────────────────────────────────────────

  private static async syncTasks(): Promise<number> {
    try {
      const mainRows = await GoogleSheetsClient.getValues(env.APP_DB_SPREADSHEET_ID, 'Tasks_Main!A:Q');
      if (!mainRows || mainRows.length <= 1) return 0;

      let count = 0;
      for (let i = 1; i < mainRows.length; i++) {
        const row = mainRows[i];
        const taskId = row[0] ? String(row[0]).trim() : '';
        if (!taskId) continue;

        const taskName = row[1] ? String(row[1]).trim() : '(No Name)';
        const instructions = row[2] ? String(row[2]) : '';
        const assignToId = row[3] ? String(row[3]).trim() : '';
        const assignToName = row[4] ? String(row[4]).trim() : (assignToId || 'Unassigned');
        const department = row[5] ? String(row[5]).trim() : '';
        const assignedBy = row[6] ? String(row[6]).trim() : 'Branch Head';
        const priority = row[7] ? String(row[7]).trim() : 'Medium';
        const deadline = row[8] ? String(row[8]).trim() : null;
        const status = row[9] ? String(row[9]).trim() : 'Open';
        const progress = parseInt(row[10] || 0, 10) || 0;
        const createdAt = parseSafeDate(row[11]);
        const completedAt = row[12] ? parseSafeDate(row[12]) : null;
        const rating = row[13] ? parseInt(row[13], 10) : null;
        const ratingRemark = row[14] ? String(row[14]) : null;
        const mode = row[15] ? String(row[15]).trim() : 'Checklist';
        const lastUpdated = parseSafeDate(row[16]);

        try {
          await prisma.taskMain.upsert({
            where: { taskId },
            create: {
              taskId,
              taskName,
              instructions,
              assignToId,
              assignToName,
              department,
              assignedBy,
              priority,
              deadline,
              status,
              progress,
              createdAt: isNaN(createdAt.getTime()) ? new Date() : createdAt,
              completedAt: completedAt && !isNaN(completedAt.getTime()) ? completedAt : null,
              rating: !isNaN(Number(rating)) ? Number(rating) : null,
              ratingRemark,
              mode,
              lastUpdated: isNaN(lastUpdated.getTime()) ? new Date() : lastUpdated,
            },
            update: {
              taskName,
              instructions,
              assignToId,
              assignToName,
              department,
              assignedBy,
              priority,
              deadline,
              status,
              progress,
              completedAt: completedAt && !isNaN(completedAt.getTime()) ? completedAt : null,
              rating: !isNaN(Number(rating)) ? Number(rating) : null,
              ratingRemark,
              mode,
              lastUpdated: isNaN(lastUpdated.getTime()) ? new Date() : lastUpdated,
            },
          });
          count++;
        } catch (_) {}
      }

      // Sync Subtasks
      try {
        const subRows = await GoogleSheetsClient.getValues(env.APP_DB_SPREADSHEET_ID, 'Tasks_Sub!A:F');
        if (subRows && subRows.length > 1) {
          for (let i = 1; i < subRows.length; i++) {
            const row = subRows[i];
            const subTaskId = row[0] ? String(row[0]).trim() : '';
            const taskId = row[1] ? String(row[1]).trim() : '';
            if (!subTaskId || !taskId) continue;

            const subTaskName = row[2] ? String(row[2]).trim() : '';
            const orderNo = parseInt(row[3] || 1, 10) || 1;
            const status = row[4] ? String(row[4]).trim() : 'Open';
            const createdAt = parseSafeDate(row[5]);

            try {
              await prisma.taskSub.upsert({
                where: { subTaskId },
                create: {
                  subTaskId,
                  taskId,
                  subTaskName,
                  orderNo,
                  status,
                  createdAt,
                },
                update: {
                  subTaskName,
                  orderNo,
                  status,
                },
              });
            } catch (_) {}
          }
        }
      } catch (_) {}

      // Sync Checklist Items
      try {
        const itemRows = await GoogleSheetsClient.getValues(env.APP_DB_SPREADSHEET_ID, 'Tasks_Checklist!A:G');
        if (itemRows && itemRows.length > 1) {
          for (let i = 1; i < itemRows.length; i++) {
            const row = itemRows[i];
            const itemId = row[0] ? String(row[0]).trim() : '';
            const taskId = row[1] ? String(row[1]).trim() : '';
            if (!itemId || !taskId) continue;

            const subTaskId = row[2] ? String(row[2]).trim() : null;
            const itemText = row[3] ? String(row[3]) : '';
            const isDone = String(row[4] || '').trim().toUpperCase() === 'TRUE';
            const doneAt = row[5] ? parseSafeDate(row[5]) : null;
            const doneBy = row[6] ? String(row[6]).trim() : null;

            try {
              await prisma.taskChecklist.upsert({
                where: { itemId },
                create: {
                  itemId,
                  taskId,
                  subTaskId: subTaskId || null,
                  itemText,
                  isDone,
                  doneAt,
                  doneBy,
                },
                update: {
                  itemText,
                  isDone,
                  doneAt,
                  doneBy,
                },
              });
            } catch (_) {}
          }
        }
      } catch (_) {}

      // Sync Attachments
      try {
        const attRows = await GoogleSheetsClient.getValues(env.APP_DB_SPREADSHEET_ID, 'Tasks_Attachments!A:F');
        if (attRows && attRows.length > 1) {
          for (let i = 1; i < attRows.length; i++) {
            const row = attRows[i];
            const attachId = row[0] ? String(row[0]).trim() : '';
            const taskId = row[1] ? String(row[1]).trim() : '';
            if (!attachId || !taskId) continue;

            const fileName = row[2] ? String(row[2]) : '';
            const url = row[3] ? String(row[3]) : '';
            const type = row[4] ? String(row[4]) : 'file';
            const addedAt = parseSafeDate(row[5]);

            try {
              await prisma.taskAttachment.upsert({
                where: { attachId },
                create: {
                  attachId,
                  taskId,
                  fileName,
                  url,
                  type,
                  addedAt,
                },
                update: {
                  fileName,
                  url,
                  type,
                },
              });
            } catch (_) {}
          }
        }
      } catch (_) {}

      // Sync Remarks
      try {
        const remRows = await GoogleSheetsClient.getValues(env.APP_DB_SPREADSHEET_ID, 'Tasks_Remarks!A:E');
        if (remRows && remRows.length > 1) {
          for (let i = 1; i < remRows.length; i++) {
            const row = remRows[i];
            const remarkId = row[0] ? String(row[0]).trim() : '';
            const taskId = row[1] ? String(row[1]).trim() : '';
            if (!remarkId || !taskId) continue;

            const remark = row[2] ? String(row[2]) : '';
            const addedBy = row[3] ? String(row[3]) : 'Branch Head';
            const addedAt = parseSafeDate(row[4]);

            try {
              await prisma.taskRemark.upsert({
                where: { remarkId },
                create: {
                  remarkId,
                  taskId,
                  remark,
                  addedBy,
                  addedAt,
                },
                update: {
                  remark,
                  addedBy,
                },
              });
            } catch (_) {}
          }
        }
      } catch (_) {}

      return count;
    } catch (err) {
      console.warn('⚠️ Tasks sync error:', err);
      return 0;
    }
  }
}

