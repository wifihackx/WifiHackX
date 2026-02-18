/**
 * Admin Dashboard shim
 * This file keeps compatibility with older loaders.
 */

(function () {
  'use strict';

  if (window.dashboardStatsManager || window.DashboardStatsManager) {
    return;
  }

  const sources = [
    'js/admin-dashboard-core.js',
    'js/admin-dashboard-ui.js',
    'js/admin-dashboard-data.js',
    'js/admin-dashboard-bootstrap.js',
  ];

  const loadScript = src =>
    new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.defer = true;
      const nonce = window.SECURITY_NONCE || window.NONCE;
      if (nonce) script.nonce = nonce;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Failed to load ${src}`));
      document.head.appendChild(script);
    });

  (async () => {
    for (const src of sources) {
      await loadScript(src);
    }
  })().catch(err => {
    if (window.Logger && window.Logger.error) {
      window.Logger.error('Admin dashboard shim failed', 'ADMIN', err);
    } else {
      console.error('Admin dashboard shim failed', err);
    }
  });
})();
