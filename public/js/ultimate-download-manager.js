/**
 * ultimate-download-manager.js
 * Sistema avanzado de gestión de descargas con seguridad IP-Locking y UX mejorada.
 * Versión: 3.2.0 - Sistema de 48 horas con límite de 3 descargas + Cooldown 30s
 *
 * MODELO DE NEGOCIO:
 * - Usuario compra producto
 * - Tiene 48 horas para descargar
 * - Máximo 3 descargas por compra
 * - Cooldown de 30 segundos entre descargas
 * - Después de 3 descargas: producto marcado como "Adquirido"
 * - Puede comprar otros productos con la misma cuenta
 *
 * CARACTERÍSTICAS TÉCNICAS:
 * - Cronómetro en tiempo real que cuenta hacia atrás
 * - Persistencia total (localStorage + Firestore)
 * - Botón admin para reiniciar timer
 * - Cooldown de 30s entre descargas
 * - Detección de comportamiento sospechoso
 */

'use strict';

function setupUltimateDownloadManager() {

  class UltimateDownloadManager {
    constructor() {
      this.META_TEXT = {
        final: 'Tiempo restante: Finalizado',
        downloadsNone: 'Descargas disponibles: Sin descargas',
        downloadsPrefix: 'Descargas disponibles: ',
        cooldown: 'Debes esperar 30 segundos entre descargas.',
        unavailable: 'Sistema de descargas no disponible. Por favor, recarga la página.',
        downloadReady: 'Tu descarga está lista.',
        downloadExpired: 'El período de descarga ha expirado.',
        downloadLimit: 'Has alcanzado el límite de descargas.',
        loginRequired: 'Debes iniciar sesión para descargar.',
        accessRevoked: 'Acceso revocado. Contacta soporte si necesitas ayuda.',
        genericError: 'Error al procesar la descarga. Intenta más tarde.',
        invalidProduct: 'Producto inválido.',
        noPurchase: 'No se encontró una compra válida para este producto.',
        preparing: 'Preparando descarga segura...',
        verifying: 'Verificando...',
        downloading: 'Descargando...',
        secureLabel: 'DESCARGAR [SECURE]',
      };
      this.containerId = 'toast-container-global';
      this.ensureToastContainer();
      this.currentUser = window.firebase
        ? window.firebase.auth().currentUser
        : null;

      // Configuración del sistema de descargas
      this.DOWNLOAD_WINDOW_HOURS = 48; // 48 horas
      this.MAX_DOWNLOADS = 3; // Máximo 3 descargas
      this.STORAGE_KEY_PREFIX = 'wfx_download_'; // Prefijo para localStorage
      this.activeTimers = new Map(); // Mapa de timers activos

      // Configuración de Rate Limiting
      // ELIMINADO: Sistema de 10 intentos/hora (no aplica a nuestro modelo)
      // MODELO CORRECTO: 3 descargas por compra + cooldown de 30s
      this.DOWNLOAD_COOLDOWN_MS = 30 * 1000; // 30 segundos entre descargas
      this.LAST_DOWNLOAD_KEY = 'wfx_last_download_';

      // Fallback del logger
      this.log = window.Logger || {
        info: (m, c) => console.log(`[${c}] ${m}`),
        warn: (m, c) => console.warn(`[${c}] ${m}`),
        error: (m, c, d) => console.error(`[${c}] ${m}`, d),
        debug: (m, c) => console.log(`[DEBUG][${c}] ${m}`),
        trace: (m, c) => console.log(`[TRACE][${c}] ${m}`),
        startGroup: (_n, e) => console.group(`${e || ''} ${_n}`),
        endGroup: _n => console.groupEnd(),
        critical: (m, c, d) => console.error(`[CRITICAL][${c}] ${m}`, d),
      };
      this.CAT = window.LOG_CATEGORIES || {
        DOWNLOAD: 'DOWNLOAD',
        SECURITY: 'SEC',
        INIT: 'INIT',
        ERR: 'ERR',
      };

      // Iniciar detección de IP automáticamente
      if (document.getElementById('user-ip')) {
        this.displayUserIp();
      }

      // Inicializar cronómetros activos al cargar
      this.initializeAllTimers();

      // Listener de autenticación para actualizar currentUser vía AppState (Unificado)
      if (window.AppState) {
        this.log.debug(
          'Subscribing to AppState user changes...',
          this.CAT.AUTH || 'AUTH'
        );
        window.AppState.subscribe('user', user => {
          // AppState user object has uid and email, consistent with usage
          this.currentUser = user && user.isAuthenticated ? user : null;
        });
      } else if (window.firebase && window.firebase.auth) {
        window.firebase.auth().onAuthStateChanged(user => {
          this.currentUser = user;
        });
      }
    }

    /**
     * Asegura que exista el contenedor de toasts
     */
    ensureToastContainer() {
      if (!document.getElementById(this.containerId)) {
        const container = document.createElement('div');
        container.id = this.containerId;
        container.className = 'toast-container';
        document.body.appendChild(container);
      }
    }

    /**
     * Inicializa todos los cronómetros activos al cargar la página
     */
    initializeAllTimers() {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith(this.STORAGE_KEY_PREFIX)) {
          const productId = key.replace(this.STORAGE_KEY_PREFIX, '');
          const data = this.getDownloadData(productId);

          if (data && data.purchaseTimestamp) {
            // Intentar iniciar cronómetro con reintentos
            this.startTimerWithRetry(productId, data, 0);
          }
        }
      });
    }

    /**
     * Intenta iniciar el cronómetro con reintentos
     */
    startTimerWithRetry(productId, data, attempt) {
      const maxAttempts = 10; // Máximo 10 intentos
      const delay = 500; // 500ms entre intentos
      const displays = this.getTimerDisplays(productId);

      if (displays.length > 0) {
        // Elemento encontrado, iniciar cronómetro
        this.startPersistentTimer(productId, data);
        this.log.debug(
          `Cronómetro iniciado para: ${productId} (intento ${attempt + 1})`,
          this.CAT.DOWNLOAD
        );
      } else if (attempt < maxAttempts) {
        // Elemento no encontrado, reintentar
        this.log.debug(
        `Esperando elemento timer-${productId} (intento ${attempt + 1}/${maxAttempts})`,
        this.CAT.DOWNLOAD
      );
        setTimeout(() => {
          this.startTimerWithRetry(productId, data, attempt + 1);
        }, delay);
      } else {
        // Máximo de intentos alcanzado
        this.log.warn(
          `No se pudo iniciar cronómetro para ${productId} después de ${maxAttempts} intentos`,
          this.CAT.DOWNLOAD
        );
      }
    }

    getTimerDisplays(productId) {
      const displays = [];
      const byId = document.getElementById(`timer-${productId}`);
      if (byId) displays.push(byId);
      const dataNodes = document.querySelectorAll(
        `[data-timer-for="${productId}"]`
      );
      dataNodes.forEach(node => {
        if (!displays.includes(node)) displays.push(node);
      });
      return displays;
    }

    getDownloadsDisplays(productId) {
      const displays = [];
      const byId = document.getElementById(`downloads-${productId}`);
      if (byId) displays.push(byId);
      const dataNodes = document.querySelectorAll(
        `[data-downloads-for="${productId}"]`
      );
      dataNodes.forEach(node => {
        if (!displays.includes(node)) displays.push(node);
      });
      return displays;
    }

    getDownloadButtons(productId) {
      return Array.from(
        document.querySelectorAll(
          `[data-action="secureDownload"][data-product-id="${productId}"]`
        )
      );
    }

    setButtonState(productId, state) {
      const buttons = this.getDownloadButtons(productId);
      if (!buttons.length) return;

      const isAcquired = state === 'acquired';
      const label = isAcquired ? 'ADQUIRIDO' : 'DESCARGAR [SECURE]';

      buttons.forEach(btn => {
        btn.classList.toggle('is-acquired', isAcquired);
        if (isAcquired) {
          btn.setAttribute(
            'title',
            'Acceso finalizado: límite de descargas o tiempo expirado'
          );
          btn.setAttribute(
            'aria-label',
            'Acceso finalizado: límite de descargas o tiempo expirado'
          );
          if (!btn.querySelector('.acquired-badge')) {
            const badge = document.createElement('span');
            badge.className = 'acquired-badge';
            badge.textContent = 'ADQUIRIDO';
            btn.appendChild(badge);
          }
        } else {
          btn.removeAttribute('title');
          btn.removeAttribute('aria-label');
          const badge = btn.querySelector('.acquired-badge');
          if (badge) badge.remove();
        }
        const textEl = btn.querySelector('.btn-text') || btn;
        if (textEl && textEl !== btn) {
          textEl.textContent = label;
          if (textEl.classList.contains('glitch-text')) {
            textEl.setAttribute('data-text', label);
          }
        } else if (btn) {
          btn.textContent = label;
        }
        btn.disabled = isAcquired;
        btn.setAttribute('aria-disabled', isAcquired ? 'true' : 'false');
      });
    }

    /**
     * Obtiene los datos de descarga de un producto desde localStorage
     */
    getDownloadData(productId) {
      try {
        const data = localStorage.getItem(this.STORAGE_KEY_PREFIX + productId);
        return data ? JSON.parse(data) : null;
      } catch (e) {
        this.log.error('Error leyendo datos de descarga', this.CAT.DOWNLOAD, e);
        return null;
      }
    }

    /**
     * Guarda los datos de descarga de un producto en localStorage
     */
    setDownloadData(productId, data) {
      try {
        localStorage.setItem(
          this.STORAGE_KEY_PREFIX + productId,
          JSON.stringify(data)
        );
        this.log.debug(`Datos guardados para ${productId}`, this.CAT.DOWNLOAD);
      } catch (e) {
        this.log.error(
          'Error guardando datos de descarga',
          this.CAT.DOWNLOAD,
          e
        );
      }
    }

    /**
     * Verifica si un producto puede ser descargado
     */
    checkDownloadEligibility(productId) {
      const data = this.getDownloadData(productId);

      if (!data || !data.purchaseTimestamp) {
        return {
          canDownload: false,
          reason: 'no_purchase',
          data: null,
        };
      }

      const now = Date.now();
      const elapsed = now - data.purchaseTimestamp;
      const windowMs = this.DOWNLOAD_WINDOW_HOURS * 60 * 60 * 1000; // 48 horas en ms

      // Verificar si pasaron las 48 horas
      if (elapsed > windowMs) {
        return {
          canDownload: false,
          reason: 'expired',
          data: data,
        };
      }

      // Verificar si alcanzó el límite de descargas
      if (data.downloadCount >= this.MAX_DOWNLOADS) {
        return {
          canDownload: false,
          reason: 'limit_reached',
          data: data,
        };
      }

      return {
        canDownload: true,
        reason: 'ok',
        data: data,
      };
    }

    /**
     * Registra una nueva compra y habilita las descargas
     */
    registerPurchase(productId) {
      const data = {
        purchaseTimestamp: Date.now(),
        downloadCount: 0,
        lastDownloadTimestamp: null,
      };
      this.setDownloadData(productId, data);
      this.log.info(
        `Compra registrada correctamente: ${productId}`,
        this.CAT.DOWNLOAD
      );

      // Iniciar cronómetro con reintentos
      this.startTimerWithRetry(productId, data, 0);
    }

    /**
     * Reinicia el timer de un producto (solo para admins)
     */
    async resetProductTimer(productId) {
      this.log.info(
        `Reiniciando timer para: ${productId}`,
        this.CAT.ADMIN || 'ADMIN'
      );

      try {
        const resolveKeys = () => {
          const keys = new Set();
          if (productId) keys.add(productId);

          const annSystem = window.announcementSystem;
          const cache = annSystem && annSystem.cache;
          let ann = null;
          if (cache && typeof cache.get === 'function') {
            ann = cache.get(productId) || null;
            if (!ann) {
              for (const value of cache.values()) {
                if (
                  value &&
                  (value.id === productId || value.productId === productId)
                ) {
                  ann = value;
                  break;
                }
                if (value && value.stripeId === productId) {
                  ann = value;
                  break;
                }
              }
            }
          }
          if (annSystem && typeof annSystem.getAnnouncementProductKeys === 'function' && ann) {
            const annKeys = annSystem.getAnnouncementProductKeys(ann);
            annKeys.forEach(k => keys.add(k));
          }
          return Array.from(keys).filter(Boolean);
        };

        const keys = resolveKeys();

        // 1. Detener timer activo si existe
        keys.forEach(key => {
          if (this.activeTimers.has(key)) {
            clearInterval(this.activeTimers.get(key));
            this.activeTimers.delete(key);
          }
        });
        this.log.debug('Timers detenidos', this.CAT.DOWNLOAD);

        // 2. Eliminar datos de localStorage
        keys.forEach(key => {
          localStorage.removeItem(this.STORAGE_KEY_PREFIX + key);
          localStorage.removeItem(this.LAST_DOWNLOAD_KEY + key);
        });
        this.log.debug('localStorage limpiado', this.CAT.DOWNLOAD);

        const resolvedUser =
          this.currentUser ||
          (window.firebase && window.firebase.auth && window.firebase.auth().currentUser) ||
          (window.auth && window.auth.currentUser) ||
          (window.firebaseModular && window.firebaseModular.auth && window.firebaseModular.auth.currentUser) ||
          null;

        // 3. Eliminar de Firestore si el usuario está autenticado
        if (resolvedUser && window.firebase && window.firebase.firestore) {
          const db = window.firebase.firestore();

          const userDoc = db.collection('users').doc(resolvedUser.uid);
          const purchasesCollection = userDoc.collection('purchases');

          await Promise.all(
            keys.map(async key => {
              try {
                await purchasesCollection.doc(key).delete();
              } catch (_e) {}
            })
          );

          // Eliminar documentos cuya propiedad productId coincide (caso IDs autogenerados)
          await Promise.all(
            keys.map(async key => {
              try {
                const snap = await purchasesCollection
                  .where('productId', '==', key)
                  .get();
                if (!snap.empty) {
                  const deletions = [];
                  snap.forEach(doc => deletions.push(doc.ref.delete()));
                  await Promise.all(deletions);
                }
              } catch (_e) {}
            })
          );

          this.log.debug(
            'Firestore purchases limpiado',
            this.CAT.FIREBASE || 'FIREBASE'
          );

          try {
            const userSnap = await userDoc.get();
            if (userSnap.exists) {
              const data = userSnap.data() || {};
              const raw = Array.isArray(data.purchases) ? data.purchases : [];
              const filtered = raw.filter(item => {
                if (!item) return false;
                if (typeof item === 'string') {
                  return !keys.includes(item);
                }
                if (typeof item === 'object') {
                  const val =
                    item.id ||
                    item.productId ||
                    item.stripeId ||
                    item.stripeProductId ||
                    null;
                  return val ? !keys.includes(val) : true;
                }
                return true;
              });
              await userDoc.update({ purchases: filtered });
              this.log.debug(
                'Array purchases actualizado (filtrado)',
                this.CAT.FIREBASE || 'FIREBASE'
              );
            }
          } catch (_e) {}
        } else if (!resolvedUser) {
          this.log.warn(
            'No hay usuario autenticado, omitimos limpieza en Firestore',
            this.CAT.AUTH || 'AUTH'
          );
        }

        // 4. Limpiar del sistema de anuncios
        if (window.announcementSystem) {
          keys.forEach(key => {
            window.announcementSystem.ownedProducts.delete(key);
            window.announcementSystem.localOwnedProducts.delete(key);
          });
          this.log.debug('Sistema de anuncios limpiado', this.CAT.INIT);
        }

        // 5. Limpiar SecureStorage si existe
        if (window.SecureStorage) {
          const current =
            window.SecureStorage.getSecureItem('wfx_recent_purchases') || [];
          const filtered = current.filter(item => !keys.includes(item.id));
          window.SecureStorage.setSecureItem('wfx_recent_purchases', filtered);
          this.log.debug('SecureStorage limpiado', this.CAT.INIT);
        }

        // 6. Refrescar UI sin recargar (mejor UX)
        if (window.announcementSystem && window.announcementSystem.cache) {
          window.announcementSystem.render(
            Array.from(window.announcementSystem.cache.values())
          );
        }
        if (
          window.announcementSystem &&
          typeof window.announcementSystem.syncPublicModalOwned === 'function'
        ) {
          keys.forEach(key =>
            window.announcementSystem.syncPublicModalOwned(key)
          );
        }
        window.dispatchEvent(
          new CustomEvent('wfx:downloadTimerReset', {
            detail: { productId, keys },
          })
        );
        try {
          localStorage.setItem(
            'wfx_admin_reset_signal',
            JSON.stringify({ productId, keys, ts: Date.now() })
          );
        } catch (_e) {}
        if (window.BroadcastChannel) {
          try {
            const ch = new BroadcastChannel('wfx_admin_reset');
            ch.postMessage({ productId, keys, ts: Date.now() });
            ch.close();
          } catch (_e) {}
        }
        if (
          window.announcementSystem &&
          typeof window.announcementSystem.handleTimerReset === 'function'
        ) {
          try {
            window.announcementSystem.handleTimerReset(productId, keys);
          } catch (_e) {}
        }

        // Notificar
        this.notify(
          `✅ Timer reiniciado para producto ${productId}`,
          'success'
        );

      } catch (error) {
        this.log.error(
          'Error reiniciando timer',
          this.CAT.ADMIN || 'ADMIN',
          error
        );
        this.notify(`❌ Error: ${error.message}`, 'error');
      }
    }

    /**
     * Muestra la IP del usuario
     */
    async displayUserIp() {
      const ipElement = document.getElementById('user-ip');
      if (!ipElement) return;

      try {
        ipElement.classList.add('loading-ip');
        const response = await fetch('https://api.ipify.org?format=json');
        const data = await response.json();
        ipElement.textContent = data.ip;
        ipElement.classList.remove('loading-ip');
      } catch (e) {
        this.log.warn('Error fetching IP', this.CAT.INIT, e);
        ipElement.textContent = 'Detectada';
      }
    }

    /**
     * Verifica el cooldown entre descargas (30 segundos)
     * MODELO: Usuario puede descargar 3 veces con 30s de espera entre cada una
     */
    checkDownloadCooldown(productId) {
      const now = Date.now();
      const lastDownloadKey = this.LAST_DOWNLOAD_KEY + productId;

      try {
        const lastDownload = localStorage.getItem(lastDownloadKey);
        if (!lastDownload) {
          return {
            allowed: true,
            secondsLeft: 0,
          };
        }

        const lastDownloadTime = parseInt(lastDownload, 10);
        const timeSinceLastDownload = now - lastDownloadTime;

        if (timeSinceLastDownload < this.DOWNLOAD_COOLDOWN_MS) {
          const secondsLeft = Math.ceil(
            (this.DOWNLOAD_COOLDOWN_MS - timeSinceLastDownload) / 1000
          );
          return {
            allowed: false,
            reason: 'cooldown_active',
            secondsLeft: secondsLeft,
          };
        }

        return {
          allowed: true,
          secondsLeft: 0,
        };
      } catch (e) {
        this.log.error('Error verificando cooldown', this.CAT.SECURITY, e);
        return {
          allowed: true,
          secondsLeft: 0,
        };
      }
    }

    /**
     * Registra el timestamp de la última descarga
     */
    recordLastDownload(productId) {
      const now = Date.now();
      const lastDownloadKey = this.LAST_DOWNLOAD_KEY + productId;

      try {
        localStorage.setItem(lastDownloadKey, now.toString());
        this.log.debug('Última descarga registrada', this.CAT.DOWNLOAD);
      } catch (e) {
        this.log.error(
          'Error registrando última descarga',
          this.CAT.DOWNLOAD,
          e
        );
      }
    }

    /**
     * Registra comportamiento sospechoso en Firestore
     */
    async logSuspiciousActivity(productId, reason, details) {
      if (!this.currentUser || !window.firebase || !window.firebase.firestore) {
        return;
      }

      try {
        const db = window.firebase.firestore();

        // Obtener IP del usuario (con fallback)
        let userIp = 'Unknown';
        const ipElement = document.getElementById('user-ip');
        if (
          ipElement &&
          ipElement.innerText &&
          ipElement.innerText !== 'Detectada'
        ) {
          userIp = ipElement.innerText;
        }

        const logEntry = {
          userId: this.currentUser.uid,
          userEmail: this.currentUser.email,
          productId: productId,
          reason: reason,
          details: details,
          timestamp: window.firebase.firestore.FieldValue.serverTimestamp(),
          ip: userIp,
          userAgent: navigator.userAgent,
        };

        await db.collection('security_logs').add(logEntry);
        this.log.critical(
          `Actividad sospechosa registrada: ${reason}`,
          this.CAT.SECURITY,
          details
        );
      } catch (e) {
        this.log.error(
          'Error registrando actividad sospechosa en Firestore',
          this.CAT.SECURITY,
          e
        );
      }
    }

    /**
     * Maneja el click en el botón de descarga
     * ACTUALIZADO: Usa Cloud Function generateDownloadLink para seguridad
     */
    async handleDownloadClick(productId, _purchaseToken) {
      const btn =
        document.getElementById(`btn-download-${productId}`) ||
        document.querySelector(`[data-product-id="${productId}"]`);

      if (!btn) {
        this.log.warn(
          `Botón no encontrado para producto: ${productId}`,
          this.CAT.INIT
        );
        return;
      }

      // 1. VERIFICAR AUTENTICACIÓN
      if (!this.currentUser) {
        this.notify(`⚠️ ${this.META_TEXT.loginRequired}`, 'error');
        return;
      }

      // 2. VERIFICAR COOLDOWN (30 segundos entre descargas)
      const cooldown = this.checkDownloadCooldown(productId);
      if (!cooldown.allowed) {
        this.notify(
          `⏳ ${this.META_TEXT.cooldown} (${cooldown.secondsLeft}s)`,
          'warning'
        );

        // Mostrar contador de cooldown en el botón
        const originalText = btn.textContent;
        btn.disabled = true;

        const countdownInterval = setInterval(() => {
          const remaining = this.checkDownloadCooldown(productId);
          if (remaining.allowed) {
            clearInterval(countdownInterval);
            btn.textContent = originalText;
            btn.disabled = false;
          } else {
            btn.textContent = `Espera ${remaining.secondsLeft}s...`;
          }
        }, 1000);

        return;
      }

      try {
        this.setLoading(btn, true);
        btn.textContent = this.META_TEXT.verifying;

        // 3. LLAMAR A CLOUD FUNCTION generateDownloadLink
        // CRÍTICO: Toda la lógica de seguridad está en el servidor
        const generateLink = window.firebase
          .functions()
          .httpsCallable('generateDownloadLink');

        this.log.info(
          'Solicitando enlace de descarga al servidor...',
          this.CAT.DOWNLOAD
        );

        const result = await generateLink({ productId });

        if (!result.data || !result.data.success) {
          throw new Error(
            result.data?.message || this.META_TEXT.genericError
          );
        }

        const { downloadUrl, fileName, remainingDownloads, expiresIn } =
          result.data;

        this.log.info(
          `Enlace de descarga recibido. Expira en ${expiresIn}s. Descargas restantes: ${remainingDownloads}`,
          this.CAT.DOWNLOAD
        );

        // 4. REGISTRAR ÚLTIMA DESCARGA (para cooldown de 30s)
        this.recordLastDownload(productId);

        // 5. ACTUALIZAR DATOS LOCALES
        const eligibility = this.checkDownloadEligibility(productId);
        const downloadsUsed =
          this.MAX_DOWNLOADS - Math.max(remainingDownloads, 0);
        if (eligibility.data) {
          const updatedData = {
            ...eligibility.data,
            downloadCount: Math.max(
              eligibility.data.downloadCount + 1,
              downloadsUsed
            ),
            lastDownloadTimestamp: Date.now(),
          };
          this.setDownloadData(productId, updatedData);
        } else {
          // Inicializar datos locales si no existen
          const initData = {
            purchaseTimestamp: Date.now(),
            downloadCount: Math.max(1, downloadsUsed),
            lastDownloadTimestamp: Date.now(),
          };
          this.setDownloadData(productId, initData);
          this.startTimerWithRetry(productId, initData, 0);
        }

        // 6. NOTIFICAR AL USUARIO
        this.notify(
          `¡${this.META_TEXT.downloadReady}! Te quedan ${remainingDownloads} descarga${remainingDownloads !== 1 ? 's' : ''}`,
          'success'
        );

        // 7. INICIAR DESCARGA
        btn.textContent = this.META_TEXT.downloading;

        // Track download (Analytics Avanzado)
        if (window.enhancedAnalytics) {
          window.enhancedAnalytics.trackDownload(
            productId,
            fileName || `producto_${productId}.zip`
          );
        }

        this.triggerDownload(
          downloadUrl,
          fileName || `producto_${productId}.zip`
        );

        // 8. RESTAURAR BOTÓN
        setTimeout(() => {
          btn.textContent = this.META_TEXT.secureLabel;
          this.setLoading(btn, false);
        }, 2000);
      } catch (error) {
        this.log.error(
          'Error durante el proceso de descarga',
          this.CAT.DOWNLOAD,
          error
        );

        // Manejar errores específicos de Cloud Function
        let errorMessage = this.META_TEXT.genericError;

        if (error.code === 'unauthenticated') {
          errorMessage = `⚠️ ${this.META_TEXT.loginRequired}`;
        } else if (error.code === 'permission-denied') {
          errorMessage = `🚫 ${this.META_TEXT.noPurchase}`;
        } else if (error.code === 'resource-exhausted') {
          errorMessage = `⚠️ ${this.META_TEXT.downloadLimit}`;
        } else if (error.code === 'failed-precondition') {
          errorMessage = error.message || '⚠️ Condición no cumplida';
        } else if (error.code === 'not-found') {
          errorMessage = `❌ ${this.META_TEXT.unavailable}`;
        } else if (error.message) {
          errorMessage = error.message;
        }

        this.notify(errorMessage, 'error');

        // Registrar actividad sospechosa si es un error de permisos
        if (error.code === 'permission-denied') {
          await this.logSuspiciousActivity(
            productId,
            'download_without_purchase',
            { error: error.message }
          );
        }

        btn.textContent = this.META_TEXT.secureLabel;
        this.setLoading(btn, false);
      }
    }

    /**
     * Dispara la descarga del archivo
     */
    triggerDownload(url, fileName) {
      // Si la URL es '#' o vacía, no hacer nada (evitar refresh de página)
      if (!url || url === '#' || url === '') {
        this.log.warn(
          'URL de descarga no válida, usando URL de prueba',
          this.CAT.DOWNLOAD
        );
        // URL de prueba para desarrollo (archivo pequeño)
        url = 'https://via.placeholder.com/1';
      }

      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.target = '_blank'; // Abrir en nueva pestaña para evitar refresh
      link.rel = 'noopener noreferrer'; // Seguridad
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }

    /**
     * Muestra una notificación Toast
     */
    notify(msg, type = 'info') {
      const container = document.getElementById(this.containerId);

      const toast = document.createElement('div');
      toast.className = `toast toast-${type}`;

      let iconCode = '';
      if (type === 'success')
        iconCode =
          '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>';
      else if (type === 'error')
        iconCode =
          '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>';
      else
        iconCode =
          '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>';

      toast.innerHTML = `
        <div class="toast-icon">${iconCode}</div>
        <div class="toast-message">${msg}</div>
      `;

      container.appendChild(toast);

      setTimeout(() => {
        toast.classList.add('toast-fade-out');
        toast.addEventListener('animationend', () => {
          toast.remove();
        });
      }, 4000);
    }

    /**
     * Cambia el estado visual del botón
     */
    setLoading(el, state) {
      if (state) {
        el.classList.add('is-loading');
        el.dataset.originalText = el.innerText;
        el.disabled = true;
      } else {
        el.classList.remove('is-loading');
        el.disabled = false;
      }
    }

    setMetaVisibility(container, visible) {
      if (!container) return;
      container.classList.toggle('download-meta--hidden', !visible);
    }

    setStatusClass(el, status) {
      if (!el || !el.classList) return;
      el.classList.remove('status-error', 'status-warning', 'status-success');
      if (status) {
        el.classList.add(`status-${status}`);
      }
    }

    /**
     * Inicia un cronómetro persistente que cuenta hacia atrás
     */
    startPersistentTimer(productId, _data) {
      const initialDisplays = this.getTimerDisplays(productId);
      if (initialDisplays.length === 0) {
        this.log.debug(
          `Elemento timer no encontrado para ${productId}`,
          this.CAT.DOWNLOAD
        );
        return;
      }

      // Detener timer anterior si existe
      if (this.activeTimers.has(productId)) {
        clearInterval(this.activeTimers.get(productId));
      }

      const windowMs = this.DOWNLOAD_WINDOW_HOURS * 60 * 60 * 1000;

      const update = () => {
        const displays = this.getTimerDisplays(productId);
        const downloadsDisplays = this.getDownloadsDisplays(productId);
        const metaContainers = [
          ...new Set(
            [
              ...displays.map(d => d.closest('.download-meta')),
              ...downloadsDisplays.map(d => d.closest('.download-meta')),
            ].filter(Boolean)
          ),
        ];

        if (displays.length === 0 && downloadsDisplays.length === 0) {
          clearInterval(this.activeTimers.get(productId));
          this.activeTimers.delete(productId);
          return;
        }

        // CRÍTICO: Leer datos actualizados desde localStorage en cada tick
        const currentData = this.getDownloadData(productId);
        if (!currentData) {
          clearInterval(this.activeTimers.get(productId));
          this.activeTimers.delete(productId);
          return;
        }

        const now = Date.now();
        const elapsed = now - currentData.purchaseTimestamp;
        const remaining = windowMs - elapsed;

        // Verificar si alcanzó el límite de descargas
        if (currentData.downloadCount >= this.MAX_DOWNLOADS) {
          metaContainers.forEach(container => {
            this.setMetaVisibility(container, false);
          });
          this.setButtonState(productId, 'acquired');
          displays.forEach(display => {
            display.innerText = this.META_TEXT.final;
            this.setStatusClass(display, 'error');
            display.classList.add('is-final');
          });
          downloadsDisplays.forEach(downloadsDisplay => {
            downloadsDisplay.innerText = this.META_TEXT.downloadsNone;
            this.setStatusClass(downloadsDisplay, 'error');
            downloadsDisplay.classList.add('is-final');
          });
          clearInterval(this.activeTimers.get(productId));
          this.activeTimers.delete(productId);
          return;
        }

        if (remaining <= 0) {
          metaContainers.forEach(container => {
            this.setMetaVisibility(container, false);
          });
          this.setButtonState(productId, 'acquired');
          displays.forEach(display => {
            display.innerText = this.META_TEXT.final;
            this.setStatusClass(display, 'error');
            display.classList.add('is-final');
          });
          downloadsDisplays.forEach(downloadsDisplay => {
            downloadsDisplay.innerText = this.META_TEXT.downloadsNone;
            this.setStatusClass(downloadsDisplay, 'error');
            downloadsDisplay.classList.add('is-final');
          });
          clearInterval(this.activeTimers.get(productId));
          this.activeTimers.delete(productId);
          return;
        }

        // Formatear tiempo restante
        const hours = Math.floor(remaining / (1000 * 60 * 60));
        const minutes = Math.floor(
          (remaining % (1000 * 60 * 60)) / (1000 * 60)
        );
        const seconds = Math.floor((remaining % (1000 * 60)) / 1000);

        displays.forEach(display => {
          display.innerText = `Tiempo restante: ${hours}h ${minutes.toString().padStart(2, '0')}m ${seconds.toString().padStart(2, '0')}s`;
          this.setStatusClass(display, hours < 6 ? 'warning' : 'success');
        });

        // Actualizar contador de descargas con datos actuales
        const remainingDownloads =
          this.MAX_DOWNLOADS - currentData.downloadCount;
        metaContainers.forEach(container => {
          this.setMetaVisibility(container, true);
        });
        this.setButtonState(productId, 'active');
        downloadsDisplays.forEach(downloadsDisplay => {
          downloadsDisplay.innerText = `${this.META_TEXT.downloadsPrefix}${remainingDownloads}`;
          this.setStatusClass(
            downloadsDisplay,
            remainingDownloads === 0 ? 'error' : 'success'
          );
          downloadsDisplay.classList.toggle('is-final', remainingDownloads === 0);
        });

        displays.forEach(display => {
          display.classList.remove('is-final');
        });
      };

      const interval = setInterval(update, 1000);
      this.activeTimers.set(productId, interval);
      update(); // Primera actualización inmediata
    }
  }

  // Exponer globalmente
  window.UltimateDownloadManager = new UltimateDownloadManager();
  globalThis.UltimateDownloadManager = window.UltimateDownloadManager; // Asegurar ambos

  if (window.Logger && typeof window.Logger.info === 'function') {
    window.Logger.info(
      'Sistema de descargas v3.2.0 inicializado',
      'INIT'
    );
  }
}

function initUltimateDownloadManager() {
  if (window.__ULTIMATE_DOWNLOAD_MANAGER_INITED__) {
    return;
  }

  window.__ULTIMATE_DOWNLOAD_MANAGER_INITED__ = true;
  setupUltimateDownloadManager();
}

if (typeof window !== 'undefined' && !window.__ULTIMATE_DOWNLOAD_MANAGER_NO_AUTO__) {
  initUltimateDownloadManager();
}

