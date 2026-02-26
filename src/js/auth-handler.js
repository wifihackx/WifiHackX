/**
 * AUTH HANDLER v1.0
 * ============================================
 * Elimina logs duplicados en listeners de auth
 * Aplica el patrón de una sola ejecución
 *
 * Problema detectado:
 * - onAuthStateChanged se ejecutaba múltiples veces
 * - Logs aparecían duplicados
 * - Consumía resources innecesariamente
 */

(function () {
  'use strict';

  class AuthHandlerManager {
    constructor() {
      this.handlers = new Map();
      this.listenerRefs = new Map();
      this.initialized = false;
    }

    /**
     * Registrar handler único para auth state change
     */
    registerUniqueAuthHandler(name, callback) {
      if (this.handlers.has(name)) {
        Logger.debug(`Overwriting auth handler: ${name}`, 'AUTH');
      }

      this.handlers.set(name, callback);
      Logger.debug(`Registered unique auth handler: ${name}`, 'AUTH');
    }

    /**
     * Inicializar listeners de Firebase Auth UNA SOLA VEZ
     */
    initializeAuthListeners(auth) {
      if (this.initialized) {
        Logger.warn('Auth listeners already initialized, skipping', 'AUTH');
        return;
      }

      Logger.debug('Initializing auth listeners (SINGLE EXECUTION)', 'AUTH');

      const unsubscribe = auth.onAuthStateChanged(user => {
        this.handleAuthStateChange(user);
      });

      this.listenerRefs.set('mainAuthListener', unsubscribe);
      this.initialized = true;

      Logger.info('Auth listener initialized successfully', 'AUTH');
    }

    /**
     * Manejador centralizado de cambios de auth
     */
    handleAuthStateChange(user) {
      Logger.info(user ? `User authenticated: ${user.email}` : 'User logged out', 'AUTH');

      for (const [name, callback] of this.handlers) {
        try {
          callback(user);
          Logger.debug(`Handler executed: ${name}`, 'AUTH');
        } catch (error) {
          Logger.error(`Error in handler ${name}: ${error.message}`, 'AUTH');
        }
      }

      // AppState se actualiza en auth.js (fuente de verdad de UI/roles).
      // Este manager solo despacha eventos y callbacks para evitar estados duplicados.
      // Compatibilidad: mantener un estado base de autenticación para módulos legacy.
      if (window.AppState && typeof window.AppState.setState === 'function') {
        const prevUser =
          typeof window.AppState.getState === 'function'
            ? window.AppState.getState('user') || {}
            : {};
        if (user) {
          window.AppState.setState('user', {
            ...prevUser,
            isAuthenticated: true,
            uid: user.uid || prevUser.uid || null,
            email: user.email || prevUser.email || null,
            displayName: user.displayName || prevUser.displayName || user.email || 'Usuario',
            photoURL: user.photoURL || prevUser.photoURL || null,
          });
        } else {
          window.AppState.setState('user', {
            ...prevUser,
            isAuthenticated: false,
            uid: null,
            email: null,
            displayName: null,
            photoURL: null,
            isAdmin: false,
            role: 'client',
          });
        }
      }

      // Emit auth-ready event
      if (user) {
        window.dispatchEvent(
          new CustomEvent('auth:ready', {
            detail: { uid: user.uid, email: user.email },
          })
        );
      } else {
        window.dispatchEvent(new CustomEvent('auth:logout'));
      }

      // Debug admin claims in local dev (sin mutar AppState)
      try {
        if (
          user &&
          typeof user.getIdTokenResult === 'function' &&
          window.location &&
          (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
        ) {
          user
            .getIdTokenResult()
            .then(result => {
              Logger.debug('[Auth] ID token claims', 'AUTH', result.claims);
              Logger.debug('[Auth] token email', 'AUTH', {
                email: result.claims?.email || null,
              });
              const isAdmin =
                !!result.claims?.admin ||
                result.claims?.role === 'admin' ||
                result.claims?.role === 'super_admin';
              if (isAdmin) {
                window.dispatchEvent(
                  new CustomEvent('user:admin-detected', {
                    detail: { uid: user.uid, email: user.email },
                  })
                );
              }
            })
            .catch(err => {
              console.warn('[Auth] Failed to read ID token claims:', err);
            });
        }
      } catch (e) {
        console.warn('[Auth] Claims debug failed:', e);
      }
    }

    cleanup() {
      for (const [_name, unsubscribe] of this.listenerRefs) {
        if (typeof unsubscribe === 'function') {
          unsubscribe();
        }
      }
      this.handlers.clear();
      this.listenerRefs.clear();
      this.initialized = false;
      Logger.info('Auth handler cleanup completed', 'AUTH');
    }
  }

  // Crear instancia global
  const AuthManager = new AuthHandlerManager();
  window.AuthManager = AuthManager;
})();
