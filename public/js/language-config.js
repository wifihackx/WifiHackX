/**
 * Shared language configuration for i18n and UI generators.
 */
(function () {
  'use strict';

  if (window.LANGUAGE_CONFIG) {
    return;
  }

  window.LANGUAGE_CONFIG = {
    es: {
      name: 'Español',
      flag: 'ES',
      ariaLabel: 'Cambiar idioma a Español',
    },
    en: {
      name: 'English',
      flag: 'EN',
      ariaLabel: 'Change language to English',
    },
    de: {
      name: 'Deutsch',
      flag: 'DE',
      ariaLabel: 'Sprache zu Deutsch ändern',
    },
    fr: {
      name: 'Français',
      flag: 'FR',
      ariaLabel: 'Changer la langue en Français',
    },
    it: {
      name: 'Italiano',
      flag: 'IT',
      ariaLabel: 'Cambia lingua in Italiano',
    },
    pt: {
      name: 'Português',
      flag: 'PT',
      ariaLabel: 'Mudar idioma para Português',
    },
    ru: {
      name: 'Русский',
      flag: 'RU',
      ariaLabel: 'Изменить язык на Русский',
    },
    zh: {
      name: '中文',
      flag: 'CN',
      ariaLabel: '将语言更改为中文',
    },
    ja: {
      name: '日本語',
      flag: 'JP',
      ariaLabel: '言語を日本語に変更',
    },
    ko: {
      name: '한국어',
      flag: 'KR',
      ariaLabel: '언어를 한국어로 변경',
    },
  };
})();
