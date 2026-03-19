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

  window.__WFX_AUTH_EARLY_INIT_ACTIVE__ = true;

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
      if (preserveAdminView && view.id === 'adminView') {
        Logger.debug('Preserving adminView visibility', 'INIT');
        return;
      }

      view.classList.remove('active');
      view.classList.add('hidden');
      window.DOMUtils.setDisplay(view, 'none');
      view.setAttribute('aria-hidden', 'true');
    });

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

    const isAlreadyVisible =
      homeView.classList.contains('active') && !homeView.classList.contains('hidden');
    if (!isAlreadyVisible) return false;

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

  function getUnauthenticatedView() {
    const configuredView =
      (window.RUNTIME_CONFIG &&
        window.RUNTIME_CONFIG.auth &&
        window.RUNTIME_CONFIG.auth.unauthenticatedView) ||
      '';
    if (configuredView === 'homeView' || configuredView === 'loginView') {
      return configuredView;
    }
    return 'homeView';
  }

  function showUnauthenticatedView() {
    const targetView = getUnauthenticatedView();
    if (targetView === 'homeView' && ensureHomeViewStable()) {
      return;
    }
    hideAllViews();
    showView(targetView);
  }

  function getCachedAdminFlag() {
    try {
      return localStorage.getItem('isAdmin') === 'true';
    } catch (_e) {
      return false;
    }
  }

  /**
   * Restore admin view safely even if admin scripts are not loaded yet
   */
  function restoreAdminView() {
    Logger.info('Restoring admin view (safe fallback)...', 'ADMIN');

    const publicViews = document.querySelectorAll('.view:not(#adminView)');
    publicViews.forEach(view => {
      view.classList.remove('active');
      view.classList.add('hidden');
      window.DOMUtils.setDisplay(view, 'none');
      view.setAttribute('aria-hidden', 'true');
    });

    showView('adminView');

    const header = document.querySelector('.main-header');
    const footer = document.querySelector('.modern-footer');
    if (header) window.DOMUtils.setDisplay(header, '');
    if (footer) window.DOMUtils.setDisplay(footer, '');

    if (window.AdminLoader && !window.AdminLoader.isLoaded()) {
      if (typeof window.AdminLoader.loadCore === 'function') {
        window.AdminLoader.loadCore({
          skipAuthCheck: true,
        }).catch(err => {
          Logger.warn('AdminLoader core failed during restore', 'ADMIN', err);
        });
      }

      const loadPromise =
        typeof window.AdminLoader.ensureBundle === 'function'
          ? window.AdminLoader.ensureBundle('dashboard', {
              skipAuthCheck: true,
            })
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
    const overlay =
      document.getElementById('loadingScreen') || document.getElementById('auth-loading-overlay');
    if (overlay) {
      document.body.classList.add('app-loaded');

      overlay.classList.add('fade-out', 'pointer-events-none');
      setTimeout(() => {
        window.DOMUtils.setDisplay(overlay, 'none');
        Logger.debug('Loading overlay hidden', 'INIT');
        console.groupEnd();
      }, 500);
    } else {
      document.body.classList.add('app-loaded');
      console.groupEnd();
    }
  }

  /**
   * Initialize auth state and show correct view
   */
  async function initializeAuthState() {
    if (isInitialized) return;
    const startTime = window.performance.now();

    if (typeof firebase === 'undefined' || !firebase.auth) {
      if (window.Logger && window.Logger.trace) {
        Logger.trace('Waiting for Firebase...', 'INIT');
      }
      setTimeout(initializeAuthState, 100);
      return;
    }

    try {
      Logger.info('Firebase ready, checking auth state...', 'FIREBASE');

      let wasInAdminView = false;
      try {
        wasInAdminView = localStorage.getItem('adminViewActive') === 'true';
        Logger.debug(`Admin view was active: ${wasInAdminView}`, 'AUTH');
      } catch (error) {
        Logger.warn('Could not check admin view state', 'AUTH', error);
      }

      const user = firebase.auth().currentUser;

      if (user) {
        Logger.info(`User already authenticated: ${user.email}`, 'AUTH');
        const isAdminUser = getCachedAdminFlag();

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

        Logger.perf('Auth Sync Check', 'AUTH', window.performance.now() - startTime);
        removeLoadingOverlay();
      } else if (window.AuthManager) {
        Logger.debug('Registering earlyInit handler in AuthManager', 'AUTH');
        window.AuthManager.registerUniqueAuthHandler('earlyInit', async authUser => {
          if (isInitialized) return;
          isInitialized = true;
          Logger.info(
            `Auth state determined (via AuthManager): ${authUser ? authUser.email : 'No user'}`,
            'AUTH'
          );

          if (authUser) {
            const isAdminUser = getCachedAdminFlag();

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
            showUnauthenticatedView();
            try {
              localStorage.removeItem('adminViewActive');
              localStorage.removeItem('isAdmin');
              console.info('[AUTH] isAdmin y adminViewActive limpiados (logout)');
            } catch (_e) {}
          }

          Logger.perf('Auth Async State Change', 'AUTH', window.performance.now() - startTime);
          removeLoadingOverlay();
        });
      }
    } catch (error) {
      Logger.error('Error initializing auth', 'AUTH', error);
      showUnauthenticatedView();
      removeLoadingOverlay();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeAuthState);
  } else {
    initializeAuthState();
  }

  window.addEventListener('firebaseReady', () => {
    Logger.debug('Firebase ready event received in auth-init-early', 'FIREBASE');
    initializeAuthState();
  });
})();
