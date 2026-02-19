import { test, expect } from '@playwright/test';

const ADMIN_EMAIL =
  process.env.WFX_E2E_ADMIN_EMAIL || process.env.WFX_E2E_EMAIL || '';
const ADMIN_PASSWORD =
  process.env.WFX_E2E_ADMIN_PASSWORD || process.env.WFX_E2E_PASSWORD || '';

test.describe('Admin smoke', () => {
  test('login and open admin shell', async ({ page }) => {
    test.skip(
      !ADMIN_EMAIL || !ADMIN_PASSWORD,
      'Set WFX_E2E_ADMIN_EMAIL/WFX_E2E_ADMIN_PASSWORD to run this smoke test.'
    );

    await page.goto('/');
    await page.locator('#loginBtn').click();
    await expect(page.locator('#loginFormElement')).toBeVisible();

    await page.locator('#loginEmail').fill(ADMIN_EMAIL);
    await page.locator('#loginPassword').fill(ADMIN_PASSWORD);
    await page.locator('[data-testid="login-submit"]').click();

    // The app is SPA-driven; give auth listeners time to settle.
    await page.waitForTimeout(1500);
    await page.evaluate(() => {
      if (typeof window.showAdminView === 'function') {
        window.showAdminView();
      }
    });

    await expect(page.locator('#adminView')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('#adminView .admin-title')).toContainText(
      'Panel de Administración',
      { timeout: 15000 }
    );
  });
});
