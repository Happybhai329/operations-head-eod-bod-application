import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { prisma } from '../prisma/client';
import { GoogleSheetsClient } from '../sheets/sheetsClient';
import { env } from '../config/env';

async function main() {
  console.log('=== 1. In Google Sheets (Daily_Reports) for 03/09/2026 ===');
  const rows = await GoogleSheetsClient.getValues(env.APP_DB_SPREADSHEET_ID, 'Daily_Reports!A:I');
  if (rows) {
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row[0] === '03/09/2026' && row[2] === 'PUBLICATION DEPARTMENT') {
        console.log(`Sheet Row ${i+1}: Emp=${row[1]}, Sys=${row[5]}, LastUpd=${row[6]}, EOD=${row[4] ? row[4].substring(0, 40) : 'EMPTY'}`);
      }
    }
  }

  console.log('\n=== 2. In PostgreSQL (daily_reports) for 03/09/2026 ===');
  const dbReports = await prisma.dailyReport.findMany({
    where: {
      reportDate: '03/09/2026',
      departmentName: 'PUBLICATION DEPARTMENT',
    },
  });
  console.log(`Found in DB: ${dbReports.length}`);
  for (const r of dbReports) {
    console.log(`DB: Emp=${r.employeeId}, Sys=${r.systemScore}, Head=${r.headRating}, Final=${r.finalScore}, EOD=${JSON.stringify(r.eodData)}`);
  }

  await prisma.$disconnect();
}

main().catch(console.error);
