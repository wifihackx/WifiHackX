/**
 * Main JS - Punto de entrada
 */
const debugLog = (...args) => {
  if (window.__WIFIHACKX_DEBUG__ === true) {
    console.info(...args);
  }
};

debugLog('🚀 [Main] Aplicación iniciada.');

// Inicializaciones globales si son necesarias
document.addEventListener('DOMContentLoaded', () => {
  debugLog(
    '✅ [Main] DOM cargado - auth.js manejará el estado de autenticación'
  );

  // Agregar clase al body cuando esté listo
  if (typeof firebase !== 'undefined') {
    debugLog('🔥 [Main] Firebase SDK detectado');
  }
});
