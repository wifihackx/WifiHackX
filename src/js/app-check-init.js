/**
 * Firebase App Check Initialization - DESHABILITADO TEMPORALMENTE
 *
 * NOTA: App Check está deshabilitado porque está bloqueando Firestore
 * en desarrollo sin un debug token registrado.
 *
 * Para habilitar App Check:
 * 1. Registra un debug token en Firebase Console
 * 2. Descomenta el código de inicialización
 *
 * @version 1.0.1
 * @date 11 de Enero, 2026
 */

function setupAppCheckInit() {
  console.log('[APP-CHECK] ⚠️ App Check DESHABILITADO temporalmente');
  console.log('[APP-CHECK] ⚠️ Firestore funcionará sin App Check');
  console.log(
    '[APP-CHECK] ℹ️ Para habilitar: registra debug token en Firebase Console'
  );

  // Marcar como no listo
  window.APP_CHECK_READY = false;
  window.APP_CHECK = null;

  // Helpers que retornan false
  window.waitForAppCheck = function () {
    return Promise.reject(new Error('App Check está deshabilitado'));
  };

  window.isAppCheckActive = function () {
    return false;
  };

  window.getAppCheckStatus = function () {
    return {
      ready: false,
      instance: null,
      hostname: window.location.hostname,
      isDevelopment:
        window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1',
      disabled: true,
      reason:
        'App Check deshabilitado temporalmente - bloqueaba Firestore sin debug token',
    };
  };
}

export function initAppCheck() {
  if (window.__APP_CHECK_INITED__) {
    return;
  }

  window.__APP_CHECK_INITED__ = true;
  setupAppCheckInit();
}

if (typeof window !== 'undefined' && !window.__APP_CHECK_NO_AUTO__) {
  initAppCheck();
}

console.log('[APP-CHECK] Módulo cargado (v1.0.1 - DESHABILITADO)');
