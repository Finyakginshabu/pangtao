import { test, expect, Page } from '@playwright/test';

// AC-01.10: the seed password comes from the local .env, never from source.
const SEED_PASSWORD = process.env.SEED_DEFAULT_PASSWORD;
if (!SEED_PASSWORD) {
  throw new Error('SEED_DEFAULT_PASSWORD must be set in .env to run the E2E suite.');
}

const ACCOUNTS_URL = /\/api\/v1\/accounts$/;

async function loginAsAlice(page: Page): Promise<void> {
  await page.goto('/login');
  await page.fill('#email', 'alice@example.test');
  await page.fill('#password', SEED_PASSWORD!);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/^http:\/\/localhost:3000\/?$/);
}

test.describe('F-03 Accounts and Balances (STS)', () => {
  test('TEST-03.6 (AC-03.6): dashboard groups accounts with THB figures, empty placeholders, negative labels, skeleton and error retry', async ({
    page,
  }) => {
    await loginAsAlice(page);

    // Seeded Alice: Cash and Debts list her accounts at 0.00 ฿; Owed to Me is empty.
    const cash = page.getByTestId('dashboard-section-cash');
    const debts = page.getByTestId('dashboard-section-debts');
    const owed = page.getByTestId('dashboard-section-owed');
    await expect(cash).toBeVisible();
    await expect(debts).toBeVisible();
    await expect(owed).toBeVisible();

    await expect(cash.getByTestId('account-balance-Bank Account')).toHaveText('0.00 ฿');
    await expect(cash.getByTestId('account-balance-Wallet')).toHaveText('0.00 ฿');
    await expect(debts.getByTestId('account-balance-Credit Card')).toHaveText('0.00 ฿');
    await expect(owed.getByTestId('dashboard-section-owed-empty')).toBeVisible();
    // Income and Expense accounts are not dashboard groups (f-03 §2.2).
    await expect(page.getByTestId('account-row-Salary')).toHaveCount(0);
    await expect(page.getByText('Negative balance')).toHaveCount(0);

    // Loading: a delayed response shows skeleton cards first.
    await page.route(ACCOUNTS_URL, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 700));
      await route.continue();
    });
    await page.reload();
    await expect(page.getByTestId('dashboard-skeleton')).toBeVisible();
    await expect(cash).toBeVisible();
    await page.unroute(ACCOUNTS_URL);

    // Error: a failed load shows a banner whose Retry recovers.
    await page.route(ACCOUNTS_URL, (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: 'Simulated failure' } }),
      })
    );
    await page.reload();
    const banner = page.getByRole('alert');
    await expect(banner).toContainText('Simulated failure');
    await expect(cash).toHaveCount(0);
    await page.unroute(ACCOUNTS_URL);
    await banner.getByRole('button', { name: 'Retry' }).click();
    await expect(cash.getByTestId('account-balance-Bank Account')).toHaveText('0.00 ฿');
    await expect(page.getByRole('alert')).toHaveCount(0);

    // Negative balances (D-02): explicit minus sign plus a text label, with thousands separators.
    await page.route(ACCOUNTS_URL, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [
            { id: 'a1', name: 'Bank Account', type: 'CASH', subtype: 'BANK', isArchived: false, balance: 1_234_567, openingBalance: null },
            { id: 'a2', name: 'Wallet', type: 'CASH', subtype: 'WALLET', isArchived: false, balance: -123_450, openingBalance: null },
            { id: 'a3', name: 'Credit Card', type: 'LOAN_TAKEN', subtype: 'CREDIT_CARD', isArchived: false, balance: 40_000, openingBalance: null },
          ],
        }),
      })
    );
    await page.reload();
    await expect(cash.getByTestId('account-balance-Bank Account')).toHaveText('12,345.67 ฿');
    const walletRow = cash.getByTestId('account-row-Wallet');
    await expect(walletRow.getByTestId('account-balance-Wallet')).toHaveText('-1,234.50 ฿');
    await expect(walletRow.getByText('Negative balance')).toBeVisible();
    await expect(debts.getByTestId('account-balance-Credit Card')).toHaveText('400.00 ฿');
    await expect(debts.getByText('Negative balance')).toHaveCount(0);

    // NFR-08: the dashboard remains usable at a 360 px viewport, checked with the widest
    // content above (thousands separators, minus sign and negative label) on screen.
    await page.setViewportSize({ width: 360, height: 800 });
    for (const section of [cash, debts, owed]) await expect(section).toBeInViewport();
    await expect(walletRow.getByTestId('account-balance-Wallet')).toBeInViewport({ ratio: 1 });
    await expect(walletRow.getByText('Negative balance')).toBeInViewport({ ratio: 1 });
    const horizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(horizontalOverflow).toBeLessThanOrEqual(1);
    await page.unroute(ACCOUNTS_URL);
  });
});
