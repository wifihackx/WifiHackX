const debugLog = (...args) => {
  if (window.__WFX_DEBUG__ === true) {
    console.info(...args);
  }
};

/**
 * AnnouncementSystem - Sistema unificado de gestión de anuncios
 *
 * Revertido a la lógica original de 1.html para asegurar apariencia y funcionalidad.
 *
 * Versión: 2.2 - Refactor DOMPurify eliminando elementos timer/downloads
 */

class AnnouncementSystem {
  constructor() {
    this.META_TEXT = {
      preparing: 'Tiempo restante: preparando acceso...',
      final: 'Tiempo restante: Finalizado',
      downloadsNone: 'Descargas disponibles: Sin descargas',
      downloadsUnknown: 'Descargas disponibles: —',
    };
    this.cache = new Map();
    this.listeners = [];
    this.unsubscribe = null;
    this.ownedProducts = new Set();
    this.localOwnedProducts = new Set();
    this.serverOwnedProducts = new Set();
    this.serverOwnedProductsSub = new Set();
    this.purchaseMeta = new Map();
    this.unsubscribeUserPurchases = null;
    this.publicModalPromise = null;
    this.utilsPromise = null;
    this.downloadManagerPromise = null;
    this._scriptPromises = new Map();
    this.LOCAL_STORAGE_KEY = 'wfx_recent_purchases';
    this.RESET_OVERRIDES_KEY = 'wfx_admin_reset_overrides';
    this.RESET_SIGNAL_KEY = 'wfx_admin_reset_signal';
    this.resetOverrides = new Set();
    this.resetChannel = null;

    // Fallback del logger
    this.log = window.Logger || {
      info: (m, c) => debugLog(`[${c}] ${m}`),
      warn: (m, c) => console.warn(`[${c}] ${m}`),
      error: (m, c, d) => console.error(`[${c}] ${m}`, d),
      debug: (m, c) => debugLog(`[DEBUG][${c}] ${m}`),
      trace: (m, c) => debugLog(`[TRACE][${c}] ${m}`),
    };
    this.CAT = window.LOG_CATEGORIES || {
      FIREBASE: 'FIREBASE',
      INIT: 'INIT',
      AUTH: 'AUTH',
      ERR: 'ERR',
    };

    this.ensureAnnouncementUtilsLoaded().catch(() => {});
    this.loadResetOverrides();
    this.loadLocalPurchases();
    this.log.debug('AnnouncementSystem Inicializado', this.CAT.INIT);
  }

  _loadScriptOnce({ src, globalKey, selector, errorMessage }) {
    if (globalKey && globalThis[globalKey]) {
      return Promise.resolve();
    }

    if (this._scriptPromises.has(src)) {
      return this._scriptPromises.get(src);
    }

    const promise = new Promise((resolve, reject) => {
      const existing = selector
        ? document.querySelector(selector)
        : document.querySelector(`script[src*="${src}"]`);
      if (existing) {
        existing.addEventListener('load', () => resolve());
        existing.addEventListener('error', () =>
          reject(new Error(errorMessage || `Failed to load ${src}`))
        );
        return;
      }

      const script = document.createElement('script');
      script.src = src;
      script.defer = true;
      const nonce = window.SECURITY_NONCE || window.NONCE;
      if (nonce) {
        script.nonce = nonce;
      }
      script.onload = () => resolve();
      script.onerror = () =>
        reject(new Error(errorMessage || `Failed to load ${src}`));
      document.body.appendChild(script);
    });

    this._scriptPromises.set(src, promise);
    return promise;
  }

  ensurePublicModalLoaded() {
    if (this.publicModalPromise) return this.publicModalPromise;
    this.publicModalPromise = this._loadScriptOnce({
      src: 'js/announcement-public-modal.js?v=2.6.1',
      globalKey: 'openPublicDetailModal',
      selector: 'script[src*="announcement-public-modal.js"]',
      errorMessage: 'Failed to load announcement-public-modal.js',
    });
    return this.publicModalPromise;
  }

  ensureAnnouncementUtilsLoaded() {
    if (this.utilsPromise) return this.utilsPromise;
    this.utilsPromise = this._loadScriptOnce({
      src: 'js/announcement-utils.js?v=1.0',
      globalKey: 'AnnouncementUtils',
      selector: 'script[src*="announcement-utils.js"]',
      errorMessage: 'Failed to load announcement-utils.js',
    });
    return this.utilsPromise;
  }

  ensureDownloadManagerLoaded() {
    if (this.downloadManagerPromise) return this.downloadManagerPromise;
    this.downloadManagerPromise = this._loadScriptOnce({
      src: 'js/ultimate-download-manager.js?v=2.8',
      globalKey: 'UltimateDownloadManager',
      selector: 'script[src*="ultimate-download-manager.js"]',
      errorMessage: 'Failed to load ultimate-download-manager.js',
    });
    return this.downloadManagerPromise;
  }

  loadResetOverrides() {
    try {
      const raw = globalThis.SecureStorage
        ? globalThis.SecureStorage.getSecureItem(this.RESET_OVERRIDES_KEY)
        : localStorage.getItem(this.RESET_OVERRIDES_KEY);
      const list = Array.isArray(raw) ? raw : raw ? JSON.parse(raw) : [];
      if (Array.isArray(list)) {
        list.forEach(id => id && this.resetOverrides.add(id));
      }
    } catch (_e) {}
  }

  saveResetOverrides() {
    try {
      const list = Array.from(this.resetOverrides.values());
      if (globalThis.SecureStorage) {
        globalThis.SecureStorage.setSecureItem(this.RESET_OVERRIDES_KEY, list);
      } else {
        localStorage.setItem(this.RESET_OVERRIDES_KEY, JSON.stringify(list));
      }
    } catch (_e) {}
  }

  isResetSuppressed(productId) {
    return this.resetOverrides.has(productId);
  }

  loadLocalPurchases() {
    if (!globalThis.SecureStorage) {
      this.log.warn('SecureStorage no disponible', this.CAT.INIT);
      return;
    }

    try {
      // 1. Cargar desde SecureStorage (compras recientes)
      const data =
        globalThis.SecureStorage.getSecureItem(this.LOCAL_STORAGE_KEY) || [];

      // Validar que data sea un array
      if (!Array.isArray(data)) {
        this.log.warn(
          'Local purchases data is not an array, resetting...',
          this.CAT.INIT
        );
        globalThis.SecureStorage.setSecureItem(this.LOCAL_STORAGE_KEY, []);
      } else {
        const now = Date.now();
        // Filtrar compras de más de 30 minutos (30 * 60 * 1000)
        const recent = data.filter(
          item => now - item.timestamp < 1800000 && !this.isResetSuppressed(item.id)
        );
        recent.forEach(item => {
          this.localOwnedProducts.add(item.id);
          this.ownedProducts.add(item.id);
        });

        // Si hubo limpieza, actualizar el storage
        if (recent.length !== data.length) {
          globalThis.SecureStorage.setSecureItem(
            this.LOCAL_STORAGE_KEY,
            recent
          );
        }

        this.log.debug(
          `Cargadas ${recent.length} compras recientes desde SecureStorage`,
          this.CAT.INIT
        );
      }

      // 2. CRÍTICO: Cargar desde localStorage (sistema de descargas - 48 horas)
      // Esto asegura persistencia incluso después de refrescar la página
      const keys = Object.keys(localStorage);
      const downloadKeys = keys.filter(k => k.startsWith('wfx_download_'));

      downloadKeys.forEach(key => {
        const productId = key.replace('wfx_download_', '');
        try {
          const downloadData = JSON.parse(localStorage.getItem(key));
          if (downloadData && downloadData.purchaseTimestamp) {
            const now = Date.now();
            const elapsed = now - downloadData.purchaseTimestamp;
            const windowMs = 48 * 60 * 60 * 1000; // 48 horas

            // Si no ha expirado, marcar como comprado
            if (elapsed < windowMs) {
              this.localOwnedProducts.add(productId);
              this.ownedProducts.add(productId);
              this.log.debug(
                `Producto ${productId} cargado desde sistema de descargas`,
                this.CAT.INIT
              );
            }
          }
        } catch (e) {
          this.log.error(
            `Error leyendo datos de descarga para ${productId}`,
            this.CAT.INIT,
            e
          );
        }
      });

      this.log.info(
        `Total productos comprados cargados: ${this.ownedProducts.size}`,
        this.CAT.INIT
      );
    } catch (e) {
      this.log.error('Error loading local purchases', this.CAT.INIT, e);
    }
  }

  getAnnouncementProductKeys(ann) {
    if (globalThis.AnnouncementUtils) {
      return globalThis.AnnouncementUtils.getProductKeys(ann);
    }
    if (!ann) return [];
    const keys = [];
    if (ann.id) keys.push(ann.id);
    if (ann.productId) keys.push(ann.productId);
    if (ann.stripeId) keys.push(ann.stripeId);
    if (ann.stripeProductId) keys.push(ann.stripeProductId);
    return keys.filter(Boolean);
  }

  resolveOwnedProductId(ann) {
    const keys = this.getAnnouncementProductKeys(ann);
    const annId = ann && ann.id ? `ann:${ann.id}` : null;
    if (annId && this.isResetSuppressed(annId)) {
      return null;
    }
    return (
      keys.find(
        key => this.ownedProducts.has(key) && !this.isResetSuppressed(key)
      ) || null
    );
  }

  formatRemainingTime(remainingMs) {
    if (globalThis.AnnouncementUtils) {
      return globalThis.AnnouncementUtils.formatRemainingTime(remainingMs);
    }
    const totalSeconds = Math.max(0, Math.floor(remainingMs / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours}h ${minutes.toString().padStart(2, '0')}m ${seconds
      .toString()
      .padStart(2, '0')}s`;
  }

  normalizeTimestamp(value) {
    if (globalThis.AnnouncementUtils) {
      return globalThis.AnnouncementUtils.normalizeTimestamp(value);
    }
    if (!value) return null;
    if (typeof value === 'number') return value;
    if (value instanceof Date) return value.getTime();
    if (typeof value.toMillis === 'function') return value.toMillis();
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  }

  getDownloadMetaRaw(productId) {
    let data = this.purchaseMeta.get(productId) || null;
    if (!data && globalThis.UltimateDownloadManager) {
      data = globalThis.UltimateDownloadManager.getDownloadData
        ? globalThis.UltimateDownloadManager.getDownloadData(productId)
        : null;
    }
    return data;
  }

  getDownloadMetaText(productId) {
    const windowMs = 48 * 60 * 60 * 1000;
    const maxDownloads = 3;

    const data = this.getDownloadMetaRaw(productId);

    if (data) {
      const rawTimestamp =
        data.purchaseTimestamp || data.purchasedAt || data.createdAt || null;
      const purchaseTs = this.normalizeTimestamp(rawTimestamp);
      if (!purchaseTs) {
        return {
          timerText: this.META_TEXT.preparing,
          downloadsText: this.META_TEXT.downloadsUnknown,
          expired: false,
          hasData: false,
        };
      }

      const elapsed = Date.now() - purchaseTs;
      const remaining = windowMs - elapsed;
      const remainingDownloads =
        maxDownloads - (data.downloadCount || 0);

      if (remaining <= 0) {
        return {
          timerText: this.META_TEXT.final,
          downloadsText: this.META_TEXT.downloadsNone,
          expired: true,
          hasData: true,
        };
      }

      if (remainingDownloads <= 0) {
        return {
          timerText: this.META_TEXT.final,
          downloadsText: this.META_TEXT.downloadsNone,
          expired: true,
          hasData: true,
        };
      }

      return {
        timerText: `Tiempo restante: ${this.formatRemainingTime(remaining)}`,
        downloadsText: `Descargas disponibles: ${remainingDownloads}`,
        expired: false,
        hasData: true,
      };
    }

    return {
      timerText: this.META_TEXT.preparing,
      downloadsText: this.META_TEXT.downloadsUnknown,
      expired: false,
      hasData: false,
    };
  }

  getDownloadMetaTextForKeys(keys) {
    if (!Array.isArray(keys) || keys.length === 0) {
      return this.getDownloadMetaText(null);
    }

    for (const key of keys) {
      const meta = this.getDownloadMetaText(key);
      if (meta && meta.hasData) return meta;
    }

    return this.getDownloadMetaText(keys[0]);
  }

  getDownloadMetaTextForAnnouncement(ann) {
    const keys = this.getAnnouncementProductKeys(ann);
    return this.getDownloadMetaTextForKeys(keys);
  }

  markAsOwnedLocally(productId) {
    if (!productId) return;
    this.log.info(
      `Marcando producto como comprado localmente: ${productId}`,
      this.CAT.AUTH
    );

    if (this.resetOverrides.has(productId)) {
      this.resetOverrides.delete(productId);
      this.saveResetOverrides();
    }
    if (this.cache && this.cache.size > 0) {
      for (const value of this.cache.values()) {
        if (
          value &&
          (value.id === productId ||
            value.productId === productId ||
            value.stripeId === productId ||
            value.stripeProductId === productId)
        ) {
          const annKey = `ann:${value.id}`;
          if (this.resetOverrides.has(annKey)) {
            this.resetOverrides.delete(annKey);
            this.saveResetOverrides();
          }
        }
      }
    }
    this.localOwnedProducts.add(productId);
    this.ownedProducts.add(productId);

    // Persistir en SecureStorage
    if (globalThis.SecureStorage) {
      const current =
        globalThis.SecureStorage.getSecureItem(this.LOCAL_STORAGE_KEY) || [];

      // CRÍTICO: Validar que current sea un array antes de usar .some()
      const currentArray = Array.isArray(current) ? current : [];

      if (!currentArray.some(item => item.id === productId)) {
        currentArray.push({
          id: productId,
          timestamp: Date.now(),
        });
        globalThis.SecureStorage.setSecureItem(
          this.LOCAL_STORAGE_KEY,
          currentArray
        );
      }
    }

    // Forzar re-render
    if (this.cache.size > 0) {
      this.render(Array.from(this.cache.values()));
    } else if (this.lastAnnouncements && this.lastAnnouncements.length > 0) {
      this.render(this.lastAnnouncements);
    }

    // Sincronizar modal de detalles si está abierto
    if (
      globalThis.announcementSystem &&
      typeof globalThis.announcementSystem.syncPublicModalOwned === 'function'
    ) {
      globalThis.announcementSystem.syncPublicModalOwned(productId);
    }
  }

  handleTimerReset(productId, keys = []) {
    if (!productId && (!keys || !keys.length)) return;
    const keysToClear = new Set();
    if (productId) keysToClear.add(productId);
    if (Array.isArray(keys)) {
      keys.forEach(k => k && keysToClear.add(k));
    }
    if (this.cache && this.cache.size > 0) {
      let ann = this.cache.get(productId) || null;
      if (!ann) {
        for (const value of this.cache.values()) {
          if (
            value &&
            (value.id === productId ||
              value.productId === productId ||
              value.stripeId === productId ||
              value.stripeProductId === productId)
          ) {
            ann = value;
            break;
          }
        }
      }
      if (ann) {
        this.getAnnouncementProductKeys(ann).forEach(k => keysToClear.add(k));
      }
    }

    let annKey = null;
    if (this.cache && this.cache.size > 0) {
      let ann = this.cache.get(productId) || null;
      if (!ann) {
        for (const value of this.cache.values()) {
          if (
            value &&
            (value.id === productId ||
              value.productId === productId ||
              value.stripeId === productId ||
              value.stripeProductId === productId)
          ) {
            ann = value;
            break;
          }
        }
      }
      if (ann && ann.id) {
        annKey = `ann:${ann.id}`;
        keysToClear.add(annKey);
      }
    }

    const list = Array.from(keysToClear).filter(Boolean);
    if (list.length === 0) return;

    this.log.info(
      `Reiniciando estado local de compra para: ${list.join(', ')}`,
      this.CAT.INIT
    );

    list.forEach(key => {
      this.resetOverrides.add(key);
      this.localOwnedProducts.delete(key);
      this.ownedProducts.delete(key);
      this.serverOwnedProducts.delete(key);
      this.serverOwnedProductsSub.delete(key);
      this.purchaseMeta.delete(key);
    });
    this.saveResetOverrides();

    // Limpiar storage local relacionado
    try {
      if (globalThis.SecureStorage) {
        const current =
          globalThis.SecureStorage.getSecureItem(this.LOCAL_STORAGE_KEY) || [];
        const arr = Array.isArray(current) ? current : [];
        const filtered = arr.filter(item => !keysToClear.has(item.id));
        globalThis.SecureStorage.setSecureItem(this.LOCAL_STORAGE_KEY, filtered);
      }
      list.forEach(key => {
        localStorage.removeItem(`${this.STORAGE_KEY_PREFIX}${key}`);
      });
    } catch (_e) {}

    if (this.cache.size > 0) {
      this.render(Array.from(this.cache.values()));
    }
    if (
      globalThis.announcementSystem &&
      typeof globalThis.announcementSystem.syncPublicModalOwned === 'function'
    ) {
      globalThis.announcementSystem.syncPublicModalOwned(productId);
    }
    if (globalThis.NotificationSystem?.success) {
      globalThis.NotificationSystem.success(
        'Timer reiniciado. Botón de compra restaurado.'
      );
    }
  }

  init() {
    this.log.info('Iniciando AnnouncementSystem...', this.CAT.INIT);
    this.setupFirestoreSync();
    // 1. Iniciamos listener de compras del usuario
    this.setupUserPurchasesListener();
    this.setupEventListeners();
    this.setupResetSync();

    // Reaccionar a reset de timers desde admin (sin refresh)
    window.addEventListener('wfx:downloadTimerReset', evt => {
      const pid = evt?.detail?.productId || evt?.detail?.id;
      const keys = evt?.detail?.keys || [];
      this.handleTimerReset(pid, keys);
    });

    // Registrar en el sistema centralizado EventDelegation para evitar warnings de 'Unknown action'
    if (globalThis.EventDelegation) {
      globalThis.EventDelegation.registerHandler(
        'buyNowAnnouncement',
        (el, ev) => {
          if (ev) ev.stopImmediatePropagation();
          this.handleBuy(el.dataset.id);
        }
      );
      globalThis.EventDelegation.registerHandler(
        'addToCartAnnouncement',
        (el, ev) => {
          if (ev) ev.stopImmediatePropagation();
          this.handleAddToCart(el.dataset.id);
        }
      );
      // Handler para descarga segura
      globalThis.EventDelegation.registerHandler('secureDownload', (el, ev) => {
        if (ev) ev.stopImmediatePropagation();

        // Llamar al UltimateDownloadManager con reintentos
        const tryDownload = (attempt = 0) => {
          if (globalThis.UltimateDownloadManager) {
            globalThis.UltimateDownloadManager.handleDownloadClick(
              el.dataset.id,
              'mock_token'
            );
          } else if (attempt < 5) {
            // Reintentar hasta 5 veces con delay de 200ms
            this.log.debug(
              `UltimateDownloadManager no disponible, reintentando... (${attempt + 1}/5)`,
              this.CAT.INIT
            );
            setTimeout(() => tryDownload(attempt + 1), 200);
          } else {
            this.log.error(
              'UltimateDownloadManager no disponible después de 5 intentos',
              this.CAT.INIT
            );
            if (globalThis.NotificationSystem) {
              globalThis.NotificationSystem.error(
                'Sistema de descargas no disponible. Por favor, recarga la página.'
              );
            }
          }
        };

        this.ensureDownloadManagerLoaded()
          .then(() => tryDownload())
          .catch(err => {
            this.log.error(
              'Error cargando UltimateDownloadManager',
              this.CAT.ERR,
              err
            );
            if (globalThis.NotificationSystem) {
              globalThis.NotificationSystem.error(
                'Sistema de descargas no disponible. Por favor, recarga la página.'
              );
            }
          });
      });
    }

    // Deshabilitar sistemas antiguos de carga si existen
    this.disableLegacySystems();

    this.log.info('Inicializado con efectos Ultra-Premium', this.CAT.INIT);

    // Inicializar interactividad 3D para tarjetas premium
    this.initPremiumInteractions();
  }

  setupResetSync() {
    if (this._resetSyncReady) return;
    this._resetSyncReady = true;

    // Storage sync across tabs
    window.addEventListener('storage', evt => {
      if (evt.key !== this.RESET_SIGNAL_KEY || !evt.newValue) return;
      try {
        const payload = JSON.parse(evt.newValue);
        if (!payload || !payload.productId) return;
        this.handleTimerReset(payload.productId, payload.keys || []);
      } catch (_e) {}
    });

    // BroadcastChannel sync (modern browsers)
    if (window.BroadcastChannel) {
      this.resetChannel = new BroadcastChannel('wfx_admin_reset');
      this.resetChannel.addEventListener('message', evt => {
        const payload = evt?.data;
        if (!payload || !payload.productId) return;
        this.handleTimerReset(payload.productId, payload.keys || []);
      });
    }
  }

  /**
   * Sincroniza las compras del usuario vía AppState (Unificado)
   */
  setupUserPurchasesListener() {
    if (!globalThis.AppState) {
      // Fallback original si no hay AppState
      if (!globalThis.firebase || !globalThis.firebase.auth) return;
      globalThis.firebase
        .auth()
        .onAuthStateChanged(user => this._handleUserChange(user));
      return;
    }

    this.log.debug('Subscribing to AppState user changes...', this.CAT.AUTH);
    globalThis.AppState.subscribe('user', user => {
      this._handleUserChange(user);
    });
  }

  _handleUserChange(user) {
    // Limpiar suscripción anterior
    if (this.unsubscribeUser) {
      this.unsubscribeUser();
      this.unsubscribeUser = null;
    }
    if (this.unsubscribeUserPurchases) {
      this.unsubscribeUserPurchases();
      this.unsubscribeUserPurchases = null;
    }

    // CRÍTICO: Limpiar ownedProducts al cambiar de usuario
    // Esto previene que las compras de un usuario sean visibles para otros usuarios
    this.ownedProducts.clear();
    this.serverOwnedProducts.clear();
    this.serverOwnedProductsSub.clear();
    this.purchaseMeta.clear();

    if (user && (user.uid || user.isAuthenticated)) {
      try {
        const uid = user.uid;
        const db = globalThis.firebase.firestore();
        const userDocRef = db.collection('users').doc(uid);

        // Arquitectura: Escuchar cambios en el documento principal del usuario
        // en lugar de la subcolección restringida 'purchases'.
        // 'purchases' es un array de IDs en el documento de usuario (ver post-checkout-handler.js)
        this.unsubscribeUser = userDocRef.onSnapshot(
          doc => {
            // CRÍTICO: Limpiar ownedProducts antes de cargar nuevas compras
            // Esto asegura que solo las compras del usuario actual estén en ownedProducts
            this.ownedProducts.clear();

            // 1. Mantener productos locales (compras recientes)
            this.localOwnedProducts.forEach(id => this.ownedProducts.add(id));

            // 2. Agregar productos del servidor (array 'purchases')
            if (doc.exists) {
              const userData = doc.data();
              if (userData && Array.isArray(userData.purchases)) {
                this.serverOwnedProducts.clear();
                userData.purchases.forEach(productId => {
                  if (!this.isResetSuppressed(productId)) {
                    this.serverOwnedProducts.add(productId);
                  }
                });
                this.serverOwnedProducts.forEach(id =>
                  this.ownedProducts.add(id)
                );
                this.log.debug(
                  `Sincronizadas ${userData.purchases.length} compras del perfil`,
                  this.CAT.AUTH
                );
              }
            }

            // 3. Agregar productos del servidor (subcolección purchases)
            this.serverOwnedProductsSub.forEach(id =>
              this.ownedProducts.add(id)
            );

            // 4. Renderizar si hay datos
            if (this.cache.size > 0) {
              this.render(Array.from(this.cache.values()));
            }
          },
          error => {
            // Manejo silencioso de errores de permisos para no ensuciar la consola
            if (error.code === 'permission-denied') {
              this.log.warn(
                'Permiso denegado al perfil de usuario - Usando solo datos locales',
                this.CAT.AUTH
              );
            } else {
              this.log.error(
                'Error sincronizando perfil de usuario',
                this.CAT.AUTH,
                error
              );
            }
          }
        );

        // Fallback: escuchar subcolección users/{uid}/purchases
        const purchasesRef = userDocRef.collection('purchases');
        this.unsubscribeUserPurchases = purchasesRef.onSnapshot(
          snap => {
            this.serverOwnedProductsSub.clear();
            this.purchaseMeta.clear();
            snap.forEach(doc => {
              const data = doc.data();
              const pid = data.productId || doc.id;
              if (pid && !this.isResetSuppressed(pid)) {
                const rawTimestamp =
                  data.purchaseTimestamp ||
                  data.purchasedAt ||
                  data.createdAt ||
                  null;
                const purchaseTs = this.normalizeTimestamp(rawTimestamp);
                this.serverOwnedProductsSub.add(pid);
                this.purchaseMeta.set(pid, {
                  purchaseTimestamp: purchaseTs || rawTimestamp,
                  downloadCount: data.downloadCount || 0,
                  lastDownloadAt: data.lastDownloadAt || null,
                });
              }
            });

            // Recalcular ownedProducts con unión de fuentes
            this.ownedProducts.clear();
            this.localOwnedProducts.forEach(id => this.ownedProducts.add(id));
            this.serverOwnedProducts.forEach(id => this.ownedProducts.add(id));
            this.serverOwnedProductsSub.forEach(id =>
              this.ownedProducts.add(id)
            );

            if (this.cache.size > 0) {
              this.render(Array.from(this.cache.values()));
            }
          },
          error => {
            if (error.code === 'permission-denied') {
              this.log.warn(
                'Permiso denegado a subcolección purchases',
                this.CAT.AUTH
              );
            } else {
              this.log.error(
                'Error sincronizando purchases (subcolección)',
                this.CAT.AUTH,
                error
              );
            }
          }
        );
      } catch (error) {
        this.log.error(
          'Error configurando listener de purchases',
          this.CAT.AUTH,
          error
        );
      }
    } else {
      // Usuario no autenticado: limpiar ownedProducts completamente
      // Solo mantener productos locales (compras recientes)
      this.ownedProducts.clear();
      this.localOwnedProducts.forEach(id => this.ownedProducts.add(id));
      if (this.cache.size > 0) {
        this.render(Array.from(this.cache.values()));
      }
    }
  }

  /**
   * Inicializa interacciones 3D avanzadas (Parallax/Tilt)
   */
  initPremiumInteractions() {
    // CSP strict: mantener solo efectos CSS sin estilos inline.
  }

  disableLegacySystems() {
    if (globalThis.announcementManager) {
      this.log.debug(
        'Deshabilitando AnnouncementManager antiguo',
        this.CAT.INIT
      );
      // No lo borramos del todo por si acaso, pero evitamos que duplique
      globalThis.announcementManager.renderPublicAnnouncements = () => {};
    }
  }

  setupFirestoreSync() {
    if (!globalThis.firebase || !globalThis.firebase.firestore) {
      this.log.warn('Firestore no disponible', this.CAT.FIREBASE);
      return;
    }

    const db = globalThis.firebase.firestore();

    // Intentar con createdAt primero (más confiable), fallback a timestamp
    const trySync = orderField => {
      this.unsubscribe = db
        .collection('announcements')
        .orderBy(orderField, 'desc')
        .onSnapshot(
          snapshot => {
            const announcements = [];
            this.cache.clear();

            snapshot.forEach(doc => {
              const data = doc.data();
              data.id = doc.id;
              announcements.push(data);
              this.cache.set(doc.id, data);
            });

            this.log.debug(
              `${announcements.length} anuncio(s) cargado(s) desde Firestore`,
              this.CAT.FIREBASE
            );
            this.render(announcements);
            this.notifyListeners('update', announcements);
          },
          error => {
            this.log.error(
              `Error con orderBy("${orderField}")`,
              this.CAT.FIREBASE,
              error
            );

            // Si falla con createdAt, intentar con timestamp
            if (orderField === 'createdAt') {
              this.log.debug('Intentando con timestamp...', this.CAT.FIREBASE);
              trySync('timestamp');
            } else {
              // Si ambos fallan, cargar sin ordenar
              this.log.debug('Cargando sin ordenar...', this.CAT.FIREBASE);
              this.unsubscribe = db.collection('announcements').onSnapshot(
                snapshot => {
                  const announcements = [];
                  this.cache.clear();

                  snapshot.forEach(doc => {
                    const data = doc.data();
                    data.id = doc.id;
                    announcements.push(data);
                    this.cache.set(doc.id, data);
                  });

                  this.log.debug(
                    `${announcements.length} anuncio(s) cargado(s) (sin ordenar)`,
                    this.CAT.FIREBASE
                  );
                  this.render(announcements);
                  this.notifyListeners('update', announcements);
                },
                err => {
                  this.log.error(
                    'Error crítico en Firestore',
                    this.CAT.FIREBASE,
                    err
                  );
                }
              );
            }
          }
        );
    };

    // Iniciar con createdAt
    trySync('createdAt');
  }

  setupEventListeners() {
    // Delegación de eventos para el botón 'Comprar' y 'Añadir al carrito' en el grid
    document.addEventListener('click', e => {
      const buyBtn = e.target.closest('[data-action="buyNowAnnouncement"]');
      const cartBtn = e.target.closest('[data-action="addToCartAnnouncement"]');
      const downloadBtn = e.target.closest('[data-action="secureDownload"]'); // Nuevo btn
      const card = e.target.closest('.announcement-card');

      if (downloadBtn) {
        // Gestionado por EventDelegation, pero prevenimos default aquí por si acaso
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      if (buyBtn) {
        const id = buyBtn.dataset.id;
        this.handleBuy(id);
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      if (cartBtn) {
        const id = cartBtn.dataset.id;
        this.handleAddToCart(id);
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      // Click en la tarjeta abre el modal de detalles
      if (card && !e.target.closest('button')) {
        const id = card.dataset.announcementId;
        const ann = this.cache.get(id);
        if (!ann) return;
        this.openAnnouncementModal(ann);
      }
    });
  }

  openAnnouncementModal(ann) {
    if (globalThis.openPublicDetailModal) {
      globalThis.openPublicDetailModal(ann);
      return;
    }
    this.ensurePublicModalLoaded()
      .then(() => {
        if (globalThis.openPublicDetailModal) {
          globalThis.openPublicDetailModal(ann);
        }
      })
      .catch(err => {
        this.log.error(
          'Error cargando modal público de anuncios',
          this.CAT.ERR,
          err
        );
      });
  }

  // ... (render and createAnnouncementCard methods remain largely same logic wise, but refinements applied below) ...

  render(announcements) {
    const container = document.getElementById('publicAnnouncementsContainer');
    if (!container) {
      this.log.error(
        'Container #publicAnnouncementsContainer not found',
        this.CAT.INIT
      );
      return;
    }

    this.lastAnnouncements = Array.isArray(announcements)
      ? announcements
      : [];

    const skeleton = document.getElementById('skeletonAnnouncements');

    if (announcements.length === 0) {
      if (skeleton) skeleton.classList.add('hidden');
      container.innerHTML =
        '<div class="announcement-empty"><p>No hay anuncios disponibles</p></div>';
      return;
    }

    // Solo renderizar anuncios, sin la tarjeta de advertencia
    // La advertencia debe estar en el HTML como elemento separado
    const html = announcements
      .map(ann => this.createAnnouncementCard(ann))
      .join('');

    // Sanitización permisiva para mantener el diseño rico de 1.html
    // IMPORTANTE: No usar XSSProtection.setInnerHTML porque escapa el HTML como texto
    // En su lugar, sanitizamos con DOMPurify y luego insertamos directamente
    if (globalThis.DOMPurify) {
      const sanitized = globalThis.DOMPurify.sanitize(html, {
        ALLOWED_TAGS: [
          'b',
          'i',
          'em',
          'strong',
          'a',
          'p',
          'br',
          'ul',
          'ol',
          'li',
          'h3',
          'h4',
          'div',
          'img',
          'span',
          'iframe',
          'svg',
          'path',
          'use',
          'button',
          'i',
        ],
        ALLOWED_ATTR: [
          'href',
          'title',
          'target',
          'src',
          'alt',
          'class',
          'id', // CRÍTICO: Permitir atributo id para timer-${productId} y downloads-${productId}
          'data-id',
          'data-product-id', // Importante para UDM
          'data-announcement-id',
          'data-action',
          'data-text',
          'data-share-title',
          'data-share-text',
          'data-share-url',
          'frameborder',
          'allow',
          'allowfullscreen',
          'loading',
          'style',
          'viewBox',
          'd',
          'fill',
          'xmlns',
          'disabled', // Para estado loading
        ],
        ADD_TAGS: ['iframe', 'svg', 'use'],
        ADD_ATTR: [
          'allow',
          'allowfullscreen',
          'frameborder',
          'data-translate',
          'data-action',
          'data-product-id',
          'id', // CRÍTICO: Asegurar que id se preserve
        ],
      });
      container.innerHTML = sanitized;
    } else {
      // Fallback: insertar directamente (solo en desarrollo local)
      container.innerHTML = html;
      this.log.warn(
        'DOMPurify no disponible, insertando HTML sin sanitizar',
        this.CAT.INIT
      );
    }

    if (skeleton) {
      skeleton.classList.add('hidden');
      skeleton.setAttribute('aria-busy', 'false');
    }

    // Inicializar iconos Lucide
    if (globalThis.lucide) {
      globalThis.lucide.createIcons();
    }

    // Inicializar cronómetros para productos comprados
    this.initializeTimers(announcements);
  }

  /**
   * Inicializa los cronómetros de cuenta atrás para productos comprados
   */
  initializeTimers(announcements) {
    announcements.forEach(ann => {
      const ownedProductId = this.resolveOwnedProductId(ann);
      if (ownedProductId) {
        // Producto comprado, iniciar cronómetro
        if (globalThis.UltimateDownloadManager) {
          // Obtener datos de descarga desde localStorage
          const data =
            globalThis.UltimateDownloadManager.getDownloadData(ownedProductId);
          if (data && data.purchaseTimestamp) {
            // Iniciar cronómetro persistente
            setTimeout(() => {
              globalThis.UltimateDownloadManager.startPersistentTimer(
                ownedProductId,
                data
              );
            }, 500);
          }
        }
      }
    });
  }

  createAnnouncementCard(ann) {
    const id = ann.id || '';
    const productId = ann.productId || null;
    const primaryProductId = id || productId || '';
    const name = ann.name || ann.title || 'Sin nombre';
    const price = Number.parseFloat(ann.price || 0).toFixed(2);
    const baseOrigin =
      (typeof window !== 'undefined' && window.location && window.location.origin) ||
      'https://wifihackx.com';
    const shareUrl = `${baseOrigin}/?utm_source=share&utm_medium=announcement&utm_campaign=card#ann-${id}`;
    const imageUrl =
      ann.imageUrl || (ann.mainImage && ann.mainImage.url) || '/Tecnologia.webp';
    const isNew =
      ann.isNew ||
      (ann.createdAt &&
        Date.now() - ann.createdAt.seconds * 1000 < 7 * 24 * 60 * 60 * 1000);

    // --- LÓGICA SMART BUTTON ---
    const ownedProductId = this.resolveOwnedProductId(ann);
    const isOwned = Boolean(ownedProductId);
    const downloadProductId = ownedProductId || primaryProductId;
    const metaText = isOwned
      ? this.getDownloadMetaTextForAnnouncement(ann)
      : null;
    let buttonsHTML = '';

    if (isOwned) {
      // Botón DESCARGAR (Secure) con cronómetro y contador de descargas
      const isExpired = metaText ? metaText.expired : false;
      const downloadLabel = isExpired ? 'Adquirido' : 'DESCARGAR [SECURE]';
      const finalClass = isExpired ? 'is-final' : '';
      const acquiredClass = isExpired ? 'is-acquired' : '';
      buttonsHTML = `
                <button class="announcement-btn btn-download-secure w-full ${acquiredClass}" 
                        id="btn-download-${id}"
                        data-action="secureDownload" 
                        data-id="${id}"
                        data-product-id="${downloadProductId}"
                        title="Transferencia Segura" ${isExpired ? 'disabled aria-disabled="true"' : ''}>
                    <div class="secure-download-content">
                        <i data-lucide="shield-check" class="text-neon-green"></i>
                        <span class="btn-text glitch-text" data-text="${downloadLabel}">${downloadLabel}</span>
                    </div>
                    <div class="secure-progress-bar"></div>
                </button>
                <div class="download-meta">
                    <div class="download-timer-container">
                        <i data-lucide="clock" class="icon-14"></i>
                        <span id="timer-${id}" class="countdown-timer ${finalClass}" data-timer-for="${downloadProductId}">${metaText ? metaText.timerText : this.META_TEXT.preparing}</span>
                    </div>
                    <div class="download-counter-container">
                        <i data-lucide="download" class="icon-14"></i>
                        <span id="downloads-${id}" class="downloads-counter ${finalClass}" data-downloads-for="${downloadProductId}">${metaText ? metaText.downloadsText : this.META_TEXT.downloadsUnknown}</span>
                    </div>
                </div>
            `;
    } else {
      // Botones COMPRAR / CARRITO (Standard)
      buttonsHTML = `
                <button class="announcement-btn announcement-btn-buy premium-btn-neon" 
                        data-action="buyNowAnnouncement" 
                        data-id="${id}"
                        data-product-id="${primaryProductId}"
                        title="Comprar Ahora">
                    <div class="btn-glow-layer"></div>
                    <i data-lucide="zap"></i>
                    <span class="btn-text" data-translate="buy_now">Comprar Ahora</span>
                </button>
                <button class="announcement-btn announcement-btn-cart premium-btn-glass" 
                        data-action="addToCartAnnouncement" 
                        data-id="${id}"
                        data-product-id="${primaryProductId}"
                        title="Añadir al carrito">
                    <i data-lucide="shopping-cart"></i>
                    <span class="btn-text" data-translate="add_to_cart">Añadir al Carrito</span>
                </button>
            `;
    }
    // ---------------------------

    return `
            <div class="announcement-card premium-3d-card" data-announcement-id="${id}">
                <div class="card-glass-shimmer"></div>
                <div class="card-scanner-line"></div>
                <div class="announcement-card-border-glow"></div>
                
                ${
                  isNew
                    ? `
                    <div class="announcement-badge-new">
                        <span class="badge-glitch-text" data-text="NUEVO">NUEVO</span>
                    </div>
                `
                    : ''
                }

                <div class="announcement-card-image-wrapper">
                    <div class="image-depth-overlay"></div>
                    <img src="${imageUrl}" 
                         alt="${name}" 
                         class="announcement-card-image" 
                         loading="lazy"
                         decoding="async">
                </div>

                <div class="announcement-card-content">
                    <div class="announcement-card-header">
                        <div class="name-container">
                            <h3 class="announcement-card-name glitch-hover" data-text="${name}">${name}</h3>
                            <div class="name-underline"></div>
                        </div>
                        <div class="price-container">
                            ${
                              isOwned
                                ? '<span class="owned-badge">ADQUIRIDO</span>'
                                : `<span class="announcement-card-price neon-pulse-text">€${price}</span>`
                            }
                        </div>
                        <button class="announcement-share-btn share-icon-btn" data-action="share" data-share-title="${name}" data-share-text="Producto WifiHackX" data-share-url="${shareUrl}" aria-label="Compartir anuncio">
                          <i data-lucide="share-2"></i>
                        </button>
                    </div>

                    <div class="announcement-buttons-container ${isOwned ? 'mode-download' : ''}">
                        ${buttonsHTML}
                    </div>
                </div>
            </div>
        `;
  }

  handleBuy(id) {
    const ann = this.cache.get(id);
    if (!ann) return;

    this.handleAddToCart(id);
    if (globalThis.showCart) {
      globalThis.showCart();
    }
  }

  handleAddToCart(id) {
    const ann = this.cache.get(id);
    if (!ann) return;

    const tryAdd = (attempt = 0) => {
      if (globalThis.CartManager && globalThis.CartManager.addItem) {
        globalThis.CartManager.addItem({
          id: ann.id,
          title: ann.name || ann.title || 'Producto',
          price: Number.parseFloat(ann.price) || 0,
          imageUrl:
            ann.imageUrl ||
            (ann.mainImage && ann.mainImage.url) ||
            '/Tecnologia.webp',
          stripeId: ann.stripeId,
        });
        return;
      }

      if (attempt < 5) {
        setTimeout(() => tryAdd(attempt + 1), 150);
        return;
      }

      this.log.error('CartManager no disponible', this.CAT.INIT);
      if (globalThis.NotificationSystem) {
        globalThis.NotificationSystem.error('Error al añadir al carrito');
      }
    };

    tryAdd();
  }

  onUpdate(callback) {
    if (typeof callback === 'function') this.listeners.push(callback);
  }

  notifyListeners(event, data) {
    this.listeners.forEach(cb => cb(event, data));
  }
}

function setupAnnouncementSystem() {
  globalThis.announcementSystem = new AnnouncementSystem();
  const tryInit = () => {
    if (
      globalThis.firebase &&
      globalThis.firebase.firestore &&
      document.getElementById('publicAnnouncementsContainer')
    ) {
      globalThis.announcementSystem.init();
    } else {
      setTimeout(tryInit, 200);
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', tryInit);
  } else {
    tryInit();
  }
}

export function initAnnouncementSystem() {
  if (window.__ANNOUNCEMENT_SYSTEM_INITED__) {
    return;
  }

  window.__ANNOUNCEMENT_SYSTEM_INITED__ = true;
  setupAnnouncementSystem();
}

if (typeof window !== 'undefined' && !window.__ANNOUNCEMENT_SYSTEM_NO_AUTO__) {
  initAnnouncementSystem();
}

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AnnouncementSystem;
}
// Also expose class globally for tests
if (typeof window !== 'undefined') {
  window.AnnouncementSystem = AnnouncementSystem;
}



