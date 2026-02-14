// UI module wrapper for legacy scripts.

import { initModalCore } from '../../modal-core.js';
import { initUiInteractions } from '../../ui-interactions.js';
import { initLucideInit } from '../../lucide-init.js';

let deferredUiInitialized = false;
const runIdle = fn => {
  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
    window.requestIdleCallback(fn, { timeout: 2000 });
  } else {
    setTimeout(fn, 700);
  }
};

export function initUiDeferred() {
  if (deferredUiInitialized) return;
  deferredUiInitialized = true;

  Promise.all([
    import('../../helpers.js?v=1.1'),
    import('../../modal-init-controller.js'),
    import('../../modal-emergency-close.js'),
    import('../../aria-landmarks.js'),
    import('../../high-contrast-toggle.js'),
    import('../../inline-accessibility.js'),
    import('../../cookie-consent.js'),
    import('../../ui/scanner-modal.js'),
    import('../../keyboard-shortcuts.js')
  ])
    .then(
      ([
        _helpers,
        modalInitController,
        modalEmergencyClose,
        ariaLandmarks,
        highContrastToggle,
        inlineAccessibility,
        cookieConsent,
        scannerModal,
        keyboardShortcuts
      ]) => {
        modalInitController.initModalInitController();
        modalEmergencyClose.initModalEmergencyClose();
        ariaLandmarks.initAriaLandmarks();
        highContrastToggle.initHighContrastToggle();
        inlineAccessibility.initInlineAccessibility();
        cookieConsent.initCookieConsent();
        scannerModal.initScannerModal();
        keyboardShortcuts.initKeyboardShortcuts();
      }
    )
    .catch(error => {
      console.error('[UiModule] Error cargando UI diferida:', error);
    });
}

export function initUi() {
  initModalCore();
  initUiInteractions();
  initLucideInit();
  runIdle(initUiDeferred);
}




