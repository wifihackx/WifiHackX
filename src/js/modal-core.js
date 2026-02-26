/**
 * ModalManager Core - Sistema centralizado para el manejo de modales
 * Proporciona coherencia visual, accesibilidad y control de estado.
 */
'use strict';

function setupModalCore() {
  const FOCUSABLE_SELECTOR = [
    'a[href]',
    'button:not([disabled])',
    'textarea:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ].join(', ');
  const isNativeDialogElement = element =>
    typeof HTMLDialogElement !== 'undefined' && element instanceof HTMLDialogElement;

  window.ModalManager = {
    currentModal: null,
    trapHandler: null,
    lastFocusedElement: null,
    options: {
      onOpen: null,
      onClose: null,
    },

    getFocusableElements: function (modal) {
      if (!modal) return [];
      return Array.from(modal.querySelectorAll(FOCUSABLE_SELECTOR)).filter(element => {
        if (!element) return false;
        if (element.hidden) return false;
        if (element.getAttribute('aria-hidden') === 'true') return false;
        return true;
      });
    },

    activateFocusTrap: function (modal) {
      if (!modal) return;
      this.deactivateFocusTrap();

      this.trapHandler = event => {
        if (event.key !== 'Tab') return;
        const focusable = this.getFocusableElements(modal);
        if (focusable.length === 0) {
          event.preventDefault();
          modal.focus();
          return;
        }

        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const active = document.activeElement;

        if (event.shiftKey) {
          if (active === first || !modal.contains(active)) {
            event.preventDefault();
            last.focus();
          }
          return;
        }

        if (active === last || !modal.contains(active)) {
          event.preventDefault();
          first.focus();
        }
      };

      modal.addEventListener('keydown', this.trapHandler);
    },

    deactivateFocusTrap: function () {
      if (this.currentModal && this.trapHandler) {
        this.currentModal.removeEventListener('keydown', this.trapHandler);
      }
      this.trapHandler = null;
    },

    /**
     * Abre un modal por ID o referencia de elemento
     */
    open: function (modalIdOrElement, options = {}) {
      const modal =
        typeof modalIdOrElement === 'string'
          ? document.getElementById(modalIdOrElement)
          : modalIdOrElement;

      if (!modal) return;

      // Merge options
      const currentOptions = Object.assign({}, this.options, options);

      // Cerrar el actual si existe
      if (this.currentModal && this.currentModal !== modal) {
        this.close(this.currentModal);
      }

      this.lastFocusedElement = document.activeElement || null;

      // Mostrar modal
      // Asegurar que el modal no quede bloqueado por estado "hidden" previo.
      modal.hidden = false;
      modal.removeAttribute('hidden');
      modal.classList.remove('hidden');
      if (isNativeDialogElement(modal) && typeof modal.showModal === 'function') {
        if (!modal.open) {
          modal.showModal();
        }
      } else {
        window.DOMUtils.setDisplay(modal, 'flex');
      }
      modal.classList.add('modal-visible');
      modal.setAttribute('aria-hidden', 'false');
      window.DOMUtils.lockBodyScroll(true);
      this.currentModal = modal;

      // Call onOpen if exists
      if (typeof currentOptions.onOpen === 'function') {
        currentOptions.onOpen(modal);
      }

      // Dispatch custom event
      modal.dispatchEvent(
        new CustomEvent('modalOpened', {
          detail: {
            modal,
            options: currentOptions,
          },
        })
      );

      // Inicializar Lucide si es necesario
      if (window.DOMUtils && window.DOMUtils.initLucideIcons) {
        window.DOMUtils.initLucideIcons();
      }

      this.activateFocusTrap(modal);

      // Foco en el botón de cierre o primer input
      const closeBtn =
        modal.querySelector('.modal-close, .modal-close-x') || this.getFocusableElements(modal)[0];
      if (closeBtn) closeBtn.focus();
    },

    /**
     * Cierra un modal por ID o referencia de elemento
     */
    close: function (modalIdOrElement) {
      const modal =
        typeof modalIdOrElement === 'string'
          ? document.getElementById(modalIdOrElement)
          : modalIdOrElement;

      if (!modal) return;

      this.deactivateFocusTrap();
      if (isNativeDialogElement(modal) && typeof modal.close === 'function') {
        if (modal.open) {
          modal.close();
        }
      } else {
        window.DOMUtils.setDisplay(modal, 'none');
      }
      modal.classList.remove('modal-visible');
      modal.setAttribute('aria-hidden', 'true');

      if (this.currentModal === modal) {
        this.currentModal = null;
        window.DOMUtils.lockBodyScroll(false);
      }

      if (modal.id === 'accessibilityModal') {
        if (window.AppState && typeof window.AppState.setState === 'function') {
          window.AppState.setState('modal.active', null, true);
          window.AppState.setState('modal.data', null, true);
        }
        try {
          localStorage.removeItem('modal.active');
          localStorage.removeItem('modal.data');
        } catch (_e) {}
      }

      // Call onClose
      modal.dispatchEvent(
        new CustomEvent('modalClosed', {
          detail: {
            modal,
          },
        })
      );

      if (this.lastFocusedElement && typeof this.lastFocusedElement.focus === 'function') {
        this.lastFocusedElement.focus();
      }
      this.lastFocusedElement = null;
    },

    /**
     * Cierra todos los modales abiertos
     */
    closeAll: function () {
      document.querySelectorAll('.modal').forEach(m => this.close(m));
    },

    /**
     * Inicializa los listeners globales (Escape, clicks fuera)
     */
    init: function () {
      document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && this.currentModal) {
          this.close(this.currentModal);
        }
      });

      document.addEventListener('click', e => {
        if (e.target.classList.contains('modal')) {
          this.close(e.target);
          return;
        }

        // Delegación para botones de cierre
        const closeBtn = e.target.closest(
          '.modal-close, .modal-close-x, .modal-close-top, [data-action="closeModal"], [data-action="closeAccessibilityPanel"]'
        );
        if (closeBtn) {
          const modal = e.target.closest('.modal, .modal-overlay, .announcement-modal');
          if (modal) this.close(modal);
        }
      });

      console.info('✅ [ModalManager] Inicializado');
    },
  };

  // Auto-inicialización
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => window.ModalManager.init());
  } else {
    window.ModalManager.init();
  }
}

export function initModalCore() {
  if (window.__MODAL_CORE_INITED__) {
    return;
  }

  window.__MODAL_CORE_INITED__ = true;
  setupModalCore();
}

if (typeof window !== 'undefined' && !window.__MODAL_CORE_NO_AUTO__) {
  initModalCore();
}
