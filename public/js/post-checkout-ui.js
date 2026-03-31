'use strict';

import {
  LOCAL_PURCHASES_KEY,
  DOWNLOAD_KEY_PREFIX,
  buildScopedStorageKey,
  buildScopedProductStorageKey,
  getPurchasedCandidateIds,
  persistPostCheckoutResumeState,
} from './post-checkout-state.js';
import { emitPurchaseCompleted } from './purchase-integration.js';
import { findAllByDataAttrs } from './security/dom-safety.js';

export function createPostCheckoutUi({
  getCurrentAuthUid,
  clearPendingCheckoutContext,
  clearPostCheckoutResumeState,
  persistPostCheckoutCleanupState,
}) {
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

  function scheduleAnnouncementOwnershipRetry(productId, maxAttempts = 12, delayMs = 500) {
    let attempts = 0;
    const run = () => {
      attempts += 1;
      emitPurchaseCompleted({ productId, purchaseTimestamp: Date.now() });
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

    emitPurchaseCompleted({
      productId: normalizedProductId,
      source: meta.source || '',
      purchaseTimestamp:
        Number(meta.purchaseTimestamp) > 0 ? Number(meta.purchaseTimestamp) : Date.now(),
    });
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

    scheduleAnnouncementOwnershipRetry(productId, 2, 250);

    const purchaseButtons = [
      ...findAllByDataAttrs('[data-product-id][data-action]', {
        'data-product-id': productId,
        'data-action': 'buyNowAnnouncement',
      }),
      ...findAllByDataAttrs('[data-product-id][data-action]', {
        'data-product-id': productId,
        'data-action': 'addToCartAnnouncement',
      }),
    ];
    purchaseButtons.forEach(btn => {
      btn.classList.add('is-disabled');
      btn.setAttribute('disabled', 'true');
      btn.setAttribute('aria-disabled', 'true');
    });

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
    const waitForSuccessModal = (maxAttempts = 12, delayMs = 250) =>
      new Promise(resolve => {
        let attempts = 0;
        const run = () => {
          attempts += 1;
          if (typeof window.showPurchaseSuccessModal === 'function') {
            resolve(true);
            return;
          }
          if (attempts >= maxAttempts) {
            resolve(false);
            return;
          }
          window.setTimeout(run, delayMs);
        };
        run();
      });

    const forceVisibleModal = () => {
      const overlay = document.querySelector('.purchase-success-overlay');
      const modal = document.querySelector('.purchase-success-modal');
      if (!overlay || !modal) return false;
      overlay.classList.add('purchase-success-overlay--force-visible');
      modal.classList.add('purchase-success-modal--force-visible');
      overlay.setAttribute('aria-hidden', 'false');
      if (typeof overlay.showModal === 'function' && !overlay.open) {
        try {
          overlay.showModal();
        } catch (_e) {}
      }
      return true;
    };

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

    void (async () => {
      const modalReady = await waitForSuccessModal();
      if (!modalReady) {
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
        if (hasModernModalMounted() || isMainModalVisible()) return;
        const forcedVisible = forceVisibleModal();
        if (!forcedVisible) {
          console.warn('[PostCheckout] Modal moderno no montado tras apertura.');
          if (window.NotificationSystem) {
            window.NotificationSystem.success('Compra exitosa. Tu descarga está lista.');
          }
          return;
        }

        window.setTimeout(() => {
          if (hasModernModalMounted() || isMainModalVisible()) return;
          console.warn('[PostCheckout] Modal moderno no visible tras forzar apertura.');
          if (window.NotificationSystem) {
            window.NotificationSystem.success('Compra exitosa. Tu descarga está lista.');
          }
        }, 220);
      }, 320);
    })();
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

  function requiresServerConfirmation(checkoutSource) {
    const normalizedSource = String(checkoutSource || '')
      .trim()
      .toLowerCase();
    return normalizedSource === 'stripe' || normalizedSource === 'paypal';
  }

  function getPersistenceState(result) {
    if (!result || typeof result !== 'object') {
      return {
        profilePurchase: null,
        serverOrder: null,
        profilePersisted: false,
        serverConfirmed: false,
      };
    }

    return {
      profilePurchase: result.profilePurchase || null,
      serverOrder: result.serverOrder || null,
      profilePersisted: result.profilePersisted === true,
      serverConfirmed: result.serverConfirmed === true,
    };
  }

  function finalizeSuccessfulCheckout({
    persistenceContext,
    productId,
    productName,
    productPrice,
    checkoutSource,
    sessionId,
    paypalOrderId,
    source,
    isStripeFlow,
    persistCheckoutArtifacts,
    scheduleDeferredCheckoutPersistence,
  }) {
    void (async () => {
      let persistenceResult = await persistCheckoutArtifacts(persistenceContext);
      if (!persistenceResult) {
        await new Promise(resolve => setTimeout(resolve, 1800));
        persistenceResult = await persistCheckoutArtifacts(persistenceContext);
      }
      const needsServerConfirmation = requiresServerConfirmation(checkoutSource);
      let persistenceState = getPersistenceState(persistenceResult);

      if (!persistenceResult || (needsServerConfirmation && !persistenceState.serverConfirmed)) {
        persistPostCheckoutResumeState({
          productId,
          productName,
          productPrice,
          source: checkoutSource,
          sessionId,
          paypalOrderId,
        });
        scheduleDeferredCheckoutPersistence(async () => {
          const deferredResult = await persistCheckoutArtifacts(persistenceContext);
          const deferredState = getPersistenceState(deferredResult);
          if (!deferredResult) {
            return false;
          }
          if (needsServerConfirmation && !deferredState.serverConfirmed) {
            return false;
          }

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
          console.info('[PostCheckout] Compra confirmada tras sincronización diferida');
          showSuccessModalDeterministic(productId, productName);
          return true;
        });

        if (needsServerConfirmation) {
          console.warn(
            '[PostCheckout] Compra pagada pero pendiente de confirmación canónica en servidor'
          );
          if (typeof window.NotificationSystem?.info === 'function') {
            window.NotificationSystem.info(
              'Pago recibido. Estamos sincronizando tu compra para dejarla persistida.'
            );
          }
          return;
        }

        persistenceState = getPersistenceState(null);
      }

      const { profilePurchase, serverOrder } = persistenceState;
      if (profilePurchase || serverOrder) {
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
        profilePurchase?.name ||
        profilePurchase?.title ||
        productName ||
        'Producto';
      const resolvedProductPrice =
        parseFloat(serverOrder?.price) || parseFloat(profilePurchase?.price) || productPrice || 0;

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
  }

  return {
    applyPurchasedCartCleanup,
    scheduleAnnouncementOwnershipRetry,
    buildCheckoutRunKey,
    applyConfirmedPurchaseUiState,
    showSuccessModalDeterministic,
    trackGtmEvent,
    finalizeSuccessfulCheckout,
  };
}
