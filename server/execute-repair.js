const { PrismaClient } = require('@prisma/client');
const { google } = require('googleapis');
const fs = require('fs');

const prisma = new PrismaClient();

function getSafeNonNegativeNumber(value, fallback = 0) {
  if (value === null || value === undefined || value === '') return fallback;
  const numericValue = Number(value);
  const parsedValue = parseFloat(value);
  if (isNaN(numericValue) || isNaN(parsedValue) || !isFinite(numericValue)) return fallback;
  return Math.max(0, numericValue);
}

function clampNumber(value, min, max, fallback) {
  const numericValue = Number(value);
  const parsedValue = parseFloat(value);
  if (isNaN(numericValue) || isNaN(parsedValue) || !isFinite(numericValue)) return fallback;
  return Math.min(max, Math.max(min, numericValue));
}

function calculatePerformanceRobust(bodObj, eodObj) {
  try {
    if (!eodObj || typeof eodObj !== 'object') return 0;
    const scores = [];

    for (const key in eodObj) {
      if (!Object.prototype.hasOwnProperty.call(eodObj, key)) continue;
      const eTask = eodObj[key];
      if (!eTask || typeof eTask !== 'object') continue;

      const bTask = (bodObj && bodObj[key] && typeof bodObj[key] === 'object') ? bodObj[key] : {};
      let target = getSafeNonNegativeNumber(bTask.value, 1);
      let achieved = 0;

      if (eTask.type === 'dynamicList') {
        let targetSum = 0;
        let achievedSum = 0;
        const taskList = Array.isArray(eTask.list) ? eTask.list : [];

        taskList.forEach(item => {
          if (!item || typeof item !== 'object') return;
          const hasNumberTarget = (item.hasTarget === true || item.hasTarget === 'true') && item.target !== '' && item.target !== undefined && item.target !== null;
          const itemTarget = hasNumberTarget ? getSafeNonNegativeNumber(item.target, 1) : 1;

          let itemAchieved = 0;
          if (hasNumberTarget) {
            const numAchieved = getSafeNonNegativeNumber(item.achieved, 0);
            itemAchieved = (numAchieved > 0) ? numAchieved : (item.status === 'Done' ? itemTarget : 0);
          } else {
            itemAchieved = (item.status === 'Done' || item.achieved === 'Done' || item.achieved === '1') ? 1 : 0;
          }

          if (item.isVoluntary) {
            achievedSum += itemAchieved;
          } else {
            targetSum += itemTarget;
            achievedSum += itemAchieved;
          }
        });
        target = targetSum;
        achieved = achievedSum;
      } else if (eTask.type === 'checkbox') {
        achieved = (eTask.status === 'Done' || eTask.value === '1' || eTask.value === 1 || String(eTask.value).toLowerCase() === 'yes') ? target : 0;
      } else if (eTask.type === 'number') {
        achieved = getSafeNonNegativeNumber(eTask.value, 0);
      } else if (eTask.type === 'categoryNumber') {
        if (eTask.value !== undefined && eTask.value !== null && eTask.value !== '') {
          achieved = getSafeNonNegativeNumber(eTask.value, 0);
        } else if (eTask.subCategories && typeof eTask.subCategories === 'object') {
          for (const category in eTask.subCategories) {
            achieved += getSafeNonNegativeNumber(eTask.subCategories[category], 0);
          }
        }
      }

      const percentage = target <= 0 ? (achieved >= 0 ? 100 : 0) : (achieved / target) * 100;
      scores.push(clampNumber(percentage, 0, 100, 0));
    }

    if (scores.length === 0) return 0;
    const total = scores.reduce((sum, s) => sum + clampNumber(s, 0, 100, 0), 0);
    return Math.round(clampNumber(total / scores.length, 0, 100, 0));
  } catch (error) {
    return 0;
  }
}

function normalizeDate(d) {
  if (!d) return '';
  const s = String(d).trim().replace(/'/g, '');
  const parts = s.split('/');
  if (parts.length === 3) {
    const day = parts[0].padStart(2, '0');
    const month = parts[1].padStart(2, '0');
    const year = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
    return `${day}/${month}/${year}`;
  }
  return s;
}

async function executeRepair() {
  console.log('🚀 Starting Data Repair Process across Supabase PostgreSQL and Google Sheets...');

  // 1. Authenticate with Google Sheets
  const creds = JSON.parse(fs.readFileSync('D:/prime/standard-gcp-project-485906-275666f71217.json', 'utf8'));
  const auth = new google.auth.JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const sheets = google.sheets({ version: 'v4', auth });
  const spreadsheetId = '1IFGc0kvv9LpbZUfEGroY8PevevJ8axdPApVrLjidlw8';

  // 2. Fetch sheet rows and verify headers
  const sheetRes = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: 'Daily_Reports!A:I',
  });
  const sheetRows = sheetRes.data.values || [];
  const initialHeaders = sheetRows[0];
  console.log(`📋 Read ${sheetRows.length} rows from Google Sheets Daily_Reports.`);
  console.log(`🔒 Initial Headers locked: Row 1 will NOT be modified.`);

  // 3. Fetch all daily reports from Supabase
  const dbReports = await prisma.dailyReport.findMany();
  console.log(`📦 Read ${dbReports.length} records from Supabase daily_reports.`);

  const repairList = [];
  const sheetUpdates = [];

  for (const r of dbReports) {
    let eod = r.eodData;
    if (typeof eod === 'string') {
      try { eod = JSON.parse(eod); } catch (_) {}
    }
    const hasEOD = eod && typeof eod === 'object' && Object.keys(eod).length > 0;
    if (!hasEOD) continue;

    let bod = r.bodData;
    if (typeof bod === 'string') {
      try { bod = JSON.parse(bod); } catch (_) {}
    }

    const recomputedScore = calculatePerformanceRobust(bod, eod);

    // If systemScore is 0 but recomputedScore > 0
    if (r.systemScore === 0 && recomputedScore > 0) {
      let finalScore = recomputedScore;
      if (r.headRating && r.headRating !== '' && r.headRating !== 'Auto') {
        const ratingNum = parseFloat(r.headRating);
        if (!isNaN(ratingNum)) {
          finalScore = Math.round((recomputedScore * ratingNum) / 100);
        }
      }

      repairList.push({
        id: r.id,
        date: r.reportDate,
        empId: r.employeeId,
        dept: r.departmentName,
        oldSysScore: r.systemScore,
        newSysScore: recomputedScore,
        headRating: r.headRating,
        oldFinalScore: r.finalScore,
        newFinalScore: finalScore
      });

      // Find matching row in Google Sheets (Row index >= 2, strictly excluding Row 1)
      const targetDate = normalizeDate(r.reportDate);
      const targetEmp = r.employeeId.trim().toUpperCase();

      for (let i = 1; i < sheetRows.length; i++) {
        const sRow = sheetRows[i];
        if (!sRow || !sRow[0] || !sRow[1]) continue;
        const sDate = normalizeDate(sRow[0]);
        const sEmp = String(sRow[1]).trim().toUpperCase();

        if (sDate === targetDate && sEmp === targetEmp) {
          const rowIndex = i + 1; // 1-indexed sheet row number (>= 2)
          // Column F is Daily_Score_%, Column I is Final_Score_%
          sheetUpdates.push({
            range: `Daily_Reports!F${rowIndex}`,
            values: [[recomputedScore]]
          });
          sheetUpdates.push({
            range: `Daily_Reports!I${rowIndex}`,
            values: [[finalScore]]
          });
          break;
        }
      }
    }
  }

  console.log(`\n🎯 Identified ${repairList.length} anomalous reports to repair!`);
  console.table(repairList.map(item => ({
    Date: item.date,
    Employee: item.empId,
    Dept: item.dept,
    'Old Sys': item.oldSysScore,
    'New Sys': item.newSysScore,
    'Head Rating': item.headRating || 'Auto',
    'Old Final': item.oldFinalScore,
    'New Final': item.newFinalScore
  })));

  // 4. Update Supabase PostgreSQL records
  console.log('\n🔄 Updating Supabase PostgreSQL records...');
  for (const item of repairList) {
    await prisma.dailyReport.update({
      where: { id: item.id },
      data: {
        systemScore: item.newSysScore,
        finalScore: item.newFinalScore,
        lastUpdated: new Date()
      }
    });
  }
  console.log(`✅ Successfully updated ${repairList.length} records in Supabase!`);

  // 5. Update Google Sheets strictly targeting rows >= 2 (Columns F and I)
  if (sheetUpdates.length > 0) {
    console.log(`\n📤 Updating Google Sheets (${sheetUpdates.length} cell updates)...`);
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: {
        valueInputOption: 'USER_ENTERED',
        data: sheetUpdates
      }
    });
    console.log(`✅ Successfully updated ${sheetUpdates.length / 2} rows in Google Sheets Daily_Reports!`);
  }

  // 6. Verify Header Row 1 integrity
  const verifyRes = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: 'Daily_Reports!1:1',
  });
  const finalHeaders = verifyRes.data.values ? verifyRes.data.values[0] : [];
  if (JSON.stringify(initialHeaders) !== JSON.stringify(finalHeaders)) {
    throw new Error('❌ CRITICAL ERROR: Header row was modified during update!');
  }
  console.log('🔒 VERIFIED: Header Row 1 was completely untouched and remains 100% intact!');

  console.log('\n🎉 ALL REPAIRS COMPLETED SUCCESSFULLY!');
  await prisma.$disconnect();
}

executeRepair().catch(err => {
  console.error('Fatal repair error:', err);
  process.exit(1);
});
