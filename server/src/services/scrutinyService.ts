import { prisma } from '../prisma/client';
import { calculateDateRange, DateFilter, getTimeFromDDMMYYYY } from '../utils/dateUtils';
import {
  calculateEmployeeDailyFinalScore,
  calculateDateBaseAverage,
  calculateSuperAdminFinalScore,
} from '../utils/scoreEngine';

export interface ScrutinyRecord {
  empId: string;
  empName: string;
  sysScore: number;
  headRating: string;
  finalScore: number;
  bodData: any;
  eodData: any;
}

export interface DepartmentScrutinyDateGroup {
  date: string;
  timeVal: number;
  baseAvg: number;
  adminRating: number | string;
  finalScore: number;
  records: ScrutinyRecord[];
}

export class ScrutinyService {
  public static async getDepartmentScrutiny(
    deptName: string,
    filter: DateFilter
  ): Promise<DepartmentScrutinyDateGroup[]> {
    const { startTime, endTime } = calculateDateRange(filter);

    // 1. Employee Directory (authoritative names)
    const employees = await prisma.employee.findMany();
    const empMap = new Map<string, { name: string; department: string; subDepartment: string | null }>();
    for (const emp of employees) {
      empMap.set(emp.employeeId.trim(), {
        name: emp.name,
        department: emp.department,
        subDepartment: emp.subDepartment || null,
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

    // 2. Head Ratings for this department
    const headRatings = await prisma.headRating.findMany({
      where: {
        departmentName: deptName,
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

    const headRatingsByDate = new Map<string, number>();
    for (const hr of headRatings) {
      headRatingsByDate.set(hr.ratingDate, hr.adminRating);
    }

    // 3. Daily Reports for this department in range
    const dailyReports = await prisma.dailyReport.findMany({
      where: {
        OR: [
          { departmentName: deptName },
          { department: deptName },
        ],
        AND: [
          {
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
        ],
      },
      orderBy: { dateTimestamp: 'desc' },
    });

    // 4. Group by Date
    const dailyAgg = new Map<
      string,
      {
        records: ScrutinyRecord[];
        adminRating: number | string;
      }
    >();

    for (const r of dailyReports) {
      // Must have EOD data
      const eodRaw = r.eodData || r.eod_data;
      const hasEOD =
        eodRaw &&
        (typeof eodRaw === 'string'
          ? eodRaw.trim() !== '' && eodRaw !== '{}'
          : Object.keys(eodRaw as object).length > 0);

      if (!hasEOD) continue;

      const dateStr = r.reportDate || r.date || '';
      if (!dateStr) continue;

      if (!dailyAgg.has(dateStr)) {
        const rating = headRatingsByDate.has(dateStr) ? headRatingsByDate.get(dateStr)! : '';
        dailyAgg.set(dateStr, {
          records: [],
          adminRating: rating,
        });
      }

      let bodObj = r.bodData || r.bod_data;
      if (typeof bodObj === 'string') {
        try { bodObj = JSON.parse(bodObj); } catch (_) {}
      }
      let eodObj = r.eodData || r.eod_data;
      if (typeof eodObj === 'string') {
        try { eodObj = JSON.parse(eodObj); } catch (_) {}
      }

      // Fallback head rating resolution
      let effectiveHeadRating = r.headRating;
      if (!effectiveHeadRating || effectiveHeadRating.trim() === '') {
        if (r.head_rating !== null && r.head_rating !== undefined && String(r.head_rating).trim() !== '') {
          effectiveHeadRating = String(r.head_rating).trim();
        } else if (r.approval_status === 'Auto Approved' || r.approval_status === 'Auto Approved (24h)' || (typeof r.approval_status === 'string' && r.approval_status.startsWith('Auto Approved'))) {
          effectiveHeadRating = '100';
        } else if (r.approval_status === 'Approved') {
          effectiveHeadRating = '100';
        }
      }

      const { sysScore, finalScore, isAutoApproved } = calculateEmployeeDailyFinalScore(
        r.systemScore ?? r.system_score,
        effectiveHeadRating,
        r.finalScore ?? r.final_score,
        r.lastUpdated ?? r.last_updated,
        bodObj,
        eodObj,
        r.approval_status
      );

      const empIdTrimmed = (r.employeeId || r.employee_id || '').trim();
      const empInfo = empMap.get(empIdTrimmed);

      const displayHeadRating =
        effectiveHeadRating && effectiveHeadRating !== ''
          ? effectiveHeadRating
          : isAutoApproved
          ? 'Auto'
          : (r.approval_status === 'Approved' ? '100' : 'Pending');

      dailyAgg.get(dateStr)!.records.push({
        empId: empIdTrimmed,
        empName: empInfo?.name || 'Name Not Found',
        sysScore,
        headRating: displayHeadRating,
        finalScore,
        bodData: bodObj,
        eodData: eodObj,
      });
    }

    // 5. Build final date group cards
    const finalDates: DepartmentScrutinyDateGroup[] = [];

    for (const [dateStr, group] of dailyAgg.entries()) {
      const recs = group.records;
      const baseAvg = calculateDateBaseAverage(recs.map((r) => r.finalScore));
      const calculatedFinal =
        group.adminRating !== ''
          ? calculateSuperAdminFinalScore(baseAvg, group.adminRating)
          : baseAvg;

      finalDates.push({
        date: dateStr,
        timeVal: getTimeFromDDMMYYYY(dateStr),
        baseAvg,
        adminRating: group.adminRating,
        finalScore: calculatedFinal,
        records: recs,
      });
    }

    // Sort newest date first
    finalDates.sort((a, b) => b.timeVal - a.timeVal);

    return finalDates;
  }
}
