/**
 * Admin Panel Initialization
 * Ensures admin panel content loads correctly
 */

'use strict';

function setupAdminPanelInit() {

  console.log('[AdminPanelInit] Initializing admin panel...');

  // Flag para prevenir inicializaciones múltiples
  let _isInitialized = false;

  // Wait for DOM and Firebase
  async function initAdminPanel() {
    // Prevenir inicializaciones duplicadas
    if (_isInitialized) {
      console.log(
        '[AdminPanelInit] ⚠️ Already initialized, skipping duplicate initialization'
      );
      return;
    }

    _isInitialized = true;
    console.log('[AdminPanelInit] 🚀 First initialization starting...');

    // Wait for Firebase
    if (window.FirebaseInitGuard) {
      await window.FirebaseInitGuard.waitForFirebase();
    }

    console.log('[AdminPanelInit] Firebase ready, setting up admin panel...');

    // Initialize dashboard stats (lazy bundle)
    try {
      if (window.AdminLoader && window.AdminLoader.ensureBundle) {
        await window.AdminLoader.ensureBundle('dashboard');
      }
    } catch (error) {
      console.warn('[AdminPanelInit] Dashboard bundle failed to load', error);
    }

    if (typeof window.loadDashboardStats === 'function') {
      console.log('[AdminPanelInit] Loading dashboard stats...');
      window.loadDashboardStats();
    }

    // Initialize users manager
    // REMOVED: loadUsers() is now called only by admin-section-interceptor.js
    // when the users section is opened, preventing duplicate loads
    if (window.usersManager) {
      console.log(
        '[AdminPanelInit] Users manager ready (will load on section open)'
      );
    }

    console.log('[AdminPanelInit] ✅ Admin panel initialized successfully');
  }

  // Listen for admin view activation - SOLO UNA VEZ
  function setupAdminViewListener() {
    const adminView = document.getElementById('adminView');
    if (!adminView) {
      console.warn('[AdminPanelInit] #adminView not found in DOM');
      return;
    }

    // Si ya está activo, inicializar inmediatamente
    if (adminView.classList.contains('active')) {
      console.log(
        '[AdminPanelInit] Admin view already active, initializing...'
      );
      initAdminPanel();
      return;
    }

    // Usar MutationObserver PERO desconectarlo después de la primera inicialización
    const observer = new MutationObserver(mutations => {
      mutations.forEach(mutation => {
        if (
          mutation.type === 'attributes' &&
          mutation.attributeName === 'class'
        ) {
          const adminView = document.getElementById('adminView');
          if (adminView && adminView.classList.contains('active')) {
            console.log(
              '[AdminPanelInit] Admin view activated, initializing...'
            );
            initAdminPanel();
            // IMPORTANTE: Desconectar el observer después de la primera inicialización
            observer.disconnect();
            console.log(
              '[AdminPanelInit] Observer disconnected after initialization'
            );
          }
        }
      });
    });

    observer.observe(adminView, { attributes: true });
    console.log(
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
