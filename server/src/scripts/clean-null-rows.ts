import { prisma } from '../prisma/client';

async function main() {
  console.log('Cleaning up any invalid rows in Supabase...');

  // Check employees with null employeeId
  const deletedEmps = await prisma.$executeRawUnsafe(`DELETE FROM employees WHERE "employeeId" IS NULL OR "employeeId" = ''`);
  console.log('Deleted invalid employees:', deletedEmps);

  // Check dailyReports with null employeeId or date
  const deletedReports = await prisma.$executeRawUnsafe(`DELETE FROM daily_reports WHERE "employeeId" IS NULL OR "reportDate" IS NULL`);
  console.log('Deleted invalid reports:', deletedReports);

  // Check count of valid employees
  const validEmps = await prisma.employee.count();
  console.log('Valid active employees:', validEmps);

  // Test findMany
  const emps = await prisma.employee.findMany();
  console.log('prisma.employee.findMany() successful! Count:', emps.length);
}

main().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
