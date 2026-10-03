import { prisma } from '../prisma/client';
import { calculateDateRange, DateFilter } from '../utils/dateUtils';
import {
  parseScoreHelper,
  calculateEmployeeDailyFinalScore,
  calculateDateBaseAverage,
  calculateOrganizationAverage,
} from '../utils/scoreEngine';

export interface DashboardResponseData {
  orgAverage: number;
  departments: Array<{
    department: string;
    headName: string | null;
    headId: string | null;
    score: number;
    hasData: boolean;
  }>;
  topEmps: Array<{
    empId: string;
    name: string;
    dept: string;
    score: number;
  }>;
  bottomEmps: Array<{
    empId: string;
    name: string;
    dept: string;
    score: number;
  }>;
  topHeads: Array<{
    department: string;
    headName: string | null;
    headId: string | null;
    score: number;
    hasData: boolean;
  }>;
  bottomHeads: Array<{
    department: string;
    headName: string | null;
    headId: string | null;
    score: number;
    hasData: boolean;
  }>;
}

export class DashboardService {
  public static async getAdminDashboard(filter: DateFilter): Promise<DashboardResponseData> {
    const { startTime, endTime } = calculateDateRange(filter);

    // 1. Fetch all departments
    const departments = await prisma.department.findMany({
      orderBy: { departmentName: 'asc' },
    });

    // 2. Fetch all active employees
    const activeEmployees = await prisma.employee.findMany({
      where: { status: { equals: 'active', mode: 'insensitive' } },
    });

    const empDirectory = new Map<string, { name: string; dept: string }>();
    for (const emp of activeEmployees) {
      empDirectory.set(emp.employeeId.trim(), {
        name: emp.name,
        dept: emp.department,
      });
    }

    // Build array of DD/MM/YYYY dates within [startTime, endTime] for robust date matching
    const datesInRange: string[] = [];
    let curD = new Date(startTime);
    const maxD = new Date(endTime);
    while (curD <= maxD) {
      const dd = String(curD.getDate()).padStart(2, '0');
      const mm = String(curD.getMonth() + 1).padStart(2, '0');
      const yyyy = curD.getFullYear();
      datesInRange.push(`${dd}/${mm}/${yyyy}`);
      curD.setDate(curD.getDate() + 1);
    }

    // 3. Fetch Daily Reports in the date range with submitted EOD
    const dailyReports = await prisma.dailyReport.findMany({
      where: {
        OR: [
          {
            dateTimestamp: {
              gte: BigInt(startTime),
              lte: BigInt(endTime),
            },
          },
          {
            reportDate: { in: datesInRange },
          },
          {
            date: { in: datesInRange },
          },
        ],
      },
    });

    // 4. Fetch Head Ratings in the date range
    const headRatings = await prisma.headRating.findMany({
      where: {
        OR: [
          {
            dateTimestamp: {
              gte: BigInt(startTime),
              lte: BigInt(endTime),
            },
          },
          {
            ratingDate: { in: datesInRange },
          },
        ],
      },
    });

    const headRatingsMap = new Map<string, { rating: number; final: number }>();
    for (const hr of headRatings) {
      const key = `${hr.ratingDate}_${hr.departmentName}`;
      headRatingsMap.set(key, {
        rating: hr.adminRating,
        final: Math.round(hr.finalHeadScore),
      });
    }

    // 5. Structure Department buckets
    const deptMap = new Map<
      string,
      {
        headId: string | null;
        headName: string | null;
        dailyAvgs: Map<string, number[]>;
      }
    >();

    for (const dept of departments) {
      deptMap.set(dept.departmentName, {
        headId: dept.headId || null,
        headName: dept.headName || null,
        dailyAvgs: new Map<string, number[]>(),
      });
    }

    // 6. Aggregate report scores per employee and per department
    const employeeScoresMap = new Map<string, number[]>();
    const allOrgScores: number[] = [];

    for (const report of dailyReports) {
      // Must have EOD data
      const eodRaw = report.eodData || report.eod_data;
      const hasEOD =
        eodRaw &&
        (typeof eodRaw === 'string'
          ? eodRaw.trim() !== '' && eodRaw !== '{}'
          : Object.keys(eodRaw as object).length > 0);

      if (!hasEOD) continue;

      let bodObj = report.bodData || report.bod_data;
      if (typeof bodObj === 'string') {
        try { bodObj = JSON.parse(bodObj); } catch (_) {}
      }
      let eodObj = report.eodData || report.eod_data;
      if (typeof eodObj === 'string') {
        try { eodObj = JSON.parse(eodObj); } catch (_) {}
      }

      // Fallback head rating resolution
      let effectiveHeadRating = report.headRating;
      if (!effectiveHeadRating || effectiveHeadRating.trim() === '') {
        if (report.head_rating !== null && report.head_rating !== undefined && String(report.head_rating).trim() !== '') {
          effectiveHeadRating = String(report.head_rating).trim();
        } else if (report.approval_status === 'Auto Approved' || report.approval_status === 'Auto Approved (24h)' || (typeof report.approval_status === 'string' && report.approval_status.startsWith('Auto Approved'))) {
          effectiveHeadRating = '100';
        } else if (report.approval_status === 'Approved') {
          effectiveHeadRating = '100';
        }
      }

      const { finalScore } = calculateEmployeeDailyFinalScore(
        report.systemScore ?? report.system_score,
        effectiveHeadRating,
        report.finalScore ?? report.final_score,
        report.lastUpdated ?? report.last_updated,
        bodObj,
        eodObj,
        report.approval_status
      );

      allOrgScores.push(finalScore);

      // Employee level scores
      const empIdTrimmed = (report.employeeId || report.employee_id || '').trim();
      if (!employeeScoresMap.has(empIdTrimmed)) {
        employeeScoresMap.set(empIdTrimmed, []);
      }
      employeeScoresMap.get(empIdTrimmed)!.push(finalScore);

      // Department level daily scores
      const deptName = report.departmentName || report.department || '';
      const repDate = report.reportDate || report.date || '';
      const deptObj = deptMap.get(deptName);
      if (deptObj && repDate) {
        if (!deptObj.dailyAvgs.has(repDate)) {
          deptObj.dailyAvgs.set(repDate, []);
        }
        deptObj.dailyAvgs.get(repDate)!.push(finalScore);
      }
    }

    // 7. Calculate overall organization average
    const orgAverage = calculateOrganizationAverage(allOrgScores);

    // 8. Compute employee leaderboard (Top & Bottom)
    const employeeAggregates: Array<{
      empId: string;
      name: string;
      dept: string;
      score: number;
    }> = [];

    for (const [empId, scores] of employeeScoresMap.entries()) {
      if (empDirectory.has(empId)) {
        const empInfo = empDirectory.get(empId)!;
        const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
        employeeAggregates.push({
          empId,
          name: empInfo.name,
          dept: empInfo.dept,
          score: avg,
        });
      }
    }

    // Sort employees by score descending
    employeeAggregates.sort((a, b) => b.score - a.score);

    const topEmps = employeeAggregates.slice(0, 5);
    const bottomEmps = employeeAggregates.slice(-5).reverse();

    // 9. Compute Department & Head averages
    const deptAveragesList: Array<{
      department: string;
      headName: string | null;
      headId: string | null;
      score: number;
      hasData: boolean;
    }> = [];

    for (const [dName, deptObj] of deptMap.entries()) {
      let dBaseCount = 0;
      let dFinalTotal = 0;

      for (const [dateStr, dateScores] of deptObj.dailyAvgs.entries()) {
        const baseDateAvg = calculateDateBaseAverage(dateScores);
        dBaseCount++;

        const key = `${dateStr}_${dName}`;
        let finalDateAvg = baseDateAvg;

        if (headRatingsMap.has(key)) {
          const hrEntry = headRatingsMap.get(key)!;
          finalDateAvg = hrEntry.final;
        }

        dFinalTotal += finalDateAvg;
      }

      const finalDeptAvg = dBaseCount > 0 ? Math.round(dFinalTotal / dBaseCount) : 0;

      deptAveragesList.push({
        department: dName,
        headName: deptObj.headName,
        headId: deptObj.headId,
        score: finalDeptAvg,
        hasData: dBaseCount > 0,
      });
    }

    // Sort Heads with data
    const activeHeads = deptAveragesList
      .filter((d) => d.hasData)
      .sort((a, b) => b.score - a.score);

    const topHeads = activeHeads.slice(0, 3);
    const bottomHeads = activeHeads.slice(-3).reverse();

    // Sort all departments (active with data first, then inactive)
    deptAveragesList.sort((a, b) => {
      if (a.hasData && !b.hasData) return -1;
      if (!a.hasData && b.hasData) return 1;
      return b.score - a.score;
    });

    return {
      orgAverage,
      departments: deptAveragesList,
      topEmps,
      bottomEmps,
      topHeads,
      bottomHeads,
    };
  }
}
