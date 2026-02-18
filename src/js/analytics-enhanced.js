/**
 * Sistema de Analytics Avanzado
 *
 * Tracking de eventos personalizados para Google Analytics 4
 * Incluye funnels de conversión, abandono de carrito, y análisis de comportamiento
 *
 * GRATIS: Usa Google Analytics 4 (sin costo)
 */

const debugLog = (...args) => {
  if (window.__WIFIHACKX_DEBUG__ === true) {
    console.info(...args);
  }
};

class EnhancedAnalytics {
  constructor() {
    this.initialized = false;
    this.debug =
      typeof window !== 'undefined' &&
      (window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1');
  }

  /**
   * Inicializar sistema de analytics
   */
  init() {
    if (typeof gtag === 'undefined') {
      if (this.debug) {
        console.info('[EnhancedAnalytics] gtag no disponible; tracking desactivado');
      }
      return;
    }

    this.initialized = true;
    debugLog('✅ Enhanced Analytics inicializado');

    // Track page views automáticamente
    this.trackPageView();

    // Track tiempo en página
    this.trackTimeOnPage();

    // Track scroll depth
    this.trackScrollDepth();
  }

  /**
   * Track page view
   */
  trackPageView() {
    if (!this.initialized) return;

    gtag('event', 'page_view', {
      page_title: document.title,
      page_location: window.location.href,
      page_path: window.location.pathname,
    });

    debugLog('📊 Page view tracked:', window.location.pathname);
  }

  /**
   * Track inicio de checkout
   */
  trackCheckoutStarted(productId, price, productName = 'Digital Product') {
    if (!this.initialized) return;

    gtag('event', 'begin_checkout', {
      currency: 'USD',
      value: price,
      items: [
        {
          item_id: productId,
          item_name: productName,
          price: price,
          quantity: 1,
        },
      ],
    });

    debugLog('🛒 Checkout started:', { productId, price });

    // También guardar en localStorage para tracking de abandono
    localStorage.setItem(
      'checkout_started',
      JSON.stringify({
        productId,
        price,
        timestamp: Date.now(),
      })
    );
  }

  /**
   * Track compra completada
   */
  trackPurchaseCompleted(
    purchaseId,
    price,
    productId = 'digital-product',
    productName = 'Digital Product'
  ) {
    if (!this.initialized) return;

    gtag('event', 'purchase', {
      transaction_id: purchaseId,
      value: price,
      currency: 'USD',
      items: [
        {
          item_id: productId,
          item_name: productName,
          price: price,
          quantity: 1,
        },
      ],
    });

    debugLog('💰 Purchase completed:', { purchaseId, price });

    // Limpiar checkout abandonado
    localStorage.removeItem('checkout_started');

    // Track conversión
    this.trackConversion('purchase', price);
  }

  /**
   * Track descarga de archivo
   */
  trackDownload(productId, fileName = 'Cyclone.zip') {
    if (!this.initialized) return;

    gtag('event', 'file_download', {
      file_name: fileName,
      file_extension: fileName.split('.').pop(),
      link_url: window.location.href,
      product_id: productId,
    });

    debugLog('📥 Download tracked:', { productId, fileName });
  }

  /**
   * Track abandono de carrito
   */
  trackCartAbandonment(productId, price) {
    if (!this.initialized) return;

    gtag('event', 'cart_abandonment', {
      value: price,
      currency: 'USD',
      items: [
        {
          item_id: productId,
          price: price,
        },
      ],
    });

    debugLog('🚪 Cart abandoned:', { productId, price });
  }

  /**
   * Track errores
   */
  trackError(errorType, errorMessage, fatal = false) {
    if (!this.initialized) return;

    gtag('event', 'exception', {
      description: `${errorType}: ${errorMessage}`,
      fatal: fatal,
    });

    debugLog('❌ Error tracked:', { errorType, errorMessage, fatal });
  }

  /**
   * Track login
   */
  trackLogin(method = 'email') {
    if (!this.initialized) return;

    gtag('event', 'login', {
      method: method,
    });

    debugLog('🔐 Login tracked:', method);
  }

  /**
   * Track registro
   */
  trackSignup(method = 'email') {
    if (!this.initialized) return;

    gtag('event', 'sign_up', {
      method: method,
    });

    debugLog('✍️ Signup tracked:', method);
  }

  /**
   * Track búsqueda
   */
  trackSearch(searchTerm) {
    if (!this.initialized) return;

    gtag('event', 'search', {
      search_term: searchTerm,
    });

    debugLog('🔍 Search tracked:', searchTerm);
  }

  /**
   * Track click en botón
   */
  trackButtonClick(buttonName, buttonLocation) {
    if (!this.initialized) return;

    gtag('event', 'button_click', {
      button_name: buttonName,
      button_location: buttonLocation,
    });

    debugLog('🖱️ Button click tracked:', { buttonName, buttonLocation });
  }

  /**
   * Track conversión
   */
  trackConversion(conversionType, value = 0) {
    if (!this.initialized) return;

    gtag('event', 'conversion', {
      conversion_type: conversionType,
      value: value,
      currency: 'USD',
    });

    debugLog('🎯 Conversion tracked:', { conversionType, value });
  }

  /**
   * Track tiempo en página
   */
  trackTimeOnPage() {
    const startTime = Date.now();

    window.addEventListener('beforeunload', () => {
      const timeSpent = Math.round((Date.now() - startTime) / 1000); // segundos

      if (this.initialized && timeSpent > 0) {
        gtag('event', 'time_on_page', {
          value: timeSpent,
          page_path: window.location.pathname,
        });

        debugLog('⏱️ Time on page:', timeSpent, 'seconds');
      }
    });
  }

  /**
   * Track scroll depth
   */
  trackScrollDepth() {
    let maxScroll = 0;
    const thresholds = [25, 50, 75, 100];
    const tracked = new Set();

    window.addEventListener('scroll', () => {
      const scrollPercent = Math.round(
        (window.scrollY /
          (document.documentElement.scrollHeight - window.innerHeight)) *
          100
      );

      if (scrollPercent > maxScroll) {
        maxScroll = scrollPercent;

        // Track cada threshold una sola vez
        thresholds.forEach(threshold => {
          if (scrollPercent >= threshold && !tracked.has(threshold)) {
            tracked.add(threshold);

            if (this.initialized) {
              gtag('event', 'scroll_depth', {
                percent_scrolled: threshold,
                page_path: window.location.pathname,
              });

              debugLog('📜 Scroll depth:', threshold + '%');
            }
          }
        });
      }
    });
  }

  /**
   * Verificar abandono de carrito al cargar página
   */
  checkCartAbandonment() {
    const checkoutData = localStorage.getItem('checkout_started');

    if (checkoutData) {
      try {
        const data = JSON.parse(checkoutData);
        const hoursSinceCheckout =
          (Date.now() - data.timestamp) / (1000 * 60 * 60);

        // Si pasaron más de 24 horas, considerar abandonado
        if (hoursSinceCheckout > 24) {
          this.trackCartAbandonment(data.productId, data.price);
          localStorage.removeItem('checkout_started');
        }
      } catch (error) {
        console.error('Error checking cart abandonment:', error);
      }
    }
  }

  /**
   * Track evento personalizado
   */
  trackCustomEvent(eventName, eventParams = {}) {
    if (!this.initialized) return;

    gtag('event', eventName, eventParams);

    debugLog('📊 Custom event tracked:', eventName, eventParams);
  }
}

export function initEnhancedAnalytics() {
  if (window.__ENHANCED_ANALYTICS_INITED__) {
    return;
  }
  window.__ENHANCED_ANALYTICS_INITED__ = true;

  if (typeof window === 'undefined') return;

  window.enhancedAnalytics = new EnhancedAnalytics();
  window.enhancedAnalytics.init();

  // Verificar abandono de carrito al cargar
  window.addEventListener('DOMContentLoaded', () => {
    window.enhancedAnalytics.checkCartAbandonment();
  });

  debugLog('✅ Enhanced Analytics disponible globalmente');
}

if (typeof window !== 'undefined' && !window.__ENHANCED_ANALYTICS_NO_AUTO__) {
  initEnhancedAnalytics();
}

