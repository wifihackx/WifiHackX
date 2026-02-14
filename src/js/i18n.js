'use strict';

function setupI18n() {

  // Validate AppState is available
  if (!window.AppState) {
    const error = new Error(
      '[i18n.js] Failed to load: window.AppState is not defined. ' +
        'Ensure app-state.js loads before i18n.js.'
    );
    console.error(error);
    throw error;
  }

  // Record load time for validation (dev only)
  if (window.LoadOrderValidator) {
    window.LoadOrderValidator.recordScriptLoad('i18n.js');
  }

  // Usar AppState global (LOCALMENTE dentro del IIFE para evitar redeclaración en scope global)
  const AppState = window.AppState;

  // Configuración de idiomas disponibles (compartida)
  window.LANGUAGE_CONFIG = window.LANGUAGE_CONFIG || {
    es: { name: 'Español', flag: 'ES' },
    en: { name: 'English', flag: 'EN' },
    de: { name: 'Deutsch', flag: 'DE' },
    fr: { name: 'Français', flag: 'FR' },
    it: { name: 'Italiano', flag: 'IT' },
    pt: { name: 'Português', flag: 'PT' },
    ru: { name: 'Русский', flag: 'RU' },
    zh: { name: '中文', flag: 'CN' },
    ja: { name: '日本語', flag: 'JP' },
    ko: { name: '한국어', flag: 'KR' },
  };

  // Initialize language state in AppState
  function initializeLanguageState() {
    // Get saved language from localStorage or default to 'es'
    const savedLanguage =
      localStorage.getItem('selectedLanguage') ||
      localStorage.getItem('wifiHackXLanguage') ||
      'es';

    // Always synchronize AppState with localStorage to ensure bidirectional sync
    // This allows language changes from static pages to propagate to index.html
    const currentLanguage = AppState.getState('i18n.currentLanguage');
    if (currentLanguage !== savedLanguage) {
      AppState.setState('i18n.currentLanguage', savedLanguage, true);
      console.log(
        `[i18n] Synchronized language from localStorage: ${currentLanguage} → ${savedLanguage}`
      );
    }

    // Initialize available languages
    const availableLanguages = AppState.getState('i18n.availableLanguages');
    if (!availableLanguages || availableLanguages.length === 0) {
      AppState.setState(
        'i18n.availableLanguages',
        Object.keys(window.LANGUAGE_CONFIG),
        true
      );
    }

    console.log(
      '[i18n] Initialized with language:',
      AppState.getState('i18n.currentLanguage')
    );
  }

  // Traducciones básicas embebidas (fallback)
  window.translations = {
    es: {
      language: 'Idioma',
      app_name: 'WifiHackX',
      professional_platform: 'Plataforma Profesional de Anuncios',
      home: 'Inicio',
      catalog: 'Catálogo',
      products: 'Productos',
      about: 'Acerca de',
      contact: 'Contacto',
      login: 'Iniciar Sesión',
      register: 'Registrarse',
      cart: 'Carrito',
      accessibility: 'Accesibilidad',
    },
    en: {
      language: 'Language',
      app_name: 'WifiHackX',
      professional_platform: 'Professional Advertising Platform',
      home: 'Home',
      catalog: 'Catalog',
      products: 'Products',
      about: 'About',
      contact: 'Contact',
      login: 'Login',
      register: 'Register',
      cart: 'Cart',
      accessibility: 'Accessibility',
    },
    // Más idiomas se cargan desde i18n.json
  };

  // Función para actualizar el selector de idioma
  function updateLanguageSelector(lang, languageName, flag) {
    const currentFlag = document.querySelector('.current-flag');
    const currentLang = document.querySelector('.current-lang');

    // Sincronizar botones .lang-btn si existen en la página
    document.querySelectorAll('.lang-btn').forEach(btn => {
      btn.classList.toggle(
        'active',
        btn.getAttribute('data-lang-target') === lang
      );
    });

    if (currentFlag && currentLang) {
      currentFlag.textContent = flag;
      // Actualizar el texto del idioma con el nombre real del idioma (English, Français, etc.)
      // NO usar la traducción de "language" porque queremos mostrar el nombre del idioma
      currentLang.textContent = languageName;
      // Asegurarse de que NO tenga data-translate para evitar que se sobrescriba
      if (currentLang.hasAttribute('data-translate')) {
        currentLang.removeAttribute('data-translate');
      }
    }
  }

  // Función para mostrar cartel de cambio de idioma
  function showLanguageToast(languageName, flag) {
    const message = `${flag} Idioma cambiado a ${languageName}`;

    if (typeof DOMUtils !== 'undefined' && DOMUtils.showNotification) {
      return DOMUtils.showNotification(message, 'success');
    } else {
      console.log(`Language Toast: ${message}`);
    }
  }

  // Función para mostrar toast de autenticación
  function showAuthToast(message, type = 'success', icon = '👤') {
    const typeMap = {
      success: 'success',
      error: 'error',
      warning: 'warning',
      admin: 'info',
    };

    const enhancedMessage = `${icon} ${message}`;

    if (typeof DOMUtils !== 'undefined' && DOMUtils.showNotification) {
      return DOMUtils.showNotification(
        enhancedMessage,
        typeMap[type] || 'success'
      );
    } else {
      console.log(`Auth Toast: ${enhancedMessage} (${type})`);
    }
  }

  // Cargar traducciones desde archivo externo
  function loadTranslations() {
    return fetch('i18n.json')
      .then(response => response.json())
      .then(translations => {
        // Mezclar traducciones externas con las embebidas
        window.translations = {
          ...window.translations,
          ...translations,
        };
        window.translationsLoaded = true;
        console.log('✅ Traducciones cargadas desde archivo externo');
        return window.translations;
      })
      .catch(error => {
        console.warn(
          '⚠️ No se pudo cargar i18n.json, usando traducciones embebidas:',
          error.message
        );
        window.translationsLoaded = true;
        return window.translations;
      });
  }

  // Función auxiliar para traducir texto
  function translate(key, lang = 'es') {
    if (!window.translations || !window.translations[lang]) {
      return key;
    }
    return window.translations[lang][key] || key;
  }

  function getStoredLanguage() {
    return (
      localStorage.getItem('selectedLanguage') ||
      localStorage.getItem('wifiHackXLanguage') ||
      localStorage.getItem('preferredLanguage') ||
      'es'
    );
  }

  // Función para aplicar traducciones
  function applyTranslations(lang) {
    const translations = window.translations[lang];
    if (!translations) {
      console.warn('⚠️ No hay traducciones para el idioma:', lang);
      return;
    }

    // Actualizar el atributo lang del HTML
    document.documentElement.setAttribute('lang', lang);

    // Aplicar traducciones a elementos con data-translate
    // Excluir el selector de idioma para que muestre el nombre del idioma, no la palabra "Idioma/Language"
    document.querySelectorAll('[data-translate]').forEach(element => {
      // Saltar el elemento .current-lang del selector de idiomas
      if (element.classList.contains('current-lang')) {
        return;
      }

      // Saltar elementos marcados explícitamente como no traducibles
      if (element.hasAttribute('data-no-translate')) {
        return;
      }

      // Saltar elementos dentro de contenedores marcados como no traducibles
      if (element.closest('[data-no-translate]')) {
        return;
      }

      // Saltar elementos dentro de la descripción del anuncio
      if (
        element.closest('.announcement-detail-description') ||
        element.closest('.description-content')
      ) {
        return;
      }

      const key = element.getAttribute('data-translate');
      if (translations[key]) {
        const attr = element.getAttribute('data-translate-attr');
        if (attr) {
          const attrs = attr
            .split(',')
            .map(item => item.trim())
            .filter(Boolean);
          attrs.forEach(attributeEntry => {
            const [attributeNameRaw, keyOverrideRaw] =
              attributeEntry.split(':');
            const attributeName = attributeNameRaw.trim();
            const keyOverride = keyOverrideRaw
              ? keyOverrideRaw.trim()
              : null;
            const translationKey = keyOverride || key;
            const value = translations[translationKey] || translationKey;
            element.setAttribute(attributeName, value);
          });
          return;
        }
        // Si es un elemento de input, actualizar placeholder
        if (
          element.tagName === 'INPUT' &&
          element.type !== 'submit' &&
          element.type !== 'button'
        ) {
          element.placeholder = translations[key];
        } else if (element.tagName === 'SPAN' || element.tagName === 'BUTTON') {
          // Para SPAN y BUTTON, usar textContent (son elementos simples)
          element.textContent = translations[key];
        } else {
          // Para otros elementos (DIV, P, etc.), usar innerHTML para preservar formato
          // pero solo si no contiene elementos hijos complejos
          if (element.children.length === 0) {
            element.textContent = translations[key];
          } else {
            // Si tiene hijos, no traducir (probablemente es contenido complejo como descripción)
            console.log(
              '[i18n] Saltando traduccion de elemento complejo:',
              element
            );
          }
        }
      }
    });

    // Actualizar títulos y meta tags si existen
    const titleElement = document.querySelector('title');
    if (titleElement && translations.app_name) {
      // Mantener el título original pero actualizar si hay traducción específica
      const originalTitle =
        titleElement.getAttribute('data-original-title') ||
        titleElement.textContent;
      if (!titleElement.getAttribute('data-original-title')) {
        titleElement.setAttribute('data-original-title', originalTitle);
      }
    }

    // NUEVO: Soporte para patrón de alternancia [data-lang]
    // Utilizado en páginas secundarias para contenido largo (About, FAQ, Privacy, Terms)
    // Se excluyen los elementos con clase .language-option para evitar ocultar el menú de selección
    document
      .querySelectorAll('[data-lang]:not(.language-option)')
      .forEach(element => {
        if (element.getAttribute('data-lang') === lang) {
          element.classList.remove('hidden');
        } else {
          element.classList.add('hidden');
        }
      });

    console.log('✅ Traducciones aplicadas para:', lang);
  }

  // Función interna para aplicar idioma sin notificación (para carga inicial)
  function applyLanguage(lang, showNotification = false) {
    // NO escribir en localStorage aquí - el observer de AppState lo hará
    // Esto evita condiciones de carrera y mantiene una única fuente de escritura

    // Update AppState (esto disparará el observer que guarda en localStorage)
    AppState.setState('i18n.currentLanguage', lang);

    // Backward compatibility: update window.currentLanguage
    window.currentLanguage = lang;

    // Obtener configuración del idioma
    const config = window.LANGUAGE_CONFIG[lang];

    if (!config) {
      console.error('❌ Idioma no soportado:', lang);
      return;
    }

    // Aplicar traducciones PRIMERO (antes de actualizar el selector)
    if (window.translations && window.translations[lang]) {
      applyTranslations(lang);
    } else {
      console.warn('⚠️ No hay traducciones disponibles para:', lang);
    }

    // Actualizar selector de idioma DESPUÉS (para que muestre el nombre del idioma, no la palabra traducida)
    updateLanguageSelector(lang, config.name, config.flag);

    // Mostrar notificación SOLO si se solicita (cuando el usuario cambia manualmente)
    if (showNotification) {
      showLanguageToast(config.name, config.flag);
    }

    // Actualizar atributo lang del HTML
    document.documentElement.setAttribute('lang', lang);
  }

  function syncLanguageFromStorage(reason = 'storage-sync') {
    const savedLang = getStoredLanguage();
    const currentLang = AppState.getState('i18n.currentLanguage') || 'es';

    if (!savedLang || savedLang === currentLang) {
      return;
    }

    console.log(
      `[i18n] Syncing language from storage (${reason}): ${currentLang} → ${savedLang}`
    );
    applyLanguage(savedLang, false);
  }

  // Función principal para cambiar idioma (con notificación)
  function changeLanguage(lang) {
    applyLanguage(lang, true);
  }

  // Inicializar sistema de idiomas
  function initLanguageSystem() {
    // Initialize AppState for i18n
    initializeLanguageState();

    // Get current language from AppState AFTER synchronization
    // This ensures we use the value from localStorage, not a stale AppState value
    const _savedLang = AppState.getState('i18n.currentLanguage') || 'es';

    // Cargar traducciones
    window.translationsLoadedPromise = loadTranslations();

    // Aplicar idioma inicial después de cargar traducciones (SIN notificación)
    window.translationsLoadedPromise.then(() => {
      // Re-read from AppState to ensure we have the latest synchronized value
      const currentLang = AppState.getState('i18n.currentLanguage') || 'es';
      applyLanguage(currentLang, false); // false = no mostrar notificación en carga inicial
    });

    // Set up observer for language changes (for programmatic changes or from other tabs)
    AppState.subscribe('i18n.currentLanguage', (newLang, oldLang) => {
      if (newLang !== oldLang && newLang) {
        console.log(`[i18n] Language changed: ${oldLang} → ${newLang}`);

        // Apply translations for new language
        if (window.translations && window.translations[newLang]) {
          applyTranslations(newLang);

          // Update selector
          const config = window.LANGUAGE_CONFIG[newLang];
          if (config) {
            updateLanguageSelector(newLang, config.name, config.flag);
          }

          // Update HTML lang attribute
          document.documentElement.setAttribute('lang', newLang);

          // Update backward compatibility
          window.currentLanguage = newLang;
        }
      }
    });

    // Set up observer for persistence (save to localStorage when language changes)
    AppState.subscribe('i18n.currentLanguage', newLang => {
      if (newLang) {
        localStorage.setItem('selectedLanguage', newLang);
        localStorage.setItem('wifiHackXLanguage', newLang);
        localStorage.setItem('preferredLanguage', newLang);
        console.log(`[i18n] Language persisted: ${newLang}`);
      }
    });

    console.log('[i18n] Language system initialized with AppState v2.0');
  }

  // Exponer funciones globalmente
  window.changeLanguage = changeLanguage;
  window.translate = translate;
  window.applyTranslations = applyTranslations;
  window.updateLanguageSelector = updateLanguageSelector;
  window.showLanguageToast = showLanguageToast;
  window.showAuthToast = showAuthToast;
  window.initLanguageSystem = initLanguageSystem;

  // Escuchar cambios desde otras pestañas o modales
  window.addEventListener('storage', e => {
    if (
      (e.key === 'selectedLanguage' || e.key === 'wifiHackXLanguage') &&
      e.newValue &&
      e.newValue !== AppState.getState('i18n.currentLanguage')
    ) {
      // Update AppState (this will trigger observers)
      AppState.setState('i18n.currentLanguage', e.newValue);
    }
  });

  window.addEventListener('pageshow', event => {
    if (event.persisted) {
      syncLanguageFromStorage('pageshow');
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      syncLanguageFromStorage('visibilitychange');
    }
  });

  // Auto-inicializar cuando el DOM esté listo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLanguageSystem);
  } else {
    initLanguageSystem();
  }
}

export function initI18n() {
  if (window.__I18N_INITED__) {
    return;
  }

  window.__I18N_INITED__ = true;
  setupI18n();
}

if (typeof window !== 'undefined' && !window.__I18N_NO_AUTO__) {
  initI18n();
}
