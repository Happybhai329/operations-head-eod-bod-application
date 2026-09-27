import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import fs from 'fs';
import { prisma } from '../prisma/client';
import { env } from '../config/env';
import { GoogleSheetsClient } from '../sheets/sheetsClient';
import { dateToDDMMYYYY, getTimeFromDDMMYYYY } from '../utils/dateUtils';
import { parseScoreHelper, calculateEmployeeDailyFinalScore } from '../utils/scoreEngine';
import { AuditService } from '../services/auditService';

interface MigrationReport {
  timestamp: string;
  masterDbId: string;
  appDbId: string;
  departments: { read: number; imported: number; updated: number; skipped: number; errors: string[] };
  employees: { read: number; imported: number; updated: number; duplicates: number; invalidDeptRef: number; errors: string[] };
  dailyReports: { read: number; imported: number; updated: number; invalidEmpRef: number; invalidDeptRef: number; errors: string[] };
  headRatings: { read: number; imported: number; updated: number; errors: string[] };
}

async function runMigration() {
  console.log('===========================================================');
  console.log('🔄 THE PRIME CLASSES - GOOGLE SHEETS DATA MIGRATION ENGINE');
  console.log('===========================================================');

  const report: MigrationReport = {
    timestamp: new Date().toISOString(),
    masterDbId: env.MASTER_DB_SPREADSHEET_ID,
    appDbId: env.APP_DB_SPREADSHEET_ID,
    departments: { read: 0, imported: 0, updated: 0, skipped: 0, errors: [] },
    employees: { read: 0, imported: 0, updated: 0, duplicates: 0, invalidDeptRef: 0, errors: [] },
    dailyReports: { read: 0, imported: 0, updated: 0, invalidEmpRef: 0, invalidDeptRef: 0, errors: [] },
    headRatings: { read: 0, imported: 0, updated: 0, errors: [] },
  };

  try {
    const client = GoogleSheetsClient.getClient();
    if (!client) {
      console.warn('⚠️ Google Sheets client not authenticated. Please ensure service account credentials or key file exists.');
      console.log('ℹ️ Migration cannot fetch live Google Sheets data without credentials.');
      return;
    }

    // ------------------------------------------------------------
    // 1. MIGRATE MASTER DB -> DEPARTMENTS
    // ------------------------------------------------------------
    console.log('\n📥 1. Reading Master DB -> Departments...');
    const deptRows = await GoogleSheetsClient.getValues(env.MASTER_DB_SPREADSHEET_ID, 'Departments!A:Z');
    if (deptRows && deptRows.length > 1) {
      const headers = deptRows[0].map(h => String(h).trim());
      const nameIdx = headers.indexOf('DepartmentName');
      const headIdIdx = headers.indexOf('HeadId');
      const headNameIdx = headers.indexOf('HeadName');
      const parentDeptIdx = headers.indexOf('ParentDepartment');
      const deptIdIdx = headers.indexOf('DepartmentID');

      report.departments.read = deptRows.length - 1;

      for (let i = 1; i < deptRows.length; i++) {
        const row = deptRows[i];
        const deptName = nameIdx !== -1 && row[nameIdx] ? String(row[nameIdx]).trim() : '';
        if (!deptName) {
          report.departments.skipped++;
          continue;
        }

        const deptId = (deptIdIdx !== -1 && row[deptIdIdx]) ? String(row[deptIdIdx]).trim() : `DEPT_${deptName.replace(/[^A-Z0-9]/gi, '_').toUpperCase()}`;
        const headId = (headIdIdx !== -1 && row[headIdIdx]) ? String(row[headIdIdx]).trim() : null;
        const headName = (headNameIdx !== -1 && row[headNameIdx]) ? String(row[headNameIdx]).trim() : null;
        const parentDept = (parentDeptIdx !== -1 && row[parentDeptIdx]) ? String(row[parentDeptIdx]).trim() : null;

        try {
          await prisma.department.upsert({
            where: { departmentName: deptName },
            create: {
              departmentId: deptId,
              departmentName: deptName,
              headId,
              headName,
              parentDepartment: parentDept,
            },
            update: {
              departmentId: deptId,
              headId,
              headName,
              parentDepartment: parentDept,
            },
          });
          report.departments.imported++;
        } catch (err: any) {
          report.departments.errors.push(`Row ${i} (${deptName}): ${err.message}`);
        }
      }
      console.log(`   ✅ Departments: ${report.departments.imported} imported/updated.`);
    }

    // ------------------------------------------------------------
    // 2. MIGRATE MASTER DB -> EMPLOYEES
    // ------------------------------------------------------------
    console.log('\n📥 2. Reading Master DB -> Employees...');
    const empRows = await GoogleSheetsClient.getValues(env.MASTER_DB_SPREADSHEET_ID, 'Employees!A:Z');
    const existingDepts = new Set((await prisma.department.findMany()).map(d => d.departmentName));

    if (empRows && empRows.length > 1) {
      const headers = empRows[0].map(h => String(h).trim());
      const empIdIdx = headers.indexOf('EmployeeID');
      const nameIdx = headers.indexOf('Name');
      const deptIdx = headers.indexOf('Department');
      const subDeptIdx = headers.indexOf('Sub_Department') !== -1 ? headers.indexOf('Sub_Department') : headers.indexOf('SubDepartment');
      const statusIdx = headers.indexOf('Status');
      const roleIdx = headers.indexOf('Role');
      const contactIdx = headers.indexOf('Contact');

      report.employees.read = empRows.length - 1;
      const seenEmpIds = new Set<string>();

      for (let i = 1; i < empRows.length; i++) {
        const row = empRows[i];
        const empId = empIdIdx !== -1 && row[empIdIdx] ? String(row[empIdIdx]).trim() : '';
        const name = nameIdx !== -1 && row[nameIdx] ? String(row[nameIdx]).trim() : '';
        const dept = deptIdx !== -1 && row[deptIdx] ? String(row[deptIdx]).trim() : '';

        if (!empId || !name) {
          report.employees.errors.push(`Row ${i}: Missing EmployeeID or Name`);
          continue;
        }

        if (seenEmpIds.has(empId)) {
          report.employees.duplicates++;
        }
        seenEmpIds.add(empId);

        if (!existingDepts.has(dept)) {
          report.employees.invalidDeptRef++;
        }

        const subDept = subDeptIdx !== -1 && row[subDeptIdx] ? String(row[subDeptIdx]).trim() : null;
        const status = statusIdx !== -1 && row[statusIdx] ? String(row[statusIdx]).trim().toLowerCase() : 'active';
        const role = roleIdx !== -1 && row[roleIdx] ? String(row[roleIdx]).trim().toLowerCase() : 'employee';
        const contact = contactIdx !== -1 && row[contactIdx] ? String(row[contactIdx]).trim() : null;

        try {
          await prisma.employee.upsert({
            where: { employeeId: empId },
            create: {
              employeeId: empId,
              name,
              department: dept,
              subDepartment: subDept,
              status,
              role,
              contact,
            },
            update: {
              name,
              department: dept,
              subDepartment: subDept,
              status,
              role,
              contact,
            },
          });
          report.employees.imported++;
        } catch (err: any) {
          report.employees.errors.push(`Row ${i} (${empId}): ${err.message}`);
        }
      }
      console.log(`   ✅ Employees: ${report.employees.imported} imported/updated.`);
    }

    // ------------------------------------------------------------
    // 3. MIGRATE APP DB -> DAILY REPORTS
    // ------------------------------------------------------------
    console.log('\n📥 3. Reading App DB -> Daily Reports...');
    const dailyRows = await GoogleSheetsClient.getValues(env.APP_DB_SPREADSHEET_ID, 'Daily_Reports!A:Z');
    if (dailyRows && dailyRows.length > 1) {
      report.dailyReports.read = dailyRows.length - 1;

      for (let i = 1; i < dailyRows.length; i++) {
        const row = dailyRows[i];
        const rawDate = row[0];
        const empId = row[1] ? String(row[1]).trim() : '';
        const dept = row[2] ? String(row[2]).trim() : '';
        const bodStr = row[3];
        const eodStr = row[4];
        const rawSysScore = row[5];
        const rawLastUpdated = row[6];
        const headRating = row[7] ? String(row[7]).trim() : null;
        const rawFinalScore = row[8];

        if (!empId || !rawDate) continue;

        const reportDate = dateToDDMMYYYY(rawDate);
        const dateTimestamp = getTimeFromDDMMYYYY(reportDate);

        let bodData: any = {};
        let eodData: any = {};
        try { if (typeof bodStr === 'string' && bodStr.trim().startsWith('{')) bodData = JSON.parse(bodStr); } catch (_) {}
        try { if (typeof eodStr === 'string' && eodStr.trim().startsWith('{')) eodData = JSON.parse(eodStr); } catch (_) {}

        const lastUpdated = rawLastUpdated ? new Date(rawLastUpdated) : new Date();
        const { sysScore, finalScore } = calculateEmployeeDailyFinalScore(rawSysScore, headRating, rawFinalScore, lastUpdated);

        try {
          await prisma.dailyReport.upsert({
            where: {
              employeeId_reportDate: {
                employeeId: empId,
                reportDate,
              },
            },
            create: {
              reportDate,
              dateTimestamp: BigInt(dateTimestamp),
              employeeId: empId,
              departmentName: dept,
              bodData,
              eodData,
              systemScore: sysScore,
              headRating: headRating || null,
              finalScore,
              lastUpdated,
            },
            update: {
              departmentName: dept,
              bodData,
              eodData,
              systemScore: sysScore,
              headRating: headRating || null,
              finalScore,
              lastUpdated,
            },
          });
          report.dailyReports.imported++;
        } catch (err: any) {
          report.dailyReports.errors.push(`Row ${i} (${empId} on ${reportDate}): ${err.message}`);
        }
      }
      console.log(`   ✅ Daily Reports: ${report.dailyReports.imported} imported/updated.`);
    }

    // ------------------------------------------------------------
    // 4. MIGRATE APP DB -> HEAD RATINGS
    // ------------------------------------------------------------
    console.log('\n📥 4. Reading App DB -> Head Ratings...');
    const hrRows = await GoogleSheetsClient.getValues(env.APP_DB_SPREADSHEET_ID, 'Head_Ratings!A:G');
    if (hrRows && hrRows.length > 1) {
      report.headRatings.read = hrRows.length - 1;

      for (let i = 1; i < hrRows.length; i++) {
        const row = hrRows[i];
        const rawDate = row[0];
        const dept = row[1] ? String(row[1]).trim() : '';
        const headId = row[2] ? String(row[2]).trim() : null;
        const baseScore = parseScoreHelper(row[3]);
        const adminRating = row[4] ? parseFloat(String(row[4]).replace('%', '').trim()) : 100;
        const finalHeadScore = parseScoreHelper(row[5]) || Math.round(baseScore * adminRating / 100);

        if (!dept || !rawDate) continue;

        const ratingDate = dateToDDMMYYYY(rawDate);
        const dateTimestamp = getTimeFromDDMMYYYY(ratingDate);

        try {
          await prisma.headRating.upsert({
            where: {
              departmentName_ratingDate: {
                departmentName: dept,
                ratingDate,
              },
            },
            create: {
              ratingDate,
              dateTimestamp: BigInt(dateTimestamp),
              departmentName: dept,
              headId,
              baseScore,
              adminRating,
              finalHeadScore,
            },
            update: {
              headId,
              baseScore,
              adminRating,
              finalHeadScore,
            },
          });
          report.headRatings.imported++;
        } catch (err: any) {
          report.headRatings.errors.push(`Row ${i} (${dept} on ${ratingDate}): ${err.message}`);
        }
      }
      console.log(`   ✅ Head Ratings: ${report.headRatings.imported} imported/updated.`);
    }

    // Save migration report
    const logsDir = path.resolve(__dirname, '../../logs');
    if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
    const reportPath = path.join(logsDir, `migration_report_${Date.now()}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    await AuditService.log({
      actor: 'MIGRATION_SCRIPT',
      action: 'DATA_MIGRATION_COMPLETED',
      entity: 'SystemMigration',
      metadata: {
        departmentsImported: report.departments.imported,
        employeesImported: report.employees.imported,
        dailyReportsImported: report.dailyReports.imported,
        headRatingsImported: report.headRatings.imported,
      },
    });

    console.log('\n===========================================================');
    console.log('🎉 DATA MIGRATION SUMMARY REPORT:');
    console.log(`- Departments:   ${report.departments.imported} imported (${report.departments.skipped} skipped)`);
    console.log(`- Employees:     ${report.employees.imported} imported (${report.employees.duplicates} duplicates, ${report.employees.invalidDeptRef} unmatched depts)`);
    console.log(`- Daily Reports: ${report.dailyReports.imported} imported`);
    console.log(`- Head Ratings:  ${report.headRatings.imported} imported`);
    console.log(`📝 Full report written to: ${reportPath}`);
    console.log('===========================================================');
  } catch (error) {
    console.error('💥 Migration failed with fatal error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

runMigration();
