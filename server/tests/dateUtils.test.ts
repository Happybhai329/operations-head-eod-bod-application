import { dateToDDMMYYYY, getTimeFromDDMMYYYY, calculateDateRange } from '../src/utils/dateUtils';

describe('Date Utilities', () => {
  it('should format Date objects to DD/MM/YYYY', () => {
    const d = new Date(2026, 7, 16); // August 16, 2026
    expect(dateToDDMMYYYY(d)).toBe('16/08/2026');
  });

  it('should parse YYYY-MM-DD string to DD/MM/YYYY', () => {
    expect(dateToDDMMYYYY('2026-08-16')).toBe('16/08/2026');
  });

  it('should parse DD/MM/YYYY string to epoch timestamp at midnight', () => {
    const ts = getTimeFromDDMMYYYY('16/08/2026');
    const d = new Date(ts);
    expect(d.getDate()).toBe(16);
    expect(d.getMonth()).toBe(7); // 0-indexed month 7 = August
    expect(d.getFullYear()).toBe(2026);
  });

  it('should compute Daily, Weekly, Monthly date ranges correctly', () => {
    const daily = calculateDateRange({ type: 'Daily' });
    expect(daily.endTime - daily.startTime).toBe(86400000 - 1);

    const weekly = calculateDateRange({ type: 'Weekly' });
    expect(weekly.endTime - weekly.startTime).toBeGreaterThan(6 * 86400000);

    const monthly = calculateDateRange({ type: 'Monthly' });
    expect(monthly.endTime - monthly.startTime).toBeGreaterThan(29 * 86400000);
  });
});
