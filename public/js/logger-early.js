/**
 * logger-early.js
 * Provee una instancia básica de Logger global inmediatamente para evitar TypeErrors
 * en scripts que se ejecutan antes de que el sistema de logging profesional esté listo.
 */

(function () {
  'use strict';

  const debugLog = (...args) => {
    if (window.__WFX_DEBUG__ === true) {
      console.info(...args);
    }
  };

  // Definir categorías básicas si no existen
  window.LOG_CATEGORIES = window.LOG_CATEGORIES || {
    CORE: 'CORE',
    AUTH: 'AUTH',
    INIT: 'INIT',
    ERR: 'ERR',
    PERF: 'PERF',
    FIREBASE: 'FIREBASE',
  };

  const createBasicLogger = () => {
    const _log = (level, msg, cat = 'CORE', data = null) => {
      const prefix = `[${level.toUpperCase()}][${cat}]`;
      if (data) {
        console.info(prefix, msg, data);
      } else {
        console.info(prefix, msg);
      }
    };

    return {
      log: (m, c, d) => _log('info', m, c, d),
      trace: (m, c, d) => _log('trace', m, c, d),
      debug: (m, c, d) => _log('debug', m, c, d),
      info: (m, c, d) => _log('info', m, c, d),
      warn: (m, c, d) => console.warn(`[WARN][${c || 'CORE'}]`, m, d || ''),
      error: (m, c, d) => console.error(`[ERROR][${c || 'ERR'}]`, m, d || ''),
      critical: (m, c, d) =>
        console.error(`🚨 [CRITICAL][${c || 'ERR'}]`, m, d || ''),
      perf: (op, dur, c) =>
        console.info(`[PERF][${c || 'PERF'}] ${op}: ${dur}ms`),
      startGroup: (n, e) => console.group(`${e || '📦'} ${n}`),
      endGroup: () => console.groupEnd(),
      // Compatibilidad con otros métodos
      start: op => console.info(`🔄 Starting: ${op}`),
      success: (m, c) => console.info(`✅ [${c || 'CORE'}] ${m}`),
    };
  };

  // Solo inicializar si no existe ya un Logger
  if (!window.Logger) {
    window.Logger = createBasicLogger();
    debugLog('✅ [LoggerEarly] Basic global logger initialized');
  }
})();
