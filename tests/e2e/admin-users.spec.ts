import { test, expect, Page } from '@playwright/test';

// AC-01.10: the seed password comes from the local .env, never from source.
const SEED_PASSWORD = process.env.SEED_DEFAULT_PASSWORD;
if (!SEED_PASSWORD) {
  throw new Error('SEED_DEFAULT_PASSWORD must be set in .env to run the E2E suite.');
}

// Matches the list endpoint only (not PATCH /api/v1/admin/users/:id).
const USERS_LIST_URL = /\/api\/v1\/admin\/users(\?.*)?$/;

async function loginAsAdmin(page: Page): Promise<void> {
  await page.goto('/login');
  await page.fill('#email', 'admin@example.test');
  await page.fill('#password', SEED_PASSWORD);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/\/admin\/users/);
}

test.describe('TEST-02.8 (AC-02.8): Admin user management UI', () => {
  test('toggles user status with confirmation, protects the self row, and handles loading and retry', async ({ page }) => {
    await loginAsAdmin(page);

    const table = page.getByRole('table', { name: 'Platform users' });
    await expect(table).toBeVisible();

    const adminRow = page.getByTestId('user-row-admin@example.test');
    const bobRow = page.getByTestId('user-row-bob@example.test');
    const bobStatus = page.getByTestId('user-status-bob@example.test');
    await expect(adminRow).toBeVisible();
    await expect(bobRow).toBeVisible();

    // AC-02.8: the Administrator's own row is disabled with an explanatory tooltip.
    const adminToggle = adminRow.getByRole('button');
    await expect(adminToggle).toBeDisabled();
    await expect(adminToggle).toHaveAttribute('title', 'You cannot disable your own account');

    // Shared state: a delayed response shows the skeleton before the table.
    await page.route(USERS_LIST_URL, async (route) => {
      if (route.request().method() !== 'GET') return route.continue();
      await new Promise((resolve) => setTimeout(resolve, 700));
      await route.continue();
    });
    await page.reload();
    await expect(page.getByTestId('admin-users-skeleton')).toBeVisible();
    await expect(table).toBeVisible();
    await page.unroute(USERS_LIST_URL);

    // Shared state: a failed load shows an error banner whose Retry recovers.
    await page.route(USERS_LIST_URL, async (route) => {
      if (route.request().method() !== 'GET') return route.continue();
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: 'Simulated failure' } }),
      });
    });
    await page.reload();
    const errorBanner = page.getByRole('alert');
    await expect(errorBanner).toContainText('Simulated failure');
    await page.unroute(USERS_LIST_URL);
    await errorBanner.getByRole('button', { name: 'Retry' }).click();
    await expect(table).toBeVisible();

    // Normalize Bob to Active so the journey is repeatable.
    if ((await bobStatus.textContent())?.trim() === 'Disabled') {
      await bobRow.getByRole('button', { name: 'Enable Bob User' }).click();
      await page.getByTestId('confirm-status-change').click();
      await expect(bobStatus).toHaveText('Active');
    }

    // AC-02.8: disable Bob through the confirmation modal; the row updates in place.
    await bobRow.getByRole('button', { name: 'Disable Bob User' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Disable Bob User?');
    await page.getByTestId('confirm-status-change').click();
    await expect(dialog).toBeHidden();
    await expect(bobStatus).toHaveText('Disabled');

    // AC-02.8: re-enable Bob through the same confirmation flow.
    await bobRow.getByRole('button', { name: 'Enable Bob User' }).click();
    await expect(dialog).toContainText('Enable Bob User?');
    await page.getByTestId('confirm-status-change').click();
    await expect(dialog).toBeHidden();
    await expect(bobStatus).toHaveText('Active');

    // UI contract §2.2 / NFR-08: the screen remains usable at a 360 px viewport.
    await page.setViewportSize({ width: 360, height: 800 });
    await expect(bobRow).toBeVisible();
    await expect(bobRow.getByRole('button', { name: 'Disable Bob User' })).toBeVisible();
    const horizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(horizontalOverflow).toBeLessThanOrEqual(1);
  });
});
