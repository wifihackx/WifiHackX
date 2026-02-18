/**
 * Filter Buttons Generator - Genera botones de filtro dinámicamente
 * Reduce código HTML duplicado en index.html
 *
 * @version 1.0.0
 */

'use strict';

function setupFilterButtonsGenerator() {
  let templateListenerBound = false;

  /**
   * Configuración de botones de filtro
   */
  const FILTERS_CONFIG = [
    {
      filter: 'all',
      label: 'Todos',
      active: true,
      ariaLabel: 'Mostrar todos los usuarios',
    },
    {
      filter: 'active',
      label: 'Activos',
      active: false,
      ariaLabel: 'Mostrar solo usuarios activos',
    },
    {
      filter: 'inactive',
      label: 'Inactivos',
      active: false,
      ariaLabel: 'Mostrar solo usuarios inactivos',
    },
    {
      filter: 'admin',
      label: 'Admins',
      active: false,
      ariaLabel: 'Mostrar solo administradores',
    },
    {
      filter: 'banned',
      label: 'Baneados',
      active: false,
      ariaLabel: 'Mostrar solo usuarios baneados',
    },
  ];

  /**
   * Genera el HTML de un botón de filtro
   * @param {Object} config - Configuración del filtro
   * @returns {string} HTML del botón
   */
  function generateFilterButton(config) {
    const activeClass = config.active ? ' active' : '';
    const ariaPressed = config.active ? 'true' : 'false';

    return `
            <button class="filter-btn${activeClass}" data-filter="${config.filter}" aria-pressed="${ariaPressed}" aria-label="${config.ariaLabel}">
                ${config.label}
            </button>
        `;
  }

  /**
   * Renderiza todos los botones de filtro
   */
  function renderFilterButtons() {
    const container = document.getElementById('userFiltersContainer');

    if (!container) {
      const adminView = document.getElementById('adminView');
      const templateLoaded = adminView?.dataset?.templateLoaded === '1';
      if (!templateLoaded && !templateListenerBound) {
        templateListenerBound = true;
        window.addEventListener(
          'adminView:templateLoaded',
          () => {
            templateListenerBound = false;
            renderFilterButtons();
          },
          { once: true }
        );
      }
      return;
    }

    // Generar HTML de todos los botones
    const buttonsHTML = FILTERS_CONFIG.map(config =>
      generateFilterButton(config)
    ).join('');

    // Crear fieldset con legend y botones
    const fieldsetHTML = `
            <fieldset class="filter-buttons">
                <legend class="visually-hidden">Filtros de usuarios</legend>
                ${buttonsHTML}
            </fieldset>
        `;

    // Insertar en el contenedor
    // SAFE: Internal template - filter buttons from static config
    container.innerHTML = fieldsetHTML;

    console.info(
      '[FilterButtons] Rendered',
      FILTERS_CONFIG.length,
      'filter buttons'
    );
  }

  /**
   * Inicializar cuando el DOM esté listo
   */
  function init() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', renderFilterButtons);
    } else {
      renderFilterButtons();
    }
  }

  // Exponer función globalmente para uso externo si es necesario
  window.FilterButtonsGenerator = {
    render: renderFilterButtons,
    config: FILTERS_CONFIG,
  };

  // Inicializar
  init();
}

export function initFilterButtonsGenerator() {
  if (window.__FILTER_BUTTONS_GENERATOR_INITED__) {
    return;
  }

  window.__FILTER_BUTTONS_GENERATOR_INITED__ = true;
  setupFilterButtonsGenerator();
}

if (typeof window !== 'undefined' && !window.__FILTER_BUTTONS_GENERATOR_NO_AUTO__) {
  initFilterButtonsGenerator();
}

