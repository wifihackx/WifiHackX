/**
 * System Integration
 * Registers all modules with ModuleInitializer and sets up proper initialization order
 * Feature: admin-functionality-stabilization
 */

'use strict';

function setupSystemIntegration() {

  // Fallback del logger
  const logSystem = window.Logger || {
    info: () => {},
    warn: (m, c) => console.warn(`[${c}] ${m}`),
    error: (m, c, d) => console.error(`[${c}] ${m}`, d),
    debug: () => {},
    startGroup: (_n, e) => console.group(`${e || ''} ${_n}`),
    endGroup: _n => console.groupEnd(),
  };
  const CAT = window.LOG_CATEGORIES || {
    INFRA: 'INFRA',
    INIT: 'INIT',
    ERR: 'ERR',
  };

  logSystem.info('Starting system integration', CAT.INIT);

  // Wait for DOM and core systems to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeSystem);
  } else {
    initializeSystem();
  }

  function initializeSystem() {
    // Verify core systems are available
    if (!window.ModuleInitializer) {
      logSystem.error('ModuleInitializer not available', CAT.INFRA);
      return;
    }

    if (!window.EventDelegationManager) {
      logSystem.error('EventDelegationManager not available', CAT.INFRA);
      return;
    }

    logSystem.debug('Core systems verified', CAT.INFRA);

    // Register all modules with proper dependencies
    registerCoreModules();
    registerFirebaseModules();
    registerUIModules();
    registerAdminModules();

    logSystem.info('All modules registered', CAT.INIT);
  }

  /**
   * Register core modules (no dependencies)
   */
  function registerCoreModules() {
    // Firestore Data Cleaner (no dependencies)
    window.ModuleInitializer.register(
      'firestore-data-cleaner',
      async () => {
        logSystem.debug('Firestore Data Cleaner ready', CAT.INFRA);
        return true;
      },
      []
    );

    // Event Delegation Manager (no dependencies)
    window.ModuleInitializer.register(
      'event-delegation-manager',
      async () => {
        logSystem.debug('Event Delegation Manager ready', CAT.INFRA);
        return true;
      },
      []
    );
  }

  /**
   * Register Firebase-dependent modules
   */
  function registerFirebaseModules() {
    // Firebase initialization
    window.ModuleInitializer.register(
      'firebase-init',
      async () => {
        // Wait for Firebase to be available
        if (typeof firebase === 'undefined') {
          logSystem.warn(
            'Firebase not available, skipping initialization',
            CAT.INFRA
          );
          return false;
        }
        logSystem.debug('Firebase initialized', CAT.INFRA);
        return true;
      },
      []
    );

    // Auth system
    window.ModuleInitializer.register(
      'auth-system',
      async () => {
        if (window.AuthSystem) {
          logSystem.debug('Auth System ready', CAT.INFRA);
          return true;
        }
        return false;
      },
      ['firebase-init']
    );
  }

  /**
   * Register UI modules
   */
  function registerUIModules() {
    // Language Selector
    window.ModuleInitializer.register(
      'language-selector',
      async () => {
        if (window.LanguageOptionsGenerator) {
          logSystem.debug('Language Selector ready', CAT.INFRA);
          return true;
        }
        return false;
      },
      ['event-delegation-manager']
    );

    // Accessibility Panel
    window.ModuleInitializer.register(
      'accessibility-panel',
      async () => {
        logSystem.debug('Accessibility Panel ready', CAT.INFRA);
        return true;
      },
      ['event-delegation-manager']
    );

    // Notification System
    window.ModuleInitializer.register(
      'notification-system',
      async () => {
        if (window.NotificationSystem) {
          logSystem.debug('Notification System ready', CAT.INFRA);
          return true;
        }
        return false;
      },
      []
    );

    // Post-Checkout Handler
    window.ModuleInitializer.register(
      'post-checkout-handler',
      async () => {
        logSystem.debug('Post-Checkout Handler ready', CAT.INFRA);
        return true;
      },
      ['notification-system']
    );
  }

  /**
   * Register admin modules
   */
  function registerAdminModules() {
    // Users Manager
    window.ModuleInitializer.register(
      'users-manager',
      async () => {
        if (window.UsersManager) {
          logSystem.debug('Users Manager ready', CAT.INFRA);
          return true;
        }
        return false;
      },
      ['firebase-init', 'event-delegation-manager', 'firestore-data-cleaner']
    );

    // Dashboard Stats
    window.ModuleInitializer.register(
      'dashboard-stats',
      async () => {
        if (window.DashboardStatsManager) {
          logSystem.debug('Dashboard Stats ready', CAT.INFRA);
          return true;
        }
        return false;
      },
      ['firebase-init', 'auth-system']
    );

    // Announcements Manager
    window.ModuleInitializer.register(
      'announcements-manager',
      async () => {
        if (window.AnnouncementFormHandler) {
          logSystem.debug('Announcements Manager ready', CAT.INFRA);
          return true;
        }
        return false;
      },
      ['firebase-init', 'event-delegation-manager', 'firestore-data-cleaner']
    );

    // Admin Panel
    window.ModuleInitializer.register(
      'admin-panel',
      async () => {
        logSystem.debug('Admin Panel ready', CAT.INFRA);
        return true;
      },
      [
        'firebase-init',
        'auth-system',
        'users-manager',
        'dashboard-stats',
        'announcements-manager',
      ]
    );
  }

  // Expose for debugging
  if (
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1'
  ) {
    window.systemIntegrationDebug = {
      initializeAll: () => window.ModuleInitializer.initializeAll(),
      getStatus: () => window.moduleInitDebug.getStatus(),
      getRegistered: () => window.moduleInitDebug.getRegistered(),
      getInitialized: () => window.moduleInitDebug.getInitialized(),
    };
  }

  logSystem.info('System integration ready', CAT.INIT);
}

export function initSystemIntegration() {
  if (window.__SYSTEM_INTEGRATION_INITED__) {
    return;
  }

  window.__SYSTEM_INTEGRATION_INITED__ = true;
  setupSystemIntegration();
}

if (typeof window !== 'undefined' && !window.__SYSTEM_INTEGRATION_NO_AUTO__) {
  initSystemIntegration();
}
