/**
 * Lucide Icon Initialization
 */
'use strict';

function setupLucideInit() {
  document.addEventListener('DOMContentLoaded', function () {
    if (
      globalThis.lucide &&
      typeof globalThis.lucide.createIcons === 'function'
    ) {
      globalThis.lucide.createIcons();
      console.info('[Lucide] Icons initialized');
    }
  });
}

function initLucideInit() {
  if (window.__LUCIDE_INIT_INITED__) {
    return;
  }

  window.__LUCIDE_INIT_INITED__ = true;
  setupLucideInit();
}

if (typeof window !== 'undefined' && !window.__LUCIDE_INIT_NO_AUTO__) {
  initLucideInit();
}


