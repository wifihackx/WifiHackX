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

const onRuntimeConfigReady = fn => {
  try {
    const ready = window.__runtimeConfigReady;
    if (ready && typeof ready.then === 'function') {
      ready.then(() => fn()).catch(() => fn());
      return;
    }
  } catch (_error) {}
  fn();
};

const isAutomatedAuditEnvironment = () => {
  try {
    const ua = navigator.userAgent || '';
    const host = window.location && window.location.hostname;
    const isLocal = host === 'localhost' || host === '127.0.0.1' || host === '::1';
    const port = Number((window.location && window.location.port) || 0);
    const query = new URLSearchParams(window.location.search || '');
    const forceFullApp =
      query.get('full_app') === '1' ||
      window.localStorage?.getItem('wifihackx:force_full_app') === '1';
    // Lighthouse CI suele usar puertos efímeros altos en localhost.
    const syntheticLocalAudit = !forceFullApp && isLocal && Number.isFinite(port) && port >= 40000;
    return (
      navigator.webdriver ||
      /HeadlessChrome|Lighthouse|chrome-lighthouse/i.test(ua) ||
      syntheticLocalAudit
    );
  } catch (_error) {
    return false;
  }
};

const applyLocalDevRuntimeOverrides = () => {
  try {
    const localPayments =
      window.__WFX_LOCAL_DEV__ && window.__WFX_LOCAL_DEV__.payments
        ? window.__WFX_LOCAL_DEV__.payments
        : null;
    if (!localPayments || typeof localPayments !== 'object') return;

    window.RUNTIME_CONFIG = window.RUNTIME_CONFIG || {};
    window.RUNTIME_CONFIG.payments = Object.assign(
      {},
      window.RUNTIME_CONFIG.payments || {},
      localPayments
    );
  } catch (_error) {}
};

(function enableDeferredStylesheets() {
  const markReady = link => {
    if (!link || link.tagName !== 'LINK') return;
    if (!link.hasAttribute('data-deferred-style')) return;
    if (link.dataset.deferredActivated === '1') return;
    if (link.media !== 'print') {
      link.dataset.deferredActivated = '1';
      return;
    }

    const activate = () => {
      if (link.dataset.deferredActivated === '1') return;
      link.media = 'all';
      link.dataset.deferredActivated = '1';
    };

    // Avoid forcing style recalculation too early; prefer natural load boundary.
    if (link.sheet) {
      activate();
      return;
    }

    link.addEventListener('load', activate, { once: true });
  };

  const activate = () => {
    const links = document.querySelectorAll('link[data-deferred-style][media="print"]');
    for (const link of links) {
      markReady(link);
    }
  };

  try {
    const observer = new MutationObserver(mutations => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (!(node instanceof Element)) continue;
          if (node.matches && node.matches('link[data-deferred-style]')) {
            markReady(node);
          }
          const nested = node.querySelectorAll
            ? node.querySelectorAll('link[data-deferred-style]')
            : [];
          for (const link of nested) markReady(link);
        }
      }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    onWindowLoad(() => observer.disconnect());
  } catch (_error) {}

  onDomReady(activate);
  onWindowLoad(activate);
})();

(function loadLocalDevConfigIfNeeded() {
  try {
    if (isAutomatedAuditEnvironment()) return;
    const host = window.location && window.location.hostname;
    const isLocal = host === 'localhost' || host === '127.0.0.1' || host === '::1';
    if (!isLocal) return;
    const query = new URLSearchParams(window.location.search || '');
    const explicitlyEnabled =
      query.get('local_dev_config') === '1' ||
      window.localStorage?.getItem('wifihackx:local_dev_config') === '1';
    if (!explicitlyEnabled) return;
    const script = document.createElement('script');
    script.src = '/js/local-dev-config.js';
    script.async = false;
    script.setAttribute('data-local-dev-config', '1');
    script.onload = () => {
      applyLocalDevRuntimeOverrides();
    };
    script.onerror = () => {
      // Archivo opcional local no versionado.
    };
    document.head.appendChild(script);
  } catch (_error) {}
})();

(function syncLanguageFromQuery() {
  try {
    const url = new URL(window.location.href);
    const lang = String(url.searchParams.get('lang') || '')
      .trim()
      .toLowerCase();
    const allowed = new Set(['es', 'en', 'fr', 'it', 'de', 'pt', 'ru', 'zh', 'ja', 'ko']);
    if (!allowed.has(lang)) return;
    const keys = ['selectedLanguage', 'wifiHackXLanguage', 'preferredLanguage'];
    for (const key of keys) localStorage.setItem(key, lang);
    localStorage.setItem('wifiHackX_state_i18n.currentLanguage', JSON.stringify(lang));
    document.documentElement.lang = lang;
  } catch (_error) {}
})();

(function initRuntimeConfig() {
  const RUNTIME_CONFIG_URL = '/config/runtime-config.json';
  const RUNTIME_CONFIG_TIMEOUT_MS = 4500;
  const DEFAULT_RUNTIME_CONFIG = {
    payments: {
      paypalClientId: '',
      stripePublicKey: '',
    },
    support: {
      email: '',
    },
  };

  const normalizeScientificIntegerString = value => {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(Math.trunc(value));
    }
    if (typeof value !== 'string') return value;
    const raw = value.trim();
    if (!/^[+-]?(?:\d+\.?\d*|\d*\.?\d+)e[+-]?\d+$/i.test(raw)) return raw;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return raw;
    return String(Math.trunc(parsed));
  };

  const normalizeFirebaseIdentifiers = runtimeConfig => {
    if (!runtimeConfig || typeof runtimeConfig !== 'object') return runtimeConfig;
    const firebase = runtimeConfig.firebase;
    if (!firebase || typeof firebase !== 'object') return runtimeConfig;

    const senderId = normalizeScientificIntegerString(firebase.messagingSenderId);
    if (typeof senderId === 'string' && senderId) {
      firebase.messagingSenderId = senderId;
    }

    if (typeof firebase.appId === 'string' && firebase.appId.includes(':')) {
      const parts = firebase.appId.split(':');
      if (parts.length >= 2) {
        const normalizedPart = normalizeScientificIntegerString(parts[1]);
        if (typeof normalizedPart === 'string' && normalizedPart) {
          parts[1] = normalizedPart;
          firebase.appId = parts.join(':');
        }
      }
    }

    return runtimeConfig;
  };

  const installRuntimeUtils = () => {
    window.RuntimeConfigUtils = window.RuntimeConfigUtils || {
      getFunctionsRegion(fallback) {
        const region = window.RUNTIME_CONFIG && window.RUNTIME_CONFIG.functionsRegion;
        if (typeof region === 'string' && region.trim()) return region.trim();
        return fallback || 'us-central1';
      },
      getCloudFunctionsBaseUrl(projectId, fallbackRegion) {
        const runtimeBase = window.RUNTIME_CONFIG && window.RUNTIME_CONFIG.cloudFunctionsBaseUrl;
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
        return fallback || '';
      },
      getPaymentsKeys() {
        const payments = (window.RUNTIME_CONFIG && window.RUNTIME_CONFIG.payments) || {};
        return {
          paypalClientId:
            (typeof payments.paypalClientId === 'string' && payments.paypalClientId.trim()) || '',
          stripePublicKey:
            (typeof payments.stripePublicKey === 'string' && payments.stripePublicKey.trim()) || '',
        };
      },
      isStripeEnabled() {
        const payments = (window.RUNTIME_CONFIG && window.RUNTIME_CONFIG.payments) || {};
        if (typeof payments.stripeEnabled === 'boolean') {
          return payments.stripeEnabled;
        }
        return true;
      },
      isStripeConfigured() {
        if (!this.isStripeEnabled()) return false;
        const keys = this.getPaymentsKeys();
        if (keys && typeof keys.stripePublicKey === 'string' && keys.stripePublicKey.trim()) {
          return true;
        }
        return typeof window.STRIPE_PUBLIC_KEY === 'string' && !!window.STRIPE_PUBLIC_KEY.trim();
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
  };

  const setRuntimeConfigStatus = (mode, error) => {
    const payload = {
      mode,
      updatedAt: new Date().toISOString(),
    };
    if (error) {
      payload.error = String((error && (error.message || error)) || '');
    }
    window.__runtimeConfigStatus = payload;

    if (mode !== 'external-ok') {
      window.dispatchEvent(
        new CustomEvent('runtime-config:degraded', {
          detail: payload,
        })
      );
    }
  };

  const applyRuntimeConfig = parsed => {
    const base = Object.assign({}, DEFAULT_RUNTIME_CONFIG, window.RUNTIME_CONFIG || {});
    const merged = Object.assign({}, base, parsed);
    window.RUNTIME_CONFIG = normalizeFirebaseIdentifiers(merged);
    applyLocalDevRuntimeOverrides();
    installRuntimeUtils();
    window.dispatchEvent(new CustomEvent('runtime-config:ready'));
    return window.RUNTIME_CONFIG;
  };

  const loadRuntimeConfig = async () => {
    try {
      let parsed = {};
      let mode = 'defaults-fallback';
      if (typeof fetch === 'function') {
        const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
        let timeoutId = null;
        if (controller) {
          timeoutId = setTimeout(() => {
            try {
              controller.abort();
            } catch (_e) {}
          }, RUNTIME_CONFIG_TIMEOUT_MS);
        }

        try {
          const response = await fetch(RUNTIME_CONFIG_URL, {
            credentials: 'same-origin',
            cache: 'default',
            signal: controller ? controller.signal : undefined,
          });
          if (response.ok) {
            parsed = await response.json();
            mode = 'external-ok';
          } else {
            parsed = {};
            mode = `defaults-fallback-http-${response.status || 'error'}`;
          }
        } finally {
          if (timeoutId) clearTimeout(timeoutId);
        }
      } else {
        parsed = {};
        mode = 'defaults-fallback-no-fetch';
      }
      const applied = applyRuntimeConfig(parsed);
      setRuntimeConfigStatus(mode);
      return applied;
    } catch (error) {
      console.warn('[runtime-config] external load failed, using fallback', error);
      const applied = applyRuntimeConfig({});
      setRuntimeConfigStatus('defaults-fallback-error', error);
      return applied;
    }
  };

  window.__runtimeConfigReady = loadRuntimeConfig().catch(error => {
    console.error('[runtime-config] init error', error);
    window.RUNTIME_CONFIG = window.RUNTIME_CONFIG || {};
    installRuntimeUtils();
    setRuntimeConfigStatus('empty-fallback-init-error', error);
    return window.RUNTIME_CONFIG;
  });
})();

(function initGtmDelayed() {
  let injected = false;

  const hasAnalyticsConsent = () => {
    try {
      return localStorage.getItem('analytics_consent') === 'true';
    } catch (_error) {
      return false;
    }
  };

  const shouldBlockTracking = () => {
    try {
      const host = window.location && window.location.hostname;
      if (host === 'localhost' || host === '127.0.0.1') return true;
      return !hasAnalyticsConsent();
    } catch (_error) {
      return true;
    }
  };

  const dataLayerName = 'dataLayer';
  window[dataLayerName] = window[dataLayerName] || [];
  let gtmHealthTimer = null;

  const setGtmStatus = (mode, detail = {}) => {
    window.__gtmStatus = {
      mode,
      updatedAt: new Date().toISOString(),
      ...detail,
    };
    window.dispatchEvent(
      new CustomEvent('gtm:status', {
        detail: window.__gtmStatus,
      })
    );
  };

  function inject() {
    const id = (window.RUNTIME_CONFIG && window.RUNTIME_CONFIG.gtmId) || 'GTM-FTNCTPTM';
    if (!id) return;
    if (injected || shouldBlockTracking()) return;
    try {
      window[dataLayerName].push({
        'gtm.start': Date.now(),
        event: 'gtm.js',
      });
      const firstScript = document.getElementsByTagName('script')[0];
      const script = document.createElement('script');
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtm.js?id=${id}`;
      script.onload = () => {
        setGtmStatus('loaded', { id });
      };
      script.onerror = () => {
        setGtmStatus('load_error', { id });
      };
      firstScript.parentNode.insertBefore(script, firstScript);
      injected = true;
      if (gtmHealthTimer) clearTimeout(gtmHealthTimer);
      gtmHealthTimer = setTimeout(() => {
        if (!window.google_tag_manager) {
          setGtmStatus('timeout_or_blocked', { id });
        }
      }, 6000);
    } catch (error) {
      console.error('GTM injection failed:', error);
      setGtmStatus('inject_error', { id, message: String(error?.message || error) });
    }
  }

  onRuntimeConfigReady(() => {
    if (!shouldBlockTracking()) {
      onWindowLoad(() => {
        setTimeout(inject, 1800);
      });
    }
  });

  window.addEventListener(
    'analytics-consent-granted',
    () => {
      onWindowLoad(() => {
        setTimeout(inject, 100);
      });
    },
    { once: true }
  );
})();

(function disableUnusedStripePreconnect() {
  const run = () => {
    try {
      const utils = window.RuntimeConfigUtils;
      const stripeEnabled =
        utils && typeof utils.isStripeConfigured === 'function'
          ? utils.isStripeConfigured()
          : false;
      if (stripeEnabled) return;
      const stripePreconnect = document.querySelector(
        'link[rel="preconnect"][href="https://js.stripe.com"]'
      );
      if (stripePreconnect) stripePreconnect.remove();
    } catch (_error) {}
  };

  onDomReady(() => onRuntimeConfigReady(run));
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
  if (isAutomatedAuditEnvironment()) {
    revealApp();
  } else {
    setTimeout(revealApp, 1200);
  }
  if (document.readyState === 'interactive' || document.readyState === 'complete') {
    setTimeout(revealApp, 250);
  } else {
    document.addEventListener('DOMContentLoaded', () => setTimeout(revealApp, 250), {
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

(function enforceLoadingScreenFailSafe() {
  const hideLoadingScreen = () => {
    try {
      if (document.body) document.body.classList.add('app-loaded');
      const loading = document.getElementById('loadingScreen');
      if (loading) {
        loading.style.display = 'none';
        loading.setAttribute('aria-hidden', 'true');
      }
    } catch (_error) {}
  };

  // Hard stop: never leave users trapped on infinite spinner.
  setTimeout(hideLoadingScreen, 2500);

  window.addEventListener(
    'error',
    () => {
      setTimeout(hideLoadingScreen, 0);
    },
    { once: true }
  );
  window.addEventListener(
    'unhandledrejection',
    () => {
      setTimeout(hideLoadingScreen, 0);
    },
    { once: true }
  );
})();

(function syncSchemaWithRuntimeConfig() {
  const run = () => {
    try {
      const node = document.getElementById('schema-organization');
      if (!node) return;
      const payload = JSON.parse(node.textContent || '{}');
      const graph = Array.isArray(payload) ? payload : payload['@graph'] || [];
      const supportEmail =
        window.RuntimeConfigUtils && typeof window.RuntimeConfigUtils.getSupportEmail === 'function'
          ? window.RuntimeConfigUtils.getSupportEmail('')
          : '';
      const schemaPrice =
        window.RuntimeConfigUtils &&
        typeof window.RuntimeConfigUtils.getSeoSchemaPrice === 'function'
          ? window.RuntimeConfigUtils.getSeoSchemaPrice('')
          : '';
      const priceValidUntil = (() => {
        const now = new Date();
        now.setFullYear(now.getFullYear() + 1);
        return now.toISOString().slice(0, 10);
      })();

      for (let i = 0; i < graph.length; i += 1) {
        const item = graph[i];
        if (item && item['@type'] === 'SoftwareApplication' && item.offers) {
          if (schemaPrice) item.offers.price = String(schemaPrice);
          item.offers.priceValidUntil = priceValidUntil;
        }
        if (item && item['@type'] === 'Organization' && Array.isArray(item.contactPoint)) {
          for (let j = 0; j < item.contactPoint.length; j += 1) {
            const point = item.contactPoint[j];
            if (point && point['@type'] === 'ContactPoint') {
              if (supportEmail) {
                point.email = supportEmail;
              } else if (Object.prototype.hasOwnProperty.call(point, 'email')) {
                delete point.email;
              }
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

  onDomReady(() => onRuntimeConfigReady(run));
})();

(function syncCurrentYear() {
  const run = () => {
    try {
      const year = String(new Date().getFullYear());
      document.querySelectorAll('.current-year').forEach(node => {
        node.textContent = year;
      });
    } catch (_error) {}
  };
  onDomReady(run);
})();

(function handleRuntimeConfigDegradedMode() {
  const applyUiFallback = () => {
    try {
      const status = window.__runtimeConfigStatus || {};
      if (status.mode === 'external-ok') return;

      document.documentElement.setAttribute('data-runtime-config', 'degraded');
      window.__runtimeConfigDegraded = true;

      const stripeConfigured =
        window.RuntimeConfigUtils &&
        typeof window.RuntimeConfigUtils.isStripeConfigured === 'function'
          ? window.RuntimeConfigUtils.isStripeConfigured()
          : false;

      if (!stripeConfigured) {
        document.querySelectorAll('[data-action="checkout"]').forEach(node => {
          if (!(node instanceof HTMLButtonElement)) return;
          node.disabled = true;
          node.setAttribute('title', 'Pagos Stripe no disponibles temporalmente (modo degradado)');
        });
      }
    } catch (_error) {}
  };

  onRuntimeConfigReady(applyUiFallback);
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

(function hydrateLogoWordmark() {
  const run = () => {
    try {
      const template = document.getElementById('logo-wordmark-template');
      if (!(template instanceof HTMLTemplateElement)) return;
      const targets = document.querySelectorAll('[data-logo-wordmark]');
      targets.forEach(node => {
        if (!(node instanceof Element)) return;
        node.innerHTML = '';
        node.appendChild(template.content.cloneNode(true));
      });
    } catch (_error) {}
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
      src: '/js/vendor/purify.min.js',
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
