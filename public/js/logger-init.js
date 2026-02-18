/**
 * Logger Initialization Script
 * Loads and initializes the logging system early in the page lifecycle
 *
 * @version 2.0.0
 */

(async function initLogger() {
  'use strict';

  try {
    // Import logger modules
    const { default: Logger, LOG_CATEGORIES } =
      await import('./logger-strategy.js');

    // Expose globally
    window.Logger = Logger;
    window.LOG_CATEGORIES = LOG_CATEGORIES;

    // Log successful initialization
    Logger.info('Logging system initialized', LOG_CATEGORIES.INIT);

    // Setup global error handler
    window.addEventListener('error', event => {
      Logger.error(`Uncaught error: ${event.message}`, LOG_CATEGORIES.ERROR, {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error,
      });
    });

    // Setup unhandled promise rejection handler
    window.addEventListener('unhandledrejection', event => {
      Logger.error(
        `Unhandled promise rejection: ${event.reason}`,
        LOG_CATEGORIES.ERROR,
        {
          reason: event.reason,
        }
      );
    });

    // Log page load performance
    window.addEventListener('load', () => {
      if (!window.performance) return;

      let loadTime = null;

      // Prefer Navigation Timing Level 2
      if (typeof performance.getEntriesByType === 'function') {
        const navEntry = performance.getEntriesByType('navigation')[0];
        if (navEntry && typeof navEntry.loadEventEnd === 'number') {
          loadTime = navEntry.loadEventEnd;
        }
      }

      // Fallback to legacy timing if needed
      if (loadTime === null && performance.timing) {
        const timing = performance.timing;
        if (timing.loadEventEnd && timing.navigationStart) {
          loadTime = timing.loadEventEnd - timing.navigationStart;
        }
      }

      // Last resort: use performance.now()
      if (loadTime === null && typeof performance.now === 'function') {
        loadTime = performance.now();
      }

      if (typeof loadTime === 'number' && loadTime >= 0) {
        Logger.perf('Page Load', loadTime, LOG_CATEGORIES.PERF);
      } else {
        Logger.warn(
          `Page Load duration inválida: ${loadTime}`,
          LOG_CATEGORIES.PERF
        );
      }
    });

    console.log('✅ [Logger Init] Global error handlers configured');
  } catch (error) {
    console.error(
      '❌ [Logger Init] Failed to initialize logging system:',
      error
    );
  }
})();
