'use strict';

(function initRuntimeConfig() {
  try {
    const node = document.getElementById('runtime-config');
    const parsed = node ? JSON.parse(node.textContent || '{}') : {};
    const base = window.RUNTIME_CONFIG || {};
    window.RUNTIME_CONFIG = Object.assign({}, base, parsed);
    window.RuntimeConfigUtils = window.RuntimeConfigUtils || {
      getFunctionsRegion(fallback) {
        const region = window.RUNTIME_CONFIG && window.RUNTIME_CONFIG.functionsRegion;
        if (typeof region === 'string' && region.trim()) return region.trim();
        return fallback || 'us-central1';
      },
      getCloudFunctionsBaseUrl(projectId, fallbackRegion) {
        const runtimeBase =
          window.RUNTIME_CONFIG && window.RUNTIME_CONFIG.cloudFunctionsBaseUrl;
        if (typeof runtimeBase === 'string' && runtimeBase.trim()) {
          return runtimeBase.trim().replace(/\/$/, '');
        }
        let pid = projectId;
        if (!pid && window.RUNTIME_CONFIG && window.RUNTIME_CONFIG.firebase) {
          pid = window.RUNTIME_CONFIG.firebase.projectId;
        }
        if (!pid || typeof pid !== 'string') return '';
        const region = this.getFunctionsRegion(fallbackRegion || 'us-central1');
        return `https://${region}-${pid.trim()}.cloudfunctions.net`.replace(/\/$/, '');
      },
      getSupportEmail(fallback) {
        const email =
          window.RUNTIME_CONFIG &&
          window.RUNTIME_CONFIG.support &&
          window.RUNTIME_CONFIG.support.email;
        if (typeof email === 'string' && email.trim()) return email.trim();
        return fallback || 'support@wifihackx.com';
      },
      getPaymentsKeys() {
        const payments = (window.RUNTIME_CONFIG && window.RUNTIME_CONFIG.payments) || {};
        return {
          paypalClientId:
            (typeof payments.paypalClientId === 'string' && payments.paypalClientId.trim()) ||
            '',
          stripePublicKey:
            (typeof payments.stripePublicKey === 'string' && payments.stripePublicKey.trim()) ||
            '',
        };
      },
      getSeoSchemaPrice(fallback) {
        const price =
          window.RUNTIME_CONFIG &&
          window.RUNTIME_CONFIG.seo &&
          window.RUNTIME_CONFIG.seo.schemaPriceEur;
        if (typeof price === 'string' && price.trim()) return price.trim();
        if (typeof price === 'number') return String(price);
        return fallback || '';
      },
    };
  } catch (error) {
    console.error('[runtime-config] parse error', error);
    window.RUNTIME_CONFIG = window.RUNTIME_CONFIG || {};
  }
})();

(function initGtmDelayed() {
  const id = (window.RUNTIME_CONFIG && window.RUNTIME_CONFIG.gtmId) || 'GTM-FTNCTPTM';
  if (!id) return;
  const dataLayerName = 'dataLayer';
  window[dataLayerName] = window[dataLayerName] || [];
  window[dataLayerName].push({
    'gtm.start': Date.now(),
    event: 'gtm.js',
  });

  function inject() {
    try {
      const host = window.location && window.location.hostname;
      if (host === 'localhost' || host === '127.0.0.1') return;
      const firstScript = document.getElementsByTagName('script')[0];
      const script = document.createElement('script');
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtm.js?id=${id}`;
      firstScript.parentNode.insertBefore(script, firstScript);
    } catch (error) {
      console.error('GTM injection failed:', error);
    }
  }

  window.addEventListener(
    'load',
    () => {
      setTimeout(inject, 1800);
    },
    { once: true }
  );
})();

(function promotePreloadedMainCss() {
  const promote = () => {
    const link = document.querySelector('link[rel="preload"][href="/css/main.css"]');
    if (!link) return;
    link.addEventListener(
      'load',
      () => {
        link.rel = 'stylesheet';
      },
      { once: true }
    );
    let supportsPreload = false;
    try {
      supportsPreload = link.relList && link.relList.supports && link.relList.supports('preload');
    } catch (error) {
      console.warn('Preload support check failed:', error);
    }
    // In modern browsers we still force promotion to avoid stalled styles when
    // head scripts execute before the preload link is parsed.
    if (!supportsPreload || link.rel === 'preload') {
      link.rel = 'stylesheet';
      link.onload = null;
    }
  };

  promote();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', promote, { once: true });
  } else {
    setTimeout(promote, 0);
  }
})();

(function initRevealAndHeroFx() {
  let revealed = false;
  function revealApp() {
    if (revealed || !document.body) return;
    revealed = true;
    requestAnimationFrame(() => {
      document.body.classList.add('app-loaded');
    });
  }
  setTimeout(revealApp, 3000);
  if (document.readyState === 'interactive' || document.readyState === 'complete') {
    setTimeout(revealApp, 600);
  } else {
    document.addEventListener('DOMContentLoaded', () => setTimeout(revealApp, 600), {
      once: true,
    });
    window.addEventListener('load', revealApp, { once: true });
  }

  function enableHeroFx() {
    if (!document.body || document.body.classList.contains('hero-fx-ready')) return;
    document.body.classList.add('hero-fx-ready');
  }
  const scheduleHeroFx = () => {
    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(enableHeroFx, { timeout: 2500 });
    } else {
      window.setTimeout(enableHeroFx, 1800);
    }
  };
  if (document.readyState === 'complete') {
    scheduleHeroFx();
  } else {
    window.addEventListener('load', scheduleHeroFx, { once: true });
  }
})();

(function normalizeCanonicalUrl() {
  try {
    const canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) return;
    const host = window.location.hostname;
    let path = window.location.pathname || '/';
    path = path.replace(/\/{2,}/g, '/');
    if (!path.startsWith('/')) path = `/${path}`;
    if (path !== '/' && path.endsWith('/')) path = path.slice(0, -1);
    const url =
      host === 'localhost' || host === '127.0.0.1'
        ? 'https://wifihackx.com/'
        : `https://wifihackx.com${path}`;
    canonical.setAttribute('href', url);
  } catch (error) {
    console.warn('Canonical URL update failed:', error);
  }
})();

(function syncSchemaWithRuntimeConfig() {
  const run = () => {
    try {
      const node = document.getElementById('schema-organization');
      if (!node) return;
      const payload = JSON.parse(node.textContent || '[]');
      const supportEmail =
        window.RuntimeConfigUtils &&
        typeof window.RuntimeConfigUtils.getSupportEmail === 'function'
          ? window.RuntimeConfigUtils.getSupportEmail('support@wifihackx.com')
          : 'support@wifihackx.com';
      const schemaPrice =
        window.RuntimeConfigUtils &&
        typeof window.RuntimeConfigUtils.getSeoSchemaPrice === 'function'
          ? window.RuntimeConfigUtils.getSeoSchemaPrice('')
          : '';

      for (let i = 0; i < payload.length; i += 1) {
        const item = payload[i];
        if (schemaPrice && item && item['@type'] === 'SoftwareApplication' && item.offers) {
          item.offers.price = String(schemaPrice);
        }
        if (item && item['@type'] === 'Organization' && Array.isArray(item.contactPoint)) {
          for (let j = 0; j < item.contactPoint.length; j += 1) {
            const point = item.contactPoint[j];
            if (point && point['@type'] === 'ContactPoint') {
              point.email = supportEmail;
            }
          }
        }
      }
      node.textContent = JSON.stringify(payload);
    } catch (error) {
      console.warn('[runtime-config] schema update failed', error);
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run, { once: true });
  } else {
    run();
  }
})();

(function loadDeferredThirdParties() {
  function loadScript(opts) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.async = true;
      script.src = opts.src;
      if (opts.integrity) script.integrity = opts.integrity;
      if (opts.crossorigin) script.crossOrigin = opts.crossorigin;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Failed to load ${opts.src}`));
      document.head.appendChild(script);
    });
  }

  const afterInteractive = fn => {
    if (document.readyState === 'interactive' || document.readyState === 'complete') {
      fn();
    } else {
      document.addEventListener('DOMContentLoaded', fn, { once: true });
    }
  };

  afterInteractive(() => {
    loadScript({
      src: 'https://cdn.jsdelivr.net/npm/dompurify@3.2.3/dist/purify.min.js',
      integrity: 'sha384-osZDKVu4ipZP703HmPOhWdyBajcFyjX2Psjk//TG1Rc0AdwEtuToaylrmcK3LdAl',
      crossorigin: 'anonymous',
    }).catch(() => {});

    loadScript({
      src: 'https://unpkg.com/lucide@0.263.0/dist/umd/lucide.min.js',
      integrity: 'sha384-JNhb/AfQ8tCvhjfm2WXKx9qovmn7LcndXYllHYDf2CcTBaBMAiPsjRJeC3f9U8V6',
      crossorigin: 'anonymous',
    })
      .then(() => {
        try {
          if (window.lucide && typeof window.lucide.createIcons === 'function') {
            window.lucide.createIcons({ nameAttr: 'data-lucide' });
          }
        } catch (error) {
          console.warn('Lucide icon initialization failed:', error);
        }
      })
      .catch(() => {});

    setTimeout(() => {
      loadScript({
        src: 'https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js',
        integrity: 'sha384-SALc35EccAf6RzGw4iNsyj7kTPr33K7RoGzYu+7heZhT8s0GZouafRiCg1qy44AS',
        crossorigin: 'anonymous',
      }).catch(() => {});

      loadScript({
        src: 'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js',
        integrity: 'sha384-9nhczxUqK87bcKHh20fSQcTGD4qq5GhayNYSYWqwBkINBhOfQLg/P5HG5lF1urn4',
        crossorigin: 'anonymous',
      }).catch(() => {});
    }, 1200);
  });
})();
