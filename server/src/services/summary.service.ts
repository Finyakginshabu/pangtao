import { Prisma } from '@prisma/client';
import { prisma } from '../prisma.js';
import { currentMonthRange } from '../utils/date.util.js';
import { satangToJson } from '../utils/money.util.js';
import { AppError } from '../middleware/error.middleware.js';
import type { SummaryQueryDto } from '../schemas/summary.schema.js';

export interface SummaryView {
  from: string;
  to: string;
  /** Integer satang. */
  income: number;
  /** Integer satang. */
  expense: number;
  /** Integer satang; exactly income − expense. */
  net: number;
}

interface TotalsRow {
  income: bigint;
  expense: bigint;
}

/**
 * Production summary query (AC-08.1–AC-08.4): one SQL aggregation over the caller's
 * non-voided allocation lines, filtered by the target account type (BR-08, BR-09).
 * Opening balances have no allocation lines; Cash and Loan targets are excluded by
 * the CASE expressions. SUM is cast to BIGINT, otherwise Postgres returns NUMERIC.
 *
 * The scan starts from `transactions` so it can use the existing
 * `(user_id, txn_date)` index; `allocation_lines` has no user_id index, but its
 * `(transaction_id, line_no)` unique index serves the join.
 */
function totalsQuery(userId: string, from: string, to: string) {
  return Prisma.sql`
    SELECT
      COALESCE(SUM(CASE WHEN a.type = 'INCOME' THEN l.amount ELSE 0 END), 0)::bigint AS income,
      COALESCE(SUM(CASE WHEN a.type = 'EXPENSE' THEN l.amount ELSE 0 END), 0)::bigint AS expense
    FROM transactions t
    JOIN allocation_lines l ON l.transaction_id = t.id AND l.user_id = t.user_id
    JOIN accounts a ON a.id = l.target_account_id AND a.user_id = t.user_id
    WHERE t.user_id = ${userId}::uuid
      AND t.voided_at IS NULL
      AND t.txn_date >= ${from}::date
      AND t.txn_date <= ${to}::date
  `;
}

export class SummaryService {
  /** AC-08.1, AC-08.9: the caller's own totals only (BR-01), defaulting to this month (AC-08.8). */
  async getIncomeExpense(userId: string, query: SummaryQueryDto = {}): Promise<SummaryView> {
    const month = currentMonthRange();
    const from = query.from ?? month.from;
    const to = query.to ?? month.to;

    if (from > to) {
      throw new AppError(400, 'VALIDATION_ERROR', 'from must not be later than to', [
        { field: 'from', issue: 'from must not be later than to' },
      ]);
    }

    const rows = await prisma.$queryRaw<TotalsRow[]>(totalsQuery(userId, from, to));
    const row = rows[0] ?? { income: 0n, expense: 0n };

    return {
      from,
      to,
      income: satangToJson(row.income),
      expense: satangToJson(row.expense),
      net: satangToJson(row.income - row.expense),
    };
  }
}

export const summaryService = new SummaryService();
