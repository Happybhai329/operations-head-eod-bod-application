const { google } = require('googleapis');
const keyPath = 'D:/prime/standard-gcp-project-485906-275666f71217.json';
const auth = new google.auth.GoogleAuth({ keyFile: keyPath, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
const sheets = google.sheets({ version: 'v4', auth });

async function check11thSept() {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: '1IFGc0kvv9LpbZUfEGroY8PevevJ8axdPApVrLjidlw8',
    range: 'Daily_Reports!A:Z'
  });
  const rows = res.data.values || [];
  const rows11th = [];
  rows.forEach((r, idx) => {
    const d = (r[0] || '').replace("'", '').trim();
    if (d === '11/09/2026') {
      rows11th.push({
        rowIdx: idx + 1,
        empId: r[1],
        dept: r[2],
        dailyScoreCol5: r[5],
        lastUpdatedCol6: r[6],
        headRatingCol7: r[7],
        finalScoreCol8: r[8],
        col11: r[11],
        approvalStatusCol13: r[13]
      });
    }
  });
  console.log('Total rows for 11/09/2026:', rows11th.length);
  console.table(rows11th);
}

check11thSept().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
