import { test, expect } from '@playwright/test';

// AC-01.10: the seed password comes from the local .env, never from source.
const SEED_PASSWORD = process.env.SEED_DEFAULT_PASSWORD;
if (!SEED_PASSWORD) {
  throw new Error('SEED_DEFAULT_PASSWORD must be set in .env to run the E2E suite.');
}

test.describe('TEST-01.14 (AC-01.14): End-to-End Authentication Journey', () => {
  test('User login, route protection, logout, and role isolation', async ({ page }) => {
    // 1. Visit root while unauthenticated -> redirected to /login
    await page.goto('/');
    await expect(page).toHaveURL(/.*\/login/);

    // 2. Submit invalid credentials -> error alert shown
    await page.fill('#email', 'alice@example.test');
    await page.fill('#password', 'definitely-not-the-password');
    await page.click('button[type="submit"]');

    const alert = page.locator('div[role="alert"]');
    await expect(alert).toBeVisible();
    await expect(alert).toContainText('Invalid email or password');

    // 3. Submit valid credentials for Alice (Role: USER)
    await page.fill('#password', SEED_PASSWORD);
    await page.click('button[type="submit"]');

    // Should land on Dashboard (/)
    await expect(page).toHaveURL(/^http:\/\/localhost:3000\/?$/);
    await expect(page.locator('h2')).toContainText('Welcome back, Alice User');
    await expect(page.locator('header')).toContainText('USER');

    // 4. Role restriction: Alice visiting /admin/users sees 403 Not Permitted
    await page.goto('/admin/users');
    await expect(page.locator('h2')).toContainText('403 - Not Permitted');

    // 5. Logout
    await page.click('button:has-text("Log out")');
    await expect(page).toHaveURL(/.*\/login/);

    // 6. Browser back button check
    await page.goBack();
    // Should still redirect to /login or show login because session is gone
    await expect(page).toHaveURL(/.*\/login/);

    // 7. Admin login (Role: ADMIN) -> lands on /admin/users
    await page.fill('#email', 'admin@example.test');
    await page.fill('#password', SEED_PASSWORD);
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/.*\/admin\/users/);
    await expect(page.locator('h2')).toContainText('User Account Administration');
    await expect(page.locator('header')).toContainText('ADMIN');
  });
});

