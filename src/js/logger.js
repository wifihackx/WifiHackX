const debugLog = (...args) => {
  if (window.__WFX_DEBUG__ === true) {
    console.log(...args);
  }
};

/**
 * Sistema de Logging Condicional para Producción
 * Solo muestra logs en desarrollo, silencioso en producción
 */

// Evitar redeclaración si ya existe
if (typeof window.Logger !== 'undefined') {
  console.warn('⚠️ Logger ya está definido, saltando redeclaración');
} else {
  const Logger = {
    // Detectar si estamos en producción
    isProduction: () => {
      return (
        window.location.hostname !== 'localhost' &&
        window.location.hostname !== '127.0.0.1' &&
        !window.location.hostname.includes('local')
      );
    },

    // Logging condicional
    log: (...args) => {
      if (!Logger.isProduction()) {
        debugLog(...args);
      }
    },

    info: (...args) => {
      if (!Logger.isProduction()) {
        console.info(...args);
      }
    },

    warn: (...args) => {
      // Warnings siempre se muestran
      console.warn(...args);
    },

    error: (...args) => {
      // Errors siempre se muestran
      console.error(...args);
    },

    debug: (...args) => {
      if (!Logger.isProduction() && window.DEBUG_MODE) {
        debugLog('[DEBUG]', ...args);
      }
    },

    trace: (...args) => {
      if (!Logger.isProduction()) {
        console.trace(...args);
      }
    },

    // Métodos con emojis para compatibilidad
    success: (operation, details = {}) => {
      if (!Logger.isProduction()) {
        debugLog(`✅ [${operation}] Success:`, {
          timestamp: new Date().toISOString(),
          ...details,
        });
      }
    },

    start: (operation, details = {}) => {
      if (!Logger.isProduction()) {
        debugLog(`🔄 [${operation}] Starting:`, {
          timestamp: new Date().toISOString(),
          ...details,
        });
      }
    },
  };

  // Exponer globalmente
  window.Logger = Logger;

  // Alias para compatibilidad
  if (Logger.isProduction()) {
    // En producción, reemplazar console.log con función vacía
    const noop = () => {};
    window.console.log = noop;
    window.console.info = noop;
    window.console.debug = noop;
  }
} // Fin del if que evita redeclaración
