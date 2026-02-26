/**
 * Real User Monitoring (RUM)
 * Monitoreo de performance y Core Web Vitals en producción
 */

/* global PerformanceObserver, performance */

export function initRealUserMonitoring() {
  const isLocal =
    window.location &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
  if (isLocal) {
    return;
  }

  if (window.__RUM_INITED__) {
    return;
  }
  window.__RUM_INITED__ = true;

  ('use strict');

  // Configuración
  function readMetricsEndpoint() {
    try {
      if (typeof globalThis.WIFIHACKX_METRICS_ENDPOINT === 'string') {
        return globalThis.WIFIHACKX_METRICS_ENDPOINT.trim();
      }
      const meta = document.querySelector('meta[name="METRICS_ENDPOINT"]');
      if (meta && typeof meta.getAttribute === 'function') {
        const v = (meta.getAttribute('content') || '').trim();
        if (v) return v;
      }
    } catch (_e) {}
    return '';
  }

  // If not configured, we fall back to GA4/Sentry when available. Avoid hardcoding a possibly missing endpoint.
  const ENDPOINT = readMetricsEndpoint();
  const BATCH_SIZE = 10;
  const BATCH_INTERVAL = 30000; // 30 segundos

  let metricsQueue = [];
  let batchTimer = null;
  const sentOnce = new Set();

  function hasLogger() {
    return (
      typeof window !== 'undefined' && window.Logger && typeof window.Logger.debug === 'function'
    );
  }

  function debug(message, data) {
    // Keep production quiet. RUM must not spam console.
    try {
      if (hasLogger() && window.Logger.isDev && window.Logger.isDev()) {
        window.Logger.debug(message, 'RUM', data || null);
      }
    } catch (_e) {}
  }

  /**
   * Core Web Vitals
   */
  const webVitals = {
    LCP: null, // Largest Contentful Paint
    FID: null, // First Input Delay
    CLS: null, // Cumulative Layout Shift
    FCP: null, // First Contentful Paint
    TTFB: null, // Time to First Byte
  };

  function clampNonNegative(value) {
    if (typeof value !== 'number' || isNaN(value)) return null;
    return value < 0 ? 0 : value;
  }

  function getNavigationEntry() {
    if (typeof performance.getEntriesByType !== 'function') return null;
    const entries = performance.getEntriesByType('navigation');
    return entries && entries.length ? entries[0] : null;
  }

  /**
   * Medir LCP (Largest Contentful Paint)
   */
  function measureLCP() {
    if (!('PerformanceObserver' in window)) return;
    if (
      PerformanceObserver.supportedEntryTypes &&
      !PerformanceObserver.supportedEntryTypes.includes('largest-contentful-paint')
    ) {
      return;
    }

    try {
      const observer = new PerformanceObserver(list => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];

        const lcpValue = lastEntry.startTime || lastEntry.renderTime || lastEntry.loadTime;
        webVitals.LCP = clampNonNegative(lcpValue);
        debug('[RUM] LCP updated', webVitals.LCP);
      });

      observer.observe({ type: 'largest-contentful-paint', buffered: true });
    } catch (error) {
      console.error('[RUM] Error midiendo LCP:', error);
    }
  }

  /**
   * Medir FID (First Input Delay)
   */
  function measureFID() {
    if (!('PerformanceObserver' in window)) return;
    if (
      PerformanceObserver.supportedEntryTypes &&
      !PerformanceObserver.supportedEntryTypes.includes('first-input')
    ) {
      return;
    }

    try {
      const observer = new PerformanceObserver(list => {
        const entries = list.getEntries();
        entries.forEach(entry => {
          const fidValue = entry.processingStart - entry.startTime;
          webVitals.FID = clampNonNegative(fidValue);
          sendOnce('fid', webVitals.FID);
        });
      });

      observer.observe({ type: 'first-input', buffered: true });
    } catch (error) {
      console.error('[RUM] Error midiendo FID:', error);
    }
  }

  /**
   * Medir CLS (Cumulative Layout Shift)
   */
  function measureCLS() {
    if (!('PerformanceObserver' in window)) return;
    if (
      PerformanceObserver.supportedEntryTypes &&
      !PerformanceObserver.supportedEntryTypes.includes('layout-shift')
    ) {
      return;
    }

    let clsValue = 0;

    try {
      const observer = new PerformanceObserver(list => {
        const entries = list.getEntries();
        entries.forEach(entry => {
          if (!entry.hadRecentInput) {
            clsValue += entry.value;
          }
        });

        webVitals.CLS = clampNonNegative(clsValue);
        debug('[RUM] CLS updated', webVitals.CLS);
      });

      observer.observe({ type: 'layout-shift', buffered: true });
    } catch (error) {
      console.error('[RUM] Error midiendo CLS:', error);
    }
  }

  /**
   * Medir FCP (First Contentful Paint)
   */
  function measureFCP() {
    if (!('PerformanceObserver' in window)) return;
    if (
      PerformanceObserver.supportedEntryTypes &&
      !PerformanceObserver.supportedEntryTypes.includes('paint')
    ) {
      return;
    }

    try {
      const observer = new PerformanceObserver(list => {
        const entries = list.getEntries();
        entries.forEach(entry => {
          if (entry.name === 'first-contentful-paint') {
            webVitals.FCP = clampNonNegative(entry.startTime);
            sendOnce('fcp', webVitals.FCP);
          }
        });
      });

      observer.observe({ type: 'paint', buffered: true });
    } catch (error) {
      console.error('[RUM] Error midiendo FCP:', error);
    }
  }

  /**
   * Medir TTFB (Time to First Byte)
   */
  function measureTTFB() {
    if (!('performance' in window)) return;

    try {
      const navEntry = getNavigationEntry();
      let ttfbValue = null;

      if (navEntry && typeof navEntry.responseStart === 'number') {
        ttfbValue = navEntry.responseStart - navEntry.requestStart;
      } else if (performance.timing) {
        const timing = performance.timing;
        ttfbValue = timing.responseStart - timing.requestStart;
      }

      webVitals.TTFB = clampNonNegative(ttfbValue);
      sendOnce('ttfb', webVitals.TTFB);
    } catch (error) {
      console.error('[RUM] Error midiendo TTFB:', error);
    }
  }

  /**
   * Medir recursos cargados
   */
  function measureResources() {
    if (!('performance' in window)) return;

    try {
      const resources = performance.getEntriesByType('resource');

      const stats = {
        total: resources.length,
        scripts: resources.filter(r => r.initiatorType === 'script').length,
        stylesheets: resources.filter(r => r.initiatorType === 'link').length,
        images: resources.filter(r => r.initiatorType === 'img').length,
        totalSize: resources.reduce((sum, r) => sum + (r.transferSize || 0), 0),
        totalDuration: resources.reduce((sum, r) => sum + r.duration, 0),
      };

      sendOnce('resources', stats);
    } catch (error) {
      console.error('[RUM] Error midiendo recursos:', error);
    }
  }

  /**
   * Medir errores JavaScript
   */
  function trackErrors() {
    window.addEventListener('error', event => {
      const errorData = {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        stack: event.error ? event.error.stack : null,
        timestamp: Date.now(),
      };

      console.error('[RUM] Error capturado:', errorData);
      sendMetric('error', errorData);
    });

    window.addEventListener('unhandledrejection', event => {
      const errorData = {
        message: event.reason ? event.reason.message : 'Unhandled Promise Rejection',
        stack: event.reason ? event.reason.stack : null,
        timestamp: Date.now(),
      };

      console.error('[RUM] Promise rejection:', errorData);
      sendMetric('promise_rejection', errorData);
    });
  }

  /**
   * Medir navegación
   */
  function measureNavigation() {
    if (!('performance' in window) || !performance.navigation) return;

    const navType = performance.navigation.type;
    const navTypes = ['navigate', 'reload', 'back_forward', 'prerender'];

    sendOnce('navigation_type', navTypes[navType] || 'unknown');
  }

  /**
   * Medir conexión de red
   */
  function measureConnection() {
    if (!('connection' in navigator)) return;

    const connection = navigator.connection;
    const connectionData = {
      effectiveType: connection.effectiveType,
      downlink: connection.downlink,
      rtt: connection.rtt,
      saveData: connection.saveData,
    };

    sendOnce('connection', connectionData);
  }

  function sendOnce(name, value) {
    if (sentOnce.has(name)) return;
    sentOnce.add(name);
    sendMetric(name, value);
  }

  function trySendToGa4(metric) {
    try {
      if (typeof window.gtag !== 'function') return false;
      if (typeof metric.value !== 'number' || isNaN(metric.value)) return false;

      // GA4 event for Web Vitals-style metrics.
      window.gtag('event', 'web_vitals', {
        metric_name: String(metric.name || ''),
        metric_value: metric.value,
        page_location: metric.url,
        non_interaction: true,
      });

      return true;
    } catch (_e) {
      return false;
    }
  }

  function trySendToSentry(metric) {
    try {
      const sentry = window.Sentry;
      if (!sentry) return false;

      if (typeof metric.value === 'number' && typeof sentry.setMeasurement === 'function') {
        sentry.setMeasurement(String(metric.name || ''), metric.value, 'millisecond');
        return true;
      }

      if (typeof sentry.addBreadcrumb === 'function') {
        sentry.addBreadcrumb({
          category: 'rum',
          level: 'info',
          message: String(metric.name || ''),
          data: { value: metric.value, url: metric.url },
        });
        return true;
      }
    } catch (_e) {}
    return false;
  }

  /**
   * Enviar métrica
   */
  function sendMetric(name, value) {
    const metric = {
      name: name,
      value: value,
      timestamp: Date.now(),
      url: window.location.href,
      userAgent: navigator.userAgent,
    };

    metricsQueue.push(metric);

    // Enviar batch si alcanzamos el tamaño
    if (metricsQueue.length >= BATCH_SIZE) {
      sendBatch();
    } else if (!batchTimer) {
      // Programar envío
      batchTimer = setTimeout(sendBatch, BATCH_INTERVAL);
    }
  }

  /**
   * Enviar batch de métricas
   */
  function sendBatch() {
    if (metricsQueue.length === 0) return;

    const batch = [...metricsQueue];
    metricsQueue = [];

    if (batchTimer) {
      clearTimeout(batchTimer);
      batchTimer = null;
    }

    // Prefer configured endpoint. Otherwise fall back to GA4/Sentry when present.
    if (ENDPOINT) {
      fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ metrics: batch }),
        keepalive: true,
      }).catch(error => {
        // Do not spam; a missing endpoint is common if not configured.
        debug(
          '[RUM] Error enviando métricas a endpoint',
          error && error.message ? error.message : String(error)
        );
      });
      return;
    }

    for (const metric of batch) {
      if (trySendToGa4(metric)) continue;
      trySendToSentry(metric);
    }
  }

  /**
   * Enviar métricas al salir de la página
   */
  function sendOnUnload() {
    window.addEventListener('beforeunload', () => {
      if (metricsQueue.length > 0) {
        sendBatch();
      }
    });

    // Usar sendBeacon si está disponible
    window.addEventListener('visibilitychange', () => {
      // Finalize LCP/CLS just before the page is hidden.
      if (document.visibilityState === 'hidden') {
        if (webVitals.LCP !== null) sendOnce('lcp', webVitals.LCP);
        if (webVitals.CLS !== null) sendOnce('cls', webVitals.CLS);
      }

      if (document.visibilityState === 'hidden' && metricsQueue.length > 0) {
        if (ENDPOINT && navigator.sendBeacon) {
          const batch = JSON.stringify({ metrics: metricsQueue });
          navigator.sendBeacon(ENDPOINT, batch);
          metricsQueue = [];
        } else {
          sendBatch();
        }
      }
    });
  }

  /**
   * Obtener resumen de métricas
   */
  function getSummary() {
    return {
      webVitals: webVitals,
      queueSize: metricsQueue.length,
    };
  }

  /**
   * Inicializar RUM
   */
  function init() {
    // Core Web Vitals
    measureLCP();
    measureFID();
    measureCLS();
    measureFCP();
    measureTTFB();

    // Otras métricas
    measureResources();
    measureNavigation();
    measureConnection();

    // Tracking
    trackErrors();
    sendOnUnload();
  }

  // Exponer API global
  window.RUM = {
    init,
    sendMetric,
    getSummary,
    webVitals,
  };

  // Inicializar cuando el DOM esté listo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}

if (typeof window !== 'undefined' && !window.__RUM_NO_AUTO__) {
  initRealUserMonitoring();
}
