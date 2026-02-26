/**
 * Google Analytics 4 Integration
 * Sistema de analytics con eventos personalizados
 */

/* global gtag */

export function initAnalyticsGa4() {
  'use strict';

  if (window.__ANALYTICS_GA4_INITED__) {
    return;
  }
  window.__ANALYTICS_GA4_INITED__ = true;

  // Configuración
  const MEASUREMENT_ID_PATTERN = /^G-[A-Z0-9]{8,}$/;
  const GA4_MEASUREMENT_ID =
    // Optional override (set from HTML/config if you want gtag.js on top of GTM)
    (typeof globalThis.WIFIHACKX_GA4_ID === 'string' && globalThis.WIFIHACKX_GA4_ID.trim()) ||
    // Default: reuse Firebase Analytics measurementId when available.
    (globalThis.firebaseConfig && globalThis.firebaseConfig.measurementId) ||
    'G-XXXXXXXXXX';
  const DEBUG_MODE = false;

  const debugLog = (...args) => {
    if (window.__WIFIHACKX_DEBUG__ === true) {
      console.info(...args);
    }
  };

  const isDevHost =
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

  /**
   * Inicializa Google Analytics 4
   */
  function initGA4() {
    if (
      isDevHost ||
      GA4_MEASUREMENT_ID === 'G-XXXXXXXXXX' ||
      !MEASUREMENT_ID_PATTERN.test(String(GA4_MEASUREMENT_ID))
    ) {
      return;
    }
    // Verificar si ya está cargado
    if (window.gtag) {
      if (DEBUG_MODE) {
        debugLog('[GA4] Ya está inicializado');
      }
      return;
    }

    // Cargar script de GA4
    const script = document.createElement('script');
    script.async = true;
    const nonce = globalThis.SECURITY_NONCE || globalThis.NONCE || '';
    if (nonce) {
      script.setAttribute('nonce', nonce);
    }
    script.src = `https://www.googletagmanager.com/gtag/js?id=${GA4_MEASUREMENT_ID}`;
    document.head.appendChild(script);

    // Inicializar dataLayer
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () {
      window.dataLayer.push(arguments);
    };

    // Configurar GA4
    gtag('js', new Date());
    gtag('config', GA4_MEASUREMENT_ID, {
      send_page_view: true,
      debug_mode: DEBUG_MODE,
    });

    if (DEBUG_MODE) {
      debugLog('[GA4] Inicializado correctamente');
    }
  }

  /**
   * Trackear evento personalizado
   */
  function trackEvent(eventName, eventParams = {}) {
    if (!window.gtag) {
      if (DEBUG_MODE) {
        console.warn('[GA4] No está inicializado');
      }
      return;
    }

    gtag('event', eventName, eventParams);

    if (DEBUG_MODE) {
      debugLog('[GA4] Evento:', eventName, eventParams);
    }
  }

  /**
   * Trackear vista de página
   */
  function trackPageView(pagePath, pageTitle) {
    trackEvent('page_view', {
      page_path: pagePath,
      page_title: pageTitle,
    });
  }

  /**
   * Trackear login
   */
  function trackLogin(method) {
    trackEvent('login', {
      method: method, // 'email', 'google', etc.
    });
  }

  /**
   * Trackear registro
   */
  function trackSignUp(method) {
    trackEvent('sign_up', {
      method: method,
    });
  }

  /**
   * Trackear compra
   */
  function trackPurchase(transactionId, value, currency = 'USD', items = []) {
    trackEvent('purchase', {
      transaction_id: transactionId,
      value: value,
      currency: currency,
      items: items,
    });
  }

  /**
   * Trackear añadir al carrito
   */
  function trackAddToCart(item) {
    trackEvent('add_to_cart', {
      currency: 'USD',
      value: item.price,
      items: [
        {
          item_id: item.id,
          item_name: item.name,
          price: item.price,
          quantity: 1,
        },
      ],
    });
  }

  /**
   * Trackear búsqueda
   */
  function trackSearch(searchTerm) {
    trackEvent('search', {
      search_term: searchTerm,
    });
  }

  /**
   * Trackear error
   */
  function trackError(errorMessage, errorType = 'general') {
    trackEvent('exception', {
      description: errorMessage,
      fatal: false,
      error_type: errorType,
    });
  }

  /**
   * Trackear tiempo en página
   */
  function trackEngagement() {
    const startTime = Date.now();

    window.addEventListener('beforeunload', () => {
      const timeSpent = Math.round((Date.now() - startTime) / 1000);

      trackEvent('user_engagement', {
        engagement_time_msec: timeSpent * 1000,
      });
    });
  }

  /**
   * Configurar tracking automático
   */
  function setupAutoTracking() {
    // Trackear clics en enlaces externos
    document.addEventListener('click', e => {
      const link = e.target.closest('a');
      if (link && link.hostname !== window.location.hostname) {
        trackEvent('click', {
          link_url: link.href,
          link_text: link.textContent,
          outbound: true,
        });
      }
    });

    // Trackear scroll depth
    let maxScroll = 0;
    window.addEventListener('scroll', () => {
      const scrollPercent = Math.round(
        (window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100
      );

      if (scrollPercent > maxScroll && scrollPercent % 25 === 0) {
        maxScroll = scrollPercent;
        trackEvent('scroll', {
          percent_scrolled: scrollPercent,
        });
      }
    });

    // Trackear tiempo en página
    trackEngagement();
  }

  /**
   * Integración con eventos de la aplicación
   */
  function setupAppIntegration() {
    // Escuchar eventos personalizados de la app
    window.addEventListener('user:login', e => {
      trackLogin(e.detail.method || 'email');
    });

    window.addEventListener('user:signup', e => {
      trackSignUp(e.detail.method || 'email');
    });

    window.addEventListener('cart:add', e => {
      trackAddToCart(e.detail.item);
    });

    window.addEventListener('purchase:complete', e => {
      trackPurchase(e.detail.transactionId, e.detail.value, e.detail.currency, e.detail.items);
    });

    window.addEventListener('error:occurred', e => {
      trackError(e.detail.message, e.detail.type);
    });
  }

  /**
   * Inicializar todo
   */
  function init() {
    // Verificar consentimiento de cookies (GDPR)
    const hasConsent = localStorage.getItem('analytics_consent') === 'true';

    if (!hasConsent) {
      debugLog('[GA4] Esperando consentimiento de cookies');
      // Mostrar banner de cookies aquí
      return;
    }

    initGA4();
    setupAutoTracking();
    setupAppIntegration();

    debugLog('[GA4] Sistema de analytics configurado');
  }

  // Exponer API global
  window.Analytics = {
    init,
    trackEvent,
    trackPageView,
    trackLogin,
    trackSignUp,
    trackPurchase,
    trackAddToCart,
    trackSearch,
    trackError,
  };

  // Inicializar cuando el DOM esté listo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  debugLog('[GA4] Módulo cargado');
}
