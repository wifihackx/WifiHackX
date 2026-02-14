// Core bootstrap: auth-first + lazy features/admin.
// Keep critical infrastructure deterministic, defer non-blocking modules.

import '../logger-unified.js?v=1.1';
import '../logger-init.js';
import './app-state.js';
import '../firebase-init-modular.js?v=1.3';
import '../core.js';
import '../dom-helpers.js';
import '../log-sanitizer.js?v=1.2';
import '../inline-core.js';
import { initDomPurifyLoader } from '../dompurify-loader.js';

import { initAuth } from '../modules/auth/index.js';
import { initDataPublic } from '../modules/data/index.js';
import { initUi } from '../modules/ui/index.js';

initAuth();
initDomPurifyLoader();

let uiInitialized = false;
let dataInitialized = false;
const initUiSafe = () => {
  if (uiInitialized) return;
  uiInitialized = true;
  initUi();
};
const initDataPublicSafe = () => {
  if (dataInitialized) return;
  dataInitialized = true;
  initDataPublic();
};

const runAfterFirstPaint = fn => {
  if (typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') {
    setTimeout(fn, 0);
    return;
  }
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      setTimeout(fn, 0);
    });
  });
};

// Lazy features (non-blocking)
const runIdle = fn => {
  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
    window.requestIdleCallback(fn, { timeout: 1500 });
  } else {
    setTimeout(fn, 500);
  }
};

let featuresInitPromise = null;
let nonCriticalCoreInitPromise = null;
let nonceInitPromise = null;

const ensureNonceReady = () => {
  if (nonceInitPromise) return nonceInitPromise;
  nonceInitPromise = import('../nonce-init.js').catch(err => {
    console.error('[Bootstrap] Error cargando nonce-init:', err);
    throw err;
  });
  return nonceInitPromise;
};

const ensureNonCriticalCoreLoaded = () => {
  if (nonCriticalCoreInitPromise) return nonCriticalCoreInitPromise;
  nonCriticalCoreInitPromise = Promise.all([
    import('../security-bundle.js?v=1.1'),
    import('../xss-protection.js'),
    ensureNonceReady(),
    import('../announcement-utils.js?v=1.0'),
    import('../lazy-loading-enhanced.js'),
    import('./migration-adapters.js')
  ]).catch(err => {
    console.error('[Bootstrap] Error cargando núcleo diferido:', err);
  });
  return nonCriticalCoreInitPromise;
};

const ensureFeaturesLoaded = () => {
  if (featuresInitPromise) return featuresInitPromise;
  featuresInitPromise = import('../modules/features/index.js')
    .then(mod => {
      if (mod && typeof mod.initFeatures === 'function') {
        mod.initFeatures();
      }
    })
    .catch(err => {
      console.error('[Bootstrap] Error cargando features:', err);
    });
  return featuresInitPromise;
};

let paymentsInitPromise = null;
let paymentsReady = false;
let replayingPaymentClick = false;
const ensurePaymentsLoaded = () => {
  if (paymentsReady) return Promise.resolve();
  if (paymentsInitPromise) return paymentsInitPromise;
  paymentsInitPromise = ensureNonceReady()
    .then(() => import('../modules/payments/index.js'))
    .then(mod => {
      if (mod && typeof mod.initPayments === 'function') {
        mod.initPayments();
      }
      paymentsReady = true;
    })
    .catch(err => {
      console.error('[Bootstrap] Error cargando payments:', err);
      throw err;
    });
  return paymentsInitPromise;
};

runAfterFirstPaint(initUiSafe);
runAfterFirstPaint(() => runIdle(ensureNonCriticalCoreLoaded));

let dataInteractionBound = false;
const bindDataOnInteraction = () => {
  if (dataInteractionBound) return;
  dataInteractionBound = true;

  const trigger = () => {
    initDataPublicSafe();
    window.removeEventListener('pointerdown', trigger, true);
    window.removeEventListener('keydown', trigger, true);
    window.removeEventListener('touchstart', trigger, true);
    window.removeEventListener('scroll', trigger, true);
  };

  window.addEventListener('pointerdown', trigger, true);
  window.addEventListener('keydown', trigger, true);
  window.addEventListener('touchstart', trigger, true);
  window.addEventListener('scroll', trigger, true);

  // Strict fallback for passive sessions.
  setTimeout(() => runIdle(trigger), 30000);
};

bindDataOnInteraction();

// Lazy admin: load only when admin is needed
let adminInitPromise = null;
const ensureAdminLoaded = () => {
  if (adminInitPromise) return adminInitPromise;
  adminInitPromise = import('../modules/admin/index.js')
    .then(mod => {
      if (mod && typeof mod.initAdmin === 'function') {
        mod.initAdmin();
      }
    })
    .catch(err => {
      console.error('[Bootstrap] Error cargando admin:', err);
    });
  return adminInitPromise;
};

// Trigger admin load on admin intent or role
document.addEventListener(
  'click',
  e => {
    const paymentTarget = e.target.closest(
      '[data-action="checkout"], [data-action="addToCart"], #checkoutBtn, #paypal-button-container'
    );
    if (paymentTarget && import.meta.env.PROD) {
      if (!paymentsReady && !replayingPaymentClick) {
        e.preventDefault();
        e.stopImmediatePropagation();
        ensurePaymentsLoaded()
          .then(() => {
            replayingPaymentClick = true;
            if (paymentTarget instanceof HTMLElement) {
              paymentTarget.click();
            }
          })
          .finally(() => {
            replayingPaymentClick = false;
          });
        return;
      }
    }

    const target = e.target.closest('[data-action="openAdmin"]');
    if (target) ensureAdminLoaded();
  },
  true
);

if (import.meta.env.PROD) {
  let featuresInteractionBound = false;
  const bindFeaturesOnInteraction = () => {
    if (featuresInteractionBound) return;
    featuresInteractionBound = true;

    const trigger = () => {
      ensureFeaturesLoaded();
      window.removeEventListener('pointerdown', trigger, true);
      window.removeEventListener('keydown', trigger, true);
      window.removeEventListener('touchstart', trigger, true);
      window.removeEventListener('scroll', trigger, true);
    };

    window.addEventListener('pointerdown', trigger, true);
    window.addEventListener('keydown', trigger, true);
    window.addEventListener('touchstart', trigger, true);
    window.addEventListener('scroll', trigger, true);

    // Strict fallback: keep first render path clean as long as possible.
    setTimeout(trigger, 30000);
  };

  bindFeaturesOnInteraction();

  const warmupPayments = e => {
    const target = e.target && e.target.closest
      ? e.target.closest('[data-action="checkout"], #checkoutBtn, #paypal-button-container')
      : null;
    if (target && !paymentsReady) {
      ensurePaymentsLoaded().catch(() => {});
    }
  };
  document.addEventListener('pointerover', warmupPayments, { capture: true, passive: true });
  document.addEventListener('focusin', warmupPayments, true);
} else {
  // Dev keeps features eager for debugging ergonomics.
  runIdle(() => ensureFeaturesLoaded());
}

if (window.AppState && typeof window.AppState.subscribe === 'function') {
  window.AppState.subscribe('user', user => {
    if (user && user.isAdmin) {
      ensureAdminLoaded();
    }
  });
}

if (document.body?.dataset?.currentView === 'adminView') {
  ensureAdminLoaded();
}
