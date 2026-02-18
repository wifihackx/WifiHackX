/**
 * Static pages language chips sync.
 */
(function () {
  'use strict';

  const storageKeys = ['selectedLanguage', 'wifiHackXLanguage', 'preferredLanguage'];
  const appStateStorageKey = 'wifiHackX_state_i18n.currentLanguage';
  const translationsUrl = 'static-pages-i18n.json';
  let translationsCache = null;
  let translationsPromise = null;
  const channelName = 'wifihackx-language';
  const langChannel =
    typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(channelName) : null;

  const getStoredLanguage = () => {
    for (const key of storageKeys) {
      const value = localStorage.getItem(key);
      if (value) return value;
    }
    return 'es';
  };

  const setStoredLanguage = lang => {
    storageKeys.forEach(key => localStorage.setItem(key, lang));
    localStorage.setItem(appStateStorageKey, JSON.stringify(lang));
    document.documentElement.lang = lang;
    window.dispatchEvent(new CustomEvent('wifihackx-language-changed', { detail: { lang } }));
    if (langChannel) {
      langChannel.postMessage({ lang });
    }
  };

  const loadTranslations = () => {
    if (translationsCache) {
      return Promise.resolve(translationsCache);
    }
    if (translationsPromise) {
      return translationsPromise;
    }
    translationsPromise = fetch(translationsUrl)
      .then(response => (response.ok ? response.json() : Promise.reject(response)))
      .then(data => {
        translationsCache = data;
        return data;
      })
      .catch(err => {
        console.warn('[static-pages-i18n] Failed to load translations:', err);
        translationsCache = null;
        return null;
      });
    return translationsPromise;
  };

  const applyTranslations = lang => {
    return loadTranslations().then(translations => {
      if (!translations) return;
      const table = translations[lang] || translations.es || {};

      document.querySelectorAll('[data-translate]').forEach(el => {
        if (el.hasAttribute('data-no-translate')) return;
        if (el.closest('[data-no-translate]')) return;

        const key = el.getAttribute('data-translate');
        if (!key) return;
        const value = table[key];
        if (value === undefined) return;

        const attr = el.getAttribute('data-translate-attr');
        if (attr) {
          el.setAttribute(attr, value);
          return;
        }

        if (
          el.tagName === 'INPUT' &&
          el.type !== 'submit' &&
          el.type !== 'button'
        ) {
          el.placeholder = value;
          return;
        }

        if (typeof value === 'string' && value.includes('<')) {
          el.innerHTML = value;
        } else {
          el.textContent = value;
        }
      });
    });
  };

  const updateActive = lang => {
    document.querySelectorAll('.lang-chip[data-lang]').forEach(chip => {
      chip.classList.toggle('active', chip.dataset.lang === lang);
    });
  };

  const init = () => {
    const chips = document.querySelectorAll('.lang-chip[data-lang]');
    if (!chips.length) return;

    const current = getStoredLanguage();
    updateActive(current);
    document.documentElement.lang = current;
    applyTranslations(current);

    chips.forEach(chip => {
      chip.addEventListener('click', () => {
        const lang = chip.dataset.lang || 'es';
        setStoredLanguage(lang);
        updateActive(lang);
        applyTranslations(lang);
      });
    });

    const applySync = lang => {
      const nextLang = lang || getStoredLanguage();
      updateActive(nextLang);
      document.documentElement.lang = nextLang;
      applyTranslations(nextLang);
    };

    window.addEventListener('storage', event => {
      if (storageKeys.includes(event.key)) {
        applySync(event.newValue);
      }
    });

    window.addEventListener('wifihackx-language-changed', event => {
      applySync(event.detail && event.detail.lang);
    });

    if (langChannel) {
      langChannel.addEventListener('message', event => {
        applySync(event.data && event.data.lang);
      });
    }

    window.addEventListener('pageshow', () => {
      applySync();
    });

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        applySync();
      }
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
