import type { Prisma } from '@prisma/client';
import { prisma } from '../prisma.js';
import { AppError } from '../middleware/error.middleware.js';
import { satangToJson } from '../utils/money.util.js';
import { isFutureDate } from '../utils/date.util.js';
import { checkAllocationSum, checkPaymentAccounts, checkReceiptAccounts, RuleAccount } from './allocation.rules.js';
import type { CreateTransactionBodyDto, ListTransactionsQueryDto } from '../schemas/transaction.schema.js';

export interface AllocationLineView {
  id: string;
  targetAccountId: string;
  /** Integer satang. */
  amount: number;
  note: string | null;
}

/** f-05 §2.1 / f-06 §2.1: `{ id, kind, accountId, txnDate, totalAmount, memo, lines }`. */
export interface TransactionView {
  id: string;
  kind: 'PAYMENT' | 'RECEIPT';
  accountId: string;
  /** YYYY-MM-DD */
  txnDate: string;
  /** Integer satang. */
  totalAmount: number;
  memo: string | null;
  lines: AllocationLineView[];
}

/** f-07 §2.1 line: the stored line plus its target account's name. */
export interface HistoryLineView extends AllocationLineView {
  targetAccountName: string;
}

/** f-07 §2.1: `{ id, kind, accountId, accountName, txnDate, totalAmount, memo, lines }`. */
export interface TransactionHistoryView {
  id: string;
  kind: 'PAYMENT' | 'RECEIPT' | 'OPENING_BALANCE';
  accountId: string;
  accountName: string;
  /** YYYY-MM-DD */
  txnDate: string;
  /** Integer satang. */
  totalAmount: number;
  memo: string | null;
  lines: HistoryLineView[];
}

export interface TransactionHistoryPage {
  items: TransactionHistoryView[];
  total: number;
  limit: number;
  offset: number;
}

const ACCOUNT_RULE_FIELDS = { id: true, type: true, isArchived: true } as const;

const HISTORY_SELECT = {
  id: true,
  kind: true,
  accountId: true,
  account: { select: { name: true } },
  txnDate: true,
  totalAmount: true,
  memo: true,
  lines: {
    orderBy: { lineNo: 'asc' },
    select: {
      id: true,
      targetAccountId: true,
      targetAccount: { select: { name: true } },
      amount: true,
      note: true,
    },
  },
} satisfies Prisma.TransactionSelect;

type HistoryRow = Prisma.TransactionGetPayload<{ select: typeof HISTORY_SELECT }>;

function toHistoryView(row: HistoryRow): TransactionHistoryView {
  return {
    id: row.id,
    kind: row.kind,
    accountId: row.accountId,
    accountName: row.account.name,
    txnDate: row.txnDate.toISOString().slice(0, 10),
    totalAmount: satangToJson(row.totalAmount),
    memo: row.memo,
    lines: row.lines.map((line) => ({
      id: line.id,
      targetAccountId: line.targetAccountId,
      targetAccountName: line.targetAccount.name,
      amount: satangToJson(line.amount),
      note: line.note,
    })),
  };
}

export class TransactionService {
  /**
   * FR-12 / FR-13 / BR-01, BR-04 to BR-07, BR-09, BR-10, BR-14, BR-16: record one Payment
   * or Receipt. Ownership is checked first, so another user's account looks like an unknown
   * one (404). Every rule and both inserts run in one database transaction, so a rejected
   * request writes nothing.
   */
  async createTransaction(dto: CreateTransactionBodyDto, userId: string): Promise<TransactionView> {
    return prisma.$transaction(async (tx) => {
      const source = await tx.account.findFirst({
        where: { id: dto.accountId, userId },
        select: ACCOUNT_RULE_FIELDS,
      });
      if (!source) {
        throw new AppError(404, 'NOT_FOUND', 'Account not found');
      }

      const targetIds = [...new Set(dto.lines.map((line) => line.targetAccountId))];
      const found = await tx.account.findMany({
        where: { id: { in: targetIds }, userId },
        select: ACCOUNT_RULE_FIELDS,
      });
      const byId = new Map<string, RuleAccount>(found.map((account) => [account.id, account]));
      if (byId.size !== targetIds.length) {
        throw new AppError(404, 'NOT_FOUND', 'Account not found');
      }

      const targets = dto.lines.map((line) => byId.get(line.targetAccountId)!);
      if (dto.kind === 'PAYMENT') {
        checkPaymentAccounts(source, targets);
      } else {
        checkReceiptAccounts(source, targets);
      }

      if (isFutureDate(dto.txnDate)) {
        throw new AppError(400, 'FUTURE_DATE_NOT_ALLOWED', 'Date cannot be later than today in Bangkok time', [
          { field: 'txnDate', issue: 'date must not be later than today in Bangkok time' },
        ]);
      }

      checkAllocationSum(
        BigInt(dto.totalAmount),
        dto.lines.map((line) => BigInt(line.amount))
      );

      const transaction = await tx.transaction.create({
        data: {
          userId,
          kind: dto.kind,
          accountId: source.id,
          // DATE column: store the calendar day at UTC midnight, like every other ledger row.
          txnDate: new Date(`${dto.txnDate}T00:00:00.000Z`),
          totalAmount: BigInt(dto.totalAmount),
          memo: dto.memo ?? null,
        },
        select: { id: true, accountId: true, txnDate: true, totalAmount: true, memo: true },
      });

      // Lines carry user_id explicitly: it is shared by the composite FKs to transactions and accounts.
      await tx.allocationLine.createMany({
        data: dto.lines.map((line, index) => ({
          transactionId: transaction.id,
          userId,
          targetAccountId: line.targetAccountId,
          amount: BigInt(line.amount),
          lineNo: index + 1,
          note: line.note ?? null,
        })),
      });

      const lines = await tx.allocationLine.findMany({
        where: { transactionId: transaction.id, userId },
        orderBy: { lineNo: 'asc' },
        select: { id: true, targetAccountId: true, amount: true, note: true },
      });

      return {
        id: transaction.id,
        kind: dto.kind,
        accountId: transaction.accountId,
        txnDate: transaction.txnDate.toISOString().slice(0, 10),
        totalAmount: satangToJson(transaction.totalAmount),
        memo: transaction.memo,
        lines: lines.map((line) => ({
          id: line.id,
          targetAccountId: line.targetAccountId,
          amount: satangToJson(line.amount),
          note: line.note,
        })),
      };
    });
  }

  /**
   * FR-17 / BR-01: one page of the user's history, newest first (`txn_date DESC, created_at
   * DESC`, served by `transactions_user_id_txn_date_created_at_idx`), with `id DESC` as a final
   * tie-break so offset pages never repeat or skip rows that share a date and creation time.
   * Voided rows are left out until F-13 (f-07 1.1 §1). Count and page are read from one
   * REPEATABLE READ snapshot so `total` matches the page.
   */
  async listTransactions(userId: string, query: ListTransactionsQueryDto): Promise<TransactionHistoryPage> {
    const where = { userId, voidedAt: null } satisfies Prisma.TransactionWhereInput;
    const [total, rows] = await prisma.$transaction(
      [
        prisma.transaction.count({ where }),
        prisma.transaction.findMany({
          where,
          orderBy: [{ txnDate: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
          skip: query.offset,
          take: query.limit,
          select: HISTORY_SELECT,
        }),
      ],
      { isolationLevel: 'RepeatableRead' }
    );
    return { items: rows.map(toHistoryView), total, limit: query.limit, offset: query.offset };
  }

  /**
   * FR-25 / BR-01, D-03: one transaction's full detail. The lookup is scoped to the caller,
   * so another user's id (or a voided one) is indistinguishable from an unknown id: 404.
   */
  async getTransaction(userId: string, id: string): Promise<TransactionHistoryView> {
    const row = await prisma.transaction.findFirst({
      where: { id, userId, voidedAt: null },
      select: HISTORY_SELECT,
    });
    if (!row) {
      throw new AppError(404, 'NOT_FOUND', 'Transaction not found');
    }
    return toHistoryView(row);
  }
}

export const transactionService = new TransactionService();
