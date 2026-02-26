/**
 * Admin Panel Initialization
 * Ensures admin panel content loads correctly
 */

'use strict';

const debugLog = (...args) => {
  if (window.__WFX_DEBUG__ === true) {
    console.info(...args);
  }
};

function setupAdminPanelInit() {
  debugLog('[AdminPanelInit] Initializing admin panel...');

  // Flag para prevenir inicializaciones múltiples
  let _isInitialized = false;

  // Wait for DOM and Firebase
  async function initAdminPanel() {
    // Prevenir inicializaciones duplicadas
    if (_isInitialized) {
      debugLog('[AdminPanelInit] ⚠️ Already initialized, skipping duplicate initialization');
      return;
    }

    _isInitialized = true;
    debugLog('[AdminPanelInit] 🚀 First initialization starting...');

    // Wait for Firebase
    if (window.FirebaseInitGuard) {
      await window.FirebaseInitGuard.waitForFirebase();
    }

    debugLog('[AdminPanelInit] Firebase ready, setting up admin panel...');

    // Solo asegurar el bundle de la sección activa para evitar
    // cargas duplicadas entre AdminLoader y AdminSectionInterceptor.
    try {
      if (window.AdminLoader && window.AdminLoader.ensureActiveBundle) {
        await window.AdminLoader.ensureActiveBundle({ skipAuthCheck: true });
      } else if (window.AdminLoader && window.AdminLoader.ensureBundle) {
        await window.AdminLoader.ensureBundle('dashboard', {
          skipAuthCheck: true,
        });
      }
    } catch (error) {
      console.warn('[AdminPanelInit] Active admin bundle failed to load', error);
    }

    if (
      window.dashboardStatsManager &&
      typeof window.dashboardStatsManager.initRealTimeStats === 'function' &&
      !window.dashboardStatsManager.realTimeInitialized
    ) {
      debugLog('[AdminPanelInit] Triggering dashboard realtime init (once)...');
      window.dashboardStatsManager.initRealTimeStats().catch(() => {});
    }

    debugLog('[AdminPanelInit] ✅ Admin panel initialized successfully');
  }

  // Listen for admin view activation - SOLO UNA VEZ
  function setupAdminViewListener() {
    const adminView = document.getElementById('adminView');
    if (!adminView) {
      console.warn('[AdminPanelInit] #adminView not found in DOM');
      return;
    }

    const tryInitializeFromView = observer => {
      if (!adminView.classList.contains('active')) return false;
      debugLog('[AdminPanelInit] Admin view activated, initializing...');
      initAdminPanel();
      if (observer) {
        observer.disconnect();
        debugLog('[AdminPanelInit] Observer disconnected after initialization');
      }
      return true;
    };

    // Si ya está activo, inicializar inmediatamente
    if (tryInitializeFromView()) return;

    // Usar MutationObserver PERO desconectarlo después de la primera inicialización
    const observer = new MutationObserver(mutations => {
      const classChanged = mutations.some(
        mutation => mutation.type === 'attributes' && mutation.attributeName === 'class'
      );
      if (classChanged) {
        tryInitializeFromView(observer);
      }
    });

    observer.observe(adminView, { attributes: true });
    debugLog('[AdminPanelInit] Observer configured (will disconnect after first init)');
  }

  // Start observing when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupAdminViewListener);
  } else {
    setupAdminViewListener();
  }
}

export function initAdminPanelInit() {
  if (window.__ADMIN_PANEL_INITED__) {
    return;
  }

  window.__ADMIN_PANEL_INITED__ = true;
  setupAdminPanelInit();
}

if (typeof window !== 'undefined' && !window.__ADMIN_PANEL_INIT_NO_AUTO__) {
  initAdminPanelInit();
}
