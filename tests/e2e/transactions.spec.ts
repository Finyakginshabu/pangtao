import { test, expect, Page } from '@playwright/test';
import { PrismaClient } from '@prisma/client';

// AC-01.10: the seed password comes from the local .env, never from source.
const SEED_PASSWORD = process.env.SEED_DEFAULT_PASSWORD;
if (!SEED_PASSWORD) {
  throw new Error('SEED_DEFAULT_PASSWORD must be set in .env to run the E2E suite.');
}

// Voiding arrives in Sprint 2 (F-13), so fixture rows are removed directly. Lines cascade.
const prisma = new PrismaClient();

async function loginAsAlice(page: Page): Promise<void> {
  await page.goto('/login');
  await page.fill('#email', 'alice@example.test');
  await page.fill('#password', SEED_PASSWORD!);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/^http:\/\/localhost:3000\/?$/);
}

async function aliceUserId(): Promise<string> {
  const alice = await prisma.user.findUnique({ where: { email: 'alice@example.test' }, select: { id: true } });
  if (!alice) {
    throw new Error('Seed the development database before running E2E: npm run db:seed');
  }
  return alice.id;
}

/** Alice's ledger back to the seeded state: no transactions at all. */
async function clearAliceLedger(): Promise<void> {
  await prisma.transaction.deleteMany({ where: { userId: await aliceUserId() } });
}

test.describe('F-05 Payment and Charge (STS)', () => {
  test.beforeEach(async () => {
    await clearAliceLedger();
  });

  test.afterAll(async () => {
    await clearAliceLedger();
    await prisma.$disconnect();
  });

  test('TEST-05.9 (AC-05.9): a multi-line card charge shows live allocation, submits, and raises the card debt', async ({
    page,
  }) => {
    await loginAsAlice(page);
    await page.getByTestId('record-payment-link').click();
    await expect(page).toHaveURL(/\/transactions\/new$/);
    await expect(page.getByTestId('tab-payment')).toHaveAttribute('aria-selected', 'true');

    // The source list offers Cash and Loan Taken accounts only (f-05 §2.2).
    const source = page.getByTestId('payment-source');
    await expect(source.locator('option', { hasText: 'Credit Card' })).toHaveCount(1);
    await expect(source.locator('option', { hasText: 'Salary' })).toHaveCount(0);
    await expect(source.locator('option', { hasText: 'Dining' })).toHaveCount(0);
    await source.selectOption({ label: 'Credit Card' });

    // A card charge may only target Expense accounts in Sprint 1 (BR-06).
    const firstTarget = page.getByTestId('line-target-0');
    await expect(firstTarget.locator('option', { hasText: 'Bank Account' })).toHaveCount(0);
    await expect(firstTarget.locator('option', { hasText: 'Credit Card' })).toHaveCount(0);

    await page.getByTestId('payment-total').fill('1,200.00');
    await expect(page.getByTestId('summary-total')).toHaveText('1,200.00 ฿');
    await expect(page.getByTestId('summary-remaining')).toHaveText('1,200.00 ฿');
    const submit = page.getByTestId('payment-submit');
    await expect(submit).toBeDisabled();

    await firstTarget.selectOption({ label: 'Dining' });
    await page.getByTestId('line-amount-0').fill('700');
    await expect(page.getByTestId('summary-allocated')).toHaveText('700.00 ฿');
    await expect(page.getByTestId('summary-remaining')).toHaveText('500.00 ฿');
    await expect(submit).toBeDisabled();

    await page.getByTestId('add-line').click();
    await page.getByTestId('line-target-1').selectOption({ label: 'Groceries' });
    await page.getByTestId('line-amount-1').fill('500');
    await expect(page.getByTestId('summary-allocated')).toHaveText('1,200.00 ฿');
    await expect(page.getByTestId('summary-remaining')).toHaveText('0.00 ฿');
    await expect(submit).toBeEnabled();

    await submit.click();

    // f-05 1.2: redirect to the Dashboard, where the card debt reflects the charge.
    await expect(page).toHaveURL(/^http:\/\/localhost:3000\/?$/);
    await expect(
      page.getByTestId('dashboard-section-debts').getByTestId('account-balance-Credit Card')
    ).toHaveText('1,200.00 ฿');

    // One PAYMENT with two allocation lines is stored for Alice.
    const stored = await prisma.transaction.findMany({
      where: { userId: await aliceUserId(), kind: 'PAYMENT' },
      include: { lines: { orderBy: { lineNo: 'asc' }, include: { targetAccount: { select: { name: true } } } } },
    });
    expect(stored).toHaveLength(1);
    expect(stored[0].totalAmount).toBe(120_000n); // 1,200.00 THB
    expect(stored[0].lines.map((l) => [l.targetAccount.name, l.amount])).toEqual([
      ['Dining', 70_000n], // 700.00 THB
      ['Groceries', 50_000n], // 500.00 THB
    ]);
  });

  test('the form shows over-allocation, removes lines, and fits a 360 px viewport (f-05 §2.2, NFR-08)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await loginAsAlice(page);
    await page.goto('/transactions/new');

    await page.getByTestId('payment-source').selectOption({ label: 'Wallet' });
    await page.getByTestId('payment-total').fill('100');
    await page.getByTestId('line-target-0').selectOption({ label: 'Dining' });
    await page.getByTestId('line-amount-0').fill('80');
    await page.getByTestId('add-line').click();
    await page.getByTestId('line-target-1').selectOption({ label: 'Groceries' });
    await page.getByTestId('line-amount-1').fill('50');

    await expect(page.getByTestId('summary-remaining')).toHaveText('-30.00 ฿');
    await expect(page.getByTestId('summary-status')).toHaveText('Over-allocated');
    await expect(page.getByTestId('payment-submit')).toBeDisabled();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow).toBeLessThanOrEqual(1);

    await page.getByTestId('remove-line-1').click();
    await expect(page.getByTestId('line-1')).toHaveCount(0);
    await expect(page.getByTestId('summary-remaining')).toHaveText('20.00 ฿');
    await expect(page.getByTestId('payment-submit')).toBeDisabled();
  });
});
