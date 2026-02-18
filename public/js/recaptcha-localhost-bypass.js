/**
 * reCAPTCHA Localhost Bypass
 * Deshabilita reCAPTCHA en localhost para facilitar testing
 * @version 1.0.0
 */

(function () {
  'use strict';

const debugLog = (...args) => {
  if (window.__WFX_DEBUG__ === true) {
    console.log(...args);
  }
};

  // Detectar si estamos en localhost
  const isLocalhost =
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1';

  if (isLocalhost) {
    debugLog(
      '🔧 [reCAPTCHA] Localhost detectado - Configurando bypass para testing'
    );

    // Esperar a que el DOM esté listo
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', setupBypass);
    } else {
      setupBypass();
    }
  }

  function setupBypass() {
    // Buscar el botón de registro con g-recaptcha
    const registerButton = document.querySelector(
      '#registerFormElement button[type="submit"].g-recaptcha'
    );

    if (registerButton) {
      debugLog('[reCAPTCHA] Botón de registro encontrado');

      // Remover la clase g-recaptcha para evitar que reCAPTCHA intercepte el click
      registerButton.classList.remove('g-recaptcha');

      // Remover atributos de reCAPTCHA
      registerButton.removeAttribute('data-sitekey');
      registerButton.removeAttribute('data-callback');
      registerButton.removeAttribute('data-action');

      debugLog(
        '[reCAPTCHA] ✅ Bypass configurado - reCAPTCHA deshabilitado en localhost'
      );

      // Crear un token falso para que el formulario funcione
      const registerForm = document.getElementById('registerFormElement');
      if (registerForm) {
        // Agregar el token falso inmediatamente
        registerForm.dataset.recaptchaToken = 'localhost-bypass-token';
        debugLog('[reCAPTCHA] Token de bypass agregado al formulario');
      }
    } else {
      window.addEventListener(
        'loginView:templateLoaded',
        () => {
          setupBypass();
        },
        { once: true }
      );
    }
  }
})();
