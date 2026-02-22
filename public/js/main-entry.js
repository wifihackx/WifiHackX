const debugLog = (...args) => {
  if (window.__WIFIHACKX_DEBUG__ === true) {
    console.info(...args);
  }
};

debugLog('[MainEntry] Inicio de aplicacion');

let bootstrapPromise = null;

const ensureCoreBootstrap = () => {
  if (bootstrapPromise) return bootstrapPromise;
  bootstrapPromise = (async () => {
    try {
      await import('./core/app-state.js');
      await import('./auth.js?v=1.1');
    } catch (error) {
      console.error('[MainEntry] Error cargando fallback auth/app-state:', error);
    }

    try {
      await import('./public-settings-loader.js');
    } catch (error) {
      console.error('[MainEntry] public-settings-loader no cargó (continuando):', error);
    }

    try {
      await import('./core/bootstrap.js');
    } catch (error) {
      console.error('[MainEntry] Error cargando bootstrap crítico:', error);
    }
  })();
  return bootstrapPromise;
};

const startApp = async () => {
  try {
    await import('./return-to-footer.js');
  } catch (error) {
    console.error('[MainEntry] return-to-footer no cargó (continuando):', error);
  }

  const intentSelector = '[data-action="showLoginView"], [data-action="checkout"], [data-action="addToCart"], [data-action="openAdmin"], #checkoutBtn, #loginBtn';
  let bootstrappedByIntent = false;

  const onIntent = event => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    if (!target.closest(intentSelector)) return;
    if (bootstrappedByIntent) return;
    bootstrappedByIntent = true;
    ensureCoreBootstrap().catch(() => {});
    document.removeEventListener('click', onIntent, true);
    document.removeEventListener('pointerdown', onIntent, true);
  };

  document.addEventListener('click', onIntent, true);
  document.addEventListener('pointerdown', onIntent, true);

  setTimeout(() => {
    ensureCoreBootstrap().catch(() => {});
  }, 8000);
};

const scheduleStart = () => {
  const run = () => Promise.resolve().then(startApp);

  const startOptimized = () => {
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      window.requestIdleCallback(run, { timeout: 4000 });
      return;
    }
    setTimeout(run, 1200);
  };

  startOptimized();
};

if (document.readyState === 'interactive' || document.readyState === 'complete') {
  scheduleStart();
} else {
  window.addEventListener('DOMContentLoaded', scheduleStart, { once: true });
}
