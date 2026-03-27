/**
 * post-checkout-handler.js
 * Coordina la actualización de la UI después del retorno de checkout.
 */
'use strict';

function setupPostCheckoutHandler() {
  let firebaseFunctionsReadyPromise = null;
  const LOCAL_PURCHASES_KEY = 'wfx_local_purchases';
  const DOWNLOAD_KEY_PREFIX = 'wfx_download_';

  function getCurrentAuthUid() {
    return String(window.firebase?.auth?.()?.currentUser?.uid || '').trim();
  }

  function buildScopedStorageKey(baseKey, uid) {
    const normalizedUid = String(uid || '').trim();
    if (!normalizedUid) return '';
    return `${baseKey}:${normalizedUid}`;
  }

  function buildScopedProductStorageKey(prefix, productId, uid) {
    const normalizedUid = String(uid || '').trim();
    const normalizedProductId = String(productId || '').trim();
    if (!normalizedUid || !normalizedProductId) return '';
    return `${prefix}${normalizedUid}:${normalizedProductId}`;
  }

  function firstNonEmptyString(values) {
    for (const value of values) {
      if (typeof value === 'string' && value.trim()) {
        return value.trim();
      }
    }
    return '';
  }

  function resolveProductIdFromVerifiedData(data) {
    if (!data || typeof data !== 'object') return '';
    return firstNonEmptyString([
      data.productId,
      data.client_reference_id,
      data.clientReferenceId,
      data?.metadata?.productId,
      data?.checkoutSession?.client_reference_id,
      data?.checkoutSession?.metadata?.productId,
    ]);
  }

  function resolveProductIdFromCart() {
    const items = Array.isArray(window.CartManager?.items) ? window.CartManager.items : [];
    if (items.length === 1) {
      return String(items[0]?.id || '').trim();
    }
    return '';
  }

  function getPendingCheckoutContext() {
    try {
      if (typeof sessionStorage === 'undefined') return null;
      const raw = sessionStorage.getItem('wfx:pending-checkout');
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return null;
      return parsed;
    } catch (_e) {
      return null;
    }
  }

  function clearPendingCheckoutContext() {
    try {
      if (typeof sessionStorage === 'undefined') return;
      sessionStorage.removeItem('wfx:pending-checkout');
    } catch (_e) {}
  }

  function persistPostCheckoutResumeState(payload = {}) {
    try {
      if (typeof sessionStorage === 'undefined') return;
      if (!payload || typeof payload !== 'object') return;
      const normalized = {
        productId: String(payload.productId || '').trim(),
        productName: String(payload.productName || '').trim(),
        productPrice: Number.isFinite(Number(payload.productPrice)) ? Number(payload.productPrice) : 0,
        source: String(payload.source || '').trim().toLowerCase(),
        sessionId: String(payload.sessionId || '').trim(),
        paypalOrderId: String(payload.paypalOrderId || '').trim(),
        ts: Date.now(),
      };
      if (!normalized.productId) return;
      sessionStorage.setItem('wfx:post-checkout-resume', JSON.stringify(normalized));
    } catch (_e) {}
  }

  function getPostCheckoutResumeState() {
    try {
      if (typeof sessionStorage === 'undefined') return null;
      const raw = sessionStorage.getItem('wfx:post-checkout-resume');
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch (_e) {
      return null;
    }
  }

  function clearPostCheckoutResumeState() {
    try {
      if (typeof sessionStorage === 'undefined') return;
      sessionStorage.removeItem('wfx:post-checkout-resume');
    } catch (_e) {}
  }

  function persistPostCheckoutCleanupState(productIds = []) {
    try {
      if (typeof sessionStorage === 'undefined') return;
      const ids = Array.from(
        new Set(
          productIds
            .map(id => String(id || '').trim())
            .filter(Boolean)
        )
      );
      if (ids.length === 0) return;
      sessionStorage.setItem('wfx:post-checkout-cart-cleanup', JSON.stringify(ids));
    } catch (_e) {}
  }

  function consumePostCheckoutCleanupState() {
    try {
      if (typeof sessionStorage === 'undefined') return [];
      const raw = sessionStorage.getItem('wfx:post-checkout-cart-cleanup');
      if (!raw) return [];
      sessionStorage.removeItem('wfx:post-checkout-cart-cleanup');
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.map(id => String(id || '').trim()).filter(Boolean) : [];
    } catch (_e) {
      return [];
    }
  }

  function getPurchasedCandidateIds(...values) {
    return Array.from(
      new Set(
        values
          .flat()
          .map(value => String(value || '').trim())
          .filter(Boolean)
      )
    );
  }

  function applyPurchasedCartCleanup(productIds = [], attempt = 0) {
    const purchasedIds = getPurchasedCandidateIds(productIds);
    if (purchasedIds.length === 0) return;

    const manager = window.CartManager;
    if (!manager) {
      persistPostCheckoutCleanupState(purchasedIds);
      if (attempt < 20) {
        setTimeout(() => applyPurchasedCartCleanup(purchasedIds, attempt + 1), 400);
      }
      return;
    }

    const cartItems = Array.isArray(manager.items) ? [...manager.items] : [];
    const itemMatchesPurchase = item => {
      const keys = getPurchasedCandidateIds(
        item?.id,
        item?.productId,
        item?.stripeId,
        item?.stripeProductId,
        item?.priceId
      );
      return keys.some(key => purchasedIds.includes(key));
    };
    const wasInCart = cartItems.some(itemMatchesPurchase);
    if (!wasInCart) {
      if (cartItems.length <= 1 && typeof manager.clear === 'function') {
        manager.clear();
      }
      manager.updateCartCount?.();
      manager.renderCartModal?.();
      return;
    }

    if (cartItems.length <= 1 && typeof manager.clear === 'function') {
      manager.clear();
    } else if (typeof manager.removeItem === 'function') {
      cartItems.filter(itemMatchesPurchase).forEach(item => {
        const itemId = String(item?.id || item?.productId || '').trim();
        if (itemId) {
          manager.removeItem(itemId);
        }
      });
    } else if (typeof manager.clear === 'function') {
      manager.clear();
    }

    manager.updateCartCount?.();
    manager.renderCartModal?.();
  }

  function scheduleDeferredCheckoutPersistence(task, maxAttempts = 8, delayMs = 1500) {
    let attempts = 0;
    const run = async () => {
      attempts += 1;
      try {
        const result = await task();
        if (result) return true;
      } catch (_e) {}
      if (attempts < maxAttempts) {
        setTimeout(run, delayMs * attempts);
      }
      return false;
    };
    void run();
  }

  function buildCheckoutPersistenceContext({
    productId,
    source,
    sessionId,
    paypalOrderId,
    amount,
  }) {
    return {
      productId: String(productId || '').trim(),
      source: String(source || 'checkout')
        .trim()
        .toLowerCase(),
      sessionId: String(sessionId || '').trim(),
      paypalOrderId: String(paypalOrderId || '').trim(),
      amount: Number.isFinite(Number(amount)) ? Number(amount) : 0,
    };
  }

  async function persistCheckoutArtifacts(context, authTimeoutMs = 8000) {
    const normalized = buildCheckoutPersistenceContext(context);
    if (!normalized.productId) return null;

    const authReady = await waitForAuth(authTimeoutMs);
    if (!authReady) {
      console.warn('[PostCheckout] Auth no disponible tras redirect; se omite persistencia inicial');
      return null;
    }

    const [persistedProduct, persistedOrder] = await Promise.all([
      registerPurchaseInFirestore(normalized.productId, normalized),
      syncOrderRecordFromCheckout(normalized),
    ]);

    if (!persistedProduct && !persistedOrder) {
      return null;
    }
    return [persistedProduct, persistedOrder];
  }

  function scheduleAnnouncementOwnershipRetry(productId, maxAttempts = 12, delayMs = 500) {
    let attempts = 0;
    const run = () => {
      attempts += 1;
      const announcementSystem = window.announcementSystem;
      if (
        announcementSystem &&
        typeof announcementSystem.markAsOwnedLocally === 'function'
      ) {
        announcementSystem.markAsOwnedLocally(productId);
        return;
      }
      if (attempts < maxAttempts) {
        setTimeout(run, delayMs * attempts);
      }
    };
    run();
  }

  function buildCheckoutRunKey(status, productId, sessionId, source) {
    return [status || '', productId || '', sessionId || '', source || ''].join('|');
  }

  function persistLocalPurchaseState(productId, meta = {}) {
    const normalizedProductId = String(productId || '').trim();
    const uid = getCurrentAuthUid();
    if (!normalizedProductId || !uid) return;

    try {
      const localPurchasesKey = buildScopedStorageKey(LOCAL_PURCHASES_KEY, uid);
      const raw = localStorage.getItem(localPurchasesKey);
      const current = raw ? JSON.parse(raw) : [];
      const next = Array.isArray(current) ? current.map(String) : [];
      if (!next.includes(normalizedProductId)) {
        next.push(normalizedProductId);
      }
      localStorage.setItem(localPurchasesKey, JSON.stringify(next));
    } catch (_e) {}

    try {
      const storageKey = buildScopedProductStorageKey(DOWNLOAD_KEY_PREFIX, normalizedProductId, uid);
      if (!storageKey) return;
      const existing = localStorage.getItem(storageKey);
      const parsed = existing ? JSON.parse(existing) : null;
      const purchaseTimestamp =
        Number(meta.purchaseTimestamp) > 0 ? Number(meta.purchaseTimestamp) : Date.now();
      const payload = {
        purchaseTimestamp:
          parsed && Number(parsed.purchaseTimestamp) > 0
            ? Number(parsed.purchaseTimestamp)
            : purchaseTimestamp,
        downloadCount:
          parsed && Number.isFinite(Number(parsed.downloadCount))
            ? Number(parsed.downloadCount)
            : 0,
        lastDownloadTimestamp:
          parsed && parsed.lastDownloadTimestamp ? parsed.lastDownloadTimestamp : null,
      };
      localStorage.setItem(storageKey, JSON.stringify(payload));
    } catch (_e) {}

    try {
      window.dispatchEvent(
        new CustomEvent('wfx:purchaseCompleted', {
          detail: {
            productId: normalizedProductId,
            source: meta.source || '',
          },
        })
      );
    } catch (_e) {}
  }

  function applyConfirmedPurchaseUiState({
    productId,
    productName,
    productPrice,
    checkoutSource,
    sessionId,
    paypalOrderId,
  }) {
    if (!productId) return;

    persistLocalPurchaseState(productId, {
      source: checkoutSource,
      purchaseTimestamp: Date.now(),
    });

    if (
      window.announcementSystem &&
      typeof window.announcementSystem.markAsOwnedLocally === 'function'
    ) {
      window.announcementSystem.markAsOwnedLocally(productId);
    } else {
      console.warn('[PostCheckout] AnnouncementSystem no disponible para markAsOwnedLocally');
      scheduleAnnouncementOwnershipRetry(productId);
    }

    const purchaseButtons = document.querySelectorAll(
      `[data-product-id="${productId}"][data-action="buyNowAnnouncement"],[data-product-id="${productId}"][data-action="addToCartAnnouncement"]`
    );
    purchaseButtons.forEach(btn => {
      btn.classList.add('is-disabled');
      btn.setAttribute('disabled', 'true');
      btn.setAttribute('aria-disabled', 'true');
    });

    if (window.UltimateDownloadManager) {
      window.UltimateDownloadManager.registerPurchase(productId);
    }

    persistPostCheckoutResumeState({
      productId,
      productName,
      productPrice,
      source: checkoutSource,
      sessionId,
      paypalOrderId,
    });
  }

  function showSuccessModalDeterministic(productId, productName) {
    const hasModernModalMounted = () => {
      const overlay = document.querySelector('.purchase-success-overlay');
      const primaryBtn = overlay?.querySelector(
        '.purchase-success-btn-primary[data-action="scroll-to-product"]'
      );
      return !!overlay && !!primaryBtn;
    };

    const isMainModalVisible = () => {
      const overlay = document.querySelector('.purchase-success-overlay');
      const modal = document.querySelector('.purchase-success-modal');
      if (!overlay) return false;
      try {
        const style = getComputedStyle(overlay);
        const modalStyle = modal ? getComputedStyle(modal) : null;
        const overlayRect = overlay.getBoundingClientRect();
        const modalRect = modal ? modal.getBoundingClientRect() : null;
        const hasOverlayBox = overlayRect.width >= 40 && overlayRect.height >= 40;
        const hasModalBox = !!modalRect && modalRect.width >= 120 && modalRect.height >= 80;
        const isOnScreen =
          !!modalRect &&
          modalRect.bottom > 0 &&
          modalRect.right > 0 &&
          modalRect.left < window.innerWidth &&
          modalRect.top < window.innerHeight;
        return !(
          style.display === 'none' ||
          style.visibility === 'hidden' ||
          Number(style.opacity) === 0 ||
          !modal ||
          !modalStyle ||
          modalStyle.display === 'none' ||
          modalStyle.visibility === 'hidden' ||
          Number(modalStyle.opacity) === 0 ||
          !hasOverlayBox ||
          !hasModalBox ||
          !isOnScreen
        );
      } catch (_e) {
        return false;
      }
    };

    if (typeof window.showPurchaseSuccessModal !== 'function') {
      console.error('[PostCheckout] ❌ showPurchaseSuccessModal no está disponible');
      if (window.NotificationSystem) {
        window.NotificationSystem.success('Compra exitosa. Tu descarga está lista.');
      }
      return;
    }

    try {
      window.showPurchaseSuccessModal(productId, productName);
    } catch (modalError) {
      console.error('[PostCheckout] Error al abrir modal principal:', modalError);
      if (window.NotificationSystem) {
        window.NotificationSystem.success('Compra exitosa. Tu descarga está lista.');
      }
      return;
    }

    window.setTimeout(() => {
      // Si está montado el modal moderno con su CTA principal, NO usar fallback.
      if (hasModernModalMounted() || isMainModalVisible()) return;
      console.warn('[PostCheckout] Modal moderno no visible tras apertura.');
      if (window.NotificationSystem) {
        window.NotificationSystem.success('Compra exitosa. Tu descarga está lista.');
      }
    }, 300);
  }

  function trackGtmEvent(eventName, params) {
    if (window.Analytics && typeof window.Analytics.trackEvent === 'function') {
      window.Analytics.trackEvent(
        eventName,
        params?.eventCategory || 'Ecommerce',
        params?.eventLabel || '',
        params?.eventValue
      );
    }
    if (window.dataLayer) {
      window.dataLayer.push({
        event: eventName,
        ...params,
      });
    }
  }

  async function syncOrderRecordFromCheckout({
    productId,
    source,
    sessionId,
    paypalOrderId,
    amount,
  }) {
    try {
      if (!productId) return null;
      const normalizedSource = String(source || '').toLowerCase();
      if (!['paypal', 'stripe'].includes(normalizedSource)) return null;

      const ready = await waitForFirebaseFunctions(12000);
      if (!ready) {
        console.warn(
          '[PostCheckout] Firebase Functions no disponible para recordOrderFromCheckout'
        );
        return null;
      }

      const callable = getCallable('recordOrderFromCheckout');
      if (!callable) return null;

      const payload = {
        productId: String(productId),
        source: normalizedSource,
        paypalOrderId: String(paypalOrderId || '').trim(),
        sessionId: String(sessionId || '').trim(),
        amount: Number.isFinite(Number(amount)) ? Number(amount) : 0,
      };

      if (normalizedSource === 'paypal' && !payload.paypalOrderId) {
        console.warn('[PostCheckout] paypalOrderId ausente, no se registrará order fallback');
        return null;
      }
      if (normalizedSource === 'stripe' && !payload.sessionId) {
        console.warn('[PostCheckout] sessionId ausente, no se registrará order fallback de Stripe');
        return null;
      }

      const result = await callable(payload);
      if (result?.data?.success) {
        return result.data;
      }
      return null;
    } catch (error) {
      console.warn('[PostCheckout] No se pudo registrar order en servidor', error);
      return null;
    }
  }

  async function seedStripeVerificationEvidence({ productId, sessionId, pendingCheckout }) {
    try {
      const normalizedProductId = firstNonEmptyString([productId, pendingCheckout?.productId]);
      if (!normalizedProductId || !sessionId) return false;

      const isAuthenticated = await waitForAuth(3500);
      if (!isAuthenticated) return false;

      const amount = Number(pendingCheckout?.price || pendingCheckout?.amount || 0);
      const safeAmount = Number.isFinite(amount) ? amount : 0;
      const results = await Promise.allSettled([
        syncOrderRecordFromCheckout({
          productId: normalizedProductId,
          source: 'stripe',
          sessionId,
          amount: safeAmount,
        }),
        registerPurchaseInFirestore(normalizedProductId, {
          source: 'stripe',
          sessionId,
          amount: safeAmount,
        }),
      ]);

      return results.some(result => result.status === 'fulfilled' && !!result.value);
    } catch (error) {
      console.warn('[PostCheckout] No se pudo sembrar evidencia rápida de compra', error);
      return false;
    }
  }

  async function handlePostCheckout() {
    const staleCleanupIds = consumePostCheckoutCleanupState();
    if (staleCleanupIds.length > 0) {
      applyPurchasedCartCleanup(staleCleanupIds);
    }

    const urlParams = new URLSearchParams(window.location.search);
    const status = urlParams.get('status');
    const urlProductId = firstNonEmptyString([
      urlParams.get('productId'),
      urlParams.get('product_id'),
      urlParams.get('pid'),
    ]);
    const sessionId = urlParams.get('session_id');
    const source = (urlParams.get('source') || '').toLowerCase();
    const paypalOrderIdFromUrl = firstNonEmptyString([
      urlParams.get('orderID'),
      urlParams.get('orderId'),
      urlParams.get('paypalOrderId'),
    ]);
    const isStripeSessionId = id =>
      typeof id === 'string' && (id.startsWith('cs_test_') || id.startsWith('cs_live_'));
    const isStripeFlow = source === 'stripe' || (!!sessionId && isStripeSessionId(sessionId));
    const isLocalHost =
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1' ||
      window.location.hostname === '::1';
    const pendingCheckout = getPendingCheckoutContext();

    if (status === 'success') {
      let productId = urlProductId;
      const runKey = buildCheckoutRunKey(status, productId, sessionId, source);
      if (window.__WFX_POST_CHECKOUT_LAST_KEY__ === runKey) {
        console.info('[PostCheckout] Duplicado detectado, ejecución omitida');
        return;
      }
      if (window.__WFX_POST_CHECKOUT_ACTIVE__ === true) {
        console.info('[PostCheckout] Ya hay un post-checkout en curso, ejecución omitida');
        return;
      }
      window.__WFX_POST_CHECKOUT_LAST_KEY__ = runKey;
      window.__WFX_POST_CHECKOUT_ACTIVE__ = true;

      try {
        let verifiedData = null;
        const shouldVerifyStripe =
          isStripeFlow && source !== 'paypal' && isStripeSessionId(sessionId);

        if (shouldVerifyStripe && !isLocalHost) {
          const verificationProductId = firstNonEmptyString([productId, pendingCheckout?.productId]);
          const functionsReadyPromise = waitForFirebaseFunctions(1500).catch(() => false);
          const evidenceSeedPromise = seedStripeVerificationEvidence({
            productId: verificationProductId,
            sessionId,
            pendingCheckout,
          });

          verifiedData = await verifyCheckoutSessionFastWithRetry(
            sessionId,
            verificationProductId || undefined,
            3,
            250,
            functionsReadyPromise
          );
          if (!verifiedData) {
            await Promise.race([
              evidenceSeedPromise,
              new Promise(resolve => setTimeout(resolve, 1200)),
            ]);
            verifiedData = await verifyCheckoutSessionFastWithRetry(
              sessionId,
              verificationProductId || undefined,
              4,
              300,
              functionsReadyPromise
            );
          }
          if (!verifiedData) {
            await waitForAuth(1500);
            verifiedData = await verifyCheckoutSessionWithRetry(
              sessionId,
              verificationProductId || undefined,
              2,
              400,
              functionsReadyPromise
            );
          }
          if (!verifiedData) {
            console.error('[PostCheckout] ❌ Verificación de sesión fallida');
            if (window.NotificationSystem) {
              window.NotificationSystem.error('No se pudo verificar la compra. Contacta soporte.');
            }
            return;
          }
        } else if (shouldVerifyStripe && isLocalHost) {
          console.info(
            '[PostCheckout] Localhost detectado: se omite la verificación bloqueante antes de mostrar el modal'
          );
        }

        if (!productId) {
          productId = resolveProductIdFromVerifiedData(verifiedData);
        }
        if (!productId) {
          productId = resolveProductIdFromCart();
        }
        if (!productId && pendingCheckout) {
          productId = firstNonEmptyString([pendingCheckout.productId]);
        }
        if (!productId) {
          console.error('[PostCheckout] ❌ No se pudo resolver productId en retorno de compra', {
            sessionId,
            source,
            status,
            urlProductId,
            cartItems: Array.isArray(window.CartManager?.items)
              ? window.CartManager.items.length
              : 0,
            pendingCheckout,
          });
          if (window.NotificationSystem) {
            window.NotificationSystem.error(
              'Compra detectada, pero no se pudo identificar el producto. Contacta soporte.'
            );
          }
          return;
        }

        let productName = 'Producto';
        let productPrice = 0;

        if (verifiedData) {
          productName = verifiedData.productTitle || productName;
          productPrice = parseFloat(verifiedData.price) || 0;
        } else if (pendingCheckout) {
          productName = pendingCheckout.productName || productName;
          productPrice = parseFloat(pendingCheckout.price) || 0;
        } else if (window.announcementSystem && window.announcementSystem.cache) {
          const cachedProduct = window.announcementSystem.cache.get(productId);
          if (cachedProduct) {
            productName = cachedProduct.name || cachedProduct.title || 'Producto';
            productPrice = parseFloat(cachedProduct.price) || 0;
          }
        }

        // Limpiar carrito del producto comprado (evitar doble compra)
        try {
          const purchasedIds = getPurchasedCandidateIds(
            productId,
            verifiedData?.productId,
            urlProductId,
            pendingCheckout?.productId
          );
          const hadManager = !!window.CartManager;
          const hadItems = Array.isArray(window.CartManager?.items)
            ? window.CartManager.items.some(item =>
                purchasedIds.includes(String(item?.id || '').trim())
              )
            : false;
          applyPurchasedCartCleanup(purchasedIds);
          if ((hadManager && hadItems) && window.NotificationSystem) {
            window.NotificationSystem.info('Carrito actualizado: artículo comprado eliminado');
          }
        } catch (cartError) {
          console.warn('[PostCheckout] Error no bloqueante limpiando carrito:', cartError);
        }

        const checkoutSource = source || (isStripeFlow ? 'stripe' : 'checkout');
        const paypalOrderId = firstNonEmptyString([
          paypalOrderIdFromUrl,
          pendingCheckout?.paypalOrderId,
        ]);
        const newUrl = window.location.origin + window.location.pathname;
        window.history.replaceState({}, document.title, newUrl);

        void (async () => {
          const persistenceContext = buildCheckoutPersistenceContext({
            productId,
            source: checkoutSource,
            sessionId,
            paypalOrderId,
            amount: productPrice || pendingCheckout?.price || pendingCheckout?.amount || 0,
          });

          let persistenceResult = await persistCheckoutArtifacts(persistenceContext);
          if (!persistenceResult) {
            await new Promise(resolve => setTimeout(resolve, 1800));
            persistenceResult = await persistCheckoutArtifacts(persistenceContext);
          }
          if (!persistenceResult) {
            scheduleDeferredCheckoutPersistence(async () => {
              const deferredResult = await persistCheckoutArtifacts(persistenceContext);
              if (deferredResult) {
                clearPendingCheckoutContext();
                clearPostCheckoutResumeState();
              }
              return !!deferredResult;
            });
            persistenceResult = [null, null];
          }
          const [productData, serverOrder] = persistenceResult;
          if (productData || serverOrder) {
            applyConfirmedPurchaseUiState({
              productId,
              productName,
              productPrice,
              checkoutSource,
              sessionId,
              paypalOrderId,
            });
            clearPendingCheckoutContext();
            clearPostCheckoutResumeState();
            console.info('[PostCheckout] Lanzando modal de compra exitosa');
            showSuccessModalDeterministic(productId, productName);
          } else {
            console.error('[PostCheckout] No se confirmó la compra en el servidor');
            if (window.NotificationSystem) {
              window.NotificationSystem.error('La compra no pudo confirmarse. Contacta soporte.');
            }
            return;
          }

          const resolvedProductName =
            serverOrder?.productTitle ||
            productData?.name ||
            productData?.title ||
            productName ||
            'Producto';
          const resolvedProductPrice =
            parseFloat(serverOrder?.price) || parseFloat(productData?.price) || productPrice || 0;

          if (window.enhancedAnalytics) {
            window.enhancedAnalytics.trackPurchaseCompleted(
              productId,
              resolvedProductPrice,
              productId,
              resolvedProductName
            );
          }

          trackGtmEvent('purchase_completed', {
            eventCategory: 'Ecommerce',
            eventLabel: resolvedProductName,
            eventValue: resolvedProductPrice,
            transaction_id: sessionId || `${source || 'checkout'}-${productId || 'unknown'}`,
            value: resolvedProductPrice,
            currency: 'EUR',
            payment_method: isStripeFlow ? 'stripe' : source || 'checkout',
            items: [
              {
                item_id: productId || 'unknown',
                item_name: resolvedProductName,
                price: resolvedProductPrice,
                quantity: 1,
              },
            ],
          });
        })().catch(error => {
          console.warn('[PostCheckout] Tareas post-compra diferidas incompletas', error);
        });
      } finally {
        window.__WFX_POST_CHECKOUT_ACTIVE__ = false;
      }
    }
  }

  /**
   * Verifica una sesión de Stripe en el servidor antes de continuar
   * @param {string} sessionId - ID de la sesión de Stripe
   * @param {string} productId - ID del producto esperado
   * @returns {Promise<Object|null>} Datos verificados o null si falla
   */
  async function verifyCheckoutSession(sessionId, productId, functionsReadyPromise = null) {
    try {
      const params = new URLSearchParams(window.location.search);
      const source = String(params.get('source') || '').toLowerCase();
      if (source === 'paypal') {
        return null;
      }

      if (
        typeof sessionId !== 'string' ||
        (!sessionId.startsWith('cs_test_') && !sessionId.startsWith('cs_live_'))
      ) {
        return null;
      }

      const ready =
        functionsReadyPromise && typeof functionsReadyPromise.then === 'function'
          ? await functionsReadyPromise
          : await waitForFirebaseFunctions(2500);
      if (!ready) {
        console.warn('[PostCheckout] Firebase Functions no disponible');
        return null;
      }

      const auth =
        window.firebase?.auth && typeof window.firebase.auth === 'function'
          ? window.firebase.auth()
          : window.firebaseModular?.auth;
      const currentUser = auth?.currentUser || null;

      if (!currentUser) {
        // Usuario no autenticado: omitimos verificación silenciosamente para evitar ruido en consola.
        return null;
      }

      const verify = getCallable('verifyCheckoutSession');
      if (!verify) {
        return null;
      }

      const payload = { sessionId: sessionId };
      if (productId) {
        payload.productId = productId;
      }
      const result = await verify(payload);

      if (!result.data || !result.data.success) {
        console.warn('[PostCheckout] Respuesta sin éxito:', result?.data || null);
        return null;
      }

      return result.data;
    } catch (error) {
      const code = error && (error.code || error?.details?.code);
      const message = error && (error.message || error?.details?.message || 'Error');
      console.error('[PostCheckout] ❌ Error verificando sesión de Stripe:', {
        code,
        message,
        error,
      });
      return { __errorCode: String(code || '') };
    }
  }

  async function verifyCheckoutSessionFast(sessionId, productId, functionsReadyPromise = null) {
    try {
      if (
        typeof sessionId !== 'string' ||
        (!sessionId.startsWith('cs_test_') && !sessionId.startsWith('cs_live_'))
      ) {
        return null;
      }

      const ready =
        functionsReadyPromise && typeof functionsReadyPromise.then === 'function'
          ? await functionsReadyPromise
          : await waitForFirebaseFunctions(1500);
      if (!ready) {
        console.warn('[PostCheckout] Firebase Functions no disponible para verificación rápida');
        return null;
      }

      const verifyFast = getCallable('verifyCheckoutSessionFast');
      if (!verifyFast) {
        return null;
      }

      const payload = { sessionId };
      if (productId) {
        payload.productId = productId;
      }

      const result = await verifyFast(payload);
      if (!result.data || !result.data.success) {
        return null;
      }
      return result.data;
    } catch (error) {
      const code = error && (error.code || error?.details?.code);
      const message = error && (error.message || error?.details?.message || 'Error');
      console.warn('[PostCheckout] Verificación rápida no disponible:', {
        code,
        message,
      });
      return null;
    }
  }

  async function verifyCheckoutSessionWithRetry(
    sessionId,
    productId,
    attempts = 2,
    delayMs = 2000,
    functionsReadyPromise = null
  ) {
    for (let i = 1; i <= attempts; i++) {
      const data = await verifyCheckoutSession(sessionId, productId, functionsReadyPromise);
      if (data && !data.__errorCode) return data;
      if (
        data &&
        (data.__errorCode.includes('not-found') || data.__errorCode.includes('permission-denied'))
      ) {
        return null;
      }
      if (i < attempts) {
        await new Promise(resolve => setTimeout(resolve, delayMs * i));
      }
    }
    return null;
  }

  async function verifyCheckoutSessionFastWithRetry(
    sessionId,
    productId,
    attempts = 2,
    delayMs = 700,
    functionsReadyPromise = null
  ) {
    for (let i = 1; i <= attempts; i++) {
      const data = await verifyCheckoutSessionFast(sessionId, productId, functionsReadyPromise);
      if (data && !data.__errorCode) return data;
      if (i < attempts) {
        await new Promise(resolve => setTimeout(resolve, delayMs * i));
      }
    }
    return null;
  }

  function hasFirebaseFunctions() {
    return (
      (window.firebaseModular?.httpsCallable &&
        typeof window.firebaseModular.httpsCallable === 'function') ||
      (window.firebase?.functions && typeof window.firebase.functions === 'function')
    );
  }

  function getCallable(name) {
    if (
      window.firebaseModular?.httpsCallable &&
      typeof window.firebaseModular.httpsCallable === 'function'
    ) {
      try {
        return window.firebaseModular.httpsCallable(name);
      } catch (_e) {}
    }
    if (window.firebase?.functions && typeof window.firebase.functions === 'function') {
      try {
        return window.firebase.functions().httpsCallable(name);
      } catch (_e) {}
    }
    return null;
  }

  function waitForFirebaseFunctions(timeoutMs = 10000) {
    if (hasFirebaseFunctions()) return Promise.resolve(true);
    if (firebaseFunctionsReadyPromise) {
      return firebaseFunctionsReadyPromise;
    }
    firebaseFunctionsReadyPromise = new Promise(resolve => {
      let done = false;
      const finish = ok => {
        if (done) return;
        done = true;
        window.removeEventListener('firebase:initialized', handler);
        window.removeEventListener('firebaseReady', handler);
        clearTimeout(timer);
        firebaseFunctionsReadyPromise = null;
        resolve(ok);
      };
      const handler = () => {
        if (hasFirebaseFunctions()) finish(true);
      };
      const timer = setTimeout(() => finish(hasFirebaseFunctions()), timeoutMs);
      window.addEventListener('firebase:initialized', handler, { once: true });
      window.addEventListener('firebaseReady', handler, { once: true });
    });
    return firebaseFunctionsReadyPromise;
  }

  async function persistPurchaseInUserProfile(productId, meta = {}) {
    try {
      if (!window.firebase || !window.firebase.firestore || !window.firebase.auth) {
        return false;
      }

      const auth = window.firebase.auth();
      const user = auth?.currentUser;
      if (!user?.uid) {
        return false;
      }

      const db = window.firebase.firestore();
      const fieldValue = window.firebase.firestore.FieldValue;
      const userDocRef = db.collection('users').doc(user.uid);
      const amountRaw = Number(meta?.amount ?? 0);
      const amount = Number.isFinite(amountRaw) ? amountRaw : 0;
      const source = String(meta?.source || 'checkout')
        .trim()
        .toLowerCase();
      const title = String(meta?.productTitle || '').trim();
      const purchaseMetaPatch = {
        [String(productId)]: {
          amount,
          source,
          productTitle: title || null,
          updatedAt: fieldValue?.serverTimestamp ? fieldValue.serverTimestamp() : new Date(),
        },
      };

      if (fieldValue?.arrayUnion && fieldValue?.serverTimestamp) {
        await userDocRef.set(
          {
            purchases: fieldValue.arrayUnion(String(productId)),
            purchaseMeta: purchaseMetaPatch,
            updatedAt: fieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      } else {
        const snap = await userDocRef.get();
        const existing = snap.exists ? snap.data() || {} : {};
        const purchases = Array.isArray(existing.purchases) ? existing.purchases.map(String) : [];
        if (!purchases.includes(String(productId))) {
          purchases.push(String(productId));
        }
        await userDocRef.set(
          {
            purchases,
            purchaseMeta: purchaseMetaPatch,
            updatedAt: new Date(),
          },
          { merge: true }
        );
      }

      return true;
    } catch (error) {
      console.warn('[PostCheckout] No se pudo persistir compra en perfil de usuario', error);
      return false;
    }
  }

  /**
   * Sincroniza metadata de compra del lado cliente sin tocar la ruta canónica.
   * La compra verificable se registra exclusivamente desde Cloud Functions.
   * @param {string} productId - ID del producto comprado
   * @param {Object} context - Metadatos de checkout (source/session/order/amount)
   * @returns {Promise<Object|null>} - Datos del producto o null si hay error
   */
  async function registerPurchaseInFirestore(productId, context = {}) {
    try {
      // Verificar que Firebase esté disponible
      if (!window.firebase || !window.firebase.firestore || !window.firebase.auth) {
        console.error('[PostCheckout] Firebase no disponible');
        return null;
      }

      const db = window.firebase.firestore();
      const auth = window.firebase.auth();
      const user = auth?.currentUser || null;
      const fieldValue = window.firebase.firestore.FieldValue;

      // Obtener información del producto
      const productDoc = await db.collection('announcements').doc(productId).get();
      if (!productDoc.exists) {
        console.error('[PostCheckout] Producto no encontrado:', productId);
        return null;
      }

      const productData = productDoc.data();

      // Persistencia de apoyo para la UI mientras el backend termina de sincronizar.
      const fallbackAmount = Number(context.amount ?? productData.price ?? productData.amount ?? 0);
      await persistPurchaseInUserProfile(productId, {
        amount: Number.isFinite(fallbackAmount) ? fallbackAmount : 0,
        source: context.source || 'checkout',
        productTitle: String(productData.name || productData.title || 'Producto').trim(),
      });

      if (user?.uid && fieldValue) {
        await db
          .collection('users')
          .doc(user.uid)
          .set(
            {
              lastCheckoutContext: {
                productId: String(productId),
                source: String(context.source || 'checkout')
                  .trim()
                  .toLowerCase(),
                sessionId: String(context.sessionId || '').trim() || null,
                paypalOrderId: String(context.paypalOrderId || '').trim() || null,
                updatedAt: fieldValue.serverTimestamp
                  ? fieldValue.serverTimestamp()
                  : new Date(),
              },
            },
            { merge: true }
          )
          .catch(() => null);
      }

      // Retornar datos del producto para el modal
      return productData;
    } catch (error) {
      console.error('[PostCheckout] ❌ Error registrando compra en Firestore:', error);
      // No lanzamos el error para no interrumpir el flujo de UI
      return null;
    }
  }

  /**
   * Espera a que Firebase Auth tenga usuario (o timeout)
   * @param {number} timeoutMs
   * @returns {Promise<boolean>}
   */
  function waitForAuth(timeoutMs = 10000) {
    return new Promise(resolve => {
      if (!window.firebase || !window.firebase.auth) {
        resolve(false);
        return;
      }
      const auth = window.firebase.auth();
      if (auth.currentUser) {
        resolve(true);
        return;
      }
      let done = false;
      const timer = setTimeout(() => {
        if (done) return;
        done = true;
        if (unsubscribe) unsubscribe();
        resolve(false);
      }, timeoutMs);
      const unsubscribe = auth.onAuthStateChanged(user => {
        if (done) return;
        if (user) {
          done = true;
          clearTimeout(timer);
          unsubscribe();
          resolve(true);
        }
      });
    });
  }

  const resumeState = getPostCheckoutResumeState();
  if (resumeState?.productId) {
    applyPurchasedCartCleanup([resumeState.productId]);
    scheduleAnnouncementOwnershipRetry(resumeState.productId);
    const hasExplicitSuccessStatus = new URLSearchParams(window.location.search).get('status') === 'success';
    if (!hasExplicitSuccessStatus) {
      const resumePersistenceContext = buildCheckoutPersistenceContext({
        productId: resumeState.productId,
        source: resumeState.source || 'checkout',
        sessionId: resumeState.sessionId || '',
        paypalOrderId: resumeState.paypalOrderId || '',
        amount: resumeState.productPrice || 0,
      });
      scheduleDeferredCheckoutPersistence(async () => {
        const persistedArtifacts = await persistCheckoutArtifacts(resumePersistenceContext);
        if (persistedArtifacts) {
          clearPendingCheckoutContext();
          clearPostCheckoutResumeState();
          return true;
        }
        return false;
      }, 10, 1800);
    }
  }

  // Ejecutar al cargar el DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', handlePostCheckout);
  } else {
    handlePostCheckout();
  }
}

export function initPostCheckoutHandler() {
  if (window.__POST_CHECKOUT_HANDLER_INITED__) {
    return;
  }

  window.__POST_CHECKOUT_HANDLER_INITED__ = true;
  setupPostCheckoutHandler();
}

if (typeof window !== 'undefined' && !window.__POST_CHECKOUT_HANDLER_NO_AUTO__) {
  initPostCheckoutHandler();
}
