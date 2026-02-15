/**
 * logger-early.js
 * Provee una instancia básica de Logger global inmediatamente para evitar TypeErrors
 * en scripts que se ejecutan antes de que el sistema de logging profesional esté listo.
 */

(function () {
  'use strict';

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
        console.log(prefix, msg, data);
      } else {
        console.log(prefix, msg);
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
        console.log(`[PERF][${c || 'PERF'}] ${op}: ${dur}ms`),
      // Used by auth-init-early during module load.
      section: (name, category = '') => {
        const prefix = category ? `[${category}] ` : '';
        console.group(`📌 ${prefix}${name}`);
      },
      startGroup: (n, e) => console.group(`${e || '📦'} ${n}`),
      endGroup: () => console.groupEnd(),
      // Compatibilidad con otros métodos
      start: op => console.log(`🔄 Starting: ${op}`),
      success: (m, c) => console.log(`✅ [${c || 'CORE'}] ${m}`),
      clearCache: () => {},
      setLevel: () => {},
      expose: () => {},
    };
  };

  // Solo inicializar si no existe ya un Logger
  if (!window.Logger) {
    window.Logger = createBasicLogger();
    console.log('✅ [LoggerEarly] Basic global logger initialized');
  }
})();
