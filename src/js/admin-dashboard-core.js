/**
 * Admin Dashboard - Core
 * Define DashboardStatsManager and core lifecycle methods.
 */

'use strict';

function setupAdminDashboardCore() {

  const { setState, subscribe, getState } = window.AppState || {};
  const log = window.Logger;
  const CAT = {
    ADMIN: 'ADMIN',
    AUTH: 'AUTH',
    FIREBASE: 'FIREBASE',
    INIT: 'INIT',
    ERR: 'ERR',
  };

  const getAdminAllowlist = async () => {
    if (window.AdminSettingsService?.getAllowlist) {
      return window.AdminSettingsService.getAllowlist({ allowDefault: false });
    }
    const emails = (window.AdminSettingsCache?.security?.adminAllowlistEmails || '')
      .split(',')
      .map(item => item.trim().toLowerCase())
      .filter(Boolean);
    const uids = (window.AdminSettingsCache?.security?.adminAllowlistUids || '')
      .split(',')
      .map(item => item.trim())
      .filter(Boolean);
    return { emails, uids };
  };

  if (!setState || !subscribe) {
    if (log && log.error) {
      log.error(
        'AppState not found. Make sure core/app-state.js is loaded.',
        CAT.INIT
      );
    }
    return;
  }

  if (
    window.markScriptLoaded &&
    !window.markScriptLoaded('admin-dashboard-core.js')
  ) {
    if (log && log.warn) {
      log.warn('admin-dashboard-core.js ya fue cargado, saltando...', CAT.INIT);
    }
    return;
  }

  window.AdminDashboardContext = {
    log,
    CAT,
    setState,
    subscribe,
    getState,
  };

  class DashboardStatsManager {
    constructor() {
      this.db = null;
      this.auth = null;
      this.initialized = false;
      this.authUnsubscribe = null;
      this.statsUnsubscribe = null;
      this.usersListener = null;
      this.realTimeInitialized = false;
    }

    getDefaultStats() {
      return {
        users: 0,
        visits: 0,
        products: 0,
        orders: 0,
        revenue: 0,
        paymentsStatus: 'Sin datos',
        paymentsChange: 'Esperando señales',
        lastOrderAt: null,
        lastWebhookAt: null,
        lastUpdated: new Date().toISOString(),
      };
    }

    validateStats(stats) {
      const defaults = this.getDefaultStats();
      return {
        users: typeof stats.users === 'number' ? stats.users : defaults.users,
        visits:
          typeof stats.visits === 'number' ? stats.visits : defaults.visits,
        products:
          typeof stats.products === 'number'
            ? stats.products
            : defaults.products,
        orders:
          typeof stats.orders === 'number' ? stats.orders : defaults.orders,
        revenue:
          typeof stats.revenue === 'number' ? stats.revenue : defaults.revenue,
        paymentsStatus: stats.paymentsStatus || defaults.paymentsStatus,
        paymentsChange: stats.paymentsChange || defaults.paymentsChange,
        lastOrderAt: stats.lastOrderAt || defaults.lastOrderAt,
        lastWebhookAt: stats.lastWebhookAt || defaults.lastWebhookAt,
        lastUpdated: stats.lastUpdated || defaults.lastUpdated,
      };
    }

    updateStatsCache(updates) {
      const currentStats = getState('admin.stats') || this.getDefaultStats();
      const updatedStats = {
        ...currentStats,
        ...updates,
        lastUpdated: new Date().toISOString(),
      };
      const validatedStats = this.validateStats(updatedStats);
      setState('admin.stats', validatedStats);
      this.saveStatsToCache(validatedStats);
      log.trace('Stats cache updated', CAT.ADMIN, validatedStats);
    }

    async waitForAuth() {
      return new Promise(resolve => {
        const currentUser = this.auth.currentUser;
        if (currentUser) {
          log.debug(`Usuario ya autenticado: ${currentUser.email}`, CAT.AUTH);
          resolve(currentUser);
          return;
        }

        const unsubscribe = this.auth.onAuthStateChanged(user => {
          log.info(
            `Estado de autenticación determinado: ${user ? user.email : 'No autenticado'}`,
            CAT.AUTH
          );
          unsubscribe();
          resolve(user);
        });
      });
    }

    getCurrentUserInfo() {
      const user = this.auth.currentUser;
      if (!user) return null;

      return {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
      };
    }

    async checkAdminStatus() {
      const user = this.auth.currentUser;
      if (!user) {
        log.warn(
          'No hay usuario autenticado al verificar permisos admin',
          CAT.AUTH
        );
        return false;
      }

      if (
        window.AppState &&
        window.AppState.state &&
        window.AppState.state.user &&
        window.AppState.state.user.isAdmin
      ) {
        log.debug(
          `Usuario es administrador (vía AppState): ${user.email}`,
          CAT.AUTH
        );
        return true;
      }

      try {
        const allowlist = await getAdminAllowlist();
        let isAdmin = false;
        if (window.AdminClaimsService?.isAdmin) {
          isAdmin = await window.AdminClaimsService.isAdmin(user, allowlist);
        } else {
          const claims = window.getAdminClaims
            ? await window.getAdminClaims(user, false)
            : (await user.getIdTokenResult(true)).claims;
          isAdmin =
            !!claims?.admin ||
            claims?.role === 'admin' ||
            claims?.role === 'super_admin';
          if (!isAdmin) {
            if (allowlist.emails.length && user.email) {
              if (allowlist.emails.includes(user.email.toLowerCase())) {
                return true;
              }
            }
            if (allowlist.uids.length && allowlist.uids.includes(user.uid)) {
              return true;
            }
          }
        }
        if (isAdmin) {
          log.debug(
            `Usuario es administrador (vía Claims): ${user.email}`,
            CAT.AUTH
          );
        } else {
          log.warn(
            `Usuario no es administrador (Claims faltantes): ${user.email}`,
            CAT.AUTH
          );
        }
        return isAdmin;
      } catch (error) {
        log.error('Error verificando claims de admin', CAT.AUTH, error);
        const allowlist = await getAdminAllowlist();
        return (
          (!!user.email &&
            allowlist.emails.includes(user.email.toLowerCase())) ||
          allowlist.uids.includes(user.uid)
        );
      }
    }

    async handleAuthStateChange(user) {
      log.trace(
        `Cambio en estado de autenticación: ${user ? user.email : 'No autenticado'}`,
        CAT.AUTH
      );

      if (!user) {
        log.info(
          'Usuario no autenticado, limpiando estadísticas...',
          CAT.ADMIN
        );
        this.clearStats();
        this.showAuthError();
        return;
      }

      const isAdmin = await this.checkAdminStatus();
      if (!isAdmin) {
        log.warn('Usuario no tiene permisos de administrador', CAT.ADMIN);
        this.clearStats();
        this.showPermissionError();
        return;
      }

      log.info(
        'Usuario admin autenticado, cargando estadísticas...',
        CAT.ADMIN
      );
      await this.initRealTimeStats();
    }

    clearStats() {
      this.showLoadingState();
    }

    async initialize() {
      if (this.initialized) {
        log.debug('Dashboard Stats ya inicializado', CAT.INIT);
        return;
      }

      log.startGroup('Admin Dashboard Stats Initialization', '🚀', true);
      try {
        log.info('Inicializando Dashboard Stats Manager...', CAT.INIT);

        if (typeof firebase === 'undefined') {
          log.error('Firebase no está disponible', CAT.INIT);
          log.endGroup('Admin Dashboard Stats Initialization');
          return;
        }
        this.db = firebase.firestore();
        this.auth = firebase.auth();

        if (window.AppState) {
          log.info('Subscribing to AppState user changes...', CAT.AUTH);
          this.authUnsubscribe = window.AppState.subscribe(
            'user',
            async user => {
              await this.handleAuthStateChange(
                user && user.isAuthenticated ? user : null
              );
            }
          );
        }

        // Fallback: también escuchar Firebase Auth directamente
        // Evita quedarse en "Cargando..." tras borrar cookies.
        this.firebaseAuthUnsubscribe = this.auth.onAuthStateChanged(
          async user => {
            await this.handleAuthStateChange(user);
          }
        );

        this.statsUnsubscribe = subscribe('admin.stats', newStats => {
          if (newStats) {
            log.trace('Stats updated in AppState', CAT.ADMIN, newStats);
            this.updateStatsUI(newStats);
          }
        });

        this.setupEventListeners();
        this.loadCachedStats();

        this.initialized = true;
        log.info(
          'Dashboard Stats Manager inicializado con auth observer y AppState v2.0',
          CAT.INIT
        );

        this.checkInitialLoad();
        this.initializeAuditRenderer();
      } catch (error) {
        log.error('Error inicializando Dashboard Stats', CAT.INIT, error);
      } finally {
        log.endGroup('Admin Dashboard Stats Initialization');
      }
    }

    checkInitialLoad() {
      const dashboard = document.getElementById('dashboardSection');
      if (
        dashboard &&
        (dashboard.classList.contains('active') ||
          window.getComputedStyle(dashboard).display !== 'none')
      ) {
        const run = () => setTimeout(() => this.initRealTimeStats(), 500);
        if (this.auth && this.auth.currentUser) {
          log.info('Dashboard activo al inicio (auth lista), forzando carga...', CAT.INIT);
          run();
          return;
        }
        if (this.auth) {
          log.info('Dashboard activo al inicio, esperando auth...', CAT.INIT);
          const unsubscribe = this.auth.onAuthStateChanged(user => {
            if (user) {
              if (unsubscribe) unsubscribe();
              run();
            }
          });
        }
      }
    }

    loadCachedStats() {
      try {
        const cached = localStorage.getItem('adminStatsCache');
        if (cached) {
          const stats = JSON.parse(cached);
          log.debug('Cargando estadísticas desde caché...', CAT.INIT);
          this.updateStatsUI(stats);

          if (window.AppState && window.AppState.setState) {
            window.AppState.setState('admin.stats', stats);
          }
        }
      } catch (_e) {
        log.warn('Error leyendo caché de stats', CAT.INIT);
      }
    }

    saveStatsToCache(stats) {
      try {
        if (stats) {
          localStorage.setItem('adminStatsCache', JSON.stringify(stats));
          log.trace('Estadísticas guardadas en caché', CAT.ADMIN);
        }
      } catch (_e) {
        // Ignore quota error
      }
    }

    initializeAuditRenderer() {
      const attemptInit = () => {
        const dashboardSection = document.getElementById('dashboardSection');
        if (!dashboardSection) {
          log.trace('Dashboard no encontrado, esperando...', CAT.INIT);
          return false;
        }

        if (!dashboardSection.classList.contains('active')) {
          log.trace('Dashboard no está activo, esperando...', CAT.INIT);
          return false;
        }

        if (!window.AdminAuditRenderer) {
          log.trace('AdminAuditRenderer no disponible, esperando...', CAT.INIT);
          return false;
        }

        log.info(
          'Inicializando Monitor de Fraude en Tiempo Real...',
          CAT.SECURITY
        );
        window.AdminAuditRenderer.init();
        return true;
      };

      if (attemptInit()) {
        return;
      }

      log.trace('Esperando a que AdminAuditRenderer se cargue...', CAT.INIT);

      const initWhenReady = () => {
        if (attemptInit()) {
          log.info(
            'Monitor inicializado después de cargar scripts',
            CAT.SECURITY
          );
        } else {
          log.warn(
            'No se pudo inicializar el Monitor después de cargar scripts',
            CAT.SECURITY
          );
        }
      };

      window.addEventListener('adminScriptsLoaded', initWhenReady, {
        once: true,
      });

      setTimeout(() => {
        if (!document.getElementById('adminAuditSection')) {
          log.debug('Intentando inicializar Monitor por timeout...', CAT.INIT);
          attemptInit();
        }
      }, 10000);
    }

    setupEventListeners() {
      if (window.EventDelegation) {
        window.EventDelegation.registerHandler(
          'resetVisits',
          async (el, ev) => {
            if (ev) ev.stopPropagation();
            await this.resetVisits();
          }
        );

        window.EventDelegation.registerHandler('showFullUsersList', async () => {
          await this.showFullUsersList();
        });

        window.EventDelegation.registerHandler(
          'refreshPaymentsStatus',
          async () => {
            await this.refreshPaymentsStatus();
          }
        );

        window.EventDelegation.registerHandler('refreshAdminData', async () => {
          await this.initRealTimeStats();
          if (window.adminAnnouncementsRenderer) {
            await window.adminAnnouncementsRenderer.renderAll();
          }
          if (window.NotificationSystem) {
            window.NotificationSystem.success('Datos actualizados');
          }
        });

        window.EventDelegation.registerHandler(
          'exportAllData',
          async (el, ev) => {
            if (ev) ev.preventDefault();
            await this.exportAllData();
          }
        );

        window.EventDelegation.registerHandler(
          'openPaymentsStatus',
          async (el, ev) => {
            if (ev) ev.preventDefault();
            this.showPaymentsStatusLoading();
            await this.refreshPaymentsStatus();
            if (typeof window.showPurchasesList === 'function') {
              window.showPurchasesList();
            }
          }
        );

      }

      window.refreshAdminData = async () => {
        await this.initRealTimeStats();
        if (window.adminAnnouncementsRenderer) {
          await window.adminAnnouncementsRenderer.renderAll();
        }
      };

      const container = document.getElementById('dashboardStatsContainer');
      if (container) {
        container.addEventListener('click', async e => {
          const actionBtn = e.target.closest('[data-action]');
          if (!actionBtn) return;

          const action = actionBtn.dataset.action;

          if (action === 'showFullUsersList') {
            this.showFullUsersList();
          } else if (action === 'showPurchasesList') {
            if (typeof window.showPurchasesList === 'function') {
              window.showPurchasesList();
            }
          } else if (action === 'resetVisits') {
            e.stopPropagation();
            await this.resetVisits();
          } else if (action === 'refreshPaymentsStatus') {
            // Delegado por EventDelegation para evitar duplicados.
            return;
          } else if (action === 'openPaymentsStatus') {
            // Delegado por EventDelegation para evitar duplicados.
            return;
          } else if (action === 'refreshAdminData') {
            await window.refreshAdminData();
          }
        });
      }
    }

    cleanup() {
      log.startGroup('Admin Dashboard Stats Cleanup', '🧹', true);
      if (this.authUnsubscribe) {
        log.debug('Limpiando auth observer...', CAT.INIT);
        this.authUnsubscribe();
        this.authUnsubscribe = null;
      }
      if (this.statsUnsubscribe) {
        log.debug('Limpiando stats observer...', CAT.INIT);
        this.statsUnsubscribe();
        this.statsUnsubscribe = null;
      }
      if (this.usersListener) {
        log.debug(
          'Limpiando listener de usuarios en tiempo real...',
          CAT.FIREBASE
        );
        this.usersListener();
        this.usersListener = null;
      }
      this.initialized = false;
      log.endGroup('Admin Dashboard Stats Cleanup');
    }
  }

  window.DashboardStatsManager = DashboardStatsManager;
}

export function initAdminDashboardCore() {
  if (window.__ADMIN_DASHBOARD_CORE_INITED__) {
    return;
  }

  window.__ADMIN_DASHBOARD_CORE_INITED__ = true;
  setupAdminDashboardCore();
}

if (typeof window !== 'undefined' && !window.__ADMIN_DASHBOARD_CORE_NO_AUTO__) {
  initAdminDashboardCore();
}
