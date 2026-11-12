/**
 * F-05 allocation rules (pure): no database, no I/O. Each check throws an AppError
 * so the calling service can run it inside its database transaction.
 */
import type { AccountType } from '@prisma/client';
import { AppError } from '../middleware/error.middleware.js';

export interface RuleAccount {
  id: string;
  type: AccountType;
  isArchived: boolean;
}

/**
 * BR-06 / BR-16, Sprint 1 Payment matrix (srs §4): allowed source types, and for each
 * source type the allowed line target types. F-06 adds the Receipt matrix beside it.
 */
const PAYMENT_TARGETS: Readonly<Partial<Record<AccountType, ReadonlySet<AccountType>>>> = {
  CASH: new Set<AccountType>(['EXPENSE', 'LOAN_TAKEN']), // spending, card or loan repayment
  LOAN_TAKEN: new Set<AccountType>(['EXPENSE']), // card charge
};

/** BR-05: line amounts must sum exactly to the total. Summed as bigint, so never rounded. */
export function checkAllocationSum(total: bigint, amounts: readonly bigint[]): void {
  const allocated = amounts.reduce((sum, amount) => sum + amount, 0n);
  if (allocated !== total) {
    throw new AppError(400, 'INVALID_ALLOCATION_SUM', 'Allocation lines must add up to the total amount', [
      { field: 'lines', issue: 'line amounts must sum exactly to totalAmount' },
    ]);
  }
}

/**
 * BR-14, BR-16, BR-06: the source must be an active Cash or Loan Taken account, and each
 * line target (in line order) must be active, differ from the source, and be allowed for it.
 */
export function checkPaymentAccounts(source: RuleAccount, targets: readonly RuleAccount[]): void {
  if (source.isArchived) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Archived accounts cannot record new transactions', [
      { field: 'accountId', issue: 'account must not be archived' },
    ]);
  }

  const allowedTargets = PAYMENT_TARGETS[source.type];
  if (!allowedTargets) {
    throw new AppError(400, 'INVALID_SOURCE_ACCOUNT', 'A payment must be made from a Cash or Loan Taken account', [
      { field: 'accountId', issue: 'source account type must be CASH or LOAN_TAKEN' },
    ]);
  }

  targets.forEach((target, index) => {
    const field = `lines.${index}.targetAccountId`;
    let issue: string | null = null;
    if (target.isArchived) issue = 'target account must not be archived';
    else if (target.id === source.id) issue = 'target account must differ from the source account';
    else if (!allowedTargets.has(target.type)) issue = 'target account type is not allowed for this source';

    if (issue) {
      throw new AppError(400, 'INVALID_TARGET_ACCOUNT', 'A line targets an account this payment cannot use', [
        { field, issue },
      ]);
    }
  });
}
