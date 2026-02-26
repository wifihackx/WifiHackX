/**
 * checkout-interceptor.js
 * Sistema centralizado para mensajes de pago.
 * Solo añade el mensaje unificado y evita listeners duplicados.
 */
'use strict';

const debugLog = (...args) => {
  if (window.__WFX_DEBUG__ === true) {
    console.info(...args);
  }
};

function setupCheckoutInterceptor() {
  debugLog('[CHECKOUT-INTERCEPTOR] Inicializando sistema de mensajes');

  let paymentMessageShown = false;
  let paymentMessageTimeout = null;

  window.showPaymentMessage = function () {
    if (paymentMessageShown) {
      debugLog('[CHECKOUT-INTERCEPTOR] Mensaje ya mostrado, ignorando');
      return;
    }

    paymentMessageShown = true;
    debugLog('[CHECKOUT-INTERCEPTOR] Mostrando mensaje de pasarela');

    if (window.NotificationSystem) {
      window.NotificationSystem.info('Preparando pasarela de pago segura...');
    }

    if (paymentMessageTimeout) {
      clearTimeout(paymentMessageTimeout);
    }

    paymentMessageTimeout = setTimeout(() => {
      paymentMessageShown = false;
      debugLog('[CHECKOUT-INTERCEPTOR] Flag de mensaje reiniciado');
    }, 3000);
  };

  const onPayPalPointerDown = e => {
    const target = e.target instanceof Element ? e.target : null;
    if (!target) return;
    if (target.closest('#paypal-button-container')) {
      window.showPaymentMessage();
    }
  };

  document.addEventListener('pointerdown', onPayPalPointerDown, true);
  debugLog('[CHECKOUT-INTERCEPTOR] Listo: sin override de checkout global');
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
