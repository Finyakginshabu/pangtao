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

/**
 * The previous Bangkok month. It is always in the past, so the API's BR-10
 * future-date rule accepts the fixture on any run day.
 */
function previousMonth(): { from: string; to: string } {
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  const [year, month] = today.split('-').map(Number);
  const shifted = new Date(Date.UTC(year, month - 2, 1));
  const y = shifted.getUTCFullYear();
  const m = shifted.getUTCMonth() + 1;
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const pad = (value: number) => String(value).padStart(2, '0');
  return { from: `${y}-${pad(m)}-01`, to: `${y}-${pad(m)}-${pad(lastDay)}` };
}

const PREVIOUS_MONTH = previousMonth();
/** `1` → the previous month's 1st, `3` → its 3rd, as YYYY-MM-DD. */
const dayOfPreviousMonth = (day: number) =>
  `${PREVIOUS_MONTH.from.slice(0, 8)}${String(day).padStart(2, '0')}`;

/** Records the f-08 demo ledger through the real API with Alice's session cookie. */
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
    date: dayOfPreviousMonth(1),
  });
  await post('/api/v1/transactions', {
    kind: 'RECEIPT',
    accountId: id('Bank Account'),
    txnDate: dayOfPreviousMonth(2),
    totalAmount: 3_000_000, // 30,000.00 THB
    memo: 'Salary',
    lines: [{ targetAccountId: id('Salary'), amount: 3_000_000 }],
  });
  await post('/api/v1/transactions', {
    kind: 'PAYMENT',
    accountId: id('Credit Card'),
    txnDate: dayOfPreviousMonth(3),
    totalAmount: 120_000, // 1,200.00 THB
    memo: 'Dinner and groceries',
    lines: [
      { targetAccountId: id('Dining'), amount: 70_000 }, // 700.00 THB
      { targetAccountId: id('Groceries'), amount: 50_000 }, // 500.00 THB
    ],
  });
  await post('/api/v1/transactions', {
    kind: 'PAYMENT',
    accountId: id('Bank Account'),
    txnDate: dayOfPreviousMonth(4),
    totalAmount: 80_000, // 800.00 THB
    lines: [{ targetAccountId: id('Credit Card'), amount: 80_000 }],
  });
}

test.describe('F-08 Income and Expense Summary (STS)', () => {
  test.beforeEach(async () => {
    await clearAliceLedger();
  });

  test.afterAll(async () => {
    await clearAliceLedger();
    await prisma.$disconnect();
  });

  test('TEST-08.7 (AC-08.7): the summary renders the demo totals and updates when the date range changes', async ({
    page,
  }) => {
    await loginAsAlice(page);
    await recordDemoLedger(page);

    await page.getByTestId('nav-summary').click();
    await expect(page).toHaveURL(/\/summary$/);

    // The default range is the current month, and the demo ledger is in the previous month.
    await expect(page.getByTestId('summary-income')).toHaveText('0.00 ฿');
    await expect(page.getByTestId('summary-expense')).toHaveText('0.00 ฿');
    await expect(page.getByTestId('summary-net')).toHaveText('0.00 ฿');

    // Last Month preset: the demo figures.
    await page.getByTestId('summary-preset-last-month').click();
    await expect(page.getByTestId('summary-income')).toHaveText('+30,000.00 ฿');
    await expect(page.getByTestId('summary-expense')).toHaveText('1,200.00 ฿');
    await expect(page.getByTestId('summary-net')).toHaveText('+28,800.00 ฿');

    // Custom range on the card-charge day: expense only, with a signed negative net.
    await page.getByTestId('summary-preset-custom').click();
    await page.getByTestId('summary-range-from').fill(dayOfPreviousMonth(3));
    await page.getByTestId('summary-range-to').fill(dayOfPreviousMonth(3));
    await expect(page.getByTestId('summary-income')).toHaveText('0.00 ฿');
    await expect(page.getByTestId('summary-expense')).toHaveText('1,200.00 ฿');
    await expect(page.getByTestId('summary-net')).toHaveText('-1,200.00 ฿');

    // Back to the empty current month.
    await page.getByTestId('summary-preset-this-month').click();
    await expect(page.getByTestId('summary-income')).toHaveText('0.00 ฿');
    await expect(page.getByTestId('summary-expense')).toHaveText('0.00 ฿');
    await expect(page.getByTestId('summary-net')).toHaveText('0.00 ฿');
  });

  test('the summary shows skeleton and error/retry states and fits a 360 px viewport (f-08 §2.2, NFR-08)', async ({
    page,
  }) => {
    await loginAsAlice(page);
    await recordDemoLedger(page);
    const summaryRequest = '**/api/v1/summary/income-expense?*';

    // Loading: a delayed response shows the metric-card skeleton first.
    await page.route(summaryRequest, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 700));
      await route.continue();
    });
    await page.goto('/summary');
    await expect(page.getByTestId('summary-skeleton')).toBeVisible();
    await expect(page.getByTestId('summary-net')).toBeVisible();
    await page.unroute(summaryRequest);

    // Error: a failed load shows a banner whose Retry recovers.
    await page.route(summaryRequest, (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: 'Simulated failure' } }),
      })
    );
    await page.reload();
    const banner = page.getByRole('alert');
    await expect(banner).toContainText('Simulated failure');
    await page.unroute(summaryRequest);
    await banner.getByRole('button', { name: 'Retry' }).click();
    await expect(page.getByTestId('summary-net')).toBeVisible();
    await expect(page.getByRole('alert')).toHaveCount(0);

    // NFR-08: the cards and controls fit a 360 px viewport.
    await page.setViewportSize({ width: 360, height: 800 });
    await expect(page.getByTestId('summary-income')).toBeInViewport({ ratio: 1 });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });
});
