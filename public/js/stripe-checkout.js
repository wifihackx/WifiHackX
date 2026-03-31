'use strict';

const shouldSkipUserLocationUpdate = () => {
  const hostname = String(window.location?.hostname || '').toLowerCase();
  return hostname === 'localhost' || hostname === '127.0.0.1';
};

const debugLog = (...args) => {
  if (typeof window.__WFX_DEBUG_LOG__ === 'function') {
    window.__WFX_DEBUG_LOG__(...args);
    return;
  }
  if (window.__WIFIHACKX_DEBUG__ === true || window.__WFX_DEBUG__ === true) {
    console.info(...args);
  }
};

const STRIPE_OVERLAY_ID = 'stripeCheckoutOverlay';
const STRIPE_BUTTON_BUSY_CLASS = 'is-checkout-loading';
const STRIPE_OVERLAY_STYLE_ID = 'stripeCheckoutOverlayStyles';

function ensureStripeCheckoutStyles() {
  if (document.getElementById(STRIPE_OVERLAY_STYLE_ID)) {
    return;
  }

  const style = document.createElement('style');
  style.id = STRIPE_OVERLAY_STYLE_ID;
  style.textContent = `
    .stripe-checkout-overlay {
      position: fixed;
      inset: 0;
      z-index: 2147483647;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      background:
        radial-gradient(circle at top, rgba(46, 255, 181, 0.18), transparent 42%),
        rgba(4, 12, 10, 0.78);
      backdrop-filter: blur(18px);
      opacity: 0;
      visibility: hidden;
      pointer-events: none;
      transition: opacity 0.24s ease, visibility 0.24s ease;
    }
    .stripe-checkout-overlay.is-visible {
      opacity: 1;
      visibility: visible;
      pointer-events: auto;
    }
    .stripe-checkout-overlay__panel {
      width: min(92vw, 430px);
      padding: 34px 30px 30px;
      border-radius: 28px;
      text-align: center;
      background:
        linear-gradient(180deg, rgba(12, 34, 26, 0.96), rgba(5, 18, 14, 0.97)),
        rgba(8, 20, 17, 0.95);
      border: 1px solid rgba(74, 255, 198, 0.28);
      box-shadow:
        0 30px 80px rgba(0, 0, 0, 0.55),
        inset 0 1px 0 rgba(255, 255, 255, 0.06),
        0 0 0 1px rgba(74, 255, 198, 0.12);
    }
    .stripe-checkout-overlay__spinner {
      position: relative;
      width: 112px;
      height: 112px;
      margin: 0 auto 20px;
      display: grid;
      place-items: center;
    }
    .stripe-checkout-overlay__ring,
    .checkout-btn-spinner__ring {
      position: absolute;
      display: block;
      border-radius: 50%;
      box-sizing: border-box;
    }
    .stripe-checkout-overlay__ring {
      border: 3px solid rgba(255, 255, 255, 0.08);
    }
    .stripe-checkout-overlay__ring--outer {
      inset: 0;
      border-top-color: #86ffe1;
      border-right-color: #36ffb8;
      box-shadow: 0 0 28px rgba(54, 255, 184, 0.24);
    }
    .stripe-checkout-overlay__ring--mid {
      inset: 14px;
      border-color: rgba(255, 255, 255, 0.08);
      border-left-color: #f0fff9;
      border-bottom-color: rgba(54, 255, 184, 0.72);
    }
    .stripe-checkout-overlay__ring--inner {
      inset: 31px;
      border-color: rgba(255, 255, 255, 0.05);
      border-top-color: #cffff1;
      border-left-color: rgba(134, 255, 225, 0.96);
    }
    .stripe-checkout-overlay__eyebrow {
      margin: 0 0 8px;
      color: #77ffd7;
      font-size: 0.76rem;
      letter-spacing: 0.28em;
      text-transform: uppercase;
    }
    .stripe-checkout-overlay__title {
      margin: 0 0 10px;
      color: #f2fffb;
      font-size: clamp(1.4rem, 2vw, 1.75rem);
      font-weight: 700;
    }
    .stripe-checkout-overlay__text {
      margin: 0;
      color: rgba(220, 255, 246, 0.82);
      line-height: 1.6;
    }
    .is-checkout-loading {
      display: flex !important;
      align-items: center;
      justify-content: center;
      gap: 10px;
    }
    .checkout-btn-spinner {
      position: relative;
      width: 24px;
      height: 24px;
      flex: 0 0 24px;
      display: inline-block;
    }
    .checkout-btn-spinner__ring {
      border: 2px solid rgba(255, 255, 255, 0.18);
    }
    .checkout-btn-spinner__ring:first-child {
      inset: 0;
      border-top-color: #effff9;
      border-right-color: rgba(54, 255, 184, 0.95);
    }
    .checkout-btn-spinner__ring--accent {
      inset: 4px;
      border-color: rgba(54, 255, 184, 0.16);
      border-left-color: #79ffd8;
      border-bottom-color: rgba(214, 255, 244, 0.82);
    }
  `;
  document.head.appendChild(style);
}

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
  ensureStripeCheckoutStyles();

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
  document.body.classList.add('stripe-checkout-pending');
}

function hideStripeCheckoutOverlay() {
  const overlay = document.getElementById(STRIPE_OVERLAY_ID);
  if (!overlay) {
    return;
  }
  overlay.classList.remove('is-visible');
  overlay.setAttribute('aria-hidden', 'true');
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
    visualBtn.innerHTML = `
      <span class="checkout-btn-spinner" aria-hidden="true">
        <span class="checkout-btn-spinner__ring"></span>
        <span class="checkout-btn-spinner__ring checkout-btn-spinner__ring--accent"></span>
      </span>
      <span class="checkout-btn-label">Conectando con Stripe...</span>
    `;
    const rings = visualBtn.querySelectorAll('.checkout-btn-spinner__ring');
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
  }

  const overlay = document.getElementById(STRIPE_OVERLAY_ID);
  if (overlay instanceof HTMLElement) {
    overlay.querySelectorAll('.stripe-checkout-overlay__ring').forEach(stopSpinAnimation);
  }
  hideStripeCheckoutOverlay();
}

function setupStripeCheckout() {
  function resolveSafeRedirectUrl(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    try {
      const parsed = new URL(raw, window.location.origin);
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
        return '';
      }
      return parsed.href;
    } catch (_error) {
      return '';
    }
  }

  function getCheckoutErrorMessage(error, priceId = '') {
    const detailsMessage =
      typeof error?.details === 'string'
        ? error.details.trim()
        : typeof error?.details?.message === 'string'
          ? error.details.message.trim()
          : '';
    const rawMessage = String(detailsMessage || error?.message || '').trim();
    const rawCode = String(error?.code || '').trim().toLowerCase();
    const normalizedPriceId = String(priceId || '').trim();

    if (
      rawMessage.includes('STRIPE_SECRET_KEY') ||
      rawMessage.toLowerCase().includes('clave secreta') ||
      rawMessage.toLowerCase().includes('backend no configurado')
    ) {
      return 'Stripe backend no configurado. Falta STRIPE_SECRET_KEY en Firebase Functions.';
    }

    if (
      rawMessage.toLowerCase().includes('no existe o pertenece a otro modo') ||
      rawMessage.toLowerCase().includes('no such price') ||
      rawMessage.toLowerCase().includes('test/live')
    ) {
      return `El priceId de Stripe${normalizedPriceId ? ` (${normalizedPriceId})` : ''} no existe o está en un modo distinto (test/live).`;
    }

    if (rawMessage.toLowerCase().includes('inactivo')) {
      return `El priceId de Stripe${normalizedPriceId ? ` (${normalizedPriceId})` : ''} está inactivo.`;
    }

    if (rawCode.includes('failed-precondition') || rawCode.includes('invalid-argument')) {
      return rawMessage;
    }

    if (rawMessage && rawMessage.toLowerCase() !== 'internal') {
      return rawMessage.replace(/^internal\s*/i, '').trim() || rawMessage;
    }

    return 'Error interno creando la sesión de pago en Stripe.';
  }

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

  function resolveCheckoutPrice(targetBtn, productId) {
    const directPrice =
      targetBtn && typeof targetBtn.getAttribute === 'function'
        ? Number.parseFloat(targetBtn.getAttribute('data-price'))
        : NaN;
    if (Number.isFinite(directPrice) && directPrice > 0) {
      return directPrice;
    }

    const normalizedId = String(productId || '').trim();
    if (normalizedId && window.announcementSystem?.cache) {
      const announcement = window.announcementSystem.cache.get(normalizedId);
      const cachedPrice = Number.parseFloat(announcement?.price);
      if (Number.isFinite(cachedPrice) && cachedPrice > 0) {
        return cachedPrice;
      }
    }

    if (normalizedId && Array.isArray(window.CartManager?.items)) {
      const cartItem = window.CartManager.items.find(item => String(item?.id || '') === normalizedId);
      const cartPrice = Number.parseFloat(cartItem?.price);
      if (Number.isFinite(cartPrice) && cartPrice > 0) {
        return cartPrice;
      }
    }

    return 0;
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
      if (!shouldSkipUserLocationUpdate()) {
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
      }

      // Track checkout started (Analytics Avanzado)
      const productName = targetBtn.getAttribute
        ? targetBtn.getAttribute('data-product-name') || 'Producto'
        : 'Producto';
      const price = resolveCheckoutPrice(targetBtn, productId);
      if (!(Number.isFinite(price) && price > 0)) {
        throw new Error('No se pudo resolver el precio real del producto para iniciar checkout.');
      }
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

      // Crear sesión vía callable para evitar writes directos desde cliente.
      const createCheckoutSession = firebase.functions().httpsCallable('createCheckoutSession');
      const createResult = await createCheckoutSession({
        priceId,
        productId: productId || '',
        productTitle: productName,
        price,
      });
      const directCheckoutUrl = String(createResult?.data?.url || '').trim();
      const directSessionId = String(createResult?.data?.sessionId || '').trim();
      const sessionDocId = String(createResult?.data?.sessionDocId || '').trim();

      if (directCheckoutUrl) {
        const safeCheckoutUrl = resolveSafeRedirectUrl(directCheckoutUrl);
        if (!safeCheckoutUrl) {
          throw new Error('Se recibió una URL de checkout inválida.');
        }
        logSystem.info('URL de checkout recibida directamente, redirigiendo...', CAT.PAYMENTS);
        window.location.assign(safeCheckoutUrl);
        return;
      }

      if (!sessionDocId) {
        throw new Error('No se recibió URL ni sessionDocId para Stripe checkout.');
      }
      const docRef = firebase
        .firestore()
        .collection('customers')
        .doc(user.uid)
        .collection('checkout_sessions')
        .doc(sessionDocId);

      logSystem.debug(`Documento creado: ${docRef.id}`, CAT.PAYMENTS);
      logSystem.info('Esperando URL de checkout en fallback Firestore...', CAT.PAYMENTS);

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
          const safeCheckoutUrl = resolveSafeRedirectUrl(url);
          if (!safeCheckoutUrl) {
            clearTimeout(timeout);
            detachListener();
            clearStripeCheckoutUiBusy(targetBtn);
            alert('Se recibió una URL de checkout inválida.');
            return;
          }
          clearTimeout(timeout);
          detachListener();
          logSystem.info('URL de checkout recibida, redirigiendo...', CAT.PAYMENTS);
          window.location.assign(safeCheckoutUrl);
        }

        if ((sessionId || directSessionId) && !url) {
          logSystem.debug('SessionId recibido, esperando URL...', CAT.PAYMENTS);
        }
      });
    } catch (e) {
      logSystem.error('General checkout error', CAT.PAYMENTS, e);
      alert('Error de conexión con el servidor de pagos: ' + getCheckoutErrorMessage(e, priceId));
      clearStripeCheckoutUiBusy(targetBtn);
    }
  };

  logSystem.info('stripe-checkout.js cargado', CAT.INIT);

  // Mark as loaded
  if (window.markScriptLoaded) {
    window.markScriptLoaded('stripe-checkout');
  }

  window.StripeCheckout = Object.assign({}, window.StripeCheckout, {
    resolveSafeRedirectUrl,
  });
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
