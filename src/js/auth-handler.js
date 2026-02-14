/**
 * AUTH HANDLER FIX v1.0
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
      Logger.info(
        user ? `User authenticated: ${user.email}` : 'User logged out',
        'AUTH'
      );

      for (const [name, callback] of this.handlers) {
        try {
          callback(user);
          Logger.debug(`Handler executed: ${name}`, 'AUTH');
        } catch (error) {
          Logger.error(`Error in handler ${name}: ${error.message}`, 'AUTH');
        }
      }

      // Actualizar AppState UNA SOLA VEZ
      if (window.AppState && typeof window.AppState.setState === 'function') {
        if (user) {
          const baseState = {
            isAuthenticated: true,
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
            providerId: user.providerId,
            isAdmin: false,
          };
          window.AppState.setState('user', baseState);

          // Admin check (single-admin) in background.
          const checkAdmin = async () => {
            try {
              if (window.WFX_ADMIN && typeof window.WFX_ADMIN.isAdmin === 'function') {
                return await window.WFX_ADMIN.isAdmin(user, true);
              }
              const res = await user.getIdTokenResult(true);
              return res?.claims?.admin === true;
            } catch (_e) {
              return false;
            }
          };
          checkAdmin().then(isAdmin => {
            window.AppState.setState('user', { ...baseState, isAdmin });
            if (isAdmin) {
              window.dispatchEvent(
                new CustomEvent('user:admin-detected', {
                  detail: { uid: user.uid, email: user.email },
                })
              );
            }
          });
        } else {
          window.AppState.setState('user', { isAuthenticated: false });
        }
        Logger.debug('AppState updated with user', 'AUTH');
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

      // Optional debug in dev (do not change logic).
      try {
        if (
          user &&
          typeof user.getIdTokenResult === 'function' &&
          window.location &&
          (window.location.hostname === 'localhost' ||
            window.location.hostname === '127.0.0.1')
        ) {
          user.getIdTokenResult().then(result => {
            console.log('[Auth] ID token claims:', result.claims);
          }).catch(() => {});
        }
      } catch (_e) {}
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
