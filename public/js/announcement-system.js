import { subscribePurchaseCompleted } from './purchase-integration.js';
import {
  escapeAttr,
  escapeHtml,
  sanitizeHttpUrl,
} from './security/dom-safety.js';

/**
 * announcement-system.js
 * Gestión de anuncios en el frontend público
 * Fuente única: edita `src/js`; `public/js` se sincroniza con `npm run mirror:sync`.
 */

class AnnouncementSystem {
  constructor() {
    this.cache = new Map();
    this.listeners = [];
    this.unsubscribe = null;
    this.log = globalThis.Logger || console;
    this.CAT = {
      INIT: 'INIT',
      FIREBASE: 'FIREBASE',
      AUTH: 'AUTH',
      ERR: 'ERR',
    };
    this.lastAnnouncements = [];
    this.ownedProducts = new Set(); // IDs de productos comprados centralizados
    this.localOwnedProducts = new Set(); // Compras de esta sesión (para feedback instantáneo)
    this.serverOwnedProductsUser = new Set(); // Compras canónicas desde users/{uid}/purchases
    this.serverOwnedProductsOrders = new Set(); // Fallback persistente desde orders
    this.serverOwnedProductsProfile = new Set(); // Fallback desde users/{uid}.purchases
    this.purchaseMeta = new Map(); // productId -> {purchaseTimestamp, downloadCount, lastDownloadAt}
    this.resetChannel = null;
    this.purchaseSyncUnsubscribers = [];
    this.activePurchaseSyncUid = '';
    this.authUnsubscribe = null;
    this.authReadyListenersCleanup = null;
    this.LOCAL_PURCHASES_KEY = 'wfx_local_purchases';
    this.PUBLIC_CATALOG_CACHE_KEY = 'wfx_public_announcements_cache_v1';
    this.PUBLIC_CATALOG_LIMIT = 20;
    this.PUBLIC_CATALOG_CACHE_TTL_MS = 5 * 60 * 1000;

    this.META_TEXT = {
      preparing: 'Preparando...',
      expired: 'Enlace expirado',
      downloadsRemaining: 'descargas pendientes',
      downloadsUnknown: 'N/A',
    };
  }

  normalizeProductKey(value) {
    if (
      globalThis.AnnouncementUtils &&
      typeof globalThis.AnnouncementUtils.normalizeProductKey === 'function'
    ) {
      return globalThis.AnnouncementUtils.normalizeProductKey(value);
    }
    return value === null || value === undefined ? '' : String(value).trim();
  }

  getAnnouncementProductKeys(ann) {
    if (
      globalThis.AnnouncementUtils &&
      typeof globalThis.AnnouncementUtils.getProductKeys === 'function'
    ) {
      return globalThis.AnnouncementUtils.getProductKeys(ann).map(key =>
        this.normalizeProductKey(key)
      );
    }
    if (!ann) return [];
    return [ann.id, ann.productId, ann.stripeId, ann.stripeProductId]
      .map(value => this.normalizeProductKey(value))
      .filter(Boolean);
  }

  getCurrentUserUid() {
    return String(globalThis.firebase?.auth?.()?.currentUser?.uid || '').trim();
  }

  getLocalPurchasesStorageKey(uid = this.getCurrentUserUid()) {
    const normalizedUid = String(uid || '').trim();
    if (!normalizedUid) return '';
    return `${this.LOCAL_PURCHASES_KEY}:${normalizedUid}`;
  }

  getDownloadStorageKeys(uid = this.getCurrentUserUid()) {
    const manager = globalThis.UltimateDownloadManager;
    if (!manager || typeof manager.listScopedStorageProductIds !== 'function') return [];
    return manager.listScopedStorageProductIds(manager.STORAGE_KEY_PREFIX || 'wfx_download_', uid);
  }

  buildSecureDownloadMarkup(options) {
    if (
      globalThis.AnnouncementUtils &&
      typeof globalThis.AnnouncementUtils.buildSecureDownloadMarkup === 'function'
    ) {
      return globalThis.AnnouncementUtils.buildSecureDownloadMarkup(options);
    }

    const {
      buttonClass = '',
      buttonId = '',
      announcementId = '',
      productId = '',
      timerId = '',
      downloadsId = '',
      timerText = this.META_TEXT.preparing,
      downloadsText = this.META_TEXT.downloadsUnknown,
      label = 'DESCARGAR [SECURE]',
      isExpired = false,
      title = '',
    } = options || {};

    const acquiredClass = isExpired ? 'is-acquired' : '';
    const normalizedButtonClass = `${buttonClass} ${acquiredClass}`.trim();
    const finalClass = isExpired ? 'is-final' : '';
    const safeButtonId = this.escapeAttr(buttonId);
    const safeAnnouncementId = this.escapeAttr(announcementId);
    const safeProductId = this.escapeAttr(productId);
    const safeTimerId = this.escapeAttr(timerId);
    const safeDownloadsId = this.escapeAttr(downloadsId);
    const safeTitle = this.escapeAttr(title);
    const safeLabel = this.escapeHtml(label);
    const safeTimerText = this.escapeHtml(timerText);
    const safeDownloadsText = this.escapeHtml(downloadsText);
    const idAttr = safeButtonId ? ` id="${safeButtonId}"` : '';
    const timerIdAttr = safeTimerId ? ` id="${safeTimerId}"` : '';
    const downloadsIdAttr = safeDownloadsId ? ` id="${safeDownloadsId}"` : '';
    const titleAttr = safeTitle ? ` title="${safeTitle}"` : '';
    const disabledAttr = isExpired ? ' disabled aria-disabled="true"' : '';

    return `
      <button class="${normalizedButtonClass}"${idAttr}
              data-action="secureDownload"
              data-id="${safeAnnouncementId}"
              data-product-id="${safeProductId}"${titleAttr}${disabledAttr}>
        <div class="secure-download-content">
          <i data-lucide="shield-check" class="text-neon-green"></i>
          <span class="btn-text glitch-text" data-text="${safeLabel}">${safeLabel}</span>
        </div>
        <div class="secure-progress-bar"></div>
      </button>
      <div class="download-meta">
        <div class="download-timer-container">
          <i data-lucide="clock" class="icon-14"></i>
          <span${timerIdAttr} class="countdown-timer ${finalClass}" data-timer-for="${safeProductId}">${safeTimerText}</span>
        </div>
        <div class="download-counter-container">
          <i data-lucide="download" class="icon-14"></i>
          <span${downloadsIdAttr} class="downloads-counter ${finalClass}" data-downloads-for="${safeProductId}">${safeDownloadsText}</span>
        </div>
      </div>
    `;
  }

  escapeHtml(value) {
    return escapeHtml(value);
  }

  escapeAttr(value) {
    return escapeAttr(value);
  }

  sanitizeUrl(value, fallback = '') {
    return sanitizeHttpUrl(value, fallback);
  }

  init() {
    this.log.info('Inicializando AnnouncementSystem (Public)...', this.CAT.INIT);

    this.disableLegacySystems();
    this.loadLocalPurchases();
    this.setupAuthListener();
    this.setupFirestoreSync();
    this.setupEventListeners();
    this.setupResetSync();

    // Reaccionar a reset de timers desde admin (sin refresh)
    window.addEventListener('wfx:downloadTimerReset', evt => {
      const detail = evt && evt.detail;
      const pid = detail && (detail.productId || detail.id);
      const keys = detail && detail.keys ? detail.keys : [];
      this.handleTimerReset(pid, keys);
    });

    // Registrar en el sistema centralizado EventDelegation para evitar warnings de 'Unknown action'
    if (globalThis.EventDelegation) {
      globalThis.EventDelegation.registerHandler('buyNowAnnouncement', (el, _ev) => {
        const id = el.dataset.id;
        this.handleBuy(id);
      });

      globalThis.EventDelegation.registerHandler('addToCartAnnouncement', (el, _ev) => {
        const id = el.dataset.id;
        this.handleAddToCart(id);
      });

      globalThis.EventDelegation.registerHandler('secureDownload', (el, _ev) => {
        const dataset = el.dataset;
        const id = dataset && (dataset.productId || dataset.productid || dataset.id);
        if (globalThis.UltimateDownloadManager) {
          if (typeof globalThis.UltimateDownloadManager.initiateDownload === 'function') {
            globalThis.UltimateDownloadManager.initiateDownload(id, el);
          } else if (typeof globalThis.UltimateDownloadManager.handleDownloadClick === 'function') {
            globalThis.UltimateDownloadManager.handleDownloadClick(id, null, el);
          } else {
            this.log.error('UltimateDownloadManager no expone método de descarga', this.CAT.ERR);
          }
        } else {
          this.log.error('UltimateDownloadManager no disponible', this.CAT.ERR);
        }
      });
    }
  }

  /**
   * Sincroniza resets de timers entre pestañas vía BroadcastChannel
   */
  setupResetSync() {
    // BroadcastChannel sync (modern browsers)
    if (window.BroadcastChannel) {
      try {
        this.resetChannel = new BroadcastChannel('wfx_admin_reset');
        this.resetChannel.addEventListener('message', evt => {
          const payload = evt && evt.data;
          if (!payload || !payload.productId) return;
          this.handleTimerReset(payload.productId, payload.keys || []);
        });
      } catch (_e) {
        console.warn('BroadcastChannel not supported');
      }
    }
  }

  /**
   * Procesa el reset de un timer sin necesidad de refrescar la página
   */
  handleTimerReset(productId, _keysToRemove = []) {
    if (!productId) return;

    this.log.info(`Resetting timer for product: ${productId}`, this.CAT.INIT);

    // 1. Limpiar supresión local
    this.localOwnedProducts.delete(productId);

    // 2. Limpiar caché de UltimateDownloadManager si existe
    if (globalThis.UltimateDownloadManager) {
      const manager = globalThis.UltimateDownloadManager;

      // Compatibilidad: limpiar local cache sin depender de métodos opcionales.
      try {
        if (typeof manager?.buildScopedStorageKey === 'function') {
          const scopedDownloadKey = manager.buildScopedStorageKey(
            manager.STORAGE_KEY_PREFIX || 'wfx_download_',
            productId
          );
          const scopedLastDownloadKey = manager.buildScopedStorageKey(
            manager.LAST_DOWNLOAD_KEY || 'wfx_last_download_',
            productId
          );
          if (scopedDownloadKey) localStorage.removeItem(scopedDownloadKey);
          if (scopedLastDownloadKey) localStorage.removeItem(scopedLastDownloadKey);
        }
      } catch (_e) {}

      if (typeof manager.clearLocalCache === 'function') {
        manager.clearLocalCache(productId);
      }

      // Si el objeto timer existe, destruirlo
      if (manager.activeTimers && manager.activeTimers.has(productId)) {
        clearInterval(manager.activeTimers.get(productId));
        manager.activeTimers.delete(productId);
        if (typeof manager.stopTimer === 'function') {
          manager.stopTimer(productId);
        }
      }
    }

    // 3. Forzar re-render de la UI para ese producto
    if (this.lastAnnouncements.length > 0) {
      this.render(this.lastAnnouncements);
    }

    // 4. Disparar evento para otros componentes
    window.dispatchEvent(
      new CustomEvent('wfx:announcementUIUpdated', {
        detail: {
          productId,
        },
      })
    );
  }

  loadLocalPurchases() {
    try {
      const localPurchasesKey = this.getLocalPurchasesStorageKey();
      const localRaw = localPurchasesKey ? localStorage.getItem(localPurchasesKey) : null;
      this.localOwnedProducts.clear();
      this.ownedProducts.clear();
      const addOwnedId = value => {
        const normalized = this.normalizeProductKey(value);
        if (!normalized) return;
        this.localOwnedProducts.add(normalized);
        this.ownedProducts.add(normalized);
      };
      if (localRaw) {
        const ids = JSON.parse(localRaw);
        if (Array.isArray(ids)) {
          ids.forEach(addOwnedId);
        }
      }

      // Reconstrucción defensiva: si el índice principal se perdió, recuperar desde
      // los metadatos de descargas persistidos por UltimateDownloadManager.
      this.getDownloadStorageKeys().forEach(addOwnedId);

      if (this.localOwnedProducts.size > 0) {
        this.persistLocalPurchases();
      }
    } catch (e) {
      this.log.error('Error cargando compras locales', this.CAT.INIT, e);
    }
  }

  persistLocalPurchases() {
    try {
      const localPurchasesKey = this.getLocalPurchasesStorageKey();
      if (!localPurchasesKey) return;
      localStorage.setItem(localPurchasesKey, JSON.stringify(Array.from(this.localOwnedProducts)));
    } catch (e) {
      this.log.error('Error guardando compras locales', this.CAT.INIT, e);
    }
  }

  rebuildOwnedProducts() {
    this.ownedProducts.clear();
    this.localOwnedProducts.forEach(id => this.ownedProducts.add(id));
    this.serverOwnedProductsUser.forEach(id => this.ownedProducts.add(id));
    this.serverOwnedProductsOrders.forEach(id => this.ownedProducts.add(id));
    this.serverOwnedProductsProfile.forEach(id => this.ownedProducts.add(id));
  }

  clearPurchaseSyncListeners() {
    this.purchaseSyncUnsubscribers.forEach(unsubscribe => {
      try {
        unsubscribe();
      } catch (_e) {}
    });
    this.purchaseSyncUnsubscribers = [];
    this.activePurchaseSyncUid = '';
  }

  selectPreferredPurchaseRecord(current, candidate) {
    if (!candidate) return current || null;
    if (!current) return candidate;

    const currentTs = this.normalizeTimestamp(
      current.purchaseTimestamp ||
        current.purchasedAt ||
        current.purchaseDate ||
        current.paidAt ||
        current.completedAt ||
        null
    );
    const candidateTs = this.normalizeTimestamp(
      candidate.purchaseTimestamp ||
        candidate.purchasedAt ||
        candidate.purchaseDate ||
        candidate.paidAt ||
        candidate.completedAt ||
        null
    );

    if (candidateTs && !currentTs) return candidate;
    if (currentTs && !candidateTs) return current;
    if (candidateTs && currentTs && candidateTs !== currentTs) {
      const timeGap = Math.abs(candidateTs - currentTs);
      const sameSession =
        String(candidate.sessionId || candidate.paypalOrderId || candidate.orderId || '').trim() &&
        String(candidate.sessionId || candidate.paypalOrderId || candidate.orderId || '').trim() ===
          String(current.sessionId || current.paypalOrderId || current.orderId || '').trim();
      const samePurchaseWindow = timeGap <= 5 * 60 * 1000;

      if (!sameSession && !samePurchaseWindow) {
        return candidateTs > currentTs ? candidate : current;
      }
    }

    const maxDownloads =
      (globalThis.UltimateDownloadManager && globalThis.UltimateDownloadManager.MAX_DOWNLOADS) || 3;
    const currentCount = Number.isFinite(Number(current.downloadCount))
      ? Math.max(0, Number(current.downloadCount))
      : 0;
    const candidateCount = Number.isFinite(Number(candidate.downloadCount))
      ? Math.max(0, Number(candidate.downloadCount))
      : 0;
    const currentActive = currentCount < maxDownloads;
    const candidateActive = candidateCount < maxDownloads;

    if (candidateActive !== currentActive) {
      if (candidateCount === currentCount) {
        return candidateActive ? candidate : current;
      }
      return candidateCount > currentCount ? candidate : current;
    }

    const currentUpdated = this.normalizeTimestamp(
      current.lastDownloadAt || current.lastDownloadTimestamp || current.updatedAt || null
    );
    const candidateUpdated = this.normalizeTimestamp(
      candidate.lastDownloadAt || candidate.lastDownloadTimestamp || candidate.updatedAt || null
    );

    if (candidateUpdated && !currentUpdated) return candidate;
    if (currentUpdated && !candidateUpdated) return current;
    if (candidateUpdated && currentUpdated && candidateUpdated !== currentUpdated) {
      return candidateUpdated > currentUpdated ? candidate : current;
    }

    if (candidateCount !== currentCount) {
      return candidateCount > currentCount ? candidate : current;
    }

    return candidateUpdated >= currentUpdated ? candidate : current;
  }

  collectCanonicalPurchaseRecords(snapshot) {
    const canonicalByProduct = new Map();
    const exactDocIds = new Set();

    snapshot.forEach(doc => {
      const data = doc.data();
      if (!data) return;
      const pid = this.normalizeProductKey(data.productId || doc.id);
      if (!pid || this.isResetSuppressed(pid)) return;
      if (doc.id === pid) {
        exactDocIds.add(pid);
        canonicalByProduct.set(pid, data);
      }
    });

    snapshot.forEach(doc => {
      const data = doc.data();
      if (!data) return;
      const pid = this.normalizeProductKey(data.productId || doc.id);
      if (!pid || this.isResetSuppressed(pid) || exactDocIds.has(pid)) return;
      canonicalByProduct.set(
        pid,
        this.selectPreferredPurchaseRecord(canonicalByProduct.get(pid), data)
      );
    });

    return canonicalByProduct;
  }

  storePurchaseMeta(productId, data = {}, options = {}) {
    const normalizedId = this.normalizeProductKey(productId);
    if (!normalizedId) return;

    const replace = options && options.replace === true;
    const existingMeta = this.purchaseMeta.get(normalizedId) || null;
    const explicitPurchaseTimestamp =
      data.purchaseTimestamp ||
      data.purchasedAt ||
      data.purchaseDate ||
      data.paidAt ||
      data.createdAt ||
      data.completedAt ||
      null;
    const purchaseTs = this.normalizeTimestamp(explicitPurchaseTimestamp);
    const normalizedDownloadCount = Number.isFinite(Number(data.downloadCount))
      ? Math.max(0, Number(data.downloadCount))
      : replace
        ? 0
        : existingMeta?.downloadCount || 0;
    const normalizedLastDownloadAt = this.normalizeTimestamp(
      data.lastDownloadAt || data.lastDownloadTimestamp || null
    );
    const effectivePurchaseTimestamp =
      replace
        ? purchaseTs
        : purchaseTs ||
          (existingMeta && Number(existingMeta.purchaseTimestamp) > 0
            ? Number(existingMeta.purchaseTimestamp)
            : null);

    if (!effectivePurchaseTimestamp) {
      return;
    }

    this.purchaseMeta.set(normalizedId, {
      purchaseTimestamp: effectivePurchaseTimestamp,
      downloadCount: normalizedDownloadCount,
      lastDownloadAt:
        normalizedLastDownloadAt ||
        existingMeta?.lastDownloadAt ||
        data.lastDownloadAt ||
        data.lastDownloadTimestamp ||
        null,
    });

    if (
      effectivePurchaseTimestamp &&
      globalThis.UltimateDownloadManager &&
      typeof globalThis.UltimateDownloadManager.getDownloadData === 'function' &&
      typeof globalThis.UltimateDownloadManager.setDownloadData === 'function'
    ) {
      const manager = globalThis.UltimateDownloadManager;
      const existing = replace ? null : manager.getDownloadData(normalizedId);
      const mergedData = replace
        ? {
            purchaseTimestamp: effectivePurchaseTimestamp,
            downloadCount: normalizedDownloadCount,
            lastDownloadTimestamp: normalizedLastDownloadAt || null,
          }
        : {
            purchaseTimestamp:
              Number(existing?.purchaseTimestamp) > 0
                ? Number(existing.purchaseTimestamp)
                : effectivePurchaseTimestamp,
            downloadCount: Math.max(
              Number(existing?.downloadCount || 0) || 0,
              normalizedDownloadCount
            ),
            lastDownloadTimestamp:
              Number(existing?.lastDownloadTimestamp) > 0
                ? Number(existing.lastDownloadTimestamp)
                : normalizedLastDownloadAt || null,
          };

      manager.setDownloadData(normalizedId, mergedData);
      if (typeof manager.startTimerWithRetry === 'function') {
        manager.startTimerWithRetry(normalizedId, mergedData, 0);
      } else if (typeof manager.startPersistentTimer === 'function') {
        manager.startPersistentTimer(normalizedId, mergedData);
      }
    }
  }

  markAsOwnedLocally(productId) {
    if (!productId) return;

    const normalizedId = this.normalizeProductKey(productId);
    this.localOwnedProducts.add(normalizedId);
    this.ownedProducts.add(normalizedId);
    this.persistLocalPurchases();

    if (globalThis.UltimateDownloadManager) {
      const meta = globalThis.UltimateDownloadManager.getDownloadData(normalizedId);
      if (meta && meta.purchaseTimestamp) {
        this.storePurchaseMeta(normalizedId, meta);
      }
    }

    if (this.cache.size > 0) {
      this.render(Array.from(this.cache.values()));
    }

    if (typeof this.syncPublicModalOwned === 'function') {
      this.syncPublicModalOwned(normalizedId);
    }
  }

  setupAuthListener() {
    const handleAuthStateChanged = user => {
      this.loadLocalPurchases();
      if (user) {
        this.rebuildOwnedProducts();
        this.syncServerPurchases(user.uid);
      } else {
        this.clearPurchaseSyncListeners();
        this.serverOwnedProductsUser.clear();
        this.serverOwnedProductsOrders.clear();
        this.serverOwnedProductsProfile.clear();
        this.purchaseMeta.clear();
        this.rebuildOwnedProducts();
        if (this.cache.size > 0) {
          this.render(Array.from(this.cache.values()));
        }
      }
    };

    const tryAttachAuthListener = () => {
      if (typeof this.authUnsubscribe === 'function') {
        return true;
      }

      if (typeof globalThis.__WFX_AUTH_SUBSCRIBE__ === 'function') {
        this.authUnsubscribe = globalThis.__WFX_AUTH_SUBSCRIBE__(handleAuthStateChanged);
        return true;
      }

      if (globalThis.firebase && typeof globalThis.firebase.auth === 'function') {
        this.authUnsubscribe = globalThis.firebase.auth().onAuthStateChanged(handleAuthStateChanged);
        return true;
      }

      return false;
    };

    if (tryAttachAuthListener()) {
      return;
    }

    const retryAttach = () => {
      if (!tryAttachAuthListener()) {
        return;
      }
      if (typeof this.authReadyListenersCleanup === 'function') {
        this.authReadyListenersCleanup();
        this.authReadyListenersCleanup = null;
      }
    };

    const events = ['firebase:initialized', 'firebaseReady'];
    events.forEach(eventName => {
      window.addEventListener(eventName, retryAttach);
    });
    this.authReadyListenersCleanup = () => {
      events.forEach(eventName => {
        window.removeEventListener(eventName, retryAttach);
      });
    };
  }

  syncServerPurchases(uid) {
    if (!globalThis.firebase || !globalThis.firebase.firestore) return;
    if (!uid) return;
    if (this.activePurchaseSyncUid === uid && this.purchaseSyncUnsubscribers.length > 0) {
      return;
    }

    this.clearPurchaseSyncListeners();
    this.activePurchaseSyncUid = uid;

    const db = globalThis.firebase.firestore();

    // Fuente canónica: users/{uid}/purchases
    try {
      const unsubscribeModern = db
        .collection('users')
        .doc(uid)
        .collection('purchases')
        .onSnapshot(
          snap => {
            this.serverOwnedProductsUser.clear();
            const canonicalByProduct = this.collectCanonicalPurchaseRecords(snap);

            canonicalByProduct.forEach((_data, pid) => {
              this.serverOwnedProductsUser.add(pid);
            });

            canonicalByProduct.forEach((data, pid) => {
              this.storePurchaseMeta(pid, data, { replace: true });
            });

            this.rebuildOwnedProducts();

            if (this.cache.size > 0) {
              this.render(Array.from(this.cache.values()));
            }
          },
          error => {
            if (error.code === 'permission-denied') {
              this.log.warn('Permiso denegado a users/{uid}/purchases', this.CAT.AUTH);
            } else {
              this.log.error(
                'Error sincronizando users/{uid}/purchases',
                this.CAT.AUTH,
                error
              );
            }
          }
        );
      this.purchaseSyncUnsubscribers.push(unsubscribeModern);
    } catch (error) {
      this.log.error('Error configurando listener moderno de purchases', this.CAT.AUTH, error);
    }

    // Fallback adicional: users/{uid}.purchases y users/{uid}.purchaseMeta
    try {
      const unsubscribeProfile = db
        .collection('users')
        .doc(uid)
        .onSnapshot(
          snap => {
            this.serverOwnedProductsProfile.clear();
            const userData = snap.exists ? snap.data() || {} : {};
            const purchases = Array.isArray(userData.purchases) ? userData.purchases : [];
            const purchaseMeta =
              userData.purchaseMeta && typeof userData.purchaseMeta === 'object'
                ? userData.purchaseMeta
                : {};

            purchases.forEach(rawId => {
              const productId = this.normalizeProductKey(rawId);
              if (!productId || this.isResetSuppressed(productId)) return;
              this.serverOwnedProductsProfile.add(productId);
              const meta = purchaseMeta[productId];
              if (meta && typeof meta === 'object') {
                this.storePurchaseMeta(productId, meta);
              }
            });

            this.rebuildOwnedProducts();

            if (this.cache.size > 0) {
              this.render(Array.from(this.cache.values()));
            }
          },
          error => {
            if (error.code === 'permission-denied') {
              this.log.warn('Permiso denegado a users/{uid}', this.CAT.AUTH);
            } else {
              this.log.error('Error sincronizando users/{uid}', this.CAT.AUTH, error);
            }
          }
        );
      this.purchaseSyncUnsubscribers.push(unsubscribeProfile);
    } catch (error) {
      this.log.error('Error configurando listener fallback de users/{uid}', this.CAT.AUTH, error);
    }

    // Fallback persistente: orders del usuario.
    try {
      const unsubscribeOrders = db
        .collection('orders')
        .where('userId', '==', uid)
        .onSnapshot(
          snap => {
            this.serverOwnedProductsOrders.clear();
            const filteredDocs = snap.docs.filter(doc => {
              const data = doc.data() || {};
              return String(data.status || '').trim().toLowerCase() === 'completed';
            });
            const filteredSnapshot = {
              forEach(callback) {
                filteredDocs.forEach(callback);
              },
            };
            const canonicalByProduct = this.collectCanonicalPurchaseRecords(filteredSnapshot);

            canonicalByProduct.forEach((_data, pid) => {
              this.serverOwnedProductsOrders.add(pid);
            });

            canonicalByProduct.forEach((data, pid) => {
              this.storePurchaseMeta(pid, data);
            });

            this.rebuildOwnedProducts();

            if (this.cache.size > 0) {
              this.render(Array.from(this.cache.values()));
            }
          },
          error => {
            if (error.code === 'permission-denied') {
              this.log.warn('Permiso denegado a orders del usuario', this.CAT.AUTH);
            } else {
              this.log.error('Error sincronizando orders del usuario', this.CAT.AUTH, error);
            }
          }
        );
      this.purchaseSyncUnsubscribers.push(unsubscribeOrders);
    } catch (error) {
      this.log.error('Error configurando listener fallback de orders', this.CAT.AUTH, error);
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
      this.log.debug('Deshabilitando AnnouncementManager antiguo', this.CAT.INIT);
      // No lo borramos del todo por si acaso, pero evitamos que duplique
      globalThis.announcementManager.renderPublicAnnouncements = () => {};
    }
  }

  setupFirestoreSync() {
    if (typeof this.unsubscribe === 'function') {
      try {
        this.unsubscribe();
      } catch (_e) {}
    }
    this.unsubscribe = null;

    const cachedAnnouncements = this.loadPublicCatalogCache();
    if (cachedAnnouncements.length > 0) {
      this.cacheAnnouncements(cachedAnnouncements);
      this.render(cachedAnnouncements);
      this.notifyListeners('update', cachedAnnouncements);
      this.log.debug('Catálogo público restaurado desde cache de sesión', this.CAT.FIREBASE);
      return;
    }

    this.fetchPublicCatalogSnapshot().catch(error => {
      this.log.error('Error cargando snapshot del catálogo público', this.CAT.FIREBASE, error);
    });
  }

  resolvePublicCatalogUrl() {
    const projectId =
      (window.firebaseConfig && String(window.firebaseConfig.projectId || '').trim()) ||
      (window.RUNTIME_CONFIG?.firebase &&
        String(window.RUNTIME_CONFIG.firebase.projectId || '').trim()) ||
      '';
    const baseUrl =
      window.RuntimeConfigUtils &&
      typeof window.RuntimeConfigUtils.getCloudFunctionsBaseUrl === 'function'
        ? window.RuntimeConfigUtils.getCloudFunctionsBaseUrl(projectId, 'us-central1')
        : projectId
          ? `https://us-central1-${projectId}.cloudfunctions.net`
          : '';
    return baseUrl ? `${baseUrl}/publicCatalogSnapshot` : '/config/public-catalog.json';
  }

  loadPublicCatalogCache() {
    try {
      const raw = sessionStorage.getItem(this.PUBLIC_CATALOG_CACHE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      const ts = Number(parsed?.ts || 0);
      const announcements = Array.isArray(parsed?.announcements) ? parsed.announcements : [];
      if (!ts || Date.now() - ts > this.PUBLIC_CATALOG_CACHE_TTL_MS) {
        sessionStorage.removeItem(this.PUBLIC_CATALOG_CACHE_KEY);
        return [];
      }
      return announcements;
    } catch (_error) {
      return [];
    }
  }

  savePublicCatalogCache(announcements) {
    try {
      sessionStorage.setItem(
        this.PUBLIC_CATALOG_CACHE_KEY,
        JSON.stringify({
          ts: Date.now(),
          announcements: Array.isArray(announcements) ? announcements : [],
        })
      );
    } catch (_error) {}
  }

  cacheAnnouncements(announcements) {
    this.cache.clear();
    announcements.forEach(item => {
      if (!item || !item.id) return;
      this.cache.set(item.id, item);
    });
    this.lastAnnouncements = Array.isArray(announcements) ? announcements : [];
  }

  async fetchPublicCatalogSnapshot() {
    const response = await fetch(this.resolvePublicCatalogUrl(), {
      method: 'GET',
      credentials: 'omit',
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`Snapshot HTTP ${response.status}`);
    }

    const payload = await response.json();
    const announcements = Array.isArray(payload?.announcements) ? payload.announcements : [];
    const normalized = announcements
      .filter(item => item && typeof item === 'object')
      .slice(0, this.PUBLIC_CATALOG_LIMIT)
      .map(item => ({ ...item }));

    this.cacheAnnouncements(normalized);
    this.savePublicCatalogCache(normalized);
    this.log.debug(
      `${normalized.length} anuncio(s) cargado(s) desde catálogo público cacheado`,
      this.CAT.FIREBASE
    );
    this.render(normalized);
    this.notifyListeners('update', normalized);
  }

  async fetchPublicAnnouncementsFallback() {
    throw new Error(
      'Fallback directo a Firestore deshabilitado: el catálogo público solo se sirve por snapshot backend.'
    );
  }

  setupEventListeners() {
    subscribePurchaseCompleted(({ productId }) => {
      this.markAsOwnedLocally(productId);
    });

    document.addEventListener('click', e => {
      const card = e.target.closest('.announcement-card');

      if (!globalThis.EventDelegation) {
        const buyBtn = e.target.closest('[data-action="buyNowAnnouncement"]');
        const cartBtn = e.target.closest('[data-action="addToCartAnnouncement"]');
        const downloadBtn = e.target.closest('[data-action="secureDownload"]');

        if (downloadBtn) {
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
        this.log.error('Error cargando modal público de anuncios', this.CAT.ERR, err);
      });
  }

  render(announcements) {
    const container = document.getElementById('publicAnnouncementsContainer');
    if (!container) {
      this.log.error('Container #publicAnnouncementsContainer not found', this.CAT.INIT);
      return;
    }

    this.lastAnnouncements = Array.isArray(announcements) ? announcements : [];

    const skeleton = document.getElementById('skeletonAnnouncements');

    if (announcements.length === 0) {
      if (skeleton) skeleton.classList.add('hidden');
      container.innerHTML =
        '<div class="announcement-empty"><p>No hay anuncios disponibles</p></div>';
      return;
    }

    // Solo renderizar anuncios, sin la tarjeta de advertencia
    const html = announcements.map(ann => this.createAnnouncementCard(ann)).join('');

    // Sanitización con sanitizePremiumHTML priorizada
    if (globalThis.sanitizePremiumHTML) {
      container.innerHTML = globalThis.sanitizePremiumHTML(html, 'announcement-grid-render');
    } else if (globalThis.DOMPurify) {
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
          'id',
          'data-id',
          'data-product-id',
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
          'disabled',
        ],
        ADD_TAGS: ['iframe', 'svg', 'use'],
        ADD_ATTR: [
          'allow',
          'allowfullscreen',
          'frameborder',
          'data-translate',
          'data-action',
          'data-product-id',
          'id',
        ],
      });
      container.innerHTML = sanitized;
    } else {
      container.innerHTML =
        '<div class="announcement-empty"><p>No se pudo renderizar el catálogo de forma segura.</p></div>';
      this.log.error(
        'DOMPurify no disponible; catálogo bloqueado para evitar HTML sin sanitizar',
        this.CAT.INIT
      );
      if (skeleton) {
        skeleton.classList.add('hidden');
        skeleton.setAttribute('aria-busy', 'false');
      }
      return;
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
          const data = globalThis.UltimateDownloadManager.getDownloadData(ownedProductId);
          if (data && data.purchaseTimestamp) {
            // Iniciar cronómetro persistente
            setTimeout(() => {
              globalThis.UltimateDownloadManager.startPersistentTimer(ownedProductId, data);
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
    const safeId = this.escapeAttr(id);
    const safePrimaryProductId = this.escapeAttr(primaryProductId);
    const safeName = this.escapeHtml(name);
    const price = Number.parseFloat(ann.price || 0).toFixed(2);
    const baseOrigin =
      (typeof window !== 'undefined' && window.location && window.location.origin) ||
      'https://wifihackx.com';
    const shareUrl = this.sanitizeUrl(
      `${baseOrigin}/?utm_source=share&utm_medium=announcement&utm_campaign=card#ann-${encodeURIComponent(id)}`,
      `${window.location.origin}/`
    );
    const imageUrl = this.sanitizeUrl(
      ann.imageUrl || (ann.mainImage && ann.mainImage.url) || '/Tecnologia.webp',
      `${window.location.origin}/Tecnologia.webp`
    );
    const safeShareUrl = this.escapeAttr(shareUrl);
    const safeImageUrl = this.escapeAttr(imageUrl);
    const isNew =
      ann.isNew ||
      (ann.createdAt && Date.now() - ann.createdAt.seconds * 1000 < 7 * 24 * 60 * 60 * 1000);

    // --- LÓGICA SMART BUTTON ---
    const ownedProductId = this.resolveOwnedProductId(ann);
    const isOwned = Boolean(ownedProductId);
    const downloadProductId = ownedProductId || primaryProductId;
    const metaText = isOwned ? this.getDownloadMetaTextForAnnouncement(ann) : null;
    let buttonsHTML = '';

    if (isOwned) {
      const isExpired = metaText ? metaText.expired : false;
      const downloadLabel = isExpired ? 'Adquirido' : 'DESCARGAR [SECURE]';
      buttonsHTML = this.buildSecureDownloadMarkup({
        buttonClass: 'announcement-btn btn-download-secure w-full',
        buttonId: `btn-download-${downloadProductId}`,
        announcementId: id,
        productId: downloadProductId,
        timerId: `timer-${downloadProductId}`,
        downloadsId: `downloads-${downloadProductId}`,
        timerText: metaText ? metaText.timerText : this.META_TEXT.preparing,
        downloadsText: metaText ? metaText.downloadsText : this.META_TEXT.downloadsUnknown,
        label: downloadLabel,
        isExpired,
        title: 'Transferencia Segura',
      });
    } else {
      // Botones COMPRAR / CARRITO (Standard)
      buttonsHTML = `
                <button class="announcement-btn announcement-btn-buy premium-btn-neon" 
                        data-action="buyNowAnnouncement" 
                        data-id="${safeId}"
                        data-product-id="${safePrimaryProductId}"
                        title="Comprar Ahora">
                    <div class="btn-glow-layer"></div>
                    <i data-lucide="zap"></i>
                    <span class="btn-text" data-translate="buy_now">Comprar Ahora</span>
                </button>
                <button class="announcement-btn announcement-btn-cart premium-btn-glass" 
                        data-action="addToCartAnnouncement" 
                        data-id="${safeId}"
                        data-product-id="${safePrimaryProductId}"
                        title="Añadir al carrito">
                    <i data-lucide="shopping-cart"></i>
                    <span class="btn-text" data-translate="add_to_cart">Añadir al Carrito</span>
                </button>
            `;
    }
    // ---------------------------

    return `
            <div class="announcement-card premium-3d-card" data-announcement-id="${safeId}" role="gridcell">
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
                    <img src="${safeImageUrl}" 
                         alt="${safeName}" 
                         class="announcement-card-image" 
                         loading="lazy"
                         decoding="async">
                </div>

                <div class="announcement-card-content" role="group">
                    <div class="announcement-card-header">
                        <div class="name-container">
                            <h3 class="announcement-card-name glitch-hover" data-text="${safeName}">${safeName}</h3>
                            <div class="name-underline"></div>
                        </div>
                        <div class="price-container">
                            ${
                              isOwned
                                ? '<span class="owned-badge">ADQUIRIDO</span>'
                                : `<span class="announcement-card-price neon-pulse-text">€${price}</span>`
                            }
                        </div>
                        <button class="announcement-share-btn share-icon-btn" data-action="share" data-share-title="${safeName}" data-share-text="Producto WifiHackX" data-share-url="${safeShareUrl}" aria-label="Compartir anuncio">
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
          imageUrl: ann.imageUrl || (ann.mainImage && ann.mainImage.url) || '/Tecnologia.webp',
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

  // Hepler methods from original implementation
  resolveOwnedProductId(ann) {
    const keys = this.getAnnouncementProductKeys(ann);
    return keys.find(key => this.ownedProducts.has(key)) || null;
  }

  getDownloadMetaTextForAnnouncement(ann) {
    const pid = this.resolveOwnedProductId(ann);
    const meta = this.purchaseMeta.get(pid);
    const manager = globalThis.UltimateDownloadManager;
    const liveMeta =
      !meta && manager && pid && typeof manager.getDownloadData === 'function'
        ? manager.getDownloadData(pid)
        : null;
    const resolvedMeta = meta || liveMeta;
    if (!resolvedMeta)
      return {
        timerText: this.META_TEXT.preparing,
        downloadsText: this.META_TEXT.downloadsUnknown,
      };

    if (!resolvedMeta || !resolvedMeta.purchaseTimestamp) {
      return {
        timerText: this.META_TEXT.preparing,
        downloadsText: this.META_TEXT.downloadsUnknown,
      };
    }

    if (manager) {
      const eligibility = manager.checkDownloadEligibility(pid);
      const remainingDownloads = Math.max(
        0,
        (manager.MAX_DOWNLOADS || 3) - (resolvedMeta.downloadCount || 0)
      );

      if (!eligibility.canDownload && eligibility.reason !== 'no_purchase') {
        return {
          timerText: manager.META_TEXT.final,
          downloadsText: manager.META_TEXT.downloadsNone,
          expired: true,
        };
      }

      const remainingMs =
        resolvedMeta.purchaseTimestamp +
        (manager.DOWNLOAD_WINDOW_HOURS || 48) * 60 * 60 * 1000 -
        Date.now();

      if (remainingMs > 0) {
        const formattedTime =
          globalThis.AnnouncementUtils &&
          typeof globalThis.AnnouncementUtils.formatRemainingTime === 'function'
            ? globalThis.AnnouncementUtils.formatRemainingTime(remainingMs)
            : this.META_TEXT.preparing;
        return {
          timerText: `Tiempo restante: ${formattedTime}`,
          downloadsText: `${manager.META_TEXT.downloadsPrefix}${remainingDownloads}`,
          expired: false,
        };
      }
    }

    return {
      timerText: this.META_TEXT.preparing,
      downloadsText: this.META_TEXT.downloadsUnknown,
      expired: false,
    };
  }

  isResetSuppressed(_pid) {
    return false;
  }

  normalizeTimestamp(ts) {
    if (!ts) return null;
    if (typeof ts === 'number' && Number.isFinite(ts)) {
      return ts > 1e12 ? ts : ts * 1000;
    }
    if (ts instanceof Date) {
      const value = ts.getTime();
      return Number.isFinite(value) ? value : null;
    }
    if (typeof ts === 'string') {
      const parsed = Date.parse(ts);
      return Number.isFinite(parsed) ? parsed : null;
    }
    if (typeof ts?.toMillis === 'function') {
      const value = ts.toMillis();
      return Number.isFinite(value) ? value : null;
    }
    if (typeof ts?.seconds === 'number') {
      const millis = ts.seconds * 1000 + Math.floor((ts.nanoseconds || 0) / 1e6);
      return Number.isFinite(millis) ? millis : null;
    }
    return null;
  }
  ensurePublicModalLoaded() {
    return Promise.resolve();
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

if (typeof window !== 'undefined') {
  window.AnnouncementSystem = AnnouncementSystem;
}
