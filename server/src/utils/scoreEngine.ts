import { parseSafeDate } from './dateUtils';

/**
 * Exact Scoring & Analytics Engine for The Prime Classes
 * Preserves 100% parity with Google Apps Script formulas and rules
 */

/**
 * Parses raw scores, removing %, handling decimals (0.85 -> 85), and rounding.
 */
export function parseScoreHelper(val: any): number {
  if (val === "" || val === null || val === undefined) return 0;
  const p = parseFloat(val.toString().replace('%', '').trim());
  if (isNaN(p)) return 0;
  let score = p;
  if (score > 0 && score <= 1.0) {
    score = score * 100;
  }
  return Math.round(score);
}

export function getSafeNonNegativeNumber(value: any, fallback = 0): number {
  if (value === null || value === undefined || value === '') return fallback;
  const numericValue = Number(value);
  const parsedValue = parseFloat(value);
  if (isNaN(numericValue) || isNaN(parsedValue) || !isFinite(numericValue)) return fallback;
  return Math.max(0, numericValue);
}

export function clampNumber(value: any, min: number, max: number, fallback = 0): number {
  const numericValue = Number(value);
  const parsedValue = parseFloat(value);
  if (isNaN(numericValue) || isNaN(parsedValue) || !isFinite(numericValue)) return fallback;
  return Math.min(max, Math.max(min, numericValue));
}

/**
 * Calculates raw system score from BOD and EOD task objects.
 * Matches Google Apps Script calculatePerformance rules.
 */
export function calculatePerformance(bodObj: any, eodObj: any): number {
  try {
    if (!eodObj || typeof eodObj !== 'object') return 0;
    const scores: number[] = [];

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

        taskList.forEach((item: any) => {
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

/**
 * Computes an employee's daily final score considering Head Rating and 24h auto-approval.
 * If rawSysScore is 0 but eodData is present, it dynamically computes the true performance score.
 */
export function calculateEmployeeDailyFinalScore(
  rawSysScore: any,
  rawHeadRating: string | number | null | undefined,
  rawFinalScoreStr: any,
  lastUpdatedDate: any = new Date(),
  bodData?: any,
  eodData?: any,
  approvalStatus?: string | null
): { sysScore: number; finalScore: number; isAutoApproved: boolean } {
  let sysScore = parseScoreHelper(rawSysScore);

  // Auto-recovery: If rawSysScore is 0 or empty, but eodData has submitted tasks, compute the actual score!
  if (sysScore === 0 && eodData && typeof eodData === 'object' && Object.keys(eodData).length > 0) {
    const computed = calculatePerformance(bodData, eodData);
    if (computed > 0) {
      sysScore = computed;
    }
  }

  const safeDate = parseSafeDate(lastUpdatedDate);
  const hoursSinceUpdate = (Date.now() - safeDate.getTime()) / (1000 * 60 * 60);

  let finalScore = sysScore;
  let isAutoApproved = false;

  const ratingStr = rawHeadRating !== null && rawHeadRating !== undefined ? String(rawHeadRating).trim() : '';
  const statusStr = approvalStatus !== null && approvalStatus !== undefined ? String(approvalStatus).trim() : '';

  // Explicit approval from status column or auto-approval rules
  if (statusStr === 'Auto Approved' || ratingStr === 'Auto') {
    isAutoApproved = true;
    finalScore = sysScore;
  } else if ((!ratingStr || ratingStr === '') && statusStr !== 'Approved' && hoursSinceUpdate >= 24) {
    isAutoApproved = true;
    finalScore = sysScore;
  } else if (statusStr === 'Approved' || ratingStr !== '') {
    const parsedRating = parseFloat(ratingStr);
    const explicitFinal = parseScoreHelper(rawFinalScoreStr);
    finalScore =
      explicitFinal > 0
        ? explicitFinal
        : !isNaN(parsedRating)
        ? Math.round((sysScore * parsedRating) / 100)
        : sysScore;

    if (statusStr !== 'Approved' && parsedRating === 100 && hoursSinceUpdate >= 24) {
      isAutoApproved = true;
    }
  } else {
    finalScore = sysScore;
  }

  return { sysScore, finalScore, isAutoApproved };
}

/**
 * Calculates base average for a set of scores on a specific date.
 */
export function calculateDateBaseAverage(scores: number[]): number {
  if (!scores || scores.length === 0) return 0;
  const sum = scores.reduce((acc, curr) => acc + curr, 0);
  return Math.round(sum / scores.length);
}

/**
 * Calculates Super Admin final department head score applying the admin multiplier.
 */
export function calculateSuperAdminFinalScore(baseAvg: number, adminRating: number | string): number {
  const ratingNum = typeof adminRating === 'string' ? parseFloat(adminRating) : adminRating;
  if (isNaN(ratingNum)) return baseAvg;
  return Math.round((baseAvg * ratingNum) / 100);
}

/**
 * Computes department average over multiple dates.
 */
export function calculateDepartmentPeriodAverage(dailyFinalAverages: number[]): number {
  if (!dailyFinalAverages || dailyFinalAverages.length === 0) return 0;
  const sum = dailyFinalAverages.reduce((acc, curr) => acc + curr, 0);
  return Math.round(sum / dailyFinalAverages.length);
}

/**
 * Computes overall organization average across all submitted reports in range.
 */
export function calculateOrganizationAverage(allScores: number[]): number {
  if (!allScores || allScores.length === 0) return 0;
  const sum = allScores.reduce((acc, curr) => acc + curr, 0);
  return Math.round(sum / allScores.length);
}
