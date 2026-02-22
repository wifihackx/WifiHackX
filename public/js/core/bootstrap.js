// Core bootstrap: auth-first + lazy features/admin.
// Keep critical infrastructure deterministic, defer non-blocking modules.

import '../logger-unified.js?v=1.1';
import '../logger-init.js';
import './app-state.js';
import '../firebase-init-modular.js?v=1.3';
import '../app-check-init.js';
import '../dom-helpers.js';
import '../log-sanitizer.js?v=1.2';
import '../security-bundle.js?v=1.1';
import '../nonce-init.js';
import '../inline-core.js';
import './migration-adapters.js';

import {
    initAuth
} from '../modules/auth/index.js';
import {
    initDataPublic
} from '../modules/data/index.js';
import {
    initUi
} from '../modules/ui/index.js';

const debugLog = (...args) => {
    if (window.__WIFIHACKX_DEBUG__ === true) {
        console.info(...args);
    }
};

initAuth();
initDataPublic();
initUi();

// Signal app is ready to reveal
if (window.revealApp) {
    // Give UI a moment to paint before revealing
    setTimeout(() => {
        window.revealApp();
        debugLog('[Bootstrap] App revealed');
    }, 300);
}

// Lazy features (non-blocking)
const runIdle = fn => {
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
        window.requestIdleCallback(fn, {
            timeout: 1500
        });
    } else {
        setTimeout(fn, 500);
    }
};

let featuresInitPromise = null;
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
let adminReady = false;
const PAYMENT_INTENT_SELECTOR =
    '[data-action="checkout"], [data-action="addToCart"], #checkoutBtn, #paypal-button-container';
const ADMIN_INTENT_SELECTOR = '[data-action="openAdmin"]';

const getEventElementTarget = target => (target instanceof Element ? target : null);

let removePaymentWarmupListeners = () => {};
let removeIntentClickListener = () => {};
let unsubscribeAdminRoleWatcher = () => {};
const isProdMode = !!(import.meta && import.meta.env && import.meta.env.PROD);

const cleanupIntentListenersIfSettled = () => {
    const paymentsDone = !isProdMode || paymentsReady;
    if (paymentsDone && adminReady) {
        removePaymentWarmupListeners();
        removeIntentClickListener();
        unsubscribeAdminRoleWatcher();
    }
};

const ensurePaymentsLoaded = () => {
    if (paymentsReady) return Promise.resolve();
    if (paymentsInitPromise) return paymentsInitPromise;
    paymentsInitPromise = import('../modules/payments/index.js')
        .then(mod => {
            if (mod && typeof mod.initPayments === 'function') {
                mod.initPayments();
            }
            paymentsReady = true;
            removePaymentWarmupListeners();
            cleanupIntentListenersIfSettled();
        })
        .catch(err => {
            console.error('[Bootstrap] Error cargando payments:', err);
            throw err;
        });
    return paymentsInitPromise;
};

runIdle(() => ensureFeaturesLoaded());

// Lazy admin: load only when admin is needed
let adminInitPromise = null;
const ensureAdminLoaded = () => {
    if (adminInitPromise) return adminInitPromise;
    adminInitPromise = import('../modules/admin/index.js')
        .then(mod => {
            if (mod && typeof mod.initAdmin === 'function') {
                mod.initAdmin();
            }
            adminReady = true;
            unsubscribeAdminRoleWatcher();
            cleanupIntentListenersIfSettled();
        })
        .catch(err => {
            console.error('[Bootstrap] Error cargando admin:', err);
        });
    return adminInitPromise;
};

// Trigger admin load on admin intent or role
const onIntentClick = e => {
    const target = getEventElementTarget(e.target);
    if (!target) return;

    const paymentTarget = target.closest(PAYMENT_INTENT_SELECTOR);
    if (paymentTarget && isProdMode && !paymentsReady && !replayingPaymentClick) {
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

    if (!adminReady && target.closest(ADMIN_INTENT_SELECTOR)) {
        ensureAdminLoaded();
    } else {
        cleanupIntentListenersIfSettled();
    }
};
document.addEventListener('click', onIntentClick, true);
removeIntentClickListener = () => {
    document.removeEventListener('click', onIntentClick, true);
};

if (isProdMode) {
    const warmupPayments = e => {
        const target = getEventElementTarget(e.target);
        const paymentTarget = target ? target.closest(PAYMENT_INTENT_SELECTOR) : null;
        if (!paymentTarget || paymentsReady) {
            cleanupIntentListenersIfSettled();
            return;
        }

        if (paymentTarget && !paymentsReady) {
            ensurePaymentsLoaded().catch(() => {});
        }
    };
    document.addEventListener('pointerover', warmupPayments, {
        capture: true,
        passive: true
    });
    document.addEventListener('focusin', warmupPayments, true);
    removePaymentWarmupListeners = () => {
        document.removeEventListener('pointerover', warmupPayments, true);
        document.removeEventListener('focusin', warmupPayments, true);
    };
}

if (window.AppState && typeof window.AppState.subscribe === 'function') {
    unsubscribeAdminRoleWatcher = window.AppState.subscribe('user', user => {
        if (user && user.isAdmin) {
            ensureAdminLoaded();
        }
    });
}

if (document.body?.dataset?.currentView === 'adminView') {
    ensureAdminLoaded();
}
