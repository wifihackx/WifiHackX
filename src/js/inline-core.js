const debugLog = (...args) => {
  if (window.__WFX_DEBUG__ === true) {
    console.info(...args);
  }
};

/**
 * Core Inline Logic - Sanitize, Firebase init
 */

// Sanitize HTML
globalThis.sanitizeHTML = function (input) {
  try {
    if (typeof input !== 'string') return '';

    if (globalThis.DOMPurify && typeof globalThis.DOMPurify.sanitize === 'function') {
      return globalThis.DOMPurify.sanitize(input, {
        USE_PROFILES: {
          html: true,
        },
        ALLOW_DATA_ATTR: true,
        ADD_ATTR: ['data-action', 'data-id', 'data-params'],
      });
    }

    return input;
  } catch (e) {
    console.warn('[sanitizeHTML] Error:', e);
    return '';
  }
};

// Firebase initialization (DISABLED: Now handled by firebase-init-modular.js)
/*
const initFirebase = function () {
...
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initFirebase);
} else {
  initFirebase();
}
*/

if (typeof firebase !== 'undefined' && firebase.performance) {
  firebase.performance();
  debugLog('[Core] Performance monitoring enabled');
}

globalThis.addEventListener('unhandledrejection', function (event) {
  if (event.reason && event.reason.message && event.reason.message.includes('security')) {
    console.error('[Core] Security error:', event.reason);
    if (globalThis.Sentry) {
      Sentry.captureException(event.reason, {
        tags: {
          category: 'security',
        },
      });
    }
  }
});

debugLog('[Core] Initialization complete');
