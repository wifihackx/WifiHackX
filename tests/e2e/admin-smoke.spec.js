import { expect, test } from '@playwright/test';

const ADMIN_EMAIL = process.env.WFX_E2E_ADMIN_EMAIL || process.env.WFX_E2E_EMAIL || '';
const ADMIN_PASSWORD = process.env.WFX_E2E_ADMIN_PASSWORD || process.env.WFX_E2E_PASSWORD || '';
const APP_CHECK_DEBUG_TOKEN = process.env.WFX_E2E_APPCHECK_DEBUG_TOKEN || '';
const APP_URL = '/?full_app=1';

async function installRuntimeDiagnostics(page, options = {}) {
  const appCheckDebugToken = String(options.appCheckDebugToken || '').trim();

  await page.addInitScript(token => {
    const hasAppCheckDebugToken = typeof token === 'string' && token.trim().length > 0;
    if (hasAppCheckDebugToken) {
      window.__WFX_LOCAL_DEV__ = {
        ...(window.__WFX_LOCAL_DEV__ || {}),
        appCheck: {
          ...((window.__WFX_LOCAL_DEV__ && window.__WFX_LOCAL_DEV__.appCheck) || {}),
          autoEnableLocal: true,
          localDebugToken: token.trim(),
        },
      };
      try {
        localStorage.setItem('wifihackx:appcheck:enabled', '1');
        localStorage.setItem('wifihackx:appcheck:debug_token', token.trim());
      } catch (_error) {}
      try {
        window.FIREBASE_APPCHECK_DEBUG_TOKEN = token.trim();
      } catch (_error) {}
    } else {
      window.__APP_CHECK_NO_AUTO__ = true;
    }

    try {
      if (!hasAppCheckDebugToken) {
        localStorage.removeItem('wifihackx:appcheck:enabled');
        localStorage.removeItem('wifihackx:appcheck:debug_token');
        localStorage.removeItem('firebase-app-check-debug-token');
      }
      sessionStorage.removeItem('wifihackx:appcheck:recovery_in_progress');
    } catch (_error) {}

    const diag = {
      events: [],
      errors: [],
      rejections: [],
    };

    const pushEvent = (type, detail = {}) => {
      diag.events.push({
        type,
        at: new Date().toISOString(),
        detail,
      });
      if (diag.events.length > 40) {
        diag.events.shift();
      }
    };

    const safeDetail = value => {
      if (!value || typeof value !== 'object') return value ?? null;
      try {
        return JSON.parse(JSON.stringify(value));
      } catch (_error) {
        return { nonSerializable: true };
      }
    };

    window.__WFX_E2E_DIAG__ = diag;
    pushEvent('smoke:init', {
      hasAppCheckDebugToken,
      appCheckAutoDisabled: window.__APP_CHECK_NO_AUTO__ === true,
    });

    window.addEventListener('runtime-config:ready', () => {
      pushEvent('runtime-config:ready', {
        status: window.__runtimeConfigStatus || null,
        projectId: window.RUNTIME_CONFIG?.firebase?.projectId || '',
      });
    });
    window.addEventListener('runtime-config:degraded', event => {
      pushEvent('runtime-config:degraded', safeDetail(event?.detail));
    });
    window.addEventListener('firebase:initialized', event => {
      pushEvent('firebase:initialized', {
        detail: safeDetail(event?.detail),
        hasCompat: !!window.firebase,
        hasModular: !!window.firebaseModular,
      });
    });
    window.addEventListener('firebaseReady', () => {
      pushEvent('firebaseReady', {
        hasCompatAuth: !!(window.firebase && typeof window.firebase.auth === 'function'),
        hasModularAuth: !!window.firebaseModular?.auth,
      });
    });
    window.addEventListener('appcheck:ready', () => {
      pushEvent('appcheck:ready', {
        status: window.__APP_CHECK_STATUS__ || null,
      });
    });
    window.addEventListener('error', event => {
      diag.errors.push({
        message: event?.message || '',
        filename: event?.filename || '',
      });
      if (diag.errors.length > 20) {
        diag.errors.shift();
      }
    });
    window.addEventListener('unhandledrejection', event => {
      diag.rejections.push({
        reason: String(event?.reason || ''),
      });
      if (diag.rejections.length > 20) {
        diag.rejections.shift();
      }
    });
  }, appCheckDebugToken);
}

async function stubRuntimeConfigForSmoke(page) {
  await page.route('**/config/runtime-config.json', async route => {
    const response = await route.fetch();
    const payload = await response.json().catch(() => null);

    if (!payload || typeof payload !== 'object') {
      await route.fulfill({ response });
      return;
    }

    payload.appCheck = {
      ...(payload.appCheck || {}),
      enabled: false,
      siteKey: '',
    };

    await route.fulfill({
      response,
      contentType: 'application/json',
      body: JSON.stringify(payload),
    });
  });
}

async function collectRuntimeDiagnostics(page) {
  return page.evaluate(() => ({
    href: window.location.href,
    readyState: document.readyState,
    runtimeConfigStatus: window.__runtimeConfigStatus || null,
    runtimeProjectId: window.RUNTIME_CONFIG?.firebase?.projectId || '',
    runtimeAuthDomain: window.RUNTIME_CONFIG?.firebase?.authDomain || '',
    hasFirebaseCompat: !!window.firebase,
    hasFirebaseCompatAuthFn: !!(window.firebase && typeof window.firebase.auth === 'function'),
    hasFirebaseCompatCurrentUser: !!window.firebase?.auth?.()?.currentUser,
    hasFirebaseModular: !!window.firebaseModular,
    hasFirebaseModularAuth: !!window.firebaseModular?.auth,
    hasFirebaseModularSignIn: !!(
      window.firebaseModular &&
      typeof window.firebaseModular.signInWithEmailAndPassword === 'function'
    ),
    hasWindowAuth: !!window.auth,
    hasWindowDb: !!window.db,
    hasSetupAuthListeners: typeof window.setupAuthListeners === 'function',
    loginViewVisible: (() => {
      const view = document.getElementById('loginView');
      if (!view) return false;
      const style = window.getComputedStyle(view);
      return (
        !view.hidden &&
        view.getAttribute('aria-hidden') !== 'true' &&
        style.display !== 'none' &&
        style.visibility !== 'hidden'
      );
    })(),
    loginFormPresent: !!document.getElementById('loginFormElement'),
    authSubmitBound: document.getElementById('loginFormElement')?.dataset?.authSubmitBound || '',
    diag: window.__WFX_E2E_DIAG__ || null,
  }));
}

async function waitForFirebaseBootstrap(page, timeoutMs = 20000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const state = await page.evaluate(async () => {
      try {
        if (window.__runtimeConfigReady && typeof window.__runtimeConfigReady.then === 'function') {
          await Promise.race([
            window.__runtimeConfigReady.catch(() => null),
            new Promise(resolve => setTimeout(resolve, 500)),
          ]);
        }
      } catch (_error) {}

      const compatReady =
        !!(window.firebase && typeof window.firebase.auth === 'function') &&
        !!window.firebase.auth();
      const modularReady = !!window.firebaseModular?.auth;

      return {
        runtimeProjectId: window.RUNTIME_CONFIG?.firebase?.projectId || '',
        compatReady,
        modularReady,
      };
    });

    if (state.runtimeProjectId && (state.compatReady || state.modularReady)) {
      return state;
    }

    await page.waitForTimeout(250);
  }

  const diagnostics = await collectRuntimeDiagnostics(page);
  throw new Error(
    `Firebase/Auth no estuvo listo a tiempo.\n${JSON.stringify(diagnostics, null, 2)}`
  );
}

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

  await page.waitForFunction(
    () => {
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
    },
    null,
    { timeout: 15000 }
  );

  await page.evaluate(async () => {
    if (typeof window.setupAuthListeners === 'function') {
      await window.setupAuthListeners(0);
    }
  });

  await expect(loginForm).toBeAttached({ timeout: 15000 });
  await expect(page.locator('#loginEmail')).toBeAttached({ timeout: 15000 });
  await expect(page.locator('[data-testid="login-submit"]')).toBeAttached({ timeout: 15000 });
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
  await waitForFirebaseBootstrap(page, 20000);
  return page.evaluate(
    async ({ email: runtimeEmail, password: runtimePassword }) => {
      if (window.firebase && typeof window.firebase.auth === 'function' && window.firebase.auth()) {
        const auth = window.firebase.auth();
        const result = await auth.signInWithEmailAndPassword(runtimeEmail, runtimePassword);
        return {
          uid: result?.user?.uid || '',
          email: result?.user?.email || '',
          path: 'compat',
        };
      }

      if (
        !window.firebaseModular?.auth ||
        typeof window.firebaseModular.signInWithEmailAndPassword !== 'function'
      ) {
        throw new Error('Firebase modular auth no esta disponible tras el bootstrap.');
      }

      const signInFn = window.firebaseModular.signInWithEmailAndPassword;
      const result =
        signInFn.length >= 3
          ? await signInFn(window.firebaseModular.auth, runtimeEmail, runtimePassword)
          : await signInFn(runtimeEmail, runtimePassword);

      return {
        uid: result?.user?.uid || '',
        email: result?.user?.email || '',
        path: 'modular',
      };
    },
    { email, password }
  );
}

async function clearAppCheckStateForSmoke(page) {
  await page.evaluate(async () => {
    try {
      sessionStorage.removeItem('wifihackx:appcheck:recovery_in_progress');
    } catch (_error) {}
    try {
      if (typeof window.clearAppCheckState === 'function') {
        await window.clearAppCheckState();
      }
    } catch (_error) {}
  });
}

async function signInViaRuntimeWithRecovery(page, email, password) {
  await clearAppCheckStateForSmoke(page);
  try {
    return await signInViaRuntime(page, email, password);
  } catch (error) {
    const message = String(error?.message || '');
    const appCheckInvalid = message.toLowerCase().includes('firebase-app-check-token-is-invalid');
    if (!appCheckInvalid) {
      throw error;
    }

    await clearAppCheckStateForSmoke(page);

    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    await waitForFirebaseBootstrap(page, 20000);
    await clearAppCheckStateForSmoke(page);
    return signInViaRuntime(page, email, password);
  }
}

test.describe('Admin smoke', () => {
  test('public app shell loads and wires checkout/login flows', async ({ page }) => {
    test.setTimeout(120000);

    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
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
    test.skip(
      !!process.env.CI && !APP_CHECK_DEBUG_TOKEN,
      'Set WFX_E2E_APPCHECK_DEBUG_TOKEN to run the admin smoke test in CI with Auth App Check enforce.'
    );

    if (!APP_CHECK_DEBUG_TOKEN) {
      await stubRuntimeConfigForSmoke(page);
    }
    await installRuntimeDiagnostics(page, {
      appCheckDebugToken: APP_CHECK_DEBUG_TOKEN,
    });
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    await openLoginView(page);
    await expect(page.locator('#loginFormElement')).toBeAttached({ timeout: 15000 });
    await waitForFirebaseBootstrap(page, 20000);

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
    const loginEmailVisible = await page
      .locator('#loginEmail')
      .isVisible()
      .catch(() => false);
    const loginSubmitVisible = await page
      .locator('[data-testid="login-submit"]')
      .isVisible()
      .catch(() => false);

    if (authSubmitBound && loginEmailVisible && loginSubmitVisible) {
      await page.locator('#loginEmail').fill(ADMIN_EMAIL);
      await page.locator('#loginPassword').fill(ADMIN_PASSWORD);
      await page.locator('[data-testid="login-submit"]').click();
    } else {
      await signInViaRuntimeWithRecovery(page, ADMIN_EMAIL, ADMIN_PASSWORD);
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
