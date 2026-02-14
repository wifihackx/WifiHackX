/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🚨 BAN MODAL EMERGENCY GUARD - Prevención de Modal Fantasma
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Este script se ejecuta INMEDIATAMENTE al cargar la página para prevenir
 * que el modal de baneo aparezca incorrectamente en la página de inicio.
 *
 * DEBE cargarse ANTES de ban-system.js
 *
 * @version 1.0.0
 * ═══════════════════════════════════════════════════════════════════════════
 */

(function () {
  'use strict';

  console.log('[BAN GUARD] 🛡️ Inicializando guardia de emergencia...');

  /**
   * Forzar cierre de un modal por id
   */
  function forceCloseModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) {
      console.log('[BAN GUARD] Modal no encontrado en DOM (aún):', modalId);
      return false;
    }

    // Verificar si el modal está visible
    const computedStyle = window.getComputedStyle(modal);
    const isVisible = computedStyle.display !== 'none';

    if (isVisible) {
      console.log('[BAN GUARD] ⚠️ Modal visible detectado - CERRANDO:', modalId);

      // Forzar cierre removiendo la clase de mostrar y agregando hidden
      modal.classList.remove('show-banned-modal');
      modal.classList.add('hidden', 'modal-hidden');
      modal.setAttribute('aria-hidden', 'true');
      modal.setAttribute('hidden', '');
      modal.hidden = true;

      // Restaurar body
      if (window.DOMUtils && typeof window.DOMUtils.lockBodyScroll === 'function') {
        window.DOMUtils.lockBodyScroll(false);
      } else {
        document.body.classList.remove('overflow-hidden');
      }

      console.log('[BAN GUARD] ✅ Modal cerrado forzosamente:', modalId);
      return true;
    }

    return false;
  }

  /**
   * Verificar si hay un usuario autenticado
   */
  function isAuthenticated() {
    try {
      if (window.AppState && typeof window.AppState.getState === 'function') {
        return !!window.AppState.getState('user.isAuthenticated');
      }
      if (window.firebase && firebase.auth && firebase.auth().currentUser) {
        return true;
      }
    } catch (_e) {}
    return false;
  }

  /**
   * Obtener la vista activa actual (AppState o atributo del body)
   */
  function getCurrentView() {
    let currentView = document.body.getAttribute('data-current-view');
    try {
      if (window.AppState && typeof window.AppState.getState === 'function') {
        const appStateView = window.AppState.getState('view.current');
        if (appStateView) {
          currentView = appStateView;
        }
      }
    } catch (_e) {}
    return currentView;
  }

  /**
   * Verificar si estamos en una vista pública
   */
  function isPublicView() {
    const currentView = getCurrentView();
    return (
      currentView === 'homeView' ||
      currentView === 'loginView' ||
      !currentView
    );
  }

  /**
   * Verificar si estamos en vista de admin
   */
  function isAdminView() {
    const currentView = getCurrentView();
    if (currentView === 'adminView') return true;
    const adminView = document.getElementById('adminView');
    return !!(adminView && adminView.classList.contains('active'));
  }

  /**
   * Guardia principal
   */
  function runGuard() {
    const isAuth = isAuthenticated();
    const publicView = isPublicView();
    const adminView = isAdminView();

    // Si el usuario ya está autenticado pero sigue en la vista pública (login)
    if (isAuth && publicView) {
      console.log(
        '[BAN GUARD] Usuario autenticado pero aún en vista pública, saltando guardia'
      );
      return;
    }

    // Para el modal de usuario baneado: bloquear si no autenticado o vista pública
    if (isAuth && !publicView) {
      console.log('[BAN GUARD] Usuario autenticado y vista privada, omitiendo');
    } else {
      console.log(
        '[BAN GUARD] Vista pública o sin autenticación - activando guardia'
      );
      forceCloseModal('bannedUserModal');
    }

    // Para el modal de banear usuario: solo permitir en adminView
    if (!adminView) {
      forceCloseModal('banReasonModal');
    }

    // Observar cambios en el DOM para detectar si el modal intenta abrirse
    const observer = new MutationObserver(mutations => {
      mutations.forEach(mutation => {
        if (mutation.type === 'attributes') {
          const authNow = isAuthenticated();
          const publicNow = isPublicView();
          const adminNow = isAdminView();
          const element = mutation.target;

          // Si es el modal de usuario baneado y está intentando mostrarse
          if (element.id === 'bannedUserModal') {
            if (authNow && !publicNow) {
              return;
            }
            // Verificar si tiene la clase show-banned-modal o si está visible
            const hasShowClass =
              element.classList.contains('show-banned-modal');
            const computedStyle = window.getComputedStyle(element);
            const isVisible = computedStyle.display !== 'none';

            if (hasShowClass || isVisible) {
              console.log(
                '[BAN GUARD] ⚠️ Modal intentando abrirse - BLOQUEANDO'
              );
              forceCloseModal('bannedUserModal');
            }
          }

          // Si es el modal de banear usuario y no estamos en adminView
          if (element.id === 'banReasonModal' && !adminNow) {
            const computedStyle = window.getComputedStyle(element);
            const isVisible = computedStyle.display !== 'none';
            if (isVisible || !element.hasAttribute('hidden')) {
              console.log(
                '[BAN GUARD] ⚠️ Ban modal fuera de adminView - BLOQUEANDO'
              );
              forceCloseModal('banReasonModal');
            }
          }
        }
      });
    });

    // Esperar a que el modal exista en el DOM
    const checkModal = setInterval(() => {
      const bannedModal = document.getElementById('bannedUserModal');
      const banReasonModal = document.getElementById('banReasonModal');
      if (bannedModal || banReasonModal) {
        console.log('[BAN GUARD] Modal encontrado - iniciando observador');
        clearInterval(checkModal);

        // Forzar cierre inicial
        forceCloseModal('bannedUserModal');
        forceCloseModal('banReasonModal');

        // Observar cambios
        if (bannedModal) {
          observer.observe(bannedModal, {
            attributes: true,
            attributeFilter: ['style', 'class', 'aria-hidden', 'hidden'],
          });
        }
        if (banReasonModal) {
          observer.observe(banReasonModal, {
            attributes: true,
            attributeFilter: ['style', 'class', 'aria-hidden', 'hidden'],
          });
        }

        console.log('[BAN GUARD] ✅ Guardia activada correctamente');
      }
    }, 100);

    // Timeout de seguridad (dejar de buscar después de 5 segundos)
    setTimeout(() => {
      clearInterval(checkModal);
      console.log('[BAN GUARD] Timeout alcanzado - finalizando búsqueda');
    }, 5000);
  }

  // Ejecutar inmediatamente
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', runGuard);
  } else {
    runGuard();
  }

  // Ejecutar también después de 100ms por seguridad
  setTimeout(runGuard, 100);

  // Exportar función global para uso manual
  window.closeBannedModalEmergency = () => forceCloseModal('bannedUserModal');
  console.log(
    '[BAN GUARD] Función exportada: window.closeBannedModalEmergency()'
  );
})();
