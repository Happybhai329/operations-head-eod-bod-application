import { prisma } from '../prisma/client';
import { parseDateDDMMYYYY, getTimeFromDDMMYYYY, parseSafeDate } from '../utils/dateUtils';

export interface TrackerFilter {
  start: string; // 'YYYY-MM-DD' or 'DD/MM/YYYY'
  end: string;   // 'YYYY-MM-DD' or 'DD/MM/YYYY'
  dept?: string; // 'All' or specific department
}

export interface TrackerRecord {
  date: string;
  dateTime: number;
  empId: string;
  empName: string;
  dept: string;
  bod: boolean;
  eod: boolean;
  status: 'Both' | 'BOD Only' | 'EOD Only (Missing BOD)' | 'Not Submitted';
  systemScore: number | null;
  headRating: string | null;
  finalScore: number | null;
  approvalStatus: 'Approved' | 'Auto Approved' | 'Pending Review' | 'Pending EOD' | 'EOD Missed' | 'Not Submitted' | string;
  headName: string | null;
  lastUpdated: string | null;
}

export interface TrackerSummary {
  totalRecords: number;
  uniqueEmployees: number;
  bodDone: number;
  bodPending: number;
  eodDone: number;
  eodPending: number;
  bothDone: number;
  bodOnly: number;
  eodOnly: number;
  none: number;
  headRated: number;
  autoApproved: number;
  pendingReview: number;
  eodMissed: number;
  pendingEOD: number;
}

export interface DateSummary {
  date: string;
  total: number;
  bodDone: number;
  bodPending: number;
  eodDone: number;
  eodPending: number;
  bothDone: number;
  bodOnly: number;
  eodOnly: number;
  none: number;
}

export interface DeptSummary {
  dept: string;
  total: number;
  bodDone: number;
  bodPending: number;
  eodDone: number;
  eodPending: number;
  bothDone: number;
  bodOnly: number;
  eodOnly: number;
  none: number;
}

function parseDateInput(val: string): Date | null {
  if (!val) return null;
  val = val.trim();
  if (val.includes('-')) {
    const parts = val.split('-');
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        // YYYY-MM-DD
        return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      } else {
        // DD-MM-YYYY
        return new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
      }
    }
  }
  if (val.includes('/')) {
    const parts = val.split('/');
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        // YYYY/MM/DD
        return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      } else {
        // DD/MM/YYYY
        return new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
      }
    }
  }
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

function getUtcMidnight(d: Date): number {
  return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
}

export class TrackerService {
  public static async fetchSubmissionTracker(filter: TrackerFilter) {
    const startD = parseDateInput(filter.start);
    const endD = parseDateInput(filter.end);

    if (!startD || !endD) {
      throw new Error('Invalid date range selected.');
    }

    startD.setHours(0, 0, 0, 0);
    endD.setHours(23, 59, 59, 999);

    if (endD.getTime() < startD.getTime()) {
      throw new Error('End date cannot be before start date.');
    }

    const dayMs = 86400000;
    const startK = getUtcMidnight(startD);
    const endK = getUtcMidnight(endD);
    const dayCount = Math.round((endK - startK) / dayMs) + 1;

    if (dayCount > 92) {
      throw new Error('Date range is too large. Please keep it within 92 days for smooth loading.');
    }

    // 1. Get all active employees
    const employees = await prisma.employee.findMany({
      where: {
        status: { equals: 'active', mode: 'insensitive' },
      },
      orderBy: { name: 'asc' },
    });

    const empList = employees.map(e => ({
      id: e.employeeId.trim(),
      name: e.name.trim(),
      dept: e.department.trim(),
    }));

    const empById = new Map<string, { name: string; dept: string }>();
    empList.forEach(e => empById.set(e.id, { name: e.name, dept: e.dept }));

    // Fetch department heads mapping
    const departmentsList = await prisma.department.findMany();
    const deptHeadMap = new Map<string, string>();
    departmentsList.forEach(d => {
      if (d.headName) {
        deptHeadMap.set(d.departmentName.trim().toUpperCase(), d.headName.trim());
      }
    });

    // Build array of DD/MM/YYYY dates within [startD, endD] for robust date matching
    const datesInRange: string[] = [];
    let curD = new Date(startD);
    const maxD = new Date(endD);
    while (curD <= maxD) {
      const dd = String(curD.getDate()).padStart(2, '0');
      const mm = String(curD.getMonth() + 1).padStart(2, '0');
      const yyyy = curD.getFullYear();
      datesInRange.push(`${dd}/${mm}/${yyyy}`);
      curD.setDate(curD.getDate() + 1);
    }

    // 2. Fetch all daily reports within timestamp range or dates from Supabase
    const startEpoch = BigInt(startD.getTime());
    const endEpoch = BigInt(endD.getTime());

    const reports = await prisma.dailyReport.findMany({
      where: {
        OR: [
          {
            dateTimestamp: {
              gte: startEpoch,
              lte: endEpoch,
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

    // 3. Build submission map: dayKey -> { empId -> details }
    const submissionMap = new Map<number, Map<string, {
      bod: boolean;
      eod: boolean;
      dept: string;
      systemScore: number | null;
      headRating: string | null;
      finalScore: number | null;
      approvalStatus: string;
      lastUpdated: string | null;
    }>>();
    const departmentSet = new Set<string>();
    empList.forEach(e => departmentSet.add(e.dept));

    for (const r of reports) {
      const reportDateStr = r.reportDate || r.date || '';
      const d = parseDateDDMMYYYY(reportDateStr);
      if (isNaN(d.getTime())) continue;
      const dk = getUtcMidnight(d);

      if (dk < startK || dk > endK) continue;

      const empId = (r.employeeId || r.employee_id || '').trim();
      const dept = (r.departmentName || r.department || '').trim();
      if (dept) departmentSet.add(dept);

      const bodData = r.bodData || (r as any).bod_data;
      const eodData = r.eodData || (r as any).eod_data;

      const bodFilled = !!(
        bodData &&
        (typeof bodData === 'string'
          ? bodData.trim() !== '' && bodData !== '{}'
          : Object.keys(bodData as object).length > 0)
      );

      const eodFilled = !!(
        eodData &&
        (typeof eodData === 'string'
          ? eodData.trim() !== '' && eodData !== '{}'
          : Object.keys(eodData as object).length > 0)
      );

      let rawHeadRating: string | null = (r.headRating !== null && r.headRating !== undefined ? String(r.headRating).trim() : null) || (r.head_rating !== null && r.head_rating !== undefined ? String(r.head_rating).trim() : null);
      let rawSysScore = r.systemScore ?? r.system_score ?? null;
      let rawFinalScore = r.finalScore ?? r.final_score ?? null;
      let rawApprovalStatus = r.approval_status ? String(r.approval_status).trim() : null;

      const safeLastUpdated = parseSafeDate(r.lastUpdated || r.last_updated);
      const hoursSinceUpdate = (Date.now() - safeLastUpdated.getTime()) / (1000 * 60 * 60);

      let effectiveApprovalStatus: string = 'Not Submitted';
      let effectiveHeadRating: string | null = rawHeadRating;
      let effectiveFinalScore: number | null = rawFinalScore;

      const isToday = dk >= getUtcMidnight(new Date());
      const isAutoStatus = rawApprovalStatus === 'Auto Approved' ||
                           rawApprovalStatus === 'Auto Approved (24h)' ||
                           (typeof rawApprovalStatus === 'string' && rawApprovalStatus.startsWith('Auto Approved'));

      if (eodFilled) {
        if (!isToday && isAutoStatus) {
          effectiveApprovalStatus = 'Auto Approved';
          effectiveHeadRating = '100';
          effectiveFinalScore = rawSysScore;
        } else if (rawApprovalStatus === 'Approved' || (!isAutoStatus && rawHeadRating && rawHeadRating !== '' && rawHeadRating !== 'Auto')) {
          effectiveApprovalStatus = 'Approved';
          effectiveHeadRating = rawHeadRating || '100';
          effectiveFinalScore = rawFinalScore ?? (rawSysScore !== null && !isNaN(parseFloat(effectiveHeadRating))
            ? Math.round((rawSysScore * parseFloat(effectiveHeadRating)) / 100)
            : rawSysScore);
        } else if (!isToday && (rawHeadRating === 'Auto' || hoursSinceUpdate >= 24)) {
          effectiveApprovalStatus = 'Auto Approved';
          effectiveHeadRating = '100';
          effectiveFinalScore = rawSysScore;
        } else {
          effectiveApprovalStatus = 'Pending Review';
          effectiveHeadRating = null;
        }
      } else {
        if (bodFilled) {
          effectiveApprovalStatus = (rawApprovalStatus === 'Pending EOD' || rawApprovalStatus === 'EOD Missed')
            ? rawApprovalStatus
            : (dk < getUtcMidnight(new Date()) ? 'EOD Missed' : 'Pending EOD');
        } else {
          effectiveApprovalStatus = 'Not Submitted';
        }
        effectiveHeadRating = null;
        effectiveFinalScore = null;
      }

      if (!submissionMap.has(dk)) {
        submissionMap.set(dk, new Map());
      }
      submissionMap.get(dk)!.set(empId, {
        bod: bodFilled,
        eod: eodFilled,
        dept,
        systemScore: rawSysScore,
        headRating: effectiveHeadRating,
        finalScore: effectiveFinalScore,
        approvalStatus: effectiveApprovalStatus,
        lastUpdated: r.lastUpdated ? String(r.lastUpdated) : ((r as any).last_updated ? String((r as any).last_updated) : null),
      });

      if (empId && !empById.has(empId)) {
        empList.push({ id: empId, name: 'Name Not Found', dept });
        empById.set(empId, { name: 'Name Not Found', dept });
      }
    }

    const departments = Array.from(departmentSet).sort();
    const deptFilter = filter.dept && filter.dept !== 'All' ? filter.dept.trim() : null;

    // 4. Iterate each day for each employee
    const records: TrackerRecord[] = [];
    const summary: TrackerSummary = {
      totalRecords: 0,
      uniqueEmployees: 0,
      bodDone: 0,
      bodPending: 0,
      eodDone: 0,
      eodPending: 0,
      bothDone: 0,
      bodOnly: 0,
      eodOnly: 0,
      none: 0,
      headRated: 0,
      autoApproved: 0,
      pendingReview: 0,
      eodMissed: 0,
      pendingEOD: 0,
    };

    const dateSummaryMap = new Map<string, DateSummary>();
    const deptSummaryMap = new Map<string, DeptSummary>();
    const uniqueEmpSet = new Set<string>();

    for (let t = startK; t <= endK; t += dayMs) {
      const d = new Date(t);
      const dStr = ('0' + d.getUTCDate()).slice(-2) + '/' + ('0' + (d.getUTCMonth() + 1)).slice(-2) + '/' + d.getUTCFullYear();
      const daySubs = submissionMap.get(t);

      if (!dateSummaryMap.has(dStr)) {
        dateSummaryMap.set(dStr, {
          date: dStr,
          total: 0,
          bodDone: 0,
          bodPending: 0,
          eodDone: 0,
          eodPending: 0,
          bothDone: 0,
          bodOnly: 0,
          eodOnly: 0,
          none: 0,
        });
      }

      for (const emp of empList) {
        if (deptFilter && emp.dept !== deptFilter) continue;

        uniqueEmpSet.add(emp.id);
        const sub = daySubs?.get(emp.id);
        const bod = !!sub?.bod;
        const eod = !!sub?.eod;
        let status: 'Both' | 'BOD Only' | 'EOD Only (Missing BOD)' | 'Not Submitted' = 'Not Submitted';
        if (bod && eod) status = 'Both';
        else if (bod && !eod) status = 'BOD Only';
        else if (!bod && eod) status = 'EOD Only (Missing BOD)';
        else status = 'Not Submitted';

        const headName = deptHeadMap.get(emp.dept.toUpperCase()) || null;
        const approvalStatus = sub ? sub.approvalStatus : 'Not Submitted';

        records.push({
          date: dStr,
          dateTime: d.getTime(),
          empId: emp.id,
          empName: emp.name,
          dept: emp.dept,
          bod,
          eod,
          status,
          systemScore: sub?.systemScore ?? null,
          headRating: sub?.headRating ?? null,
          finalScore: sub?.finalScore ?? null,
          approvalStatus,
          headName,
          lastUpdated: sub?.lastUpdated ?? null,
        });

        // Date summary
        const ds = dateSummaryMap.get(dStr)!;
        ds.total++;
        if (bod) { ds.bodDone++; summary.bodDone++; } else { ds.bodPending++; summary.bodPending++; }
        if (eod) { ds.eodDone++; summary.eodDone++; } else { ds.eodPending++; summary.eodPending++; }
        if (bod && eod) { ds.bothDone++; summary.bothDone++; }
        else if (bod && !eod) { ds.bodOnly++; summary.bodOnly++; }
        else if (!bod && eod) { ds.eodOnly++; summary.eodOnly++; }
        else { ds.none++; summary.none++; }
        summary.totalRecords++;

        // Approvals & ratings summary
        if (approvalStatus === 'Approved') summary.headRated++;
        else if (approvalStatus === 'Auto Approved') summary.autoApproved++;
        else if (approvalStatus === 'Pending Review') summary.pendingReview++;
        else if (approvalStatus === 'EOD Missed') summary.eodMissed++;
        else if (approvalStatus === 'Pending EOD') summary.pendingEOD++;

        // Dept summary
        if (!deptSummaryMap.has(emp.dept)) {
          deptSummaryMap.set(emp.dept, {
            dept: emp.dept,
            total: 0,
            bodDone: 0,
            bodPending: 0,
            eodDone: 0,
            eodPending: 0,
            bothDone: 0,
            bodOnly: 0,
            eodOnly: 0,
            none: 0,
          });
        }
        const dsm = deptSummaryMap.get(emp.dept)!;
        dsm.total++;
        if (bod) dsm.bodDone++; else dsm.bodPending++;
        if (eod) dsm.eodDone++; else dsm.eodPending++;
        if (bod && eod) dsm.bothDone++;
        else if (bod && !eod) dsm.bodOnly++;
        else if (!bod && eod) dsm.eodOnly++;
        else dsm.none++;
      }
    }

    summary.uniqueEmployees = uniqueEmpSet.size;
    records.sort((a, b) => b.dateTime - a.dateTime || a.empId.localeCompare(b.empId));

    return {
      departments,
      summary,
      dateSummary: Array.from(dateSummaryMap.values()),
      deptSummary: Array.from(deptSummaryMap.values()).sort((a, b) => a.dept.localeCompare(b.dept)),
      records,
    };
  }

  public static async fetchSubmissionDetail(dateStr: string, empId: string) {
    if (!dateStr || !empId) {
      throw new Error('Date and Employee ID are required.');
    }

    const trimmedEmpId = empId.trim();
    const trimmedDate = dateStr.trim();

    let report = await prisma.dailyReport.findUnique({
      where: {
        employeeId_reportDate: {
          employeeId: trimmedEmpId,
          reportDate: trimmedDate,
        },
      },
    });

    if (!report) {
      report = await prisma.dailyReport.findFirst({
        where: {
          OR: [
            { employeeId: trimmedEmpId, reportDate: trimmedDate },
            { employee_id: trimmedEmpId, date: trimmedDate },
            { employeeId: trimmedEmpId, date: trimmedDate },
            { employee_id: trimmedEmpId, reportDate: trimmedDate },
          ],
        },
      });
    }

    if (!report) {
      throw new Error(`No report found for employee ${empId} on ${dateStr}`);
    }

    const employee = await prisma.employee.findUnique({
      where: { employeeId: trimmedEmpId },
    });

    const deptName = report.departmentName || report.department || (employee ? employee.department : '');
    const deptInfo = deptName ? await prisma.department.findFirst({ where: { departmentName: { equals: deptName, mode: 'insensitive' } } }) : null;
    const headName = deptInfo?.headName || null;

    const reportDateStr = report.reportDate || report.date || '';
    const d = parseDateDDMMYYYY(reportDateStr);
    const isToday = !isNaN(d.getTime()) && getUtcMidnight(d) >= getUtcMidnight(new Date());

    let approvalStatus = report.approval_status;
    let headRating: string | null = (report.headRating !== null && report.headRating !== undefined ? String(report.headRating) : null) || (report.head_rating !== null && report.head_rating !== undefined ? String(report.head_rating) : null);

    const isAutoStatus = approvalStatus === 'Auto Approved' ||
                         approvalStatus === 'Auto Approved (24h)' ||
                         (typeof approvalStatus === 'string' && approvalStatus.startsWith('Auto Approved'));

    if (isToday && (isAutoStatus || headRating === 'Auto')) {
      approvalStatus = 'Pending Review';
      headRating = null;
    } else if (isAutoStatus) {
      approvalStatus = 'Auto Approved';
      headRating = headRating || '100';
    } else if (approvalStatus === 'Approved') {
      headRating = headRating || '100';
    }

    const systemScore = report.systemScore ?? report.system_score;
    const finalScore = report.finalScore ?? report.final_score ?? (
      approvalStatus === 'Auto Approved' || headRating === '100'
        ? systemScore
        : (headRating && !isNaN(parseFloat(headRating)) && systemScore !== null && systemScore !== undefined
            ? Math.round((systemScore * parseFloat(headRating)) / 100)
            : systemScore)
    );

    return {
      date: report.reportDate || report.date,
      empId: report.employeeId || report.employee_id,
      empName: employee ? employee.name : 'Name Not Found',
      dept: report.departmentName || report.department,
      headName,
      bodContent: report.bodData || (report as any).bod_data,
      eodContent: report.eodData || (report as any).eod_data,
      systemScore,
      headRating,
      finalScore,
      updatedAt: report.lastUpdated || report.last_updated,
      approvalStatus,
    };
  }

  public static async fetchActiveEmployeesList() {
    const employees = await prisma.employee.findMany({
      where: {
        status: { equals: 'active', mode: 'insensitive' },
      },
      orderBy: { name: 'asc' },
      select: {
        employeeId: true,
        name: true,
        department: true,
        subDepartment: true,
        role: true,
      },
    });

    return employees.map((e) => ({
      id: e.employeeId.trim(),
      name: e.name.trim(),
      dept: e.department.trim(),
      subDept: e.subDepartment?.trim() || '',
      role: e.role,
    }));
  }

  public static async fetchEmployeeBodEodReport(empId: string, start: string, end: string) {
    const trimmedEmpId = empId.trim();
    const startD = parseDateInput(start);
    const endD = parseDateInput(end);

    if (!startD || !endD) {
      throw new Error('Invalid start or end date provided.');
    }

    startD.setHours(0, 0, 0, 0);
    endD.setHours(23, 59, 59, 999);

    if (endD.getTime() < startD.getTime()) {
      throw new Error('End date cannot be earlier than start date.');
    }

    // 1. Fetch employee info
    let employee = await prisma.employee.findUnique({
      where: { employeeId: trimmedEmpId },
    });

    if (!employee) {
      employee = await prisma.employee.findFirst({
        where: { employeeId: { equals: trimmedEmpId, mode: 'insensitive' } },
      });
    }

    // 2. Fetch department head info
    const deptName = employee?.department || '';
    let headName: string | null = null;
    if (deptName) {
      const dept = await prisma.department.findFirst({
        where: { departmentName: { equals: deptName, mode: 'insensitive' } },
      });
      headName = dept?.headName || null;
    }

    // 3. Build array of dates in range
    const datesInRange: string[] = [];
    const dateObjectsInRange: { dateStr: string; timestamp: number }[] = [];
    let curD = new Date(startD);
    const maxD = new Date(endD);
    while (curD <= maxD) {
      const dd = String(curD.getDate()).padStart(2, '0');
      const mm = String(curD.getMonth() + 1).padStart(2, '0');
      const yyyy = curD.getFullYear();
      const dateStr = `${dd}/${mm}/${yyyy}`;
      datesInRange.push(dateStr);
      dateObjectsInRange.push({
        dateStr,
        timestamp: getUtcMidnight(curD),
      });
      curD.setDate(curD.getDate() + 1);
    }

    // 4. Fetch all daily reports for this employee within the date range
    const startEpoch = BigInt(startD.getTime());
    const endEpoch = BigInt(endD.getTime());

    const reports = await prisma.dailyReport.findMany({
      where: {
        AND: [
          {
            OR: [
              { employeeId: trimmedEmpId },
              { employee_id: trimmedEmpId },
            ],
          },
          {
            OR: [
              {
                dateTimestamp: {
                  gte: startEpoch,
                  lte: endEpoch,
                },
              },
              { reportDate: { in: datesInRange } },
              { date: { in: datesInRange } },
            ],
          },
        ],
      },
      orderBy: {
        dateTimestamp: 'asc',
      },
    });

    // Build map of report by date
    const reportMap = new Map<string, any>();
    for (const r of reports) {
      const dStr = r.reportDate || r.date || '';
      if (dStr) {
        reportMap.set(dStr.trim(), r);
      }
    }

    // Now construct day-by-day records
    let bodCount = 0;
    let eodCount = 0;
    let bothCount = 0;
    let approvedCount = 0;
    let autoApprovedCount = 0;
    let pendingReviewCount = 0;
    let missedCount = 0;
    let sumScore = 0;
    let scoreCount = 0;

    const dailyRecords = dateObjectsInRange.map(({ dateStr, timestamp }) => {
      const report = reportMap.get(dateStr);
      const isPastDate = timestamp < getUtcMidnight(new Date());

      if (!report) {
        if (isPastDate) missedCount++;
        return {
          date: dateStr,
          timestamp,
          hasSubmission: false,
          bodSubmitted: false,
          eodSubmitted: false,
          status: isPastDate ? 'Not Submitted' : 'Pending',
          bodContent: null,
          eodContent: null,
          systemScore: null,
          headRating: null,
          finalScore: null,
          approvalStatus: isPastDate ? 'Not Submitted' : 'Pending',
          lastUpdated: null,
        };
      }

      let bodData = report.bodData || (report as any).bod_data;
      let eodData = report.eodData || (report as any).eod_data;

      // Ensure parsed if JSON string
      if (typeof bodData === 'string') {
        try { bodData = JSON.parse(bodData); } catch {}
      }
      if (typeof eodData === 'string') {
        try { eodData = JSON.parse(eodData); } catch {}
      }

      const bodFilled = !!(
        bodData &&
        (typeof bodData === 'object' ? Object.keys(bodData).length > 0 : String(bodData).trim() !== '' && bodData !== '{}')
      );
      const eodFilled = !!(
        eodData &&
        (typeof eodData === 'object' ? Object.keys(eodData).length > 0 : String(eodData).trim() !== '' && eodData !== '{}')
      );

      if (bodFilled) bodCount++;
      if (eodFilled) eodCount++;
      if (bodFilled && eodFilled) bothCount++;

      let rawHeadRating: string | null = (report.headRating !== null && report.headRating !== undefined ? String(report.headRating).trim() : null) || (report.head_rating !== null && report.head_rating !== undefined ? String(report.head_rating).trim() : null);
      let rawSysScore = report.systemScore ?? report.system_score ?? null;
      let rawFinalScore = report.finalScore ?? report.final_score ?? null;
      let rawApprovalStatus = report.approval_status ? String(report.approval_status).trim() : null;

      const safeLastUpdated = parseSafeDate(report.lastUpdated || report.last_updated);
      const hoursSinceUpdate = (Date.now() - safeLastUpdated.getTime()) / (1000 * 60 * 60);

      let effectiveApprovalStatus: string = 'Not Submitted';
      let effectiveHeadRating: string | null = rawHeadRating;
      let effectiveFinalScore: number | null = rawFinalScore;

      const isToday = timestamp >= getUtcMidnight(new Date());
      const isAutoStatus = rawApprovalStatus === 'Auto Approved' ||
                           rawApprovalStatus === 'Auto Approved (24h)' ||
                           (typeof rawApprovalStatus === 'string' && rawApprovalStatus.startsWith('Auto Approved'));

      if (eodFilled) {
        if (!isToday && isAutoStatus) {
          effectiveApprovalStatus = 'Auto Approved';
          effectiveHeadRating = '100';
          effectiveFinalScore = rawSysScore;
          autoApprovedCount++;
        } else if (rawApprovalStatus === 'Approved' || (!isAutoStatus && rawHeadRating && rawHeadRating !== '' && rawHeadRating !== 'Auto')) {
          effectiveApprovalStatus = 'Approved';
          effectiveHeadRating = rawHeadRating || '100';
          effectiveFinalScore = rawFinalScore ?? (rawSysScore !== null && !isNaN(parseFloat(effectiveHeadRating))
            ? Math.round((rawSysScore * parseFloat(effectiveHeadRating)) / 100)
            : rawSysScore);
          approvedCount++;
        } else if (!isToday && (rawHeadRating === 'Auto' || hoursSinceUpdate >= 24)) {
          effectiveApprovalStatus = 'Auto Approved';
          effectiveHeadRating = '100';
          effectiveFinalScore = rawSysScore;
          autoApprovedCount++;
        } else {
          effectiveApprovalStatus = 'Pending Review';
          effectiveHeadRating = null;
          pendingReviewCount++;
        }
      } else {
        if (bodFilled) {
          effectiveApprovalStatus = (rawApprovalStatus === 'Pending EOD' || rawApprovalStatus === 'EOD Missed')
            ? rawApprovalStatus
            : (isPastDate ? 'EOD Missed' : 'Pending EOD');
        } else {
          effectiveApprovalStatus = isPastDate ? 'Not Submitted' : 'Pending';
        }
        effectiveHeadRating = null;
        effectiveFinalScore = null;
        if (isPastDate) missedCount++;
      }

      if (effectiveFinalScore !== null) {
        sumScore += effectiveFinalScore;
        scoreCount++;
      } else if (rawSysScore !== null) {
        sumScore += rawSysScore;
        scoreCount++;
      }

      const status = bodFilled && eodFilled
        ? 'Both'
        : bodFilled
        ? 'BOD Only'
        : eodFilled
        ? 'EOD Only (Missing BOD)'
        : 'Not Submitted';

      return {
        date: dateStr,
        timestamp,
        hasSubmission: bodFilled || eodFilled,
        bodSubmitted: bodFilled,
        eodSubmitted: eodFilled,
        status,
        bodContent: bodData,
        eodContent: eodData,
        systemScore: rawSysScore,
        headRating: effectiveHeadRating,
        finalScore: effectiveFinalScore,
        approvalStatus: effectiveApprovalStatus,
        lastUpdated: report.lastUpdated || report.last_updated || null,
      };
    });

    const avgScore = scoreCount > 0 ? Math.round((sumScore / scoreCount) * 10) / 10 : null;

    return {
      employee: {
        id: trimmedEmpId,
        name: employee?.name || 'Name Not Found',
        department: employee?.department || deptName || 'General',
        subDepartment: employee?.subDepartment || '',
        role: employee?.role || 'employee',
      },
      headName: headName || 'Not Assigned',
      dateRange: {
        start,
        end,
        totalDays: dateObjectsInRange.length,
      },
      stats: {
        totalDays: dateObjectsInRange.length,
        submittedDays: dailyRecords.filter((d) => d.hasSubmission).length,
        bothSubmittedDays: bothCount,
        bodOnlyDays: bodCount - bothCount,
        eodOnlyDays: eodCount - bothCount,
        missedDays: missedCount,
        approvedDays: approvedCount,
        autoApprovedDays: autoApprovedCount,
        pendingReviewDays: pendingReviewCount,
        avgScore,
      },
      records: dailyRecords,
    };
  }
}
