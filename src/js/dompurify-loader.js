/**
 * DOMPurify runtime loader
 * Loads sanitizer lazily to avoid blocking first render.
 */
'use strict';

const DOMPURIFY_URL =
  'https://cdn.jsdelivr.net/npm/dompurify@3.2.3/dist/purify.min.js';

function ensureDOMPurify() {
  if (
    globalThis.DOMPurify &&
    typeof globalThis.DOMPurify.sanitize === 'function'
  ) {
    return Promise.resolve(true);
  }

  if (window.__DOMPURIFY_LOAD_PROMISE__) {
    return window.__DOMPURIFY_LOAD_PROMISE__;
  }

  window.__DOMPURIFY_LOAD_PROMISE__ = new Promise(resolve => {
    const existingScript = document.querySelector(
      'script[data-runtime-dompurify="true"]'
    );
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(true), { once: true });
      existingScript.addEventListener('error', () => resolve(false), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = DOMPURIFY_URL;
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.setAttribute('data-runtime-dompurify', 'true');
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });

  return window.__DOMPURIFY_LOAD_PROMISE__;
}

function initDomPurifyLoader() {
  if (window.__DOMPURIFY_LOADER_INITED__) return;
  window.__DOMPURIFY_LOADER_INITED__ = true;

  const warmupByViewport = () => {
    const richContentSelectors = [
      '[data-rich-html]',
      '.announcement-content',
      '.announcement-description',
      '.announcement-card',
      '#catalogSection',
      '#adminView',
    ];
    const candidates = document.querySelectorAll(richContentSelectors.join(','));
    if (!candidates.length) return;

    if (!('IntersectionObserver' in window)) {
      ensureDOMPurify().catch(() => {});
      return;
    }

    let loadedByViewport = false;
    const observer = new IntersectionObserver(
      entries => {
        if (loadedByViewport) return;
        if (!entries.some(entry => entry.isIntersecting)) return;
        loadedByViewport = true;
        observer.disconnect();
        ensureDOMPurify().catch(() => {});
      },
      { rootMargin: '250px 0px' }
    );

    candidates.forEach(node => observer.observe(node));
  };

  const warmup = () => {
    ensureDOMPurify().catch(() => {});
    window.removeEventListener('pointerdown', warmup, true);
    window.removeEventListener('keydown', warmup, true);
    window.removeEventListener('touchstart', warmup, true);
    window.removeEventListener('scroll', warmup, true);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', warmupByViewport, { once: true });
  } else {
    warmupByViewport();
  }

  window.addEventListener('pointerdown', warmup, true);
  window.addEventListener('keydown', warmup, true);
  window.addEventListener('touchstart', warmup, true);
  window.addEventListener('scroll', warmup, true);

  window.ensureDOMPurify = ensureDOMPurify;
}

export { ensureDOMPurify, initDomPurifyLoader };
