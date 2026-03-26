const debugLog = (...args) => {
  if (typeof window.__WFX_DEBUG_LOG__ === 'function') {
    window.__WFX_DEBUG_LOG__(...args);
    return;
  }
  if (window.__WIFIHACKX_DEBUG__ === true || window.__WFX_DEBUG__ === true) {
    console.info(...args);
  }
};

/**
 * nonce-cache.js - Sistema de Caching de Nonce en LocalStorage
 *
 * Reutiliza el nonce dentro de su período de validez (TTL)
 * para reducir requests a la Cloud Function
 */

class NonceCache {
  constructor() {
    this.cacheKey = 'wifihackx_nonce_cache';
    this.ttlKey = 'wifihackx_nonce_ttl';
    this.nonceIdKey = 'wifihackx_nonce_id';
  }

  /**
   * Guarda el nonce en localStorage
   */
  set(nonce, expiresAt, nonceId) {
    try {
      localStorage.setItem(this.cacheKey, nonce);
      localStorage.setItem(this.ttlKey, expiresAt.toString());
      if (nonceId) {
        localStorage.setItem(this.nonceIdKey, nonceId);
      }
      debugLog('💾 [NonceCache] Nonce guardado en cache');
    } catch (e) {
      console.warn('⚠️ [NonceCache] LocalStorage no disponible:', e.message);
    }
  }

  /**
   * Obtiene el nonce del cache si es válido
   */
  get() {
    try {
      const nonce = localStorage.getItem(this.cacheKey);
      const ttl = localStorage.getItem(this.ttlKey);

      if (!nonce || !ttl) {
        return null;
      }

      // Verificar si ha expirado
      if (Date.now() > parseInt(ttl)) {
        debugLog('⏰ [NonceCache] Nonce expirado, limpiando cache');
        this.clear();
        return null;
      }

      debugLog('✅ [NonceCache] Nonce recuperado del cache');
      return {
        nonce: nonce,
        expiresAt: parseInt(ttl),
        nonceId: localStorage.getItem(this.nonceIdKey),
      };
    } catch (e) {
      console.warn('⚠️ [NonceCache] Error leyendo localStorage:', e.message);
      return null;
    }
  }

  /**
   * Limpia el cache
   */
  clear() {
    try {
      localStorage.removeItem(this.cacheKey);
      localStorage.removeItem(this.ttlKey);
      localStorage.removeItem(this.nonceIdKey);
      debugLog('🧹 [NonceCache] Cache limpiado');
    } catch (e) {
      console.warn('⚠️ [NonceCache] Error limpiando localStorage:', e.message);
    }
  }

  /**
   * Verifica si el cache es válido
   */
  isValid() {
    try {
      const ttl = localStorage.getItem(this.ttlKey);
      if (!ttl) return false;

      // Considerar válido si queda más de 30 segundos
      const timeRemaining = parseInt(ttl) - Date.now();
      return timeRemaining > 30000;
    } catch (_e) {
      return false;
    }
  }

  /**
   * Obtiene tiempo restante en segundos
   */
  getTimeRemaining() {
    try {
      const ttl = localStorage.getItem(this.ttlKey);
      if (!ttl) return 0;

      const remaining = parseInt(ttl) - Date.now();
      return remaining > 0 ? Math.floor(remaining / 1000) : 0;
    } catch (_e) {
      return 0;
    }
  }
}

// Exportar como singleton global
window.NonceCache = new NonceCache();
