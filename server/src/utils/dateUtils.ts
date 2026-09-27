/**
 * Date utilities reproducing exact Google Apps Script date handling logic
 */

/**
 * Converts various cell date representations (Date object, Excel serial number, string)
 * into a standardized DD/MM/YYYY string.
 */
export function dateToDDMMYYYY(cellValue: any): string {
  if (!cellValue) {
    const d = new Date();
    return ("0" + d.getDate()).slice(-2) + "/" + ("0" + (d.getMonth() + 1)).slice(-2) + "/" + d.getFullYear();
  }

  let d: Date;
  if (cellValue instanceof Date) {
    d = cellValue;
  } else if (typeof cellValue === 'string' && cellValue.includes('/')) {
    const parts = cellValue.trim().split('/');
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const year = parseInt(parts[2], 10);
      d = new Date(year, month, day);
    } else {
      d = new Date(cellValue);
    }
  } else if (typeof cellValue === 'string' && cellValue.includes('-')) {
    // YYYY-MM-DD or DD-MM-YYYY format
    const parts = cellValue.trim().split('-');
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      } else if (parts[2].length === 4) {
        d = new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
      } else {
        d = new Date(cellValue);
      }
    } else {
      d = new Date(cellValue);
    }
  } else if (typeof cellValue === 'number') {
    // Google Sheets / Excel serial timestamp
    d = new Date((cellValue - 25569) * 86400 * 1000);
  } else {
    d = new Date(cellValue);
  }

  if (isNaN(d.getTime())) {
    const fallback = new Date();
    return ("0" + fallback.getDate()).slice(-2) + "/" + ("0" + (fallback.getMonth() + 1)).slice(-2) + "/" + fallback.getFullYear();
  }

  return ("0" + d.getDate()).slice(-2) + "/" + ("0" + (d.getMonth() + 1)).slice(-2) + "/" + d.getFullYear();
}

/**
 * Safely parses any date/datetime representation (Date object, ISO string, Indian DD/MM/YYYY HH:mm:ss, DD-MM-YYYY, etc.)
 * into a valid Date object. Never returns an Invalid Date (falls back to new Date()).
 */
export function parseSafeDate(val: any): Date {
  if (!val) return new Date();
  if (val instanceof Date && !isNaN(val.getTime())) return val;
  const str = String(val).trim();
  if (!str) return new Date();

  // Match DD/MM/YYYY or DD-MM-YYYY (with optional HH:mm:ss)
  const match = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
  if (match) {
    const day = parseInt(match[1], 10);
    const month = parseInt(match[2], 10) - 1;
    const year = parseInt(match[3], 10);
    const hour = match[4] ? parseInt(match[4], 10) : 0;
    const min = match[5] ? parseInt(match[5], 10) : 0;
    const sec = match[6] ? parseInt(match[6], 10) : 0;
    const d = new Date(year, month, day, hour, min, sec);
    if (!isNaN(d.getTime())) return d;
  }

  const d = new Date(str);
  return isNaN(d.getTime()) ? new Date() : d;
}

/**
 * Converts DD/MM/YYYY string to epoch milliseconds at midnight.
 */
export function getTimeFromDDMMYYYY(str: string | null | undefined): number {
  if (!str || typeof str !== 'string' || !str.includes('/')) return 0;
  const parts = str.trim().split('/');
  if (parts.length < 3) return 0;
  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const year = parseInt(parts[2], 10);
  const d = new Date(year, month, day);
  return isNaN(d.getTime()) ? 0 : d.getTime();
}

/**
 * Parses DD/MM/YYYY into a Date object.
 */
export function parseDateDDMMYYYY(dateStr: string | null | undefined): Date {
  if (!dateStr || typeof dateStr !== 'string') return new Date(0);
  const parts = dateStr.trim().split('/');
  if (parts.length !== 3) return new Date(dateStr);
  return new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
}

export interface DateFilter {
  type: 'Daily' | 'Weekly' | 'Monthly' | 'Custom';
  start?: string; // YYYY-MM-DD or DD/MM/YYYY
  end?: string;   // YYYY-MM-DD or DD/MM/YYYY
}

export interface DateRange {
  startTime: number;
  endTime: number;
}

/**
 * Calculates start and end timestamps matching the original Apps Script logic:
 * - Daily: Start of today (00:00:00.000) to End of today (23:59:59.999)
 * - Weekly: Today - 7 days to End of today
 * - Monthly: Today - 30 days to End of today
 * - Custom: Selected start 00:00:00 to selected end 23:59:59.999
 */
export function calculateDateRange(filter: DateFilter): DateRange {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let endTime = today.getTime() + 86400000 - 1; // 23:59:59.999 of today
  let startTime: number;

  switch (filter.type) {
    case 'Daily':
      if (filter.start) {
        const d = parseSafeDate(filter.start);
        d.setHours(0, 0, 0, 0);
        startTime = d.getTime();
        endTime = d.getTime() + 86400000 - 1;
      } else {
        startTime = today.getTime();
      }
      break;
    case 'Weekly':
      startTime = today.getTime() - (7 * 86400000);
      break;
    case 'Monthly':
      startTime = today.getTime() - (30 * 86400000);
      break;
    case 'Custom':
      if (filter.start && filter.end) {
        const s = parseSafeDate(filter.start);
        s.setHours(0, 0, 0, 0);
        const e = parseSafeDate(filter.end);
        e.setHours(23, 59, 59, 999);
        startTime = s.getTime();
        endTime = e.getTime();
      } else if (filter.start) {
        const s = parseSafeDate(filter.start);
        s.setHours(0, 0, 0, 0);
        startTime = s.getTime();
        endTime = today.getTime() + 86400000 - 1;
      } else {
        startTime = today.getTime() - (7 * 86400000);
      }
      break;
    default:
      startTime = new Date(2000, 0, 1).getTime();
  }

  if (startTime > endTime) {
    const temp = startTime;
    startTime = endTime;
    endTime = temp;
  }

  return { startTime, endTime };
}
