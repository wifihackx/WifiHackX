/**
 * Analytics Cards Generator - Genera tarjetas de métricas dinámicamente
 * Reduce código HTML duplicado en index.html
 *
 * @version 1.0.0
 */

'use strict';

function setupAnalyticsCardsGenerator() {

  /**
   * Configuración de las tarjetas de analytics
   */
  const ANALYTICS_CARDS_CONFIG = [
    {
      title: 'Conversión',
      valueId: 'conversionRate',
      changeId: 'conversionChange',
      defaultValue: 'Cargando...',
      defaultChange: '--',
    },
    {
      title: 'Tiempo Promedio',
      valueId: 'avgTime',
      changeId: 'avgTimeChange',
      defaultValue: 'Cargando...',
      defaultChange: '--',
    },
    {
      title: 'Páginas/Sesión',
      valueId: 'pagesPerSession',
      changeId: 'pagesChange',
      defaultValue: 'Cargando...',
      defaultChange: '--',
    },
    {
      title: 'Tasa de Rebote',
      valueId: 'bounceRate',
      changeId: 'bounceRateChange',
      defaultValue: 'Cargando...',
      defaultChange: '--',
    },
  ];

  /**
   * Genera el HTML de una tarjeta de analytics
   * @param {Object} config - Configuración de la tarjeta
   * @returns {string} HTML de la tarjeta
   */
  function generateAnalyticsCard(config) {
    return `
            <div class="analytics-card">
                <h3>${config.title}</h3>
                <div class="metric-value" id="${config.valueId}">
                    ${config.defaultValue}
                </div>
                <div class="metric-change" id="${config.changeId}">${config.defaultChange}</div>
            </div>
        `;
  }

  /**
   * Renderiza todas las tarjetas de analytics
   */
  function renderAnalyticsCards() {
    const container = document.querySelector('.analytics-summary');

    if (!container) {
      console.warn('[AnalyticsCards] Container .analytics-summary not found');
      return;
    }

    // Generar HTML de todas las tarjetas
    const cardsHTML = ANALYTICS_CARDS_CONFIG.map(config =>
      generateAnalyticsCard(config)
    ).join('');

    // Insertar en el contenedor de forma segura
    if (
      window.XSSProtection &&
      typeof XSSProtection.setInnerHTML === 'function'
    ) {
      XSSProtection.setInnerHTML(container, cardsHTML);
    } else {
      // Fallback si XSSProtection no está disponible
      container.innerHTML = cardsHTML;
    }

    console.info(
      '[AnalyticsCards] Rendered',
      ANALYTICS_CARDS_CONFIG.length,
      'analytics cards'
    );
  }

  /**
   * Inicializar cuando el DOM esté listo
   */
  function init() {
    // Si el contenedor ya existe, renderizar inmediatamente
    const container = document.querySelector('.analytics-summary');
    if (container) {
      renderAnalyticsCards();
      return;
    }

    // --- Initialization ---
    if (window.DOMUtils && window.DOMUtils.ComponentLifecycle) {
      window.DOMUtils.ComponentLifecycle.init({
        name: 'AnalyticsCards',
        containerId: 'analytics-cards-container',
        renderFn: renderAnalyticsCards,
      });
    } else {
      // Legacy Fallback
      document.addEventListener('DOMContentLoaded', renderAnalyticsCards);
    }
  }

  // Exponer función globalmente para uso externo si es necesario
  window.AnalyticsCardsGenerator = {
    render: renderAnalyticsCards,
    config: ANALYTICS_CARDS_CONFIG,
  };

  // Inicializar
  init();
}

function initAnalyticsCardsGenerator() {
  if (window.__ANALYTICS_CARDS_GENERATOR_INITED__) {
    return;
  }

  window.__ANALYTICS_CARDS_GENERATOR_INITED__ = true;
  setupAnalyticsCardsGenerator();
}

if (typeof window !== 'undefined' && !window.__ANALYTICS_CARDS_GENERATOR_NO_AUTO__) {
  initAnalyticsCardsGenerator();
}


