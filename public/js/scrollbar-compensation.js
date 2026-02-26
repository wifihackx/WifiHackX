/**
 * Scrollbar Compensation Utility
 * Previene que el header cambie de tamaño cuando se abren modales
 * al compensar el ancho de la barra de scroll
 */

'use strict';

const debugLog = (...args) => {
  if (window.__WFX_DEBUG__ === true) {
    console.info(...args);
  }
};

function setupScrollbarCompensation() {
  /**
   * Calcula el ancho de la barra de scroll
   * @returns {number} Ancho en píxeles
   */
  debugLog('🔄 Loading Scrollbar Compensation Override...');

  /**
   * Bloquea el scroll del body y compensa el ancho de la scrollbar
   */
  window.lockScroll = function () {
    document.body.classList.add('scroll-lock');
    debugLog('🔒 Scroll bloqueado (CSP)');
  };

  /**
   * Desbloquea el scroll del body y elimina la compensación
   */
  window.unlockScroll = function () {
    document.body.classList.remove('scroll-lock', 'modal-open');
    debugLog('🔓 Scroll desbloqueado (CSP)');
  };

  debugLog('✅ Scrollbar compensation utility loaded');
}

export function initScrollbarCompensation() {
  if (window.__SCROLLBAR_COMPENSATION_INITED__) {
    return;
  }

  window.__SCROLLBAR_COMPENSATION_INITED__ = true;
  setupScrollbarCompensation();
}

if (typeof window !== 'undefined' && !window.__SCROLLBAR_COMPENSATION_NO_AUTO__) {
  initScrollbarCompensation();
}
