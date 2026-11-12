/**
 * F-05 allocation rules (pure): no database, no I/O. Each check throws an AppError
 * so the calling service can run it inside its database transaction.
 */
import type { AccountType } from '@prisma/client';

export interface RuleAccount {
  id: string;
  type: AccountType;
  isArchived: boolean;
}

/** BR-05: line amounts must sum exactly to the total. */
export function checkAllocationSum(_total: bigint, _amounts: readonly bigint[]): void {
  // Not implemented yet (F-05 red step).
}

/**
 * BR-14, BR-16, BR-06: the source must be an active Cash or Loan Taken account, and each
 * line target (in line order) must be active, differ from the source, and be allowed for it.
 */
export function checkPaymentAccounts(_source: RuleAccount, _targets: readonly RuleAccount[]): void {
  // Not implemented yet (F-05 red step).
}
