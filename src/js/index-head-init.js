'use strict';

const onDomReady = fn => {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fn, { once: true });
  } else {
    fn();
  }
};

const onWindowLoad = fn => {
  if (document.readyState === 'complete') {
    fn();
  } else {
    window.addEventListener('load', fn, { once: true });
  }
};

(function enableDeferredStylesheets() {
  const activate = () => {
    const links = document.querySelectorAll('link[data-deferred-style][media="print"]');
    for (const link of links) {
      link.media = 'all';
    }
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', activate, { once: true });
  } else {
    activate();
  }
  onWindowLoad(activate);
})();

(function loadLocalDevConfigIfNeeded() {
  try {
    const host = window.location && window.location.hostname;
    const isLocal =
      host === 'localhost' || host === '127.0.0.1' || host === '::1';
    if (!isLocal) return;
    const script = document.createElement('script');
    script.src = '/js/local-dev-config.js';
    script.async = false;
    script.setAttribute('data-local-dev-config', '1');
    script.onerror = () => {
      // Archivo opcional local no versionado.
    };
    document.head.appendChild(script);
  } catch (_error) {}
})();

(function syncLanguageFromQuery() {
  try {
    const url = new URL(window.location.href);
    const lang = String(url.searchParams.get('lang') || '').trim().toLowerCase();
    const allowed = new Set(['es', 'en', 'fr', 'it', 'de', 'pt', 'ru', 'zh', 'ja', 'ko']);
    if (!allowed.has(lang)) return;
    const keys = ['selectedLanguage', 'wifiHackXLanguage', 'preferredLanguage'];
    for (const key of keys) localStorage.setItem(key, lang);
    localStorage.setItem('wifiHackX_state_i18n.currentLanguage', JSON.stringify(lang));
    document.documentElement.lang = lang;
  } catch (_error) {}
})();

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
      isStripeConfigured() {
        const keys = this.getPaymentsKeys();
        if (keys && typeof keys.stripePublicKey === 'string' && keys.stripePublicKey.trim()) {
          return true;
        }
        return (
          typeof window.STRIPE_PUBLIC_KEY === 'string' &&
          !!window.STRIPE_PUBLIC_KEY.trim()
        );
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

  onWindowLoad(() => {
    setTimeout(inject, 1800);
  });
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
  onWindowLoad(scheduleHeroFx);
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
      const payload = JSON.parse(node.textContent || '{}');
      const graph = Array.isArray(payload) ? payload : payload['@graph'] || [];
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

      for (let i = 0; i < graph.length; i += 1) {
        const item = graph[i];
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
      if (Array.isArray(payload)) {
        node.textContent = JSON.stringify(graph);
      } else {
        payload['@graph'] = graph;
        node.textContent = JSON.stringify(payload);
      }
    } catch (error) {
      console.warn('[runtime-config] schema update failed', error);
    }
  };

  onDomReady(run);
})();

(function hydrateSkeletonCards() {
  const run = () => {
    const grid = document.getElementById('skeletonAnnouncements');
    if (!grid) return;
    const count = Math.max(1, Number(grid.dataset.skeletonCount || 1));
    const firstCard = grid.querySelector('.skeleton-card');
    if (!firstCard) return;
    if (grid.querySelectorAll('.skeleton-card').length >= count) return;
    const fragment = document.createDocumentFragment();
    for (let i = 1; i < count; i += 1) {
      fragment.appendChild(firstCard.cloneNode(true));
    }
    grid.appendChild(fragment);
  };
  onDomReady(run);
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

  onDomReady(() => {
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
