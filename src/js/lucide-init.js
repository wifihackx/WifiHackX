/**
 * Lucide Icon Initialization
 */
'use strict';

const LUCIDE_CDN_URL =
  'https://unpkg.com/lucide@0.263.0/dist/umd/lucide.min.js';

function ensureLucideLoaded() {
  if (
    globalThis.lucide &&
    typeof globalThis.lucide.createIcons === 'function'
  ) {
    return Promise.resolve(true);
  }

  if (window.__LUCIDE_LOAD_PROMISE__) {
    return window.__LUCIDE_LOAD_PROMISE__;
  }

  window.__LUCIDE_LOAD_PROMISE__ = new Promise(resolve => {
    const existingScript = document.querySelector(
      'script[data-runtime-lucide="true"]'
    );
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(true), { once: true });
      existingScript.addEventListener('error', () => resolve(false), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = LUCIDE_CDN_URL;
    script.async = true;
    script.defer = true;
    script.crossOrigin = 'anonymous';
    script.setAttribute('data-runtime-lucide', 'true');
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });

  return window.__LUCIDE_LOAD_PROMISE__;
}

function renderLucideIcons() {
  if (
    globalThis.lucide &&
    typeof globalThis.lucide.createIcons === 'function'
  ) {
    globalThis.lucide.createIcons();
    return true;
  }
  return false;
}

function setupLucideInit() {
  const bootstrapIcons = () => {
    ensureLucideLoaded()
      .then(loaded => {
        if (!loaded) return;
        renderLucideIcons();
      })
      .catch(() => {});
  };

  const initViewportObserver = () => {
    const iconCandidates = document.querySelectorAll('[data-lucide]');
    if (!iconCandidates.length) return;

    if (!('IntersectionObserver' in window)) {
      bootstrapIcons();
      return;
    }

    let loadedByViewport = false;
    const observer = new IntersectionObserver(
      entries => {
        if (loadedByViewport) return;
        if (!entries.some(entry => entry.isIntersecting)) return;
        loadedByViewport = true;
        observer.disconnect();
        bootstrapIcons();
      },
      { rootMargin: '200px 0px' }
    );

    iconCandidates.forEach(node => observer.observe(node));
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initViewportObserver, {
      once: true,
    });
  } else {
    initViewportObserver();
  }

  const loadOnInteraction = () => {
    ensureLucideLoaded().then(() => renderLucideIcons()).catch(() => {});
    window.removeEventListener('pointerdown', loadOnInteraction, true);
    window.removeEventListener('keydown', loadOnInteraction, true);
    window.removeEventListener('touchstart', loadOnInteraction, true);
  };

  window.addEventListener('pointerdown', loadOnInteraction, true);
  window.addEventListener('keydown', loadOnInteraction, true);
  window.addEventListener('touchstart', loadOnInteraction, true);

  window.ensureLucide = ensureLucideLoaded;
}

export function initLucideInit() {
  if (window.__LUCIDE_INIT_INITED__) {
    return;
  }

  window.__LUCIDE_INIT_INITED__ = true;
  setupLucideInit();
}

if (typeof window !== 'undefined' && !window.__LUCIDE_INIT_NO_AUTO__) {
  initLucideInit();
}
