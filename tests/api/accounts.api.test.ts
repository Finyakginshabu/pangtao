import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../../server/src/app.js';
import { prisma } from '../../server/src/prisma.js';
import { resetDatabase, createTestSession } from '../helpers/db.helper.js';
import { clearRateLimitStore } from '../../server/src/middleware/rate-limit.middleware.js';
import { computeBalances } from '../../server/src/services/balance.engine.js';
import { insertDemoLedger, insertRandomLedger, loadLedger } from '../helpers/ledger.helper.js';

const ACCOUNTS_URL = '/api/v1/accounts';
const ACCOUNT_FIELDS = ['balance', 'id', 'isArchived', 'name', 'openingBalance', 'subtype', 'type'];

interface AccountItem {
  id: string;
  name: string;
  type: 'CASH' | 'LOAN_TAKEN' | 'LOAN_GIVEN' | 'INCOME' | 'EXPENSE';
  subtype: string | null;
  isArchived: boolean;
  balance: number;
  openingBalance: { transactionId: string; amount: number; date: string } | null;
}

const byName = (items: AccountItem[]) => Object.fromEntries(items.map((a) => [a.name, a]));

describe('F-03 Accounts and Balances (STS)', () => {
  let seededUsers: Awaited<ReturnType<typeof resetDatabase>>;
  let aliceToken: string;

  const getAccounts = (token: string) => request(app).get(ACCOUNTS_URL).set('Cookie', [`sid=${token}`]);

  beforeEach(async () => {
    clearRateLimitStore();
    seededUsers = await resetDatabase();
    aliceToken = await createTestSession(seededUsers.alice.id);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('TEST-03.1 (AC-03.1): a seeded user gets exactly their nine accounts in type-then-name order, all at 0 with no opening balance', async () => {
    const res = await getAccounts(aliceToken);

    expect(res.status).toBe(200);
    expect(Object.keys(res.body)).toEqual(['items']);
    const items: AccountItem[] = res.body.items;

    expect(items.map((a) => [a.type, a.name, a.subtype])).toEqual([
      ['CASH', 'Bank Account', 'BANK'],
      ['CASH', 'Wallet', 'WALLET'],
      ['LOAN_TAKEN', 'Credit Card', 'CREDIT_CARD'],
      ['INCOME', 'Interest Earned', null],
      ['INCOME', 'Salary', null],
      ['EXPENSE', 'Dining', null],
      ['EXPENSE', 'Electricity', null],
      ['EXPENSE', 'Groceries', null],
      ['EXPENSE', 'Telecom', null],
    ]);
    for (const item of items) {
      expect(Object.keys(item).sort()).toEqual(ACCOUNT_FIELDS);
      expect(item.balance).toBe(0);
      expect(item.openingBalance).toBeNull();
      expect(item.isArchived).toBe(false);
    }

    // BR-01: every returned id is Alice's; none of Bob's nine accounts leak.
    const aliceIds = (await prisma.account.findMany({ where: { userId: seededUsers.alice.id } })).map((a) => a.id);
    const bobIds = (await prisma.account.findMany({ where: { userId: seededUsers.bob.id } })).map((a) => a.id);
    expect(bobIds).toHaveLength(9);
    expect(items.map((a) => a.id).sort()).toEqual([...aliceIds].sort());
    expect(items.some((a) => bobIds.includes(a.id))).toBe(false);
  });

  it('TEST-03.2 (AC-03.2): anonymous gets 401 UNAUTHENTICATED and Admin gets 403 FORBIDDEN with no account data', async () => {
    const anonymous = await request(app).get(ACCOUNTS_URL);
    expect(anonymous.status).toBe(401);
    expect(Object.keys(anonymous.body)).toEqual(['error']);
    expect(anonymous.body.error.code).toBe('UNAUTHENTICATED');

    const adminToken = await createTestSession(seededUsers.admin.id);
    const admin = await getAccounts(adminToken);
    expect(admin.status).toBe(403);
    expect(Object.keys(admin.body)).toEqual(['error']);
    expect(admin.body.error.code).toBe('FORBIDDEN');

    for (const res of [anonymous, admin]) {
      expect(res.text).not.toContain('Bank Account');
      expect(res.text).not.toContain('items');
    }
  });

  it('TEST-03.3 (AC-03.3): balances reflect opening, salary, card charge and repayment, and ignore the voided payment', async () => {
    const { openingTransactionId, voidedTransactionId } = await insertDemoLedger(seededUsers.alice.id);
    // The voided row really is in the ledger, so excluding it is meaningful.
    expect(await prisma.transaction.count({ where: { id: voidedTransactionId, voidedAt: { not: null } } })).toBe(1);

    const res = await getAccounts(aliceToken);
    expect(res.status).toBe(200);
    const accounts = byName(res.body.items);

    expect(accounts['Bank Account'].balance).toBe(7_920_000); // 79,200.00 THB
    expect(accounts['Credit Card'].balance).toBe(40_000); // 400.00 THB debt
    expect(accounts['Salary'].balance).toBe(3_000_000); // 30,000.00 THB
    expect(accounts['Dining'].balance).toBe(70_000); // 700.00 THB
    expect(accounts['Groceries'].balance).toBe(50_000); // 500.00 THB
    expect(accounts['Telecom'].balance).toBe(0); // voided 5,000.00 THB payment excluded
    expect(accounts['Wallet'].balance).toBe(0);

    expect(accounts['Bank Account'].openingBalance).toEqual({
      transactionId: openingTransactionId,
      amount: 5_000_000, // 50,000.00 THB
      date: '2026-01-01',
    });
    for (const name of ['Wallet', 'Credit Card', 'Salary', 'Dining']) {
      expect(accounts[name].openingBalance).toBeNull();
    }

    // Bob's view is untouched by Alice's ledger (BR-01).
    const bobToken = await createTestSession(seededUsers.bob.id);
    const bob = await getAccounts(bobToken);
    expect(bob.body.items.every((a: AccountItem) => a.balance === 0)).toBe(true);
  });

  it('TEST-03.4 (AC-03.4): net worth from the API equals openings + income − expenses to the satang', async () => {
    await insertDemoLedger(seededUsers.alice.id);

    const res = await getAccounts(aliceToken);
    expect(res.status).toBe(200);
    const items: AccountItem[] = res.body.items;

    // Integer satang arithmetic, computed independently of the engine.
    const sum = (filter: (a: AccountItem) => boolean, value: (a: AccountItem) => number) =>
      items.filter(filter).reduce((total, a) => total + value(a), 0);
    const balanceOf = (a: AccountItem) => a.balance;
    const openingOf = (a: AccountItem) => a.openingBalance?.amount ?? 0;

    const netWorth =
      sum((a) => a.type === 'CASH' || a.type === 'LOAN_GIVEN', balanceOf) - sum((a) => a.type === 'LOAN_TAKEN', balanceOf);
    const openings =
      sum((a) => a.type === 'CASH' || a.type === 'LOAN_GIVEN', openingOf) - sum((a) => a.type === 'LOAN_TAKEN', openingOf);
    const income = sum((a) => a.type === 'INCOME', balanceOf);
    const expense = sum((a) => a.type === 'EXPENSE', balanceOf);

    expect(netWorth).toBe(7_880_000); // 78,800.00 THB
    expect(openings).toBe(5_000_000); // 50,000.00 THB
    expect(income).toBe(3_000_000); // 30,000.00 THB
    expect(expense).toBe(120_000); // 1,200.00 THB
    expect(netWorth - (openings + income - expense)).toBe(0);
  });

  it('TEST-03.5 (AC-03.5): the SQL aggregation behind the API and the pure engine agree on every account', async () => {
    await insertRandomLedger(seededUsers.alice.id, 20261111, 120);
    await insertRandomLedger(seededUsers.bob.id, 42, 40);

    const res = await getAccounts(aliceToken);
    expect(res.status).toBe(200);
    const items: AccountItem[] = res.body.items;

    const { accounts, transactions } = await loadLedger(seededUsers.alice.id);
    const expected = computeBalances(accounts, transactions);

    // The dataset is non-trivial: voided rows exist and most balances moved.
    expect(transactions.some((t) => t.voidedAt !== null)).toBe(true);
    expect(items.filter((a) => a.balance !== 0).length).toBeGreaterThanOrEqual(8);

    expect(items).toHaveLength(accounts.length);
    for (const item of items) {
      expect(BigInt(item.balance), item.name).toBe(expected.get(item.id));
    }
  });
});
