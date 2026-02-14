/**
 * payment-loader.js
 * Lazy loader for payment-related scripts (Stripe/PayPal + success UI)
 */
(function () {
  'use strict';

  const PAYMENT_SCRIPTS = [
    'js/checkout-interceptor.js',
    'js/stripe-loader.js',
    'js/stripe-checkout.js?v=2.1',
    'js/paypal-loader.js',
    'js/paypal-checkout.js',
    'js/confetti-animation.js',
    'js/success-sound.js',
    'js/purchase-success-modal.js?v=2.11.0',
    'js/post-checkout-handler.js?v=2.4',
  ];

  let paymentLoaded = false;
  let loadingPromise = null;

  function loadScript(src, async = false) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.defer = !async;
      if (async) {
        script.async = true;
      }
      const nonce = window.SECURITY_NONCE || window.NONCE;
      if (nonce) {
        script.nonce = nonce;
      }
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Failed to load ${src}`));
      document.body.appendChild(script);
    });
  }

  async function loadPaymentScripts() {
    if (paymentLoaded) return Promise.resolve();
    if (loadingPromise) return loadingPromise;

    loadingPromise = (async () => {
      for (const src of PAYMENT_SCRIPTS) {
        await loadScript(src, false);
      }
      paymentLoaded = true;
    })();

    return loadingPromise;
  }

  function ensureStripeReady() {
    return loadPaymentScripts().then(() => {
      if (typeof window.ensureStripeReady === 'function') {
        return window.ensureStripeReady();
      }
      if (typeof window.waitForStripe === 'function') {
        return window.waitForStripe();
      }
      return null;
    });
  }

  function ensurePayPalReady() {
    return loadPaymentScripts().then(() => {
      if (typeof window.waitForPayPal === 'function') {
        return window.waitForPayPal();
      }
      return null;
    });
  }

  function shouldLoadImmediately() {
    try {
      const params = new URLSearchParams(window.location.search);
      const status = params.get('status');
      const source = params.get('source');
      if (status === 'success') return true;
      if (source === 'paypal' || source === 'stripe') return true;
    } catch (_e) {}
    return false;
  }

  function init() {
    if (shouldLoadImmediately()) {
      loadPaymentScripts().catch(() => {});
    }
  }

  window.PaymentLoader = {
    load: loadPaymentScripts,
    isLoaded: () => paymentLoaded,
    ensureStripeReady,
    ensurePayPalReady,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
