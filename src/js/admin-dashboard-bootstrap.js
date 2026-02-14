/**
 * Admin Dashboard - Bootstrap
 * Creates global instance and wiring.
 */

'use strict';

function setupAdminDashboardBootstrap() {

  const ctx = window.AdminDashboardContext;
  if (!ctx || !window.DashboardStatsManager) return;

  const { log, CAT } = ctx;

  if (
    window.markScriptLoaded &&
    !window.markScriptLoaded('admin-dashboard-bootstrap.js')
  ) {
    log.warn(
      'admin-dashboard-bootstrap.js ya fue cargado, saltando...',
      CAT.INIT
    );
    return;
  }

  window.dashboardStatsManager = new window.DashboardStatsManager();

  const setupInitialization = () => {
    const dashboardSection = document.getElementById('dashboardSection');
    if (dashboardSection) {
      const observer = new MutationObserver(mutations => {
        mutations.forEach(mutation => {
          if (
            mutation.type === 'attributes' &&
            mutation.attributeName === 'class'
          ) {
            const isActive = dashboardSection.classList.contains('active');
            if (
              isActive &&
              window.dashboardStatsManager &&
              !window.dashboardStatsManager.initialized
            ) {
              log.debug(
                'Dashboard activado, cargando estadísticas...',
                CAT.INIT
              );
              window.dashboardStatsManager.initialize();
            }
          }
        });
      });

      observer.observe(dashboardSection, {
        attributes: true,
        attributeFilter: ['class'],
      });

      if (dashboardSection.classList.contains('active')) {
        log.debug('Dashboard ya activo, inicializando estadísticas...', CAT.INIT);
        window.dashboardStatsManager.initialize();
      }
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupInitialization);
  } else {
    setupInitialization();
  }

  window.loadDashboardStats = function () {
    if (window.dashboardStatsManager) {
      return window.dashboardStatsManager.initRealTimeStats();
    }
    log.warn(
      'dashboardStatsManager no disponible para loadDashboardStats',
      CAT.INIT
    );
  };

  log.trace(
    'Dashboard Stats Manager script cargado y funciones expuestas',
    CAT.INIT
  );
}

export function initAdminDashboardBootstrap() {
  if (window.__ADMIN_DASHBOARD_BOOTSTRAP_INITED__) {
    return;
  }

  window.__ADMIN_DASHBOARD_BOOTSTRAP_INITED__ = true;
  setupAdminDashboardBootstrap();
}

if (typeof window !== 'undefined' && !window.__ADMIN_DASHBOARD_BOOTSTRAP_NO_AUTO__) {
  initAdminDashboardBootstrap();
}
