/**
 * F-08 summary engine (pure): totals from ledger lines that target Income or Expense
 * accounts only (BR-08, BR-09). No database, no I/O. Money is integer satang as
 * `bigint` throughout (NFR-03).
 *
 * Opening balances carry no allocation lines, so they never contribute. Transfers,
 * borrowing, lending and loan repayments target Cash or Loan accounts, so filtering by
 * the target account type excludes them by construction. Voided transactions are ignored
 * (BR-12). The production path is the SQL aggregation in summary.service.ts; the extra
 * API test "the pure engine and the SQL aggregation agree..." runs both over one ledger.
 */
import type { LedgerAccount, LedgerTransaction } from './balance.engine.js';

export interface IncomeExpenseTotals {
  income: bigint;
  expense: bigint;
  net: bigint;
}

export function computeIncomeExpense(
  accounts: readonly LedgerAccount[],
  transactions: readonly LedgerTransaction[]
): IncomeExpenseTotals {
  const typeOf = new Map(accounts.map((account) => [account.id, account.type]));
  let income = 0n;
  let expense = 0n;

  for (const txn of transactions) {
    if (txn.voidedAt !== null) continue;

    for (const line of txn.lines) {
      const targetType = typeOf.get(line.targetAccountId);
      if (targetType === 'INCOME') income += line.amount;
      else if (targetType === 'EXPENSE') expense += line.amount;
    }
  }

  return { income, expense, net: income - expense };
}
