/**
 * Navigation Helper
 * Handles view switching and navigation between different sections
 * Migrated to use AppState for centralized state management
 * @version 2.0.0 - Window Exposure Pattern
 */

/* global */

// Validate AppState is available
if (!window.AppState) {
  const error = new Error(
    '[navigation-helper.js] Failed to load: window.AppState is not defined. ' +
      'Ensure app-state.js loads before navigation-helper.js.'
  );
  console.error(error);
  throw error;
}

// Record load time for validation (dev only)
if (window.LoadOrderValidator) {
  window.LoadOrderValidator.recordScriptLoad('navigation-helper.js');
}

// Use AppState from window
'use strict';

function setupNavigationHelper() {

  // Use AppState from window
  const AppState = window.AppState;

  const log = window.Logger || {
    info: (m, c) => console.log(`[${c}] ${m}`),
    warn: (m, c) => console.warn(`[${c}] ${m}`),
    error: (m, c, d) => console.error(`[${c}] ${m}`, d),
    debug: (m, c) => console.log(`[DEBUG][${c}] ${m}`),
  };
  const CAT = window.LOG_CATEGORIES || { NAV: 'NAV' };

  log.debug('Initializing navigation helper...', CAT.NAV);

  /**
   * Show a specific view and hide others
   * @param {string} viewId - ID of the view to show
   */
  function showView(viewId) {
    log.debug(`Switching to view: ${viewId}`, CAT.NAV);

    // Get current view for history
    const previousView = AppState.getState('view.current');

    // Get all views
    const views = document.querySelectorAll('.view, section.view');

    // Hide all views
    views.forEach(view => {
      view.classList.remove('active');
      view.classList.add('hidden');
      window.DOMUtils.setDisplay(view, 'none');
    });

    // Show the requested view
    const targetView = document.getElementById(viewId);
    if (targetView) {
      targetView.classList.add('active');
      targetView.classList.remove('hidden');
      window.DOMUtils.setDisplay(targetView, 'block');

      // Hide/Show header and footer based on view
      const header = document.querySelector('.main-header');
      const footer = document.querySelector('.modern-footer');
      if (viewId === 'loginView') {
        if (header) window.DOMUtils.setDisplay(header, 'none');
        if (footer) window.DOMUtils.setDisplay(footer, 'none');
      } else {
        if (header) window.DOMUtils.setDisplay(header, '');
        if (footer) window.DOMUtils.setDisplay(footer, '');
      }

      // Update AppState with new view
      AppState.setState('view.current', viewId);
      AppState.setState('view.previous', previousView);

      // Update history
      const history = AppState.getState('view.history') || [];
      AppState.setState('view.history', [...history, viewId]);

      // Update body attribute
      document.body.setAttribute('data-current-view', viewId);

      // Save to localStorage for persistence
      localStorage.setItem('currentView', viewId);

      log.debug(`View ${viewId} is now active`, CAT.NAV);
      log.debug(`Previous view was: ${previousView}`, CAT.NAV);
    } else {
      log.error(`View ${viewId} not found`, CAT.NAV);
    }
  }

  /**
   * Show login view
   */
  function showLoginView() {
    log.debug('Opening login view...', CAT.NAV);
    showView('loginView');
  }

  /**
   * Show home view
   */
  function showHomeView() {
    log.debug('Opening home view...', CAT.NAV);
    showView('homeView');
  }

  /**
   * Go back to home
   */
  function goHome() {
    log.debug('Going back to home...', CAT.NAV);
    showHomeView();
  }

  // Export functions globally
  window.showView = showView;
  window.showLoginView = showLoginView;
  window.showHomeView = showHomeView;
  window.goHome = goHome;

  // Register with EventDelegation if available
  if (window.EventDelegation) {
    window.EventDelegation.registerHandler('showLoginView', showLoginView);
    window.EventDelegation.registerHandler('showHomeView', showHomeView);
    window.EventDelegation.registerHandler('goHome', goHome);
    log.debug('Handlers registered with EventDelegation', CAT.NAV);
  }

  // Subscribe to view state changes from AppState
  // This allows external code to trigger navigation programmatically
  AppState.subscribe('view.current', (newView, oldView) => {
    log.debug('View state changed via AppState observer', CAT.NAV);
    log.debug(`Old view: ${oldView}`, CAT.NAV);
    log.debug(`New view: ${newView}`, CAT.NAV);

    // Only update UI if the change came from external code (not from showView)
    // Check if the DOM already reflects the change
    const currentBodyView = document.body.getAttribute('data-current-view');

    if (currentBodyView !== newView) {
      log.debug('Syncing UI with AppState...', CAT.NAV);

      // Hide all views
      const views = document.querySelectorAll('.view, section.view');
      views.forEach(view => {
        view.classList.remove('active');
        view.classList.add('hidden');
        window.DOMUtils.setDisplay(view, 'none');
      });

      // Show the new view
      const targetView = document.getElementById(newView);
      if (targetView) {
        targetView.classList.add('active');
        targetView.classList.remove('hidden');
        window.DOMUtils.setDisplay(targetView, 'block');

        // Sync header/footer visibility
        const header = document.querySelector('.main-header');
        const footer = document.querySelector('.modern-footer');
        if (newView === 'loginView') {
          if (header) window.DOMUtils.setDisplay(header, 'none');
          if (footer) window.DOMUtils.setDisplay(footer, 'none');
        } else {
          if (header) window.DOMUtils.setDisplay(header, '');
          if (footer) window.DOMUtils.setDisplay(footer, '');
        }

        document.body.setAttribute('data-current-view', newView);
        localStorage.setItem('currentView', newView);
        log.debug('UI synced with AppState', CAT.NAV);
      }
    }
  });

  log.debug('Navigation helper loaded', CAT.NAV);
}

export function initNavigationHelper() {
  if (window.__NAVIGATION_HELPER_INITED__) {
    return;
  }

  window.__NAVIGATION_HELPER_INITED__ = true;
  setupNavigationHelper();
}

if (typeof window !== 'undefined' && !window.__NAVIGATION_HELPER_NO_AUTO__) {
  initNavigationHelper();
}
