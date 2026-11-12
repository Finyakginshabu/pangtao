import { describe, it, expect } from 'vitest';
import {
  accountingInvariant,
  computeBalances,
  type BalanceSheetRow,
  type LedgerAccount,
  type LedgerTransaction,
} from '../../server/src/services/balance.engine.js';
import { mulberry32 } from '../helpers/ledger.helper.js';

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

// Contract demo dataset (f-03 TEST-03.3).
const DEMO_LEDGER: LedgerTransaction[] = [
  txn('OPENING_BALANCE', 'bank', 5_000_000n), // 50,000.00 THB
  txn('RECEIPT', 'bank', 3_000_000n, [['salary', 3_000_000n]]), // 30,000.00 THB
  txn('PAYMENT', 'card', 120_000n, [
    ['dining', 70_000n], // 700.00 THB
    ['groceries', 50_000n], // 500.00 THB
  ]),
  txn('PAYMENT', 'bank', 80_000n, [['card', 80_000n]]), // 800.00 THB repayment
  txn('PAYMENT', 'bank', 500_000n, [['telecom', 500_000n]], new Date('2026-01-28T10:00:00Z')), // voided 5,000.00 THB
];

function sheet(accounts: LedgerAccount[], ledger: LedgerTransaction[]): BalanceSheetRow[] {
  const balances = computeBalances(accounts, ledger);
  return accounts.map((account) => ({
    type: account.type,
    balance: balances.get(account.id)!,
    openingAmount: ledger
      .filter((t) => t.kind === 'OPENING_BALANCE' && t.voidedAt === null && t.accountId === account.id)
      .reduce((sum, t) => sum + t.totalAmount, 0n),
  }));
}

describe('F-03 Accounts and Balances (STS)', () => {
  it('TEST-03.3 (AC-03.3): engine derives Bank, Card, Salary, Dining and Groceries balances and ignores the voided payment', () => {
    const balances = computeBalances(ACCOUNTS, DEMO_LEDGER);

    expect(balances.get('bank')).toBe(7_920_000n); // 79,200.00 THB
    expect(balances.get('card')).toBe(40_000n); // 400.00 THB debt
    expect(balances.get('salary')).toBe(3_000_000n); // 30,000.00 THB
    expect(balances.get('dining')).toBe(70_000n); // 700.00 THB
    expect(balances.get('groceries')).toBe(50_000n); // 500.00 THB
    // Voided 5,000.00 payment has zero impact on its source and its target.
    expect(balances.get('telecom')).toBe(0n);
    expect(balances.get('wallet')).toBe(0n);
    expect(balances.get('interest')).toBe(0n);
    expect(balances.get('loan-carol')).toBe(0n);
    expect(balances.size).toBe(ACCOUNTS.length);
  });

  it('TEST-03.4 (AC-03.4): net worth 78,800.00 equals openings + income − expenses with zero satang discrepancy', () => {
    const { netWorth, expected } = accountingInvariant(sheet(ACCOUNTS, DEMO_LEDGER));

    expect(netWorth).toBe(7_880_000n); // 79,200.00 − 400.00 = 78,800.00 THB
    expect(expected).toBe(7_880_000n); // 50,000.00 + 30,000.00 − 1,200.00 THB
    expect(netWorth - expected).toBe(0n);
  });
});

describe('F-03 balance engine: further rules', () => {
  it('returns 0 for every account of an empty ledger', () => {
    const balances = computeBalances(ACCOUNTS, []);
    expect([...balances.values()]).toEqual(ACCOUNTS.map(() => 0n));
  });

  it('D-02: an overdrawn Cash account and an overpaid card go negative instead of being clamped', () => {
    const balances = computeBalances(ACCOUNTS, [
      txn('PAYMENT', 'wallet', 15_050n, [['dining', 15_050n]]), // 150.50 THB with no money held
      txn('PAYMENT', 'bank', 30_000n, [['card', 30_000n]]), // repay 300.00 THB on a card with no debt
    ]);
    expect(balances.get('wallet')).toBe(-15_050n);
    expect(balances.get('bank')).toBe(-30_000n);
    expect(balances.get('card')).toBe(-30_000n);
  });

  it('applies every allocation kind in the srs §4 matrix, including the Sprint 2 kinds', () => {
    const balances = computeBalances(ACCOUNTS, [
      txn('OPENING_BALANCE', 'card', 100_000n), // card debt starts at 1,000.00 THB
      txn('OPENING_BALANCE', 'loan-carol', 20_000n), // Carol owes 200.00 THB
      txn('PAYMENT', 'bank', 10_000n, [['loan-carol', 10_000n]]), // lend 100.00
      txn('PAYMENT', 'bank', 7_000n, [['wallet', 7_000n]]), // transfer out 70.00 to Wallet
      txn('RECEIPT', 'bank', 3_000n, [['loan-carol', 3_000n]]), // Carol repays 30.00
      txn('RECEIPT', 'bank', 50_000n, [['card', 50_000n]]), // borrow 500.00 (cash advance)
      txn('RECEIPT', 'bank', 2_000n, [['wallet', 2_000n]]), // transfer in 20.00 from Wallet
      txn('RECEIPT', 'bank', 1_001n, [['interest', 1_001n]]), // interest 10.01
    ]);

    expect(balances.get('bank')).toBe(-10_000n - 7_000n + 3_000n + 50_000n + 2_000n + 1_001n);
    expect(balances.get('wallet')).toBe(7_000n - 2_000n);
    expect(balances.get('card')).toBe(100_000n + 50_000n);
    expect(balances.get('loan-carol')).toBe(20_000n + 10_000n - 3_000n);
    expect(balances.get('interest')).toBe(1_001n);
  });

  it('a voided opening balance is excluded', () => {
    const balances = computeBalances(ACCOUNTS, [
      txn('OPENING_BALANCE', 'wallet', 99_999n, [], new Date('2026-02-01T00:00:00Z')),
    ]);
    expect(balances.get('wallet')).toBe(0n);
  });

  it('AC-03.4 invariant holds for 200 random ledgers mixing every allocation kind, openings and voids', () => {
    const rand = mulberry32(334);
    const ids = (type: LedgerAccount['type']) => ACCOUNTS.filter((a) => a.type === type).map((a) => a.id);
    const pick = <T>(items: readonly T[]) => items[Math.floor(rand() * items.length)];
    const amount = () => BigInt(1 + Math.floor(rand() * 10_000_000));
    let nonZeroRuns = 0;

    for (let run = 0; run < 200; run++) {
      const ledger: LedgerTransaction[] = [];
      for (const id of [...ids('CASH'), ...ids('LOAN_TAKEN'), ...ids('LOAN_GIVEN')]) {
        if (rand() < 0.5) ledger.push(txn('OPENING_BALANCE', id, amount(), [], rand() < 0.2 ? new Date() : null));
      }
      for (let i = 0; i < 30; i++) {
        const isPayment = rand() < 0.5;
        const source = isPayment ? pick([...ids('CASH'), ...ids('LOAN_TAKEN')]) : pick(ids('CASH'));
        const targets = (
          isPayment
            ? [...ids('EXPENSE'), ...ids('LOAN_TAKEN'), ...ids('LOAN_GIVEN'), ...ids('CASH')]
            : [...ids('INCOME'), ...ids('LOAN_GIVEN'), ...ids('LOAN_TAKEN'), ...ids('CASH')]
        ).filter((t) => t !== source);
        const lines: Array<[string, bigint]> = Array.from({ length: 1 + Math.floor(rand() * 3) }, () => [
          pick(targets),
          amount(),
        ]);
        const total = lines.reduce((sum, [, a]) => sum + a, 0n);
        ledger.push(txn(isPayment ? 'PAYMENT' : 'RECEIPT', source, total, lines, rand() < 0.15 ? new Date() : null));
      }

      const { netWorth, expected } = accountingInvariant(sheet(ACCOUNTS, ledger));
      expect(netWorth, `run ${run}`).toBe(expected);
      if (netWorth !== 0n) nonZeroRuns++;
    }
    // Guards against a vacuous pass where both sides are always 0.
    expect(nonZeroRuns).toBeGreaterThan(150);
  });
});
