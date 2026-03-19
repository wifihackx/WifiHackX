import { expect, test } from '@playwright/test';

const ADMIN_EMAIL = process.env.WFX_E2E_ADMIN_EMAIL || process.env.WFX_E2E_EMAIL || '';
const ADMIN_PASSWORD = process.env.WFX_E2E_ADMIN_PASSWORD || process.env.WFX_E2E_PASSWORD || '';

async function openLoginView(page) {
  const loginForm = page.locator('#loginFormElement');
  if (await loginForm.isVisible()) return;

  const loginBtn = page.locator('#loginBtn');
  if (await loginBtn.isVisible()) {
    await loginBtn.click();
    return;
  }

  await page.evaluate(async () => {
    if (typeof window.showLoginView === 'function') {
      await window.showLoginView();
      return;
    }
    const fallbackBtn = document.querySelector('[data-action="showLoginView"]');
    if (fallbackBtn instanceof HTMLElement) fallbackBtn.click();
  });

  await page.waitForFunction(() => {
    const view = document.getElementById('loginView');
    return view?.dataset?.templateLoaded === '1' || !!document.getElementById('loginFormElement');
  });
}

test.describe('Admin smoke', () => {
  test('public app shell loads and wires checkout/login flows', async ({ page }) => {
    test.setTimeout(120000);

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('body')).toContainText(/WifihackX|WifiHackX/i, { timeout: 15000 });

    await expect(page.locator('#loginBtn')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('#checkoutBtn')).toBeAttached({ timeout: 15000 });

    const runtime = await page.evaluate(() => ({
      stripeConfigured: window.RuntimeConfigUtils?.isStripeConfigured?.() ?? false,
      stripeKey: window.RuntimeConfigUtils?.getPaymentsKeys?.()?.stripePublicKey || '',
      loginAction: document.getElementById('loginBtn')?.dataset?.action || '',
      checkoutAction: document.getElementById('checkoutBtn')?.dataset?.action || '',
    }));

    const loginTemplate = await page.evaluate(async () => {
      const response = await fetch('/partials/login-view.html', {
        credentials: 'same-origin',
        cache: 'no-cache',
      });
      const html = await response.text();
      return {
        ok: response.ok,
        hasLoginForm: html.includes('id="loginFormElement"'),
        hasLoginSubmit: html.includes('data-testid="login-submit"'),
      };
    });

    expect(runtime.stripeConfigured).toBe(true);
    expect(runtime.stripeKey).toMatch(/^pk_(test|live)_/);
    expect(runtime.loginAction).toBe('showLoginView');
    expect(runtime.checkoutAction).toBe('checkout');
    expect(loginTemplate.ok).toBe(true);
    expect(loginTemplate.hasLoginForm).toBe(true);
    expect(loginTemplate.hasLoginSubmit).toBe(true);
  });

  test('login and open admin shell', async ({ page }) => {
    test.setTimeout(120000);
    test.skip(
      !ADMIN_EMAIL || !ADMIN_PASSWORD,
      'Set WFX_E2E_ADMIN_EMAIL/WFX_E2E_ADMIN_PASSWORD to run this admin smoke test.'
    );

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await openLoginView(page);
    await expect(page.locator('#loginFormElement')).toBeVisible({ timeout: 15000 });

    await page.locator('#loginEmail').fill(ADMIN_EMAIL);
    await page.locator('#loginPassword').fill(ADMIN_PASSWORD);
    await page.locator('[data-testid="login-submit"]').click();

    await page.waitForTimeout(1500);
    await page.evaluate(() => {
      if (typeof window.showAdminView === 'function') {
        window.showAdminView();
      }
    });

    await expect(page.locator('#adminView')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('#adminView .admin-title')).toContainText(/Panel de Administraci.n/, {
      timeout: 15000,
    });
  });
});
