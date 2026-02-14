/**
 * Enhanced Lazy Loading para imágenes
 * Implementa lazy loading con Intersection Observer API
 * y fallback para navegadores antiguos
 */

(function () {
  'use strict';

  /**
   * Configuración de Intersection Observer
   */
  const config = {
    rootMargin: '50px 0px', // Cargar 50px antes de que sea visible
    threshold: 0.01,
  };

  /**
   * Verifica si el navegador soporta Intersection Observer
   */
  const supportsIntersectionObserver = 'IntersectionObserver' in window;

  /**
   * Carga una imagen lazy
   */
  function loadImage(img) {
    const src = img.dataset.src;
    const srcset = img.dataset.srcset;

    if (!src) return;

    // Cargar imagen
    img.src = src;

    if (srcset) {
      img.srcset = srcset;
    }

    // Remover atributos data-*
    delete img.dataset.src;
    delete img.dataset.srcset;

    // Añadir clase de cargado
    img.classList.add('lazy-loaded');

    // Remover clase de lazy
    img.classList.remove('lazy');

    console.log('[LazyLoad] Imagen cargada:', src);
  }

  /**
   * Callback del Intersection Observer
   */
  function onIntersection(entries, observer) {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target;
        loadImage(img);
        observer.unobserve(img);
      }
    });
  }

  /**
   * Inicializa lazy loading con Intersection Observer
   */
  function initIntersectionObserver() {
    const images = document.querySelectorAll('img.lazy, img[data-src]');

    if (images.length === 0) {
      console.log('[LazyLoad] No hay imágenes lazy para cargar');
      return;
    }

    const observer = new IntersectionObserver(onIntersection, config);

    images.forEach(img => {
      // Si la imagen ya está en el viewport, cargarla inmediatamente
      const rect = img.getBoundingClientRect();
      const isInViewport =
        rect.top >= 0 &&
        rect.left >= 0 &&
        rect.bottom <=
          (window.innerHeight || document.documentElement.clientHeight) &&
        rect.right <=
          (window.innerWidth || document.documentElement.clientWidth);

      if (isInViewport) {
        loadImage(img);
      } else {
        observer.observe(img);
      }
    });

    console.log(`[LazyLoad] Observando ${images.length} imágenes`);
  }

  /**
   * Fallback para navegadores sin Intersection Observer
   */
  function initFallback() {
    const images = document.querySelectorAll('img.lazy, img[data-src]');

    if (images.length === 0) {
      console.log('[LazyLoad] No hay imágenes lazy para cargar');
      return;
    }

    function checkImages() {
      images.forEach(img => {
        if (img.dataset.src) {
          const rect = img.getBoundingClientRect();
          const isInViewport =
            rect.top >= 0 &&
            rect.top <=
              (window.innerHeight || document.documentElement.clientHeight) +
                50;

          if (isInViewport) {
            loadImage(img);
          }
        }
      });
    }

    // Verificar al cargar
    checkImages();

    // Verificar al hacer scroll (con throttle)
    let ticking = false;
    window.addEventListener('scroll', () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          checkImages();
          ticking = false;
        });
        ticking = true;
      }
    });

    console.log(`[LazyLoad] Fallback activado para ${images.length} imágenes`);
  }

  /**
   * Añade lazy loading a imágenes dinámicas
   */
  function observeDynamicImages() {
    if (!supportsIntersectionObserver) return;

    const observer = new MutationObserver(mutations => {
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === 1) {
            // Element node
            const images = node.querySelectorAll
              ? node.querySelectorAll('img.lazy, img[data-src]')
              : [];

            if (
              node.tagName === 'IMG' &&
              (node.classList.contains('lazy') || node.dataset.src)
            ) {
              const imgObserver = new IntersectionObserver(
                onIntersection,
                config
              );
              imgObserver.observe(node);
            }

            images.forEach(img => {
              const imgObserver = new IntersectionObserver(
                onIntersection,
                config
              );
              imgObserver.observe(img);
            });
          }
        });
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    console.log('[LazyLoad] Observando imágenes dinámicas');
  }

  /**
   * Inicializa lazy loading
   */
  function init() {
    if (supportsIntersectionObserver) {
      initIntersectionObserver();
      observeDynamicImages();
    } else {
      console.warn(
        '[LazyLoad] Intersection Observer no soportado, usando fallback'
      );
      initFallback();
    }
  }

  // Inicializar cuando el DOM esté listo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Exponer API global
  window.LazyLoad = {
    init,
    loadImage,
  };

  console.log('[LazyLoad] Módulo cargado');
})();
