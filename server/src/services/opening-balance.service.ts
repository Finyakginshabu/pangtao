import { AccountType, Prisma } from '@prisma/client';
import { prisma } from '../prisma.js';
import { AppError } from '../middleware/error.middleware.js';
import { satangToJson } from '../utils/money.util.js';
import { isFutureDate } from '../utils/date.util.js';
import type { OpeningBalanceBodyDto } from '../schemas/opening-balance.schema.js';

/** f-04 §2.1: exactly these five fields, with `txnDate` as a calendar date. */
export interface OpeningBalanceTransactionView {
  id: string;
  kind: 'OPENING_BALANCE';
  accountId: string;
  /** YYYY-MM-DD */
  txnDate: string;
  /** Integer satang. */
  totalAmount: number;
}

/** BR-11: only Cash, Loan Taken and Loan Given accounts may own an opening balance. */
const OPENING_BALANCE_ACCOUNT_TYPES: ReadonlySet<AccountType> = new Set([
  AccountType.CASH,
  AccountType.LOAN_TAKEN,
  AccountType.LOAN_GIVEN,
]);

export class OpeningBalanceService {
  /**
   * FR-10 / BR-01, BR-04, BR-10, BR-11: record one opening-balance transaction.
   * Ownership is checked first so a cross-user id is indistinguishable from an unknown one.
   */
  async createOpeningBalance(
    accountId: string,
    dto: OpeningBalanceBodyDto,
    userId: string
  ): Promise<OpeningBalanceTransactionView> {
    const account = await prisma.account.findFirst({
      where: { id: accountId, userId },
      select: { id: true, type: true },
    });

    if (!account) {
      throw new AppError(404, 'NOT_FOUND', 'Account not found');
    }

    if (!OPENING_BALANCE_ACCOUNT_TYPES.has(account.type)) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Opening balance is not allowed for this account type', [
        { field: 'accountId', issue: 'account type must be CASH, LOAN_TAKEN or LOAN_GIVEN' },
      ]);
    }

    if (isFutureDate(dto.date)) {
      throw new AppError(400, 'FUTURE_DATE_NOT_ALLOWED', 'Date cannot be later than today in Bangkok time');
    }

    const existing = await prisma.transaction.findFirst({
      where: { userId, accountId, kind: 'OPENING_BALANCE', voidedAt: null },
      select: { id: true },
    });

    if (existing) {
      throw new AppError(409, 'OPENING_BALANCE_EXISTS', 'This account already has an opening balance');
    }

    try {
      const transaction = await prisma.transaction.create({
        data: {
          userId,
          accountId,
          kind: 'OPENING_BALANCE',
          // DATE column: store the calendar day at UTC midnight, like every other ledger row.
          txnDate: new Date(`${dto.date}T00:00:00.000Z`),
          totalAmount: BigInt(dto.amount),
        },
        select: { id: true, kind: true, accountId: true, txnDate: true, totalAmount: true },
      });

      return {
        id: transaction.id,
        kind: 'OPENING_BALANCE',
        accountId: transaction.accountId,
        txnDate: transaction.txnDate.toISOString().slice(0, 10),
        totalAmount: satangToJson(transaction.totalAmount),
      };
    } catch (error) {
      // The partial unique index unique_active_opening_balance is the race-safe guard.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new AppError(409, 'OPENING_BALANCE_EXISTS', 'This account already has an opening balance');
      }
      throw error;
    }
  }
}

export const openingBalanceService = new OpeningBalanceService();
