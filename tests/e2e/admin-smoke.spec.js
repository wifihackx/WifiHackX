import { expect, test } from '@playwright/test';

const ADMIN_EMAIL = process.env.WFX_E2E_ADMIN_EMAIL || process.env.WFX_E2E_EMAIL || '';
const ADMIN_PASSWORD = process.env.WFX_E2E_ADMIN_PASSWORD || process.env.WFX_E2E_PASSWORD || '';

async function openLoginView(page) {
  const loginForm = page.locator('#loginFormElement');
  if (await loginForm.isVisible().catch(() => false)) return;

  await page.waitForFunction(() => !!document.getElementById('loginView'));

  await page.evaluate(async () => {
    const loginView = document.getElementById('loginView');
    if (!loginView) return;

    if (
      window.ViewTemplateLoader &&
      typeof window.ViewTemplateLoader.ensure === 'function' &&
      loginView.dataset?.templateLoaded !== '1'
    ) {
      await window.ViewTemplateLoader.ensure('loginView');
    } else if (loginView.dataset?.template && loginView.dataset?.templateLoaded !== '1') {
      const response = await fetch(loginView.dataset.template, {
        credentials: 'same-origin',
        cache: 'no-cache',
      });
      if (response.ok) {
        loginView.innerHTML = await response.text();
        loginView.dataset.templateLoaded = '1';
        window.dispatchEvent(new CustomEvent('loginView:templateLoaded'));
      }
    }

    if (typeof window.showView === 'function') {
      await window.showView('loginView');
      return;
    }

    document.querySelectorAll('.view, section.view').forEach(view => {
      view.classList.remove('active');
      view.classList.add('hidden');
      view.setAttribute('aria-hidden', 'true');
      if (view instanceof HTMLElement) {
        view.style.display = 'none';
      }
    });

    loginView.classList.add('active');
    loginView.classList.remove('hidden');
    loginView.removeAttribute('hidden');
    loginView.setAttribute('aria-hidden', 'false');
    if (loginView instanceof HTMLElement) {
      loginView.style.display = 'block';
    }
    if (document.body) {
      document.body.setAttribute('data-current-view', 'loginView');
    }
  });

  await page.waitForFunction(() => {
    const view = document.getElementById('loginView');
    const form = document.getElementById('loginFormElement');
    if (!view) return !!form;
    const style = window.getComputedStyle(view);
    const viewVisible =
      !view.hidden &&
      view.getAttribute('aria-hidden') !== 'true' &&
      style.display !== 'none' &&
      style.visibility !== 'hidden';
    return viewVisible && (view.dataset?.templateLoaded === '1' || !!form);
  });

  await page.evaluate(async () => {
    if (typeof window.setupAuthListeners === 'function') {
      await window.setupAuthListeners(0);
    }
  });

  await expect(loginForm).toBeVisible({ timeout: 15000 });
  await expect(page.locator('#loginEmail')).toBeVisible({ timeout: 15000 });
  await expect(page.locator('[data-testid="login-submit"]')).toBeVisible({ timeout: 15000 });
  await page.waitForFunction(() => {
    const form = document.getElementById('loginFormElement');
    return form?.dataset?.authSubmitBound === '1';
  });
}

async function waitForAuthenticatedUi(page) {
  await page.waitForFunction(() => {
    const compatUser =
      window.firebase?.auth && typeof window.firebase.auth === 'function'
        ? window.firebase.auth()?.currentUser
        : null;
    const modularUser = window.firebaseModular?.auth?.currentUser || null;
    const legacyWindowAuth = window.auth?.currentUser || null;
    const appStateUser =
      window.AppState && typeof window.AppState.getState === 'function'
        ? window.AppState.getState('user')
        : null;
    return !!(
      compatUser ||
      modularUser ||
      legacyWindowAuth ||
      (appStateUser && appStateUser.isAuthenticated)
    );
  });
}

async function signInViaRuntime(page, email, password) {
  return page.evaluate(
    async ({ email: runtimeEmail, password: runtimePassword }) => {
      const waitForFirebaseAuth = async timeoutMs => {
        const startedAt = Date.now();
        while (Date.now() - startedAt < timeoutMs) {
          const compatReady =
            window.firebase && typeof window.firebase.auth === 'function' && window.firebase.auth();
          const modularReady =
            window.firebaseModular &&
            window.firebaseModular.auth &&
            typeof window.firebaseModular.signInWithEmailAndPassword === 'function';
          if (compatReady || modularReady) {
            return {
              compatReady: !!compatReady,
              modularReady: !!modularReady,
            };
          }
          await new Promise(resolve => setTimeout(resolve, 250));
        }
        throw new Error('Firebase Auth no estuvo listo a tiempo en CI.');
      };

      const readiness = await waitForFirebaseAuth(15000);

      if (readiness.compatReady) {
        const auth = window.firebase.auth();
        const result = await auth.signInWithEmailAndPassword(runtimeEmail, runtimePassword);
        return {
          uid: result?.user?.uid || '',
          email: result?.user?.email || '',
          path: 'compat',
        };
      }

      const result = await window.firebaseModular.signInWithEmailAndPassword(
        runtimeEmail,
        runtimePassword
      );
      return {
        uid: result?.user?.uid || '',
        email: result?.user?.email || '',
        path: 'modular',
      };
    },
    { email, password }
  );
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

    const authSubmitBound = await page
      .waitForFunction(
        () => {
          const form = document.getElementById('loginFormElement');
          return form?.dataset?.authSubmitBound === '1';
        },
        null,
        { timeout: 10000 }
      )
      .then(() => true)
      .catch(() => false);

    if (authSubmitBound) {
      await page.locator('#loginEmail').fill(ADMIN_EMAIL);
      await page.locator('#loginPassword').fill(ADMIN_PASSWORD);
      await page.locator('[data-testid="login-submit"]').click();
    } else {
      await signInViaRuntime(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    }

    await waitForAuthenticatedUi(page);
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
