/**
 * F-03 balance engine (pure): derives every account balance from ledger events.
 * No database, no I/O. Money is integer satang as `bigint` throughout (NFR-03).
 *
 * RED STEP STUB: signatures are final; the formulas arrive with the implementation.
 */

export type LedgerAccountType = 'CASH' | 'LOAN_TAKEN' | 'LOAN_GIVEN' | 'INCOME' | 'EXPENSE';
export type LedgerTransactionKind = 'PAYMENT' | 'RECEIPT' | 'OPENING_BALANCE';

export interface LedgerAccount {
  id: string;
  type: LedgerAccountType;
}

export interface LedgerLine {
  targetAccountId: string;
  amount: bigint;
}

export interface LedgerTransaction {
  kind: LedgerTransactionKind;
  /** Source account (the account an opening balance belongs to). */
  accountId: string;
  totalAmount: bigint;
  voidedAt: Date | null;
  lines: LedgerLine[];
}

/** Balance per account id; every account in `accounts` is present (0n when untouched). */
export function computeBalances(
  accounts: readonly LedgerAccount[],
  _transactions: readonly LedgerTransaction[]
): Map<string, bigint> {
  return new Map(accounts.map((account) => [account.id, 0n]));
}

export interface BalanceSheetRow {
  type: LedgerAccountType;
  balance: bigint;
  /** Active opening balance amount, 0n when none. */
  openingAmount: bigint;
}

/** AC-03.4: both sides of net worth = signed openings + income − expense. */
export function accountingInvariant(_rows: readonly BalanceSheetRow[]): {
  netWorth: bigint;
  expected: bigint;
} {
  return { netWorth: 0n, expected: 0n };
}
