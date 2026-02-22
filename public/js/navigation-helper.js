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

const debugLog = (...args) => {
  if (window.__WFX_DEBUG__ === true) {
    console.info(...args);
  }
};

function setupNavigationHelper() {

  // Use AppState from window
  const AppState = window.AppState;

  const log = window.Logger || {
    info: (m, c) => debugLog(`[${c}] ${m}`),
    warn: (m, c) => console.warn(`[${c}] ${m}`),
    error: (m, c, d) => console.error(`[${c}] ${m}`, d),
    debug: (m, c) => debugLog(`[DEBUG][${c}] ${m}`),
  };
  const CAT = window.LOG_CATEGORIES || { NAV: 'NAV' };
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
      debugLog('[PERF]', entry);
    }
  };

  const ViewTemplateLoader = (() => {
    let inflight = null;

    async function ensure(viewId) {
      const view = document.getElementById(viewId);
      if (!view) return;

      const templatePath = view.dataset.template;
      if (!templatePath) return;
      if (view.dataset.templateLoaded === '1') return;
      if (view.children.length > 0) {
        view.dataset.templateLoaded = '1';
        return;
      }
      if (inflight) return inflight;

      inflight = (async () => {
        const startedAt = performance.now();
        const res = await fetch(templatePath, {
          credentials: 'same-origin',
          cache: 'no-cache',
        });
        if (!res.ok) {
          throw new Error(
            `[ViewTemplateLoader] Failed loading ${templatePath}: ${res.status}`
          );
        }
        const html = await res.text();
        view.innerHTML = html;
        view.dataset.templateLoaded = '1';
        const eventName = `${viewId}:templateLoaded`;
        window.dispatchEvent(new CustomEvent(eventName));
        recordPerf('view_template_load', performance.now() - startedAt, {
          viewId,
          templatePath,
        });
        log.debug(`Template loaded for ${viewId}`, CAT.NAV);
      })().finally(() => {
        inflight = null;
      });

      return inflight;
    }

    return { ensure };
  })();
  window.ViewTemplateLoader = window.ViewTemplateLoader || ViewTemplateLoader;

  log.debug('Initializing navigation helper...', CAT.NAV);

  /**
   * Show a specific view and hide others
   * @param {string} viewId - ID of the view to show
   */
  async function showView(viewId) {
    log.debug(`Switching to view: ${viewId}`, CAT.NAV);

    if (
      window.ViewTemplateLoader &&
      typeof window.ViewTemplateLoader.ensure === 'function'
    ) {
      try {
        await window.ViewTemplateLoader.ensure(viewId);
      } catch (error) {
        log.error(`Template load failed for ${viewId}`, CAT.NAV, error);
      }
    }

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
  async function showLoginView() {
    log.debug('Opening login view...', CAT.NAV);
    await showView('loginView');
  }

  /**
   * Show home view
   */
  async function showHomeView() {
    log.debug('Opening home view...', CAT.NAV);
    await showView('homeView');
  }

  /**
   * Go back to home
   */
  async function goHome() {
    log.debug('Going back to home...', CAT.NAV);
    await showHomeView();
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
  AppState.subscribe('view.current', async (newView, oldView) => {
    log.debug('View state changed via AppState observer', CAT.NAV);
    log.debug(`Old view: ${oldView}`, CAT.NAV);
    log.debug(`New view: ${newView}`, CAT.NAV);

    // Only update UI if the change came from external code (not from showView)
    // Check if the DOM already reflects the change
    const currentBodyView = document.body.getAttribute('data-current-view');

    if (currentBodyView !== newView) {
      log.debug('Syncing UI with AppState...', CAT.NAV);

      if (
        window.ViewTemplateLoader &&
        typeof window.ViewTemplateLoader.ensure === 'function'
      ) {
        try {
          await window.ViewTemplateLoader.ensure(newView);
        } catch (error) {
          log.error(`Template sync load failed for ${newView}`, CAT.NAV, error);
        }
      }

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



