# App Check Enforce Checklist

## Objetivo

Pasar a `Enforce` sin romper login, lectura de settings ni panel admin.

## Pre-checks (antes de Enforce)

1. En localhost:

- `localStorage.setItem('wifihackx:appcheck:enabled', '1')`
- `localStorage.setItem('wifihackx:appcheck:debug_token', 'TU_TOKEN')`
- recargar y validar `window.getAppCheckStatus()` -> `ready: true`, `disabled: false`.

2. En Firebase Console > App Check:

- Debug token de localhost registrado.
- App web correcta seleccionada.
- reCAPTCHA v3 site key válida para dominios reales.

3. API key de Firebase restringida con referrers permitidos:

- `http://127.0.0.1:5173`
- `http://localhost:5173`
- `https://white-caster-466401-g0.firebaseapp.com`
- `https://white-caster-466401-g0.web.app`
- Dominio final de producción cuando exista.

## Activación por servicio

1. Authentication -> `Monitor` (primero).
2. Firestore -> `Monitor` (primero).
3. Functions -> `Monitor` (si aplica por endpoint).
4. Revisar 24h logs y errores.
5. Cambiar a `Enforce` uno por uno: Auth, luego Firestore, luego Functions.

## Señales de éxito

1. Login email/password y Google sin `auth/firebase-app-check-token-is-invalid`.
2. Sin `exchangeDebugToken 403` en entorno esperado (localhost con debug token registrado).
3. Firestore sin `Missing or insufficient permissions` inesperado en vistas públicas permitidas.

## Rollback rápido

Si aparece bloqueo de usuarios reales:

1. Volver servicio afectado a `Monitor`.
2. Corregir dominio/API key/debug token.
3. Reprobar y reactivar `Enforce`.
