/**
 * auth-init-early.js
 * Early authentication state initialization
 * MUST load BEFORE any view rendering to prevent flash
 *
 * This script:
 * 1. Hides all views immediately
 * 2. Shows a loading spinner
 * 3. Checks Firebase auth state
 * 4. Shows the correct view based on auth state
 * 5. Removes the loading spinner
 */

(function () {
  'use strict';

  let isInitialized = false;
  Logger.section('Auth Early Initialization');
  Logger.info('Early initialization started', 'AUTH');
  Logger.debug('Using existing #loadingScreen from index.html', 'INIT');

  /**
   * Hide all views immediately to prevent flash
   * @param {boolean} preserveAdminView - Si es true, no oculta el adminView
   */
  function hideAllViews(preserveAdminView = false) {
    const views = document.querySelectorAll('.view');
    views.forEach(view => {
      // Si preserveAdminView es true y esta es la vista de admin, no ocultarla
      if (preserveAdminView && view.id === 'adminView') {
        Logger.debug('Preserving adminView visibility', 'INIT');
        return;
      }

      view.classList.remove('active');
      view.classList.add('hidden');
      window.DOMUtils.setDisplay(view, 'none');
      view.setAttribute('aria-hidden', 'true');
    });

    // Also hide header and footer during init to prevent flash
    // PERO: Si preserveAdminView es true, mantener header visible
    const header = document.querySelector('.main-header');
    const footer = document.querySelector('.modern-footer');
    if (header && !preserveAdminView) window.DOMUtils.setDisplay(header, 'none');
    if (footer && !preserveAdminView) window.DOMUtils.setDisplay(footer, 'none');

    Logger.debug('All views hidden', 'INIT');
  }

  /**
   * Show the appropriate view based on auth state
   */
  function showView(viewId) {
    const view = document.getElementById(viewId);
    if (view) {
      view.classList.add('active');
      view.classList.remove('hidden');
      window.DOMUtils.setDisplay(view, 'block');
      view.setAttribute('aria-hidden', 'false');
      document.body.setAttribute('data-current-view', viewId);
      try {
        if (window.AppState && typeof window.AppState.setState === 'function') {
          window.AppState.setState('view.current', viewId);
        }
        localStorage.setItem('currentView', viewId);
      } catch (_e) {}

      // Sync header/footer visibility
      const header = document.querySelector('.main-header');
      const footer = document.querySelector('.modern-footer');
      if (viewId === 'loginView') {
        if (header) window.DOMUtils.setDisplay(header, 'none');
        if (footer) window.DOMUtils.setDisplay(footer, 'none');
      } else {
        if (header) window.DOMUtils.setDisplay(header, '');
        if (footer) window.DOMUtils.setDisplay(footer, '');
      }

      Logger.info(`Showing view: ${viewId}`, 'AUTH');
    } else {
      Logger.error(`View not found: ${viewId}`, 'AUTH');
    }
  }

  function ensureHomeViewStable() {
    const homeView = document.getElementById('homeView');
    if (!homeView) return false;

    homeView.classList.add('active');
    homeView.classList.remove('hidden');
    window.DOMUtils.setDisplay(homeView, 'block');

    const loginView = document.getElementById('loginView');
    const adminView = document.getElementById('adminView');
    [loginView, adminView].forEach(view => {
      if (!view) return;
      view.classList.remove('active');
      view.classList.add('hidden');
      window.DOMUtils.setDisplay(view, 'none');
      view.setAttribute('aria-hidden', 'true');
    });

    homeView.setAttribute('aria-hidden', 'false');
    document.body.setAttribute('data-current-view', 'homeView');
    try {
      if (window.AppState && typeof window.AppState.setState === 'function') {
        window.AppState.setState('view.current', 'homeView');
      }
      localStorage.setItem('currentView', 'homeView');
    } catch (_e) {}

    const header = document.querySelector('.main-header');
    const footer = document.querySelector('.modern-footer');
    if (header) window.DOMUtils.setDisplay(header, '');
    if (footer) window.DOMUtils.setDisplay(footer, '');
    return true;
  }

  /**
   * Restore admin view safely even if admin scripts are not loaded yet
   */
  function restoreAdminView() {
    Logger.info('Restoring admin view (safe fallback)...', 'ADMIN');

    // Hide public views only
    const publicViews = document.querySelectorAll('.view:not(#adminView)');
    publicViews.forEach(view => {
      view.classList.remove('active');
      view.classList.add('hidden');
      window.DOMUtils.setDisplay(view, 'none');
      view.setAttribute('aria-hidden', 'true');
    });

    showView('adminView');

    // Ensure header/footer visible
    const header = document.querySelector('.main-header');
    const footer = document.querySelector('.modern-footer');
    if (header) window.DOMUtils.setDisplay(header, '');
    if (footer) window.DOMUtils.setDisplay(footer, '');

    // If admin scripts are not loaded yet, load core styles first
    if (window.AdminLoader && !window.AdminLoader.isLoaded()) {
      if (typeof window.AdminLoader.loadCore === 'function') {
        window.AdminLoader.loadCore({ skipAuthCheck: true }).catch(err => {
          Logger.warn('AdminLoader core failed during restore', 'ADMIN', err);
        });
      }

      // Load main admin bundle in background (may require auth)
      const loadPromise =
        typeof window.AdminLoader.ensureBundle === 'function'
          ? window.AdminLoader.ensureBundle('dashboard', { skipAuthCheck: true })
          : window.AdminLoader.load();

      loadPromise
        .then(() => {
          if (window.showAdminView) {
            setTimeout(() => window.showAdminView(), 0);
          }
        })
        .catch(err => {
          Logger.warn('AdminLoader failed during restore', 'ADMIN', err);
        });
    } else if (window.showAdminView) {
      window.showAdminView();
    }
  }
  /**
   * Remove loading overlay with smooth fade
   */
  function removeLoadingOverlay() {
    // Try both possible IDs for compatibility
    const overlay =
      document.getElementById('loadingScreen') ||
      document.getElementById('auth-loading-overlay');
    if (overlay) {
      // FIX FOUC: Reveal app content
      document.body.classList.add('app-loaded');

      overlay.classList.add('fade-out', 'pointer-events-none');
      setTimeout(() => {
        window.DOMUtils.setDisplay(overlay, 'none');
        Logger.debug('Loading overlay hidden', 'INIT');
        console.groupEnd(); // End Auth Early Initialization
      }, 500);
    } else {
      document.body.classList.add('app-loaded'); // Fallback if no overlay
      console.groupEnd();
    }
  }

  /**
   * Initialize auth state and show correct view
   */
  async function initializeAuthState() {
    if (isInitialized) return;
    const startTime = window.performance.now();

    // Wait for Firebase to be ready
    if (typeof firebase === 'undefined' || !firebase.auth) {
      if (window.Logger && window.Logger.trace) {
        Logger.trace('Waiting for Firebase...', 'INIT');
      }
      setTimeout(initializeAuthState, 100);
      return;
    }

    try {
      Logger.info('Firebase ready, checking auth state...', 'FIREBASE');

      // Verificar si el usuario estaba en admin view antes de recargar
      let wasInAdminView = false;
      try {
        wasInAdminView = localStorage.getItem('adminViewActive') === 'true';
        Logger.debug(`Admin view was active: ${wasInAdminView}`, 'AUTH');
      } catch (error) {
        Logger.warn('Could not check admin view state', 'AUTH', error);
      }

      // Get current user synchronously
      const user = firebase.auth().currentUser;

      if (user) {
        Logger.info(`User already authenticated: ${user.email}`, 'AUTH');

        let isAdminUser = false;
        try {
          if (window.WFX_ADMIN && typeof window.WFX_ADMIN.isAdmin === 'function') {
            isAdminUser = await window.WFX_ADMIN.isAdmin(user, false);
          } else {
            const tokenResult = await user.getIdTokenResult();
            isAdminUser = tokenResult?.claims?.admin === true;
          }
        } catch (e) {
          Logger.warn('Error verificando admin en early init', 'AUTH', e);
        }

        // Si estaba en admin view, NO ocultar todas las vistas
        if (wasInAdminView && isAdminUser) {
          restoreAdminView();
        } else {
          if (wasInAdminView && !isAdminUser) {
            try {
              localStorage.removeItem('adminViewActive');
              localStorage.removeItem('isAdmin');
            } catch (_e) {}
          }
          hideAllViews();
          showView('homeView');
        }

        Logger.perf(
          'Auth Sync Check',
          'AUTH',
          window.performance.now() - startTime
        );
        removeLoadingOverlay();
      } else {
        // ✅ Use AuthManager to avoid duplicates
        if (window.AuthManager) {
          Logger.debug('Registering earlyInit handler in AuthManager', 'AUTH');
          window.AuthManager.registerUniqueAuthHandler(
            'earlyInit',
            async authUser => {
              if (isInitialized) return;
              isInitialized = true;
              Logger.info(
                `Auth state determined (via AuthManager): ${authUser ? authUser.email : 'No user'}`,
                'AUTH'
              );

              if (authUser) {
                let isAdminUser = false;
                try {
                  if (window.WFX_ADMIN && typeof window.WFX_ADMIN.isAdmin === 'function') {
                    isAdminUser = await window.WFX_ADMIN.isAdmin(authUser, false);
                  } else {
                    const tokenResult = await authUser.getIdTokenResult();
                    isAdminUser = tokenResult?.claims?.admin === true;
                  }
                } catch (e) {
                  Logger.warn('Error verificando admin en early init', 'AUTH', e);
                }

                // Si estaba en admin view, NO ocultar todas las vistas
                if (wasInAdminView && isAdminUser) {
                  restoreAdminView();
                } else {
                  if (wasInAdminView && !isAdminUser) {
                    try {
                      localStorage.removeItem('adminViewActive');
                      localStorage.removeItem('isAdmin');
                    } catch (_e) {}
                  }
                  if (!ensureHomeViewStable()) {
                    hideAllViews();
                    showView('homeView');
                  }
                }
              } else {
                // Sin usuario autenticado: mantener homeView pública por defecto
                if (!ensureHomeViewStable()) {
                  hideAllViews();
                  showView('homeView');
                }
                try {
                  localStorage.removeItem('adminViewActive');
                  localStorage.removeItem('isAdmin');
                  console.log(
                    '🗑️ [AUTH] isAdmin y adminViewActive limpiados (logout)'
                  );
                } catch (_e) {}
              }

              Logger.perf(
                'Auth Async State Change',
                'AUTH',
                window.performance.now() - startTime
              );
              removeLoadingOverlay();
            }
          );
        }
      }
    } catch (error) {
      Logger.error('Error initializing auth', 'AUTH', error);
      if (!ensureHomeViewStable()) {
        hideAllViews();
        showView('homeView');
      }
      removeLoadingOverlay();
    }
  }

  // Start initialization when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeAuthState);
  } else {
    initializeAuthState();
  }

  // Also listen for firebaseReady event
  window.addEventListener('firebaseReady', () => {
    Logger.debug(
      'Firebase ready event received in auth-init-early',
      'FIREBASE'
    );
    initializeAuthState();
  });
})();


