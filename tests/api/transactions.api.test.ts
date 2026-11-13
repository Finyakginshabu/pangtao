import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../../server/src/app.js';
import { prisma } from '../../server/src/prisma.js';
import { resetDatabase, createTestSession } from '../helpers/db.helper.js';
import { clearRateLimitStore } from '../../server/src/middleware/rate-limit.middleware.js';
import { accountIdsByName, bangkokDate, countLedgerRows } from '../helpers/ledger.helper.js';

// State-changing requests must carry an Origin (NFR-10); act as the Vite dev origin.
const TEST_ORIGIN = 'http://localhost:3000';
const get = (url: string) => request(app).get(url).set('Origin', TEST_ORIGIN);
const post = (url: string) => request(app).post(url).set('Origin', TEST_ORIGIN);

const ACCOUNTS_URL = '/api/v1/accounts';
const TRANSACTIONS_URL = '/api/v1/transactions';

// A fixed calendar date in the past, so fixtures never become "future".
const DATE = '2026-11-01';

interface AccountItem {
  id: string;
  name: string;
  balance: number;
}

interface PaymentLineInput {
  targetAccountId: string;
  amount: number;
  note?: string;
}

interface PaymentInput {
  accountId: string;
  totalAmount: number;
  lines: PaymentLineInput[];
  txnDate?: string;
  memo?: string;
}

const payment = (input: PaymentInput) => ({ kind: 'PAYMENT', txnDate: DATE, ...input });

describe('F-05 Payment and Charge (STS)', () => {
  let seededUsers: Awaited<ReturnType<typeof resetDatabase>>;
  let aliceToken: string;
  let bobToken: string;
  let adminToken: string;
  let ids: Record<string, string>;
  let bobIds: Record<string, string>;

  const asAlice = (url: string) => post(url).set('Cookie', [`sid=${aliceToken}`]);

  async function balances(token: string): Promise<Record<string, number>> {
    const res = await get(ACCOUNTS_URL).set('Cookie', [`sid=${token}`]);
    expect(res.status).toBe(200);
    return Object.fromEntries((res.body.items as AccountItem[]).map((a) => [a.name, a.balance]));
  }

  async function openBank(amount: number) {
    const res = await asAlice(`${ACCOUNTS_URL}/${ids['Bank Account']}/opening-balance`).send({ amount, date: '2026-01-01' });
    expect(res.status).toBe(201);
  }

  const aliceRows = () => countLedgerRows(seededUsers.alice.id);

  beforeEach(async () => {
    clearRateLimitStore();
    seededUsers = await resetDatabase();
    aliceToken = await createTestSession(seededUsers.alice.id);
    bobToken = await createTestSession(seededUsers.bob.id);
    adminToken = await createTestSession(seededUsers.admin.id);
    ids = await accountIdsByName(seededUsers.alice.id);
    bobIds = await accountIdsByName(seededUsers.bob.id);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('TEST-05.1 (AC-05.1): a multi-line payment from Cash returns 201, reduces Cash and raises each Expense total', async () => {
    await openBank(5_000_000); // 50,000.00 THB

    const res = await asAlice(TRANSACTIONS_URL).send(
      payment({
        accountId: ids['Bank Account'],
        totalAmount: 150_000, // 1,500.00 THB
        memo: 'Dinner and bills',
        lines: [
          { targetAccountId: ids['Dining'], amount: 100_000, note: 'Dinner' }, // 1,000.00 THB
          { targetAccountId: ids['Electricity'], amount: 50_000 }, // 500.00 THB
        ],
      })
    );

    expect(res.status).toBe(201);
    expect(Object.keys(res.body)).toEqual(['transaction']);
    const txn = res.body.transaction;
    expect(Object.keys(txn).sort()).toEqual(['accountId', 'id', 'kind', 'lines', 'memo', 'totalAmount', 'txnDate']);
    expect(txn).toMatchObject({
      kind: 'PAYMENT',
      accountId: ids['Bank Account'],
      txnDate: DATE,
      totalAmount: 150_000,
      memo: 'Dinner and bills',
    });
    expect(txn.lines).toHaveLength(2);
    expect(Object.keys(txn.lines[0]).sort()).toEqual(['amount', 'id', 'note', 'targetAccountId']);
    expect(txn.lines.map((l: PaymentLineInput) => [l.targetAccountId, l.amount, l.note])).toEqual([
      [ids['Dining'], 100_000, 'Dinner'],
      [ids['Electricity'], 50_000, null],
    ]);

    // f-05 §2.3: one transactions row and its lines, all owned by Alice.
    const stored = await prisma.transaction.findUnique({
      where: { id: txn.id },
      include: { lines: { orderBy: { lineNo: 'asc' } } },
    });
    expect(stored?.userId).toBe(seededUsers.alice.id);
    expect(stored?.totalAmount).toBe(150_000n);
    expect(stored?.lines.map((l) => [l.lineNo, l.amount, l.userId])).toEqual([
      [1, 100_000n, seededUsers.alice.id],
      [2, 50_000n, seededUsers.alice.id],
    ]);

    const after = await balances(aliceToken);
    expect(after['Bank Account']).toBe(4_850_000); // 48,500.00 THB
    expect(after['Dining']).toBe(100_000);
    expect(after['Electricity']).toBe(50_000);
  });

  it('TEST-05.2 (AC-05.2): a charge to the Credit Card returns 201 and raises the card debt', async () => {
    const res = await asAlice(TRANSACTIONS_URL).send(
      payment({
        accountId: ids['Credit Card'],
        totalAmount: 120_000, // 1,200.00 THB
        lines: [
          { targetAccountId: ids['Dining'], amount: 70_000 }, // 700.00 THB
          { targetAccountId: ids['Groceries'], amount: 50_000 }, // 500.00 THB
        ],
      })
    );

    expect(res.status).toBe(201);
    const after = await balances(aliceToken);
    expect(after['Credit Card']).toBe(120_000);
    expect(after['Dining']).toBe(70_000);
    expect(after['Groceries']).toBe(50_000);
  });

  it('TEST-05.3 (AC-05.3): a card repayment from Cash reduces Cash and card debt, and is not an expense', async () => {
    await openBank(5_000_000); // 50,000.00 THB
    const charge = await asAlice(TRANSACTIONS_URL).send(
      payment({
        accountId: ids['Credit Card'],
        totalAmount: 120_000,
        lines: [
          { targetAccountId: ids['Dining'], amount: 70_000 },
          { targetAccountId: ids['Groceries'], amount: 50_000 },
        ],
      })
    );
    expect(charge.status).toBe(201);

    const res = await asAlice(TRANSACTIONS_URL).send(
      payment({
        accountId: ids['Bank Account'],
        totalAmount: 80_000, // 800.00 THB
        lines: [{ targetAccountId: ids['Credit Card'], amount: 80_000 }],
      })
    );

    expect(res.status).toBe(201);
    const after = await balances(aliceToken);
    expect(after['Bank Account']).toBe(4_920_000); // 49,200.00 THB
    expect(after['Credit Card']).toBe(40_000); // 400.00 THB
    // BR-09: the repayment adds nothing to any Expense account.
    expect(after['Dining'] + after['Groceries'] + after['Electricity'] + after['Telecom']).toBe(120_000);
  });

  it('TEST-05.4 (AC-05.4): lines that do not sum to the total return 400 INVALID_ALLOCATION_SUM and save nothing', async () => {
    const res = await asAlice(TRANSACTIONS_URL).send(
      payment({
        accountId: ids['Credit Card'],
        totalAmount: 120_000, // 1,200.00 THB
        lines: [
          { targetAccountId: ids['Dining'], amount: 60_000 }, // 600.00 THB
          { targetAccountId: ids['Groceries'], amount: 40_000 }, // 400.00 THB
        ],
      })
    );

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_ALLOCATION_SUM');
    expect(await aliceRows()).toEqual({ transactions: 0, lines: 0 });
  });

  it('TEST-05.5 (AC-05.5): zero allocation lines return 400 VALIDATION_ERROR and save nothing', async () => {
    const res = await asAlice(TRANSACTIONS_URL).send(
      payment({ accountId: ids['Bank Account'], totalAmount: 100_000, lines: [] })
    );

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(await aliceRows()).toEqual({ transactions: 0, lines: 0 });
  });

  it('TEST-05.6 (AC-05.6): a card charge targeting a non-expense account returns 400 INVALID_TARGET_ACCOUNT', async () => {
    for (const target of ['Bank Account', 'Salary']) {
      const res = await asAlice(TRANSACTIONS_URL).send(
        payment({
          accountId: ids['Credit Card'],
          totalAmount: 100_000,
          lines: [{ targetAccountId: ids[target], amount: 100_000 }],
        })
      );
      expect(res.status, target).toBe(400);
      expect(res.body.error.code, target).toBe('INVALID_TARGET_ACCOUNT');
    }
    expect(await aliceRows()).toEqual({ transactions: 0, lines: 0 });
  });

  it("TEST-05.7 (AC-05.7): another user's source or target account returns 404 and leaks nothing", async () => {
    await openBank(5_000_000);
    const aliceBefore = await balances(aliceToken);
    const asBob = (url: string) => post(url).set('Cookie', [`sid=${bobToken}`]);

    // The route exists for Bob: his own payment succeeds, so the 404s below are ownership checks.
    const own = await asBob(TRANSACTIONS_URL).send(
      payment({
        accountId: bobIds['Credit Card'],
        totalAmount: 10_000,
        lines: [{ targetAccountId: bobIds['Dining'], amount: 10_000 }],
      })
    );
    expect(own.status).toBe(201);

    const aliceSource = await asBob(TRANSACTIONS_URL).send(
      payment({
        accountId: ids['Bank Account'],
        totalAmount: 10_000,
        lines: [{ targetAccountId: bobIds['Dining'], amount: 10_000 }],
      })
    );
    const aliceTarget = await asBob(TRANSACTIONS_URL).send(
      payment({
        accountId: bobIds['Credit Card'],
        totalAmount: 10_000,
        lines: [{ targetAccountId: ids['Dining'], amount: 10_000 }],
      })
    );

    for (const res of [aliceSource, aliceTarget]) {
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
      expect(res.text).not.toContain('Bank Account');
      expect(res.text).not.toContain('Dining');
      expect(res.text).not.toContain(ids['Bank Account']);
      expect(res.text).not.toContain(ids['Dining']);
    }

    expect(await balances(aliceToken)).toEqual(aliceBefore);
    expect(await aliceRows()).toEqual({ transactions: 1, lines: 0 }); // the opening balance only
    expect(await countLedgerRows(seededUsers.bob.id)).toEqual({ transactions: 1, lines: 1 });
  });

  it('TEST-05.8 (AC-05.8): a future date (Bangkok) returns 400 FUTURE_DATE_NOT_ALLOWED and saves nothing', async () => {
    const body = (txnDate: string) =>
      payment({
        accountId: ids['Credit Card'],
        txnDate,
        totalAmount: 10_000,
        lines: [{ targetAccountId: ids['Dining'], amount: 10_000 }],
      });

    const tomorrow = await asAlice(TRANSACTIONS_URL).send(body(bangkokDate(1)));
    expect(tomorrow.status).toBe(400);
    expect(tomorrow.body.error.code).toBe('FUTURE_DATE_NOT_ALLOWED');
    expect(await aliceRows()).toEqual({ transactions: 0, lines: 0 });

    // Boundary: today in Bangkok is allowed (BR-10 is "not later than today").
    const today = await asAlice(TRANSACTIONS_URL).send(body(bangkokDate(0)));
    expect(today.status).toBe(201);
  });

  it('TEST-05.10 (AC-05.10): an Income, Expense or Loan Given source returns 400 INVALID_SOURCE_ACCOUNT and saves nothing', async () => {
    const loanGiven = await prisma.account.create({
      data: { userId: seededUsers.alice.id, name: 'Loan to Carol', type: 'LOAN_GIVEN' },
    });

    for (const [name, sourceId] of [
      ['Salary', ids['Salary']],
      ['Groceries', ids['Groceries']],
      ['Loan to Carol', loanGiven.id],
    ]) {
      const res = await asAlice(TRANSACTIONS_URL).send(
        payment({
          accountId: sourceId,
          totalAmount: 100_000, // 1,000.00 THB
          lines: [{ targetAccountId: ids['Dining'], amount: 100_000 }],
        })
      );
      expect(res.status, name).toBe(400);
      expect(res.body.error.code, name).toBe('INVALID_SOURCE_ACCOUNT');
    }
    expect(await aliceRows()).toEqual({ transactions: 0, lines: 0 });
  });

  it('TEST-05.11 (AC-05.11): zero, negative or over-limit amounts return 400 VALIDATION_ERROR and save nothing', async () => {
    const cases: Array<[string, number, number]> = [
      ['total 0', 0, 0],
      ['total -100', -100, -100],
      ['total 10000000001', 10_000_000_001, 10_000_000_001],
      ['line 0', 10_000, 0],
      ['line 1.5', 10_000, 1.5],
    ];
    for (const [label, totalAmount, lineAmount] of cases) {
      const res = await asAlice(TRANSACTIONS_URL).send(
        payment({
          accountId: ids['Bank Account'],
          totalAmount,
          lines: [{ targetAccountId: ids['Dining'], amount: lineAmount }],
        })
      );
      expect(res.status, label).toBe(400);
      expect(res.body.error.code, label).toBe('VALIDATION_ERROR');
    }
    expect(await aliceRows()).toEqual({ transactions: 0, lines: 0 });

    // Boundary: the maximum amount (100,000,000.00 THB) is accepted (BR-04).
    const max = await asAlice(TRANSACTIONS_URL).send(
      payment({
        accountId: ids['Credit Card'],
        totalAmount: 10_000_000_000,
        lines: [{ targetAccountId: ids['Dining'], amount: 10_000_000_000 }],
      })
    );
    expect(max.status).toBe(201);
  });

  it('TEST-05.12 (AC-05.12): an archived source returns 400 VALIDATION_ERROR and saves nothing', async () => {
    await prisma.account.update({ where: { id: ids['Wallet'] }, data: { isArchived: true } });

    const res = await asAlice(TRANSACTIONS_URL).send(
      payment({
        accountId: ids['Wallet'],
        totalAmount: 10_000, // 100.00 THB
        lines: [{ targetAccountId: ids['Dining'], amount: 10_000 }],
      })
    );

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(await aliceRows()).toEqual({ transactions: 0, lines: 0 });
  });

  it('TEST-05.13 (AC-05.13): a Cash, Income, self or archived target returns 400 INVALID_TARGET_ACCOUNT', async () => {
    await prisma.account.update({ where: { id: ids['Telecom'] }, data: { isArchived: true } });

    for (const target of ['Wallet', 'Salary', 'Bank Account', 'Telecom']) {
      const res = await asAlice(TRANSACTIONS_URL).send(
        payment({
          accountId: ids['Bank Account'],
          totalAmount: 10_000,
          lines: [{ targetAccountId: ids[target], amount: 10_000 }],
        })
      );
      expect(res.status, target).toBe(400);
      expect(res.body.error.code, target).toBe('INVALID_TARGET_ACCOUNT');
    }
    expect(await aliceRows()).toEqual({ transactions: 0, lines: 0 });
  });

  describe('Contract §2.1: request handling and access', () => {
    it('an Administrator gets 403 and an anonymous caller 401, and nothing is saved', async () => {
      const body = payment({
        accountId: ids['Credit Card'],
        totalAmount: 10_000,
        lines: [{ targetAccountId: ids['Dining'], amount: 10_000 }],
      });

      const admin = await post(TRANSACTIONS_URL).set('Cookie', [`sid=${adminToken}`]).send(body);
      expect(admin.status).toBe(403);
      expect(admin.body.error.code).toBe('FORBIDDEN');

      const anonymous = await post(TRANSACTIONS_URL).send(body);
      expect(anonymous.status).toBe(401);
      expect(anonymous.body.error.code).toBe('UNAUTHENTICATED');

      expect(await aliceRows()).toEqual({ transactions: 0, lines: 0 });
    });

    it('rejects a non-JSON body with 415, and unknown fields, malformed ids or dates and RECEIPT with 400', async () => {
      const notJson = await asAlice(TRANSACTIONS_URL).set('Content-Type', 'text/plain').send('kind=PAYMENT');
      expect(notJson.status).toBe(415);
      expect(notJson.body.error.code).toBe('UNSUPPORTED_MEDIA_TYPE');

      const valid = {
        accountId: ids['Credit Card'],
        totalAmount: 10_000,
        lines: [{ targetAccountId: ids['Dining'], amount: 10_000 }],
      };
      const invalidBodies: Array<[string, object]> = [
        ['unknown field', { ...payment(valid), userId: seededUsers.bob.id }],
        ['unknown line field', payment({ ...valid, lines: [{ ...valid.lines[0], lineNo: 1 } as PaymentLineInput] })],
        ['malformed accountId', payment({ ...valid, accountId: 'abc-123' })],
        ['malformed targetAccountId', payment({ ...valid, lines: [{ targetAccountId: 'abc', amount: 10_000 }] })],
        ['impossible date', payment({ ...valid, txnDate: '2026-02-30' })],
        ['string amount', { ...payment(valid), totalAmount: '10000' }],
        ['missing lines', { kind: 'PAYMENT', txnDate: DATE, accountId: valid.accountId, totalAmount: 10_000 }],
        ['RECEIPT (F-06)', { ...payment(valid), kind: 'RECEIPT' }],
      ];
      for (const [label, body] of invalidBodies) {
        const res = await asAlice(TRANSACTIONS_URL).send(body);
        expect(res.status, label).toBe(400);
        expect(res.body.error.code, label).toBe('VALIDATION_ERROR');
      }

      const unknown = await asAlice(TRANSACTIONS_URL).send(
        payment({ ...valid, accountId: '11111111-1111-4111-8111-111111111111' })
      );
      expect(unknown.status).toBe(404);
      expect(unknown.body.error.code).toBe('NOT_FOUND');

      expect(await aliceRows()).toEqual({ transactions: 0, lines: 0 });
    });

    it('is atomic: a multi-line request with one invalid line saves neither the header nor any line', async () => {
      const res = await asAlice(TRANSACTIONS_URL).send(
        payment({
          accountId: ids['Bank Account'],
          totalAmount: 30_000,
          lines: [
            { targetAccountId: ids['Dining'], amount: 10_000 },
            { targetAccountId: ids['Groceries'], amount: 10_000 },
            { targetAccountId: ids['Salary'], amount: 10_000 },
          ],
        })
      );

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_TARGET_ACCOUNT');
      expect(res.body.error.details).toEqual([expect.objectContaining({ field: 'lines.2.targetAccountId' })]);
      expect(await aliceRows()).toEqual({ transactions: 0, lines: 0 });
    });
  });
});

interface ReceiptLineInput {
  targetAccountId: string;
  amount: number;
  note?: string;
}

interface ReceiptInput {
  accountId: string;
  totalAmount: number;
  lines: ReceiptLineInput[];
  txnDate?: string;
  memo?: string;
}

const receipt = (input: ReceiptInput) => ({ kind: 'RECEIPT', txnDate: DATE, ...input });

describe('F-06 Received Money (STS)', () => {
  let seededUsers: Awaited<ReturnType<typeof resetDatabase>>;
  let aliceToken: string;
  let bobToken: string;
  let adminToken: string;
  let ids: Record<string, string>;
  let bobIds: Record<string, string>;

  const asAlice = (url: string) => post(url).set('Cookie', [`sid=${aliceToken}`]);

  async function balances(token: string): Promise<Record<string, number>> {
    const res = await get(ACCOUNTS_URL).set('Cookie', [`sid=${token}`]);
    expect(res.status).toBe(200);
    return Object.fromEntries((res.body.items as AccountItem[]).map((a) => [a.name, a.balance]));
  }

  async function openBank(amount: number) {
    const res = await asAlice(`${ACCOUNTS_URL}/${ids['Bank Account']}/opening-balance`).send({ amount, date: '2026-01-01' });
    expect(res.status).toBe(201);
  }

  const aliceRows = () => countLedgerRows(seededUsers.alice.id);

  beforeEach(async () => {
    clearRateLimitStore();
    seededUsers = await resetDatabase();
    aliceToken = await createTestSession(seededUsers.alice.id);
    bobToken = await createTestSession(seededUsers.bob.id);
    adminToken = await createTestSession(seededUsers.admin.id);
    ids = await accountIdsByName(seededUsers.alice.id);
    bobIds = await accountIdsByName(seededUsers.bob.id);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('TEST-06.1 (AC-06.1): a receipt into Cash allocated to Income returns 201, raises Cash and the Income total', async () => {
    await openBank(5_000_000); // 50,000.00 THB

    const res = await asAlice(TRANSACTIONS_URL).send(
      receipt({
        accountId: ids['Bank Account'],
        totalAmount: 3_000_000, // 30,000.00 THB
        memo: 'November salary',
        lines: [{ targetAccountId: ids['Salary'], amount: 3_000_000, note: 'Salary' }],
      })
    );

    expect(res.status).toBe(201);
    expect(Object.keys(res.body)).toEqual(['transaction']);
    const txn = res.body.transaction;
    expect(Object.keys(txn).sort()).toEqual(['accountId', 'id', 'kind', 'lines', 'memo', 'totalAmount', 'txnDate']);
    expect(txn).toMatchObject({
      kind: 'RECEIPT',
      accountId: ids['Bank Account'],
      txnDate: DATE,
      totalAmount: 3_000_000,
      memo: 'November salary',
    });
    expect(txn.lines).toHaveLength(1);
    expect(Object.keys(txn.lines[0]).sort()).toEqual(['amount', 'id', 'note', 'targetAccountId']);
    expect(txn.lines.map((l: ReceiptLineInput) => [l.targetAccountId, l.amount, l.note])).toEqual([
      [ids['Salary'], 3_000_000, 'Salary'],
    ]);

    // f-06 §2.3: one transactions row and its lines, all owned by Alice.
    const stored = await prisma.transaction.findUnique({
      where: { id: txn.id },
      include: { lines: { orderBy: { lineNo: 'asc' } } },
    });
    expect(stored?.userId).toBe(seededUsers.alice.id);
    expect(stored?.kind).toBe('RECEIPT');
    expect(stored?.totalAmount).toBe(3_000_000n);
    expect(stored?.lines.map((l) => [l.lineNo, l.amount, l.userId])).toEqual([
      [1, 3_000_000n, seededUsers.alice.id],
    ]);

    const after = await balances(aliceToken);
    expect(after['Bank Account']).toBe(8_000_000); // 80,000.00 THB
    expect(after['Salary']).toBe(3_000_000); // 30,000.00 THB
  });

  it('TEST-06.2 (AC-06.2): a multi-line receipt raises each Income account correctly', async () => {
    const res = await asAlice(TRANSACTIONS_URL).send(
      receipt({
        accountId: ids['Wallet'],
        totalAmount: 1_050_000, // 10,500.00 THB
        lines: [
          { targetAccountId: ids['Salary'], amount: 1_000_000 }, // 10,000.00 THB
          { targetAccountId: ids['Interest Earned'], amount: 50_000 }, // 500.00 THB
        ],
      })
    );

    expect(res.status).toBe(201);
    const after = await balances(aliceToken);
    expect(after['Wallet']).toBe(1_050_000);
    expect(after['Salary']).toBe(1_000_000);
    expect(after['Interest Earned']).toBe(50_000);
  });

  it('TEST-06.3 (AC-06.3): lines that do not sum to the total return 400 INVALID_ALLOCATION_SUM and save nothing', async () => {
    const res = await asAlice(TRANSACTIONS_URL).send(
      receipt({
        accountId: ids['Bank Account'],
        totalAmount: 500_000, // 5,000.00 THB
        lines: [{ targetAccountId: ids['Salary'], amount: 400_000 }], // 4,000.00 THB
      })
    );

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_ALLOCATION_SUM');
    expect(await aliceRows()).toEqual({ transactions: 0, lines: 0 });
  });

  it('TEST-06.4 (AC-06.4): a Credit Card or Expense receiving account returns 400 INVALID_SOURCE_ACCOUNT and saves nothing', async () => {
    for (const source of ['Credit Card', 'Dining']) {
      const res = await asAlice(TRANSACTIONS_URL).send(
        receipt({
          accountId: ids[source],
          totalAmount: 100_000, // 1,000.00 THB
          lines: [{ targetAccountId: ids['Salary'], amount: 100_000 }],
        })
      );
      expect(res.status, source).toBe(400);
      expect(res.body.error.code, source).toBe('INVALID_SOURCE_ACCOUNT');
    }
    expect(await aliceRows()).toEqual({ transactions: 0, lines: 0 });
  });

  it('TEST-06.5 (AC-06.5): a receipt targeting an Expense account returns 400 INVALID_TARGET_ACCOUNT and saves nothing', async () => {
    const res = await asAlice(TRANSACTIONS_URL).send(
      receipt({
        accountId: ids['Bank Account'],
        totalAmount: 100_000,
        lines: [{ targetAccountId: ids['Dining'], amount: 100_000 }],
      })
    );

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_TARGET_ACCOUNT');
    expect(await aliceRows()).toEqual({ transactions: 0, lines: 0 });
  });

  it('TEST-06.6 (AC-06.6): a future date (Bangkok) returns 400 FUTURE_DATE_NOT_ALLOWED and saves nothing', async () => {
    const body = (txnDate: string) =>
      receipt({
        accountId: ids['Bank Account'],
        txnDate,
        totalAmount: 10_000,
        lines: [{ targetAccountId: ids['Salary'], amount: 10_000 }],
      });

    const tomorrow = await asAlice(TRANSACTIONS_URL).send(body(bangkokDate(1)));
    expect(tomorrow.status).toBe(400);
    expect(tomorrow.body.error.code).toBe('FUTURE_DATE_NOT_ALLOWED');
    expect(await aliceRows()).toEqual({ transactions: 0, lines: 0 });

    // Boundary: today in Bangkok is allowed (BR-10 is "not later than today").
    const today = await asAlice(TRANSACTIONS_URL).send(body(bangkokDate(0)));
    expect(today.status).toBe(201);
  });

  it("TEST-06.7 (AC-06.7): another user's receiving or target account returns 404 and leaks nothing", async () => {
    await openBank(5_000_000);
    const aliceBefore = await balances(aliceToken);
    const asBob = (url: string) => post(url).set('Cookie', [`sid=${bobToken}`]);

    // The route exists for Bob: his own receipt succeeds, so the 404s below are ownership checks.
    const own = await asBob(TRANSACTIONS_URL).send(
      receipt({
        accountId: bobIds['Bank Account'],
        totalAmount: 10_000,
        lines: [{ targetAccountId: bobIds['Salary'], amount: 10_000 }],
      })
    );
    expect(own.status).toBe(201);

    const aliceSource = await asBob(TRANSACTIONS_URL).send(
      receipt({
        accountId: ids['Bank Account'],
        totalAmount: 10_000,
        lines: [{ targetAccountId: bobIds['Salary'], amount: 10_000 }],
      })
    );
    const aliceTarget = await asBob(TRANSACTIONS_URL).send(
      receipt({
        accountId: bobIds['Bank Account'],
        totalAmount: 10_000,
        lines: [{ targetAccountId: ids['Salary'], amount: 10_000 }],
      })
    );

    for (const res of [aliceSource, aliceTarget]) {
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
      expect(res.text).not.toContain('Bank Account');
      expect(res.text).not.toContain('Salary');
      expect(res.text).not.toContain(ids['Bank Account']);
      expect(res.text).not.toContain(ids['Salary']);
    }

    expect(await balances(aliceToken)).toEqual(aliceBefore);
    expect(await aliceRows()).toEqual({ transactions: 1, lines: 0 }); // the opening balance only
    expect(await countLedgerRows(seededUsers.bob.id)).toEqual({ transactions: 1, lines: 1 });
  });

  it('TEST-06.9 (AC-06.9): zero, negative or over-limit amounts return 400 VALIDATION_ERROR and save nothing', async () => {
    const cases: Array<[string, number, number]> = [
      ['total 0', 0, 0],
      ['total -100', -100, -100],
      ['total 10000000001', 10_000_000_001, 10_000_000_001],
      ['line 0', 10_000, 0],
      ['line 1.5', 10_000, 1.5],
    ];
    for (const [label, totalAmount, lineAmount] of cases) {
      const res = await asAlice(TRANSACTIONS_URL).send(
        receipt({
          accountId: ids['Bank Account'],
          totalAmount,
          lines: [{ targetAccountId: ids['Salary'], amount: lineAmount }],
        })
      );
      expect(res.status, label).toBe(400);
      expect(res.body.error.code, label).toBe('VALIDATION_ERROR');
    }
    expect(await aliceRows()).toEqual({ transactions: 0, lines: 0 });

    // Boundary: the maximum amount (100,000,000.00 THB) is accepted (BR-04).
    const max = await asAlice(TRANSACTIONS_URL).send(
      receipt({
        accountId: ids['Bank Account'],
        totalAmount: 10_000_000_000,
        lines: [{ targetAccountId: ids['Salary'], amount: 10_000_000_000 }],
      })
    );
    expect(max.status).toBe(201);
  });

  it('TEST-06.10 (AC-06.10): an archived receiving account returns 400 VALIDATION_ERROR and saves nothing', async () => {
    await prisma.account.update({ where: { id: ids['Bank Account'] }, data: { isArchived: true } });

    const res = await asAlice(TRANSACTIONS_URL).send(
      receipt({
        accountId: ids['Bank Account'],
        totalAmount: 100_000, // 1,000.00 THB
        lines: [{ targetAccountId: ids['Salary'], amount: 100_000 }],
      })
    );

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details).toEqual([expect.objectContaining({ field: 'accountId' })]);
    expect(await aliceRows()).toEqual({ transactions: 0, lines: 0 });
  });

  it('TEST-06.11 (AC-06.11): an archived, self or out-of-matrix target returns 400 INVALID_TARGET_ACCOUNT', async () => {
    await prisma.account.update({ where: { id: ids['Interest Earned'] }, data: { isArchived: true } });

    for (const target of ['Interest Earned', 'Bank Account', 'Wallet', 'Credit Card', 'Dining']) {
      const res = await asAlice(TRANSACTIONS_URL).send(
        receipt({
          accountId: ids['Bank Account'],
          totalAmount: 10_000,
          lines: [{ targetAccountId: ids[target], amount: 10_000 }],
        })
      );
      expect(res.status, target).toBe(400);
      expect(res.body.error.code, target).toBe('INVALID_TARGET_ACCOUNT');
    }
    expect(await aliceRows()).toEqual({ transactions: 0, lines: 0 });
  });

  describe('Contract §2.1: request handling and access', () => {
    it('an Administrator gets 403 and an anonymous caller 401, and nothing is saved', async () => {
      const body = receipt({
        accountId: ids['Bank Account'],
        totalAmount: 10_000,
        lines: [{ targetAccountId: ids['Salary'], amount: 10_000 }],
      });

      const admin = await post(TRANSACTIONS_URL).set('Cookie', [`sid=${adminToken}`]).send(body);
      expect(admin.status).toBe(403);
      expect(admin.body.error.code).toBe('FORBIDDEN');

      const anonymous = await post(TRANSACTIONS_URL).send(body);
      expect(anonymous.status).toBe(401);
      expect(anonymous.body.error.code).toBe('UNAUTHENTICATED');

      expect(await aliceRows()).toEqual({ transactions: 0, lines: 0 });
    });

    it('is atomic: a multi-line receipt with one invalid line saves neither the header nor any line', async () => {
      const res = await asAlice(TRANSACTIONS_URL).send(
        receipt({
          accountId: ids['Bank Account'],
          totalAmount: 30_000,
          lines: [
            { targetAccountId: ids['Salary'], amount: 10_000 },
            { targetAccountId: ids['Interest Earned'], amount: 10_000 },
            { targetAccountId: ids['Dining'], amount: 10_000 },
          ],
        })
      );

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_TARGET_ACCOUNT');
      expect(res.body.error.details).toEqual([expect.objectContaining({ field: 'lines.2.targetAccountId' })]);
      expect(await aliceRows()).toEqual({ transactions: 0, lines: 0 });
    });
  });
});
