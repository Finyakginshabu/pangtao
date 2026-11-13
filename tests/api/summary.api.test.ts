import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from 'vitest';
import request from 'supertest';
import { app } from '../../server/src/app.js';
import { prisma } from '../../server/src/prisma.js';
import { resetDatabase, createTestSession } from '../helpers/db.helper.js';
import { clearRateLimitStore } from '../../server/src/middleware/rate-limit.middleware.js';
import { accountIdsByName, insertTransaction } from '../helpers/ledger.helper.js';
import { computeIncomeExpense } from '../../server/src/services/summary.engine.js';
import type { LedgerAccount, LedgerTransaction } from '../../server/src/services/balance.engine.js';

const SUMMARY_URL = '/api/v1/summary/income-expense';

const get = (url: string, token?: string) => {
  const req = request(app).get(url);
  return token ? req.set('Cookie', [`sid=${token}`]) : req;
};

interface SummaryResponse {
  from: string;
  to: string;
  income: number;
  expense: number;
  net: number;
}

/**
 * f-08 TEST-08.1 fixture: opening 50,000.00 (Nov 1), salary 30,000.00 (Nov 2),
 * card charge 1,200.00 (Nov 3, Dining 700.00 + Groceries 500.00) and a
 * card repayment 800.00 (Nov 4). Written directly so the dates stay fixed.
 */
async function insertSummaryDemoLedger(userId: string) {
  const ids = await accountIdsByName(userId);

  const opening = await insertTransaction(userId, {
    kind: 'OPENING_BALANCE',
    accountId: ids['Bank Account'],
    date: '2026-11-01',
    total: 5_000_000, // 50,000.00 THB
  });
  const salary = await insertTransaction(userId, {
    kind: 'RECEIPT',
    accountId: ids['Bank Account'],
    date: '2026-11-02',
    total: 3_000_000, // 30,000.00 THB
    memo: 'November salary',
    lines: [{ targetAccountId: ids['Salary'], amount: 3_000_000 }],
  });
  const cardCharge = await insertTransaction(userId, {
    kind: 'PAYMENT',
    accountId: ids['Credit Card'],
    date: '2026-11-03',
    total: 120_000, // 1,200.00 THB
    memo: 'Dinner and groceries',
    lines: [
      { targetAccountId: ids['Dining'], amount: 70_000 }, // 700.00 THB
      { targetAccountId: ids['Groceries'], amount: 50_000 }, // 500.00 THB
    ],
  });
  const repayment = await insertTransaction(userId, {
    kind: 'PAYMENT',
    accountId: ids['Bank Account'],
    date: '2026-11-04',
    total: 80_000, // 800.00 THB
    lines: [{ targetAccountId: ids['Credit Card'], amount: 80_000 }],
  });

  return {
    ids,
    openingTransactionId: opening.id,
    salaryTransactionId: salary.id,
    cardChargeTransactionId: cardCharge.id,
    repaymentTransactionId: repayment.id,
  };
}

describe('F-08 Income and Expense Summary (STS)', () => {
  let seededUsers: Awaited<ReturnType<typeof resetDatabase>>;
  let aliceToken: string;
  let bobToken: string;
  let adminToken: string;
  let demo: Awaited<ReturnType<typeof insertSummaryDemoLedger>>;

  beforeEach(async () => {
    clearRateLimitStore();
    seededUsers = await resetDatabase();
    aliceToken = await createTestSession(seededUsers.alice.id);
    bobToken = await createTestSession(seededUsers.bob.id);
    adminToken = await createTestSession(seededUsers.admin.id);
    demo = await insertSummaryDemoLedger(seededUsers.alice.id);
  });

  afterEach(() => {
    // TEST-08.8 fakes only Date; always restore it so later tests see the real clock.
    vi.useRealTimers();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('TEST-08.1 (AC-08.1, AC-08.2): a valid range returns the exact income, expense and net satang', async () => {
    const res = await get(`${SUMMARY_URL}?from=2026-11-01&to=2026-11-30`, aliceToken);

    expect(res.status).toBe(200);
    expect(res.body as SummaryResponse).toEqual({
      from: '2026-11-01',
      to: '2026-11-30',
      income: 3_000_000, // 30,000.00 THB salary
      expense: 120_000, // 1,200.00 THB card charge
      net: 2_880_000, // 28,800.00 THB
    });
  });

  it('TEST-08.2 (AC-08.3): the 50,000.00 opening balance and 800.00 card repayment are excluded', async () => {
    const res = await get(`${SUMMARY_URL}?from=2026-11-01&to=2026-11-30`, aliceToken);

    expect(res.status).toBe(200);
    expect(res.body.income).toBe(3_000_000);
    expect(res.body.expense).toBe(120_000);
    // Neither excluded amount appears in either total.
    expect([res.body.income, res.body.expense]).not.toContain(5_000_000);
    expect([res.body.income, res.body.expense]).not.toContain(80_000);
  });

  it('TEST-08.3 (AC-08.4): a voided 5,000.00 expense in range does not change the totals', async () => {
    await insertTransaction(seededUsers.alice.id, {
      kind: 'PAYMENT',
      accountId: demo.ids['Bank Account'],
      date: '2026-11-05',
      total: 500_000, // 5,000.00 THB
      voided: true,
      lines: [{ targetAccountId: demo.ids['Telecom'], amount: 500_000 }],
    });

    const res = await get(`${SUMMARY_URL}?from=2026-11-01&to=2026-11-30`, aliceToken);
    expect(res.status).toBe(200);
    expect(res.body.expense).toBe(120_000);
    expect(res.body.net).toBe(2_880_000);
  });

  it('TEST-08.4 (AC-08.5): reversed, malformed or impossible dates return 400 VALIDATION_ERROR with no totals', async () => {
    const queries = [
      'from=2026-11-30&to=2026-11-01', // from > to
      'from=bad-date', // malformed
      'to=bad-date', // malformed
      'from=2026-02-30&to=2026-03-01', // impossible calendar day
    ];

    for (const query of queries) {
      const res = await get(`${SUMMARY_URL}?${query}`, aliceToken);
      expect(res.status, query).toBe(400);
      expect(res.body.error.code, query).toBe('VALIDATION_ERROR');
      expect(res.body, query).not.toHaveProperty('income');
      expect(res.body, query).not.toHaveProperty('expense');
      expect(res.body, query).not.toHaveProperty('net');
    }
  });

  it('TEST-08.5 (AC-08.6): an Administrator gets 403 and an anonymous caller 401 on the summary endpoint', async () => {
    const admin = await get(`${SUMMARY_URL}?from=2026-11-01&to=2026-11-30`, adminToken);
    expect(admin.status).toBe(403);
    expect(admin.body.error.code).toBe('FORBIDDEN');
    expect(admin.body).not.toHaveProperty('income');

    const anonymous = await get(`${SUMMARY_URL}?from=2026-11-01&to=2026-11-30`);
    expect(anonymous.status).toBe(401);
    expect(anonymous.body.error.code).toBe('UNAUTHENTICATED');
    expect(anonymous.body).not.toHaveProperty('income');
  });

  it('TEST-08.8 (AC-08.8): omitting from and to defaults to the current Bangkok month', async () => {
    // Contract TEST-08.8 fixes the server clock to 2026-11-15 in Asia/Bangkok.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-15T00:00:00.000Z'));

    // Created under the fixed clock, so the session is valid for this request.
    const token = await createTestSession(seededUsers.alice.id, 24 * 365 * 10);

    const defaults = await get(SUMMARY_URL, token);
    expect(defaults.status).toBe(200);
    expect(defaults.body as SummaryResponse).toEqual({
      from: '2026-11-01',
      to: '2026-11-30',
      income: 3_000_000,
      expense: 120_000,
      net: 2_880_000,
    });

    const explicit = await get(`${SUMMARY_URL}?from=2026-11-01&to=2026-11-30`, token);
    expect(explicit.body).toEqual(defaults.body);
  });

  it('TEST-08.9 (AC-08.9): another user sees only their own totals, never Alice\'s', async () => {
    const res = await get(`${SUMMARY_URL}?from=2026-11-01&to=2026-11-30`, bobToken);

    expect(res.status).toBe(200);
    expect(res.body as SummaryResponse).toEqual({
      from: '2026-11-01',
      to: '2026-11-30',
      income: 0,
      expense: 0,
      net: 0,
    });
    expect(JSON.stringify(res.body)).not.toContain('3000000');
  });
});

describe('F-08 summary API: further rules', () => {
  let seededUsers: Awaited<ReturnType<typeof resetDatabase>>;
  let aliceToken: string;
  let bobToken: string;
  let demo: Awaited<ReturnType<typeof insertSummaryDemoLedger>>;

  beforeEach(async () => {
    clearRateLimitStore();
    seededUsers = await resetDatabase();
    aliceToken = await createTestSession(seededUsers.alice.id);
    bobToken = await createTestSession(seededUsers.bob.id);
    demo = await insertSummaryDemoLedger(seededUsers.alice.id);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('counts transactions on both range boundaries and ignores the day after', async () => {
    await insertTransaction(seededUsers.alice.id, {
      kind: 'PAYMENT',
      accountId: demo.ids['Bank Account'],
      date: '2026-11-30',
      total: 1_000,
      lines: [{ targetAccountId: demo.ids['Dining'], amount: 1_000 }],
    });
    await insertTransaction(seededUsers.alice.id, {
      kind: 'PAYMENT',
      accountId: demo.ids['Bank Account'],
      date: '2026-12-01',
      total: 2_000,
      lines: [{ targetAccountId: demo.ids['Dining'], amount: 2_000 }],
    });

    const res = await get(`${SUMMARY_URL}?from=2026-11-01&to=2026-11-30`, aliceToken);
    expect(res.status).toBe(200);
    expect(res.body.expense).toBe(121_000); // 1,200.00 + 10.00, not the 20.00 on Dec 1
  });

  it('counts Bob\'s own lines without leaking Alice\'s', async () => {
    const bobIds = await accountIdsByName(seededUsers.bob.id);
    await insertTransaction(seededUsers.bob.id, {
      kind: 'RECEIPT',
      accountId: bobIds['Bank Account'],
      date: '2026-11-02',
      total: 100_000,
      lines: [{ targetAccountId: bobIds['Salary'], amount: 100_000 }],
    });
    await insertTransaction(seededUsers.bob.id, {
      kind: 'PAYMENT',
      accountId: bobIds['Bank Account'],
      date: '2026-11-03',
      total: 20_000,
      lines: [{ targetAccountId: bobIds['Dining'], amount: 20_000 }],
    });

    const res = await get(`${SUMMARY_URL}?from=2026-11-01&to=2026-11-30`, bobToken);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      from: '2026-11-01',
      to: '2026-11-30',
      income: 100_000,
      expense: 20_000,
      net: 80_000,
    });
  });

  it('defaults only the omitted boundary', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-15T00:00:00.000Z'));
    const token = await createTestSession(seededUsers.alice.id, 24 * 365 * 10);

    try {
      const fromOnly = await get(`${SUMMARY_URL}?from=2026-11-01`, token);
      expect(fromOnly.status).toBe(200);
      expect(fromOnly.body).toMatchObject({ from: '2026-11-01', to: '2026-11-30' });

      const toOnly = await get(`${SUMMARY_URL}?to=2026-11-30`, token);
      expect(toOnly.status).toBe(200);
      expect(toOnly.body).toMatchObject({ from: '2026-11-01', to: '2026-11-30' });
    } finally {
      vi.useRealTimers();
    }
  });

  it('the pure engine and the SQL aggregation agree on the same ledger (f-08 §2.3 parity check)', async () => {
    // Add rows the aggregation must filter out: a voided expense and a cash transfer.
    await insertTransaction(seededUsers.alice.id, {
      kind: 'PAYMENT',
      accountId: demo.ids['Bank Account'],
      date: '2026-11-05',
      total: 500_000,
      voided: true,
      lines: [{ targetAccountId: demo.ids['Telecom'], amount: 500_000 }],
    });
    await insertTransaction(seededUsers.alice.id, {
      kind: 'PAYMENT',
      accountId: demo.ids['Bank Account'],
      date: '2026-11-06',
      total: 20_000,
      lines: [{ targetAccountId: demo.ids['Wallet'], amount: 20_000 }],
    });

    const res = await get(`${SUMMARY_URL}?from=2026-11-01&to=2026-11-30`, aliceToken);
    expect(res.status).toBe(200);

    const accounts = await prisma.account.findMany({
      where: { userId: seededUsers.alice.id },
      select: { id: true, type: true },
    });
    const transactions = await prisma.transaction.findMany({
      where: {
        userId: seededUsers.alice.id,
        txnDate: {
          gte: new Date('2026-11-01T00:00:00.000Z'),
          lte: new Date('2026-11-30T00:00:00.000Z'),
        },
      },
      select: {
        kind: true,
        accountId: true,
        totalAmount: true,
        voidedAt: true,
        lines: { select: { targetAccountId: true, amount: true } },
      },
    });

    const ledgerAccounts: LedgerAccount[] = accounts.map((account) => ({
      id: account.id,
      type: account.type,
    }));
    const ledgerTransactions: LedgerTransaction[] = transactions.map((transaction) => ({
      kind: transaction.kind,
      accountId: transaction.accountId,
      totalAmount: transaction.totalAmount,
      voidedAt: transaction.voidedAt,
      lines: transaction.lines.map((line) => ({
        targetAccountId: line.targetAccountId,
        amount: line.amount,
      })),
    }));

    const totals = computeIncomeExpense(ledgerAccounts, ledgerTransactions);
    expect({
      income: Number(totals.income),
      expense: Number(totals.expense),
      net: Number(totals.net),
    }).toEqual({
      income: res.body.income,
      expense: res.body.expense,
      net: res.body.net,
    });
    // The same ledger is the contract demo, so both paths must produce its exact figures.
    expect(res.body).toMatchObject({ income: 3_000_000, expense: 120_000, net: 2_880_000 });
  });
});
