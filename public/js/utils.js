/**
 * Utils.js - Funciones de utilidad generales
 * v1.0
 */
'use strict';

function setupUtils() {
  window.Utils = {
    /**
     * Genera un ID único seguro
     */
    generateId: function () {
      return Date.now().toString(36) + Math.random().toString(36).substr(2);
    },

    /**
     * Debounce function replacement if not present
     */
    debounce: function (func, wait) {
      let timeout;
      return function (...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), wait);
      };
    },

    log: function (msg) {
      const cat = (window.LOG_CATEGORIES && window.LOG_CATEGORIES.INFRA) || 'INFRA';
      if (window.Logger) {
        window.Logger.info(msg, cat);
      } else {
        console.info(`[INFRA] ${msg}`);
      }
    },
  };

  if (typeof Logger !== 'undefined' && Logger) {
    Logger.info('Utilities loaded', 'INIT');
  } else {
    console.info('[INIT] Utilities loaded (Logger not ready)');
  }
}

export function initUtils() {
  if (window.__UTILS_INITED__) {
    return;
  }

  window.__UTILS_INITED__ = true;
  setupUtils();
}

if (typeof window !== 'undefined' && !window.__UTILS_NO_AUTO__) {
  initUtils();
}
