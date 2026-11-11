/**
 * F-03 ledger fixtures. F-04/F-05/F-06 endpoints do not exist yet, so ledger events are
 * written straight to Postgres. Every row respects the DB constraints and composite FKs.
 */
import { AccountType, TransactionKind } from '@prisma/client';
import { prisma } from '../../server/src/prisma.js';
import type { LedgerAccount, LedgerTransaction } from '../../server/src/services/balance.engine.js';

export type AccountIds = Record<string, string>;

/** Name → id for one user's accounts. */
export async function accountIdsByName(userId: string): Promise<AccountIds> {
  const accounts = await prisma.account.findMany({ where: { userId }, select: { id: true, name: true } });
  return Object.fromEntries(accounts.map((a) => [a.name, a.id]));
}

export interface LedgerEventInput {
  kind: TransactionKind;
  accountId: string;
  date: string; // YYYY-MM-DD
  total: number; // satang
  voided?: boolean;
  lines?: Array<{ targetAccountId: string; amount: number }>;
}

export async function insertTransaction(userId: string, event: LedgerEventInput) {
  // Lines are inserted with their own scalar keys: a nested `lines.create` cannot set user_id,
  // which is shared by the composite foreign keys to transactions and accounts.
  return prisma.$transaction(async (tx) => {
    const created = await tx.transaction.create({
      data: {
        userId,
        kind: event.kind,
        accountId: event.accountId,
        txnDate: new Date(`${event.date}T00:00:00.000Z`),
        totalAmount: BigInt(event.total),
        voidedAt: event.voided ? new Date() : null,
      },
    });
    await tx.allocationLine.createMany({
      data: (event.lines ?? []).map((line, index) => ({
        transactionId: created.id,
        userId,
        targetAccountId: line.targetAccountId,
        amount: BigInt(line.amount),
        lineNo: index + 1,
      })),
    });
    return created;
  });
}

/**
 * The contract's demo dataset (f-03 TEST-03.3, plan.md demo sequence):
 * 1. Bank opening 50,000.00   2. Salary 30,000.00 into Bank
 * 3. Card charge 1,200.00 (Dining 700.00, Groceries 500.00)
 * 4. Bank pays 800.00 to Credit Card   5. Voided 5,000.00 payment from Bank (Telecom)
 */
export async function insertDemoLedger(userId: string) {
  const ids = await accountIdsByName(userId);

  const opening = await insertTransaction(userId, {
    kind: 'OPENING_BALANCE',
    accountId: ids['Bank Account'],
    date: '2026-01-01',
    total: 5_000_000, // 50,000.00 THB
  });
  await insertTransaction(userId, {
    kind: 'RECEIPT',
    accountId: ids['Bank Account'],
    date: '2026-01-25',
    total: 3_000_000, // 30,000.00 THB
    lines: [{ targetAccountId: ids['Salary'], amount: 3_000_000 }],
  });
  await insertTransaction(userId, {
    kind: 'PAYMENT',
    accountId: ids['Credit Card'],
    date: '2026-01-26',
    total: 120_000, // 1,200.00 THB
    lines: [
      { targetAccountId: ids['Dining'], amount: 70_000 }, // 700.00 THB
      { targetAccountId: ids['Groceries'], amount: 50_000 }, // 500.00 THB
    ],
  });
  await insertTransaction(userId, {
    kind: 'PAYMENT',
    accountId: ids['Bank Account'],
    date: '2026-01-27',
    total: 80_000, // 800.00 THB
    lines: [{ targetAccountId: ids['Credit Card'], amount: 80_000 }],
  });
  const voided = await insertTransaction(userId, {
    kind: 'PAYMENT',
    accountId: ids['Bank Account'],
    date: '2026-01-28',
    total: 500_000, // 5,000.00 THB
    voided: true,
    lines: [{ targetAccountId: ids['Telecom'], amount: 500_000 }],
  });

  return { ids, openingTransactionId: opening.id, voidedTransactionId: voided.id };
}

/** One user's ledger, shaped for the pure balance engine. */
export async function loadLedger(
  userId: string
): Promise<{ accounts: LedgerAccount[]; transactions: LedgerTransaction[] }> {
  const accounts = await prisma.account.findMany({ where: { userId }, select: { id: true, type: true } });
  const transactions = await prisma.transaction.findMany({
    where: { userId },
    select: {
      kind: true,
      accountId: true,
      totalAmount: true,
      voidedAt: true,
      lines: { select: { targetAccountId: true, amount: true } },
    },
  });
  return { accounts, transactions };
}

/** Deterministic PRNG (mulberry32) so a failing mix can be reproduced from its seed. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Writes a random but valid ledger covering every allocation kind in srs §4 (including the
 * Sprint 2 kinds, which the engine already supports), opening balances on Cash, Loan Taken and
 * Loan Given accounts, multi-line transactions and voided transactions.
 */
export async function insertRandomLedger(userId: string, seed: number, count: number) {
  const rand = mulberry32(seed);
  const pick = <T>(items: readonly T[]): T => items[Math.floor(rand() * items.length)];
  const amount = () => 1 + Math.floor(rand() * 2_000_000); // 0.01 – 20,000.00 THB

  // The seed has no Loan Given account; add one so lending and repayment are exercised.
  await prisma.account.create({ data: { userId, name: 'Loan to Carol', type: AccountType.LOAN_GIVEN } });

  const accounts = await prisma.account.findMany({ where: { userId }, select: { id: true, type: true } });
  const ofType = (type: AccountType) => accounts.filter((a) => a.type === type).map((a) => a.id);
  const cash = ofType('CASH');
  const loanTaken = ofType('LOAN_TAKEN');
  const loanGiven = ofType('LOAN_GIVEN');
  const income = ofType('INCOME');
  const expense = ofType('EXPENSE');

  for (const id of [...cash, ...loanTaken, ...loanGiven]) {
    if (rand() < 0.8) {
      await insertTransaction(userId, { kind: 'OPENING_BALANCE', accountId: id, date: '2026-01-01', total: amount() });
    }
  }

  for (let i = 0; i < count; i++) {
    const isPayment = rand() < 0.55;
    const source = isPayment ? pick([...cash, ...cash, ...loanTaken]) : pick(cash);
    const targets = isPayment
      ? [...expense, ...loanTaken, ...loanGiven, ...cash]
      : [...income, ...loanGiven, ...loanTaken, ...cash];
    const lineCount = 1 + Math.floor(rand() * 3);
    const lines = Array.from({ length: lineCount }, () => ({
      targetAccountId: pick(targets.filter((t) => t !== source)),
      amount: amount(),
    }));
    await insertTransaction(userId, {
      kind: isPayment ? 'PAYMENT' : 'RECEIPT',
      accountId: source,
      date: '2026-02-01',
      total: lines.reduce((sum, l) => sum + l.amount, 0),
      voided: rand() < 0.15,
      lines,
    });
  }
}
