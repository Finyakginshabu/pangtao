import { describe, it, expect } from 'vitest';
import {
  type LedgerAccount,
  type LedgerTransaction,
} from '../../server/src/services/balance.engine.js';
import { computeIncomeExpense } from '../../server/src/services/summary.engine.js';
import { currentMonthRange } from '../../server/src/utils/date.util.js';

// Pure engine only: no database, no network (STS level U).

const ACCOUNTS: LedgerAccount[] = [
  { id: 'wallet', type: 'CASH' },
  { id: 'bank', type: 'CASH' },
  { id: 'card', type: 'LOAN_TAKEN' },
  { id: 'loan-carol', type: 'LOAN_GIVEN' },
  { id: 'salary', type: 'INCOME' },
  { id: 'interest', type: 'INCOME' },
  { id: 'dining', type: 'EXPENSE' },
  { id: 'groceries', type: 'EXPENSE' },
  { id: 'telecom', type: 'EXPENSE' },
];

const txn = (
  kind: LedgerTransaction['kind'],
  accountId: string,
  totalAmount: bigint,
  lines: Array<[string, bigint]> = [],
  voidedAt: Date | null = null
): LedgerTransaction => ({
  kind,
  accountId,
  totalAmount,
  voidedAt,
  lines: lines.map(([targetAccountId, amount]) => ({ targetAccountId, amount })),
});

// Contract demo dataset (f-08 TEST-08.1): opening 50,000.00, salary 30,000.00,
// card charge 1,200.00 (Dining 700.00 + Groceries 500.00), repayment 800.00.
const DEMO_LEDGER: LedgerTransaction[] = [
  txn('OPENING_BALANCE', 'bank', 5_000_000n),
  txn('RECEIPT', 'bank', 3_000_000n, [['salary', 3_000_000n]]),
  txn('PAYMENT', 'card', 120_000n, [
    ['dining', 70_000n],
    ['groceries', 50_000n],
  ]),
  txn('PAYMENT', 'bank', 80_000n, [['card', 80_000n]]),
];

describe('F-08 Income and Expense Summary (STS)', () => {
  it('TEST-08.2 (AC-08.3): opening balances and card repayments are excluded from income and expenses', () => {
    const totals = computeIncomeExpense(ACCOUNTS, DEMO_LEDGER);

    expect(totals.income).toBe(3_000_000n); // 30,000.00 THB, not 50,000.00 opening
    expect(totals.expense).toBe(120_000n); // 1,200.00 THB, not 800.00 repayment
    expect(totals.net).toBe(2_880_000n); // 28,800.00 THB
  });

  it('TEST-08.6 (AC-08.3): only lines targeting Income or Expense count; Loan Taken and Cash lines are filtered out', () => {
    const totals = computeIncomeExpense(ACCOUNTS, [
      txn('RECEIPT', 'bank', 100_000n, [['salary', 100_000n]]), // income
      txn('PAYMENT', 'card', 40_000n, [['dining', 40_000n]]), // expense
      txn('PAYMENT', 'bank', 30_000n, [['card', 30_000n]]), // card repayment
      txn('PAYMENT', 'bank', 20_000n, [['wallet', 20_000n]]), // transfer
      txn('RECEIPT', 'bank', 10_000n, [['loan-carol', 10_000n]]), // loan repayment received
      txn('OPENING_BALANCE', 'bank', 999_999n), // no allocation lines
      txn('PAYMENT', 'bank', 777_777n, [['telecom', 777_777n]], new Date('2026-11-05T00:00:00Z')), // voided
    ]);

    expect(totals.income).toBe(100_000n);
    expect(totals.expense).toBe(40_000n);
    expect(totals.net).toBe(60_000n);
  });
});

describe('F-08 summary engine: further rules', () => {
  it('returns zero totals for an empty ledger', () => {
    const totals = computeIncomeExpense(ACCOUNTS, []);
    expect(totals).toEqual({ income: 0n, expense: 0n, net: 0n });
  });

  it('counts every allocation line and keeps net exactly income minus expense, including a negative net', () => {
    const totals = computeIncomeExpense(ACCOUNTS, [
      txn('RECEIPT', 'bank', 5_000n, [
        ['salary', 3_000n],
        ['interest', 2_000n],
      ]),
      txn('PAYMENT', 'card', 9_500n, [
        ['dining', 4_500n],
        ['groceries', 3_000n],
        ['telecom', 2_000n],
      ]),
    ]);

    expect(totals.income).toBe(5_000n);
    expect(totals.expense).toBe(9_500n);
    expect(totals.net).toBe(-4_500n);
    expect(totals.net).toBe(totals.income - totals.expense);
  });
});

describe('F-08 default date range (AC-08.8)', () => {
  it('uses the first and last day of the current Bangkok month, including month and leap-year boundaries', () => {
    expect(currentMonthRange('Asia/Bangkok', new Date('2026-11-15T00:00:00Z'))).toEqual({
      from: '2026-11-01',
      to: '2026-11-30',
    });
    expect(currentMonthRange('Asia/Bangkok', new Date('2026-02-15T00:00:00Z'))).toEqual({
      from: '2026-02-01',
      to: '2026-02-28',
    });
    expect(currentMonthRange('Asia/Bangkok', new Date('2024-02-15T00:00:00Z'))).toEqual({
      from: '2024-02-01',
      to: '2024-02-29',
    });
    // 2026-10-31T17:00Z is already 2026-11-01 00:00 in Bangkok.
    expect(currentMonthRange('Asia/Bangkok', new Date('2026-10-31T17:00:00Z'))).toEqual({
      from: '2026-11-01',
      to: '2026-11-30',
    });
  });
});
