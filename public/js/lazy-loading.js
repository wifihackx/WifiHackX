/**
 * Lazy Loading de Imágenes
 * Carga imágenes solo cuando están visibles en viewport.
 * Versión optimizada para menor ruido en consola.
 *
 * @version 6.1.0
 */

'use strict';

function setupLazyLoading() {

  const CONFIG = {
    rootMargin: '50px',
    threshold: 0.01,
    loadingClass: 'lazy-loading',
    loadedClass: 'lazy-loaded',
    errorClass: 'lazy-error',
  };

  let imageObserver;

  function initObserver() {
    if (!('IntersectionObserver' in window)) {
      loadAllImages();
      return;
    }

    imageObserver = new IntersectionObserver(
      (entries, observer) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const img = entry.target;
            loadImage(img);
            observer.unobserve(img);
          }
        });
      },
      {
        rootMargin: CONFIG.rootMargin,
        threshold: CONFIG.threshold,
      }
    );
  }

  function loadImage(img) {
    const src = img.dataset.src;
    const srcset = img.dataset.srcset;

    if (!src && !srcset) return;

    img.classList.add(CONFIG.loadingClass);

    // Carga directa si es posible (más fiable que objeto Image intermedio para eventos simples)
    // Pero usamos Image para evitar "parpadeo" hasta que está cargada
    const tempImg = new Image();

    tempImg.onload = () => {
      if (srcset) img.srcset = srcset;
      if (src) img.src = src;

      img.classList.remove(CONFIG.loadingClass);
      img.classList.add(CONFIG.loadedClass);
      img.removeAttribute('data-src');
      img.removeAttribute('data-srcset');
    };

    tempImg.onerror = () => {
      img.classList.remove(CONFIG.loadingClass);
      img.classList.add(CONFIG.errorClass);
      // Fallback silencioso o imagen de error
    };

    if (srcset) tempImg.srcset = srcset;
    if (src) tempImg.src = src;
  }

  function observeImages() {
    const lazyImages = document.querySelectorAll(
      'img[data-src], img[data-srcset]'
    );
    if (lazyImages.length === 0) return; // Silent exit

    lazyImages.forEach(img => {
      // Evitar re-observar si ya está siendo observado o cargado
      if (
        !img.classList.contains(CONFIG.loadingClass) &&
        !img.classList.contains(CONFIG.loadedClass)
      ) {
        imageObserver.observe(img);
      }
    });
  }

  function loadAllImages() {
    const lazyImages = document.querySelectorAll(
      'img[data-src], img[data-srcset]'
    );
    lazyImages.forEach(img => loadImage(img));
  }

  function init() {
    initObserver();

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', observeImages);
    } else {
      observeImages();
    }

    // Observer DOM changes
    const mutationObserver = new MutationObserver(mutations => {
      let hasNewImages = false;
      mutations.forEach(m => {
        if (m.addedNodes.length) hasNewImages = true;
      });
      if (hasNewImages) observeImages();
    });

    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  // API Global simplificada
  window.LazyLoadManager = {
    scan: observeImages,
    load: loadImage,
  };

  init(); // Run
}

function initLazyLoading() {
  if (window.__LAZY_LOADING_INITED__) {
    return;
  }

  window.__LAZY_LOADING_INITED__ = true;
  setupLazyLoading();
}

if (typeof window !== 'undefined' && !window.__LAZY_LOADING_NO_AUTO__) {
  initLazyLoading();
}

