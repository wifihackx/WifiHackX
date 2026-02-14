/**
 * nonce-init.js - Inicialización de Nonce Dinámico
 *
 * Este script debe cargarse PRIMERO en index.html para obtener
 * el nonce dinámico desde la Cloud Function antes de ejecutar
 * cualquier otro script inline.
 *
 * Flujo:
 * 1. Obtiene nonce desde Cloud Function
 * 2. Guarda nonce en window.SECURITY_NONCE
 * 3. Obtiene claves de API (PayPal, Stripe) de forma segura
 * 4. Actualiza meta tag CSP_NONCE
 * 5. Dispara evento 'nonce-ready' para que otros scripts esperen
 */

(async function initSecurityNonce() {
  'use strict';

  const DEBUG_MODE = false;
  if (DEBUG_MODE) {
    console.log('[NONCE-INIT] Iniciando obtención de nonce dinámico...');
  }

  // URL de la Cloud Function (ajustar según tu proyecto)
  const CLOUD_FUNCTION_URL =
    'https://us-central1-white-caster-466401-g0.cloudfunctions.net/security/api/security/nonce';

  // Nonce deshabilitado para hosting estático (CSP por hash/headers)
  const FALLBACK_NONCE = '';
  const IS_DEVELOPMENT =
    globalThis.location.hostname === 'localhost' ||
    globalThis.location.hostname === '127.0.0.1';

  try {
    // 1. Obtener nonce
    // EN DESARROLLO: Nonce deshabilitado (CSP por hash)
    if (IS_DEVELOPMENT) {
      if (DEBUG_MODE) {
        console.warn(
          '[NONCE-INIT] ⚠️ Modo Desarrollo: Nonce deshabilitado (CSP por hash)'
        );
      }
      globalThis.SECURITY_NONCE = null;
      globalThis.NONCE = null;
      globalThis.NONCE_READY = true;

      // Simular datos de Cloud Function
      const devData = {
        nonce: null,
        ttl: 3600,
        expiresAt: Date.now() + 3600000,
        paypalClientId:
          'ATK8yZuBDkOSoP4u2Art1EbnJiLSqQgA2B_P7-hq6-hZ3ii7GiLqVoGBy_diHugyZjIARGscFJut_rsA',
        stripeKey:
          'pk_test_51SlygUB6pfNER5sYcU4UZ4HRCdvRT7jK8dawVrzNzoscbj1DSbxwECwYg7uFD9Dh5BJ82AhkYVmxqlj4XTQ6GOk500nozWRARU',
      };

      globalThis.PAYPAL_CLIENT_ID = devData.paypalClientId;
      globalThis.STRIPE_PUBLIC_KEY = devData.stripeKey;

      // Disparar evento
      globalThis.dispatchEvent(
        new CustomEvent('nonce-ready', {
          detail: {
            nonce: null,
            timestamp: new Date().toISOString(),
          },
        })
      );
      return;
    }

    // 1. Obtener nonce desde Cloud Function (SOLO PRODUCCIÓN)
    const response = await fetch(CLOUD_FUNCTION_URL, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      cache: 'no-cache',
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    if (!data.success || !data.nonce) {
      throw new Error('Respuesta inválida de Cloud Function');
    }

    // Validar TTL del nonce
    const nonceAge = Date.now() - data.issuedAt;
    const isExpired = nonceAge > data.expiresIn;

    if (isExpired) {
      console.warn('[NONCE-INIT] ⚠️ Nonce expirado, renovando...');
      // Recursivamente obtener nuevo nonce
      return initSecurityNonce();
    }

    // 2. Guardar nonce y configuración en window/global
    globalThis.SECURITY_NONCE = data.nonce;
    globalThis.NONCE = data.nonce;
    globalThis.NONCE_ISSUED_AT = data.issuedAt;
    globalThis.NONCE_EXPIRES_AT = data.expiresAt;
    globalThis.NONCE_TTL = data.ttl;
    globalThis.PAYPAL_CLIENT_ID = data.paypalClientId;
    globalThis.STRIPE_PUBLIC_KEY = data.stripeKey;
    globalThis.CSP_HEADER = data.csp;

    console.log(
      '[NONCE-INIT] ✅ Nonce dinámico obtenido:',
      data.nonce.substring(0, 12) + '...'
    );
    console.log(
      '[NONCE-INIT] ✅ TTL:',
      data.ttl,
      'segundos (expira en',
      new Date(data.expiresAt).toLocaleTimeString() + ')'
    );
    console.log('[NONCE-INIT] ✅ PayPal Client ID cargado');
    console.log('[NONCE-INIT] ✅ Stripe Public Key cargado');

    // Programar renovación automática antes de que expire (30 segundos antes)
    const renewTime = data.expiresIn - 30000; // 30 segundos antes
    setTimeout(() => {
      console.log('[NONCE-INIT] 🔄 Renovando nonce automáticamente...');
      initSecurityNonce();
    }, renewTime);

    // 3. Actualizar meta tag CSP_NONCE
    const metaTag = document.querySelector('meta[name="CSP_NONCE"]');
    if (metaTag) {
      metaTag.setAttribute('content', data.nonce);
      console.log('[NONCE-INIT] ✅ Meta tag CSP_NONCE actualizado');
    }

    // 4. Marcar como listo
    globalThis.NONCE_READY = true;

    // 5. Disparar evento para que otros scripts esperen
    globalThis.dispatchEvent(
      new CustomEvent('nonce-ready', {
        detail: {
          nonce: data.nonce,
          timestamp: new Date().toISOString(),
        },
      })
    );

    console.log(
      '[NONCE-INIT] ✅ Sistema de nonce dinámico inicializado correctamente'
    );
  } catch (error) {
    console.error('[NONCE-INIT] ❌ Error obteniendo nonce:', error);

    // Fallback para desarrollo
    if (IS_DEVELOPMENT) {
      if (DEBUG_MODE) {
        console.warn(
          '[NONCE-INIT] ⚠️ Nonce deshabilitado (SOLO DESARROLLO)'
        );
      }
      globalThis.SECURITY_NONCE = null;
      globalThis.NONCE = null;
      globalThis.NONCE_READY = true;
      globalThis.PAYPAL_CLIENT_ID =
        'ATK8yZuBDkOSoP4u2Art1EbnJiLSqQgA2B_P7-hq6-hZ3ii7GiLqVoGBy_diHugyZjIARGscFJut_rsA';
      globalThis.STRIPE_PUBLIC_KEY =
        'pk_test_51SlygUB6pfNER5sYcU4UZ4HRCdvRT7jK8dawVrzNzoscbj1DSbxwECwYg7uFD9Dh5BJ82AhkYVmxqlj4XTQ6GOk500nozWRARU';

      globalThis.dispatchEvent(
        new CustomEvent('nonce-ready', {
          detail: {
            nonce: null,
            fallback: true,
            timestamp: new Date().toISOString(),
          },
        })
      );
    } else {
      // En producción, fallar de forma segura
      console.error(
        '[NONCE-INIT] ❌ CRÍTICO: No se pudo obtener nonce en producción'
      );
      globalThis.SECURITY_NONCE = null;
      globalThis.NONCE_READY = false;

      // Mostrar mensaje al usuario
      document.addEventListener('DOMContentLoaded', () => {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'nonce-error-banner';
        errorDiv.textContent =
          'Error de seguridad: No se pudo inicializar el sistema. Por favor, recarga la página.';
        document.body.prepend(errorDiv);
      });
    }
  }
})();

/**
 * Función helper para esperar a que el nonce esté listo
 * Uso en otros scripts:
 *
 * await waitForNonce();
 * const nonce = window.SECURITY_NONCE;
 */
globalThis.waitForNonce = function () {
  return new Promise(resolve => {
    if (globalThis.NONCE_READY) {
      resolve(globalThis.SECURITY_NONCE);
    } else {
      globalThis.addEventListener(
        'nonce-ready',
        event => {
          resolve(event.detail.nonce);
        },
        {
          once: true,
        }
      );
    }
  });
};

/**
 * Función helper para verificar si el nonce está expirado
 */
globalThis.isNonceExpired = function () {
  if (!globalThis.NONCE_EXPIRES_AT) return true;
  return Date.now() > globalThis.NONCE_EXPIRES_AT;
};

/**
 * Función helper para obtener tiempo restante del nonce
 */
globalThis.getNonceTimeRemaining = function () {
  if (!globalThis.NONCE_EXPIRES_AT) return 0;
  const remaining = globalThis.NONCE_EXPIRES_AT - Date.now();
  return Math.max(0, Math.floor(remaining / 1000)); // en segundos
};
