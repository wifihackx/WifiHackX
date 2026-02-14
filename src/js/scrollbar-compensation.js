/**
 * Scrollbar Compensation Utility
 * Previene que el header cambie de tamaño cuando se abren modales
 * al compensar el ancho de la barra de scroll
 */

'use strict';

function setupScrollbarCompensation() {

  /**
   * Calcula el ancho de la barra de scroll
   * @returns {number} Ancho en píxeles
   */
  console.log('🔄 Loading Scrollbar Compensation Override...');

  function getScrollbarWidth() {
    return 0;
  }

  /**
   * Bloquea el scroll del body y compensa el ancho de la scrollbar
   */
  window.lockScroll = function () {
    document.body.classList.add('scroll-lock');
    console.log('🔒 Scroll bloqueado (CSP)');
  };

  /**
   * Desbloquea el scroll del body y elimina la compensación
   */
  window.unlockScroll = function () {
    document.body.classList.remove('scroll-lock', 'modal-open');
    console.log('🔓 Scroll desbloqueado (CSP)');
  };

  console.log('✅ Scrollbar compensation utility loaded');
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
