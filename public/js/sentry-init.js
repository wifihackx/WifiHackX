/**
 * WifiHackX - Sentry Initialization & Error Monitoring
 * Centralized error tracking for production environment.
 */

'use strict';

const debugLog = (...args) => {
  if (window.__WFX_DEBUG__ === true) {
    console.info(...args);
  }
};

function setupSentryInit() {

  // Fallback del logger
  const logSystem = window.Logger || {
    info: (m, c) => debugLog(`[${c}] ${m}`),
    warn: (m, c) => console.warn(`[${c}] ${m}`),
    error: (m, c, d) => console.error(`[${c}] ${m}`, d),
    debug: (m, c) => debugLog(`[DEBUG][${c}] ${m}`),
    startGroup: (_n, e) => console.group(`${e || ''} ${_n}`),
    endGroup: _n => console.groupEnd(),
  };
  const CAT = window.LOG_CATEGORIES || {
    INFRA: 'INFRA',
    INIT: 'INIT',
    ERR: 'ERR',
  };

  /**
   * Validates if a Sentry DSN is properly configured
   * @param {string} dsn - The Sentry DSN to validate
   * @returns {boolean} - True if DSN is valid, false otherwise
   */
  function isValidSentryDSN(dsn) {
    // DSN must be a non-empty string
    if (!dsn || typeof dsn !== 'string') {
      return false;
    }

    // Reject example/placeholder DSNs
    if (dsn.includes('examplePublicKey') || dsn.includes('exampleProjectId')) {
      return false;
    }

    // Validate DSN format: https://<key>@<host>.ingest.sentry.io/<projectId>
    const dsnPattern =
      /^https:\/\/[a-f0-9]+@[a-z0-9.-]+\.ingest\.sentry\.io\/[0-9]+$/;
    return dsnPattern.test(dsn);
  }

  // Verify Sentry SDK is loaded from CDN
  if (typeof Sentry === 'undefined') {
    logSystem.warn('Sentry SDK not loaded. Monitoring disabled.', CAT.INFRA);
    return;
  }

  function readDsn() {
    try {
      if (typeof globalThis.WIFIHACKX_SENTRY_DSN === 'string') {
        return globalThis.WIFIHACKX_SENTRY_DSN.trim();
      }
      const meta = document.querySelector('meta[name="SENTRY_DSN"]');
      if (meta && typeof meta.getAttribute === 'function') {
        const v = (meta.getAttribute('content') || '').trim();
        if (v) return v;
      }
    } catch (_e) {}
    return '';
  }

  const DSN =
    readDsn() ||
    'https://examplePublicKey@o0.ingest.sentry.io/exampleProjectId'; // Placeholder DSN
  const ENV =
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1'
      ? 'development'
      : 'production';

  // Validate DSN before initializing
  if (!isValidSentryDSN(DSN)) {
    logSystem.info(
      'Sentry monitoring disabled (Example DSN detected).',
      CAT.INFRA
    );
    return;
  }

  Sentry.init({
    dsn: DSN,
    environment: ENV,
    integrations: [Sentry.browserTracingIntegration(), Sentry.replayIntegration()],
    // Performance Monitoring
    tracesSampleRate: 1.0,
    // Session Replay
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,

    beforeSend(event, hint) {
      // ... (keep logic)
      const error = hint.originalException;
      if (error && error.message) {
        const ignoredErrors = [
          'extensions',
          'ResizeObserver',
          'top.location',
          'Non-Error promise rejection',
        ];
        if (ignoredErrors.some(msg => error.message.includes(msg))) {
          return null;
        }
      }
      return event;
    },
  });

  logSystem.info(`Sentry Initialized (${ENV})`, CAT.INIT);

  // Track Firebase Auth User via AppState (Unificado)
  if (window.AppState) {
    window.AppState.subscribe('user', user => {
      if (user && user.isAuthenticated) {
        Sentry.setUser({
          id: user.uid,
          email: user.email,
          username: user.displayName || 'Anonymous',
        });
        logSystem.debug('Sentry User Context Set (via AppState)', CAT.INFRA);
      } else {
        Sentry.setUser(null);
      }
    });
  } else {
    // Fallback
    firebase.auth().onAuthStateChanged(user => {
      if (user) {
        Sentry.setUser({
          id: user.uid,
          email: user.email,
          username: user.displayName || 'Anonymous',
        });
        logSystem.debug(
          'Sentry User Context Set (via Firebase Fallback)',
          CAT.INFRA
        );
      } else {
        Sentry.setUser(null);
      }
    });
  }
}

export function initSentry() {
  if (window.__SENTRY_INITED__) {
    return;
  }

  window.__SENTRY_INITED__ = true;
  setupSentryInit();
}

if (typeof window !== 'undefined' && !window.__SENTRY_NO_AUTO__) {
  initSentry();
}



