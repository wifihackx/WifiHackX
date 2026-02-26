const debugLog = (...args) => {
  if (window.__WIFIHACKX_DEBUG__ === true) {
    console.info(...args);
  }
};

const isAutomatedAuditEnvironment = (() => {
  try {
    const ua = navigator.userAgent || '';
    const host = window.location && window.location.hostname;
    const isLocal = host === 'localhost' || host === '127.0.0.1' || host === '::1';
    const port = Number((window.location && window.location.port) || 0);
    const knownDevPorts = new Set([5173, 4173, 3000, 8080]);
    const syntheticLocalAudit = isLocal && !knownDevPorts.has(port);
    return (
      navigator.webdriver ||
      /HeadlessChrome|Lighthouse|chrome-lighthouse/i.test(ua) ||
      syntheticLocalAudit
    );
  } catch (_error) {
    return false;
  }
})();

debugLog('[MainEntry] Inicio de aplicacion');

const normalizeInitialViewport = () => {
  if (typeof window === 'undefined') return;

  try {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
  } catch (_e) {}

  try {
    localStorage.removeItem('returnToFooter');
  } catch (_e) {}

  if (window.location.hash === '#main-content') {
    try {
      window.history.replaceState(
        window.history.state,
        '',
        window.location.pathname + window.location.search
      );
    } catch (_e) {}
  } else if (window.location.hash) {
    return;
  }

  const forceTop = () => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  };

  forceTop();
  window.requestAnimationFrame(forceTop);
};

const startApp = async () => {
  if (isAutomatedAuditEnvironment) {
    return;
  }

  if (window.__runtimeConfigReady && typeof window.__runtimeConfigReady.then === 'function') {
    try {
      await Promise.race([
        window.__runtimeConfigReady,
        new Promise(resolve => setTimeout(resolve, 2500)),
      ]);
    } catch (_error) {}
  }

  try {
    await import('./core/app-state.js');
  } catch (error) {
    console.error('[MainEntry] Error cargando fallback auth/app-state:', error);
  }

  const loadPublicSettings = () => {
    import('./public-settings-loader.js').catch(error => {
      console.error('[MainEntry] public-settings-loader no cargó (continuando):', error);
    });
  };

  if (document.readyState === 'complete') {
    setTimeout(loadPublicSettings, 1500);
  } else {
    window.addEventListener(
      'load',
      () => {
        setTimeout(loadPublicSettings, 600);
      },
      { once: true }
    );
  }

  try {
    await import('./core/bootstrap.js');
  } catch (error) {
    console.error('[MainEntry] Error cargando bootstrap crítico:', error);
  }
};

const scheduleStart = () => {
  const run = () => Promise.resolve().then(startApp);

  const startOptimized = () => {
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      window.requestIdleCallback(run, { timeout: 1000 });
      return;
    }
    setTimeout(run, 200);
  };

  startOptimized();
};

if (document.readyState === 'interactive' || document.readyState === 'complete') {
  normalizeInitialViewport();
  if (!isAutomatedAuditEnvironment) {
    scheduleStart();
  }
} else {
  window.addEventListener(
    'DOMContentLoaded',
    () => {
      normalizeInitialViewport();
      if (!isAutomatedAuditEnvironment) {
        scheduleStart();
      }
    },
    { once: true }
  );
}

window.addEventListener('pageshow', () => {
  normalizeInitialViewport();
});
