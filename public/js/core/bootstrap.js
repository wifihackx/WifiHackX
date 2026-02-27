// Core bootstrap: auth-first + lazy features/admin.
// Keep critical infrastructure deterministic, defer non-blocking modules.

import '../logger-unified.js';
import '../logger-init.js';
import './app-state.js';
import '../firebase-init-modular.js';
import '../app-check-init.js';
import '../dom-helpers.js';
import '../log-sanitizer.js';
import '../security-bundle.js';
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

const runSafe = (name, fn) => {
    try {
        debugLog(`[Bootstrap] Initializing ${name}...`);
        fn();
    } catch (err) {
        console.error(`[Bootstrap] Critical error in ${name}:`, err);
        // En sistemas críticos, aquí reportaríamos a Sentry/RUM de forma inmediata
        if (window.Sentry && typeof window.Sentry.captureException === 'function') {
            window.Sentry.captureException(err, {
                tags: {
                    phase: 'bootstrap',
                    module: name
                }
            });
        }
    }
};

setTimeout(() => {
    runSafe('Auth', initAuth);
    runSafe('DataPublic', initDataPublic);
    runSafe('Ui', initUi);

    // Signal app is ready to reveal
    if (window.revealApp) {
        window.revealApp();
        debugLog('[Bootstrap] App revealed');
    }
    document.body.classList.add('app-loaded');
}, 0);

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

const scheduleFeaturesBootstrap = () => {
    let started = false;
    const start = () => {
        if (started) return;
        started = true;
        ensureFeaturesLoaded();
        removeInteractionWarmup();
    };

    const onFirstInteraction = () => start();
    const interactionEvents = ['pointerdown', 'keydown', 'touchstart', 'focusin'];
    const removeInteractionWarmup = () => {
        for (const eventName of interactionEvents) {
            document.removeEventListener(eventName, onFirstInteraction, true);
        }
    };
    for (const eventName of interactionEvents) {
        document.addEventListener(eventName, onFirstInteraction, {
            capture: true,
            passive: true,
            once: true,
        });
    }

    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
        window.requestIdleCallback(start, {
            timeout: 4000,
        });
        return;
    }
    setTimeout(start, 2500);
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
const isProdMode = !!(
    import.meta &&
    import.meta.env &&
    import.meta.env.PROD);

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

if (typeof window !== 'undefined') {
    window.__WFX_ENSURE_PAYMENTS_LOADED__ = ensurePaymentsLoaded;
}

const shouldLoadPaymentsImmediately = () => {
    try {
        const params = new URLSearchParams(window.location.search);
        const status = (params.get('status') || '').toLowerCase();
        const source = (params.get('source') || '').toLowerCase();
        const hasStripeSession = !!params.get('session_id');
        const hasProductId = !!params.get('productId');

        if (status === 'success' && (hasProductId || hasStripeSession)) return true;
        if (source === 'stripe' || source === 'paypal') return true;
        if (hasStripeSession) return true;
    } catch (_e) {}
    return false;
};

if (shouldLoadPaymentsImmediately()) {
    ensurePaymentsLoaded().catch(() => {});
}

if (document.readyState === 'complete') {
    scheduleFeaturesBootstrap();
} else {
    window.addEventListener('load', scheduleFeaturesBootstrap, {
        once: true
    });
}

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
document.addEventListener('click', onIntentClick);
removeIntentClickListener = () => {
    document.removeEventListener('click', onIntentClick);
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
        passive: true,
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

if (document.body && document.body.dataset && document.body.dataset.currentView === 'adminView') {
    ensureAdminLoaded();
}