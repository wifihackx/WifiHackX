const debugLog = (...args) => {
    if (window.__WIFIHACKX_DEBUG__ === true) {
        console.info(...args);
    }
};

debugLog('Vite está funcionando: Sistema iniciado');

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
        // Defer heavy bootstrap slightly to allow initial paint
        Promise.resolve().then(startApp);
    };

    // Modern startup: DOMContentLoaded + small buffer for smooth transition
    // We do NOT wait for 'load' (all images/CSS) to start app logic.
    const startOptimized = () => {
        if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
            window.requestIdleCallback(run, {
                timeout: 1000
            });
        } else {
            setTimeout(run, 200);
        }
    };

    // Start immediately; requestIdleCallback/setTimeout inside startOptimized
    // already provides non-blocking scheduling.
    startOptimized();
};

// Check interactive state so we don't wait if already parsed
if (document.readyState === 'interactive' || document.readyState === 'complete') {
    scheduleStart();
} else {
    // DOMContentLoaded fires when HTML is parsed, before external resources
    window.addEventListener('DOMContentLoaded', scheduleStart, {
        once: true
    });
}
