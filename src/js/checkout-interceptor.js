/**
 * checkout-interceptor.js
 * Sistema centralizado para manejar mensajes de pago
 * Evita duplicados y maneja tanto Stripe como PayPal
 */
'use strict';

const debugLog = (...args) => {
  if (window.__WFX_DEBUG__ === true) {
      console.log(...args);
    }
};

function setupCheckoutInterceptor() {

  debugLog(
    '[CHECKOUT-INTERCEPTOR] Inicializando sistema centralizado de mensajes...'
  );

  // Flag global para evitar duplicados
  let paymentMessageShown = false;
  let paymentMessageTimeout = null;

  /**
   * Función centralizada para mostrar mensaje de pago
   * Se llama desde common-handlers.js y desde el listener de PayPal
   */
  window.showPaymentMessage = function () {
    // Si ya se mostró el mensaje, no hacer nada
    if (paymentMessageShown) {
      debugLog(
        '[CHECKOUT-INTERCEPTOR] Mensaje ya mostrado, ignorando duplicado'
      );
      return;
    }

    // Marcar como mostrado
    paymentMessageShown = true;
    debugLog('[CHECKOUT-INTERCEPTOR] Mostrando mensaje de pasarela segura');

    // Mostrar mensaje
    if (window.NotificationSystem) {
      window.NotificationSystem.info('Preparando pasarela de pago segura...');
    }

    // Limpiar timeout anterior si existe
    if (paymentMessageTimeout) {
      clearTimeout(paymentMessageTimeout);
    }

    // Resetear flag después de 3 segundos
    paymentMessageTimeout = setTimeout(() => {
      paymentMessageShown = false;
      debugLog('[CHECKOUT-INTERCEPTOR] Flag de mensaje reseteado');
    }, 3000);
  };

  /**
   * Sobrescribir la función checkout() global de bundle-app.min.js
   * para eliminar el mensaje "Tu carrito está vacío"
   */
  const _originalCheckout = window.checkout;

  window.checkout = function () {
    debugLog('[CHECKOUT-INTERCEPTOR] checkout() interceptado');

    // Verificar si el carrito está vacío
    const cartManager = window.CartManager;
    if (!cartManager || !cartManager.items || cartManager.items.length === 0) {
      debugLog(
        '[CHECKOUT-INTERCEPTOR] Carrito vacío, saliendo silenciosamente'
      );
      return; // Salir SIN mostrar mensaje
    }

    // NO mostrar mensaje aquí - se maneja en common-handlers.js
    debugLog('[CHECKOUT-INTERCEPTOR] Carrito tiene items, procesando...');

    // Llamar al checkout real de CartManager
    if (cartManager && typeof cartManager.checkout === 'function') {
      cartManager.checkout();
    }
  };

  /**
   * Interceptar clicks en el botón de PayPal
   * Usa múltiples estrategias para detectar clicks
   */
  function setupPayPalInterceptor() {
    const paypalContainer = document.getElementById('paypal-button-container');
    if (!paypalContainer) {
      debugLog(
        '[CHECKOUT-INTERCEPTOR] Contenedor PayPal no encontrado, reintentando...'
      );
      // Reintentar después de 500ms
      setTimeout(setupPayPalInterceptor, 500);
      return;
    }

    debugLog('[CHECKOUT-INTERCEPTOR] Configurando interceptor de PayPal');

    // Si ya tiene el listener, no agregarlo de nuevo
    if (paypalContainer.dataset.listenerAdded === 'true') {
      debugLog('[CHECKOUT-INTERCEPTOR] Listener de PayPal ya configurado');
      return;
    }

    // Marcar como configurado
    paypalContainer.dataset.listenerAdded = 'true';

    // Estrategia 1: Listener en mousedown (más confiable con iframes)
    paypalContainer.addEventListener(
      'mousedown',
      function (_e) {
        debugLog(
          '[CHECKOUT-INTERCEPTOR] Mousedown en contenedor PayPal detectado'
        );
        window.showPaymentMessage();
      },
      { capture: true }
    );

    // Estrategia 2: Listener en click (backup)
    paypalContainer.addEventListener(
      'click',
      function (_e) {
        debugLog(
          '[CHECKOUT-INTERCEPTOR] Click en contenedor PayPal detectado'
        );
        window.showPaymentMessage();
      },
      { capture: true }
    );

    // Estrategia 3: Listener en pointerdown (para touch devices)
    paypalContainer.addEventListener(
      'pointerdown',
      function (_e) {
        debugLog(
          '[CHECKOUT-INTERCEPTOR] Pointerdown en contenedor PayPal detectado'
        );
        window.showPaymentMessage();
      },
      { capture: true }
    );

    debugLog(
      '[CHECKOUT-INTERCEPTOR] Listeners de PayPal configurados (mousedown, click, pointerdown)'
    );
  }

  /**
   * Inicializar interceptores
   */
  function init() {
    debugLog('[CHECKOUT-INTERCEPTOR] Inicializando interceptores...');

    // Configurar interceptor de PayPal inmediatamente
    setupPayPalInterceptor();

    // Reintentar después de 1 segundo (por si el modal se abre después)
    setTimeout(setupPayPalInterceptor, 1000);

    // Reintentar después de 2 segundos (backup adicional)
    setTimeout(setupPayPalInterceptor, 2000);

    // También configurar cuando se abre el carrito
    document.addEventListener('click', function (e) {
      if (
        e.target.closest('[data-action="showCart"]') ||
        e.target.closest('.cart-btn')
      ) {
        debugLog(
          '[CHECKOUT-INTERCEPTOR] Carrito abierto, configurando interceptor PayPal...'
        );
        setTimeout(setupPayPalInterceptor, 500);
        setTimeout(setupPayPalInterceptor, 1500);
      }
    });

    // Observar cambios en el DOM para detectar cuando se renderiza el botón de PayPal
    const observer = new MutationObserver(function (mutations) {
      mutations.forEach(function (mutation) {
        if (mutation.addedNodes.length > 0) {
          const paypalContainer = document.getElementById(
            'paypal-button-container'
          );
          if (paypalContainer && !paypalContainer.dataset.listenerAdded) {
            debugLog(
              '[CHECKOUT-INTERCEPTOR] Botón PayPal detectado por MutationObserver'
            );
            setupPayPalInterceptor();
          }
        }
      });
    });

    // Observar el body completo
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    debugLog('[CHECKOUT-INTERCEPTOR] MutationObserver configurado');
  }

  // Ejecutar cuando el DOM esté listo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  debugLog('[CHECKOUT-INTERCEPTOR] Sistema centralizado listo');
  debugLog('[CHECKOUT-INTERCEPTOR] - checkout() global sobrescrito');
  debugLog(
    '[CHECKOUT-INTERCEPTOR] - showPaymentMessage() disponible globalmente'
  );
}

export function initCheckoutInterceptor() {
  if (window.__CHECKOUT_INTERCEPTOR_INITED__) {
    return;
  }

  window.__CHECKOUT_INTERCEPTOR_INITED__ = true;
  setupCheckoutInterceptor();
}

if (typeof window !== 'undefined' && !window.__CHECKOUT_INTERCEPTOR_NO_AUTO__) {
  initCheckoutInterceptor();
}
