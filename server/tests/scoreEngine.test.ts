import {
  parseScoreHelper,
  calculateEmployeeDailyFinalScore,
  calculateDateBaseAverage,
  calculateSuperAdminFinalScore,
  calculateOrganizationAverage,
} from '../src/utils/scoreEngine';

describe('Scoring Engine Logic & Business Rules', () => {
  describe('parseScoreHelper', () => {
    it('should parse simple integers', () => {
      expect(parseScoreHelper(85)).toBe(85);
      expect(parseScoreHelper('90')).toBe(90);
    });

    it('should strip % symbols and handle string numbers', () => {
      expect(parseScoreHelper('85%')).toBe(85);
      expect(parseScoreHelper(' 92.4% ')).toBe(92);
    });

    it('should convert decimals (0.0 < x <= 1.0) to percentage integers', () => {
      expect(parseScoreHelper(0.86)).toBe(86);
      expect(parseScoreHelper('0.946')).toBe(95);
    });

    it('should safely return 0 for empty or invalid values', () => {
      expect(parseScoreHelper('')).toBe(0);
      expect(parseScoreHelper(null)).toBe(0);
      expect(parseScoreHelper(undefined)).toBe(0);
      expect(parseScoreHelper('N/A')).toBe(0);
    });
  });

  describe('calculateEmployeeDailyFinalScore', () => {
    it('should use explicit head rating when present', () => {
      const result = calculateEmployeeDailyFinalScore('80%', '110', '', new Date());
      expect(result.sysScore).toBe(80);
      expect(result.finalScore).toBe(88); // 80 * 1.10 = 88
      expect(result.isAutoApproved).toBe(false);
    });

    it('should auto-approve after 24 hours when no rating is set', () => {
      const past25Hours = new Date(Date.now() - 25 * 60 * 60 * 1000);
      const result = calculateEmployeeDailyFinalScore('85%', '', '', past25Hours);
      expect(result.sysScore).toBe(85);
      expect(result.finalScore).toBe(85);
      expect(result.isAutoApproved).toBe(true);
    });

    it('should default to system score if pending within 24 hours', () => {
      const past2Hours = new Date(Date.now() - 2 * 60 * 60 * 1000);
      const result = calculateEmployeeDailyFinalScore('90%', '', '', past2Hours);
      expect(result.sysScore).toBe(90);
      expect(result.finalScore).toBe(90);
      expect(result.isAutoApproved).toBe(false);
    });
  });

  describe('Super Admin Multipliers & Department Averages', () => {
    it('should calculate base average correctly', () => {
      const scores = [80, 90, 85];
      expect(calculateDateBaseAverage(scores)).toBe(85);
    });

    it('should calculate Super Admin final score with multiplier', () => {
      expect(calculateSuperAdminFinalScore(86, 100)).toBe(86);
      expect(calculateSuperAdminFinalScore(86, 110)).toBe(95); // 86 * 1.1 = 94.6 -> 95
      expect(calculateSuperAdminFinalScore(80, 50)).toBe(40);
    });

    it('should calculate overall organization average correctly', () => {
      const allScores = [70, 80, 90, 100];
      expect(calculateOrganizationAverage(allScores)).toBe(85);
    });
  });
});
