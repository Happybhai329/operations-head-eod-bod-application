import bcrypt from 'bcryptjs';
import { prisma } from '../prisma/client';
import { env } from '../config/env';
import { getTimeFromDDMMYYYY } from '../utils/dateUtils';
import { parseScoreHelper } from '../utils/scoreEngine';

async function seed() {
  console.log('🌱 Starting database seeding for The Prime Classes...');

  // 1. Seed Super Admin User
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(env.SUPER_ADMIN_CODE, salt);

  await prisma.adminUser.upsert({
    where: { username: env.SUPER_ADMIN_USERNAME },
    create: {
      username: env.SUPER_ADMIN_USERNAME,
      passwordHash,
      role: 'SUPER_ADMIN',
    },
    update: {
      passwordHash,
      role: 'SUPER_ADMIN',
    },
  });
  console.log(`✅ Super Admin created (User: ${env.SUPER_ADMIN_USERNAME})`);

  // 2. Seed Departments
  const departmentsData = [
    { departmentId: 'DEPT_ACAD', departmentName: 'ACADEMIC', headId: 'TPC2401HD', headName: 'Dr. Rajesh Sharma' },
    { departmentId: 'DEPT_MKTG', departmentName: 'MARKETING', headId: 'TPC2402HD', headName: 'Pooja Verma' },
    { departmentId: 'DEPT_SALES', departmentName: 'SALES', headId: 'TPC2403HD', headName: 'Amit Saxena' },
    { departmentId: 'DEPT_HR', departmentName: 'HR & RECRUITMENT', headId: 'TPC2404HD', headName: 'Sunita Rao' },
    { departmentId: 'DEPT_FIN', departmentName: 'FINANCE', headId: 'TPC2405HD', headName: 'Ramesh Gupta' },
    { departmentId: 'DEPT_OPS', departmentName: 'OPERATIONS', headId: 'TPC2406HD', headName: 'Vikas Dubey' },
    { departmentId: 'DEPT_IT', departmentName: 'IT & SYSTEMS', headId: 'TPC2407HD', headName: 'Siddharth Roy' },
  ];

  for (const dept of departmentsData) {
    await prisma.department.upsert({
      where: { departmentName: dept.departmentName },
      create: dept,
      update: dept,
    });
  }
  console.log(`✅ ${departmentsData.length} Departments seeded.`);

  // 3. Seed Employees
  const employeesData = [
    // Academic
    { employeeId: 'TPC2401HD', name: 'Dr. Rajesh Sharma', department: 'ACADEMIC', subDepartment: 'DIRECT', role: 'head', status: 'active' },
    { employeeId: 'TPC2410AC', name: 'Ananya Deshmukh', department: 'ACADEMIC', subDepartment: 'TEACHING', role: 'employee', status: 'active' },
    { employeeId: 'TPC2411AC', name: 'Rohan Kulkarni', department: 'ACADEMIC', subDepartment: 'HOMEWORK', role: 'employee', status: 'active' },
    { employeeId: 'TPC2412AC', name: 'Sneha Patel', department: 'ACADEMIC', subDepartment: 'TEACHING', role: 'employee', status: 'active' },
    { employeeId: 'TPC2413AC', name: 'Kavita Joshi', department: 'ACADEMIC', subDepartment: 'COMPLAINT', role: 'employee', status: 'active' },

    // Marketing
    { employeeId: 'TPC2402HD', name: 'Pooja Verma', department: 'MARKETING', subDepartment: 'DIRECT', role: 'head', status: 'active' },
    { employeeId: 'TPC2420MK', name: 'Rahul Chawla', department: 'MARKETING', subDepartment: 'DIGITAL', role: 'employee', status: 'active' },
    { employeeId: 'TPC2421MK', name: 'Divya Sen', department: 'MARKETING', subDepartment: 'FIELD', role: 'employee', status: 'active' },

    // Sales
    { employeeId: 'TPC2403HD', name: 'Amit Saxena', department: 'SALES', subDepartment: 'DIRECT', role: 'head', status: 'active' },
    { employeeId: 'TPC2430SL', name: 'Manish Tiwari', department: 'SALES', subDepartment: 'ADMISSIONS', role: 'employee', status: 'active' },
    { employeeId: 'TPC2431SL', name: 'Neha Kapoor', department: 'SALES', subDepartment: 'COUNSELLING', role: 'employee', status: 'active' },
    { employeeId: 'TPC2432SL', name: 'Gaurav Jain', department: 'SALES', subDepartment: 'ADMISSIONS', role: 'employee', status: 'active' },

    // HR
    { employeeId: 'TPC2404HD', name: 'Sunita Rao', department: 'HR & RECRUITMENT', subDepartment: 'DIRECT', role: 'head', status: 'active' },
    { employeeId: 'TPC2440HR', name: 'Megha Nair', department: 'HR & RECRUITMENT', subDepartment: 'TRAINING', role: 'employee', status: 'active' },

    // Finance
    { employeeId: 'TPC2405HD', name: 'Ramesh Gupta', department: 'FINANCE', subDepartment: 'DIRECT', role: 'head', status: 'active' },
    { employeeId: 'TPC2450FN', name: 'Prateek Agarwal', department: 'FINANCE', subDepartment: 'PAYROLL', role: 'employee', status: 'active' },

    // Operations
    { employeeId: 'TPC2406HD', name: 'Vikas Dubey', department: 'OPERATIONS', subDepartment: 'DIRECT', role: 'head', status: 'active' },
    { employeeId: 'TPC2460OP', name: 'Sanjay Yadav', department: 'OPERATIONS', subDepartment: 'LOGISTICS', role: 'employee', status: 'active' },

    // IT
    { employeeId: 'TPC2407HD', name: 'Siddharth Roy', department: 'IT & SYSTEMS', subDepartment: 'DIRECT', role: 'head', status: 'active' },
    { employeeId: 'TPC2470IT', name: 'Arjun Mehta', department: 'IT & SYSTEMS', subDepartment: 'DEVELOPMENT', role: 'employee', status: 'active' },
  ];

  for (const emp of employeesData) {
    await prisma.employee.upsert({
      where: { employeeId: emp.employeeId },
      create: emp,
      update: emp,
    });
  }
  console.log(`✅ ${employeesData.length} Employees seeded.`);

  // 4. Generate Reports for the past 7 days
  const today = new Date();
  let reportsCreated = 0;

  for (let d = 0; d < 7; d++) {
    const reportDateObj = new Date(today);
    reportDateObj.setDate(today.getDate() - d);
    
    const dayStr = ("0" + reportDateObj.getDate()).slice(-2);
    const monthStr = ("0" + (reportDateObj.getMonth() + 1)).slice(-2);
    const dateStr = `${dayStr}/${monthStr}/${reportDateObj.getFullYear()}`;
    const timestamp = getTimeFromDDMMYYYY(dateStr);

    for (const emp of employeesData) {
      if (emp.role === 'head') continue; // Only employees submit daily BOD/EOD

      const sysScore = Math.floor(Math.random() * 35) + 65; // 65 - 100%
      const headRating = Math.random() > 0.3 ? (Math.random() > 0.7 ? "110" : "100") : "";
      const finalScore = headRating ? Math.round(sysScore * parseFloat(headRating) / 100) : sysScore;

      const bodData = {
        "Core Responsibilities": {
          type: "dynamicList",
          list: [
            { title: "Conduct batches & student consultations", hasTarget: true, target: "4 Batches" },
            { title: "Review curriculum milestone progress", hasTarget: false },
            { title: "Prepare weekly topic assessment papers", hasTarget: true, target: "2 Papers" }
          ]
        },
        "Priority Goal": {
          type: "directValue",
          value: "Resolve student doubt tickets within 2 hours"
        }
      };

      const eodData = {
        "Core Responsibilities": {
          type: "dynamicList",
          list: [
            { title: "Conduct batches & student consultations", hasTarget: true, target: "4 Batches", achieved: "4 Batches", isVoluntary: false },
            { title: "Review curriculum milestone progress", hasTarget: false, status: "Done", isVoluntary: false },
            { title: "Prepare weekly topic assessment papers", hasTarget: true, target: "2 Papers", achieved: "2 Papers", isVoluntary: false },
            { title: "Extra remedial session for weak students", hasTarget: false, status: "Done", isVoluntary: true }
          ],
          remarks: "All scheduled milestones completed smoothly."
        },
        "Classroom Hygiene Check": {
          type: "checkbox",
          status: "Done"
        },
        "Attendance Verification": {
          type: "directValue",
          value: "100% verified on portal",
          subCategories: {
            "Morning Batch": "48/50 Present",
            "Evening Batch": "46/50 Present"
          }
        }
      };

      await prisma.dailyReport.upsert({
        where: {
          employeeId_reportDate: {
            employeeId: emp.employeeId,
            reportDate: dateStr,
          },
        },
        create: {
          reportDate: dateStr,
          dateTimestamp: BigInt(timestamp),
          employeeId: emp.employeeId,
          departmentName: emp.department,
          bodData,
          eodData,
          systemScore: sysScore,
          headRating: headRating || null,
          finalScore: finalScore,
          lastUpdated: reportDateObj,
        },
        update: {
          systemScore: sysScore,
          headRating: headRating || null,
          finalScore: finalScore,
          bodData,
          eodData,
          lastUpdated: reportDateObj,
        },
      });

      reportsCreated++;
    }

    // Seed Head Ratings for yesterday and 2 days ago
    if (d === 1 || d === 2) {
      for (const dept of departmentsData) {
        const baseScore = Math.floor(Math.random() * 20) + 75;
        const adminRating = 100;
        const finalHeadScore = Math.round(baseScore * adminRating / 100);

        await prisma.headRating.upsert({
          where: {
            departmentName_ratingDate: {
              departmentName: dept.departmentName,
              ratingDate: dateStr,
            },
          },
          create: {
            ratingDate: dateStr,
            dateTimestamp: BigInt(timestamp),
            departmentName: dept.departmentName,
            headId: dept.headId,
            baseScore,
            adminRating,
            finalHeadScore,
          },
          update: {
            baseScore,
            adminRating,
            finalHeadScore,
          },
        });
      }
    }
  }

  console.log(`✅ ${reportsCreated} Daily Reports and Head Ratings seeded.`);
  console.log('🎉 Seeding completed successfully!');
}

seed()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
