import { test, expect, Page } from '@playwright/test';
import { PrismaClient } from '@prisma/client';

// AC-01.10: the seed password comes from the local .env, never from source.
const SEED_PASSWORD = process.env.SEED_DEFAULT_PASSWORD;
if (!SEED_PASSWORD) {
  throw new Error('SEED_DEFAULT_PASSWORD must be set in .env to run the E2E suite.');
}

const ORIGIN = 'http://localhost:3000';
const prisma = new PrismaClient();

async function loginAsAlice(page: Page): Promise<void> {
  await page.goto('/login');
  await page.fill('#email', 'alice@example.test');
  await page.fill('#password', SEED_PASSWORD!);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/^http:\/\/localhost:3000\/?$/);
}

/** Alice's ledger back to the seeded state: no transactions at all. Lines cascade. */
async function clearAliceLedger(): Promise<void> {
  const alice = await prisma.user.findUnique({ where: { email: 'alice@example.test' }, select: { id: true } });
  if (!alice) {
    throw new Error('Seed the development database before running E2E: npm run db:seed');
  }
  await prisma.transaction.deleteMany({ where: { userId: alice.id } });
}

/** Records the plan.md demo sequence through the real API with Alice's session cookie. */
async function recordDemoLedger(page: Page): Promise<void> {
  const accounts = await page.request.get('/api/v1/accounts');
  expect(accounts.status()).toBe(200);
  const items = (await accounts.json()).items as Array<{ id: string; name: string }>;
  const id = (name: string) => items.find((a) => a.name === name)!.id;
  const post = async (url: string, data: unknown) => {
    const res = await page.request.post(url, { data, headers: { Origin: ORIGIN } });
    expect(res.status(), url).toBe(201);
  };

  await post(`/api/v1/accounts/${id('Bank Account')}/opening-balance`, {
    amount: 5_000_000, // 50,000.00 THB
    date: '2026-01-01',
  });
  await post('/api/v1/transactions', {
    kind: 'RECEIPT',
    accountId: id('Bank Account'),
    txnDate: '2026-01-25',
    totalAmount: 3_000_000, // 30,000.00 THB
    memo: 'January salary',
    lines: [{ targetAccountId: id('Salary'), amount: 3_000_000 }],
  });
  await post('/api/v1/transactions', {
    kind: 'PAYMENT',
    accountId: id('Credit Card'),
    txnDate: '2026-01-26',
    totalAmount: 120_000, // 1,200.00 THB
    memo: 'Dinner and groceries',
    lines: [
      { targetAccountId: id('Dining'), amount: 70_000, note: 'Team dinner' }, // 700.00 THB
      { targetAccountId: id('Groceries'), amount: 50_000 }, // 500.00 THB
    ],
  });
  await post('/api/v1/transactions', {
    kind: 'PAYMENT',
    accountId: id('Bank Account'),
    txnDate: '2026-01-27',
    totalAmount: 80_000, // 800.00 THB
    lines: [{ targetAccountId: id('Credit Card'), amount: 80_000 }],
  });
}

test.describe('F-07 Transaction History (STS)', () => {
  test.beforeEach(async () => {
    await clearAliceLedger();
  });

  test.afterAll(async () => {
    await clearAliceLedger();
    await prisma.$disconnect();
  });

  test('TEST-07.6 (AC-07.6): the history lists the 4 demo transactions and expands the card purchase lines', async ({
    page,
  }) => {
    await loginAsAlice(page);
    await recordDemoLedger(page);

    await page.getByTestId('nav-history').click();
    await expect(page).toHaveURL(/\/transactions$/);

    const rows = page.getByTestId('history-row');
    await expect(rows).toHaveCount(4);
    await expect(page.getByTestId('history-counter')).toHaveText('Showing 1–4 of 4');

    // Newest first: repayment, card purchase, salary, opening balance.
    await expect(rows.nth(0)).toContainText('27 Jan 2026');
    await expect(rows.nth(0)).toContainText('800.00 ฿');
    await expect(rows.nth(1)).toContainText('Dinner and groceries');
    await expect(rows.nth(1)).toContainText('Credit Card');
    await expect(rows.nth(1)).toContainText('1,200.00 ฿');
    await expect(rows.nth(2)).toContainText('Receipt');
    await expect(rows.nth(2)).toContainText('30,000.00 ฿');
    await expect(rows.nth(3)).toContainText('Opening Balance');
    await expect(rows.nth(3)).toContainText('50,000.00 ฿');

    const card = rows.nth(1);
    await expect(page.getByTestId('history-line')).toHaveCount(0);
    await card.getByTestId('history-expand').click();
    const lines = page.getByTestId('history-line');
    await expect(lines).toHaveCount(2);
    await expect(lines.nth(0)).toContainText('Dining');
    await expect(lines.nth(0)).toContainText('700.00 ฿');
    await expect(lines.nth(0)).toContainText('Team dinner');
    await expect(lines.nth(1)).toContainText('Groceries');
    await expect(lines.nth(1)).toContainText('500.00 ฿');
  });

  test('TEST-07.9 (AC-07.6): the history shows the empty state, and the error banner whose Retry reloads it', async ({
    page,
  }) => {
    await loginAsAlice(page);

    await page.goto('/transactions');
    await expect(page.getByTestId('history-empty')).toContainText('No transactions recorded yet');
    await expect(page.getByTestId('history-row')).toHaveCount(0);

    await recordDemoLedger(page);
    const failHistory = (route: import('@playwright/test').Route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again.' } }),
      });
    await page.route('**/api/v1/transactions?*', failHistory);
    await page.reload();

    const banner = page.getByRole('alert');
    await expect(banner).toBeVisible();
    await expect(page.getByTestId('history-row')).toHaveCount(0);

    await page.unroute('**/api/v1/transactions?*', failHistory);
    await banner.getByRole('button', { name: 'Retry' }).click();
    await expect(page.getByTestId('history-row')).toHaveCount(4);
    await expect(page.getByRole('alert')).toHaveCount(0);
  });

  test('a history row opens the transaction detail with every line and its note (f-07 §1 step 5, FR-25)', async ({
    page,
  }) => {
    await loginAsAlice(page);
    await recordDemoLedger(page);
    await page.goto('/transactions');

    await page.getByTestId('history-row').nth(1).getByTestId('history-open').click();
    await expect(page).toHaveURL(/\/transactions\/[0-9a-f-]{36}$/);
    const detail = page.getByTestId('transaction-detail');
    await expect(detail).toContainText('Payment');
    await expect(detail).toContainText('Credit Card');
    await expect(detail).toContainText('26 Jan 2026');
    await expect(detail).toContainText('1,200.00 ฿');
    await expect(detail).toContainText('Dinner and groceries');
    const lines = page.getByTestId('detail-line');
    await expect(lines).toHaveCount(2);
    await expect(lines.nth(0)).toContainText('Dining');
    await expect(lines.nth(0)).toContainText('Team dinner');
    await expect(lines.nth(1)).toContainText('500.00 ฿');
  });

  test('the history fits a 360 px viewport (NFR-08)', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await loginAsAlice(page);
    await recordDemoLedger(page);
    await page.goto('/transactions');
    await expect(page.getByTestId('history-row')).toHaveCount(4);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });
});
