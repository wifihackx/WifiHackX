# App Check Setup

## Estado actual

- App Check ya está integrado en `src/js/app-check-init.js` y `public/js/app-check-init.js`.
- Producción: se activa automáticamente cuando existe `RUNTIME_CONFIG.appCheck.siteKey`.
- Localhost: está desactivado por defecto y se habilita explícitamente.

## Configurar producción

1. En Firebase Console, habilita App Check para Web App.
2. Crea una clave de reCAPTCHA v3 para App Check.
3. Sustituye en `index.html`:
   - `RUNTIME_CONFIG.appCheck.siteKey`
   - Valor actual: `REPLACE_WITH_FIREBASE_APPCHECK_SITE_KEY`
4. Publica con `firebase deploy --only hosting`.

## Configurar desarrollo (debug token)

1. Registra un Debug Token en Firebase Console > App Check > App web > `Administrar tokens de depuración`.
2. En localhost, abre consola y ejecuta:
   - `localStorage.setItem('wifihackx:appcheck:debug_token', 'TU_DEBUG_TOKEN')`
   - `localStorage.setItem('wifihackx:appcheck:enabled', '1')`
3. Recarga la app.
4. Verifica:
   - `window.getAppCheckStatus()`
   - Debe devolver `ready: true`, `disabled: false`, `provider: "recaptcha-v3"`.

## Verificación rápida

1. `window.getAppCheckStatus()`
2. Si sale `disabled: true` en localhost:
   - revisa `wifihackx:appcheck:enabled=1`
   - revisa `wifihackx:appcheck:debug_token`
   - confirma que el debug token esté registrado en Firebase Console.
