import { describe, it, expect } from 'vitest';
import type { AccountType } from '@prisma/client';
import { checkAllocationSum, checkPaymentAccounts, RuleAccount } from '../../server/src/services/allocation.rules.js';
import { AppError } from '../../server/src/middleware/error.middleware.js';

const MAX = 10_000_000_000n; // 100,000,000.00 THB

let nextId = 0;
const account = (type: AccountType, isArchived = false): RuleAccount => ({
  id: `acc-${++nextId}`,
  type,
  isArchived,
});

/** The AppError code thrown by `fn`, or null when it does not throw. */
function thrownCode(fn: () => void): string | null {
  try {
    fn();
    return null;
  } catch (error) {
    if (error instanceof AppError) return error.code;
    throw error;
  }
}

describe('F-05 Payment and Charge (unit rules)', () => {
  it('TEST-05.4 (AC-05.4): a line sum that differs from the total is rejected with INVALID_ALLOCATION_SUM', () => {
    // 1,200.00 THB total, lines 600.00 + 400.00 = 1,000.00 THB.
    expect(thrownCode(() => checkAllocationSum(120_000n, [60_000n, 40_000n]))).toBe('INVALID_ALLOCATION_SUM');
    // Over-allocated by one satang.
    expect(thrownCode(() => checkAllocationSum(120_000n, [70_000n, 50_001n]))).toBe('INVALID_ALLOCATION_SUM');
    // Exact match passes.
    expect(thrownCode(() => checkAllocationSum(120_000n, [70_000n, 50_000n]))).toBeNull();
  });

  it('TEST-05.4 (AC-05.4): the sum is exact in satang even beyond the safe-integer range', () => {
    // 1,000 max-size lines sum to 1e13 satang; the total is the max, so it must not match.
    const lines = Array.from({ length: 1_000 }, () => MAX);
    expect(thrownCode(() => checkAllocationSum(MAX, lines))).toBe('INVALID_ALLOCATION_SUM');
    expect(thrownCode(() => checkAllocationSum(MAX, [MAX - 1n, 1n]))).toBeNull();
  });

  it('TEST-05.13 (AC-05.13): only the Sprint 1 target matrix is accepted (Cash → Expense or Loan Taken; Loan Taken → Expense)', () => {
    const allowed: Record<'CASH' | 'LOAN_TAKEN', AccountType[]> = {
      CASH: ['EXPENSE', 'LOAN_TAKEN'],
      LOAN_TAKEN: ['EXPENSE'],
    };
    const allTypes: AccountType[] = ['CASH', 'LOAN_TAKEN', 'LOAN_GIVEN', 'INCOME', 'EXPENSE'];

    for (const sourceType of ['CASH', 'LOAN_TAKEN'] as const) {
      for (const targetType of allTypes) {
        const code = thrownCode(() => checkPaymentAccounts(account(sourceType), [account(targetType)]));
        const label = `${sourceType} → ${targetType}`;
        expect(code, label).toBe(allowed[sourceType].includes(targetType) ? null : 'INVALID_TARGET_ACCOUNT');
      }
    }
  });

  it('TEST-05.13 (AC-05.13): an archived target or the source as its own target is rejected with INVALID_TARGET_ACCOUNT', () => {
    const bank = account('CASH');
    expect(thrownCode(() => checkPaymentAccounts(bank, [account('EXPENSE', true)]))).toBe('INVALID_TARGET_ACCOUNT');

    const card = account('LOAN_TAKEN');
    expect(thrownCode(() => checkPaymentAccounts(card, [account('EXPENSE'), card]))).toBe('INVALID_TARGET_ACCOUNT');

    // One bad line among good ones is enough to reject the whole transaction.
    expect(
      thrownCode(() => checkPaymentAccounts(bank, [account('EXPENSE'), account('EXPENSE'), account('INCOME')]))
    ).toBe('INVALID_TARGET_ACCOUNT');
  });

  it('BR-16: Income, Expense and Loan Given sources are rejected with INVALID_SOURCE_ACCOUNT', () => {
    for (const type of ['INCOME', 'EXPENSE', 'LOAN_GIVEN'] as const) {
      expect(thrownCode(() => checkPaymentAccounts(account(type), [account('EXPENSE')])), type).toBe(
        'INVALID_SOURCE_ACCOUNT'
      );
    }
  });

  it('BR-14: an archived source is rejected with VALIDATION_ERROR', () => {
    expect(thrownCode(() => checkPaymentAccounts(account('CASH', true), [account('EXPENSE')]))).toBe(
      'VALIDATION_ERROR'
    );
  });
});
