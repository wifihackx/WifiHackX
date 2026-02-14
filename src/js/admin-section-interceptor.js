/**
 * Admin Section Interceptor
 * Detecta cambios de sección en el panel de administración y carga anuncios automáticamente
 */

export function initAdminSectionInterceptor() {
  'use strict';

  if (window.__ADMIN_SECTION_INTERCEPTOR_INITED__) {
    return;
  }
  window.__ADMIN_SECTION_INTERCEPTOR_INITED__ = true;

  console.log('[AdminSectionInterceptor] Initializing...');
  window.__adminSectionInterceptorActive = true;
  let lastUsersLoadAt = 0;

  const safeLoadUsers = () => {
    if (
      window.usersManager &&
      typeof window.usersManager.loadUsers === 'function'
    ) {
      if (window.usersManager._isLoadingUsers) return;
      const now = Date.now();
      if (now - lastUsersLoadAt < 600) return;
      lastUsersLoadAt = now;
      window.usersManager.loadUsers();
    } else {
      console.warn('[AdminSectionInterceptor] UsersManager not ready yet');
    }
  };

  /**
   * Verificar si el grid de anuncios está vacío
   */
  function isGridEmpty() {
    const grid = document.getElementById('adminAnnouncementsGrid');
    if (!grid) {
      console.log('[AdminSectionInterceptor] Grid not found');
      return true;
    }

    // Considerar vacío si no tiene hijos o solo tiene spinner
    const isEmpty =
      grid.children.length === 0 ||
      (grid.children.length === 1 && grid.querySelector('.loading-spinner')) ||
      (grid.children.length === 1 && grid.querySelector('.empty-state'));

    console.log(
      '[AdminSectionInterceptor] Grid empty check:',
      isEmpty,
      'children:',
      grid.children.length
    );
    return isEmpty;
  }

  /**
   * Cargar anuncios si es necesario
   */
  function loadIfNeeded() {
    console.log('[AdminSectionInterceptor] loadIfNeeded called');

    // Verificar que la sección esté visible
    const announcementsSection = document.getElementById(
      'announcementsSection'
    );
    if (!announcementsSection) {
      console.error(
        '[AdminSectionInterceptor] announcementsSection not found in DOM'
      );
      return;
    }

    const isVisible =
      announcementsSection.classList.contains('active') ||
      window.getComputedStyle(announcementsSection).display !== 'none';
    console.log('[AdminSectionInterceptor] Section visible:', isVisible);

    if (!isVisible) {
      console.warn(
        '[AdminSectionInterceptor] Section not visible yet, will retry in 200ms'
      );
      setTimeout(loadIfNeeded, 200);
      return;
    }

    if (!window.adminAnnouncementsRenderer) {
      console.warn(
        '[AdminSectionInterceptor] Renderer not available yet, will retry in 200ms'
      );
      setTimeout(loadIfNeeded, 200);
      return;
    }

    if (isGridEmpty()) {
      console.log(
        '[AdminSectionInterceptor] Grid is empty, loading announcements...'
      );

      // Verificar si el renderer tiene el método mejorado
      if (
        typeof window.adminAnnouncementsRenderer.renderWithRetry === 'function'
      ) {
        console.log(
          '[AdminSectionInterceptor] Using enhanced renderWithRetry()'
        );
        window.adminAnnouncementsRenderer.renderWithRetry().catch(err => {
          console.error(
            '[AdminSectionInterceptor] Error during renderWithRetry:',
            err
          );
        });
      } else {
        console.log('[AdminSectionInterceptor] Using standard renderAll()');
        window.adminAnnouncementsRenderer.renderAll().catch(err => {
          console.error(
            '[AdminSectionInterceptor] Error during renderAll:',
            err
          );
        });
      }
    } else {
      console.log(
        '[AdminSectionInterceptor] Grid already has content, skipping load'
      );
    }
  }

  /**
   * Interceptar showAdminSection
   */
  function interceptShowAdminSection() {
    const originalShowAdminSection = window.showAdminSection;

    if (typeof originalShowAdminSection !== 'function') {
      console.warn(
        '[AdminSectionInterceptor] showAdminSection not found, will retry...'
      );
      return false;
    }

    window.showAdminSection = function (sectionName) {
      console.log(
        '[AdminSectionInterceptor] ✅ Section change detected:',
        sectionName
      );

      // Llamar función original
      if (originalShowAdminSection) {
        originalShowAdminSection.apply(this, arguments);
      }

      const normalizedSection =
        typeof sectionName === 'string'
          ? sectionName.replace('Section', '')
          : sectionName;

      // Si es sección de anuncios, cargar
      if (normalizedSection === 'announcements') {
        console.log(
          '[AdminSectionInterceptor] 📢 Announcements section opened, will load in 300ms'
        );
        const triggerLoad = () => {
          // Delay más largo para asegurar que DOM está listo y sección visible
          setTimeout(() => {
            console.log(
              '[AdminSectionInterceptor] ⏰ Timeout fired, checking if load needed'
            );
            loadIfNeeded();
          }, 300);
        };

        if (window.AdminLoader && window.AdminLoader.ensureBundle) {
          window.AdminLoader.ensureBundle('announcements', { skipAuthCheck: true })
            .then(triggerLoad)
            .catch(triggerLoad);
        } else {
          triggerLoad();
        }
      } else if (normalizedSection === 'users') {
        console.log(
          '[AdminSectionInterceptor] 👥 Users section opened, loading users...'
        );
        const loadUsers = () => {
          // Cargar usuarios - safeLoadUsers previene duplicados
          safeLoadUsers();
        };

        if (window.AdminLoader && window.AdminLoader.ensureBundle) {
          window.AdminLoader.ensureBundle('users', { skipAuthCheck: true })
            .then(loadUsers)
            .catch(loadUsers);
        } else {
          loadUsers();
        }

        if (!window.usersManager && window.initUsersManager) {
          window.initUsersManager();
        }
        window.addEventListener(
          'usersManagerReady',
          () => {
            safeLoadUsers();
          },
          { once: true }
        );
      } else if (normalizedSection === 'dashboard') {
        console.log(
          '[AdminSectionInterceptor] 📊 Dashboard section opened, checking stats...'
        );
        const loadDashboard = () => {
          if (window.dashboardStatsManager) {
            window.dashboardStatsManager.initRealTimeStats();
            // También intentar regenerar el monitor de auditoría si existe
            if (window.dashboardStatsManager.initializeAuditRenderer) {
              window.dashboardStatsManager.initializeAuditRenderer();
            }
          }
        };

        if (window.AdminLoader && window.AdminLoader.ensureBundle) {
          window.AdminLoader.ensureBundle('dashboard', { skipAuthCheck: true })
            .then(loadDashboard)
            .catch(loadDashboard);
        } else {
          loadDashboard();
        }
      } else if (normalizedSection === 'settings') {
        console.log(
          '[AdminSectionInterceptor] ⚙️ Settings section opened, loading bundle...'
        );
        if (window.AdminLoader && window.AdminLoader.ensureBundle) {
          window.AdminLoader.ensureBundle('settings', { skipAuthCheck: true })
            .then(() => {
              if (window.SettingsCardsGenerator && window.SettingsCardsGenerator.render) {
                window.SettingsCardsGenerator.render();
              }
            })
            .catch(() => {});
        }
      }
    };

    console.log(
      '[AdminSectionInterceptor] showAdminSection intercepted successfully'
    );

    // Trigger initial load for current active section (if any)
    const activeSection = document.querySelector('.admin-section.active');
    if (activeSection) {
      const sectionId = activeSection.id || '';
      if (sectionId === 'usersSection') {
        if (window.AdminLoader && window.AdminLoader.ensureBundle) {
          window.AdminLoader.ensureBundle('users', { skipAuthCheck: true })
            .then(() => {
              if (
                window.usersManager &&
                typeof window.usersManager.loadUsers === 'function'
              ) {
                safeLoadUsers();
              }
            })
            .catch(() => {
              if (
                window.usersManager &&
                typeof window.usersManager.loadUsers === 'function'
              ) {
                safeLoadUsers();
              }
            });
        } else if (
          window.usersManager &&
          typeof window.usersManager.loadUsers === 'function'
        ) {
          safeLoadUsers();
        }
      } else if (sectionId === 'announcementsSection') {
        if (window.AdminLoader && window.AdminLoader.ensureBundle) {
          window.AdminLoader.ensureBundle('announcements', { skipAuthCheck: true })
            .then(() => setTimeout(loadIfNeeded, 300))
            .catch(() => setTimeout(loadIfNeeded, 300));
        } else {
          setTimeout(loadIfNeeded, 300);
        }
      } else if (sectionId === 'dashboardSection') {
        const initDashboard = () => {
          if (window.dashboardStatsManager) {
            window.dashboardStatsManager.initRealTimeStats();
            if (window.dashboardStatsManager.initializeAuditRenderer) {
              window.dashboardStatsManager.initializeAuditRenderer();
            }
          }
        };
        if (window.AdminLoader && window.AdminLoader.ensureBundle) {
          window.AdminLoader.ensureBundle('dashboard', { skipAuthCheck: true })
            .then(initDashboard)
            .catch(initDashboard);
        } else {
          initDashboard();
        }
      } else if (sectionId === 'settingsSection') {
        if (window.AdminLoader && window.AdminLoader.ensureBundle) {
          window.AdminLoader.ensureBundle('settings', { skipAuthCheck: true })
            .then(() => {
              if (window.SettingsCardsGenerator && window.SettingsCardsGenerator.render) {
                window.SettingsCardsGenerator.render();
              }
            })
            .catch(() => {});
        }
      }
    }
    return true;
  }

  /**
   * También interceptar el AdminController del bundle
   */
  function interceptAdminController() {
    // Esperar a que AdminController esté disponible
    if (!window.adminController) {
      return false;
    }

    // Interceptar el método de navegación
    const originalNavigate = window.adminController.navigate;
    if (typeof originalNavigate === 'function') {
      window.adminController.navigate = function (sectionName) {
        console.log(
          '[AdminSectionInterceptor] AdminController.navigate intercepted:',
          sectionName
        );

        // Llamar original
        const result = originalNavigate.apply(this, arguments);

        const normalizedSection =
          typeof sectionName === 'string'
            ? sectionName.replace('Section', '')
            : sectionName;

        if (normalizedSection === 'announcements') {
          console.log(
            '[AdminSectionInterceptor] Forcing announcement load after AdminController navigation'
          );
          const triggerLoad = () => setTimeout(loadIfNeeded, 300);
          if (window.AdminLoader && window.AdminLoader.ensureBundle) {
            window.AdminLoader.ensureBundle('announcements', { skipAuthCheck: true })
              .then(triggerLoad)
              .catch(triggerLoad);
          } else {
            triggerLoad();
          }
        } else if (normalizedSection === 'users') {
          if (window.AdminLoader && window.AdminLoader.ensureBundle) {
            window.AdminLoader.ensureBundle('users', { skipAuthCheck: true }).catch(() => {});
          }
        } else if (normalizedSection === 'dashboard') {
          if (window.AdminLoader && window.AdminLoader.ensureBundle) {
            window.AdminLoader.ensureBundle('dashboard', { skipAuthCheck: true }).catch(() => {});
          }
        } else if (normalizedSection === 'settings') {
          if (window.AdminLoader && window.AdminLoader.ensureBundle) {
            window.AdminLoader.ensureBundle('settings', { skipAuthCheck: true }).catch(() => {});
          }
        }

        return result;
      };

      console.log(
        '[AdminSectionInterceptor] AdminController.navigate intercepted'
      );
      return true;
    }

    return false;
  }

  /**
   * Intentar interceptar con reintentos
   */
  function tryInterceptWithRetry(maxAttempts = 10, delay = 500) {
    let attempts = 0;
    let showAdminSectionIntercepted = false;
    let adminControllerIntercepted = false;
    let lastLogTime = 0;
    const LOG_THROTTLE = 2000; // Solo log cada 2 segundos

    const tryIntercept = () => {
      attempts++;

      // Throttle logging - solo mostrar cada 2 segundos
      const now = Date.now();
      const shouldLog = now - lastLogTime > LOG_THROTTLE;

      if (shouldLog) {
        console.log(
          `[AdminSectionInterceptor] Intercept attempt ${attempts}/${maxAttempts}`
        );
        lastLogTime = now;
      }

      // Intentar interceptar showAdminSection
      if (!showAdminSectionIntercepted && interceptShowAdminSection()) {
        console.log(
          '[AdminSectionInterceptor] ✅ showAdminSection intercepted successfully'
        );
        showAdminSectionIntercepted = true;
      }

      // Intentar interceptar AdminController
      if (!adminControllerIntercepted && interceptAdminController()) {
        console.log(
          '[AdminSectionInterceptor] ✅ AdminController intercepted successfully'
        );
        adminControllerIntercepted = true;
      }

      // Si ambos están interceptados, terminar
      if (showAdminSectionIntercepted && adminControllerIntercepted) {
        console.log('[AdminSectionInterceptor] 🎉 All interceptions complete');
        return;
      }

      // Si aún no están todos interceptados y quedan intentos, reintentar
      if (attempts < maxAttempts) {
        setTimeout(tryIntercept, delay);
      } else {
        // If showAdminSection is intercepted, we consider it a success even if AdminController is missing
        // (AdminController is part of the legacy bundle and might not always be present or needed)
        if (showAdminSectionIntercepted) {
          console.log(
            '[AdminSectionInterceptor] ✅ Initialization finished (showAdminSection intercepted)'
          );
        } else {
          console.warn(
            '[AdminSectionInterceptor] ⚠️ Completed without showAdminSection interception after',
            maxAttempts,
            'attempts'
          );
        }
      }
    };

    tryIntercept();
  }

  // Iniciar interceptación cuando los scripts de administración estén listos
  window.addEventListener('adminScriptsLoaded', () => {
    console.log(
      '[AdminSectionInterceptor] Admin scripts loaded, initializing interception...'
    );
    tryInterceptWithRetry();
  });

  // Core cargado (nuevo flujo por bundles)
  window.addEventListener('adminCoreLoaded', () => {
    console.log(
      '[AdminSectionInterceptor] Admin core loaded, initializing interception...'
    );
    tryInterceptWithRetry();
  });

  // También intentar inmediatamente por si ya están cargados (precarga)
  if (window.AdminLoader && window.AdminLoader.isLoaded()) {
    tryInterceptWithRetry();
  } else if (window.AdminLoader && window.AdminLoader.isCoreLoaded && window.AdminLoader.isCoreLoaded()) {
    tryInterceptWithRetry();
  } else if (!window.AdminLoader) {
    // Fallback: si no cargamos vía AdminLoader (desarrollo/legacy), intentar en DOMContentLoaded
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        setTimeout(tryInterceptWithRetry, 1000); // Dar un margen extra
      });
    } else {
      setTimeout(tryInterceptWithRetry, 1000);
    }
  } else {
    // Si AdminLoader existe pero no ha cargado, esperamos el evento
    console.log(
      '[AdminSectionInterceptor] Waiting for AdminLoader to trigger adminCoreLoaded/adminScriptsLoaded event'
    );
  }

  // Fallback: intentar interceptar pronto por si todo ya está listo
  setTimeout(() => {
    tryInterceptWithRetry();
  }, 500);

  console.log('[AdminSectionInterceptor] Initialized');
}
