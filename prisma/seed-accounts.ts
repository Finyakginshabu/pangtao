import { AccountSubtype, AccountType, Prisma } from '@prisma/client';

/**
 * The nine accounts every seeded User starts with (system-sds §2, f-03 §2.3).
 * Shared by prisma/seed.ts and the test reset helper so demo and tests never drift.
 * No transactions are seeded: every balance starts at 0.
 */
export const SEED_ACCOUNTS: ReadonlyArray<{
  name: string;
  type: AccountType;
  subtype: AccountSubtype | null;
}> = [
  { name: 'Wallet', type: AccountType.CASH, subtype: AccountSubtype.WALLET },
  { name: 'Bank Account', type: AccountType.CASH, subtype: AccountSubtype.BANK },
  { name: 'Credit Card', type: AccountType.LOAN_TAKEN, subtype: AccountSubtype.CREDIT_CARD },
  { name: 'Salary', type: AccountType.INCOME, subtype: null },
  { name: 'Interest Earned', type: AccountType.INCOME, subtype: null },
  { name: 'Dining', type: AccountType.EXPENSE, subtype: null },
  { name: 'Groceries', type: AccountType.EXPENSE, subtype: null },
  { name: 'Electricity', type: AccountType.EXPENSE, subtype: null },
  { name: 'Telecom', type: AccountType.EXPENSE, subtype: null },
];

type AccountWriter = { account: Pick<Prisma.TransactionClient['account'], 'createMany'> };

/** Idempotent: an account that already exists (same user and name) is left untouched. */
export async function seedAccountsFor(db: AccountWriter, userId: string): Promise<void> {
  await db.account.createMany({
    data: SEED_ACCOUNTS.map((account) => ({ ...account, userId })),
    skipDuplicates: true,
  });
}
