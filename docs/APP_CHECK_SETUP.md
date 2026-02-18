# App Check Setup

## Estado actual
- App Check ya está integrado en `src/js/app-check-init.js` y `public/js/app-check-init.js`.
- Se activa automáticamente cuando existe `RUNTIME_CONFIG.appCheck.siteKey`.
- En localhost usa `FIREBASE_APPCHECK_DEBUG_TOKEN` automáticamente.

## Configurar producción
1. En Firebase Console, habilita App Check para Web App.
2. Crea una clave de reCAPTCHA v3 para App Check.
3. Sustituye en `index.html`:
   - `RUNTIME_CONFIG.appCheck.siteKey`
   - Valor actual: `REPLACE_WITH_FIREBASE_APPCHECK_SITE_KEY`
4. Publica con `firebase deploy --only hosting`.

## Configurar desarrollo (debug token)
1. Arranca en localhost.
2. Abre consola y ejecuta:
   - `localStorage.setItem('wifihackx:appcheck:debug_token', 'TU_DEBUG_TOKEN')`
3. Recarga la app.
4. Registra ese debug token en Firebase Console > App Check > Manage debug tokens.

## Verificación rápida
- En consola:
  - `window.getAppCheckStatus()`
- Debe devolver:
  - `ready: true`
  - `disabled: false`
  - `provider: "recaptcha-v3"`
