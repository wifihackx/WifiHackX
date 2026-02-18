/**
 * paypal-loader.js - Carga Dinámica y Segura de PayPal SDK
 *
 * Este script carga el PayPal SDK de forma dinámica usando el
 * client-id obtenido desde la Cloud Function, evitando exponer
 * credenciales en el HTML.
 *
 * IMPORTANTE: Este script debe cargarse DESPUÉS de nonce-init.js
 */

'use strict';

const debugLog = (...args) => {
  if (window.__WFX_DEBUG__ === true) {
    console.info(...args);
  }
};

async function setupPayPalLoader() {

  debugLog('[PAYPAL-LOADER] Iniciando carga de PayPal SDK...');

  try {
    // 1. Esperar a que el nonce esté listo
    if (typeof window.waitForNonce === 'function') {
      await window.waitForNonce();
    } else {
      console.warn(
        '[PAYPAL-LOADER] waitForNonce no disponible, esperando 2 segundos...'
      );
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // 2. Verificar que tenemos el client-id
    if (!window.PAYPAL_CLIENT_ID) {
      throw new Error('PayPal Client ID no disponible');
    }

    debugLog('[PAYPAL-LOADER] ✅ Client ID obtenido');

    // 3. Verificar si PayPal ya está cargado
    if (window.paypal) {
      debugLog('[PAYPAL-LOADER] ⚠️ PayPal SDK ya está cargado');
      return;
    }

    // 4. Crear script tag dinámicamente
    const script = document.createElement('script');
    script.src = `https://www.paypal.com/sdk/js?client-id=${window.PAYPAL_CLIENT_ID}&currency=EUR`;
    script.async = true;

    // Agregar nonce si está disponible
    if (window.SECURITY_NONCE) {
      script.setAttribute('nonce', window.SECURITY_NONCE);
    }

    // 5. Manejar carga exitosa
    script.onload = () => {
      debugLog('[PAYPAL-LOADER] ✅ PayPal SDK cargado exitosamente');
      window.PAYPAL_READY = true;

      // Disparar evento para que otros scripts sepan que PayPal está listo
      window.dispatchEvent(
        new CustomEvent('paypal-ready', {
          detail: {
            timestamp: new Date().toISOString(),
          },
        })
      );
    };

    // 6. Manejar errores de carga
    script.onerror = error => {
      console.error('[PAYPAL-LOADER] ❌ Error cargando PayPal SDK:', error);
      window.PAYPAL_READY = false;

      // Disparar evento de error
      window.dispatchEvent(
        new CustomEvent('paypal-error', {
          detail: {
            error: 'Failed to load PayPal SDK',
            timestamp: new Date().toISOString(),
          },
        })
      );
    };

    // 7. Agregar script al DOM
    document.head.appendChild(script);
    debugLog('[PAYPAL-LOADER] Script tag agregado al DOM');
  } catch (error) {
    console.error('[PAYPAL-LOADER] ❌ Error en inicialización:', error);
    window.PAYPAL_READY = false;
  }
}

/**
 * Función helper para esperar a que PayPal esté listo
 * Uso:
 *
 * await waitForPayPal();
 * paypal.Buttons({ ... }).render('#paypal-button-container');
 */
window.waitForPayPal = function () {
  return new Promise((resolve, reject) => {
    if (window.PAYPAL_READY && window.paypal) {
      resolve(window.paypal);
    } else {
      const timeout = setTimeout(() => {
        reject(new Error('PayPal SDK timeout'));
      }, 10000); // 10 segundos timeout

      window.addEventListener(
        'paypal-ready',
        () => {
          clearTimeout(timeout);
          resolve(window.paypal);
        },
        {
          once: true,
        }
      );

      window.addEventListener(
        'paypal-error',
        event => {
          clearTimeout(timeout);
          reject(new Error(event.detail.error));
        },
        {
          once: true,
        }
      );
    }
  });
};

export function initPayPalLoader() {
  if (window.__PAYPAL_LOADER_INITED__) {
    return;
  }

  window.__PAYPAL_LOADER_INITED__ = true;
  setupPayPalLoader();
}

if (typeof window !== 'undefined' && !window.__PAYPAL_LOADER_NO_AUTO__) {
  initPayPalLoader();
}

