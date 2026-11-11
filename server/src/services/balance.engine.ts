/**
 * F-03 balance engine (pure): derives every account balance from ledger events.
 * No database, no I/O. Money is integer satang as `bigint` throughout (NFR-03).
 *
 * Formulas (system-sds §2, srs §4), over non-voided transactions only (BR-07, BR-12):
 *   Cash        = opening + receipts as source − payments as source
 *                 + payment lines targeting it (transfer in) − receipt lines targeting it (transfer out)
 *   Loan Taken  = opening + payments as source (card charges)
 *                 + receipt lines targeting it (borrowing) − payment lines targeting it (repayments)
 *   Loan Given  = opening + payment lines targeting it (lending) − receipt lines targeting it (repaid)
 *   Income      = receipt lines targeting it
 *   Expense     = payment lines targeting it
 *
 * The production path is the SQL aggregation in account.service.ts; TEST-03.5 checks the two agree.
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
  transactions: readonly LedgerTransaction[]
): Map<string, bigint> {
  const typeOf = new Map(accounts.map((account) => [account.id, account.type]));
  const balances = new Map(accounts.map((account) => [account.id, 0n]));
  const add = (accountId: string, delta: bigint) => {
    const current = balances.get(accountId);
    if (current !== undefined) balances.set(accountId, current + delta);
  };

  for (const txn of transactions) {
    if (txn.voidedAt !== null) continue;

    const sourceType = typeOf.get(txn.accountId);
    if (sourceType !== undefined) add(txn.accountId, sourceEffect(sourceType, txn.kind, txn.totalAmount));

    for (const line of txn.lines) {
      const targetType = typeOf.get(line.targetAccountId);
      if (targetType !== undefined) add(line.targetAccountId, lineEffect(targetType, txn.kind, line.amount));
    }
  }

  return balances;
}

/** Effect of a transaction's total on its source account. */
function sourceEffect(type: LedgerAccountType, kind: LedgerTransactionKind, total: bigint): bigint {
  switch (type) {
    case 'CASH':
      if (kind === 'OPENING_BALANCE' || kind === 'RECEIPT') return total;
      return -total; // PAYMENT
    case 'LOAN_TAKEN':
      // Opening debt, or a card charge (Payment from the card) increases the debt.
      return kind === 'OPENING_BALANCE' || kind === 'PAYMENT' ? total : 0n;
    case 'LOAN_GIVEN':
      return kind === 'OPENING_BALANCE' ? total : 0n;
    case 'INCOME':
    case 'EXPENSE':
      return 0n; // never a source, never has an opening balance (BR-11, BR-16)
  }
}

/** Effect of one allocation line on its target account. */
function lineEffect(type: LedgerAccountType, kind: LedgerTransactionKind, amount: bigint): bigint {
  const payment = kind === 'PAYMENT';
  const receipt = kind === 'RECEIPT';
  switch (type) {
    case 'CASH':
      return payment ? amount : receipt ? -amount : 0n; // transfer in / transfer out
    case 'LOAN_TAKEN':
      return receipt ? amount : payment ? -amount : 0n; // borrowing / repayment
    case 'LOAN_GIVEN':
      return payment ? amount : receipt ? -amount : 0n; // lending / repayment received
    case 'INCOME':
      return receipt ? amount : 0n;
    case 'EXPENSE':
      return payment ? amount : 0n;
  }
}

export interface BalanceSheetRow {
  type: LedgerAccountType;
  balance: bigint;
  /** Active opening balance amount, 0n when none. */
  openingAmount: bigint;
}

/** AC-03.4: both sides of net worth = signed openings + income − expense. */
export function accountingInvariant(rows: readonly BalanceSheetRow[]): {
  netWorth: bigint;
  expected: bigint;
} {
  let netWorth = 0n;
  let expected = 0n;
  for (const row of rows) {
    switch (row.type) {
      case 'CASH':
      case 'LOAN_GIVEN':
        netWorth += row.balance;
        expected += row.openingAmount;
        break;
      case 'LOAN_TAKEN':
        netWorth -= row.balance;
        expected -= row.openingAmount;
        break;
      case 'INCOME':
        expected += row.balance;
        break;
      case 'EXPENSE':
        expected -= row.balance;
        break;
    }
  }
  return { netWorth, expected };
}
