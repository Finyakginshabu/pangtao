import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../../server/src/app.js';
import { prisma } from '../../server/src/prisma.js';
import { resetDatabase, createTestSession } from '../helpers/db.helper.js';
import { clearRateLimitStore } from '../../server/src/middleware/rate-limit.middleware.js';
import { accountIdsByName } from '../helpers/ledger.helper.js';

// State-changing requests must carry an Origin (NFR-10); act as the Vite dev origin.
const TEST_ORIGIN = 'http://localhost:3000';
const get = (url: string) => request(app).get(url).set('Origin', TEST_ORIGIN);
const post = (url: string) => request(app).post(url).set('Origin', TEST_ORIGIN);

const ACCOUNTS_URL = '/api/v1/accounts';
const openingUrl = (accountId: string) => `${ACCOUNTS_URL}/${accountId}/opening-balance`;

// f-04 TEST-04.1: a fixed calendar date in the past, so the fixture never becomes "future".
const DATE = '2026-11-01';

interface AccountItem {
  id: string;
  name: string;
  type: 'CASH' | 'LOAN_TAKEN' | 'LOAN_GIVEN' | 'INCOME' | 'EXPENSE';
  balance: number;
  openingBalance: { transactionId: string; amount: number; date: string } | null;
}

interface OpeningBalanceResponse {
  transaction: {
    id: string;
    kind: string;
    accountId: string;
    txnDate: string;
    totalAmount: number;
  };
}

/** Bangkok calendar date offset by whole days from now (BR-10 uses Asia/Bangkok). */
function bangkokDate(offsetDays: number): string {
  const shifted = new Date(Date.now() + offsetDays * 86_400_000);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(shifted);
}

async function accountsByName(token: string): Promise<Record<string, AccountItem>> {
  const res = await get(ACCOUNTS_URL).set('Cookie', [`sid=${token}`]);
  expect(res.status).toBe(200);
  return Object.fromEntries((res.body.items as AccountItem[]).map((a) => [a.name, a]));
}

const countOpeningBalances = (accountId: string) =>
  prisma.transaction.count({ where: { accountId, kind: 'OPENING_BALANCE' } });

describe('F-04 Opening Balance (STS)', () => {
  let seededUsers: Awaited<ReturnType<typeof resetDatabase>>;
  let aliceToken: string;
  let bobToken: string;
  let adminToken: string;
  let ids: Record<string, string>;

  beforeEach(async () => {
    clearRateLimitStore();
    seededUsers = await resetDatabase();
    aliceToken = await createTestSession(seededUsers.alice.id);
    bobToken = await createTestSession(seededUsers.bob.id);
    adminToken = await createTestSession(seededUsers.admin.id);
    ids = await accountIdsByName(seededUsers.alice.id);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('TEST-04.1 (AC-04.1): a Cash opening balance returns 201 and raises the derived balance by that satang amount', async () => {
    const res = await post(openingUrl(ids['Bank Account']))
      .set('Cookie', [`sid=${aliceToken}`])
      .send({ amount: 5_000_000, date: DATE });

    expect(res.status).toBe(201);
    expect(Object.keys(res.body)).toEqual(['transaction']);

    const txn = (res.body as OpeningBalanceResponse).transaction;
    expect(Object.keys(txn).sort()).toEqual(['accountId', 'id', 'kind', 'totalAmount', 'txnDate']);
    expect(txn.kind).toBe('OPENING_BALANCE');
    expect(txn.accountId).toBe(ids['Bank Account']);
    expect(txn.txnDate).toBe(DATE);
    expect(txn.totalAmount).toBe(5_000_000);

    // f-04 §2.3: one transactions row, zero allocation lines, not voided.
    const stored = await prisma.transaction.findUnique({ where: { id: txn.id }, include: { lines: true } });
    expect(stored?.userId).toBe(seededUsers.alice.id);
    expect(stored?.kind).toBe('OPENING_BALANCE');
    expect(stored?.totalAmount).toBe(5_000_000n);
    expect(stored?.lines).toHaveLength(0);
    expect(stored?.voidedAt).toBeNull();

    const accounts = await accountsByName(aliceToken);
    expect(accounts['Bank Account'].balance).toBe(5_000_000);
    expect(accounts['Bank Account'].openingBalance).toEqual({
      transactionId: txn.id,
      amount: 5_000_000,
      date: DATE,
    });
  });

  it('TEST-04.2 (AC-04.2): a Loan Taken opening balance returns 201 and establishes the debt baseline', async () => {
    const res = await post(openingUrl(ids['Credit Card']))
      .set('Cookie', [`sid=${aliceToken}`])
      .send({ amount: 1_500_000, date: DATE });

    expect(res.status).toBe(201);
    expect(res.body.transaction.kind).toBe('OPENING_BALANCE');

    const accounts = await accountsByName(aliceToken);
    expect(accounts['Credit Card'].balance).toBe(1_500_000);
    expect(accounts['Credit Card'].openingBalance?.amount).toBe(1_500_000);
  });

  it('TEST-04.3 (AC-04.3): an opening balance of 0 satang is accepted and recorded', async () => {
    const res = await post(openingUrl(ids['Wallet']))
      .set('Cookie', [`sid=${aliceToken}`])
      .send({ amount: 0, date: DATE });

    expect(res.status).toBe(201);
    expect(res.body.transaction.totalAmount).toBe(0);
    expect(await countOpeningBalances(ids['Wallet'])).toBe(1);

    const accounts = await accountsByName(aliceToken);
    expect(accounts['Wallet'].balance).toBe(0);
    expect(accounts['Wallet'].openingBalance?.amount).toBe(0);
  });

  it('TEST-04.4 (AC-04.4): a second opening balance returns 409 and leaves the first one intact', async () => {
    const first = await post(openingUrl(ids['Bank Account']))
      .set('Cookie', [`sid=${aliceToken}`])
      .send({ amount: 5_000_000, date: DATE });
    expect(first.status).toBe(201);

    const second = await post(openingUrl(ids['Bank Account']))
      .set('Cookie', [`sid=${aliceToken}`])
      .send({ amount: 1_000_000, date: '2026-11-02' });

    expect(second.status).toBe(409);
    expect(Object.keys(second.body)).toEqual(['error']);
    expect(second.body.error.code).toBe('OPENING_BALANCE_EXISTS');

    expect(await countOpeningBalances(ids['Bank Account'])).toBe(1);
    const stored = await prisma.transaction.findFirst({
      where: { accountId: ids['Bank Account'], kind: 'OPENING_BALANCE' },
    });
    expect(stored?.totalAmount).toBe(5_000_000n);

    const accounts = await accountsByName(aliceToken);
    expect(accounts['Bank Account'].balance).toBe(5_000_000);
    expect(accounts['Bank Account'].openingBalance?.transactionId).toBe(first.body.transaction.id);
  });

  it('TEST-04.5 (AC-04.5): Income and Expense accounts reject an opening balance with 400 VALIDATION_ERROR', async () => {
    for (const name of ['Salary', 'Dining']) {
      const res = await post(openingUrl(ids[name]))
        .set('Cookie', [`sid=${aliceToken}`])
        .send({ amount: 100_000, date: DATE });

      expect(res.status, name).toBe(400);
      expect(res.body.error.code, name).toBe('VALIDATION_ERROR');
      expect(await countOpeningBalances(ids[name]), name).toBe(0);
    }

    expect(await prisma.transaction.count({ where: { userId: seededUsers.alice.id } })).toBe(0);
  });

  it('TEST-04.6 (AC-04.6): a future date (Bangkok) returns 400 FUTURE_DATE_NOT_ALLOWED and saves nothing', async () => {
    const res = await post(openingUrl(ids['Bank Account']))
      .set('Cookie', [`sid=${aliceToken}`])
      .send({ amount: 100_000, date: bangkokDate(1) });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('FUTURE_DATE_NOT_ALLOWED');
    expect(await prisma.transaction.count({ where: { userId: seededUsers.alice.id } })).toBe(0);

    // Boundary: today in Bangkok is still allowed (BR-10 is "not later than today").
    const today = await post(openingUrl(ids['Wallet']))
      .set('Cookie', [`sid=${aliceToken}`])
      .send({ amount: 100_000, date: bangkokDate(0) });
    expect(today.status).toBe(201);
  });

  it('TEST-04.7 (AC-04.7): negative, over-limit and non-integer amounts return 400 VALIDATION_ERROR', async () => {
    for (const amount of [-100, 10_000_000_001, 1.5, '5000000']) {
      const res = await post(openingUrl(ids['Bank Account']))
        .set('Cookie', [`sid=${aliceToken}`])
        .send({ amount, date: DATE });

      expect(res.status, String(amount)).toBe(400);
      expect(res.body.error.code, String(amount)).toBe('VALIDATION_ERROR');
    }
    expect(await prisma.transaction.count({ where: { userId: seededUsers.alice.id } })).toBe(0);

    // Boundary: the maximum allowed amount (100,000,000.00 THB) is accepted (BR-04).
    const max = await post(openingUrl(ids['Wallet']))
      .set('Cookie', [`sid=${aliceToken}`])
      .send({ amount: 10_000_000_000, date: DATE });
    expect(max.status).toBe(201);
  });

  it('TEST-04.8 (AC-04.8): another user gets 404, an Administrator 403 and an anonymous caller 401', async () => {
    const bob = await post(openingUrl(ids['Bank Account']))
      .set('Cookie', [`sid=${bobToken}`])
      .send({ amount: 100_000, date: DATE });
    expect(bob.status).toBe(404);
    expect(bob.body.error.code).toBe('NOT_FOUND');

    const admin = await post(openingUrl(ids['Bank Account']))
      .set('Cookie', [`sid=${adminToken}`])
      .send({ amount: 100_000, date: DATE });
    expect(admin.status).toBe(403);
    expect(admin.body.error.code).toBe('FORBIDDEN');

    const anonymous = await post(openingUrl(ids['Bank Account'])).send({ amount: 100_000, date: DATE });
    expect(anonymous.status).toBe(401);
    expect(anonymous.body.error.code).toBe('UNAUTHENTICATED');

    // Nothing leaked and nothing written.
    for (const res of [bob, admin, anonymous]) {
      expect(res.text).not.toContain('Bank Account');
      expect(res.text).not.toContain('OPENING_BALANCE');
    }
    expect(await countOpeningBalances(ids['Bank Account'])).toBe(0);
  });

  it('TEST-04.9 (AC-04.9): a Loan Given opening balance returns 201 and establishes the amount owed to the user', async () => {
    const loanGiven = await prisma.account.create({
      data: { userId: seededUsers.alice.id, name: 'Loan to Carol', type: 'LOAN_GIVEN' },
    });

    const res = await post(openingUrl(loanGiven.id))
      .set('Cookie', [`sid=${aliceToken}`])
      .send({ amount: 2_000_000, date: DATE });

    expect(res.status).toBe(201);

    const accounts = await accountsByName(aliceToken);
    expect(accounts['Loan to Carol'].balance).toBe(2_000_000);
    expect(accounts['Loan to Carol'].openingBalance?.amount).toBe(2_000_000);
  });

  it('TEST-04.10 (AC-04.10): an archived account is rejected with 400 VALIDATION_ERROR and saves nothing', async () => {
    await prisma.account.update({ where: { id: ids['Wallet'] }, data: { isArchived: true } });

    const res = await post(openingUrl(ids['Wallet']))
      .set('Cookie', [`sid=${aliceToken}`])
      .send({ amount: 100_000, date: DATE });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(await countOpeningBalances(ids['Wallet'])).toBe(0);
    expect(await prisma.transaction.count({ where: { userId: seededUsers.alice.id } })).toBe(0);
  });

  describe('Contract §2.1: request handling', () => {
    it('rejects a malformed account id with 400 VALIDATION_ERROR and an unknown one with 404', async () => {
      const malformed = await post(openingUrl('abc-123'))
        .set('Cookie', [`sid=${aliceToken}`])
        .send({ amount: 100_000, date: DATE });
      expect(malformed.status).toBe(400);
      expect(malformed.body.error.code).toBe('VALIDATION_ERROR');

      const unknown = await post(openingUrl('11111111-1111-4111-8111-111111111111'))
        .set('Cookie', [`sid=${aliceToken}`])
        .send({ amount: 100_000, date: DATE });
      expect(unknown.status).toBe(404);
      expect(unknown.body.error.code).toBe('NOT_FOUND');
    });

    it('rejects a non-JSON body with 415 and unknown fields with 400', async () => {
      const notJson = await post(openingUrl(ids['Bank Account']))
        .set('Cookie', [`sid=${aliceToken}`])
        .set('Content-Type', 'text/plain')
        .send('amount=100000');
      expect(notJson.status).toBe(415);
      expect(notJson.body.error.code).toBe('UNSUPPORTED_MEDIA_TYPE');

      const extraField = await post(openingUrl(ids['Bank Account']))
        .set('Cookie', [`sid=${aliceToken}`])
        .send({ amount: 100_000, date: DATE, accountId: ids['Wallet'] });
      expect(extraField.status).toBe(400);
      expect(extraField.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects a malformed or impossible calendar date with 400 VALIDATION_ERROR', async () => {
      for (const date of ['01-11-2026', '2026-02-30', '2026-11-1']) {
        const res = await post(openingUrl(ids['Bank Account']))
          .set('Cookie', [`sid=${aliceToken}`])
          .send({ amount: 100_000, date });
        expect(res.status, date).toBe(400);
        expect(res.body.error.code, date).toBe('VALIDATION_ERROR');
      }
    });
  });
});
