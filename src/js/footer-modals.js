/* global document */

/**
 * Footer Modals Manager
 * Maneja la apertura, cierre y carga de contenido de modales del footer
 *
 * @version 2.0.0
 * @author WifiHackX Team
 */

(function () {
  'use strict';

  const debugLog = (...args) => {
    if (window.__WFX_DEBUG__ === true) {
      console.info(...args);
    }
  };

  const FooterModals = {
    // Configuración de modales
    modals: {
      about: {
        id: 'universalFooterModal',
        contentId: 'universalFooterModalContent',
        file: 'about.html',
        link: 'a[href="about.html"]',
      },
      faq: {
        id: 'universalFooterModal',
        contentId: 'universalFooterModalContent',
        file: 'faq.html',
        link: 'a[href="faq.html"]',
      },
      privacy: {
        id: 'universalFooterModal',
        contentId: 'universalFooterModalContent',
        file: 'privacidad.html',
        link: 'a[href="privacidad.html"]',
      },
      terms: {
        id: 'universalFooterModal',
        contentId: 'universalFooterModalContent',
        file: 'terminos.html',
        link: 'a[href="terminos.html"]',
      },
    },

    // Modal actualmente abierto
    currentModal: null,

    /**
     * Inicializa los event listeners
     */
    init() {
      debugLog('[FooterModals] Inicializando (Modo Iframe)...');

      // Interceptar clics en enlaces del footer
      Object.keys(this.modals).forEach(key => {
        const config = this.modals[key];
        const links = document.querySelectorAll(config.link);

        if (links.length === 0) return;

        links.forEach(link => {
          link.addEventListener('click', e => {
            e.preventDefault();
            debugLog(`[FooterModals] Clic interceptado en: ${key}`);
            this.openModal(key);
          });
        });
      });

      // Event listeners para cerrar modales (botón X y overlay)
      document.addEventListener('click', e => {
        const closeButton = e.target.closest('[data-modal-close]');
        if (closeButton) {
          e.preventDefault();
          e.stopPropagation();
          const modalId = closeButton.getAttribute('data-modal-close');
          this.closeModal(modalId);
        }
      });

      // Cerrar con tecla Escape
      document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && this.currentModal) {
          this.closeModal(this.currentModal);
        }
      });

      // Recuperar estado de sessionStorage (Persistencia invisible)
      const savedModal = sessionStorage.getItem('footerModalOpen');

      if (savedModal && this.modals[savedModal]) {
        debugLog(
          `[FooterModals] Restaurando modal desde sesión: ${savedModal}`
        );
        setTimeout(() => {
          this.openModal(savedModal);
        }, 100);
      } else {
        debugLog('[FooterModals] No hay estado de modal guardado');
      }

      debugLog('[FooterModals] Inicializado correctamente');
    },

    /**
     * Abre un modal usando Iframe
     * @param {string} modalKey - Clave del modal (about, faq, privacy, terms)
     */
    openModal(modalKey) {
      const config = this.modals[modalKey];
      if (!config) return;

      debugLog(`[FooterModals] Abriendo modal con iframe: ${modalKey}`);

      // Cerrar modal anterior si existe
      if (this.currentModal) {
        this.closeModal(this.currentModal);
      }

      const modal = document.getElementById(config.id);
      const contentContainer = document.getElementById(config.contentId);

      if (!modal || !contentContainer) return;

      // SAFE: Clearing container before loading iframe
      contentContainer.innerHTML = '';

      // Crear Iframe
      const iframe = document.createElement('iframe');
      iframe.className = 'footer-modal-iframe';
      iframe.src = config.file;
      iframe.setAttribute('frameborder', '0');
      iframe.setAttribute('allow', 'autoplay; encrypted-media');
      iframe.setAttribute('title', `Contenido de ${modalKey}`);

      // Handler al cargar el iframe
      iframe.onload = () => {
        try {
          debugLog(`[FooterModals] Iframe cargado: ${config.file}`);
          const _iframeDoc =
            iframe.contentDocument || iframe.contentWindow.document;

          // Inyectar estilos para ocultar botones de "Volver" internos
          /* 
                              const style = iframeDoc.createElement('style');
                              style.textContent = `
                                  .back-link, .btn-back, .btn-floating-back, #floatingBackBtn {
                                      display: none !important;
                                  }
                              `;
                              iframeDoc.head.appendChild(style);
                              */

          // Foco para accesibilidad
          iframe.focus();
        } catch (e) {
          console.warn(
            '[FooterModals] Restricción CORS/Protocolo en iframe:',
            e
          );
        }
      };

      contentContainer.appendChild(iframe);

      // Mostrar modal usando ModalManager
      if (window.ModalManager) {
        window.ModalManager.open(modal, {
          onClose: () => {
            this.currentModal = null;
            sessionStorage.removeItem('footerModalOpen');
          },
        });
      } else {
        modal.classList.add('active');
        if (modal.showModal) modal.showModal();
        modal.setAttribute('aria-hidden', 'false');
        window.DOMUtils.lockBodyScroll(true);
      }

      this.currentModal = config.id;
      debugLog(`[FooterModals] Modal abierto exitosamente: ${modalKey}`);

      // Guardar estado en sessionStorage
      sessionStorage.setItem('footerModalOpen', modalKey);
    },

    /**
     * Cierra un modal
     * @param {string} modalId - ID del modal a cerrar
     * @param {boolean} updateHistory - Si se debe limpiar el hash (default: true)
     */
    closeModal(modalId, _updateHistory = true) {
      debugLog(`[FooterModals] Cerrando modal vía ModalManager: ${modalId}`);

      let modal;
      if (window.ModalManager) {
        window.ModalManager.close(modalId);
        modal = document.getElementById(modalId);
      } else {
        modal = document.getElementById(modalId);
        if (!modal) return;
        if (modal.close) modal.close();
        modal.classList.remove('active');
        modal.setAttribute('aria-hidden', 'true');
        window.DOMUtils.lockBodyScroll(false);
      }

      // Limpiar iframe tras cerrar
      const modalKey = Object.keys(this.modals).find(
        k => this.modals[k].id === modalId
      );
      if (modalKey && modal) {
        const contentId = this.modals[modalKey].contentId;
        const contentContainer = document.getElementById(contentId);
        if (contentContainer) {
          setTimeout(() => {
            if (!modal.classList.contains('active') && !modal.open) {
              // SAFE: Clearing container after modal close
              contentContainer.innerHTML = '';
            }
          }, 300);
        }
      }

      this.currentModal = null;

      debugLog(`[FooterModals] Modal cerrado exitosamente: ${modalId}`);

      // Limpiar estado
      sessionStorage.removeItem('footerModalOpen');
    },
  };

  // Inicializar cuando el DOM esté listo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      debugLog('[FooterModals] DOM cargado, inicializando...');
      FooterModals.init();
    });
  } else {
    debugLog(
      '[FooterModals] DOM ya cargado, inicializando inmediatamente...'
    );
    FooterModals.init();
  }

  // Exponer globalmente para debugging
  window.FooterModals = FooterModals;
  debugLog('[FooterModals] Modulo cargado y expuesto globalmente');
})();

