/**
 * modal-emergency-close.js
 * Emergency modal management - ESC key close and monitoring
 */

'use strict';

const debugLog = (...args) => {
  if (window.__WFX_DEBUG__ === true) {
    console.info(...args);
  }
};

function setupModalEmergencyClose() {
  // Guard pattern: Prevenir carga duplicada
  if (window.isScriptLoaded && window.isScriptLoaded('modal-emergency-close')) {
    debugLog('modal-emergency-close already loaded, skipping');
    return;
  }

  // Close all modals with ESC key
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' || e.key === 'Esc') {
      // Don't close announcement modals - they handle ESC themselves
      const announcementModal = document.querySelector('.announcement-modal');
      if (!announcementModal) {
        closeAllModals();
      }
    }
  });

  /**
   * Closes all visible modals (both static and dynamic)
   *
   * This function handles two types of modals:
   * - Static modals: Hidden with display='none' and aria-hidden='true'
   * - Dynamic modals: Removed from DOM completely
   *
   * Also restores header state (pointer-events and data-modal-open)
   *
   * @returns {number} Number of modals closed
   *
   * @example
   * // Close all modals manually
   * const count = window.closeAllModals();
   * debugLog(`Closed ${count} modals`);
   *
   * @example
   * // Called automatically on ESC key press
   * document.addEventListener('keydown', (e) => {
   *   if (e.key === 'Escape') {
   *     window.closeAllModals();
   *   }
   * });
   */
  window.closeAllModals = function () {
    if (window.ModalManager) {
      window.ModalManager.closeAll();
      return 1;
    }

    const staticModals = document.querySelectorAll('.modal');
    const dynamicModals = document.querySelectorAll('.modal-overlay');
    let closed = 0;

    staticModals.forEach(modal => {
      if (
        window.getComputedStyle(modal).display !== 'none' &&
        !modal.classList.contains('announcement-modal')
      ) {
        window.DOMUtils.setDisplay(modal, 'none');
        modal.setAttribute('aria-hidden', 'true');
        closed++;
      }
    });

    dynamicModals.forEach(modal => {
      if (!modal.classList.contains('announcement-modal')) {
        modal.remove();
        closed++;
      }
    });

    window.DOMUtils.lockBodyScroll(false);
    document.body.classList.remove('modal-open');

    return closed;
  };

  // Monitor unexpected modal opens (DISABLED to prevent infinite loops)
  // const observer = new MutationObserver((mutations) => {
  //   mutations.forEach((mutation) => {
  //     if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
  //       const modal = mutation.target;
  //       if (modal.classList.contains('modal') && window.getComputedStyle(modal).display === 'flex') {
  //         console.warn('⚠️ Modal opened:', modal.id);
  //       }
  //     }
  //   });
  // });

  // Initialize cleanup after DOM loads
  setTimeout(() => {
    const modals = document.querySelectorAll('.modal');
    let closedCount = 0;

    modals.forEach(modal => {
      // Close only visible modals on page load
      const computedStyle = window.getComputedStyle(modal);
      const isVisible = computedStyle.display !== 'none' && !modal.classList.contains('hidden');

      if (isVisible) {
        window.DOMUtils.setDisplay(modal, 'none');
        modal.setAttribute('aria-hidden', 'true');
        closedCount++;
      }

      // Observer disabled to prevent infinite loops
      // observer.observe(modal, { attributes: true, attributeFilter: ['style'] });
    });

    if (closedCount > 0) {
      debugLog(`🔒 Closed ${closedCount} open modal(s) on page load`);
    }
  }, 1000);

  // NOTE: Los cierres por click (botón X y backdrop) viven en modal-core.js.
  // Aquí mantenemos solo cierres de emergencia por teclado y utilidades globales.

  debugLog('✅ Modal Emergency Close initialized (Press ESC to close all modals)');

  // Crear fallback para DOMUtils.ModalManager si no existe
  if (typeof DOMUtils === 'undefined') {
    window.DOMUtils = {};
  }

  if (!DOMUtils.ModalManager) {
    DOMUtils.ModalManager = {
      hide: function (modalId) {
        debugLog(`🔄 DOMUtils.ModalManager.hide() fallback called for: ${modalId}`);
        const modal = document.getElementById(modalId);
        if (modal) {
          if (modal.classList.contains('modal-overlay')) {
            modal.remove();
          } else {
            window.DOMUtils.setDisplay(modal, 'none');
            modal.classList.remove('active');
            modal.setAttribute('aria-hidden', 'true');
          }

          // Restore header - LIMPIEZA COMPLETA
          const header = document.querySelector('header');
          const headerContent = document.querySelector('.header-content');
          if (header) {
            header.classList.remove('pointer-events-none');
            if (header.dataset.modalOpen) {
              delete header.dataset.modalOpen;
            }
          }
          if (headerContent) {
            headerContent.classList.remove('pointer-events-none');
          }

          // Restore body scroll y unlock
          if (typeof window.unlockScroll === 'function') {
            window.unlockScroll();
          } else {
            window.DOMUtils.lockBodyScroll(false);
            document.body.classList.remove('modal-open');
          }

          debugLog(`✅ Modal ${modalId} closed via fallback`);
        } else {
          console.warn(`⚠️ Modal ${modalId} not found`);
        }
      },
      show: function (modalId) {
        debugLog(`🔄 DOMUtils.ModalManager.show() fallback called for: ${modalId}`);
        const modal = document.getElementById(modalId);
        if (modal) {
          window.DOMUtils.setDisplay(modal, 'flex');
          modal.classList.add('active');
          modal.setAttribute('aria-hidden', 'false');
          debugLog(`✅ Modal ${modalId} opened via fallback`);
        } else {
          console.warn(`⚠️ Modal ${modalId} not found`);
        }
      },
    };
    debugLog('✅ DOMUtils.ModalManager fallback created');
  }

  // Marcar script como cargado
  if (window.markScriptLoaded) {
    window.markScriptLoaded('modal-emergency-close');
  }
}

export function initModalEmergencyClose() {
  if (window.__MODAL_EMERGENCY_CLOSE_INITED__) {
    return;
  }

  window.__MODAL_EMERGENCY_CLOSE_INITED__ = true;
  setupModalEmergencyClose();
}

if (typeof window !== 'undefined' && !window.__MODAL_EMERGENCY_CLOSE_NO_AUTO__) {
  initModalEmergencyClose();
}
