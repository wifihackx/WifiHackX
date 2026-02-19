/**
 * Admin Dashboard - UI helpers
 */

'use strict';

function setupAdminDashboardUi() {

  const ctx = window.AdminDashboardContext;
  if (!ctx || !window.DashboardStatsManager) return;

  const { log, CAT } = ctx;
  const proto = window.DashboardStatsManager.prototype;

  proto.showAuthError = function () {
    const container = document.getElementById('dashboardStatsContainer');
    if (!container) return;

    const existingError = container.querySelector(
      '.stats-error, .stats-auth-error, .stats-permission-error'
    );
    if (existingError) existingError.remove();

    const errorMsg = document.createElement('div');
    errorMsg.className = 'stats-auth-error';
    errorMsg.innerHTML = `
      <i data-lucide="lock"></i>
      <p>Por favor, inicia sesión para ver las estadísticas del dashboard.</p>
    `;
    container.prepend(errorMsg);

    if (typeof lucide !== 'undefined' && lucide.createIcons) {
      lucide.createIcons();
    }
  };

  proto.showPermissionError = function () {
    const container = document.getElementById('dashboardStatsContainer');
    if (!container) return;

    const existingError = container.querySelector(
      '.stats-error, .stats-auth-error, .stats-permission-error'
    );
    if (existingError) existingError.remove();

    const errorMsg = document.createElement('div');
    errorMsg.className = 'stats-permission-error';
    errorMsg.innerHTML = `
      <i data-lucide="shield-alert"></i>
      <p>No tienes permisos para ver las estadísticas del dashboard.</p>
    `;
    container.prepend(errorMsg);

    if (typeof lucide !== 'undefined' && lucide.createIcons) {
      lucide.createIcons();
    }
  };

  proto.showLoadingState = function () {
    const container = document.getElementById('dashboardStatsContainer');
    if (!container) return;

    const existingError = container.querySelector(
      '.stats-error, .stats-auth-error, .stats-permission-error'
    );
    if (existingError) existingError.remove();

    const loadingMsg = document.createElement('div');
    loadingMsg.className = 'stats-loading';
    loadingMsg.innerHTML = `
      <i data-lucide="loader" class="spinning"></i>
      <p>Cargando estadísticas...</p>
    `;
    container.prepend(loadingMsg);

    if (typeof lucide !== 'undefined' && lucide.createIcons) {
      lucide.createIcons();
    }
  };

  proto.clearLoadingState = function () {
    const container = document.getElementById('dashboardStatsContainer');
    if (!container) return;
    const loading = container.querySelector('.stats-loading');
    if (loading) loading.remove();
  };

  proto.updateUsersCountUI = function (count) {
    this.updateStatCard('totalUsers', count);
  };

  proto.updateVisitsCountUI = function (count) {
    this.updateStatCard('totalVisits', count);
  };

  proto.updateOrdersCountUI = function (count) {
    this.updateStatCard('totalOrders', count);
  };

  proto.updateRevenueUI = function (revenue) {
    const revenueEl = document.getElementById('revenueAmount');
    if (revenueEl) {
      const startValue =
        parseFloat(revenueEl.textContent.replace(/[€,]/g, '')) || 0;
      this.animateValue(revenueEl, startValue, revenue, 1000, true);
    }
  };

  proto.updateProductsCountUI = function (count) {
    this.updateStatCard('totalProducts', count);
  };

  proto.updateStatCard = function (cardId, value) {
    const elementIds = {
      totalUsers: 'usersCount',
      totalVisits: 'visitsCount',
      totalProducts: 'productsCount',
      totalOrders: 'ordersCount',
    };

    const elementId = elementIds[cardId];
    const element = document.getElementById(elementId);

    if (element) {
      const startValue = parseInt(element.textContent.replace(/,/g, '')) || 0;
      this.animateValue(element, startValue, value, 1000);
    }
  };

  proto.animateValue = function (element, start, end, duration, isCurrency) {
    if (start === end) {
      element.textContent = isCurrency
        ? '€' + end.toFixed(2)
        : Math.round(end).toLocaleString('es-ES');
      return;
    }

    const range = end - start;
    let startTime = null;

    const step = timestamp => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const currentValue = start + range * progress;

      element.textContent = isCurrency
        ? '€' + currentValue.toFixed(2)
        : Math.round(currentValue).toLocaleString('es-ES');

      if (progress < 1) {
        window.requestAnimationFrame(step);
      }
    };

    window.requestAnimationFrame(step);
  };

  proto.updateStatsUI = function (stats) {
    const usersCountEl = document.getElementById('usersCount');
    if (usersCountEl) {
      usersCountEl.textContent = (stats.users || 0).toLocaleString('es-ES');
    }

    const usersChangeEl = document.getElementById('usersChange');
    if (usersChangeEl) {
      usersChangeEl.textContent =
        stats.users > 0
          ? `${stats.users} usuario${stats.users !== 1 ? 's' : ''} registrado${stats.users !== 1 ? 's' : ''}`
          : 'Sin usuarios';
      usersChangeEl.className =
        stats.users > 0 ? 'stat-change positive' : 'stat-change neutral';
    }

    const visitsCountEl = document.getElementById('visitsCount');
    if (visitsCountEl) {
      visitsCountEl.textContent = (stats.visits || 0).toLocaleString('es-ES');
    }

    const visitsChangeEl = document.getElementById('visitsChange');
    if (visitsChangeEl) {
      visitsChangeEl.textContent =
        stats.visits > 0
          ? `${stats.visits} visita${stats.visits !== 1 ? 's' : ''} registradas`
          : 'Sin visitas';
      visitsChangeEl.className =
        stats.visits > 0 ? 'stat-change positive' : 'stat-change neutral';
    }

    const productsCountEl = document.getElementById('productsCount');
    if (productsCountEl) {
      productsCountEl.textContent = (stats.products || 0).toLocaleString(
        'es-ES'
      );
    }

    const productsChangeEl = document.getElementById('productsChange');
    if (productsChangeEl) {
      productsChangeEl.textContent =
        stats.products > 0
          ? `${stats.products} producto${stats.products !== 1 ? 's' : ''} disponible${stats.products !== 1 ? 's' : ''}`
          : 'Sin productos';
      productsChangeEl.className =
        stats.products > 0 ? 'stat-change positive' : 'stat-change neutral';
    }

    const ordersCountEl = document.getElementById('ordersCount');
    if (ordersCountEl) {
      ordersCountEl.textContent = (stats.orders || 0).toLocaleString('es-ES');
    }

    const ordersChangeEl = document.getElementById('ordersChange');
    if (ordersChangeEl) {
      ordersChangeEl.textContent =
        stats.orders > 0
          ? `${stats.orders} pedido${stats.orders !== 1 ? 's' : ''} realizado${stats.orders !== 1 ? 's' : ''}`
          : 'Sin pedidos';
      ordersChangeEl.className =
        stats.orders > 0 ? 'stat-change positive' : 'stat-change neutral';
    }

    const revenueAmountEl = document.getElementById('revenueAmount');
    if (revenueAmountEl) {
      revenueAmountEl.textContent = `€${(stats.revenue || 0).toFixed(2)}`;
    }

    const paymentsStatusEl = document.getElementById('paymentsStatus');
    if (paymentsStatusEl) {
      paymentsStatusEl.textContent = stats.paymentsStatus || 'Sin datos';
    }

    const paymentsChangeEl = document.getElementById('paymentsChange');
    if (paymentsChangeEl) {
      paymentsChangeEl.textContent =
        stats.paymentsChange || 'Esperando señales';
      const statusClass =
        stats.paymentsStatus === 'Webhook OK'
          ? 'stat-change positive'
          : stats.paymentsStatus && stats.paymentsStatus.includes('antiguo')
            ? 'stat-change warning'
            : 'stat-change neutral';
      paymentsChangeEl.className = statusClass;

      const badge = this.getPaymentsBadge(stats.paymentsStatus);
      if (badge) {
        paymentsChangeEl.textContent = `${badge} ${paymentsChangeEl.textContent}`;
      }
    }

    const securityStatusEl = document.getElementById('securityStatus');
    if (securityStatusEl) {
      securityStatusEl.textContent = stats.securityStatus || 'Sin datos';
    }

    const securityChangeEl = document.getElementById('securityChange');
    if (securityChangeEl) {
      securityChangeEl.textContent =
        stats.securityChange || 'Estadísticas no disponibles';
      const severityClass =
        stats.securitySeverity === 'error'
          ? 'stat-change error'
          : stats.securitySeverity === 'warning'
            ? 'stat-change warning'
            : stats.securitySeverity === 'positive'
              ? 'stat-change positive'
              : 'stat-change neutral';
      securityChangeEl.className = severityClass;
    }

    const securityTopStatusEl = document.getElementById('securityTopStatus');
    if (securityTopStatusEl) {
      securityTopStatusEl.textContent = stats.securityTopStatus || 'Top acciones 7d';
    }

    const securityTopChangeEl = document.getElementById('securityTopChange');
    if (securityTopChangeEl) {
      securityTopChangeEl.textContent = stats.securityTopChange || 'Sin datos';
      const topSeverityClass =
        stats.securityTopSeverity === 'error'
          ? 'stat-change error'
          : stats.securityTopSeverity === 'warning'
            ? 'stat-change warning'
            : stats.securityTopSeverity === 'positive'
              ? 'stat-change positive'
              : 'stat-change neutral';
      securityTopChangeEl.className = topSeverityClass;
    }

    if (
      stats.users !== undefined &&
      stats.visits !== undefined &&
      stats.products !== undefined &&
      stats.orders !== undefined &&
      stats.revenue !== undefined
    ) {
      this.saveStatsToCache(stats);
      log.trace('UI de estadísticas actualizada y caché guardado', CAT.ADMIN);
    } else {
      log.trace(
        'UI de estadísticas actualizada (sin guardar caché - stats incompletos)',
        CAT.ADMIN
      );
    }
  };

  proto.getPaymentsBadge = function (status) {
    if (!status) return '';
    if (status === 'Webhook OK') return '[OK]';
    if (status.includes('antiguo')) return '[WARN]';
    if (status.includes('no detectado')) return '[ERR]';
    if (status.includes('Sin compras')) return '[NONE]';
    return '[INFO]';
  };

  proto.showPaymentsStatusLoading = function () {
    const paymentsChangeEl = document.getElementById('paymentsChange');
    if (paymentsChangeEl) {
      paymentsChangeEl.textContent = 'Actualizando...';
      paymentsChangeEl.className = 'stat-change neutral';
    }
    if (window.NotificationSystem) {
      window.NotificationSystem.info('Actualizando estado de pagos...');
    }
  };

  proto.showError = function (type, error) {
    const container = document.getElementById('dashboardStatsContainer');
    if (!container) return;

    const existingError = container.querySelector(
      '.stats-error, .stats-auth-error, .stats-permission-error'
    );
    if (existingError) existingError.remove();

    const errorMsg = document.createElement('div');
    errorMsg.className = 'stats-error';

    let message = 'Error al cargar estadísticas. Por favor, recarga la página.';

    if (type === 'firestore' && error) {
      log.error('Error de Firestore en Dashboard', CAT.FIREBASE, error);
      if (error.code === 'permission-denied') {
        message =
          'Error de permisos al cargar estadísticas. Verifica tu autenticación.';
      } else if (error.code === 'unavailable') {
        message =
          'Servicio temporalmente no disponible. Intenta de nuevo en unos momentos.';
      }
    } else if (type === 'network') {
      message = 'Error de conexión. Verifica tu conexión a internet.';
      log.error('Error de red en Dashboard', CAT.ADMIN, error);
    } else if (error) {
      log.error('Error general en Dashboard', CAT.ADMIN, error);
    }

    errorMsg.innerHTML = `
      <i data-lucide="alert-circle"></i>
      <p>${message}</p>
      <button class="refresh-stats-btn" onclick="window.dashboardStatsManager && window.dashboardStatsManager.refresh()">
        Reintentar
      </button>
    `;
    container.prepend(errorMsg);

    if (typeof lucide !== 'undefined' && lucide.createIcons) {
      lucide.createIcons();
    }
  };
}

export function initAdminDashboardUi() {
  if (window.__ADMIN_DASHBOARD_UI_INITED__) {
    return;
  }

  window.__ADMIN_DASHBOARD_UI_INITED__ = true;
  setupAdminDashboardUi();
}

if (typeof window !== 'undefined' && !window.__ADMIN_DASHBOARD_UI_NO_AUTO__) {
  initAdminDashboardUi();
}
