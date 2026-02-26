/**
 * post-checkout-handler.js
 * Maneja la actualización de la UI después de un pago exitoso de Stripe.
 * Versión: 2.1.0 - Modal de confirmación de compra
 */
'use strict';

function setupPostCheckoutHandler() {
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

  function buildCheckoutRunKey(status, productId, sessionId, source) {
    return [status || '', productId || '', sessionId || '', source || ''].join('|');
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

  async function handlePostCheckout() {
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

        if (shouldVerifyStripe) {
          await waitForAuth(15000);
          verifiedData = await verifyCheckoutSessionWithRetry(sessionId, productId || undefined, 3);
          if (!verifiedData) {
            const isLocalHost =
              window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
            if (!isLocalHost) {
              console.error('[PostCheckout] ❌ Verificación de sesión fallida');
              if (window.NotificationSystem) {
                window.NotificationSystem.error(
                  'No se pudo verificar la compra. Contacta soporte.'
                );
              }
              return;
            }
            console.warn(
              '[PostCheckout] ⚠️ Verificación Stripe omitida en localhost para flujo de pruebas'
            );
          }
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

        // Limpiar carrito del producto comprado (evitar doble compra)
        try {
          if (window.CartManager) {
            const cartItems = Array.isArray(window.CartManager.items)
              ? window.CartManager.items
              : [];
            const wasInCart = cartItems.some(item => String(item.id) === String(productId));
            if (typeof window.CartManager.removeItem === 'function') {
              window.CartManager.removeItem(productId);
            } else if (typeof window.CartManager.clear === 'function') {
              window.CartManager.clear();
            }
            if (wasInCart && window.NotificationSystem) {
              window.NotificationSystem.info('Carrito actualizado: artículo comprado eliminado');
            }
          }
        } catch (cartError) {
          console.warn('[PostCheckout] Error no bloqueante limpiando carrito:', cartError);
        }

        const productData = await registerPurchaseInFirestore(productId, {
          source: source || (isStripeFlow ? 'stripe' : 'checkout'),
          sessionId: String(sessionId || '').trim(),
          paypalOrderId: firstNonEmptyString([
            paypalOrderIdFromUrl,
            pendingCheckout?.paypalOrderId,
          ]),
          amount: Number(pendingCheckout?.price || pendingCheckout?.amount || 0),
        });

        if (
          window.announcementSystem &&
          typeof window.announcementSystem.markAsOwnedLocally === 'function'
        ) {
          window.announcementSystem.markAsOwnedLocally(productId);
        } else {
          console.warn(
            '[PostCheckout] AnnouncementSystem no disponible para markAsOwnedLocally, usando fallback manual'
          );
          const buttons = document.querySelectorAll(`[data-product-id="${productId}"]`);
          buttons.forEach(button => {
            button.textContent = 'Descargar';
            button.setAttribute('data-action', 'secureDownload');
            button.classList.add('download-ready');
          });
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

        const newUrl = window.location.origin + window.location.pathname;
        window.history.replaceState({}, document.title, newUrl);

        let productName = 'Producto';
        let productPrice = 0;

        if (verifiedData) {
          productName = verifiedData.productTitle || productName;
          productPrice = parseFloat(verifiedData.price) || 0;
        } else if (productData) {
          productName = productData.name || productData.title || 'Producto';
          productPrice = parseFloat(productData.price) || 0;
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

        const paypalOrderId = firstNonEmptyString([
          paypalOrderIdFromUrl,
          pendingCheckout?.paypalOrderId,
        ]);
        const resolvedSource = source || (isStripeFlow ? 'stripe' : '');
        const serverOrder = await syncOrderRecordFromCheckout({
          productId,
          source: resolvedSource,
          sessionId,
          paypalOrderId,
          amount: productPrice || pendingCheckout?.price || 0,
        });
        if (serverOrder) {
          productName = serverOrder.productTitle || productName;
          productPrice = parseFloat(serverOrder.price) || productPrice;
        }

        if (window.enhancedAnalytics) {
          window.enhancedAnalytics.trackPurchaseCompleted(
            productId,
            productPrice,
            productId,
            productName
          );
        }

        trackGtmEvent('purchase_completed', {
          eventCategory: 'Ecommerce',
          eventLabel: productName,
          eventValue: productPrice,
          transaction_id: sessionId || `${source || 'checkout'}-${productId || 'unknown'}`,
          value: productPrice,
          currency: 'EUR',
          payment_method: isStripeFlow ? 'stripe' : source || 'checkout',
          items: [
            {
              item_id: productId || 'unknown',
              item_name: productName,
              price: productPrice,
              quantity: 1,
            },
          ],
        });

        console.info('[PostCheckout] Lanzando modal de compra exitosa');
        showSuccessModalDeterministic(productId, productName);
        clearPendingCheckoutContext();
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
  async function verifyCheckoutSession(sessionId, productId) {
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

      const ready = await waitForFirebaseFunctions(12000);
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

  async function verifyCheckoutSessionWithRetry(sessionId, productId, attempts = 2) {
    for (let i = 1; i <= attempts; i++) {
      const data = await verifyCheckoutSession(sessionId, productId);
      if (data && !data.__errorCode) return data;
      if (
        data &&
        (data.__errorCode.includes('not-found') || data.__errorCode.includes('permission-denied'))
      ) {
        return null;
      }
      if (i < attempts) {
        await new Promise(resolve => setTimeout(resolve, 2000 * i));
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
    return new Promise(resolve => {
      let done = false;
      const finish = ok => {
        if (done) return;
        done = true;
        window.removeEventListener('firebase:initialized', handler);
        window.removeEventListener('firebaseReady', handler);
        clearTimeout(timer);
        resolve(ok);
      };
      const handler = () => {
        if (hasFirebaseFunctions()) finish(true);
      };
      const timer = setTimeout(() => finish(hasFirebaseFunctions()), timeoutMs);
      window.addEventListener('firebase:initialized', handler, { once: true });
      window.addEventListener('firebaseReady', handler, { once: true });
    });
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
   * Registra la compra en Firestore (fallback cliente)
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

      // Persistencia de resiliencia para UI: mantiene acceso tras refresh cuando
      // el webhook todavía no ha sincronizado (o en flujos locales de prueba).
      const fallbackAmount = Number(context.amount ?? productData.price ?? productData.amount ?? 0);
      await persistPurchaseInUserProfile(productId, {
        amount: Number.isFinite(fallbackAmount) ? fallbackAmount : 0,
        source: context.source || 'checkout',
        productTitle: String(productData.name || productData.title || 'Producto').trim(),
      });

      // Fallback de datos para dashboard/modal:
      // escribe users/{uid}/purchases/{productId} aunque falle la sync server->orders.
      if (user?.uid) {
        const normalizedSource = String(context.source || 'checkout')
          .trim()
          .toLowerCase();
        const sessionDocId = String(context.sessionId || '').trim();
        const paypalDocId = String(context.paypalOrderId || '').trim();
        const fallbackDocId = `local_${Date.now()}_${String(productId || 'product')}`.replace(
          /[^a-zA-Z0-9_-]/g,
          '_'
        );
        const purchaseDocId = sessionDocId || paypalDocId || fallbackDocId;
        const rawAmount = Number(context.amount ?? productData.price ?? productData.amount ?? 0);
        const safeAmount = Number.isFinite(rawAmount) ? rawAmount : 0;
        const purchasePayload = {
          userId: user.uid,
          userEmail: String(user.email || '').trim(),
          productId: String(productId),
          productTitle: String(productData.name || productData.title || 'Producto').trim(),
          price: safeAmount,
          amount: safeAmount,
          currency: 'EUR',
          status: 'completed',
          source: normalizedSource,
          paymentMethod: normalizedSource,
          provider: normalizedSource,
          sessionId: String(context.sessionId || '').trim() || null,
          paypalOrderId: String(context.paypalOrderId || '').trim() || null,
          purchasedAt: fieldValue?.serverTimestamp ? fieldValue.serverTimestamp() : new Date(),
          updatedAt: fieldValue?.serverTimestamp ? fieldValue.serverTimestamp() : new Date(),
        };

        try {
          await db
            .collection('users')
            .doc(user.uid)
            .collection('purchases')
            .doc(purchaseDocId)
            .set(purchasePayload, { merge: true });
        } catch (subWriteError) {
          console.warn(
            '[PostCheckout] Escritura users/{uid}/purchases bloqueada por reglas, se conserva fallback en users.purchases[]',
            subWriteError
          );
        }
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
