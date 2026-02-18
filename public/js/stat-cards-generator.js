/**
 * Stat Cards Generator - Genera tarjetas de estadísticas dinámicamente
 * Reduce código HTML duplicado en index.html
 *
 * @version 1.0.0
 */

'use strict';

const debugLog = (...args) => {
  if (window.__WFX_DEBUG__ === true) {
    console.info(...args);
  }
};

function setupStatCardsGenerator() {

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

  /**
   * Configuración de las tarjetas de estadísticas
   */
  const STAT_CARDS_CONFIG = [
    {
      icon: 'users',
      iconClass: 'users',
      title: 'Usuarios Totales',
      valueId: 'usersCount',
      changeId: 'usersChange',
      defaultValue: '0',
      defaultChange: 'Sin usuarios',
      clickable: true,
      action: 'showFullUsersList',
    },
    {
      icon: 'eye',
      iconClass: 'eye',
      title: 'Visitas Totales',
      valueId: 'visitsCount',
      changeId: 'visitsChange',
      defaultValue: '0',
      defaultChange: 'Sin visitas',
      hasAction: true,
      actionIcon: 'trash-2',
      actionTitle: 'Limpiar historial de visitas',
      actionId: 'resetVisitsBtn',
      action: 'resetVisits',
    },
    {
      icon: 'package',
      iconClass: 'package',
      title: 'Productos',
      valueId: 'productsCount',
      changeId: 'productsChange',
      defaultValue: '0',
      defaultChange: 'Sin productos',
    },
    {
      icon: 'shopping-bag',
      iconClass: 'shopping-bag',
      title: 'Compras',
      valueId: 'ordersCount',
      changeId: 'ordersChange',
      defaultValue: '0',
      defaultChange: 'Sin compras',
      clickable: true,
      action: 'showPurchasesList',
    },
    {
      icon: 'euro',
      iconClass: 'euro',
      title: 'Ingresos',
      valueId: 'revenueAmount',
      changeId: 'revenueChange',
      defaultValue: '€0.00',
      defaultChange: 'Sin ingresos',
    },
    {
      icon: 'credit-card',
      iconClass: 'credit-card',
      title: 'Estado Pagos',
      valueId: 'paymentsStatus',
      changeId: 'paymentsChange',
      defaultValue: 'Sin datos',
      defaultChange: 'Esperando señales',
      clickable: true,
      cardAction: 'openPaymentsStatus',
      hasAction: true,
      actionIcon: 'activity',
      actionTitle: 'Verificar pagos',
      actionId: 'paymentsStatusRefresh',
      action: 'refreshPaymentsStatus',
    },
  ];

  /**
   * Genera el HTML de una tarjeta de estadística
   * @param {Object} config - Configuración de la tarjeta
   * @returns {string} HTML de la tarjeta
   */
  function generateStatCard(config) {
    const clickAction = config.cardAction || config.action;
    const clickableAttr = config.clickable
      ? `data-action="${clickAction}" style="cursor: pointer;"`
      : '';
    const resetBtn = config.hasAction
      ? `
        <button class="stat-action-btn premium-btn" id="${config.actionId}" title="${config.actionTitle}" data-action="${config.action}">
            <i data-lucide="${config.actionIcon}"></i>
        </button>
    `
      : '';

    return `
            <div class="stat-card" ${clickableAttr}>
                <div class="stat-icon ${config.iconClass}">
                    <i data-lucide="${config.icon}"></i>
                </div>
                <div class="stat-content">
                    <div class="stat-header">
                        <h3>${config.title}</h3>
                        ${resetBtn}
                    </div>
                    <div class="stat-value" id="${config.valueId}">${config.defaultValue}</div>
                    <div class="stat-change neutral" id="${config.changeId}">
                        ${config.defaultChange}
                    </div>
                </div>
            </div>
        `;
  }

  /**
   * Renderiza todas las tarjetas de estadísticas
   */
  function renderStatCards() {
    const container = document.getElementById('dashboardStatsContainer');

    if (!container) {
      logSystem.warn('Container #dashboardStatsContainer not found', CAT.UI);
      return;
    }

    // Generar HTML de todas las tarjetas
    const cardsHTML = STAT_CARDS_CONFIG.map(config =>
      generateStatCard(config)
    ).join('');

    // Insertar en el contenedor de forma segura
    if (
      window.XSSProtection &&
      typeof XSSProtection.setInnerHTML === 'function'
    ) {
      XSSProtection.setInnerHTML(container, cardsHTML);
    } else {
      // SAFE: Internal template - stat cards with data from Firestore
      // Fallback if XSSProtection is not available
      container.innerHTML = cardsHTML;
    }

    // Re-inicializar iconos de Lucide si está disponible
    if (
      typeof lucide !== 'undefined' &&
      typeof lucide.createIcons === 'function'
    ) {
      lucide.createIcons();
    }

    logSystem.debug(`Rendered ${STAT_CARDS_CONFIG.length} stat cards`, CAT.UI);
  }

  /**
   * Inicializar cuando el DOM esté listo
   */
  function init() {
    // Si el contenedor ya existe, renderizar inmediatamente
    const container = document.getElementById('dashboardStatsContainer');
    if (container) {
      renderStatCards();
      return;
    }

    // --- Initialization ---
    if (window.DOMUtils && window.DOMUtils.ComponentLifecycle) {
      window.DOMUtils.ComponentLifecycle.init({
        name: 'StatCards',
        containerId: 'dashboardStatsContainer',
        renderFn: renderStatCards,
      });
    } else {
      // Legacy Fallback
      document.addEventListener('DOMContentLoaded', renderStatCards);
    }
  }

  // Exponer función globalmente para uso externo si es necesario
  window.StatCardsGenerator = {
    render: renderStatCards,
    config: STAT_CARDS_CONFIG,
  };

  // Inicializar
  init();
}

export function initStatCardsGenerator() {
  if (window.__STAT_CARDS_GENERATOR_INITED__) {
    return;
  }

  window.__STAT_CARDS_GENERATOR_INITED__ = true;
  setupStatCardsGenerator();
}

if (typeof window !== 'undefined' && !window.__STAT_CARDS_GENERATOR_NO_AUTO__) {
  initStatCardsGenerator();
}

