/**
 * Admin Loader - Carga scripts de admin solo cuando se necesitan
 * Reduce carga inicial en ~58 KB para usuarios públicos
 *
 * @version 8.0.0
 */

'use strict';

function setupAdminLoader() {
  const perfDebugEnabled = (() => {
    try {
      const qs = new URLSearchParams(window.location.search || '');
      const queryFlag = qs.get('debug_perf');
      if (queryFlag === '1') {
        localStorage.setItem('wifihackx:debug:perf', '1');
        return true;
      }
      if (queryFlag === '0') {
        localStorage.removeItem('wifihackx:debug:perf');
        return false;
      }
      if (localStorage.getItem('wifihackx:debug:perf') === '1') return true;
    } catch (_e) {}
    return false;
  })();
  const perfStore = (window.__WIFIHACKX_PERF__ =
    window.__WIFIHACKX_PERF__ || { enabled: perfDebugEnabled, metrics: [] });
  perfStore.enabled = perfStore.enabled || perfDebugEnabled;
  const recordPerf = (name, durationMs, meta = {}) => {
    const entry = {
      name,
      durationMs: Number(durationMs.toFixed(2)),
      at: new Date().toISOString(),
      ...meta,
    };
    perfStore.metrics.push(entry);
    if (perfStore.metrics.length > 200) {
      perfStore.metrics.shift();
    }
    if (perfStore.enabled) {
      console.log('[PERF]', entry);
    }
  };

  function normalizeAssetPath(value) {
    try {
      const url = new URL(value, window.location.origin);
      return url.pathname;
    } catch (_e) {
      return value.split('?')[0];
    }
  }

  /**
   * Styles esenciales para el panel admin
   */
  const ADMIN_STYLES = [
    'css/admin-bundle.css',
      'css/admin-restoration.css',
      'css/admin-audit.css?v=1.5',
      'css/users-admin.css',
      'css/purchases-list-modal.css?v=1.0',
      'css/users-list-modal.css?v=1.0',
    'css/users-table-premium.css?v=1.0',
    'css/user-modals.css?v=1.0',
  ];

  /**
   * Scripts esenciales para habilitar navegación admin rápida
   */
  const CORE_SCRIPTS = [
    { src: 'js/admin-services.js', type: 'module' },
    { src: 'js/admin-navigation-unified.js?v=1.2', type: 'module' },
    { src: 'js/admin.js?v3.0', type: 'module' },
    { src: 'js/admin-section-interceptor.js?v=1.0', type: 'module' },
    { src: 'js/admin-protection-system.js?v=1.1', type: 'module' },
    { src: 'js/admin-modals-component.js', type: 'module' },
    { src: 'js/scrollbar-compensation.js', type: 'module' },
    { src: 'js/admin-panel-init.js', type: 'module' },
  ];

  /**
   * Scripts compartidos por múltiples secciones
   */
  const ADMIN_DATA_SCRIPTS = [
    { src: 'js/real-time-data-service.js?v=2026020302', type: 'module' },    { src: 'js/firestore-data-cleaner.js', type: 'module' },
    { src: 'js/firebase-permissions-handler.js', type: 'module' },
  ];

  /**
   * Bundles por sección (carga bajo demanda)
   */
  const SECTION_BUNDLES = {
    dashboard: [
      'https://cdn.jsdelivr.net/npm/chart.js@4.5.1/dist/chart.umd.min.js',
      { src: 'js/admin-dashboard-core.js', type: 'module' },
      { src: 'js/admin-dashboard-ui.js', type: 'module' },
      { src: 'js/admin-dashboard-data.js', type: 'module' },
      { src: 'js/admin-dashboard-bootstrap.js', type: 'module' },
      { src: 'js/dashboard-charts-manager.js?v=1.0', type: 'module' },
      { src: 'js/stat-cards-generator.js', type: 'module' },
      { src: 'js/analytics-manager.js', type: 'module' },
      { src: 'js/analytics-cards-generator.js', type: 'module' },
      { src: 'js/admin-audit-renderer.js?v=1.8', type: 'module' },
      { src: 'js/purchases-list-modal.js?v=1.0', type: 'module' },
      { src: 'js/users-list-modal.js?v=1.1', type: 'module' },
    ],
    users: [
      { src: 'js/users-modals.js', type: 'module' },
      { src: 'js/users-renderer.js', type: 'module' },
      { src: 'js/users-actions.js', type: 'module' },
      { src: 'js/users-forms.js', type: 'module' },
      { src: 'js/users-data.js', type: 'module' },
      { src: 'js/users-manager.js?v=2.4', type: 'module' },
      { src: 'js/ban-system.js?v2.0', type: 'module' },
      { src: 'js/filter-buttons-generator.js', type: 'module' },
    ],
    announcements: [
      { src: 'js/admin-announcements-renderer.js?v=1.3', type: 'module' },
      { src: 'js/announcement-form-handler.js', type: 'module' },
      { src: 'js/announcement-admin-init.js?v=1.0', type: 'module' },
    ],
    settings: [
      { src: 'js/admin-services.js', type: 'module' },
      { src: 'js/settings-cards-generator.js?v2.2', type: 'module' },
      { src: 'js/admin-settings.js?v3.2', type: 'module' },
      { src: 'js/revenue-reset.js', type: 'module' },
    ],
  };

  const BUNDLE_DEPENDENCIES = {
    dashboard: ['data'],
    users: ['data'],
    announcements: ['data'],
    settings: [],
  };

  const BUNDLES = {
    data: ADMIN_DATA_SCRIPTS,
    ...SECTION_BUNDLES,
  };

  /**
   * Estado de carga
   */
  let adminScriptsLoaded = false;
  let coreScriptsLoaded = false;
  let loadingPromise = null;
  let coreLoadingPromise = null;
  let adminTemplatePromise = null;
  const bundleLoaded = {};
  const bundlePromises = {};

  function getAllowlistFromSettings() {
    const settings = window.AdminSettingsCache;
    const emails = (settings?.security?.adminAllowlistEmails || '')
      .split(',')
      .map(item => item.trim().toLowerCase())
      .filter(Boolean);
    const uids = (settings?.security?.adminAllowlistUids || '')
      .split(',')
      .map(item => item.trim())
      .filter(Boolean);
    return { emails, uids };
  }

  async function ensureAdminSettingsCache() {
    if (window.AdminSettingsCache) return window.AdminSettingsCache;
    if (window.AdminSettingsService?.getSettings) {
      const settings = await window.AdminSettingsService.getSettings({
        allowDefault: false,
      });
      if (settings) {
        window.AdminSettingsCache = settings;
        return settings;
      }
    }
    return window.AdminSettingsCache || null;
  }

  /**
   * Cargar un script dinámicamente
   */
  function loadScript(src, options = false) {
    return new Promise((resolve, reject) => {
      const normalizedSrc = normalizeAssetPath(src);
      const existingScript = Array.from(document.scripts).find(script => {
        const scriptSrc = script.getAttribute('src');
        if (!scriptSrc) return false;
        return normalizeAssetPath(scriptSrc) === normalizedSrc;
      });
      if (existingScript) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = src;
      script.dataset.adminScript = normalizedSrc;

      const resolvedOptions =
        typeof options === 'boolean' ? { async: options } : options || {};

      if (resolvedOptions.type) {
        script.type = resolvedOptions.type;
      }

      if (resolvedOptions.async) {
        script.async = true;
      } else {
        // For dynamically injected scripts, async=false preserves order.
        script.async = false;
        script.defer = true;
      }

      const nonce = window.SECURITY_NONCE || window.NONCE;
      if (nonce) {
        script.nonce = nonce;
      }

      script.onload = () => {
        console.log('[AdminLoader] Cargado:', src);
        resolve();
      };

      script.onerror = () => {
        console.error('[AdminLoader] Error cargando:', src);
        reject(new Error(`Failed to load ${src}`));
      };

      document.body.appendChild(script);
    });
  }

  /**
   * Cargar un stylesheet dinámicamente
   */
  function loadStyle(href) {
    return new Promise((resolve, reject) => {
      const normalizedHref = normalizeAssetPath(href);
      const existingStyle = Array.from(
        document.querySelectorAll('link[rel="stylesheet"]')
      ).find(link => {
        const linkHref = link.getAttribute('href');
        if (!linkHref) return false;
        return normalizeAssetPath(linkHref) === normalizedHref;
      });
      if (existingStyle) {
        resolve();
        return;
      }

      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      link.dataset.adminStyle = normalizedHref;
      link.onload = () => resolve();
      link.onerror = () => reject(new Error(`Failed to load ${href}`));
      document.head.appendChild(link);
    });
  }

  /**
   * Asegurar que los modales no se muestren por defecto
   * (admin-bundle define .modal-overlay con display:flex)
   */
  function ensureModalOverlayFix() {
    if (document.body.classList.contains('admin-modal-guard')) {
      return;
    }
    document.body.classList.add('admin-modal-guard');
  }

  async function ensureAdminTemplateLoaded() {
    const adminView = document.getElementById('adminView');
    if (!adminView) return;
    if (adminView.dataset.templateLoaded === '1') return;
    if (adminView.querySelector('.admin-container')) {
      adminView.dataset.templateLoaded = '1';
      return;
    }
    if (adminTemplatePromise) return adminTemplatePromise;

    const templatePath =
      adminView.dataset.template || '/partials/admin-view.html';

    adminTemplatePromise = (async () => {
      const startedAt = performance.now();
      const response = await fetch(templatePath, {
        credentials: 'same-origin',
        cache: 'no-cache',
      });
      if (!response.ok) {
        throw new Error(
          `No se pudo cargar la plantilla de admin (${response.status})`
        );
      }
      const html = await response.text();
      adminView.innerHTML = html;
      adminView.dataset.templateLoaded = '1';
      window.dispatchEvent(new CustomEvent('adminTemplateLoaded'));
      recordPerf('admin_template_load', performance.now() - startedAt, {
        templatePath,
      });
      console.log('[AdminLoader] ✅ Plantilla admin cargada');
    })().finally(() => {
      adminTemplatePromise = null;
    });

    return adminTemplatePromise;
  }

  /**
   * Verificar permisos admin antes de cargar
   */
  async function ensureAdminAccess() {
    if (window.AppState && window.AppState.state?.user?.isAdmin) {
      return;
    }

    if (!window.firebase || !firebase.auth) {
      // Esperar a firebase:initialized si aún no está listo (modular)
      await new Promise(resolve => {
        if (window.auth || (window.firebase && window.firebase.auth)) {
          resolve();
          return;
        }
        const handler = () => {
          window.removeEventListener('firebase:initialized', handler);
          resolve();
        };
        window.addEventListener('firebase:initialized', handler, { once: true });
        setTimeout(() => {
          window.removeEventListener('firebase:initialized', handler);
          resolve();
        }, 5000);
      });
    }

    const auth =
      window.auth ||
      (window.firebase && window.firebase.auth ? window.firebase.auth() : null);
    if (!auth) {
      throw new Error('Firebase no disponible');
    }
    const waitForUser = (timeoutMs = 12000) =>
      new Promise((resolve, reject) => {
        if (auth.currentUser) {
          resolve(auth.currentUser);
          return;
        }
        let unsubscribe = null;
        const timeout = setTimeout(() => {
          if (unsubscribe) unsubscribe();
          reject(new Error('No hay usuario autenticado'));
        }, timeoutMs);

        const handler = user => {
          if (user) {
            clearTimeout(timeout);
            if (unsubscribe) unsubscribe();
            resolve(user);
          }
        };

        if (window.firebaseModular && window.firebaseModular.onAuthStateChanged) {
          unsubscribe = window.firebaseModular.onAuthStateChanged(auth, handler);
        } else if (auth && typeof auth.onAuthStateChanged === 'function') {
          unsubscribe = auth.onAuthStateChanged(handler);
        }

        // Fallback: escuchar evento auth:ready y polling de window.auth
        const onAuthReady = e => {
          const u = e && e.detail ? e.detail : null;
          if (window.auth?.currentUser) {
            handler(window.auth.currentUser);
          } else if (u && u.email) {
            handler(window.auth?.currentUser || auth.currentUser);
          }
        };
        window.addEventListener('auth:ready', onAuthReady, { once: true });

        const poll = setInterval(() => {
          if (window.auth?.currentUser) {
            clearInterval(poll);
            handler(window.auth.currentUser);
          }
        }, 500);

        const origResolve = resolve;
        resolve = user => {
          clearInterval(poll);
          window.removeEventListener('auth:ready', onAuthReady);
          origResolve(user);
        };
        const origReject = reject;
        reject = err => {
          clearInterval(poll);
          window.removeEventListener('auth:ready', onAuthReady);
          origReject(err);
        };
      });

    const user = await waitForUser();
    await ensureAdminSettingsCache();
    const allowlist = getAllowlistFromSettings();
    let isAdmin = false;
    if (window.AdminClaimsService?.isAdmin) {
      isAdmin = await window.AdminClaimsService.isAdmin(user, allowlist);
    } else {
      const claims = window.getAdminClaims
        ? await window.getAdminClaims(user, false)
        : (await user.getIdTokenResult(true)).claims;
      const isAllowlistedEmail =
        !!user.email && allowlist.emails.includes(user.email.toLowerCase());
      const isAllowlistedUid = allowlist.uids.includes(user.uid);
      isAdmin =
        !!claims?.admin ||
        claims?.role === 'admin' ||
        claims?.role === 'super_admin' ||
        isAllowlistedEmail ||
        isAllowlistedUid;
    }
    if (!isAdmin) {
      throw new Error('Usuario sin permisos de administrador');
    }
  }

  /**
   * Cargar scripts core (rápido)
   */
  async function loadCoreScripts(options = {}) {
    if (coreScriptsLoaded) return Promise.resolve();
    if (coreLoadingPromise) return coreLoadingPromise;

    coreLoadingPromise = (async () => {
      const startedAt = performance.now();
      try {
        if (!options.skipAuthCheck) {
          await ensureAdminAccess();
        }

        await ensureAdminTemplateLoaded();

        for (const href of ADMIN_STYLES) {
          await loadStyle(href);
        }
        ensureModalOverlayFix();

        for (const entry of CORE_SCRIPTS) {
          const src = typeof entry === 'string' ? entry : entry.src;
          const type = typeof entry === 'string' ? undefined : entry.type;
          const isAsync =
            typeof entry === 'string' ? false : !!entry.async;

          await loadScript(src, { async: isAsync, type });
        }

        coreScriptsLoaded = true;
        recordPerf('admin_core_load', performance.now() - startedAt, {
          skipAuthCheck: !!options.skipAuthCheck,
        });
        console.log('[AdminLoader] ✅ Core admin scripts cargados');
        window.dispatchEvent(new CustomEvent('adminCoreLoaded'));
      } catch (error) {
        console.warn('[AdminLoader] Core admin check failed:', error);
        if (window.NotificationSystem) {
          window.NotificationSystem.error(
            'No tienes permisos para acceder al panel de administración.'
          );
        }
        throw error;
      }
    })();

    return coreLoadingPromise;
  }

  function getActiveSectionName() {
    const activeSection = document.querySelector('.admin-section.active');
    const sectionId = activeSection ? activeSection.id : '';
    if (sectionId === 'dashboardSection') return 'dashboard';
    if (sectionId === 'usersSection') return 'users';
    if (sectionId === 'announcementsSection') return 'announcements';
    if (sectionId === 'settingsSection') return 'settings';
    return null;
  }

  async function loadBundle(bundleName, options = {}) {
    if (!BUNDLES[bundleName]) return Promise.resolve();
    if (bundleLoaded[bundleName]) return Promise.resolve();
    if (bundlePromises[bundleName]) return bundlePromises[bundleName];

    bundlePromises[bundleName] = (async () => {
      await loadCoreScripts(options);

      const deps = BUNDLE_DEPENDENCIES[bundleName] || [];
      for (const dep of deps) {
        await loadBundle(dep, options);
      }

      const scripts = BUNDLES[bundleName] || [];
      for (const entry of scripts) {
        const src = typeof entry === 'string' ? entry : entry.src;
        const isAsync =
          typeof entry === 'string'
            ? entry.includes('analytics-cards-generator')
            : !!entry.async;
        const type = typeof entry === 'string' ? undefined : entry.type;

        await loadScript(src, { async: isAsync, type });
      }

      bundleLoaded[bundleName] = true;
      window.dispatchEvent(new CustomEvent(`adminBundleLoaded:${bundleName}`));
    })();

    return bundlePromises[bundleName];
  }

  async function ensureBundleForActiveSection(options = {}) {
    const activeSection = getActiveSectionName();
    const bundleName = activeSection || 'dashboard';
    await loadBundle(bundleName, options);
  }

  /**
   * Sincronizar estado inicial del admin después de cargar
   */
  function syncAdminAfterLoad() {
    const adminView = document.getElementById('adminView');
    if (!adminView || !adminView.classList.contains('active')) return;

    const activeSection = document.querySelector('.admin-section.active');
    const sectionId = activeSection ? activeSection.id : '';

    if (sectionId === 'usersSection') {
      if (window.usersManager && typeof window.usersManager.loadUsers === 'function') {
        window.usersManager.loadUsers();
      }
    } else if (sectionId === 'dashboardSection') {
      if (typeof window.loadDashboardStats === 'function') {
        window.loadDashboardStats();
      }
      if (window.dashboardStatsManager) {
        window.dashboardStatsManager.initRealTimeStats();
        if (window.dashboardStatsManager.initializeAuditRenderer) {
          window.dashboardStatsManager.initializeAuditRenderer();
        }
      }
    }
  }

  /**
   * Cargar todos los scripts de admin (full)
   */
  async function loadAdminScripts() {
    if (adminScriptsLoaded) return Promise.resolve();
    if (loadingPromise) return loadingPromise;

    console.log('[AdminLoader] Iniciando carga de scripts de administración...');

    loadingPromise = (async () => {
      try {
        await loadCoreScripts();
        await loadBundle('data');

        for (const bundleName of Object.keys(SECTION_BUNDLES)) {
          await loadBundle(bundleName);
        }

        adminScriptsLoaded = true;
        console.log('[AdminLoader] ✅ Todos los scripts de administración cargados');

        window.dispatchEvent(new CustomEvent('adminScriptsLoaded'));
        syncAdminAfterLoad();
      } catch (error) {
        console.error('[AdminLoader] ❌ Error cargando scripts:', error);
        throw error;
      }
    })();

    return loadingPromise;
  }

  function preloadDashboardCoreNonBlocking() {
    loadCoreScripts({ skipAuthCheck: true })
      .then(() => loadBundle('dashboard', { skipAuthCheck: true }))
      .catch(() => {});
  }

  /**
   * Interceptar clicks en botones de admin (prefetch no bloqueante)
   */
  function interceptAdminButtons() {
    document.addEventListener(
      'click',
      e => {
        const target = e.target.closest('[data-action="openAdmin"]');

        if (target && !adminScriptsLoaded) {
          console.log('[AdminLoader] Prefetch admin scripts on click');
          preloadDashboardCoreNonBlocking();
        }
      },
      true
    );
  }

  /**
   * Detectar cambio de vista a admin
   */
  function observeViewChanges() {
    const observer = new MutationObserver(mutations => {
      mutations.forEach(mutation => {
        if (mutation.attributeName === 'data-current-view') {
          const currentView = document.body.dataset.currentView;

          if (currentView === 'adminView' && !adminScriptsLoaded) {
            console.log('[AdminLoader] Vista admin detectada, cargando scripts...');
            loadCoreScripts()
              .then(() => ensureBundleForActiveSection())
              .catch(() => {});
          }
        }
      });
    });

    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['data-current-view'],
    });
  }

  /**
   * Precargar scripts si el usuario es admin vía AppState (Unificado)
   */
  function preloadIfAdmin() {
    if (window.AppState) {
      console.log('[AdminLoader] 📡 Subscribing to AppState user changes...');
      window.AppState.subscribe('user', user => {
        if (user && user.isAdmin) {
          console.log(
            '[AdminLoader] Usuario admin detectado vía AppState, precargando core...'
          );
          preloadDashboardCoreNonBlocking();
        }
      });
    } else {
      const checkAuth = setInterval(() => {
        if (window.firebase && window.firebase.auth) {
          clearInterval(checkAuth);
          window.firebase.auth().onAuthStateChanged(user => {
            if (!user) return;
            const tryPreload = async () => {
              const allowlist = getAllowlistFromSettings();
              if (window.AdminClaimsService?.isAdmin) {
                const ok = await window.AdminClaimsService.isAdmin(user, allowlist);
                if (ok) {
                  preloadDashboardCoreNonBlocking();
                }
                return;
              }
              const claims = window.getAdminClaims
                ? await window.getAdminClaims(user, false)
                : (await user.getIdTokenResult(true)).claims;
              const isAllowlistedEmail =
                !!user.email && allowlist.emails.includes(user.email.toLowerCase());
              const isAllowlistedUid = allowlist.uids.includes(user.uid);
              if (
                !!claims?.admin ||
                claims?.role === 'admin' ||
                claims?.role === 'super_admin' ||
                isAllowlistedEmail ||
                isAllowlistedUid
              ) {
                preloadDashboardCoreNonBlocking();
              }
            };
            tryPreload().catch(() => {});
          });
        }
      }, 100);
      setTimeout(() => clearInterval(checkAuth), 5000);
    }
  }

  /**
   * Inicializar
   */
  function init() {
    interceptAdminButtons();
    observeViewChanges();
    preloadIfAdmin();

    console.log('[AdminLoader] Sistema de carga dinámica inicializado');
  }

  /**
   * API Global
   */
  window.AdminLoader = {
    load: loadAdminScripts,
    loadCore: loadCoreScripts,
    ensureBundle: loadBundle,
    ensureActiveBundle: ensureBundleForActiveSection,
    isLoaded: () => adminScriptsLoaded,
    isCoreLoaded: () => coreScriptsLoaded,
    isBundleLoaded: name => !!bundleLoaded[name],
  };

  // Inicializar cuando el DOM esté listo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}

export function initAdminLoader() {
  if (window.__ADMIN_LOADER_INITED__) {
    return;
  }

  window.__ADMIN_LOADER_INITED__ = true;
  setupAdminLoader();
}



