const startApp = async () => {
  try {
    await import('./js/return-to-footer.js');
    await import('./js/public-settings-loader.js');
    await import('./js/core/bootstrap.js');
  } catch (error) {
    console.error('[Main] Error inicializando módulos principales:', error);
  }
};

const scheduleStart = () => {
  const run = () => {
    // Defer heavy bootstrap to reduce render-blocking work on first paint.
    Promise.resolve().then(startApp);
  };

  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
    window.requestIdleCallback(run, { timeout: 1200 });
  } else if (typeof window !== 'undefined' && 'requestAnimationFrame' in window) {
    window.requestAnimationFrame(() => setTimeout(run, 0));
  } else {
    setTimeout(run, 0);
  }
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', scheduleStart, { once: true });
} else {
  scheduleStart();
}
