/**
 * Generators Bundle - Consolidación de scripts generadores
 * Versión: 1.0.0
 * Descripción: Combina filter-buttons, language-options, settings-cards y analytics-cards
 */

'use strict';

const debugLog = (...args) => {
  if (window.__WFX_DEBUG__ === true) {
    console.info(...args);
  }
};

function setupGeneratorsBundle() {

  // Consolidación de generadores
  const GeneratorsBundle = {
    // Filter Buttons Generator
    renderFilterButtons: function (count = 5) {
      debugLog(`[FilterButtons] Rendered ${count} filter buttons`);
      return Array.from(
        { length: count },
        (_, i) =>
          `<button class="filter-btn" data-filter="filter${i + 1}">Filter ${i + 1}</button>`
      ).join('');
    },

    // Language Options Generator
    renderLanguageOptions: function (count = 8) {
      debugLog(`[LanguageOptions] Rendered ${count} language options`);
      return Array.from(
        { length: count },
        (_, i) => `<option value="lang${i + 1}">Language ${i + 1}</option>`
      ).join('');
    },

    // Settings Cards Generator
    renderSettingsCards: function (count = 3) {
      debugLog(`[SettingsCards] Rendered ${count} settings cards`);
      return Array.from(
        { length: count },
        (_, i) => `<div class="settings-card">Setting ${i + 1}</div>`
      ).join('');
    },

    // Analytics Cards Generator
    renderAnalyticsCards: function (count = 4) {
      debugLog(`[AnalyticsCards] Rendered ${count} analytics cards`);
      return Array.from(
        { length: count },
        (_, i) => `<div class="analytics-card">Analytics ${i + 1}</div>`
      ).join('');
    },

    init: function () {
      debugLog('[GeneratorsBundle] Bundle inicializado');
    },
  };

  // Exponer globalmente
  window.GeneratorsBundle = GeneratorsBundle;

  // Auto-inicialización
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () =>
      GeneratorsBundle.init()
    );
  } else {
    GeneratorsBundle.init();
  }
}

function initGeneratorsBundle() {
  if (window.__GENERATORS_BUNDLE_INITED__) {
    return;
  }

  window.__GENERATORS_BUNDLE_INITED__ = true;
  setupGeneratorsBundle();
}

if (typeof window !== 'undefined' && !window.__GENERATORS_BUNDLE_NO_AUTO__) {
  initGeneratorsBundle();
}


