/**
 * Language Options Generator - Genera opciones de idioma dinámicamente
 * Reduce código HTML duplicado en index.html
 *
 * @version 1.0.0
 */

'use strict';

function setupLanguageOptionsGenerator() {

  /**
   * Configuración de idiomas disponibles (compartida si existe)
   */
  const DEFAULT_LANGUAGES_CONFIG = [
    {
      code: 'es',
      flag: 'ES',
      name: 'Español',
      ariaLabel: 'Cambiar idioma a Español',
    },
    {
      code: 'en',
      flag: 'EN',
      name: 'English',
      ariaLabel: 'Change language to English',
    },
    {
      code: 'de',
      flag: 'DE',
      name: 'Deutsch',
      ariaLabel: 'Sprache zu Deutsch ändern',
    },
    {
      code: 'fr',
      flag: 'FR',
      name: 'Français',
      ariaLabel: 'Changer la langue en Français',
    },
    {
      code: 'it',
      flag: 'IT',
      name: 'Italiano',
      ariaLabel: 'Cambia lingua in Italiano',
    },
    {
      code: 'pt',
      flag: 'PT',
      name: 'Português',
      ariaLabel: 'Mudar idioma para Português',
    },
    {
      code: 'ru',
      flag: 'RU',
      name: 'Русский',
      ariaLabel: 'Изменить язык на Русский',
    },
    {
      code: 'zh',
      flag: 'CN',
      name: '中文',
      ariaLabel: '将语言更改为中文',
    },
  ];

  function getLanguagesConfig() {
    if (window.LANGUAGE_CONFIG) {
      return Object.entries(window.LANGUAGE_CONFIG).map(([code, data]) => ({
        code,
        flag: data.flag || code.toUpperCase(),
        name: data.name || code,
        ariaLabel:
          data.ariaLabel ||
          `Cambiar idioma a ${data.name || code.toUpperCase()}`,
      }));
    }
    return DEFAULT_LANGUAGES_CONFIG;
  }

  /**
   * Genera el HTML de una opción de idioma
   * @param {Object} lang - Configuración del idioma
   * @returns {string} HTML de la opción
   */
  function generateLanguageOption(lang) {
    return `
            <div class="language-option" data-lang="${lang.code}" data-action="select-language" role="menuitem" aria-label="${lang.ariaLabel}">
                <span class="option-flag" aria-hidden="true">${lang.flag}</span>
                <span class="option-name">${lang.name}</span>
            </div>
        `;
  }

  /**
   * Renderiza todas las opciones de idioma
   */
  function renderLanguageOptions() {
    const container = document.getElementById('languageDropdown');

    if (!container) {
      console.warn('[LanguageOptions] Container #languageDropdown not found');
      return;
    }

    // Generar HTML de todas las opciones
    const optionsHTML = getLanguagesConfig().map(lang =>
      generateLanguageOption(lang)
    ).join('');

    // Insertar en el contenedor
    // SAFE: Internal template - language options from static config
    container.innerHTML = optionsHTML;

    console.info(
      '[LanguageOptions] Rendered',
      getLanguagesConfig().length,
      'language options'
    );
  }

  /**
   * Inicializar cuando el DOM esté listo
   */
  function init() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', renderLanguageOptions);
    } else {
      renderLanguageOptions();
    }
  }

  // Exponer función globalmente para uso externo si es necesario
  window.LanguageOptionsGenerator = {
    render: renderLanguageOptions,
    config: getLanguagesConfig(),
  };

  // Inicializar
  init();
}

export function initLanguageOptionsGenerator() {
  if (window.__LANGUAGE_OPTIONS_GENERATOR_INITED__) {
    return;
  }

  window.__LANGUAGE_OPTIONS_GENERATOR_INITED__ = true;
  setupLanguageOptionsGenerator();
}

if (typeof window !== 'undefined' && !window.__LANGUAGE_OPTIONS_GENERATOR_NO_AUTO__) {
  initLanguageOptionsGenerator();
}

