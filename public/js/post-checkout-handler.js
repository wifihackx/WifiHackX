/**
 * post-checkout-handler.js
 * Maneja la actualización de la UI después de un pago exitoso de Stripe.
 * Versión: 2.1.0 - Modal de confirmación de compra
 */
'use strict';

function setupPostCheckoutHandler() {
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

  async function handlePostCheckout() {
    const urlParams = new URLSearchParams(window.location.search);
    const status = urlParams.get('status');
    const productId = urlParams.get('productId');
    const sessionId = urlParams.get('session_id');
    const source = (urlParams.get('source') || '').toLowerCase();
    const isStripeSessionId = id =>
      typeof id === 'string' &&
      (id.startsWith('cs_test_') || id.startsWith('cs_live_'));
    const isStripeFlow =
      source === 'stripe' ||
      (!!sessionId && isStripeSessionId(sessionId));

    if (status === 'success' && productId) {

      // 1. Notificación inmediata (comentada porque ahora usamos modal)
      // if (window.NotificationSystem) {
      //   window.NotificationSystem.success(
      //     '¡Pago completado con éxito! Tu descarga está lista.'
      //   );
      // }

      // 2. Verificar sesión de Stripe si existe (post-checkout seguro)
      let verifiedData = null;
      const shouldVerifyStripe =
        isStripeFlow && source !== 'paypal' && isStripeSessionId(sessionId);

      if (shouldVerifyStripe) {
        await waitForAuth(15000);
        verifiedData = await verifyCheckoutSessionWithRetry(
          sessionId,
          productId,
          3
        );
        if (!verifiedData) {
          const isLocalHost =
            window.location.hostname === 'localhost' ||
            window.location.hostname === '127.0.0.1';
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

      // 2.1 Limpiar carrito del producto comprado (evitar doble compra)
      // Defensivo: no permitir que errores de PayPal/carrito rompan el flujo.
      try {
        if (window.CartManager) {
          const cartItems = Array.isArray(window.CartManager.items)
            ? window.CartManager.items
            : [];
          const wasInCart = cartItems.some(
            item => String(item.id) === String(productId)
          );
          if (typeof window.CartManager.removeItem === 'function') {
            window.CartManager.removeItem(productId);
          } else if (typeof window.CartManager.clear === 'function') {
            window.CartManager.clear();
          }
          if (wasInCart && window.NotificationSystem) {
            window.NotificationSystem.info(
              'Carrito actualizado: artículo comprado eliminado'
            );
          }
        }
      } catch (cartError) {
        console.warn('[PostCheckout] Error no bloqueante limpiando carrito:', cartError);
      }

      // 3. Obtener datos del producto (solo para UI)
      const productData = await registerPurchaseInFirestore(productId);

      // 4. Lógica Senior: Usar el sistema de anuncios para persistencia y sincronización
      if (
        window.announcementSystem &&
        typeof window.announcementSystem.markAsOwnedLocally === 'function'
      ) {
        window.announcementSystem.markAsOwnedLocally(productId);
      } else {
        // Fallback manual si el sistema aún no está listo
        console.warn(
          '[PostCheckout] AnnouncementSystem no disponible para markAsOwnedLocally, usando fallback manual'
        );
        const buttons = document.querySelectorAll(
          `[data-product-id="${productId}"]`
        );
        buttons.forEach(button => {
          button.textContent = 'Descargar';
          button.setAttribute('data-action', 'secureDownload');
          button.classList.add('download-ready');
        });
      }

      // 4.1 Deshabilitar botones de compra para evitar dobles compras
      const purchaseButtons = document.querySelectorAll(
        `[data-product-id="${productId}"][data-action="buyNowAnnouncement"],[data-product-id="${productId}"][data-action="addToCartAnnouncement"]`
      );
      purchaseButtons.forEach(btn => {
        btn.classList.add('is-disabled');
        btn.setAttribute('disabled', 'true');
        btn.setAttribute('aria-disabled', 'true');
      });

      // 5. Registrar la compra en el sistema de descargas (48 horas + 3 descargas)
      // IMPORTANTE: Esto debe ir DESPUÉS de markAsOwnedLocally para que el DOM esté actualizado
      if (window.UltimateDownloadManager) {
        window.UltimateDownloadManager.registerPurchase(productId);
      }

      // 6. Limpiar la URL para evitar procesamientos duplicados al recargar
      const newUrl = window.location.origin + window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);

      // 7. Mostrar modal de confirmación de compra (después de que todo esté listo)
      // Obtener nombre del producto desde Firestore o AnnouncementSystem
      let productName = 'Producto';
      let productPrice = 0;

      if (verifiedData) {
        productName = verifiedData.productTitle || productName;
        productPrice = parseFloat(verifiedData.price) || 0;
      } else if (productData) {
        productName = productData.name || productData.title || 'Producto';
        productPrice = parseFloat(productData.price) || 0;
      } else if (window.announcementSystem && window.announcementSystem.cache) {
        const cachedProduct = window.announcementSystem.cache.get(productId);
        if (cachedProduct) {
          productName = cachedProduct.name || cachedProduct.title || 'Producto';
          productPrice = parseFloat(cachedProduct.price) || 0;
        }
      }

      // Track purchase completed (Analytics Avanzado)
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

      if (window.showPurchaseSuccessModal) {
        console.info('[PostCheckout] Lanzando modal de compra exitosa');
        // Esperar un momento para que el DOM se actualice
        setTimeout(() => {
          try {
            window.showPurchaseSuccessModal(productId, productName);
          } catch (modalError) {
            console.error('[PostCheckout] Error al abrir modal (reintento):', modalError);
            try {
              window.showPurchaseSuccessModal(productId, productName);
            } catch (_e) {}
          }
        }, 800);
      } else {
        console.error(
          '[PostCheckout] ❌ showPurchaseSuccessModal no está disponible'
        );
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

      const result = await verify({
        sessionId: sessionId,
        productId: productId,
      });

      if (!result.data || !result.data.success) {
        console.warn(
          '[PostCheckout] Respuesta sin éxito:',
          result?.data || null
        );
        return null;
      }

      return result.data;
    } catch (error) {
      const code = error && (error.code || error?.details?.code);
      const message =
        error && (error.message || error?.details?.message || 'Error');
      console.error(
        '[PostCheckout] ❌ Error verificando sesión de Stripe:',
        { code, message, error }
      );
      return { __errorCode: String(code || '') };
    }
  }

  async function verifyCheckoutSessionWithRetry(
    sessionId,
    productId,
    attempts = 2
  ) {
    for (let i = 1; i <= attempts; i++) {
      const data = await verifyCheckoutSession(sessionId, productId);
      if (data && !data.__errorCode) return data;
      if (data && (data.__errorCode.includes('not-found') || data.__errorCode.includes('permission-denied'))) {
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

  async function persistPurchaseInUserProfile(productId) {
    try {
      if (
        !window.firebase ||
        !window.firebase.firestore ||
        !window.firebase.auth
      ) {
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

      if (fieldValue?.arrayUnion && fieldValue?.serverTimestamp) {
        await userDocRef.set(
          {
            purchases: fieldValue.arrayUnion(String(productId)),
            updatedAt: fieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      } else {
        const snap = await userDocRef.get();
        const existing = snap.exists ? snap.data() || {} : {};
        const purchases = Array.isArray(existing.purchases)
          ? existing.purchases.map(String)
          : [];
        if (!purchases.includes(String(productId))) {
          purchases.push(String(productId));
        }
        await userDocRef.set({ purchases }, { merge: true });
      }

      return true;
    } catch (error) {
      console.warn(
        '[PostCheckout] No se pudo persistir compra en perfil de usuario',
        error
      );
      return false;
    }
  }

  /**
   * Registra la compra en Firestore (colección orders y actualiza usuario)
   * @param {string} productId - ID del producto comprado
   * @returns {Promise<Object|null>} - Datos del producto o null si hay error
   */
  async function registerPurchaseInFirestore(productId) {
    try {
      // Verificar que Firebase esté disponible
      if (
        !window.firebase ||
        !window.firebase.firestore ||
        !window.firebase.auth
      ) {
        console.error('[PostCheckout] Firebase no disponible');
        return null;
      }

      const db = window.firebase.firestore();

      // Obtener información del producto
      const productDoc = await db
        .collection('announcements')
        .doc(productId)
        .get();
      if (!productDoc.exists) {
        console.error('[PostCheckout] Producto no encontrado:', productId);
        return null;
      }

      const productData = productDoc.data();

      // Persistencia de resiliencia para UI: mantiene acceso tras refresh cuando
      // el webhook todavía no ha sincronizado (o en flujos locales de prueba).
      await persistPurchaseInUserProfile(productId);

      // Retornar datos del producto para el modal
      return productData;
    } catch (error) {
      console.error(
        '[PostCheckout] ❌ Error registrando compra en Firestore:',
        error
      );
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


