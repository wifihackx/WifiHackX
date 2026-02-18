/**
 * Admin Panel Initialization
 * Ensures admin panel content loads correctly
 */

'use strict';

const debugLog = (...args) => {
  if (window.__WFX_DEBUG__ === true) {
    console.log(...args);
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
      debugLog(
        '[AdminPanelInit] ⚠️ Already initialized, skipping duplicate initialization'
      );
      return;
    }

    _isInitialized = true;
    debugLog('[AdminPanelInit] 🚀 First initialization starting...');

    // Wait for Firebase
    if (window.FirebaseInitGuard) {
      await window.FirebaseInitGuard.waitForFirebase();
    }

    debugLog('[AdminPanelInit] Firebase ready, setting up admin panel...');

    // Initialize dashboard stats (lazy bundle)
    try {
      if (window.AdminLoader && window.AdminLoader.ensureBundle) {
        await window.AdminLoader.ensureBundle('dashboard');
      }
    } catch (error) {
      console.warn('[AdminPanelInit] Dashboard bundle failed to load', error);
    }

    if (typeof window.loadDashboardStats === 'function') {
      debugLog('[AdminPanelInit] Loading dashboard stats...');
      window.loadDashboardStats();
    }

    // Initialize users manager
    // REMOVED: loadUsers() is now called only by admin-section-interceptor.js
    // when the users section is opened, preventing duplicate loads
    if (window.usersManager) {
      debugLog(
        '[AdminPanelInit] Users manager ready (will load on section open)'
      );
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
        mutation =>
          mutation.type === 'attributes' && mutation.attributeName === 'class'
      );
      if (classChanged) {
        tryInitializeFromView(observer);
      }
    });

    observer.observe(adminView, { attributes: true });
    debugLog(
      '[AdminPanelInit] Observer configured (will disconnect after first init)'
    );
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
