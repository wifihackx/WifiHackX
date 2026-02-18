/**
 * Real-Time Data Service - Centraliza todas las suscripciones a Firestore
 * Evita múltiples listeners para la misma colección
 * Proporciona streams de datos en tiempo real para Dashboard y Admin Panel
 * @version 1.0.0
 */

export function initRealTimeDataService() {
  'use strict';

const debugLog = (...args) => {
  if (window.__WIFIHACKX_DEBUG__ === true) {
    console.info(...args);
  }
};

  if (window.__REALTIME_DATA_SERVICE_INITED__) {
    return;
  }
  window.__REALTIME_DATA_SERVICE_INITED__ = true;

  if (!window.RealTimeDataService) {
    const RealTimeDataService = class RealTimeDataService {
    constructor() {
      this.db = null;
      this.listeners = new Map(); // Almacena todos los listeners activos
      this.initialized = false;
      this.pendingAuth = new Map(); // Suscripciones pendientes por auth
    }

      /**
       * Inicializa el servicio esperando a Firebase
       */
      async init() {
        if (this.initialized) {
          Logger.warn('RealTimeDataService ya inicializado', 'INIT');
          return;
        }

        // Esperar evento de inicialización de Firebase (más confiable que polling)
        if (!window.db) {
          Logger.debug('Esperando evento firebase:initialized...', 'INIT');

          try {
            await this._waitForFirebaseEvent();
          } catch (error) {
            Logger.error(
              'RealTimeDataService: Timeout esperando Firebase',
              'ERR',
              error
            );
            return;
          }
        }

        this.db = window.db;

        if (!this.db) {
          Logger.error(
            'RealTimeDataService: window.db no disponible después del evento',
            'ERR'
          );
          return;
        }

        this.initialized = true;
        Logger.info('RealTimeDataService inicializado correctamente', 'INIT');
      }

      /**
       * Espera el evento firebase:initialized con timeout
       * @private
       */
      _waitForFirebaseEvent() {
        return new Promise((resolve, reject) => {
          // Si ya está inicializado, resolver inmediatamente
          if (window.db) {
            resolve();
            return;
          }

          const timeout = setTimeout(() => {
            window.removeEventListener('firebase:initialized', handler);
            reject(new Error('Timeout esperando firebase:initialized (5s)'));
          }, 5000);

          const handler = () => {
            clearTimeout(timeout);
            window.removeEventListener('firebase:initialized', handler);
            Logger.debug('Evento firebase:initialized recibido', 'INIT');
            resolve();
          };

          window.addEventListener('firebase:initialized', handler);
        });
      }

      /**
       * Suscribe a cambios en una colección
       * @param {string} collection - Nombre de la colección
       * @param {Function} callback - Función a llamar cuando hay cambios (snapshot)
       * @param {Object} options - Opciones adicionales
       * @returns {Function} Función para unsuscribirse
       */
      subscribeToCollection(collection, callback, options = {}) {
        if (!this.db) {
          Logger.warn('RealTimeDataService: Firebase no inicializado', 'WARN');
          return () => {};
        }

        if (this.pendingAuth.has(collection)) {
          debugLog(
            `[RealTimeDataService] Suscripción pendiente por auth para ${collection}`
          );
          return () => {
            const state = this.pendingAuth.get(collection);
            if (state) {
              if (state.listenerUnsub) state.listenerUnsub();
              if (state.unsubscribe) state.unsubscribe();
              this.pendingAuth.delete(collection);
            }
          };
        }

        // ✅ Auth (modular + compat)
        const authCandidates = [];
        if (window.auth) authCandidates.push(window.auth);
        if (window.firebase && window.firebase.auth) {
          try {
            authCandidates.push(window.firebase.auth());
          } catch (_e) {}
        }

        const authInstance =
          authCandidates.find(a => a && a.currentUser) ||
          authCandidates[0] ||
          null;

        if (!authInstance) {
          console.warn(
            `⚠️ RealTimeDataService: Firebase Auth no disponible para ${collection}`
          );
          return () => {};
        }

        const user = authInstance.currentUser || null;
        if (!user) {
          console.warn(
            `⚠️ RealTimeDataService: No authenticated user, skipping subscription to ${collection}`
          );
          // Reintentar automáticamente cuando el usuario se autentique
          if (!this.pendingAuth.has(collection)) {
            const state = {
              unsubscribe: null,
              listenerUnsub: null,
              firebaseInitListener: null,
              retryTimer: null,
            };
            const handler = u => {
              if (u) {
                if (state.listenerUnsub) state.listenerUnsub();
                state.listenerUnsub = null;
                if (state.firebaseInitListener) {
                  window.removeEventListener(
                    'firebase:initialized',
                    state.firebaseInitListener
                  );
                  state.firebaseInitListener = null;
                }
                if (state.retryTimer) {
                  clearInterval(state.retryTimer);
                  state.retryTimer = null;
                }
                this.pendingAuth.delete(collection);
                state.unsubscribe = this.subscribeToCollection(
                  collection,
                  callback,
                  options
                );
              }
            };
            const registerListener = authObj => {
              if (
                window.firebaseModular &&
                window.firebaseModular.onAuthStateChanged &&
                authObj
              ) {
                return window.firebaseModular.onAuthStateChanged(authObj, handler);
              }
              if (authObj && authObj.onAuthStateChanged) {
                return authObj.onAuthStateChanged(handler);
              }
              return null;
            };

            state.listenerUnsub = registerListener(authInstance);

            // También registrar en otros auth candidates si existen
            if (!state.listenerUnsub && authCandidates.length > 1) {
              for (const candidate of authCandidates) {
                const unsub = registerListener(candidate);
                if (unsub) {
                  state.listenerUnsub = unsub;
                  break;
                }
              }
            }

            // Fallback: polling corto hasta que aparezca currentUser
            if (!state.retryTimer) {
              state.retryTimer = setInterval(() => {
                const current =
                  window.auth?.currentUser ||
                  (window.firebase && window.firebase.auth
                    ? window.firebase.auth().currentUser
                    : null);
                if (current) {
                  handler(current);
                }
              }, 500);
            }
            this.pendingAuth.set(collection, state);
          }
          return () => {
            const state = this.pendingAuth.get(collection);
            if (state) {
              if (state.listenerUnsub) state.listenerUnsub();
              if (state.firebaseInitListener) {
                window.removeEventListener(
                  'firebase:initialized',
                  state.firebaseInitListener
                );
              }
              if (state.retryTimer) {
                clearInterval(state.retryTimer);
              }
              if (state.unsubscribe) state.unsubscribe();
              this.pendingAuth.delete(collection);
            }
          };
        }

        const adminOnlyCollections = new Set([
          'orders',
          'processedEvents',
          'activities',
          'security_logs',
          'security_logs_diagnostics',
          'alerts',
        ]);
        if (adminOnlyCollections.has(collection) && user.getIdTokenResult) {
          // Verificar claim admin antes de suscribir
          const getClaims = window.getAdminClaims
            ? window.getAdminClaims(user, false)
            : user.getIdTokenResult(true).then(r => r.claims);
          return Promise.resolve(getClaims)
            .then(claims => {
              const isAdmin = !!claims?.admin;
              if (!isAdmin) {
                console.warn(
                  `⚠️ RealTimeDataService: Usuario no admin, omitimos suscripción a ${collection}`
                );
                return () => {};
              }
              debugLog(
                `✅ RealTimeDataService: Usuario autenticado (${user.email}), suscribiendo a ${collection}`
              );
              return this._subscribeInternal(collection, callback, options);
            })
            .catch(() => {
              console.warn(
                `⚠️ RealTimeDataService: No se pudieron verificar claims, omitimos ${collection}`
              );
              return () => {};
            });
        }

        debugLog(
          `✅ RealTimeDataService: Usuario autenticado (${user.email}), suscribiendo a ${collection}`
        );

        // Continuar con la suscripción
        return this._subscribeInternal(collection, callback, options);
      }

      _subscribeInternal(collection, callback, options = {}) {

        if (this.listeners.has(collection)) {
          debugLog(`⚠️ Ya existe listener para ${collection}, reusando...`);
          const existing = this.listeners.get(collection);
          existing.callbacks.push(callback);

          // Ejecutar callback UNA VEZ con snapshot actual si existe
          // Esto permite que los datos se carguen inmediatamente al reutilizar listener
          if (existing.lastSnapshot) {
            try {
              debugLog(
                `[RealTimeDataService] Ejecutando callback con snapshot actual para ${collection}`
              );
              callback(existing.lastSnapshot);
            } catch (err) {
              console.error(
                `Error ejecutando callback para ${collection}:`,
                err
              );
            }
          } else {
            // ✅ Crítico: Si no hay snapshot previo, hacer consulta directa
            // Esto ocurre cuando se reutiliza un listener que aún no ha recibido su primer snapshot
            debugLog(
              `[RealTimeDataService] No hay snapshot previo para ${collection}, haciendo consulta directa...`
            );

            // Hacer consulta directa para obtener datos inmediatamente
            let query = this.db.collection(collection);
            if (existing.options.orderBy) {
              query = query.orderBy(existing.options.orderBy);
            }
            if (existing.options.limit) {
              query = query.limit(existing.options.limit);
            }

            query
              .get()
              .then(snapshot => {
                try {
                  debugLog(
                    `[RealTimeDataService] Consulta directa completada para ${collection}: ${snapshot.docs.length} docs`
                  );
                  callback(snapshot);
                } catch (err) {
                  console.error(
                    `Error ejecutando callback con consulta directa para ${collection}:`,
                    err
                  );
                }
              })
              .catch(error => {
                console.error(
                  `Error en consulta directa para ${collection}:`,
                  error
                );
              });
          }

          return () => this.removeCallback(collection, callback);
        }

        debugLog(`📡 Suscribiendo a colección: ${collection}`);

        // Crear listener único
        const listener = {
          collection,
          callbacks: [callback],
          unsubscribe: null,
          lastSnapshot: null,
          options: {
            orderBy: options.orderBy || null, // No default orderBy para evitar problemas con campos faltantes
            limit: options.limit || 100,
            ...options,
          },
        };

        // Crear query con opciones
        let query = this.db.collection(collection);
        if (listener.options.orderBy) {
          query = query.orderBy(listener.options.orderBy);
        }
        if (listener.options.limit) {
          query = query.limit(listener.options.limit);
        }

        // Suscribir a cambios
        listener.unsubscribe = query.onSnapshot(
          snapshot => {
            listener.lastSnapshot = snapshot;

            // Notificar a todos los callbacks
            listener.callbacks.forEach(cb => {
              try {
                cb(snapshot);
              } catch (err) {
                console.error(`Error en callback para ${collection}:`, err);
              }
            });
          },
          error => {
            const isAuthIssue =
              error?.code === 'permission-denied' ||
              error?.code === 'unauthenticated' ||
              String(error?.message || '')
                .toLowerCase()
                .includes('insufficient permissions');
            const logFn = isAuthIssue ? console.warn : console.error;
            logFn(`❌ Error en listener de ${collection}:`, error);

            // Notificar error a todos los callbacks
            listener.callbacks.forEach(cb => {
              try {
                cb(null, error);
              } catch (err) {
                console.error(
                  `Error en error callback para ${collection}:`,
                  err
                );
              }
            });
          }
        );

        this.listeners.set(collection, listener);

        // Retornar función de unsuscripción
        return () => this.removeCallback(collection, callback);
      }

      /**
       * Procesa un snapshot de Firestore
       * @private
       */
      _processSnapshot(snapshot) {
        if (!snapshot || !snapshot.docs) return [];

        return snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        }));
      }

      /**
       * Remueve un callback específico de un listener
       * @private
       */
      removeCallback(collection, callback) {
        const listener = this.listeners.get(collection);
        if (!listener) return;

        const index = listener.callbacks.indexOf(callback);
        if (index > -1) {
          listener.callbacks.splice(index, 1);
        }

        // Si no hay más callbacks, unsuscribirse
        if (listener.callbacks.length === 0) {
          if (listener.unsubscribe) {
            listener.unsubscribe();
          }
          this.listeners.delete(collection);
          debugLog(`📡 Unsubscribed from ${collection}`);
        }
      }

      /**
       * Obtiene datos actuales sin suscripción (snapshot único)
       * @param {string} collection - Nombre de la colección
       * @returns {Promise<Array>} Datos actuales
       */
      async getCurrentData(collection) {
        if (!this.db) {
          Logger.warn('RealTimeDataService: Firebase no inicializado', 'WARN');
          return [];
        }

        try {
          const snapshot = await this.db.collection(collection).get();
          return this._processSnapshot(snapshot);
        } catch (_error) {
          const isAuthIssue =
            _error?.code === 'permission-denied' ||
            _error?.code === 'unauthenticated' ||
            String(_error?.message || '')
              .toLowerCase()
              .includes('insufficient permissions');
          const logFn = isAuthIssue ? console.warn : console.error;
          logFn(`❌ Error obteniendo datos de ${collection}:`, _error);
          return [];
        }
      }

      /**
       * Suscribe a múltiples colecciones
       * @param {Object} subscriptions - Objeto con { colección: callback } o { colección: { callback, options } }
       * @returns {Function} Función para unsuscribirse de todas
       */
      subscribeToMultiple(subscriptions) {
        const unsubscribers = [];

        Object.entries(subscriptions).forEach(([collection, config]) => {
          // Soportar dos formatos:
          // 1. { collection: callback } - formato simple
          // 2. { collection: { callback, options } } - formato con opciones
          const callback =
            typeof config === 'function' ? config : config.callback;
          const options =
            typeof config === 'function' ? {} : config.options || {};

          const unsub = this.subscribeToCollection(
            collection,
            callback,
            options
          );
          unsubscribers.push(unsub);
        });

        // Retornar función para unsuscribirse de todas
        return () => {
          unsubscribers.forEach(unsub => unsub());
        };
      }

      /**
       * Limpia todos los listeners activos
       */
      cleanup() {
        debugLog(
          '🧹 Limpiando todos los listeners de RealTimeDataService...'
        );

        this.listeners.forEach((listener, _collection) => {
          if (listener.unsubscribe) {
            listener.unsubscribe();
          }
        });

        this.listeners.clear();
        debugLog('✅ Todos los listeners limpiados');
      }

      /**
       * Obtiene información del servicio para debugging
       */
      getStatus() {
        return {
          initialized: this.initialized,
          db: !!this.db,
          activeListeners: this.listeners.size,
          collections: Array.from(this.listeners.keys()),
        };
      }
    };

    // Exponer clase globalmente
    window.RealTimeDataService = RealTimeDataService;

    // Instancia singleton global
    window.realTimeDataService = new RealTimeDataService();

    // Inicializar cuando el DOM esté listo
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        window.realTimeDataService.init();
      });
    } else {
      window.realTimeDataService.init();
    }

    debugLog('✅ RealTimeDataService cargado');
  }
}

if (typeof window !== 'undefined' && !window.__REALTIME_DATA_SERVICE_NO_AUTO__) {
  initRealTimeDataService();
}

