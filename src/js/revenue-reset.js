/**
 * Revenue Reset Manager
 * Maneja el reinicio de ingresos totales con confirmación doble
 * @version 1.0.0
 */

'use strict';

function setupRevenueResetManager() {

  /**
   * Muestra el modal de confirmación para reiniciar ingresos
   */
  function showResetConfirmationModal() {
    // Animaciones CSS movidas a estilos estáticos (CSP)

    // Crear overlay del modal
    const modalOverlay = document.createElement('div');
    modalOverlay.className =
      'modal-overlay revenue-reset-modal revenue-reset-overlay';

    // Crear contenedor del modal
    const modalContainer = document.createElement('div');
    modalContainer.className = 'modal-container revenue-reset-container';

    // Contenido del modal
    // SAFE: Internal template - static warning modal content
    modalContainer.innerHTML = `
            <div class="modal-header revenue-reset-header">
                <i data-lucide="alert-triangle" class="revenue-reset-icon" aria-hidden="true"></i>
                <h2 class="revenue-reset-title">
                    ⚠️ Advertencia Crítica
                </h2>
            </div>
            <div class="modal-body revenue-reset-body">
                <p class="revenue-reset-lead">
                    Estás a punto de <strong class="revenue-reset-emphasis">ELIMINAR PERMANENTEMENTE</strong> todos los registros de ingresos del sistema.
                </p>
                <div class="revenue-reset-warning-box">
                    <p class="revenue-reset-warning-title">Esta acción:</p>
                    <ul class="revenue-reset-list">
                        <li>Eliminará todos los pedidos completados</li>
                        <li>Reiniciará el contador de ingresos a $0.00</li>
                        <li>NO se puede deshacer</li>
                    </ul>
                </div>
                <div class="revenue-reset-confirm-row">
                    <label class="revenue-reset-confirm-label">
                        <input type="checkbox" id="confirmResetCheckbox" class="revenue-reset-checkbox">
                        <span class="revenue-reset-confirm-text">
                            Entiendo que esta acción es irreversible y elimina todos los datos de ingresos
                        </span>
                    </label>
                </div>
            </div>
            <div class="modal-footer revenue-reset-footer">
                <button class="cancel-btn revenue-reset-cancel-btn">
                    Cancelar
                </button>
                <button class="confirm-reset-btn revenue-reset-confirm-btn" disabled>
                    Sí, Eliminar Todo
                </button>
            </div>
        `;

    modalOverlay.appendChild(modalContainer);
    document.body.appendChild(modalOverlay);

    // Inicializar iconos de Lucide
    if (typeof lucide !== 'undefined' && lucide.createIcons) {
      lucide.createIcons();
    }

    // Referencias a elementos
    const checkbox = modalContainer.querySelector('#confirmResetCheckbox');
    const confirmBtn = modalContainer.querySelector('.confirm-reset-btn');
    const cancelBtn = modalContainer.querySelector('.cancel-btn');
    let authReady = false;
    let pendingConfirm = false;

    // Habilitar/deshabilitar botón de confirmación
    const updateConfirmState = () => {
      const enabled =
        checkbox.checked && confirmBtn.dataset.busy !== '1' && authReady;
      confirmBtn.disabled = !enabled;
    };

    checkbox.addEventListener('change', updateConfirmState);
    checkbox.addEventListener('input', updateConfirmState);
    updateConfirmState();

    const setAuthReady = value => {
      authReady = value === true;
      updateConfirmState();
      if (
        authReady &&
        pendingConfirm &&
        checkbox.checked &&
        confirmBtn.dataset.busy !== '1'
      ) {
        pendingConfirm = false;
        setTimeout(() => confirmBtn.click(), 0);
      }
    };

    // Esperar a que Firebase/Auth estén listos antes de permitir el reset
    const initAuthGate = () => {
      if (!window.firebase || !window.firebase.auth) {
        return;
      }
      try {
        const auth = window.firebase.auth();
        if (auth && auth.currentUser) {
          setAuthReady(true);
          return;
        }
        const unsubscribe = auth.onAuthStateChanged(user => {
          if (user) {
            if (unsubscribe) unsubscribe();
            setAuthReady(true);
          }
        });
      } catch (_e) {}
    };

    if (window.firebase && window.firebase.auth) {
      initAuthGate();
    } else {
      window.addEventListener('firebaseReady', initAuthGate, { once: true });
    }

    // Función para cerrar el modal
    const closeModal = () => {
      modalOverlay.classList.add('revenue-reset-fade-out');
      setTimeout(() => {
        if (modalOverlay.parentNode) {
          modalOverlay.parentNode.removeChild(modalOverlay);
        }
      }, 300);
    };

    // Evento de cancelar
    cancelBtn.addEventListener('click', closeModal);

    // Cerrar al hacer clic fuera del modal
    modalOverlay.addEventListener('click', e => {
      if (e.target === modalOverlay) {
        closeModal();
      }
    });

    // Cerrar con ESC
    const handleEsc = e => {
      if (e.key === 'Escape') {
        closeModal();
        document.removeEventListener('keydown', handleEsc);
      }
    };
    document.addEventListener('keydown', handleEsc);

    // Evento de confirmar
    if (confirmBtn) {
      confirmBtn.type = 'button';
    }
    confirmBtn.addEventListener('click', async e => {
      e.preventDefault();
      e.stopPropagation();
      if (!authReady) {
        pendingConfirm = true;
        if (
          window.NotificationSystem &&
          typeof window.NotificationSystem.info === 'function'
        ) {
          window.NotificationSystem.info(
            'Verificando autenticación, espera un momento...'
          );
        }
        initAuthGate();
        return;
      }
      if (!checkbox.checked) return;
      if (confirmBtn.disabled || confirmBtn.dataset.busy === '1') return;
      const wasChecked = checkbox.checked;
      confirmBtn.dataset.busy = '1';
      updateConfirmState();

      // Deshabilitar botón y mostrar loading
      confirmBtn.disabled = true;
      // SAFE: Static loading indicator HTML
      confirmBtn.innerHTML =
        '<i data-lucide="loader" class="spin" aria-hidden="true"></i> Procesando...';

      let success = false;
      const shouldRetry = error => {
        const msg = (error && error.message) || '';
        return (
          msg.includes('Firebase no está listo') ||
          msg.includes('Firebase no está disponible') ||
          msg.includes('No autenticado') ||
          msg.includes('Missing or insufficient permissions')
        );
      };

      try {
        try {
          await performRevenueReset();
        } catch (error) {
          if (shouldRetry(error)) {
            await new Promise(resolve => setTimeout(resolve, 500));
            await performRevenueReset();
          } else {
            throw error;
          }
        }
        success = true;

        // Mostrar éxito
        try {
          if (
            window.NotificationSystem &&
            typeof window.NotificationSystem.success === 'function'
          ) {
            window.NotificationSystem.success(
              'Ingresos reiniciados correctamente'
            );
          }
        } catch (_e) {}

        if (window.AdminActionAudit?.log) {
          window.AdminActionAudit.log(
            'revenue_reset',
            { scope: 'completed_orders_cleanup' },
            'warning'
          );
        }

        // Recargar estadísticas del dashboard
        if (window.dashboardStatsManager) {
          try {
            if (typeof window.dashboardStatsManager.realTimeUnsubscribe === 'function') {
              window.dashboardStatsManager.realTimeUnsubscribe();
            }
          } catch (_e) {}
          window.dashboardStatsManager.realTimeInitialized = false;
          if (typeof window.dashboardStatsManager.initRealTimeStats === 'function') {
            window.dashboardStatsManager.initRealTimeStats();
          }
        } else if (window.loadDashboardStats) {
          window.loadDashboardStats();
        }
      } catch (error) {
        if (window.NotificationSystem) {
          window.NotificationSystem.error(
            'Error al reiniciar ingresos: ' + error.message
          );
        }

        // Restaurar botón
        confirmBtn.disabled = false;
        confirmBtn.dataset.busy = '0';
        // SAFE: Static button text
        confirmBtn.innerHTML = 'Sí, Eliminar Todo';
      } finally {
        confirmBtn.dataset.busy = '0';
        if (success) {
          closeModal();
        } else {
          if (wasChecked) {
            checkbox.checked = true;
          }
          updateConfirmState();
        }
      }
    });
  }

  /**
   * Ejecuta el reinicio de ingresos en Firestore
   */
  async function performRevenueReset() {
    const waitForAuthReady = (auth, timeoutMs = 5000) =>
      new Promise((resolve, reject) => {
        if (!auth) {
          reject(new Error('Auth no disponible'));
          return;
        }
        if (auth.currentUser) {
          resolve(auth.currentUser);
          return;
        }
        const start = Date.now();
        const unsubscribe = auth.onAuthStateChanged(user => {
          if (user) {
            if (unsubscribe) unsubscribe();
            resolve(user);
          }
        });
        const check = () => {
          if (auth.currentUser) {
            if (unsubscribe) unsubscribe();
            resolve(auth.currentUser);
            return;
          }
          if (Date.now() - start >= timeoutMs) {
            if (unsubscribe) unsubscribe();
            reject(new Error('Auth no está listo'));
            return;
          }
          setTimeout(check, 100);
        };
        check();
      });

    const waitForFirebaseReady = (timeoutMs = 5000) =>
      new Promise((resolve, reject) => {
        const start = Date.now();
        const check = () => {
          if (
            window.firebase &&
            window.firebase.firestore &&
            window.firebase.apps &&
            window.firebase.apps.length > 0
          ) {
            resolve();
            return;
          }
          if (Date.now() - start >= timeoutMs) {
            reject(new Error('Firebase no está listo'));
            return;
          }
          setTimeout(check, 100);
        };
        check();
      });

    await waitForFirebaseReady();

    if (!window.firebase || !window.firebase.firestore) {
      throw new Error('Firebase no está disponible');
    }

    const auth = window.firebase.auth ? window.firebase.auth() : null;
    if (auth) {
      try {
        const user = await waitForAuthReady(auth);
        if (user && typeof user.getIdToken === 'function') {
          // Force token refresh to avoid first-call permission failures
          await user.getIdToken(true);
        }
        if (user && typeof user.reload === 'function') {
          await user.reload();
        }
      } catch (authError) {
        throw new Error('No autenticado');
      }
    }

    const db = window.firebase.firestore();

    // Obtener todos los pedidos completados
    const ordersSnapshot = await db
      .collection('orders')
      .where('status', '==', 'completed')
      .get();

    if (ordersSnapshot.size === 0) {
      return;
    }

    // Eliminar pedidos en lotes (Firestore tiene límite de 500 operaciones por batch)
    const batch = db.batch();
    let count = 0;

    ordersSnapshot.forEach(doc => {
      batch.delete(doc.ref);
      count++;
    });

    // Ejecutar el batch
    await batch.commit();

    // Registrar la acción en logs de admin si existe
    if (
      window.AdminDataManager &&
      typeof window.AdminDataManager.addActivity === 'function'
    ) {
      try {
        await window.AdminDataManager.addActivity(
          'revenue_reset',
          `Ingresos totales reiniciados - ${count} pedidos eliminados`,
          'critical'
        );
      } catch (error) {
        // No bloqueamos el flujo si falla el log de actividad
      }
    }
  }

  /**
   * Inicializar el sistema
   */
  function init() {
    // Registrar handler en EventDelegation si está disponible
    if (window.EventDelegation) {
      window.EventDelegation.registerHandler(
        'resetRevenue',
        (target, event) => {
          if (event) event.preventDefault();
      showResetConfirmationModal();
        }
      );
    }
  }

  // Inicializar cuando el DOM esté listo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Exportar para uso global
  window.RevenueResetManager = {
    showModal: showResetConfirmationModal,
    performReset: performRevenueReset,
  };
}

export function initRevenueResetManager() {
  if (window.__REVENUE_RESET_MANAGER_INITED__) {
    return;
  }

  window.__REVENUE_RESET_MANAGER_INITED__ = true;
  setupRevenueResetManager();
}

if (typeof window !== 'undefined' && !window.__REVENUE_RESET_MANAGER_NO_AUTO__) {
  initRevenueResetManager();
}
