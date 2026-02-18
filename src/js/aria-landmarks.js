/**
 * ARIA Landmarks Enhancement
 * Mejora la navegación con landmarks ARIA adicionales
 */

'use strict';

const debugLog = (...args) => {
  if (window.__WFX_DEBUG__ === true) {
    console.info(...args);
  }
};

function setupAriaLandmarks() {

  /**
   * Añadir landmarks ARIA a elementos existentes
   */
  function enhanceLandmarks() {
    // Banner (header con navegación principal)
    const header = document.querySelector('.main-header');
    if (header && !header.getAttribute('role')) {
      header.setAttribute('role', 'banner');
      debugLog('[ARIA] Landmark banner añadido');
    }

    // Navigation
    const nav = document.querySelector('.main-nav');
    if (nav && !nav.getAttribute('role')) {
      nav.setAttribute('role', 'navigation');
      nav.setAttribute('aria-label', 'Navegación principal');
      debugLog('[ARIA] Landmark navigation añadido');
    }

    // Main content
    const main = document.querySelector('.main-content');
    if (main && !main.getAttribute('role')) {
      main.setAttribute('role', 'main');
      debugLog('[ARIA] Landmark main añadido');
    }

    // Search (si existe)
    const searchForm = document.querySelector('form[role="search"]');
    if (!searchForm) {
      const searchContainer = document.querySelector(
        '.search-container, .search-box'
      );
      if (searchContainer) {
        searchContainer.setAttribute('role', 'search');
        searchContainer.setAttribute('aria-label', 'Búsqueda de productos');
        debugLog('[ARIA] Landmark search añadido');
      }
    }

    // Complementary (sidebar, widgets)
    const sidebar = document.querySelector('.sidebar, .widget-area');
    if (sidebar && !sidebar.getAttribute('role')) {
      sidebar.setAttribute('role', 'complementary');
      sidebar.setAttribute('aria-label', 'Contenido relacionado');
      debugLog('[ARIA] Landmark complementary añadido');
    }

    // Contentinfo (footer)
    const footer = document.querySelector('footer, .footer');
    if (footer && !footer.getAttribute('role')) {
      footer.setAttribute('role', 'contentinfo');
      debugLog('[ARIA] Landmark contentinfo añadido');
    }

    // Region para secciones importantes
    const sections = document.querySelectorAll('section[id]');
    sections.forEach(section => {
      if (
        !section.getAttribute('role') &&
        !section.getAttribute('aria-label')
      ) {
        const heading = section.querySelector('h1, h2, h3');
        if (heading) {
          section.setAttribute('role', 'region');
          section.setAttribute(
            'aria-labelledby',
            heading.id || generateId(heading)
          );
          debugLog('[ARIA] Landmark region añadido:', section.id);
        }
      }
    });
  }

  /**
   * Generar ID único para elemento
   */
  function generateId(element) {
    const text = element.textContent.trim().toLowerCase().replace(/\s+/g, '-');
    const id = `heading-${text}`;
    element.id = id;
    return id;
  }

  /**
   * Añadir navegación por landmarks
   */
  function addLandmarkNavigation() {
    const landmarks = document.querySelectorAll(
      '[role="banner"], [role="navigation"], [role="main"], [role="search"], [role="complementary"], [role="contentinfo"], [role="region"]'
    );

    if (landmarks.length === 0) {
      return;
    }

    // Crear lista de landmarks para navegación
    const landmarkList = Array.from(landmarks).map((landmark, index) => {
      const role = landmark.getAttribute('role');
      const label =
        landmark.getAttribute('aria-label') ||
        landmark.getAttribute('aria-labelledby');

      return {
        element: landmark,
        role: role,
        label: label || role,
        index: index,
      };
    });

    // Exponer API para navegación
    window.ARIALandmarks = {
      list: landmarkList,
      navigate: function (index) {
        if (landmarkList[index]) {
          landmarkList[index].element.focus();
          landmarkList[index].element.scrollIntoView({
            behavior: 'smooth',
            block: 'start',
          });
        }
      },
      next: function () {
        const current = document.activeElement;
        const currentIndex = landmarkList.findIndex(l => l.element === current);
        const nextIndex = (currentIndex + 1) % landmarkList.length;
        this.navigate(nextIndex);
      },
      previous: function () {
        const current = document.activeElement;
        const currentIndex = landmarkList.findIndex(l => l.element === current);
        const prevIndex =
          (currentIndex - 1 + landmarkList.length) % landmarkList.length;
        this.navigate(prevIndex);
      },
    };

    debugLog(
      `[ARIA] ${landmarkList.length} landmarks disponibles para navegación`
    );
  }

  /**
   * Añadir atajos de teclado para landmarks
   */
  function addKeyboardShortcuts() {
    document.addEventListener('keydown', e => {
      // Alt + L: Listar landmarks
      if (e.altKey && e.key === 'l') {
        e.preventDefault();
        if (window.ARIALandmarks) {
          debugLog(
            '[ARIA] Landmarks disponibles:',
            window.ARIALandmarks.list
          );
          // Aquí podrías mostrar un modal con la lista
        }
      }

      // Alt + N: Siguiente landmark
      if (e.altKey && e.key === 'n') {
        e.preventDefault();
        if (window.ARIALandmarks) {
          window.ARIALandmarks.next();
        }
      }

      // Alt + P: Landmark anterior
      if (e.altKey && e.key === 'p') {
        e.preventDefault();
        if (window.ARIALandmarks) {
          window.ARIALandmarks.previous();
        }
      }
    });

    debugLog('[ARIA] Atajos de teclado configurados (Alt+L, Alt+N, Alt+P)');
  }

  /**
   * Mejorar accesibilidad de formularios
   */
  function enhanceForms() {
    const forms = document.querySelectorAll('form');

    forms.forEach(form => {
      // Añadir aria-required a campos requeridos
      const requiredInputs = form.querySelectorAll(
        'input[required], textarea[required], select[required]'
      );

      requiredInputs.forEach(input => {
        if (!input.getAttribute('aria-required')) {
          input.setAttribute('aria-required', 'true');
        }
      });

      // Añadir aria-invalid a campos con errores
      const invalidInputs = form.querySelectorAll(
        'input:invalid, textarea:invalid, select:invalid'
      );

      invalidInputs.forEach(input => {
        input.setAttribute('aria-invalid', 'true');
      });
    });

    debugLog('[ARIA] Formularios mejorados');
  }

  /**
   * Mejorar accesibilidad de modales
   */
  function enhanceModals() {
    const modals = document.querySelectorAll('.modal, [role="dialog"]');

    modals.forEach(modal => {
      if (!modal.getAttribute('role')) {
        modal.setAttribute('role', 'dialog');
      }

      if (!modal.getAttribute('aria-modal')) {
        modal.setAttribute('aria-modal', 'true');
      }

      // Añadir aria-labelledby si hay título
      const title = modal.querySelector('h1, h2, h3, .modal-title');
      if (title && !modal.getAttribute('aria-labelledby')) {
        const titleId = title.id || generateId(title);
        modal.setAttribute('aria-labelledby', titleId);
      }
    });

    debugLog('[ARIA] Modales mejorados');
  }

  /**
   * Inicializar mejoras de accesibilidad
   */
  function init() {
    enhanceLandmarks();
    addLandmarkNavigation();
    addKeyboardShortcuts();
    enhanceForms();
    enhanceModals();

    debugLog('[ARIA] Sistema de landmarks configurado');
  }

  // Inicializar cuando el DOM esté listo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Re-aplicar cuando se añadan elementos dinámicamente (con debouncing)
  let debounceTimer = null;
  const observer = new MutationObserver(mutations => {
    // Verificar si realmente se añadieron elementos relevantes
    const hasRelevantChanges = mutations.some(mutation => {
      return Array.from(mutation.addedNodes).some(node => {
        // Solo procesar elementos HTML (no text nodes ni comentarios)
        if (node.nodeType !== 1) return false;

        // Solo procesar elementos relevantes (forms, modals, sections)
        return (
          node.matches &&
          (node.matches(
            'form, .modal, [role="dialog"], section, header, footer, nav'
          ) ||
            node.querySelector(
              'form, .modal, [role="dialog"], section, header, footer, nav'
            ))
        );
      });
    });

    if (!hasRelevantChanges) return;

    // Debounce para evitar ejecuciones múltiples
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      enhanceLandmarks();
      enhanceForms();
      enhanceModals();
    }, 250); // Esperar 250ms antes de ejecutar
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  debugLog('[ARIA] Módulo de landmarks cargado');
}

export function initAriaLandmarks() {
  if (window.__ARIA_LANDMARKS_INITED__) {
    return;
  }

  window.__ARIA_LANDMARKS_INITED__ = true;
  setupAriaLandmarks();
}

if (typeof window !== 'undefined' && !window.__ARIA_LANDMARKS_NO_AUTO__) {
  initAriaLandmarks();
}

