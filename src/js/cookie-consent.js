/**
 * Cookie Consent Banner
 * Banner de consentimiento de cookies para GDPR
 */

'use strict';

const debugLog = (...args) => {
  if (window.__WFX_DEBUG__ === true) {
    console.info(...args);
  }
};

function setupCookieConsent() {
  /**
   * Mostrar banner de consentimiento
   */
  function showConsentBanner() {
    // Verificar si ya dio consentimiento
    const hasConsent = localStorage.getItem('analytics_consent');
    if (hasConsent === 'true') {
      return;
    }

    // Crear banner
    const banner = document.createElement('div');
    banner.id = 'cookie-consent-banner';
    banner.className = 'cookie-consent-banner';
    banner.innerHTML = `
      <div class="cookie-consent-content">
        <p class="cookie-consent-text">
          <strong>🍪 Cookies y Privacidad</strong><br>
          Usamos cookies para mejorar tu experiencia y analizar el uso del sitio.
          <a href="privacidad.html" target="_blank" rel="noopener noreferrer">Política de Privacidad</a>
        </p>
        <div class="cookie-consent-buttons">
          <button id="cookie-accept" class="btn btn-primary">
            Aceptar
          </button>
          <button id="cookie-reject" class="btn btn-secondary">
            Rechazar
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(banner);

    // Event listeners
    document.getElementById('cookie-accept').addEventListener('click', () => {
      acceptCookies();
      banner.remove();
    });

    document.getElementById('cookie-reject').addEventListener('click', () => {
      rejectCookies();
      banner.remove();
    });
  }

  /**
   * Aceptar cookies
   */
  function acceptCookies() {
    localStorage.setItem('analytics_consent', 'true');
    debugLog('[CookieConsent] Cookies aceptadas');
    window.dispatchEvent(new CustomEvent('analytics-consent-granted'));

    // Inicializar analytics
    if (window.AnalyticsLoader?.loadAfterConsent) {
      window.AnalyticsLoader.loadAfterConsent();
      return;
    }

    if (window.Analytics?.init) {
      window.Analytics.init();
    }
  }

  /**
   * Rechazar cookies
   */
  function rejectCookies() {
    localStorage.setItem('analytics_consent', 'false');
    debugLog('[CookieConsent] Cookies rechazadas');
    window.dispatchEvent(new CustomEvent('analytics-consent-denied'));
  }

  // Mostrar banner al cargar
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', showConsentBanner);
  } else {
    showConsentBanner();
  }

  debugLog('[CookieConsent] Módulo cargado');
}

export function initCookieConsent() {
  if (window.__COOKIE_CONSENT_INITED__) {
    return;
  }

  window.__COOKIE_CONSENT_INITED__ = true;
  setupCookieConsent();
}

if (typeof window !== 'undefined' && !window.__COOKIE_CONSENT_NO_AUTO__) {
  initCookieConsent();
}
