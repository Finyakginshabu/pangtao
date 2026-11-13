import { describe, it, expect } from 'vitest';
import { OpeningBalanceBodySchema } from '../../server/src/schemas/opening-balance.schema.js';
import { isFutureDate, todayInTimeZone } from '../../server/src/utils/date.util.js';
import { parseThbToSatang } from '../../web/src/utils/money.js';

const DATE = '2026-11-01';
const BANGKOK = 'Asia/Bangkok';

describe('F-04 Opening Balance (unit rules)', () => {
  it('TEST-04.3 (AC-04.3): the amount schema accepts 0 and the maximum, and rejects everything outside BR-04', () => {
    expect(OpeningBalanceBodySchema.safeParse({ amount: 0, date: DATE }).success).toBe(true);
    expect(OpeningBalanceBodySchema.safeParse({ amount: 10_000_000_000, date: DATE }).success).toBe(true);

    for (const amount of [-1, 10_000_000_001, 1.5, Number.NaN, '5000000', null]) {
      expect(OpeningBalanceBodySchema.safeParse({ amount, date: DATE }).success, String(amount)).toBe(false);
    }
  });

  it('TEST-04.6 (AC-04.6): the future-date rule follows the Bangkok calendar, including the midnight boundary', () => {
    // 2026-11-12T10:00Z = 17:00 in Bangkok on 12 Nov.
    const afternoon = new Date('2026-11-12T10:00:00Z');
    expect(todayInTimeZone(BANGKOK, afternoon)).toBe('2026-11-12');
    expect(isFutureDate('2026-11-12', BANGKOK, afternoon)).toBe(false);
    expect(isFutureDate('2026-11-13', BANGKOK, afternoon)).toBe(true);
    expect(isFutureDate('2026-10-31', BANGKOK, afternoon)).toBe(false);

    // 2026-11-12T17:30Z = 00:30 in Bangkok on 13 Nov: the Bangkok day has already rolled over.
    const afterMidnight = new Date('2026-11-12T17:30:00Z');
    expect(todayInTimeZone(BANGKOK, afterMidnight)).toBe('2026-11-13');
    expect(isFutureDate('2026-11-13', BANGKOK, afterMidnight)).toBe(false);
    expect(isFutureDate('2026-11-14', BANGKOK, afterMidnight)).toBe(true);
  });

  it('TEST-04.6 (AC-04.6): the schema rejects malformed and impossible calendar dates', () => {
    for (const date of ['01-11-2026', '2026-02-30', '2026-11-1', '2026-13-01', '']) {
      expect(OpeningBalanceBodySchema.safeParse({ amount: 100, date }).success, date).toBe(false);
    }
  });

  it('converts THB input to integer satang without floating-point arithmetic', () => {
    expect(parseThbToSatang('50000')).toBe(5_000_000);
    expect(parseThbToSatang('50000.5')).toBe(5_000_050);
    expect(parseThbToSatang('50000.05')).toBe(5_000_005);
    expect(parseThbToSatang('0.01')).toBe(1);
    expect(parseThbToSatang('0')).toBe(0);
    expect(parseThbToSatang('1,000.50')).toBe(100_050);
    expect(parseThbToSatang(' 250 ')).toBe(25_000);

    for (const input of ['-1', '1.234', 'abc', '', '.', '1,00,0.5.5']) {
      expect(parseThbToSatang(input), input).toBeNull();
    }
  });
});
