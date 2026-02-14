/**
 * Observability Loader
 * - Lazy-loads analytics and monitoring to reduce initial payload
 * - Provides safe stubs for analytics calls before consent
 */
(function () {
  'use strict';

  const scriptCache = new Map();
  const state = {
    analyticsLoaded: false,
    rumLoaded: false,
    monitoringLoaded: false,
  };

  function loadScript(src, options = {}) {
    if (scriptCache.has(src)) {
      return scriptCache.get(src);
    }

    const promise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;

      if (options.async) {
        script.async = true;
      } else {
        script.defer = true;
      }

      if (options.crossOrigin) {
        script.crossOrigin = options.crossOrigin;
      }

      if (options.integrity) {
        script.integrity = options.integrity;
      }

      const nonce = window.SECURITY_NONCE || window.NONCE;
      if (nonce) {
        script.nonce = nonce;
      }

      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Failed to load ${src}`));

      document.head.appendChild(script);
    });

    scriptCache.set(src, promise);
    return promise;
  }

  function scheduleIdle(fn, timeout = 1200) {
    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(fn, { timeout });
    } else {
      setTimeout(fn, timeout);
    }
  }

  function ensureStubs() {
    const noop = () => {};

    if (!window.Analytics) {
      window.Analytics = {
        init: () => window.AnalyticsLoader?.loadAfterConsent?.(),
        trackEvent: noop,
        trackPageView: noop,
        trackLogin: noop,
        trackSignUp: noop,
        trackPurchase: noop,
        trackAddToCart: noop,
        trackSearch: noop,
        trackError: noop,
      };
    }

    if (!window.enhancedAnalytics) {
      window.enhancedAnalytics = {
        trackCheckoutStarted: noop,
        trackPurchaseCompleted: noop,
        trackDownload: noop,
        trackCartAbandonment: noop,
        trackError: noop,
        trackLogin: noop,
        trackSignup: noop,
        trackSearch: noop,
        trackPageView: noop,
        trackTimeOnPage: noop,
      };
    }
  }

  const ANALYTICS_SCRIPTS = [
    'js/analytics-tracker.js',
    'js/analytics-ga4.js',
    'js/analytics-enhanced.js',
  ];
  const RUM_SCRIPT = 'js/real-user-monitoring.js';
  const SENTRY_SDK =
    'https://browser.sentry-cdn.com/10.32.1/bundle.tracing.replay.min.js';
  const SENTRY_INIT = 'js/sentry-init.js';

  async function loadAnalytics() {
    if (state.analyticsLoaded) return;
    state.analyticsLoaded = true;

    for (const src of ANALYTICS_SCRIPTS) {
      await loadScript(src);
    }
  }

  async function loadRUM() {
    if (state.rumLoaded) return;
    state.rumLoaded = true;

    await loadScript(RUM_SCRIPT);
  }

  async function loadMonitoring() {
    if (state.monitoringLoaded) return;
    state.monitoringLoaded = true;

    await loadScript(SENTRY_SDK, { async: true, crossOrigin: 'anonymous' });
    await loadScript(SENTRY_INIT);
  }

  const AnalyticsLoader = {
    loadAfterConsent() {
      const hasConsent = localStorage.getItem('analytics_consent') === 'true';
      if (!hasConsent) return;

      scheduleIdle(() => {
        loadAnalytics()
          .then(loadRUM)
          .catch(() => {});
      }, 600);
    },
    loadMonitoring,
    ensureStubs,
  };

  window.AnalyticsLoader = AnalyticsLoader;
  ensureStubs();

  function maybeAutoload() {
    if (localStorage.getItem('analytics_consent') === 'true') {
      AnalyticsLoader.loadAfterConsent();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      maybeAutoload();
      scheduleIdle(loadMonitoring, 2000);
    });
  } else {
    maybeAutoload();
    scheduleIdle(loadMonitoring, 2000);
  }
})();
