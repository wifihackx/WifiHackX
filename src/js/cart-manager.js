/**
 * CartManager - Gestión del carrito de compras (V4.1 - Unified & Scoped - Sync from v14)
 * Maneja la lógica del carrito, persistencia, prevención de duplicados y unificación de sistemas.
 */
'use strict';

const debugLog = (...args) => {
  if (window.__WFX_DEBUG__ === true) {
    console.info(...args);
  }
};

function setupCartManager() {
  // Fallback del logger para scripts externos
  const log = window.Logger || {
    info: (m, c) => debugLog(`[${c}] ${m}`),
    warn: (m, c) => console.warn(`[${c}] ${m}`),
    error: (m, c, d) => console.error(`[${c}] ${m}`, d),
    debug: (m, c) => debugLog(`[DEBUG][${c}] ${m}`),
    trace: (m, c) => debugLog(`[TRACE][${c}] ${m}`),
  };
  const CAT = window.LOG_CATEGORIES || {
    CART: 'CART',
    INIT: 'INIT',
    ERR: 'ERR',
  };

  log.debug('Inicializando Sistema Unificado de Carrito (V4.1)', CAT.INIT);

  class UnifiedCartManager {
    constructor() {
      this.items = [];
      this.cartKey = 'wifiHackX_cart';
      this.legacyKeys = ['wifiHackXCart', 'cart', 'UserCart'];
      this.currentUserId = null; // Track current user ID
      this.init();
    }

    t(key, fallback) {
      try {
        const lang =
          (window.AppState &&
            typeof window.AppState.getState === 'function' &&
            window.AppState.getState('i18n.currentLanguage')) ||
          localStorage.getItem('selectedLanguage') ||
          'es';
        if (typeof window.translate === 'function') {
          const translated = window.translate(key, lang);
          if (translated && translated !== key) {
            return translated;
          }
        }
      } catch (_e) {}
      return fallback;
    }

    getEncryptionKey() {
      return 'wifiHackX-secure-key-2025';
    }

    encrypt(data) {
      if (typeof CryptoJS === 'undefined') return JSON.stringify(data);
      try {
        return CryptoJS.AES.encrypt(JSON.stringify(data), this.getEncryptionKey()).toString();
      } catch (_e) {
        return JSON.stringify(data);
      }
    }

    decrypt(encryptedText) {
      if (!encryptedText) return [];
      if (encryptedText.trim().startsWith('[') || encryptedText.trim().startsWith('{')) {
        try {
          return JSON.parse(encryptedText);
        } catch (_e) {}
      }
      if (typeof CryptoJS === 'undefined') return [];
      try {
        const bytes = CryptoJS.AES.decrypt(encryptedText, this.getEncryptionKey());
        const decryptedString = bytes.toString(CryptoJS.enc.Utf8);
        if (!decryptedString) return [];
        return JSON.parse(decryptedString);
      } catch (_error) {
        try {
          return JSON.parse(encryptedText);
        } catch (_e) {
          return [];
        }
      }
    }

    init() {
      this.updateCartKey(); // Set initial cart key based on current user
      this.load();
      this.updateCartCount();
      // Asegurar estado correcto del badge tras el render inicial
      setTimeout(() => this.updateCartCount(), 0);
      setTimeout(() => this.updateCartCount(), 500);
      // Re-sincronizar cuando se inyectan componentes (header/footer)
      if (document && document.addEventListener) {
        document.addEventListener('components:ready', () => {
          this.updateCartCount();
        });
      }
      if (window.componentsReady) {
        this.updateCartCount();
      }
      this.bindEvents();

      // Payment keys can arrive after initial render (nonce/public settings lazy load).
      window.addEventListener('nonce-ready', () => {
        this.syncCheckoutButton();
      });
      window.addEventListener('public-settings:loaded', () => {
        this.syncCheckoutButton();
      });
      window.addEventListener('stripe-ready', () => {
        this.syncCheckoutButton();
      });

      // Listen for auth state changes to switch cart
      if (window.firebase && window.firebase.auth) {
        window.firebase.auth().onAuthStateChanged(user => {
          const newUserId = user ? user.uid : null;
          if (newUserId !== this.currentUserId) {
            debugLog(
              `[CartManager] User changed: ${this.currentUserId} -> ${newUserId}, switching cart`
            );
            this.currentUserId = newUserId;
            this.updateCartKey();
            this.load();
            this.updateCartCount();
            this.renderCartModal();
          }
        });
      }

      log.info('CartManager: Sistema de persistencia listo', CAT.INIT);
    }

    /**
     * Update cart key based on current user
     */
    updateCartKey() {
      this.currentUserId = this.getCurrentUserId();
      if (this.currentUserId) {
        this.cartKey = `wifiHackX_cart_${this.currentUserId}`;
        debugLog(`[CartManager] Using user-specific cart key: ${this.cartKey}`);
      } else {
        this.cartKey = 'wifiHackX_cart';
        debugLog(`[CartManager] Using anonymous cart key: ${this.cartKey}`);
      }
    }

    /**
     * Get current user ID
     */
    getCurrentUserId() {
      if (window.firebase && window.firebase.auth) {
        const user = window.firebase.auth().currentUser;
        return user ? user.uid : null;
      }
      return null;
    }

    load() {
      try {
        let stored = localStorage.getItem(this.cartKey);

        // Only load from legacy keys for anonymous users
        // For authenticated users, use the user-specific key only
        if (!stored && !this.currentUserId) {
          for (const key of this.legacyKeys) {
            const legacyData = localStorage.getItem(key);
            if (legacyData) {
              log.debug(`Migrando datos de: ${key}`, CAT.INIT);
              stored = legacyData;
              break;
            }
          }
        }

        this.items = this.decrypt(stored);
        if (this.items && !Array.isArray(this.items) && this.items.items) {
          this.items = this.items.items;
        }
        if (!Array.isArray(this.items)) this.items = [];

        this.items.forEach(item => {
          if (!item.imageUrl || item.imageUrl.length < 10) {
            if (window.announcementManager && window.announcementManager.currentAnnouncements) {
              const ann = window.announcementManager.currentAnnouncements.find(
                a => String(a.id) === String(item.id)
              );
              if (ann) item.imageUrl = ann.imageUrl || ann.image || '';
            }
          }
        });
      } catch (e) {
        log.error('Error cargando carrito', CAT.CART, e);
        this.items = [];
      }
    }

    save() {
      try {
        const encrypted = this.encrypt(this.items);
        localStorage.setItem(this.cartKey, encrypted);

        // Solo usar fallback legacy para usuarios anónimos (no guardar en clave compartida 'cart' para usuarios autenticados)
        if (!this.currentUserId) {
          localStorage.setItem('cart', JSON.stringify(this.items)); // Fallback legacy para anónimos
        }

        this.updateCartCount();
        this.renderCartModal();
      } catch (e) {
        log.error('Error guardando carrito', CAT.CART, e);
      }
    }

    bindEvents() {
      document.addEventListener(
        'click',
        e => {
          const target = e.target;
          const removeBtn = target.closest('.remove-item-btn') || target.closest('.remove-btn');
          if (removeBtn) {
            const id = removeBtn.dataset.id || removeBtn.dataset.params;
            if (id) this.removeItem(id);
          }

          const clearBtn =
            target.closest('#clearCartBtn') || target.closest('[data-action="clearCart"]');
          if (clearBtn) {
            e.preventDefault();
            this.clear();
          }

          // Checkout se maneja en checkout-interceptor.js y common-handlers.js

          if (target.closest('.close-btn, [data-action="closeCart"], .cart-close-btn')) {
            if (typeof window.closeCart === 'function') window.closeCart();
            else {
              const modal = document.getElementById('cartModal');
              if (modal) {
                if (typeof modal.close === 'function' && modal.open) {
                  modal.close();
                }
                modal.classList.add('hidden');
                modal.classList.remove('active');
                modal.setAttribute('aria-hidden', 'true');
              }
            }
          }
        },
        true
      );
    }

    addItem(product) {
      if (!product || !product.id) return;

      // Enriquecer datos si faltan
      if (!product.stripeId || !product.imageUrl) {
        const manager = window.announcementManager;
        const source = (manager && manager.currentAnnouncements) || window.currentAnnouncements;
        if (source) {
          const real = source.find(a => String(a.id) === String(product.id));
          if (real) {
            product.stripeId = product.stripeId || real.stripeId;
            product.imageUrl =
              real.imageUrl || real.image || product.imageUrl || '/Tecnologia.webp';
            product.price = parseFloat(real.price) || product.price;
            product.title = real.title || real.name || product.title;
          }
        }
      }

      if (this.items.find(item => item.id === product.id)) {
        if (window.NotificationSystem)
          window.NotificationSystem.warning('Este artículo ya está en tu carrito');
        this.showCartModal();
        return;
      }

      this.items.push({
        ...product,
        quantity: 1,
        addedAt: new Date().toISOString(),
      });
      this.save();
      if (window.NotificationSystem)
        window.NotificationSystem.success('Artículo añadido al carrito');

      const cartBtn = document.querySelector('.cart-btn');
      if (cartBtn) {
        cartBtn.classList.add('bump');
        setTimeout(() => cartBtn.classList.remove('bump'), 300);
      }
    }

    removeItem(id) {
      this.items = this.items.filter(item => String(item.id) !== String(id));
      this.save();
    }

    clear() {
      this.items = [];

      // Remove cart from current user's localStorage key
      localStorage.removeItem(this.cartKey);

      // Also clear legacy cart keys
      this.legacyKeys.forEach(key => {
        const legacyCartKey = this.currentUserId ? `${key}_${this.currentUserId}` : key;
        localStorage.removeItem(legacyCartKey);
      });

      // Clear the shared 'cart' key (anonymous)
      localStorage.removeItem('cart');

      debugLog(`[CartManager] Cleared cart for user ${this.currentUserId || 'anonymous'}`);

      this.updateCartCount();

      const paypalContainer = document.getElementById('paypal-button-container');
      if (paypalContainer) {
        paypalContainer.innerHTML = '';
        paypalContainer.removeAttribute('data-total');
      }
    }

    checkout(btnElement) {
      // Verificar autenticación antes de procesar
      const user = window.firebase && window.firebase.auth ? firebase.auth().currentUser : null;

      if (!user) {
        if (window.NotificationSystem) {
          window.NotificationSystem.warning('⚠️ Debes iniciar sesión para realizar una compra.');
        }
        if (window.showLoginView) {
          setTimeout(() => window.showLoginView(), 1000);
        }
        return false;
      }

      // Pre-unlock audio para que el modal de compra tenga sonido en todos los navegadores
      if (window.PurchaseSuccessAudio && typeof window.PurchaseSuccessAudio.prime === 'function') {
        window.PurchaseSuccessAudio.prime();
      }

      const foundItem = this.items.find(i => i.stripeId);
      const productId = foundItem ? foundItem.id : null;
      const stripeId =
        (btnElement && btnElement.dataset.priceId) || (foundItem ? foundItem.stripeId : null);

      if (stripeId && window.iniciarCompra) {
        const dummy = document.createElement('button');
        dummy.setAttribute('data-price-id', stripeId);
        if (productId) {
          dummy.setAttribute('data-product-id', productId);
        }
        window.iniciarCompra(dummy);
        return true;
      }

      if (stripeId && !window.iniciarCompra) {
        if (window.NotificationSystem) {
          window.NotificationSystem.error(
            'El sistema de pago no está listo. Intenta de nuevo en unos segundos.'
          );
        }
        return false;
      }

      return false;
    }

    updateCartCount() {
      const badges = document.querySelectorAll('#cartCount, .cart-count, .cart-icon-badge');
      badges.forEach(b => {
        // Solicitud de usuario: Que salga vacío si es 0, no mostrar un '0'
        const count = this.items.length;
        b.textContent = count > 0 ? count : '';
        b.dataset.empty = count === 0 ? 'true' : 'false';
        b.classList.toggle('hidden', count === 0);
      });
      this.syncCheckoutButton();
    }

    syncCheckoutButton() {
      const checkoutBtn =
        document.getElementById('checkoutBtn') ||
        document.querySelector('[data-action="checkout"]');
      if (checkoutBtn) {
        const shouldHide = this.items.length === 0;
        const stripeConfigured =
          window.RuntimeConfigUtils &&
          typeof window.RuntimeConfigUtils.isStripeConfigured === 'function'
            ? window.RuntimeConfigUtils.isStripeConfigured()
            : typeof window.STRIPE_PUBLIC_KEY === 'string' && !!window.STRIPE_PUBLIC_KEY.trim();
        const shouldDisable = shouldHide || !stripeConfigured;

        checkoutBtn.classList.toggle('hidden', shouldHide);
        checkoutBtn.classList.toggle('disabled', shouldDisable);
        checkoutBtn.disabled = shouldDisable;
        checkoutBtn.setAttribute('aria-disabled', shouldDisable ? 'true' : 'false');

        if (!shouldHide && !stripeConfigured) {
          checkoutBtn.setAttribute('title', 'Stripe no configurado en este entorno. Usa PayPal.');
        } else {
          checkoutBtn.removeAttribute('title');
        }

        const itemWithStripe = this.items.find(i => i.stripeId);
        if (stripeConfigured && itemWithStripe && itemWithStripe.stripeId) {
          checkoutBtn.setAttribute('data-price-id', itemWithStripe.stripeId);
        } else {
          checkoutBtn.removeAttribute('data-price-id');
        }
        this.forceCartIconUpdate(checkoutBtn);
      }
    }

    showCartModal() {
      if (window.showCart) window.showCart();
      else {
        const modal = document.getElementById('cartModal');
        if (modal) {
          if (typeof modal.showModal === 'function' && !modal.open) {
            modal.showModal();
          }
          modal.classList.remove('hidden');
          modal.classList.add('active');
          modal.setAttribute('aria-hidden', 'false');
          this.renderCartModal();
        }
      }
    }

    renderCartModal() {
      const container =
        document.getElementById('cart-container') || document.getElementById('cartItems');
      if (!container) return;

      if (this.items.length === 0) {
        container.innerHTML = `
                    <div class="cart-empty">
                        <i data-lucide="shopping-cart" class="cart-empty-icon"></i>
                        <p>${this.t('cart_empty', 'Tu carrito está vacío')}</p>
                    </div>
                `;
        this.updateExternalUI(0);
        if (window.lucide) window.lucide.createIcons();
        return;
      }

      let html = '';

      // ADVERTENCIA DE AUTENTICACION
      const user = window.firebase && window.firebase.auth ? firebase.auth().currentUser : null;
      if (!user) {
        html += `
                    <div class="cart-auth-warning">
                        <i data-lucide="alert-triangle" class="cart-auth-warning-icon"></i>
                        <div>
                            <strong>${this.t('limited_access', 'Acceso Limitado')}:</strong><br>
                            ${this.t('cart_login_required', 'Debes iniciar sesión para procesar tu compra y acceder a tus herramientas.')}
                        </div>
                    </div>
                `;
      }

      html += '<div class="cart-items-list cart-items-scroll">';
      let total = 0;

      this.items.forEach((item, _index) => {
        const price = parseFloat(item.price) || 0;
        total += price;
        const img = item.imageUrl || item.image || '/Tecnologia.webp';

        html += `
                    <div class="cart-item">
                        <div class="cart-item-image">
                            <img src="${img}" alt="${this.t('product', 'Producto')}">
                        </div>
                        <div class="cart-item-details">
                            <h4 class="cart-item-title">${item.title || item.name || this.t('product', 'Producto')}</h4>
                            <div class="cart-item-price">€${price.toFixed(2)}</div>
                        </div>
                        <button class="remove-item-btn" data-id="${item.id}">
                            <i data-lucide="trash-2"></i>
                        </button>
                    </div>
                `;
      });

      html += '</div>';
      container.innerHTML = html;
      this.updateExternalUI(total);
      if (window.lucide) window.lucide.createIcons();
    }

    updateExternalUI(total) {
      const totalEl =
        document.getElementById('cartTotalValue') || document.querySelector('.cart-total-value');
      if (totalEl) {
        totalEl.textContent = `€${total.toFixed(2)}`;
      }

      const checkoutBtn = document.getElementById('checkoutBtn');
      if (checkoutBtn) {
        this.syncCheckoutButton();
      }

      if (this.items.length > 0 && total > 0) {
        this.ensurePaymentRuntime().catch(() => {});
      }

      if (window.__WFX_POST_CHECKOUT_ACTIVE__ !== true) {
        this.initPayPalButton(total);
      }
      this.updateCartCount();
    }

    forceCartIconUpdate(checkoutBtn) {
      if (!checkoutBtn) return;
      const oldIcons = checkoutBtn.querySelectorAll('i, svg');
      oldIcons.forEach(icon => icon.remove());

      const svgNS = 'http://www.w3.org/2000/svg';
      const svg = document.createElementNS(svgNS, 'svg');
      svg.setAttribute('width', '20');
      svg.setAttribute('height', '20');
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.setAttribute('fill', 'none');
      svg.setAttribute('stroke', 'currentColor');
      svg.setAttribute('stroke-width', '2');
      svg.setAttribute('stroke-linecap', 'round');
      svg.setAttribute('stroke-linejoin', 'round');
      svg.setAttribute('aria-hidden', 'true');
      svg.classList.add('cart-btn-icon');

      const path1 = document.createElementNS(svgNS, 'path');
      path1.setAttribute('d', 'M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z');
      svg.appendChild(path1);

      const line = document.createElementNS(svgNS, 'line');
      line.setAttribute('x1', '3');
      line.setAttribute('y1', '6');
      line.setAttribute('x2', '21');
      line.setAttribute('y2', '6');
      svg.appendChild(line);

      const path2 = document.createElementNS(svgNS, 'path');
      path2.setAttribute('d', 'M16 10a4 4 0 0 1-8 0');
      svg.appendChild(path2);

      checkoutBtn.insertBefore(svg, checkoutBtn.firstChild);
    }

    initPayPalButton(total) {
      if (window.__WFX_POST_CHECKOUT_ACTIVE__ === true) {
        return;
      }

      const initialContainer = document.getElementById('paypal-button-container');
      if (!initialContainer) return;

      if (this.items.length === 0 || total <= 0) {
        initialContainer.innerHTML = '';
        initialContainer.removeAttribute('data-total');
        return;
      }

      if (initialContainer.getAttribute('data-total') === total.toString()) return;
      initialContainer.setAttribute('data-total', total.toString());

      let retries = 0;
      const productId = this.items.length > 0 ? this.items[0].id : null;
      const attempt = () => {
        if (window.__WFX_POST_CHECKOUT_ACTIVE__ === true) {
          return;
        }
        if (window.__PAYPAL_UNAVAILABLE__ === true) {
          const c = document.getElementById('paypal-button-container');
          if (c && !c.querySelector('.paypal-inline-error')) {
            c.innerHTML =
              '<div class="paypal-inline-error">PayPal no disponible en este entorno.</div>';
          }
          return;
        }

        const container = document.getElementById('paypal-button-container');
        if (!container || !container.isConnected) {
          return;
        }

        // Si el total cambió mientras esperábamos, abortamos este render obsoleto.
        if (container.getAttribute('data-total') !== total.toString()) {
          return;
        }

        if (typeof window.renderPayPalButton === 'function') {
          log.trace(`Renderizando PayPal - Total: ${total}, ProductID: ${productId}`, CAT.CART);
          try {
            window.renderPayPalButton('paypal-button-container', total, productId);
          } catch (error) {
            const message = String(error?.message || error || '');
            if (message.includes('removed from DOM')) {
              log.warn(
                '[PayPal] Render cancelado: contenedor eliminado durante actualización de carrito',
                CAT.CART
              );
              return;
            }
            log.error('[PayPal] Error renderizando botón:', CAT.CART, error);
            if (retries < 20) {
              retries++;
              setTimeout(attempt, 300);
            }
          }
          return;
        }

        if (typeof window.waitForPayPal === 'function') {
          window.waitForPayPal().catch(() => {});
        }

        if (retries < 20) {
          retries++;
          setTimeout(attempt, 500);
        }
      };
      this.ensurePaymentRuntime()
        .catch(() => {})
        .finally(() => attempt());
    }

    ensurePaymentRuntime() {
      if (this._paymentRuntimePromise) {
        return this._paymentRuntimePromise;
      }

      if (typeof window.__WFX_ENSURE_PAYMENTS_LOADED__ === 'function') {
        this._paymentRuntimePromise = window
          .__WFX_ENSURE_PAYMENTS_LOADED__()
          .then(() => null)
          .finally(() => {
            this._paymentRuntimePromise = null;
          });
        return this._paymentRuntimePromise;
      }

      return Promise.resolve(null);
    }
  }

  // Estilos correctivos movidos a CSS estático (CSP)

  const manager = new UnifiedCartManager();
  window.CartManager = manager;

  function unifyCartSystems() {
    if (window._cartUnificationDone) return;
    debugLog('🔗 [CartManager] Ejecutando unificación de sistemas...');

    const newAddToCart = function (id, data = null) {
      manager.addItem(
        data || {
          id: id,
        }
      );
    };

    try {
      Object.defineProperty(window, 'addToCart', {
        value: newAddToCart,
        writable: true,
        configurable: true,
      });
    } catch (_e) {
      window.addToCart = newAddToCart;
    }

    if (!window.UserCartManager) window.UserCartManager = {};
    window.UserCartManager.addToCart = (uid, product) => {
      manager.addItem(product);
      return Promise.resolve();
    };

    if (!window.CartUI) window.CartUI = {};
    window.CartUI.updateCartDisplay = () => manager.renderCartModal();

    window.cart = manager.items;
    window._cartUnificationDone = true;
    log.trace('Sistema Unificado V4.1 listo', CAT.INIT);
  }

  unifyCartSystems();
  const interval = setInterval(unifyCartSystems, 1000);

  window.addEventListener('load', () => {
    setTimeout(() => clearInterval(interval), 5000);
  });
}

export function initCartManager() {
  if (window.__CART_MANAGER_INITED__) {
    return;
  }

  window.__CART_MANAGER_INITED__ = true;
  setupCartManager();
}

if (typeof window !== 'undefined' && !window.__CART_MANAGER_NO_AUTO__) {
  initCartManager();
}
