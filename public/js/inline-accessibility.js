/**
 * Inline Accessibility - Mejoras de accesibilidad rápidas
 */
'use strict';

function setupInlineAccessibility() {

  async function initAccessibility() {
    // Estilos de focus-visible movidos a CSS estático (CSP)
    console.log('[Accessibility] Inline checks loaded');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAccessibility);
  } else {
    initAccessibility();
  }
}

function initInlineAccessibility() {
  if (window.__INLINE_ACCESSIBILITY_INITED__) {
    return;
  }

  window.__INLINE_ACCESSIBILITY_INITED__ = true;
  setupInlineAccessibility();
}

if (typeof window !== 'undefined' && !window.__INLINE_ACCESSIBILITY_NO_AUTO__) {
  initInlineAccessibility();
}

