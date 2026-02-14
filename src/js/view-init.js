/**
 * Inicialización de vista inicial
 * Establece la vista inicial desde AppState o usa homeView por defecto
 * Migrated to use AppState for centralized state management
 * @version 2.0.0 - Window Exposure Pattern
 */

/* global */

// Validate AppState is available
if (!window.AppState) {
  const error = new Error(
    '[view-init.js] Failed to load: window.AppState is not defined. ' +
      'Ensure app-state.js loads before view-init.js.'
  );
  const log = window.Logger || console;
  const cat = (window.LOG_CATEGORIES && window.LOG_CATEGORIES.ERR) || 'ERR';
  (log.error || log.log)(error.message, cat);
  throw error;
}

// Record load time for validation (dev only)
if (window.LoadOrderValidator) {
  window.LoadOrderValidator.recordScriptLoad('view-init.js');
}

'use strict';

function setupViewInit() {

  // Use AppState from window
  const AppState = window.AppState;

  // Load initial view from localStorage or use default
  const defaultView = 'homeView';
  let savedView = localStorage.getItem('currentView') || defaultView;
  const adminOnlyModals = new Set([
    'userFormModal',
    'deleteUserModal',
      'banReasonModal',
      'bannedUserModal',
      'deleteAnnouncementModal',
    ]);

  // Si no hay usuario autenticado, mantener homeView como vista pública estable
  const adminViewActive = localStorage.getItem('adminViewActive') === 'true';
  let authState = null;
  try {
    authState = AppState.getState('user.isAuthenticated');
  } catch (_e) {}

  const hasExplicitAuthState = authState === true || authState === false;
  let isAuthenticated = authState === true;

  try {
    if (
      !isAuthenticated &&
      window.firebase &&
      window.firebase.auth &&
      window.firebase.auth().currentUser
    ) {
      isAuthenticated = true;
    }
  } catch (_e) {}

  if (!isAuthenticated && hasExplicitAuthState) {
    savedView = 'homeView';
    try {
      localStorage.setItem('currentView', 'homeView');
      localStorage.removeItem('adminViewActive');
    } catch (_e) {}
  } else if (adminViewActive) {
    savedView = 'adminView';
  }

  // Clear admin-only modals when starting in a public view
  try {
    const activeModal = AppState.getState('modal.active');
    const isAdminView = savedView === 'adminView';
    if (!isAdminView && adminOnlyModals.has(activeModal)) {
      AppState.setState('modal.active', null, true);
      AppState.setState('modal.data', null, true);
      try {
        localStorage.removeItem('modal.active');
        localStorage.removeItem('modal.data');
      } catch (_e) {}
    }
  } catch (_e) {}

  // Initialize AppState with saved view
  AppState.setState('view.current', savedView);
  AppState.setState('view.previous', null);
  AppState.setState('view.history', [savedView]);

  // Set body attribute
  const setBodyAttribute = () => {
    const currentView = AppState.getState('view.current');
    if (document.body) {
      document.body.setAttribute('data-current-view', currentView);
    }
  };

  if (document.body) {
    setBodyAttribute();
  } else {
    document.addEventListener('DOMContentLoaded', setBodyAttribute);
  }
}

export function initViewInit() {
  if (window.__VIEW_INIT_INITED__) {
    return;
  }

  window.__VIEW_INIT_INITED__ = true;
  setupViewInit();
}

if (typeof window !== 'undefined' && !window.__VIEW_INIT_NO_AUTO__) {
  initViewInit();
}

