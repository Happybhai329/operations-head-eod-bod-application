const { PrismaClient } = require('@prisma/client');
const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');

require('dotenv').config();

const prisma = new PrismaClient();

async function main() {
  console.log('=== Checking Supabase PostgreSQL ===');
  const count = await prisma.dailyReport.count();
  console.log('Total DailyReports in Supabase:', count);

  const itReports = await prisma.dailyReport.findMany({
    where: {
      departmentName: {
        contains: 'IT',
        mode: 'insensitive'
      }
    },
    orderBy: { createdAt: 'desc' },
    take: 10
  });
  console.log(`Recent IT Department Reports in Supabase (${itReports.length}):`, itReports.map(r => ({
    id: r.id,
    reportDate: r.reportDate,
    employeeId: r.employeeId,
    departmentName: r.departmentName,
    createdAt: r.createdAt
  })));

  const latestAny = await prisma.dailyReport.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5
  });
  console.log('Latest 5 Reports in Supabase (any dept):', latestAny.map(r => ({
    id: r.id,
    reportDate: r.reportDate,
    employeeId: r.employeeId,
    departmentName: r.departmentName,
    createdAt: r.createdAt
  })));

  console.log('\n=== Checking Google Sheets ===');
  const keyPath = process.env.GOOGLE_CREDENTIALS_PATH || 'D:/prime/standard-gcp-project-485906-275666f71217.json';
  if (fs.existsSync(keyPath)) {
    const auth = new google.auth.GoogleAuth({
      keyFile: keyPath,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const client = google.sheets({ version: 'v4', auth });
    const res = await client.spreadsheets.values.get({
      spreadsheetId: process.env.APP_DB_SPREADSHEET_ID || '1IFGc0kvv9LpbZUfEGroY8PevevJ8axdPApVrLjidlw8',
      range: 'Daily_Reports!A:Z'
    });
    const rows = res.data.values || [];
    console.log('Total rows in Google Sheets Daily_Reports:', rows.length);
    if (rows.length > 0) {
      console.log('Header row:', rows[0].slice(0, 10));
      const last5 = rows.slice(-5);
      console.log('Last 5 rows in Google Sheets:');
      last5.forEach((row, idx) => {
        console.log(`  Row ${rows.length - 5 + idx + 1}: Timestamp=${row[0]}, EmpCode=${row[1]}, Name=${row[2]}, Dept=${row[3]}, Date=${row[4]}, BOD=${(row[5]||'').slice(0, 20)}..., EOD=${(row[6]||'').slice(0, 20)}...`);
      });
    }
  } else {
    console.log('Key file not found at:', keyPath);
  }

  await prisma.$disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
