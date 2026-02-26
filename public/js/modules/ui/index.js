// UI module wrapper for legacy scripts.

import { initModalCore } from '../../modal-core.js';
import { initModalInitController } from '../../modal-init-controller.js';
import { initUiInteractions } from '../../ui-interactions.js';
import '../../helpers.js';
import { initModalEmergencyClose } from '../../modal-emergency-close.js';
import { initLucideInit } from '../../lucide-init.js';
import { initAriaLandmarks } from '../../aria-landmarks.js';
import { initHighContrastToggle } from '../../high-contrast-toggle.js';
import { initInlineAccessibility } from '../../inline-accessibility.js';
import { initCookieConsent } from '../../cookie-consent.js';
import { initScannerModal } from '../../ui/scanner-modal.js';
import { initKeyboardShortcuts } from '../../keyboard-shortcuts.js';
import { initMobileHeaderMenu } from '../../mobile-header-menu.js';

export function initUi() {
  initModalCore();
  initModalInitController();
  initUiInteractions();
  initModalEmergencyClose();
  initLucideInit();
  initAriaLandmarks();
  initHighContrastToggle();
  initInlineAccessibility();
  initCookieConsent();
  initScannerModal();
  initKeyboardShortcuts();
  initMobileHeaderMenu();
}
