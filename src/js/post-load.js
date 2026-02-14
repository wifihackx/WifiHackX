/**
 * post-load.js
 * Lazy-load non-critical scripts after initial render
 */
(function () {
  'use strict';

  const SCRIPT_QUEUE = [
    'js/announcement-system.js?v=3.2.8',
    'js/navigation-helper.js',
    'js/module-initializer.js',
    'js/aria-landmarks.js',
    'js/high-contrast-toggle.js',
    'js/inline-accessibility.js',
    'js/sw-register.js',
    'js/footer-navigation.js',
    'js/lazy-loading.js',
    'js/system-integration.js',
  ];

  const loaded = new Set();

  function loadScript(src) {
    if (loaded.has(src)) return Promise.resolve();
    if (document.querySelector(`script[src="${src}"]`)) {
      loaded.add(src);
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.defer = true;
      const nonce = window.SECURITY_NONCE || window.NONCE;
      if (nonce) {
        script.nonce = nonce;
      }
      script.onload = () => {
        loaded.add(src);
        resolve();
      };
      script.onerror = () => reject(new Error(`Failed to load ${src}`));
      document.body.appendChild(script);
    });
  }

  function schedule(fn, timeout = 1200) {
    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(fn, { timeout });
    } else {
      setTimeout(fn, timeout);
    }
  }

  async function runQueue() {
    for (const src of SCRIPT_QUEUE) {
      try {
        await loadScript(src);
      } catch (_e) {}
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => schedule(runQueue, 800));
  } else {
    schedule(runQueue, 800);
  }
})();
