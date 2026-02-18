/**
 * High Contrast Mode Toggle
 * Sistema de alto contraste integrado con el panel de accesibilidad
 */

'use strict';

const debugLog = (...args) => {
  if (window.__WFX_DEBUG__ === true) {
    console.info(...args);
  }
};

function setupHighContrastToggle() {

  const STORAGE_KEY = 'accessibilityContrast';

  /**
   * Verificar si el modo está activo
   */
  function isHighContrastActive() {
    const mode = localStorage.getItem(STORAGE_KEY) || 'normal';
    return mode === 'high-contrast' || mode === 'high-contrast-mode';
  }

  /**
   * Activar modo alto contraste
   */
  function enableHighContrast() {
    document.body.classList.add('high-contrast-mode');
    localStorage.setItem(STORAGE_KEY, 'high-contrast');
    debugLog('[HighContrast] Modo activado');

    // Disparar evento personalizado
    window.dispatchEvent(new CustomEvent('highcontrast:enabled'));
  }

  /**
   * Desactivar modo alto contraste
   */
  function disableHighContrast() {
    document.body.classList.remove('high-contrast-mode', 'high-contrast');
    localStorage.setItem(STORAGE_KEY, 'normal');
    debugLog('[HighContrast] Modo desactivado');

    // Disparar evento personalizado
    window.dispatchEvent(new CustomEvent('highcontrast:disabled'));
  }

  /**
   * Toggle modo alto contraste
   */
  function toggleHighContrast() {
    if (isHighContrastActive()) {
      disableHighContrast();
    } else {
      enableHighContrast();
    }
  }

  /**
   * Aplicar preferencia guardada
   */
  function applyStoredPreference() {
    if (isHighContrastActive()) {
      enableHighContrast();
    }
  }

  /**
   * Detectar preferencia del sistema
   */
  function detectSystemPreference() {
    const prefersHighContrast = window.matchMedia('(prefers-contrast: high)');

    if (prefersHighContrast.matches && !localStorage.getItem(STORAGE_KEY)) {
      debugLog('[HighContrast] Preferencia del sistema detectada');
      enableHighContrast();
    }

    // Escuchar cambios en la preferencia del sistema
    prefersHighContrast.addEventListener('change', e => {
      if (e.matches && !localStorage.getItem(STORAGE_KEY)) {
        enableHighContrast();
      }
    });
  }

  /**
   * Añadir atajo de teclado
   */
  function addKeyboardShortcut() {
    document.addEventListener('keydown', e => {
      // Ctrl + Alt + H: Toggle alto contraste
      if (e.ctrlKey && e.altKey && e.key === 'h') {
        e.preventDefault();
        toggleHighContrast();
      }
    });

    debugLog('[HighContrast] Atajo de teclado configurado (Ctrl+Alt+H)');
  }

  /**
   * Inicializar
   */
  function init() {
    applyStoredPreference();
    detectSystemPreference();
    addKeyboardShortcut();

    debugLog('[HighContrast] Sistema inicializado');
  }

  // Exponer API global
  window.HighContrast = {
    enable: enableHighContrast,
    disable: disableHighContrast,
    toggle: toggleHighContrast,
    isActive: isHighContrastActive,
  };

  // Inicializar cuando el DOM esté listo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  debugLog('[HighContrast] Módulo cargado');
}

function initHighContrastToggle() {
  if (window.__HIGH_CONTRAST_TOGGLE_INITED__) {
    return;
  }

  window.__HIGH_CONTRAST_TOGGLE_INITED__ = true;
  setupHighContrastToggle();
}

if (typeof window !== 'undefined' && !window.__HIGH_CONTRAST_TOGGLE_NO_AUTO__) {
  initHighContrastToggle();
}


