'use strict';

const debugLog = (...args) => {
  if (window.__WFX_DEBUG__ === true) {
    console.info(...args);
  }
};

const STRIPE_OVERLAY_ID = 'stripeCheckoutOverlay';
const STRIPE_BUTTON_BUSY_CLASS = 'is-checkout-loading';

function startSpinAnimation(element, duration, direction = 'normal') {
  if (!(element instanceof HTMLElement)) {
    return;
  }

  if (Array.isArray(element.__wfxAnimations)) {
    element.__wfxAnimations.forEach(animation => animation.cancel());
  }

  if (typeof element.animate === 'function') {
    const animation = element.animate(
      [{ transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' }],
      {
        duration,
        iterations: Infinity,
        easing: 'linear',
        direction,
      }
    );
    element.__wfxAnimations = [animation];
  }
}

function stopSpinAnimation(element) {
  if (!(element instanceof HTMLElement) || !Array.isArray(element.__wfxAnimations)) {
    return;
  }
  element.__wfxAnimations.forEach(animation => animation.cancel());
  delete element.__wfxAnimations;
}

function getStripeCheckoutOverlayHost() {
  return (
    document.querySelector(
      'dialog.cart-modal[open], dialog[open], .cart-modal[open], .cart-modal.active'
    ) || document.body
  );
}

function getCheckoutVisualButton(targetBtn) {
  const cartCheckoutBtn = document.getElementById('checkoutBtn');
  if (cartCheckoutBtn instanceof HTMLElement) {
    return cartCheckoutBtn;
  }
  return targetBtn instanceof HTMLElement ? targetBtn : null;
}

function ensureStripeCheckoutOverlay() {
  let overlay = document.getElementById(STRIPE_OVERLAY_ID);
  if (overlay) {
    return overlay;
  }

  const topLayerHost = getStripeCheckoutOverlayHost();

  overlay = document.createElement('div');
  overlay.id = STRIPE_OVERLAY_ID;
  overlay.className = 'stripe-checkout-overlay';
  overlay.setAttribute('aria-hidden', 'true');
  overlay.innerHTML = `
    <div class="stripe-checkout-overlay__panel" role="status" aria-live="polite" aria-atomic="true">
      <div class="stripe-checkout-overlay__spinner" aria-hidden="true">
        <span class="stripe-checkout-overlay__ring stripe-checkout-overlay__ring--outer"></span>
        <span class="stripe-checkout-overlay__ring stripe-checkout-overlay__ring--mid"></span>
        <span class="stripe-checkout-overlay__ring stripe-checkout-overlay__ring--inner"></span>
      </div>
      <p class="stripe-checkout-overlay__eyebrow">Pago seguro</p>
      <h3 class="stripe-checkout-overlay__title">Conectando con Stripe</h3>
      <p class="stripe-checkout-overlay__text">Estamos preparando tu checkout cifrado.</p>
    </div>
  `;
  Object.assign(overlay.style, {
    position: 'fixed',
    inset: '0',
    zIndex: '2147483647',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
    background:
      'radial-gradient(circle at top, rgba(80, 228, 208, 0.16), transparent 44%), rgba(5, 10, 16, 0.76)',
    backdropFilter: 'blur(20px)',
    opacity: '0',
    visibility: 'hidden',
    pointerEvents: 'none',
    transition: 'opacity 0.24s ease, visibility 0.24s ease',
  });
  const panel = overlay.querySelector('.stripe-checkout-overlay__panel');
  const spinner = overlay.querySelector('.stripe-checkout-overlay__spinner');
  const rings = overlay.querySelectorAll('.stripe-checkout-overlay__ring');
  const eyebrow = overlay.querySelector('.stripe-checkout-overlay__eyebrow');
  const title = overlay.querySelector('.stripe-checkout-overlay__title');
  const text = overlay.querySelector('.stripe-checkout-overlay__text');
  if (panel instanceof HTMLElement) {
    Object.assign(panel.style, {
      width: 'min(92vw, 420px)',
      padding: '34px 30px 30px',
      borderRadius: '28px',
      textAlign: 'center',
      background:
        'linear-gradient(180deg, rgba(16, 29, 39, 0.94), rgba(7, 12, 18, 0.96)), rgba(10, 16, 24, 0.92)',
      border: '1px solid rgba(132, 255, 237, 0.22)',
      boxShadow:
        '0 28px 80px rgba(0, 0, 0, 0.55), inset 0 1px 0 rgba(255, 255, 255, 0.05), 0 0 0 1px rgba(80, 228, 208, 0.08)',
    });
  }
  if (spinner instanceof HTMLElement) {
    Object.assign(spinner.style, {
      position: 'relative',
      width: '112px',
      height: '112px',
      margin: '0 auto 20px',
      display: 'grid',
      placeItems: 'center',
    });
  }
  rings.forEach((ring, index) => {
    if (!(ring instanceof HTMLElement)) return;
    Object.assign(ring.style, {
      position: 'absolute',
      inset: index === 0 ? '0' : index === 1 ? '14px' : '31px',
      display: 'block',
      borderRadius: '50%',
      border: '3px solid rgba(255, 255, 255, 0.08)',
      boxSizing: 'border-box',
    });
  });
  if (rings[0] instanceof HTMLElement) {
    rings[0].style.borderTopColor = '#8ffff1';
    rings[0].style.borderRightColor = 'rgba(80, 228, 208, 0.86)';
    rings[0].style.boxShadow = '0 0 28px rgba(80, 228, 208, 0.24)';
  }
  if (rings[1] instanceof HTMLElement) {
    rings[1].style.borderColor = 'rgba(255, 255, 255, 0.07)';
    rings[1].style.borderLeftColor = '#ffffff';
    rings[1].style.borderBottomColor = 'rgba(80, 228, 208, 0.74)';
  }
  if (rings[2] instanceof HTMLElement) {
    rings[2].style.borderColor = 'rgba(255, 255, 255, 0.05)';
    rings[2].style.borderTopColor = '#d9fff8';
    rings[2].style.borderLeftColor = 'rgba(138, 255, 240, 0.92)';
  }
  if (eyebrow instanceof HTMLElement) {
    Object.assign(eyebrow.style, {
      margin: '0 0 8px',
      color: '#88f9e7',
      fontSize: '0.76rem',
      letterSpacing: '0.28em',
      textTransform: 'uppercase',
    });
  }
  if (title instanceof HTMLElement) {
    Object.assign(title.style, {
      margin: '0 0 10px',
      color: '#f5fffd',
      fontSize: 'clamp(1.4rem, 2vw, 1.75rem)',
      fontWeight: '700',
    });
  }
  if (text instanceof HTMLElement) {
    Object.assign(text.style, {
      margin: '0',
      color: 'rgba(222, 248, 244, 0.78)',
      lineHeight: '1.6',
    });
  }
  topLayerHost.appendChild(overlay);
  return overlay;
}

function showStripeCheckoutOverlay() {
  const overlay = ensureStripeCheckoutOverlay();
  const host = getStripeCheckoutOverlayHost();
  if (overlay.parentElement !== host) {
    host.appendChild(overlay);
  }
  overlay.classList.add('is-visible');
  overlay.setAttribute('aria-hidden', 'false');
  overlay.style.opacity = '1';
  overlay.style.visibility = 'visible';
  overlay.style.pointerEvents = 'auto';
  document.body.classList.add('stripe-checkout-pending');
}

function hideStripeCheckoutOverlay() {
  const overlay = document.getElementById(STRIPE_OVERLAY_ID);
  if (!overlay) {
    return;
  }
  overlay.classList.remove('is-visible');
  overlay.setAttribute('aria-hidden', 'true');
  overlay.style.opacity = '0';
  overlay.style.visibility = 'hidden';
  overlay.style.pointerEvents = 'none';
  document.body.classList.remove('stripe-checkout-pending');
}

function setStripeCheckoutUiBusy(targetBtn) {
  const visualBtn = getCheckoutVisualButton(targetBtn);

  if (visualBtn instanceof HTMLElement) {
    if (!visualBtn.dataset.checkoutOriginalHtml) {
      visualBtn.dataset.checkoutOriginalHtml = visualBtn.innerHTML;
      visualBtn.dataset.checkoutOriginalDisabled = visualBtn.disabled ? 'true' : 'false';
    }

    visualBtn.disabled = true;
    visualBtn.setAttribute('aria-busy', 'true');
    visualBtn.classList.add(STRIPE_BUTTON_BUSY_CLASS);
    visualBtn.style.display = 'flex';
    visualBtn.style.alignItems = 'center';
    visualBtn.style.justifyContent = 'center';
    visualBtn.style.gap = '10px';
    visualBtn.innerHTML = `
      <span class="checkout-btn-spinner" aria-hidden="true">
        <span class="checkout-btn-spinner__ring"></span>
        <span class="checkout-btn-spinner__ring checkout-btn-spinner__ring--accent"></span>
      </span>
      <span class="checkout-btn-label">Conectando con Stripe...</span>
    `;
    const spinner = visualBtn.querySelector('.checkout-btn-spinner');
    const rings = visualBtn.querySelectorAll('.checkout-btn-spinner__ring');
    if (spinner instanceof HTMLElement) {
      Object.assign(spinner.style, {
        position: 'relative',
        width: '24px',
        height: '24px',
        flex: '0 0 24px',
        display: 'inline-block',
      });
    }
    rings.forEach((ring, index) => {
      if (!(ring instanceof HTMLElement)) return;
      Object.assign(ring.style, {
        position: 'absolute',
        inset: index === 0 ? '0' : '4px',
        display: 'block',
        borderRadius: '50%',
        boxSizing: 'border-box',
        border: '2px solid rgba(255, 255, 255, 0.18)',
      });
    });
    if (rings[0] instanceof HTMLElement) {
      rings[0].style.borderTopColor = '#ecfffb';
      rings[0].style.borderRightColor = 'rgba(80, 228, 208, 0.95)';
    }
    if (rings[1] instanceof HTMLElement) {
      rings[1].style.borderColor = 'rgba(80, 228, 208, 0.14)';
      rings[1].style.borderLeftColor = '#7ffff0';
      rings[1].style.borderBottomColor = 'rgba(214, 255, 248, 0.82)';
    }
    if (rings[0] instanceof HTMLElement) {
      startSpinAnimation(rings[0], 780);
    }
    if (rings[1] instanceof HTMLElement) {
      startSpinAnimation(rings[1], 1200, 'reverse');
    }
  }

  showStripeCheckoutOverlay();
  const overlay = document.getElementById(STRIPE_OVERLAY_ID);
  if (overlay instanceof HTMLElement) {
    const overlayRings = overlay.querySelectorAll('.stripe-checkout-overlay__ring');
    if (overlayRings[0] instanceof HTMLElement) {
      startSpinAnimation(overlayRings[0], 1450);
    }
    if (overlayRings[1] instanceof HTMLElement) {
      startSpinAnimation(overlayRings[1], 1100, 'reverse');
    }
    if (overlayRings[2] instanceof HTMLElement) {
      startSpinAnimation(overlayRings[2], 820);
    }
  }
}

function clearStripeCheckoutUiBusy(targetBtn) {
  const visualBtn = getCheckoutVisualButton(targetBtn);

  if (visualBtn instanceof HTMLElement) {
    visualBtn.querySelectorAll('.checkout-btn-spinner__ring').forEach(stopSpinAnimation);
    if (typeof visualBtn.dataset.checkoutOriginalHtml === 'string') {
      visualBtn.innerHTML = visualBtn.dataset.checkoutOriginalHtml;
      const wasDisabled = visualBtn.dataset.checkoutOriginalDisabled === 'true';
      visualBtn.disabled = wasDisabled;
      delete visualBtn.dataset.checkoutOriginalHtml;
      delete visualBtn.dataset.checkoutOriginalDisabled;
    } else {
      visualBtn.disabled = false;
    }

    visualBtn.removeAttribute('aria-busy');
    visualBtn.classList.remove(STRIPE_BUTTON_BUSY_CLASS);
    visualBtn.style.removeProperty('display');
    visualBtn.style.removeProperty('align-items');
    visualBtn.style.removeProperty('justify-content');
    visualBtn.style.removeProperty('gap');
  }

  const overlay = document.getElementById(STRIPE_OVERLAY_ID);
  if (overlay instanceof HTMLElement) {
    overlay.querySelectorAll('.stripe-checkout-overlay__ring').forEach(stopSpinAnimation);
  }
  hideStripeCheckoutOverlay();
}

function setupStripeCheckout() {
  function persistPendingCheckoutContext(productId, productName, price) {
    try {
      if (typeof sessionStorage === 'undefined') return;
      const payload = {
        productId: typeof productId === 'string' ? productId : '',
        productName: typeof productName === 'string' ? productName : '',
        price: Number.isFinite(Number(price)) ? Number(price) : 0,
        ts: Date.now(),
      };
      sessionStorage.setItem('wfx:pending-checkout', JSON.stringify(payload));
    } catch (_e) {}
  }

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
      window.RuntimeConfigUtils && typeof window.RuntimeConfigUtils.getPaymentsKeys === 'function'
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
  window.setStripeCheckoutUiBusy = setStripeCheckoutUiBusy;
  window.clearStripeCheckoutUiBusy = clearStripeCheckoutUiBusy;

  function initializeStripe() {
    if (window.stripe && !stripe) {
      stripe = window.stripe;
      return true;
    }
    if (window.Stripe && !stripe) {
      try {
        const stripePk = getStripePublicKey();
        if (!stripePk) {
          logSystem.error('No hay STRIPE public key configurada (runtime/global)', CAT.PAYMENTS);
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
      clearStripeCheckoutUiBusy(btnElement);
      notifyPaymentIssue(
        'Stripe no está configurado en este entorno. Configura payments.stripePublicKey para habilitar este método de pago.'
      );
      return;
    }

    // Verificar que Stripe esté inicializado
    const sdkReady = await ensureStripeSdk();
    if (!sdkReady || !initializeStripe()) {
      logSystem.error('SDK no disponible', CAT.PAYMENTS);
      clearStripeCheckoutUiBusy(btnElement);
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
        window.CartManager && window.CartManager.items && window.CartManager.items[0];
      if (cartItem && cartItem.stripeId) {
        debugLog('🔵 [Stripe] Usando stripeId del carrito:', cartItem.stripeId);
        // Crear un pseudo-elemento con el priceId
        targetBtn = {
          getAttribute: () => cartItem.stripeId,
        };
      } else {
        logSystem.error('No se encontró botón ni item en carrito', CAT.PAYMENTS);
        clearStripeCheckoutUiBusy(btnElement);
        return;
      }
    }

    const priceId =
      typeof targetBtn.getAttribute === 'function'
        ? targetBtn.getAttribute('data-price-id')
        : targetBtn;

    logSystem.debug(`Price ID: ${priceId}`, CAT.PAYMENTS);

    if (!priceId || priceId === 'undefined' || priceId === 'null') {
      clearStripeCheckoutUiBusy(targetBtn);
      notifyPaymentIssue('Error: Este producto no tiene un ID de precio válido configurado.');
      return;
    }

    const user = firebase.auth().currentUser;
    logSystem.debug(`Usuario: ${user ? user.uid : 'No autenticado'}`, CAT.PAYMENTS);

    if (!user) {
      clearStripeCheckoutUiBusy(targetBtn);
      if (window.showLoginView) window.showLoginView();
      else alert('⚠️ Debes iniciar sesión para comprar.');
      return;
    }

    // VERIFICAR EMAIL VERIFICADO
    if (!user.emailVerified) {
      logSystem.warn('Email no verificado, bloqueando compra', CAT.PAYMENTS);
      clearStripeCheckoutUiBusy(targetBtn);
      alert(
        '⚠️ Debes verificar tu email antes de realizar una compra.\n\n' +
          'Por favor revisa tu bandeja de entrada y haz clic en el enlace de verificación.'
      );
      // Ofrecer reenviar email
      if (confirm('¿Deseas que te reenviemos el email de verificación?')) {
        try {
          await user.sendEmailVerification();
          alert('✅ Email de verificación reenviado. Revisa tu bandeja de entrada.');
        } catch (emailError) {
          console.error('[Stripe] Error reenviando email:', emailError);
          alert('❌ Error al reenviar email. Intenta más tarde.');
        }
      }
      return;
    }

    // UI Loading
    setStripeCheckoutUiBusy(targetBtn);

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
        const updateLocation = firebase.functions().httpsCallable('updateUserLocation');
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
      persistPendingCheckoutContext(productId || '', productName, price);

      if (window.enhancedAnalytics) {
        window.enhancedAnalytics.trackCheckoutStarted(productId || 'unknown', price, productName);
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
      let detached = false;
      let unsubscribe = () => {};
      const detachListener = () => {
        if (detached) return;
        detached = true;
        unsubscribe();
      };

      const timeout = setTimeout(() => {
        logSystem.error('Timeout - La extensión no respondió en 30 segundos', CAT.PAYMENTS);
        detachListener();
        alert(
          'La sesión de pago está tardando demasiado. Verifica que la extensión de Stripe esté configurada correctamente.'
        );
        clearStripeCheckoutUiBusy(targetBtn);
      }, 30000);

      // Escuchar redirección
      unsubscribe = docRef.onSnapshot(snap => {
        const data = snap.data();
        logSystem.debug('Snapshot recibido', CAT.PAYMENTS, data);

        if (!data) return;

        const { error, url, sessionId } = data;

        if (error) {
          clearTimeout(timeout);
          detachListener();
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
          clearStripeCheckoutUiBusy(targetBtn);
        }

        if (url) {
          clearTimeout(timeout);
          detachListener();
          logSystem.info('URL de checkout recibida, redirigiendo...', CAT.PAYMENTS);
          window.location.assign(url);
        }

        if (sessionId && !url) {
          logSystem.debug('SessionId recibido, esperando URL...', CAT.PAYMENTS);
        }
      });
    } catch (e) {
      logSystem.error('General checkout error', CAT.PAYMENTS, e);
      alert('Error de conexión con el servidor de pagos: ' + e.message);
      clearStripeCheckoutUiBusy(targetBtn);
    }
  };

  logSystem.info('stripe-checkout.js cargado', CAT.INIT);

  // Mark as loaded
  if (window.markScriptLoaded) {
    window.markScriptLoaded('stripe-checkout');
  }
}

export function initStripeCheckout() {
  if (window.__STRIPE_CHECKOUT_INITED__) {
    return;
  }

  window.__STRIPE_CHECKOUT_INITED__ = true;
  setupStripeCheckout();
}

if (typeof window !== 'undefined' && !window.__STRIPE_CHECKOUT_NO_AUTO__) {
  initStripeCheckout();
}
