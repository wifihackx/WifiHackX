/**
 * Admin JS - Lógica del panel de administración
 * Gestión de usuarios, productos, pedidos, anuncios
 */

'use strict';

const debugLog = (...args) => {
  if (window.__WIFIHACKX_DEBUG__ === true) {
    console.info(...args);
  }
};

function setupAdminUi() {

  // Referencias DOM
  const adminView = document.getElementById('adminView');
  let sectionClickHandlerRegistered = false;

  function deactivateAllSections() {
    document.querySelectorAll('.admin-section').forEach(section => {
      section.classList.remove('active');
    });
  }

  function deactivateAllTabs() {
    document.querySelectorAll('.admin-nav-tab').forEach(tab => {
      tab.classList.remove('active');
      tab.setAttribute('aria-selected', 'false');
    });
  }

  function activateSectionAndTab(targetSection, sectionName) {
    targetSection.classList.add('active');
    const activeTab = document.querySelector(
      `.admin-nav-tab[data-params="${sectionName}"]`
    );
    if (activeTab) {
      activeTab.classList.add('active');
      activeTab.setAttribute('aria-selected', 'true');
      debugLog(`✅ Tab activado: ${sectionName}`);
    } else {
      console.warn(`⚠️ Tab no encontrado para: ${sectionName}`);
    }
  }

  function persistActiveSection(sectionId) {
    try {
      localStorage.setItem('adminActiveSection', sectionId);
      debugLog(`💾 Sección guardada en localStorage: ${sectionId}`);
    } catch (error) {
      console.warn('⚠️ No se pudo guardar en localStorage:', error);
    }
  }

  async function ensureSectionBundle(sectionName) {
    if (window.AdminLoader && typeof window.AdminLoader.ensureBundle === 'function') {
      await window.AdminLoader.ensureBundle(sectionName, { skipAuthCheck: true });
    }
  }

  function retry(fn, attempts = 6, delay = 250) {
    let tries = 0;
    const run = () => {
      tries += 1;
      if (fn()) return;
      if (tries < attempts) setTimeout(run, delay);
    };
    run();
  }

  function refreshSectionContent(sectionName) {
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
      return;
    }

    if (sectionName === 'announcements') {
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
      return;
    }

    if (sectionName === 'settings') {
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
  }

  /**
   * Muestra una sección específica del panel de administración
   * @param {string} sectionId - ID de la sección a mostrar (ej: 'dashboard', 'users')
   */
  function showAdminSection(sectionId) {
    debugLog(`🔧 Mostrando sección: ${sectionId}`);

    // Normalizar ID (manejar tanto 'dashboard' como 'dashboardSection')
    const targetId = sectionId.endsWith('Section')
      ? sectionId
      : `${sectionId}Section`;
    const targetSection = document.getElementById(targetId);

    if (!targetSection) {
      console.error(`❌ Sección no encontrada: ${targetId}`);
      return;
    }

    debugLog(`✅ Sección encontrada: ${targetId}`);
    const sectionName = sectionId.replace('Section', '');

    deactivateAllSections();
    deactivateAllTabs();
    activateSectionAndTab(targetSection, sectionName);
    persistActiveSection(sectionId);

    // 6. Trigger refresh based on section
    if (sectionName === 'announcements') {
      // DISABLED: No llamar renderAll() automáticamente al cambiar de pestaña
      // Esto causaba renderizados duplicados. El admin-section-interceptor.js
      // ya maneja esto de forma más robusta con debouncing
      debugLog(
        '🔄 Sección de anuncios activada (renderizado manejado por interceptor)'
      );
    } else if (sectionName === 'dashboard') {
      // Refresh dashboard data if controller exists
      if (window.AdminController) {
        // Trigger dashboard refresh check
      }
    }

    ensureSectionBundle(sectionName)
      .then(() => {
        refreshSectionContent(sectionName);
      })
      .catch(() => {});

    debugLog(`📍 Navegando a sección: ${targetId}`);
  }

  // Exponer funciones globalmente
  window.showAdminSection = showAdminSection;
  // Inicialización
  function init() {
    debugLog('🚀 Inicializando Admin UI...');

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
      debugLog('✅ Elemento #adminView encontrado');
    }
    // Fallback delegado solo si EventDelegation no está disponible.
    // Evita doble ejecución cuando ambos sistemas están activos.
    if (!window.EventDelegation && !sectionClickHandlerRegistered) {
      document.addEventListener('click', e => {
        const sectionTarget = e.target.closest(
          '[data-action="showAdminSection"]'
        );
        if (!sectionTarget) return;
        e.preventDefault();
        const sectionParam = sectionTarget.getAttribute('data-params');
        debugLog(`🖱️ Click en showAdminSection: ${sectionParam}`);
        if (sectionParam) {
          showAdminSection(sectionParam);
        }
      });
      sectionClickHandlerRegistered = true;
    }

    // Verificar estado inicial
    if (adminView && adminView.classList.contains('active')) {
      debugLog('ℹ️ Admin view ya está activa, verificando secciones...');

      // Intentar restaurar sección guardada en localStorage
      let savedSection = null;
      try {
        savedSection = localStorage.getItem('adminActiveSection');
        debugLog(`💾 Sección guardada encontrada: ${savedSection}`);
      } catch (error) {
        console.warn('⚠️ No se pudo leer localStorage:', error);
      }

      const activeSection = adminView.querySelector('.admin-section.active');
      const normalizedSavedSectionId = savedSection
        ? savedSection.endsWith('Section')
          ? savedSection
          : `${savedSection}Section`
        : null;

      if (savedSection && normalizedSavedSectionId) {
        if (!activeSection || activeSection.id !== normalizedSavedSectionId) {
          debugLog(`🔄 Restaurando sección guardada: ${savedSection}`);
          showAdminSection(savedSection);
        } else {
          debugLog(`✅ Sección activa encontrada: ${activeSection.id}`);
        }
      } else if (activeSection) {
        debugLog(`✅ Sección activa encontrada: ${activeSection.id}`);
      } else {
        console.warn(
          '⚠️ No hay sección activa, mostrando dashboard por defecto'
        );
        showAdminSection('dashboard');
      }
    }

    debugLog('✅ Admin UI Logic initialized');
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

