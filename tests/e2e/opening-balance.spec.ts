import { test, expect, Page } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { bangkokToday, formatCalendarDate } from '../../web/src/utils/date';

// AC-01.10: the seed password comes from the local .env, never from source.
const SEED_PASSWORD = process.env.SEED_DEFAULT_PASSWORD;
if (!SEED_PASSWORD) {
  throw new Error('SEED_DEFAULT_PASSWORD must be set in .env to run the E2E suite.');
}

// F-04 has no delete endpoint (FR-11 belongs to F-12), so the fixture row is removed directly.
const prisma = new PrismaClient();

async function loginAsAlice(page: Page): Promise<void> {
  await page.goto('/login');
  await page.fill('#email', 'alice@example.test');
  await page.fill('#password', SEED_PASSWORD!);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/^http:\/\/localhost:3000\/?$/);
}

async function aliceUserId(): Promise<string> {
  const alice = await prisma.user.findUnique({
    where: { email: 'alice@example.test' },
    select: { id: true },
  });
  if (!alice) {
    throw new Error('Seed the development database before running E2E: npm run db:seed');
  }
  return alice.id;
}

async function clearAliceOpeningBalances(): Promise<void> {
  await prisma.transaction.deleteMany({
    where: { userId: await aliceUserId(), kind: 'OPENING_BALANCE' },
  });
}

async function setWalletArchived(isArchived: boolean): Promise<void> {
  await prisma.account.updateMany({
    where: { userId: await aliceUserId(), name: 'Wallet' },
    data: { isArchived },
  });
}

function addDays(date: string, days: number): string {
  const shifted = new Date(`${date}T00:00:00.000Z`);
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return shifted.toISOString().slice(0, 10);
}

/**
 * Extra coverage beyond the f-04 contract's A/U tests: the §2.2 dashboard dialog,
 * its inline validation, the post-submission card state, persistence and NFR-08 at 360 px.
 */
test.describe('F-04 Opening Balance UI (extra E2E, f-04 §2.2)', () => {
  test.beforeEach(async () => {
    await clearAliceOpeningBalances();
    await setWalletArchived(false);
  });

  test.afterAll(async () => {
    await setWalletArchived(false);
    await clearAliceOpeningBalances();
    await prisma.$disconnect();
  });

  test('sets an opening balance from the dashboard, validates inline, and stays usable at 360 px', async ({
    page,
  }) => {
    await loginAsAlice(page);

    const cash = page.getByTestId('dashboard-section-cash');
    const bankRow = cash.getByTestId('account-row-Bank Account');
    await expect(bankRow.getByTestId('set-opening-balance-Bank Account')).toBeVisible();
    // Income and Expense accounts never appear as dashboard rows (f-03 §2.2).
    await expect(page.getByTestId('set-opening-balance-Salary')).toHaveCount(0);

    await bankRow.getByTestId('set-opening-balance-Bank Account').click();
    const dialog = page.getByTestId('opening-balance-dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('heading')).toContainText('Bank Account');

    // The date picker defaults to today in Bangkok (BR-10).
    const today = bangkokToday();
    await expect(page.getByTestId('opening-date')).toHaveValue(today);

    // Inline validation: a negative amount never reaches the server.
    const amountInput = page.getByTestId('opening-amount');
    await amountInput.fill('-5');
    await page.getByTestId('opening-balance-save').click();
    await expect(page.getByTestId('opening-balance-error')).toContainText('valid amount');
    await expect(dialog).toBeVisible();

    // Inline validation: a future date is rejected before submitting.
    await amountInput.fill('50000.00');
    await page.getByTestId('opening-date').fill(addDays(today, 1));
    await page.getByTestId('opening-balance-save').click();
    await expect(page.getByTestId('opening-balance-error')).toContainText('cannot be later than today');

    // NFR-08: the dialog fits a 360 px viewport with no horizontal overflow.
    await page.setViewportSize({ width: 360, height: 800 });
    await expect(dialog).toBeInViewport();
    const dialogOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(dialogOverflow).toBeLessThanOrEqual(1);
    await page.setViewportSize({ width: 1280, height: 900 });

    // Valid submission: 50,000.00 THB → 5,000,000 satang.
    await page.getByTestId('opening-date').fill(today);
    await page.getByTestId('opening-balance-save').click();
    await expect(dialog).toHaveCount(0);

    await expect(bankRow.getByTestId('account-balance-Bank Account')).toHaveText('50,000.00 ฿');
    await expect(bankRow.getByTestId('opening-balance-info-Bank Account')).toHaveText(
      `Opening balance 50,000.00 ฿ on ${formatCalendarDate(today)}`
    );
    // The action is replaced by the recorded opening balance (f-04 §2.2).
    await expect(bankRow.getByTestId('set-opening-balance-Bank Account')).toHaveCount(0);

    // Persistence: a reload shows the server-derived balance and opening balance.
    await page.reload();
    await expect(cash.getByTestId('account-balance-Bank Account')).toHaveText('50,000.00 ฿');
    await expect(cash.getByTestId('opening-balance-info-Bank Account')).toHaveText(
      `Opening balance 50,000.00 ฿ on ${formatCalendarDate(today)}`
    );
    await expect(cash.getByTestId('set-opening-balance-Bank Account')).toHaveCount(0);
  });

  test('TEST-04.10 (AC-04.10): archived accounts are not offered an opening balance', async ({
    page,
  }) => {
    await setWalletArchived(true);
    await loginAsAlice(page);

    // F-03 still lists the account and its balance; only the action is withheld (BR-14).
    const cash = page.getByTestId('dashboard-section-cash');
    await expect(cash.getByTestId('account-row-Wallet')).toBeVisible();
    await expect(cash.getByTestId('set-opening-balance-Wallet')).toHaveCount(0);
    await expect(cash.getByTestId('set-opening-balance-Bank Account')).toBeVisible();
  });

  test('F-01 §2.2: an expired session while saving redirects to /login', async ({ page }) => {
    await loginAsAlice(page);

    await page.getByTestId('set-opening-balance-Bank Account').click();
    await page.getByTestId('opening-amount').fill('100.00');

    // Invalidate the session server-side after the dashboard has loaded.
    await prisma.session.deleteMany({ where: { userId: await aliceUserId() } });

    await page.getByTestId('opening-balance-save').click();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByTestId('opening-balance-dialog')).toHaveCount(0);
  });
});
