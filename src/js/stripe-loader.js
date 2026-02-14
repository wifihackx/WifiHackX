/**
 * stripe-loader.js - Inicialización Segura de Stripe (Lazy)
 *
 * Inicializa Stripe usando la public key obtenida desde la Cloud Function,
 * evitando exponer credenciales en el HTML.
 *
 * Este loader ahora es lazy: carga el SDK bajo demanda.
 */

'use strict';

function setupStripeLoader() {

  const STRIPE_SDK_URL = 'https://js.stripe.com/v3';
  let stripeSdkPromise = null;
  let stripeInitPromise = null;

  // Fallback del logger
  const logSystem = window.Logger || {
    info: (m, c) => console.log(`[${c}] ${m}`),
    warn: (m, c) => console.warn(`[${c}] ${m}`),
    error: (m, c, d) => console.error(`[${c}] ${m}`, d),
    debug: (m, c) => console.log(`[DEBUG][${c}] ${m}`),
    startGroup: (n, e) => console.group(`${e || ''} ${n}`),
    endGroup: () => console.groupEnd(),
  };
  const CAT = window.LOG_CATEGORIES || {
    PAYMENTS: 'PAY',
    INIT: 'INIT',
    ERR: 'ERR',
  };

  function getNonce() {
    return window.SECURITY_NONCE || window.NONCE || null;
  }

  window.loadStripeSdk = function () {
    if (window.Stripe) {
      return Promise.resolve(window.Stripe);
    }

    if (stripeSdkPromise) {
      return stripeSdkPromise;
    }

    stripeSdkPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-stripe-sdk]');
      if (existing && window.Stripe) {
        resolve(window.Stripe);
        return;
      }

      const script = document.createElement('script');
      script.src = STRIPE_SDK_URL;
      script.async = true;
      script.defer = true;
      script.setAttribute('data-stripe-sdk', 'true');
      const nonce = getNonce();
      if (nonce) {
        script.nonce = nonce;
      }

      script.onload = () => {
        if (window.Stripe) {
          resolve(window.Stripe);
        } else {
          reject(new Error('Stripe SDK cargado pero Stripe no está disponible'));
        }
      };
      script.onerror = () => {
        reject(new Error('No se pudo cargar Stripe SDK'));
      };

      document.head.appendChild(script);
    });

    return stripeSdkPromise;
  };

  async function ensureStripeReady() {
    if (window.STRIPE_READY && window.stripe) {
      return window.stripe;
    }

    if (stripeInitPromise) {
      return stripeInitPromise;
    }

    stripeInitPromise = (async () => {
      logSystem.startGroup('Stripe Loader (Lazy)', CAT.INIT);
      logSystem.info('Inicializando Stripe bajo demanda...', CAT.INIT);

      try {
        if (typeof window.waitForNonce === 'function') {
          await window.waitForNonce();
        }

        if (!window.STRIPE_PUBLIC_KEY) {
          throw new Error('Stripe Public Key no disponible');
        }

        await window.loadStripeSdk();

        if (typeof window.Stripe === 'undefined') {
          throw new Error('Stripe SDK no está disponible');
        }

        window.stripe = window.Stripe(window.STRIPE_PUBLIC_KEY);
        window.STRIPE_READY = true;

        logSystem.info('Stripe inicializado exitosamente', CAT.INIT);

        window.dispatchEvent(
          new CustomEvent('stripe-ready', {
            detail: {
              timestamp: new Date().toISOString(),
            },
          })
        );

        return window.stripe;
      } catch (error) {
        logSystem.error('Error en inicialización', CAT.PAYMENTS, error);
        window.STRIPE_READY = false;

        window.dispatchEvent(
          new CustomEvent('stripe-error', {
            detail: {
              error: error.message,
              timestamp: new Date().toISOString(),
            },
          })
        );

        throw error;
      } finally {
        logSystem.endGroup('Stripe Loader (Lazy)');
      }
    })();

    return stripeInitPromise;
  }

  window.ensureStripeReady = ensureStripeReady;

  /**
   * Función helper para esperar a que Stripe esté listo
   */
  window.waitForStripe = function () {
    return ensureStripeReady();
  };
}

export function initStripeLoader() {
  if (window.__STRIPE_LOADER_INITED__) {
    return;
  }

  window.__STRIPE_LOADER_INITED__ = true;
  setupStripeLoader();
}

if (typeof window !== 'undefined' && !window.__STRIPE_LOADER_NO_AUTO__) {
  initStripeLoader();
}
