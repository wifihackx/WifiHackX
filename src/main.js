const debugLog = (...args) => {
    if (window.__WIFIHACKX_DEBUG__ === true) {
        console.info(...args);
    }
};

debugLog('Vite está funcionando: Sistema iniciado');

let bootstrapPromise = null;

const ensureCoreBootstrap = () => {
    if (bootstrapPromise) return bootstrapPromise;
    bootstrapPromise = (async () => {
        // Fallback crítico: asegurar estado y auth base aunque falle otro módulo.
        try {
            await import('./js/core/app-state.js');
            await import('./js/auth.js?v=1.1');
        } catch (error) {
            console.error('[Main] Error cargando fallback crítico auth/app-state:', error);
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
    })();

    return bootstrapPromise;
};

const startApp = async () => {
    try {
        await import('./js/return-to-footer.js');
    } catch (error) {
        console.error('[Main] return-to-footer no cargó (continuando):', error);
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

    // Fallback: mantener comportamiento completo aunque no haya interacción inmediata.
    setTimeout(() => {
        ensureCoreBootstrap().catch(() => {});
    }, 8000);
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
                timeout: 4000
            });
        } else {
            setTimeout(run, 1200);
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
