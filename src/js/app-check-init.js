/**
 * Firebase App Check Initialization (safe mode)
 *
 * - Producción: usa ReCaptchaV3Provider si hay site key configurada.
 * - Localhost: habilita modo debug token automáticamente.
 */

const FIREBASE_SDK_VERSION = '10.14.1';
const FIREBASE_SDK_BASE_URLS = [
  `https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/`,
  `https://cdn.jsdelivr.net/npm/firebase@${FIREBASE_SDK_VERSION}/`,
];

const appCheckModuleCache = new Map();

function debugLog(...args) {
  if (window.__WIFIHACKX_DEBUG__ === true) {
    console.info(...args);
  }
}

function isLocalhost() {
  const host = window.location?.hostname || '';
  return host === 'localhost' || host === '127.0.0.1' || host === '::1';
}

function resolveAppCheckSiteKey() {
  const appCheckKey = window.RUNTIME_CONFIG?.appCheck?.siteKey;
  if (typeof appCheckKey === 'string' && appCheckKey.trim()) {
    return appCheckKey.trim();
  }
  return '';
}

async function loadFirebaseAppCheckModule(moduleName) {
  if (appCheckModuleCache.has(moduleName)) {
    return appCheckModuleCache.get(moduleName);
  }

  let lastError = null;
  for (const base of FIREBASE_SDK_BASE_URLS) {
    const url = `${base}firebase-${moduleName}.js`;
    try {
      const mod = await import(/* @vite-ignore */ url);
      appCheckModuleCache.set(moduleName, mod);
      return mod;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error(`Failed to load firebase-${moduleName}.js`);
}

function waitForFirebaseApp(timeoutMs = 12000) {
  const existing = window.firebaseApp;
  if (existing) return Promise.resolve(existing);

  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      window.removeEventListener('firebase:initialized', onReady);
      reject(new Error('Firebase app not available for App Check'));
    }, timeoutMs);

    const onReady = event => {
      clearTimeout(timeoutId);
      resolve(event?.detail?.app || window.firebaseApp);
    };

    window.addEventListener('firebase:initialized', onReady, { once: true });
  });
}

function setDebugTokenIfNeeded() {
  if (!isLocalhost()) return;
  if (typeof self === 'undefined') return;
  const useDebugToken =
    localStorage.getItem('wifihackx:appcheck:use_debug_token') === '1';
  if (!useDebugToken) {
    if (typeof self.FIREBASE_APPCHECK_DEBUG_TOKEN !== 'undefined') {
      try {
        delete self.FIREBASE_APPCHECK_DEBUG_TOKEN;
      } catch (_e) {
        self.FIREBASE_APPCHECK_DEBUG_TOKEN = undefined;
      }
    }
    return;
  }
  if (typeof self.FIREBASE_APPCHECK_DEBUG_TOKEN !== 'undefined') return;

  const savedToken = localStorage.getItem('wifihackx:appcheck:debug_token');
  if (savedToken && savedToken.trim()) {
    self.FIREBASE_APPCHECK_DEBUG_TOKEN = savedToken.trim();
  }
}

function getSavedDebugToken() {
  const savedToken = localStorage.getItem('wifihackx:appcheck:debug_token');
  return savedToken && savedToken.trim() ? savedToken.trim() : '';
}

function hydrateDebugTokenFromQuery() {
  if (!isLocalhost()) return;
  try {
    const url = new URL(window.location.href);
    const token = (url.searchParams.get('appcheck_debug_token') || '').trim();
    if (!token) return;
    localStorage.setItem('wifihackx:appcheck:debug_token', token);
    url.searchParams.delete('appcheck_debug_token');
    window.history.replaceState({}, document.title, url.toString());
  } catch (_e) {}
}

function setupAppCheckHelpers(initialStatus) {
  window.APP_CHECK_READY = false;
  window.APP_CHECK = null;
  window.__APP_CHECK_STATUS__ = {
    ready: false,
    disabled: false,
    reason: '',
    ...initialStatus,
  };

  window.waitForAppCheck = function waitForAppCheck(timeoutMs = 8000) {
    if (window.APP_CHECK_READY && window.APP_CHECK) {
      return Promise.resolve(window.APP_CHECK);
    }

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        window.removeEventListener('appcheck:ready', onReady);
        reject(new Error(window.__APP_CHECK_STATUS__?.reason || 'App Check not ready'));
      }, timeoutMs);

      const onReady = () => {
        clearTimeout(timeoutId);
        resolve(window.APP_CHECK);
      };

      window.addEventListener('appcheck:ready', onReady, { once: true });
    });
  };

  window.isAppCheckActive = function isAppCheckActive() {
    return window.APP_CHECK_READY === true && !!window.APP_CHECK;
  };

  window.getAppCheckStatus = function getAppCheckStatus() {
    return {
      ...(window.__APP_CHECK_STATUS__ || {}),
      hostname: window.location.hostname,
      isDevelopment: isLocalhost(),
      ready: window.APP_CHECK_READY === true,
      hasInstance: !!window.APP_CHECK,
    };
  };
}

async function setupAppCheckInit() {
  setupAppCheckHelpers({ reason: 'initializing' });
  hydrateDebugTokenFromQuery();
  setDebugTokenIfNeeded();

  if (
    isLocalhost() &&
    localStorage.getItem('wifihackx:appcheck:enabled') !== '1'
  ) {
    window.__APP_CHECK_STATUS__ = {
      ...(window.__APP_CHECK_STATUS__ || {}),
      disabled: true,
      reason: 'localhost app-check disabled by default',
    };
    console.warn(
      '[APP-CHECK] Localhost disabled by default. Set localStorage wifihackx:appcheck:enabled=1 to enable.'
    );
    return;
  }

  const siteKey = resolveAppCheckSiteKey();
  if (!siteKey) {
    window.__APP_CHECK_STATUS__ = {
      ...(window.__APP_CHECK_STATUS__ || {}),
      disabled: true,
      reason: 'missing appCheck.siteKey in runtime config',
    };
    console.warn('[APP-CHECK] Disabled: missing runtime appCheck.siteKey');
    return;
  }

  try {
    const app = await waitForFirebaseApp();
    const appCheckMod = await loadFirebaseAppCheckModule('app-check');
    const { initializeAppCheck, ReCaptchaV3Provider } = appCheckMod;

    const appCheck = initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(siteKey),
      isTokenAutoRefreshEnabled: true,
    });

    window.APP_CHECK = appCheck;
    window.APP_CHECK_READY = true;
    window.__APP_CHECK_STATUS__ = {
      ...(window.__APP_CHECK_STATUS__ || {}),
      disabled: false,
      reason: 'active',
      provider: 'recaptcha-v3',
    };
    window.dispatchEvent(new CustomEvent('appcheck:ready', { detail: { appCheck } }));
    debugLog('[APP-CHECK] Active');
  } catch (error) {
    window.__APP_CHECK_STATUS__ = {
      ...(window.__APP_CHECK_STATUS__ || {}),
      disabled: true,
      reason: error?.message || 'initialization failed',
    };
    console.error('[APP-CHECK] Initialization failed', error);
  }
}

export function initAppCheck() {
  if (window.__APP_CHECK_INITED__) return;
  window.__APP_CHECK_INITED__ = true;
  setupAppCheckInit();
}

if (typeof window !== 'undefined' && !window.__APP_CHECK_NO_AUTO__) {
  initAppCheck();
}
