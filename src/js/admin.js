/**
 * Admin JS - Lógica del panel de administración
 * Gestión de usuarios, productos, pedidos, anuncios
 */

'use strict';

function setupAdminUi() {

  // Referencias DOM
  const adminView = document.getElementById('adminView');

  /**
   * Muestra una sección específica del panel de administración
   * @param {string} sectionId - ID de la sección a mostrar (ej: 'dashboard', 'users')
   */
  function showAdminSection(sectionId) {
    console.log(`🔧 Mostrando sección: ${sectionId}`);

    // Normalizar ID (manejar tanto 'dashboard' como 'dashboardSection')
    const targetId = sectionId.endsWith('Section')
      ? sectionId
      : `${sectionId}Section`;
    const targetSection = document.getElementById(targetId);

    if (!targetSection) {
      console.error(`❌ Sección no encontrada: ${targetId}`);
      return;
    }

    console.log(`✅ Sección encontrada: ${targetId}`);

    // 1. Ocultar todas las secciones
    document.querySelectorAll('.admin-section').forEach(section => {
      section.classList.remove('active');
    });

    // 2. Desactivar todos los tabs
    document.querySelectorAll('.admin-nav-tab').forEach(tab => {
      tab.classList.remove('active');
      tab.setAttribute('aria-selected', 'false');
    });

    // 3. Mostrar sección objetivo
    targetSection.classList.add('active');

    // 4. Activar tab correspondiente
    const activeTab = document.querySelector(
      `.admin-nav-tab[data-params="${sectionId.replace('Section', '')}"]`
    );
    if (activeTab) {
      activeTab.classList.add('active');
      activeTab.setAttribute('aria-selected', 'true');
      console.log(`✅ Tab activado: ${sectionId.replace('Section', '')}`);
    } else {
      console.warn(
        `⚠️ Tab no encontrado para: ${sectionId.replace('Section', '')}`
      );
    }

    // 5. Guardar sección activa en localStorage para persistencia
    try {
      localStorage.setItem('adminActiveSection', sectionId);
      console.log(`💾 Sección guardada en localStorage: ${sectionId}`);
    } catch (error) {
      console.warn('⚠️ No se pudo guardar en localStorage:', error);
    }

    // 6. Trigger refresh based on section
    const sectionName = sectionId.replace('Section', '');
    if (sectionName === 'announcements') {
      // DISABLED: No llamar renderAll() automáticamente al cambiar de pestaña
      // Esto causaba renderizados duplicados. El admin-section-interceptor.js
      // ya maneja esto de forma más robusta con debouncing
      console.log(
        '🔄 Sección de anuncios activada (renderizado manejado por interceptor)'
      );
    } else if (sectionName === 'dashboard') {
      // Refresh dashboard data if controller exists
      if (window.AdminController) {
        // Trigger dashboard refresh check
      }
    }

    // Ensure bundles and section-specific refresh
    const ensureBundle = async () => {
      if (window.AdminLoader && typeof window.AdminLoader.ensureBundle === 'function') {
        await window.AdminLoader.ensureBundle(sectionName, { skipAuthCheck: true });
      }
    };

    const retry = (fn, attempts = 6, delay = 250) => {
      let tries = 0;
      const run = () => {
        tries += 1;
        if (fn()) return;
        if (tries < attempts) setTimeout(run, delay);
      };
      run();
    };

    ensureBundle()
      .then(() => {
        const hasInterceptor = window.__adminSectionInterceptorActive === true;
        if (sectionName === 'users') {
          if (hasInterceptor) return;
          retry(() => {
            if (window.usersManager && typeof window.usersManager.loadUsers === 'function') {
              if (window.usersManager._isLoadingUsers) return true;
              window.usersManager.loadUsers();
              return true;
            }
            return false;
          });
        } else if (sectionName === 'announcements') {
          if (hasInterceptor) return;
          retry(() => {
            if (
              window.adminAnnouncementsRenderer &&
              typeof window.adminAnnouncementsRenderer.renderAll === 'function'
            ) {
              window.adminAnnouncementsRenderer.renderAll();
              return true;
            }
            return false;
          });
        } else if (sectionName === 'settings') {
          if (hasInterceptor) return;
          if (window.SettingsCardsGenerator && window.SettingsCardsGenerator.render) {
            window.SettingsCardsGenerator.render();
          }
          retry(() => {
            if (window.SettingsController) {
              window.settingsController =
                window.settingsController || new window.SettingsController(null);
              if (window.settingsController && window.settingsController.load) {
                window.settingsController.load();
                return true;
              }
            }
            return false;
          });
        }
      })
      .catch(() => {});

    console.log(`📍 Navegando a sección: ${targetId}`);
  }

  // Exponer funciones globalmente
  window.showAdminSection = showAdminSection;
  // Inicialización
  function init() {
    console.log('🚀 Inicializando Admin UI...');

    // Registrar handler en EventDelegation si está disponible
    if (window.EventDelegation) {
      window.EventDelegation.registerHandler('showAdminSection', (el, ev) => {
        if (ev) ev.preventDefault();
        const section = el.dataset.params || el.getAttribute('data-params');
        if (section) showAdminSection(section);
      });
    }

    if (!adminView) {
      console.error('❌ Elemento #adminView no encontrado en el DOM');
    } else {
      console.log('✅ Elemento #adminView encontrado');
    }
    // Event listener delegado para navegación
    document.addEventListener('click', e => {
      // Navegación de secciones
      const sectionTarget = e.target.closest(
        '[data-action="showAdminSection"]'
      );
      if (sectionTarget) {
        e.preventDefault();
        const sectionParam = sectionTarget.getAttribute('data-params');
        console.log(`🖱️ Click en showAdminSection: ${sectionParam}`);
        if (sectionParam) {
          showAdminSection(sectionParam);
        }
      }
    });

    // Verificar estado inicial
    if (adminView && adminView.classList.contains('active')) {
      console.log('ℹ️ Admin view ya está activa, verificando secciones...');

      // Intentar restaurar sección guardada en localStorage
      let savedSection = null;
      try {
        savedSection = localStorage.getItem('adminActiveSection');
        console.log(`💾 Sección guardada encontrada: ${savedSection}`);
      } catch (error) {
        console.warn('⚠️ No se pudo leer localStorage:', error);
      }

      const activeSection = adminView.querySelector('.admin-section.active');
      if (activeSection) {
        console.log(`✅ Sección activa encontrada: ${activeSection.id}`);
      } else if (savedSection) {
        console.log(`🔄 Restaurando sección guardada: ${savedSection}`);
        showAdminSection(savedSection);
      } else {
        console.warn(
          '⚠️ No hay sección activa, mostrando dashboard por defecto'
        );
        showAdminSection('dashboard');
      }
    }

    console.log('✅ Admin UI Logic initialized');
  }

  // Ejecutar init cuando el DOM esté listo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}

export function initAdminUi() {
  if (window.__ADMIN_UI_INITED__) {
    return;
  }

  window.__ADMIN_UI_INITED__ = true;
  setupAdminUi();
}
