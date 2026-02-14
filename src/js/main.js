/**
 * Main JS - Punto de entrada
 */
console.log('🚀 [Main] Aplicación iniciada.');

// Inicializaciones globales si son necesarias
document.addEventListener('DOMContentLoaded', () => {
  console.log(
    '✅ [Main] DOM cargado - auth.js manejará el estado de autenticación'
  );

  // Agregar clase al body cuando esté listo
  if (typeof firebase !== 'undefined') {
    console.log('🔥 [Main] Firebase SDK detectado');
  }
});
