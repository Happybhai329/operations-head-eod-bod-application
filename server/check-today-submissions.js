const { google } = require('googleapis');
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient();

async function checkToday() {
  console.log('=== CHECKING TODAY (13/09/2026) IN SUPABASE ===');
  const dbReports = await prisma.dailyReport.findMany({
    where: {
      reportDate: {
        contains: '13/09/2026'
      }
    }
  });
  console.log(`Found ${dbReports.length} reports in Supabase for 13/09/2026:`);
  dbReports.forEach(r => {
    const bodLen = r.bodData ? JSON.stringify(r.bodData).length : 0;
    const eodLen = r.eodData ? JSON.stringify(r.eodData).length : 0;
    console.log(`Emp: ${r.employeeId} | Dept: ${r.departmentName} | BOD: ${bodLen > 2} | EOD: ${eodLen > 2} | Score: ${r.systemScore}`);
  });

  // Also check all reports ordered by createdAt descending
  const recentReports = await prisma.dailyReport.findMany({
    take: 10,
    orderBy: { createdAt: 'desc' }
  });
  console.log('\nTop 10 Most Recent Reports in Supabase:');
  recentReports.forEach(r => {
    console.log(`Date: ${r.reportDate} | Emp: ${r.employeeId} | CreatedAt: ${r.createdAt} | LastUpdated: ${r.lastUpdated}`);
  });

  console.log('\n=== CHECKING TODAY (13/09/2026) IN GOOGLE SHEETS ===');
  const creds = JSON.parse(fs.readFileSync('D:/prime/standard-gcp-project-485906-275666f71217.json', 'utf8'));
  const auth = new google.auth.JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const sheets = google.sheets({ version: 'v4', auth });
  const sheetRes = await sheets.spreadsheets.values.get({
    spreadsheetId: '1IFGc0kvv9LpbZUfEGroY8PevevJ8axdPApVrLjidlw8',
    range: 'Daily_Reports!A:I',
  });
  const rows = sheetRes.data.values || [];
  console.log(`Total rows in Google Sheets Daily_Reports: ${rows.length}`);
  
  const todaySheetRows = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const d = (r[0] || '').replace(/'/g, '').trim();
    if (d.includes('13/09') || d.includes('13-09')) {
      todaySheetRows.push({
        rowIndex: i + 1,
        date: r[0],
        empId: r[1],
        dept: r[2],
        hasBod: !!r[3] && r[3].length > 2,
        hasEod: !!r[4] && r[4].length > 2,
        lastUpdated: r[6]
      });
    }
  }

  console.log(`Found ${todaySheetRows.length} rows in Google Sheets for 13/09/2026:`);
  console.table(todaySheetRows);

  await prisma.$disconnect();
}

checkToday().catch(console.error);
