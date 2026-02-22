/**
 * ModalManager Core - Sistema centralizado para el manejo de modales
 * Proporciona coherencia visual, accesibilidad y control de estado.
 */
'use strict';

function setupModalCore() {
  window.ModalManager = {
    currentModal: null,
    options: {
      onOpen: null,
      onClose: null,
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

      // Mostrar modal
      window.DOMUtils.setDisplay(modal, 'flex');
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

      // Foco en el botón de cierre o primer input
      const closeBtn = modal.querySelector('.modal-close, button');
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

      window.DOMUtils.setDisplay(modal, 'none');
      modal.classList.remove('modal-visible');
      modal.setAttribute('aria-hidden', 'true');

      if (this.currentModal === modal) {
        this.currentModal = null;
        window.DOMUtils.lockBodyScroll(false);
      }

      // Call onClose
      modal.dispatchEvent(
        new CustomEvent('modalClosed', {
          detail: {
            modal,
          },
        })
      );
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
        }
      });

      // Delegación para botones de cierre
      document.addEventListener('click', e => {
        const closeBtn = e.target.closest(
          '.modal-close, .modal-close-x, [data-action="closeModal"]'
        );
        if (closeBtn) {
          const modal = e.target.closest(
            '.modal, .modal-overlay, .announcement-modal'
          );
          if (modal) this.close(modal);
        }
      });

      console.info('✅ [ModalManager] Inicializado');
    },
  };

  // Auto-inicialización
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () =>
      window.ModalManager.init()
    );
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



