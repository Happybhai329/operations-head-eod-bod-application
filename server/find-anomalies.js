const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// calculatePerformance function
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

function calculatePerformance(bodObj, eodObj) {
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
          const hasNumberTarget = item.hasTarget === true || item.hasTarget === 'true' || item.hasTarget === undefined;
          const itemTarget = hasNumberTarget ? getSafeNonNegativeNumber(item.target, 1) : 1;
          const itemAchieved = hasNumberTarget ? getSafeNonNegativeNumber(item.achieved, 0) : (item.status === 'Done' ? 1 : 0);

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
        achieved = eTask.status === 'Done' ? target : 0;
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

async function findZeroScoreAnomalies() {
  const reports = await prisma.dailyReport.findMany({
    orderBy: { createdAt: 'desc' }
  });

  console.log(`Checking ${reports.length} total reports for 0 score anomalies...`);

  const anomalies = [];
  for (const r of reports) {
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

    const recomputed = calculatePerformance(bod, eod);

    // If recorded score is 0 but recomputed score > 0
    if (r.systemScore === 0 && recomputed > 0) {
      anomalies.push({
        id: r.id,
        date: r.reportDate,
        empId: r.employeeId,
        dept: r.departmentName,
        dbSysScore: r.systemScore,
        dbHeadRating: r.headRating,
        dbFinalScore: r.finalScore,
        recomputedScore: recomputed
      });
    }
  }

  console.log(`Found ${anomalies.length} anomalies where db was 0 but recomputed is > 0:`);
  console.table(anomalies);

  await prisma.$disconnect();
}

findZeroScoreAnomalies().catch(console.error);
