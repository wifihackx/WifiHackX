'use strict';

const debugLog = (...args) => {
  if (window.__WFX_DEBUG__ === true) {
    console.info(...args);
  }
};

function setupStripeCheckout() {

  // Fallback del logger
  const logSystem = window.Logger || {
    info: (m, c) => debugLog(`[${c}] ${m}`),
    warn: (m, c) => console.warn(`[${c}] ${m}`),
    error: (m, c, d) => console.error(`[${c}] ${m}`, d),
    debug: (m, c) => debugLog(`[DEBUG][${c}] ${m}`),
    startGroup: (_n, e) => console.group(`${e || ''} ${_n}`),
    endGroup: _n => console.groupEnd(),
  };
  const CAT = window.LOG_CATEGORIES || {
    PAYMENTS: 'PAY',
    INIT: 'INIT',
    ERR: 'ERR',
  };

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

  // Guard against duplicate loading
  if (window.isScriptLoaded && window.isScriptLoaded('stripe-checkout')) {
    logSystem.warn('stripe-checkout already loaded, skipping', CAT.PAYMENTS);
    return;
  }

  function getStripePublicKey() {
    const runtimeKeys =
      window.RuntimeConfigUtils &&
      typeof window.RuntimeConfigUtils.getPaymentsKeys === 'function'
        ? window.RuntimeConfigUtils.getPaymentsKeys()
        : null;
    const runtimeKey = runtimeKeys && runtimeKeys.stripePublicKey;
    if (typeof runtimeKey === 'string' && runtimeKey.trim()) {
      return runtimeKey.trim();
    }
    if (typeof window.STRIPE_PUBLIC_KEY === 'string' && window.STRIPE_PUBLIC_KEY.trim()) {
      return window.STRIPE_PUBLIC_KEY.trim();
    }
    return '';
  }

  // Inicializar Stripe de forma robusta
  let stripe = null;
  const isStripeConfigured = () => !!getStripePublicKey();
  const notifyPaymentIssue = (message, level = 'error') => {
    if (window.NotificationSystem && typeof window.NotificationSystem[level] === 'function') {
      window.NotificationSystem[level](message);
      return;
    }
    alert(message);
  };

  function initializeStripe() {
    if (window.stripe && !stripe) {
      stripe = window.stripe;
      return true;
    }
    if (window.Stripe && !stripe) {
      try {
        const stripePk = getStripePublicKey();
        if (!stripePk) {
          logSystem.error(
            'No hay STRIPE public key configurada (runtime/global)',
            CAT.PAYMENTS
          );
          return false;
        }
        stripe = Stripe(stripePk);
        logSystem.info('SDK inicializado correctamente', CAT.INIT);
        return true;
      } catch (error) {
        logSystem.error('Error al inicializar SDK', CAT.PAYMENTS, error);
        return false;
      }
    }
    return !!stripe;
  }

  async function ensureStripeSdk() {
    if (window.Stripe || window.stripe) return true;

    if (window.ensureStripeReady) {
      try {
        await window.ensureStripeReady();
        return !!window.Stripe || !!window.stripe;
      } catch (error) {
        logSystem.error('Error en ensureStripeReady', CAT.PAYMENTS, error);
      }
    }

    if (window.loadStripeSdk) {
      try {
        await window.loadStripeSdk();
        return !!window.Stripe;
      } catch (error) {
        logSystem.error('Error cargando Stripe SDK', CAT.PAYMENTS, error);
      }
    }

    // Fallback: inyectar SDK directamente
    try {
      if (typeof window.waitForNonce === 'function') {
        await window.waitForNonce();
      }

      await new Promise((resolve, reject) => {
        const existing = document.querySelector('script[data-stripe-sdk]');
        if (existing && window.Stripe) {
          resolve();
          return;
        }
        const script = document.createElement('script');
        script.src = 'https://js.stripe.com/v3';
        script.async = true;
        script.defer = true;
        script.setAttribute('data-stripe-sdk', 'true');
        const nonce = window.SECURITY_NONCE || window.NONCE;
        if (nonce) script.nonce = nonce;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('No se pudo cargar Stripe SDK'));
        document.head.appendChild(script);
      });

      return !!window.Stripe;
    } catch (error) {
      logSystem.error('Error cargando Stripe SDK (fallback)', CAT.PAYMENTS, error);
      return false;
    }
  }

  // Función global que será llamada desde el HTML del botón
  window.iniciarCompra = async function (btnElement) {
    logSystem.info('iniciarCompra llamada', CAT.PAYMENTS);

    if (!isStripeConfigured()) {
      notifyPaymentIssue(
        'Stripe no está configurado en este entorno. Configura payments.stripePublicKey para habilitar este método de pago.'
      );
      return;
    }

    // Verificar que Stripe esté inicializado
    const sdkReady = await ensureStripeSdk();
    if (!sdkReady || !initializeStripe()) {
      logSystem.error('SDK no disponible', CAT.PAYMENTS);
      notifyPaymentIssue(
        'Error: El sistema de pagos no está disponible. Por favor, recarga la página.'
      );
      return;
    }

    // CORRECCIÓN: Manejar si viene del evento click o del elemento directo
    let targetBtn = btnElement;
    if (btnElement instanceof Event) {
      targetBtn = btnElement.target.closest('[data-price-id]');
    }

    // Si no encontramos el botón, buscar en el carrito
    if (!targetBtn) {
      // Buscar el priceId del item del carrito
      const cartItem =
        window.CartManager &&
        window.CartManager.items &&
        window.CartManager.items[0];
      if (cartItem && cartItem.stripeId) {
        debugLog(
          '🔵 [Stripe] Usando stripeId del carrito:',
          cartItem.stripeId
        );
        // Crear un pseudo-elemento con el priceId
        targetBtn = {
          getAttribute: () => cartItem.stripeId,
        };
      } else {
        logSystem.error(
          'No se encontró botón ni item en carrito',
          CAT.PAYMENTS
        );
        return;
      }
    }

    const priceId =
      typeof targetBtn.getAttribute === 'function'
        ? targetBtn.getAttribute('data-price-id')
        : targetBtn;

    logSystem.debug(`Price ID: ${priceId}`, CAT.PAYMENTS);

    if (!priceId || priceId === 'undefined' || priceId === 'null') {
      notifyPaymentIssue(
        'Error: Este producto no tiene un ID de precio válido configurado.'
      );
      return;
    }

    const user = firebase.auth().currentUser;
    logSystem.debug(
      `Usuario: ${user ? user.uid : 'No autenticado'}`,
      CAT.PAYMENTS
    );

    if (!user) {
      if (window.showLoginView) window.showLoginView();
      else alert('⚠️ Debes iniciar sesión para comprar.');
      return;
    }

    // VERIFICAR EMAIL VERIFICADO
    if (!user.emailVerified) {
      logSystem.warn('Email no verificado, bloqueando compra', CAT.PAYMENTS);
      alert(
        '⚠️ Debes verificar tu email antes de realizar una compra.\n\n' +
          'Por favor revisa tu bandeja de entrada y haz clic en el enlace de verificación.'
      );
      // Ofrecer reenviar email
      if (confirm('¿Deseas que te reenviemos el email de verificación?')) {
        try {
          await user.sendEmailVerification();
          alert(
            '✅ Email de verificación reenviado. Revisa tu bandeja de entrada.'
          );
        } catch (emailError) {
          console.error('[Stripe] Error reenviando email:', emailError);
          alert('❌ Error al reenviar email. Intenta más tarde.');
        }
      }
      return;
    }

    // UI Loading
    let originalText = 'Comprar';
    if (targetBtn.innerHTML) {
      originalText = targetBtn.innerHTML;
      targetBtn.innerHTML = 'Procesando...';
      targetBtn.disabled = true;
    }

    // Obtener productId para la URL de éxito
    const productId =
      typeof targetBtn.getAttribute === 'function'
        ? targetBtn.getAttribute('data-product-id')
        : null;

    try {
      logSystem.info('Creando checkout_session...', CAT.PAYMENTS);

      // CRÍTICO: Actualizar ubicación del usuario ANTES de crear la sesión
      // Esto asegura que la IP esté guardada en Firestore cuando se procese el pago
      try {
        logSystem.debug('Actualizando ubicación del usuario...', CAT.PAYMENTS);
        const updateLocation = firebase
          .functions()
          .httpsCallable('updateUserLocation');
        await updateLocation();
        logSystem.debug('✅ Ubicación actualizada', CAT.PAYMENTS);
      } catch (locationError) {
        logSystem.warn(
          'No se pudo actualizar ubicación, continuando...',
          CAT.PAYMENTS,
          locationError
        );
        // No bloquear el checkout si falla
      }

      // Track checkout started (Analytics Avanzado)
      const productName = targetBtn.getAttribute
        ? targetBtn.getAttribute('data-product-name') || 'Producto'
        : 'Producto';
      const price = targetBtn.getAttribute
        ? parseFloat(targetBtn.getAttribute('data-price')) || 49.99
        : 49.99;

      if (window.enhancedAnalytics) {
        window.enhancedAnalytics.trackCheckoutStarted(
          productId || 'unknown',
          price,
          productName
        );
      }

      trackGtmEvent('checkout_started', {
        eventCategory: 'Ecommerce',
        eventLabel: productName,
        eventValue: price,
        value: price,
        currency: 'EUR',
        payment_method: 'stripe',
        items: [
          {
            item_id: productId || 'unknown',
            item_name: productName,
            price: price,
            quantity: 1,
          },
        ],
      });

      // Crear sesión con la extensión (usando colección standard 'customers')
      const successUrl =
        window.location.origin +
        '/?status=success' +
        (productId ? '&productId=' + productId : '') +
        '&session_id={CHECKOUT_SESSION_ID}';

      const docRef = await firebase
        .firestore()
        .collection('customers') // Cambiado de 'users' a 'customers' (default de la extensión)
        .doc(user.uid)
        .collection('checkout_sessions')
        .add({
          price: priceId,
          success_url: successUrl,
          cancel_url: window.location.origin + '/?status=cancel',
          mode: 'payment', // Modo para pagos únicos (one-time purchases)
          client_reference_id: productId || undefined,
          metadata: {
            productId: productId || '',
            userId: user.uid,
            userEmail: user.email || '',
            productTitle: productName,
            price: price,
          },
        });

      logSystem.debug(`Documento creado: ${docRef.id}`, CAT.PAYMENTS);
      logSystem.info('Esperando respuesta de la extensión...', CAT.PAYMENTS);

      // Timeout para evitar espera infinita
      const timeout = setTimeout(() => {
        logSystem.error(
          'Timeout - La extensión no respondió en 30 segundos',
          CAT.PAYMENTS
        );
        alert(
          'La sesión de pago está tardando demasiado. Verifica que la extensión de Stripe esté configurada correctamente.'
        );
        if (targetBtn.innerHTML) {
          targetBtn.innerHTML = originalText;
          targetBtn.disabled = false;
        }
      }, 30000);

      // Escuchar redirección
      docRef.onSnapshot(snap => {
        const data = snap.data();
        logSystem.debug('Snapshot recibido', CAT.PAYMENTS, data);

        if (!data) return;

        const { error, url, sessionId } = data;

        if (error) {
          clearTimeout(timeout);
          logSystem.error('Error de la extensión', CAT.PAYMENTS, error);

          // Enhanced error handling for specific Stripe errors
          let userMessage = `Error de Stripe: ${error.message || error}`;

          if (error.message && error.message.includes('inactive')) {
            userMessage = `❌ Error: El precio de este producto está inactivo en Stripe.

🔧 SOLUCIÓN PARA ADMINISTRADORES:
1. Ir al Dashboard de Stripe (https://dashboard.stripe.com/test/products)
2. Buscar el precio: ${priceId}
3. Cambiar el estado de "Inactive" a "Active"
4. O actualizar el producto con un precio activo

💡 ALTERNATIVA: Crear un nuevo precio activo y actualizar el stripeId del producto.`;

            logSystem.error('PRECIO INACTIVO', CAT.PAYMENTS, {
              priceId: priceId,
              solution: 'Activar precio en Dashboard de Stripe',
              dashboardUrl: 'https://dashboard.stripe.com/test/products',
            });
          } else if (error.message && error.message.includes('price')) {
            userMessage = `❌ Error: Problema con la configuración del precio.
            
🔧 Verifica que el precio ${priceId} existe y está activo en tu Dashboard de Stripe.`;
          } else if (error.message && error.message.includes('No such price')) {
            userMessage = `❌ Error: El precio ${priceId} no existe en Stripe.
            
🔧 SOLUCIÓN:
1. Verificar el ID del precio en el Dashboard de Stripe
2. Actualizar el producto con el ID correcto
3. O crear un nuevo precio si es necesario`;
          }

          alert(userMessage);
          if (targetBtn.innerHTML) {
            targetBtn.innerHTML = originalText;
            targetBtn.disabled = false;
          }
        }

        if (url) {
          clearTimeout(timeout);
          logSystem.info(
            'URL de checkout recibida, redirigiendo...',
            CAT.PAYMENTS
          );
          window.location.assign(url);
        }

        if (sessionId && !url) {
          logSystem.debug('SessionId recibido, esperando URL...', CAT.PAYMENTS);
        }
      });
    } catch (e) {
      logSystem.error('General checkout error', CAT.PAYMENTS, e);
      alert('Error de conexión con el servidor de pagos: ' + e.message);
      if (targetBtn.innerHTML) {
        targetBtn.innerHTML = originalText;
        targetBtn.disabled = false;
      }
    }
  };

  logSystem.info('stripe-checkout.js cargado', CAT.INIT);

  // Mark as loaded
  if (window.markScriptLoaded) {
    window.markScriptLoaded('stripe-checkout');
  }
}

function initStripeCheckout() {
  if (window.__STRIPE_CHECKOUT_INITED__) {
    return;
  }

  window.__STRIPE_CHECKOUT_INITED__ = true;
  setupStripeCheckout();
}

if (typeof window !== 'undefined' && !window.__STRIPE_CHECKOUT_NO_AUTO__) {
  initStripeCheckout();
}



