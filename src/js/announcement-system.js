/**
 * announcement-system.js
 * Gestión de anuncios en el frontend público
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
    this.serverOwnedProducts = new Set(); // Compras desde Firestore purchases/uid
    this.serverOwnedProductsSub = new Set(); // Compras desde purchases subcolección (Legacy/Compat)
    this.purchaseMeta = new Map(); // productId -> {purchaseTimestamp, downloadCount, lastDownloadAt}
    this.resetChannel = null;

    this.META_TEXT = {
      preparing: 'Preparando...',
      expired: 'Enlace expirado',
      downloadsRemaining: 'descargas pendientes',
      downloadsUnknown: 'N/A',
    };
  }

  init() {
    this.log.info('Inicializando AnnouncementSystem (Public)...', this.CAT.INIT);

    // Deshabilitar sistemas antiguos si existen
    this.disableLegacySystems();

    // Cargar productos locales desde localStorage ( feedback instantáneo tras compra )
    this.loadLocalPurchases();

    // Escuchar cambios de autenticación para cargar productos del servidor
    this.setupAuthListener();

    // Configurar listener en tiempo real de Firestore
    this.setupFirestoreSync();

    // Configurar listeners de eventos generales
    this.setupUserPurchasesListener();
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
        const id = dataset && (dataset.productid || dataset.id);
        if (globalThis.UltimateDownloadManager) {
          globalThis.UltimateDownloadManager.initiateDownload(id);
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
      const storagePrefix = manager.STORAGE_KEY_PREFIX || 'wfx_download_';
      const lastDownloadPrefix = manager.LAST_DOWNLOAD_KEY || 'wfx_last_download_';

      // Compatibilidad: limpiar local cache sin depender de métodos opcionales.
      try {
        localStorage.removeItem(`${storagePrefix}${productId}`);
        localStorage.removeItem(`${lastDownloadPrefix}${productId}`);
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
      const localRaw = localStorage.getItem('wfx_local_purchases');
      if (localRaw) {
        const ids = JSON.parse(localRaw);
        if (Array.isArray(ids)) {
          ids.forEach(id => this.localOwnedProducts.add(id));
        }
      }
    } catch (e) {
      this.log.error('Error cargando compras locales', this.CAT.INIT, e);
    }
  }

  setupAuthListener() {
    if (!globalThis.firebase || !globalThis.firebase.auth) return;

    globalThis.firebase.auth().onAuthStateChanged(user => {
      if (user) {
        this.syncServerPurchases(user.uid);
      } else {
        this.serverOwnedProducts.clear();
        this.serverOwnedProductsSub.clear();
        this.purchaseMeta.clear();
        this.ownedProducts.clear();
        this.localOwnedProducts.forEach(id => this.ownedProducts.add(id));
        if (this.cache.size > 0) {
          this.render(Array.from(this.cache.values()));
        }
      }
    });
  }

  setupUserPurchasesListener() {
    // Listener para actualizaciones de compras en tiempo real desde otros componentes
    window.addEventListener('wfx:purchaseCompleted', evt => {
      const productId = evt.detail.productId;
      if (productId) {
        this.localOwnedProducts.add(productId);
        this.ownedProducts.add(productId);
        this.render(Array.from(this.cache.values()));
      }
    });
  }

  syncServerPurchases(uid) {
    if (!globalThis.firebase || !globalThis.firebase.firestore) return;

    const db = globalThis.firebase.firestore();

    // 1. Fuente Principal: purchases/[uid]
    db.collection('purchases')
      .doc(uid)
      .onSnapshot(
        doc => {
          if (doc.exists) {
            const data = doc.data();
            if (!data) return; // Seguridad adicional si data es undefined

            const productIds = data.productIds || [];
            this.serverOwnedProducts.clear();
            productIds.forEach(id => {
              this.serverOwnedProducts.add(id);
            });

            // Mezclar fuentes
            this.ownedProducts.clear();
            this.localOwnedProducts.forEach(id => this.ownedProducts.add(id));
            this.serverOwnedProducts.forEach(id => this.ownedProducts.add(id));
            this.serverOwnedProductsSub.forEach(id => this.ownedProducts.add(id));

            if (this.cache.size > 0) {
              this.render(Array.from(this.cache.values()));
            }
          }
        },
        err => {
          this.log.error('Error sincronizando purchases legacy', this.CAT.AUTH, err);
        }
      );

    // 2. Fuente Secundaria (Legacy/UI Sync): purchases/[uid]/userPurchases/
    // Algunos sistemas guardan metadatos aquí (timers, etc)
    try {
      db.collection('purchases')
        .doc(uid)
        .collection('userPurchases')
        .onSnapshot(
          snap => {
            this.serverOwnedProductsSub.clear();
            snap.forEach(doc => {
              const data = doc.data();
              if (!data) return;

              const pid = data.productId || doc.id;
              if (pid && !this.isResetSuppressed(pid)) {
                const rawTimestamp =
                  data.purchaseTimestamp || data.purchasedAt || data.createdAt || null;
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
            this.serverOwnedProductsSub.forEach(id => this.ownedProducts.add(id));

            if (this.cache.size > 0) {
              this.render(Array.from(this.cache.values()));
            }
          },
          error => {
            if (error.code === 'permission-denied') {
              this.log.warn('Permiso denegado a subcolección purchases', this.CAT.AUTH);
            } else {
              this.log.error('Error sincronizando purchases (subcolección)', this.CAT.AUTH, error);
            }
          }
        );
    } catch (error) {
      this.log.error('Error configurando listener de purchases', this.CAT.AUTH, error);
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
            this.log.error(`Error con orderBy("${orderField}")`, this.CAT.FIREBASE, error);

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
                  this.log.error('Error crítico en Firestore', this.CAT.FIREBASE, err);
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
      // Fallback: insertar directamente (solo en desarrollo local)
      container.innerHTML = html;
      this.log.warn('DOMPurify no disponible, insertando HTML sin sanitizar', this.CAT.INIT);
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
    const price = Number.parseFloat(ann.price || 0).toFixed(2);
    const baseOrigin =
      (typeof window !== 'undefined' && window.location && window.location.origin) ||
      'https://wifihackx.com';
    const shareUrl = `${baseOrigin}/?utm_source=share&utm_medium=announcement&utm_campaign=card#ann-${id}`;
    const imageUrl = ann.imageUrl || (ann.mainImage && ann.mainImage.url) || '/Tecnologia.webp';
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
      // Botón DESCARGAR (Secure) con cronómetro y contador de descargas
      const isExpired = metaText ? metaText.expired : false;
      const downloadLabel = isExpired ? 'Adquirido' : 'DESCARGAR [SECURE]';
      const finalClass = isExpired ? 'is-final' : '';
      const acquiredClass = isExpired ? 'is-acquired' : '';
      buttonsHTML = `
                <button class="announcement-btn btn-download-secure w-full ${acquiredClass}" 
                        id="btn-download-${downloadProductId}"
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
                        <span id="timer-${downloadProductId}" class="countdown-timer ${finalClass}" data-timer-for="${downloadProductId}">${metaText ? metaText.timerText : this.META_TEXT.preparing}</span>
                    </div>
                    <div class="download-counter-container">
                        <i data-lucide="download" class="icon-14"></i>
                        <span id="downloads-${downloadProductId}" class="downloads-counter ${finalClass}" data-downloads-for="${downloadProductId}">${metaText ? metaText.downloadsText : this.META_TEXT.downloadsUnknown}</span>
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
            <div class="announcement-card premium-3d-card" data-announcement-id="${id}" role="gridcell">
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

                <div class="announcement-card-content" role="group">
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
    const id = ann.id || ann.productId || '';
    if (this.ownedProducts.has(id)) return id;
    if (ann.productId && this.ownedProducts.has(ann.productId)) return ann.productId;
    if (ann.stripeId && this.ownedProducts.has(ann.stripeId)) return ann.stripeId;
    return null;
  }

  getDownloadMetaTextForAnnouncement(ann) {
    const pid = this.resolveOwnedProductId(ann);
    const meta = this.purchaseMeta.get(pid);
    if (!meta)
      return {
        timerText: this.META_TEXT.preparing,
        downloadsText: this.META_TEXT.downloadsUnknown,
      };

    // Simpified logic for preview/system
    return {
      timerText: 'Activo',
      downloadsText: `${meta.downloadCount || 0} descargas`,
      expired: false,
    };
  }

  isResetSuppressed(_pid) {
    return false;
  }
  normalizeTimestamp(ts) {
    return ts;
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
