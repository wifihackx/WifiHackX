const debugLog = (...args) => {
    if (window.__WIFIHACKX_DEBUG__ === true) {
        console.info(...args);
    }
};

debugLog('Vite está funcionando: Sistema iniciado');

const startApp = async () => {
    // Fallback crítico: asegurar estado y auth base aunque falle otro módulo.
    try {
        await import('./js/core/app-state.js');
        await import('./js/auth.js?v=1.1');
    } catch (error) {
        console.error('[Main] Error cargando fallback crítico auth/app-state:', error);
    }

    try {
        await import('./js/return-to-footer.js');
    } catch (error) {
        console.error('[Main] return-to-footer no cargó (continuando):', error);
    }

    try {
        await import('./js/public-settings-loader.js');
    } catch (error) {
        console.error('[Main] public-settings-loader no cargó (continuando):', error);
    }

    // Crítico: bootstrap (auth/firebase/ui core) debe intentarse siempre.
    try {
        await import('./js/core/bootstrap.js');
    } catch (error) {
        console.error('[Main] Error cargando bootstrap crítico:', error);
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
