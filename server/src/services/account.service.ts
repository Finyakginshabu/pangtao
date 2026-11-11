import { AccountSubtype, AccountType, Prisma } from '@prisma/client';
import { prisma } from '../prisma.js';
import { satangToJson } from '../utils/money.util.js';

export interface AccountView {
  id: string;
  name: string;
  type: AccountType;
  subtype: AccountSubtype | null;
  isArchived: boolean;
  /** Integer satang, derived (BR-07); may be negative (D-02). */
  balance: number;
  openingBalance: { transactionId: string; amount: number; date: string } | null;
}

/** f-03 §1: Cash, Loan Taken, Loan Given, Income, Expense, then name. */
const TYPE_ORDER: Record<AccountType, number> = {
  CASH: 0,
  LOAN_TAKEN: 1,
  LOAN_GIVEN: 2,
  INCOME: 3,
  EXPENSE: 4,
};

const NAME_ORDER = new Intl.Collator('en', { sensitivity: 'base' });

/**
 * Production balance query (AC-03.5): one SQL aggregation over the caller's non-voided
 * transactions and allocation lines, applying the system-sds §2 formulas per account type.
 * Kept independent of balance.engine.ts on purpose; TEST-03.5 proves they agree.
 * Every SUM is cast to BIGINT, otherwise Postgres returns NUMERIC (a Prisma Decimal).
 */
function balanceQuery(userId: string) {
  return Prisma.sql`
    WITH source_totals AS (
      SELECT t.account_id,
             SUM(CASE WHEN t.kind = 'OPENING_BALANCE' THEN t.total_amount ELSE 0 END)::bigint AS opening,
             SUM(CASE WHEN t.kind = 'RECEIPT' THEN t.total_amount ELSE 0 END)::bigint AS receipts,
             SUM(CASE WHEN t.kind = 'PAYMENT' THEN t.total_amount ELSE 0 END)::bigint AS payments
      FROM transactions t
      WHERE t.user_id = ${userId}::uuid AND t.voided_at IS NULL
      GROUP BY t.account_id
    ),
    line_totals AS (
      SELECT l.target_account_id AS account_id,
             SUM(CASE WHEN t.kind = 'PAYMENT' THEN l.amount ELSE 0 END)::bigint AS payment_lines,
             SUM(CASE WHEN t.kind = 'RECEIPT' THEN l.amount ELSE 0 END)::bigint AS receipt_lines
      FROM allocation_lines l
      JOIN transactions t ON t.id = l.transaction_id AND t.user_id = l.user_id
      WHERE l.user_id = ${userId}::uuid AND t.voided_at IS NULL
      GROUP BY l.target_account_id
    )
    SELECT a.id,
           (CASE a.type
              WHEN 'CASH' THEN COALESCE(s.opening, 0) + COALESCE(s.receipts, 0) - COALESCE(s.payments, 0)
                             + COALESCE(g.payment_lines, 0) - COALESCE(g.receipt_lines, 0)
              WHEN 'LOAN_TAKEN' THEN COALESCE(s.opening, 0) + COALESCE(s.payments, 0)
                             + COALESCE(g.receipt_lines, 0) - COALESCE(g.payment_lines, 0)
              WHEN 'LOAN_GIVEN' THEN COALESCE(s.opening, 0)
                             + COALESCE(g.payment_lines, 0) - COALESCE(g.receipt_lines, 0)
              WHEN 'INCOME' THEN COALESCE(g.receipt_lines, 0)
              WHEN 'EXPENSE' THEN COALESCE(g.payment_lines, 0)
            END)::bigint AS balance
    FROM accounts a
    LEFT JOIN source_totals s ON s.account_id = a.id
    LEFT JOIN line_totals g ON g.account_id = a.id
    WHERE a.user_id = ${userId}::uuid
  `;
}

export class AccountService {
  /** AC-03.1, AC-03.3: the caller's own accounts with derived balances (BR-01, BR-07). */
  async listAccounts(userId: string): Promise<AccountView[]> {
    // One repeatable-read snapshot so accounts, balances and openings are mutually consistent.
    const { accounts, balances, openings } = await prisma.$transaction(
      async (tx) => {
        const accounts = await tx.account.findMany({
          where: { userId },
          select: { id: true, name: true, type: true, subtype: true, isArchived: true },
        });
        const balances = await tx.$queryRaw<Array<{ id: string; balance: bigint }>>(balanceQuery(userId));
        const openings = await tx.transaction.findMany({
          where: { userId, kind: 'OPENING_BALANCE', voidedAt: null },
          select: { id: true, accountId: true, totalAmount: true, txnDate: true },
        });
        return { accounts, balances, openings };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead }
    );

    const balanceById = new Map(balances.map((row) => [row.id, row.balance]));
    const openingByAccount = new Map(openings.map((o) => [o.accountId, o]));

    return accounts
      .sort(
        (a, b) =>
          TYPE_ORDER[a.type] - TYPE_ORDER[b.type] ||
          NAME_ORDER.compare(a.name, b.name) ||
          (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
      )
      .map((account) => {
        const opening = openingByAccount.get(account.id);
        return {
          ...account,
          balance: satangToJson(balanceById.get(account.id) ?? 0n),
          openingBalance: opening
            ? {
                transactionId: opening.id,
                amount: satangToJson(opening.totalAmount),
                // DATE column arrives as UTC midnight; the calendar date is its ISO prefix.
                date: opening.txnDate.toISOString().slice(0, 10),
              }
            : null,
        };
      });
  }
}

export const accountService = new AccountService();
