import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../../server/src/app.js';
import { prisma } from '../../server/src/prisma.js';
import { resetDatabase, createTestSession } from '../helpers/db.helper.js';
import { clearRateLimitStore } from '../../server/src/middleware/rate-limit.middleware.js';
import { insertDemoLedger } from '../helpers/ledger.helper.js';

const TRANSACTIONS_URL = '/api/v1/transactions';
const HISTORY_INDEX = 'transactions_user_id_txn_date_created_at_idx';

const get = (url: string, token?: string) => {
  const req = request(app).get(url);
  return token ? req.set('Cookie', [`sid=${token}`]) : req;
};

interface HistoryLine {
  id: string;
  targetAccountId: string;
  targetAccountName: string;
  amount: number;
  note: string | null;
}

interface HistoryItem {
  id: string;
  kind: string;
  accountId: string;
  accountName: string;
  txnDate: string;
  totalAmount: number;
  memo: string | null;
  lines: HistoryLine[];
}

const ITEM_KEYS = ['accountId', 'accountName', 'id', 'kind', 'lines', 'memo', 'totalAmount', 'txnDate'];
const LINE_KEYS = ['amount', 'id', 'note', 'targetAccountId', 'targetAccountName'];

describe('F-07 Transaction History (STS)', () => {
  let seededUsers: Awaited<ReturnType<typeof resetDatabase>>;
  let aliceToken: string;
  let bobToken: string;
  let adminToken: string;
  let demo: Awaited<ReturnType<typeof insertDemoLedger>>;

  beforeEach(async () => {
    await clearRateLimitStore();
    seededUsers = await resetDatabase();
    aliceToken = await createTestSession(seededUsers.alice.id);
    bobToken = await createTestSession(seededUsers.bob.id);
    adminToken = await createTestSession(seededUsers.admin.id);
    // Demo dataset: opening 50,000.00, salary 30,000.00, card 1,200.00 (700.00 + 500.00),
    // repayment 800.00, plus one voided 5,000.00 payment that history must not list (f-07 1.1 §1).
    demo = await insertDemoLedger(seededUsers.alice.id);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('TEST-07.1 (AC-07.1): lists the user\'s transactions newest first with totals, account names and nested lines', async () => {
    const res = await get(TRANSACTIONS_URL, aliceToken);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ total: 4, limit: 50, offset: 0 });
    const items = res.body.items as HistoryItem[];
    expect(items.map((t) => t.id)).toEqual([
      demo.repaymentTransactionId, // 27 Jan
      demo.cardChargeTransactionId, // 26 Jan
      demo.salaryTransactionId, // 25 Jan
      demo.openingTransactionId, // 1 Jan
    ]);
    expect(items.map((t) => t.id)).not.toContain(demo.voidedTransactionId);

    for (const item of items) {
      expect(Object.keys(item).sort()).toEqual(ITEM_KEYS);
      for (const line of item.lines) {
        expect(Object.keys(line).sort()).toEqual(LINE_KEYS);
      }
    }

    const [repayment, card, salary, opening] = items;
    expect(repayment).toMatchObject({
      kind: 'PAYMENT',
      accountId: demo.ids['Bank Account'],
      accountName: 'Bank Account',
      txnDate: '2026-01-27',
      totalAmount: 80_000, // 800.00 THB
      memo: null,
    });
    expect(repayment.lines.map((l) => [l.targetAccountName, l.amount])).toEqual([['Credit Card', 80_000]]);

    expect(card).toMatchObject({
      kind: 'PAYMENT',
      accountName: 'Credit Card',
      txnDate: '2026-01-26',
      totalAmount: 120_000, // 1,200.00 THB
      memo: 'Dinner and groceries',
    });
    expect(card.lines.map((l) => [l.targetAccountId, l.targetAccountName, l.amount, l.note])).toEqual([
      [demo.ids['Dining'], 'Dining', 70_000, 'Team dinner'], // 700.00 THB
      [demo.ids['Groceries'], 'Groceries', 50_000, null], // 500.00 THB
    ]);

    expect(salary).toMatchObject({
      kind: 'RECEIPT',
      accountName: 'Bank Account',
      totalAmount: 3_000_000, // 30,000.00 THB
      memo: 'January salary',
    });
    expect(salary.lines.map((l) => [l.targetAccountName, l.amount])).toEqual([['Salary', 3_000_000]]);

    expect(opening).toMatchObject({
      kind: 'OPENING_BALANCE',
      accountName: 'Bank Account',
      txnDate: '2026-01-01',
      totalAmount: 5_000_000, // 50,000.00 THB
      lines: [],
    });
  });

  it('TEST-07.2 (AC-07.2): limit and offset return the matching slice with an accurate total', async () => {
    const page = await get(`${TRANSACTIONS_URL}?limit=2&offset=2`, aliceToken);

    expect(page.status).toBe(200);
    expect(page.body).toMatchObject({ total: 4, limit: 2, offset: 2 });
    expect((page.body.items as HistoryItem[]).map((t) => t.id)).toEqual([
      demo.salaryTransactionId,
      demo.openingTransactionId,
    ]);

    const tooLarge = await get(`${TRANSACTIONS_URL}?limit=101`, aliceToken);
    expect(tooLarge.status).toBe(400);
    expect(tooLarge.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('TEST-07.3 (AC-07.3): one transaction by id returns its complete detail', async () => {
    const res = await get(`${TRANSACTIONS_URL}/${demo.cardChargeTransactionId}`, aliceToken);

    expect(res.status).toBe(200);
    const txn = res.body.transaction as HistoryItem;
    expect(Object.keys(txn).sort()).toEqual(ITEM_KEYS);
    expect(txn).toMatchObject({
      id: demo.cardChargeTransactionId,
      kind: 'PAYMENT',
      accountId: demo.ids['Credit Card'],
      accountName: 'Credit Card',
      txnDate: '2026-01-26',
      totalAmount: 120_000, // 1,200.00 THB
      memo: 'Dinner and groceries',
    });
    expect(txn.lines.map((l) => [l.targetAccountName, l.amount, l.note])).toEqual([
      ['Dining', 70_000, 'Team dinner'], // 700.00 THB
      ['Groceries', 50_000, null], // 500.00 THB
    ]);
  });

  it('TEST-07.4 (AC-07.4): another user\'s transaction id returns 404 NOT_FOUND with no data', async () => {
    const url = `${TRANSACTIONS_URL}/${demo.salaryTransactionId}`;

    // Control: the owner can read it, so Bob's 404 below comes from ownership, not a missing route.
    const own = await get(url, aliceToken);
    expect(own.status).toBe(200);
    expect(own.body.transaction.id).toBe(demo.salaryTransactionId);

    const res = await get(url, bobToken);
    expect(res.status).toBe(404);
    expect(Object.keys(res.body)).toEqual(['error']);
    expect(res.body.error.code).toBe('NOT_FOUND');
    expect(JSON.stringify(res.body)).not.toContain(demo.salaryTransactionId);
    expect(JSON.stringify(res.body)).not.toContain('January salary');

    // Bob's own history is empty: none of Alice's rows leak into his list.
    const bobList = await get(TRANSACTIONS_URL, bobToken);
    expect(bobList.status).toBe(200);
    expect(bobList.body).toMatchObject({ items: [], total: 0 });
  });

  it('TEST-07.5 (AC-07.5): an Administrator receives 403 FORBIDDEN on both history endpoints', async () => {
    const list = await get(TRANSACTIONS_URL, adminToken);
    expect(list.status).toBe(403);
    expect(list.body.error.code).toBe('FORBIDDEN');
    expect(list.body).not.toHaveProperty('items');

    const detail = await get(`${TRANSACTIONS_URL}/${demo.cardChargeTransactionId}`, adminToken);
    expect(detail.status).toBe(403);
    expect(detail.body.error.code).toBe('FORBIDDEN');
    expect(detail.body).not.toHaveProperty('transaction');
  });

  it('TEST-07.7 (AC-07.5): an anonymous caller receives 401 UNAUTHENTICATED on both history endpoints', async () => {
    const list = await get(TRANSACTIONS_URL);
    expect(list.status).toBe(401);
    expect(list.body.error.code).toBe('UNAUTHENTICATED');
    expect(list.body).not.toHaveProperty('items');

    const detail = await get(`${TRANSACTIONS_URL}/${demo.cardChargeTransactionId}`);
    expect(detail.status).toBe(401);
    expect(detail.body.error.code).toBe('UNAUTHENTICATED');
    expect(detail.body).not.toHaveProperty('transaction');
  });

  it('TEST-07.8 (AC-07.7): a negative offset or a limit above 100 returns 400 VALIDATION_ERROR and no items', async () => {
    for (const query of ['offset=-1', 'limit=101']) {
      const res = await get(`${TRANSACTIONS_URL}?${query}`, aliceToken);
      expect(res.status, query).toBe(400);
      expect(res.body.error.code, query).toBe('VALIDATION_ERROR');
      expect(res.body, query).not.toHaveProperty('items');
    }
  });

  it('a malformed transaction id returns 400 VALIDATION_ERROR and an offset past the end returns an empty page', async () => {
    const malformed = await get(`${TRANSACTIONS_URL}/not-a-uuid`, aliceToken);
    expect(malformed.status).toBe(400);
    expect(malformed.body.error.code).toBe('VALIDATION_ERROR');

    const pastEnd = await get(`${TRANSACTIONS_URL}?offset=10`, aliceToken);
    expect(pastEnd.status).toBe(200);
    expect(pastEnd.body).toMatchObject({ items: [], total: 4, limit: 50, offset: 10 });
  });

  it('transactions tied on date and creation time page in a stable id order, each exactly once', async () => {
    // Bulk-inserted rows share created_at; without a final tie-break, offset pages may repeat or skip them.
    const createdAt = new Date('2026-02-01T03:00:00.000Z');
    const lowId = '00000000-0000-4000-8000-000000000001';
    const highId = 'ffffffff-ffff-4fff-bfff-ffffffffffff';
    for (const id of [lowId, highId]) {
      await prisma.transaction.create({
        data: {
          id,
          userId: seededUsers.alice.id,
          kind: 'PAYMENT',
          accountId: demo.ids['Wallet'],
          txnDate: new Date('2026-02-01T00:00:00.000Z'),
          totalAmount: BigInt(10_000), // 100.00 THB
          createdAt,
        },
      });
    }

    const first = await get(`${TRANSACTIONS_URL}?limit=1&offset=0`, aliceToken);
    const second = await get(`${TRANSACTIONS_URL}?limit=1&offset=1`, aliceToken);
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect([first.body.items[0].id, second.body.items[0].id]).toEqual([highId, lowId]);
  });

  it('a voided transaction is not returned by id (f-07 1.1 §1)', async () => {
    const res = await get(`${TRANSACTIONS_URL}/${demo.voidedTransactionId}`, aliceToken);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it(`the history query uses ${HISTORY_INDEX} on a realistic ledger (f-07 §5)`, async () => {
    // A handful of rows is always cheapest to seq-scan, so give Alice a realistic history
    // (3,000 rows over ~3 years) and refresh planner statistics before reading the plan.
    // Rows carry no lines: only the transactions table matters to this plan. Timing is NFR-07.
    const accountId = demo.ids['Wallet'];
    await prisma.transaction.createMany({
      data: Array.from({ length: 3000 }, (_, i) => ({
        userId: seededUsers.alice.id,
        kind: 'PAYMENT' as const,
        accountId,
        txnDate: new Date(Date.UTC(2023, 0, 1 + (i % 1000))),
        totalAmount: BigInt(100 + i), // 1.00 THB upward
      })),
    });
    await prisma.$executeRawUnsafe('ANALYZE transactions');

    const plan = await prisma.$queryRaw<Array<{ 'QUERY PLAN': string }>>`
      EXPLAIN SELECT id FROM transactions
      WHERE user_id = ${seededUsers.alice.id}::uuid AND voided_at IS NULL
      ORDER BY txn_date DESC, created_at DESC, id DESC
      LIMIT 50 OFFSET 0`;
    expect(plan.map((row) => row['QUERY PLAN']).join('\n')).toContain(HISTORY_INDEX);
  });
});
