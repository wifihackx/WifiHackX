/**
 * Static Pages i18n Synchronization
 * Version: 2.0.0
 *
 * Sincroniza el selector de idioma de las páginas estáticas con el sistema global de i18n.
 * Funciona directamente con localStorage sin depender de AppState.
 */

(function () {
  'use strict';

  const debugLog = (...args) => {
    if (window.__WFX_DEBUG__ === true) {
      console.info(...args);
    }
  };

  // Fallback del logger
  const logSystem = window.Logger || {
    info: (m, c) => debugLog(`[${c}] ${m}`),
    warn: (m, c) => console.warn(`[${c}] ${m}`),
    error: (m, c, d) => console.error(`[${c}] ${m}`, d),
    debug: (m, c) => debugLog(`[DEBUG][${c}] ${m}`),
  };
  const CAT = window.LOG_CATEGORIES || {
    UI: 'UI',
    INIT: 'INIT',
    ERR: 'ERR',
  };

  logSystem.info('Initializing language synchronization...', CAT.INIT);

  function getStorage() {
    try {
      return window.localStorage;
    } catch (_error) {
      logSystem.debug(
        'localStorage unavailable (sandboxed or blocked); using in-memory language only',
        CAT.UI
      );
      return null;
    }
  }

  const storage = getStorage();

  /**
   * Aplica el idioma seleccionado
   */
  function applyLanguage(lang) {
    logSystem.debug(`Applying language: ${lang}`, CAT.UI);

    // Guardar en localStorage cuando esté disponible (evita DOMException en iframes sandbox)
    if (storage) {
      try {
        storage.setItem('selectedLanguage', lang);
        storage.setItem('wifiHackXLanguage', lang); // Retrocompatibilidad
        storage.setItem('preferredLanguage', lang); // Retrocompatibilidad
      } catch (error) {
        logSystem.warn(`Failed to persist language: ${error.message}`, CAT.UI);
      }
    }

    // Actualizar atributo lang del HTML
    document.documentElement.setAttribute('lang', lang);

    // Actualizar botones activos (legacy .lang-btn y nuevo .lang-chip)
    document.querySelectorAll('.lang-btn, .lang-chip').forEach(btn => {
      const btnLang = btn.getAttribute('data-lang-target') || btn.getAttribute('data-lang');
      if (btnLang === lang) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Ocultar/mostrar contenido según idioma usando [data-lang]
    document.querySelectorAll('[data-lang]').forEach(element => {
      if (element.getAttribute('data-lang') === lang) {
        element.classList.remove('hidden');
      } else {
        element.classList.add('hidden');
      }
    });

    logSystem.info(`Language applied: ${lang}`, CAT.UI);
  }

  /**
   * Inicializa los event listeners para los botones de idioma
   */
  function initLanguageButtons() {
    const langButtons = document.querySelectorAll(
      '.lang-btn[data-lang-target], .lang-chip[data-lang]'
    );

    if (langButtons.length === 0) {
      logSystem.debug('No language buttons found on this page (skipped)', CAT.UI);
      return;
    }

    logSystem.debug(`Found ${langButtons.length} language buttons`, CAT.UI);

    langButtons.forEach(button => {
      button.addEventListener('click', () => {
        const targetLang =
          button.getAttribute('data-lang-target') || button.getAttribute('data-lang');

        if (!targetLang) {
          logSystem.error('Button missing data-lang-target attribute', CAT.UI);
          return;
        }

        logSystem.debug(`Language button clicked: ${targetLang}`, CAT.UI);
        applyLanguage(targetLang);
      });
    });
  }

  /**
   * Sincroniza el idioma actual al cargar la página
   */
  function syncLanguageOnLoad() {
    // Obtener el idioma guardado directamente de localStorage
    let savedLang = 'es';
    if (storage) {
      try {
        savedLang =
          storage.getItem('selectedLanguage') || storage.getItem('wifiHackXLanguage') || 'es';
      } catch (error) {
        logSystem.warn(`Failed to read persisted language: ${error.message}`, CAT.UI);
      }
    }

    logSystem.debug(`Syncing with saved language: ${savedLang}`, CAT.UI);
    applyLanguage(savedLang);
  }

  // Inicializar cuando el DOM esté listo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      initLanguageButtons();
      syncLanguageOnLoad();
    });
  } else {
    initLanguageButtons();
    syncLanguageOnLoad();
  }

  logSystem.info('Module loaded', CAT.INIT);
})();
