# Console Key Restrictions Checklist

Fecha de referencia: 2026-02-21

## 1) Google Cloud API Key (Firebase Web apiKey)

- Ruta: `Google Cloud Console > APIs & Services > Credentials > API key`
- `Application restrictions`: `HTTP referrers (web sites)`
- Referrers permitidos:
  - `https://wifihackx.com/*`
  - `https://www.wifihackx.com/*` (si aplica)
  - `http://localhost:*/*` (solo desarrollo)
  - `http://127.0.0.1:*/*` (solo desarrollo)
- `API restrictions`: limita a APIs usadas por el frontend:
  - `Identity Toolkit API`
  - `Secure Token API`
  - `Firebase Installations API`
  - `Firestore API` (si aplica a llamadas directas web)

## 2) Firebase Auth Authorized Domains

- Ruta: `Firebase Console > Authentication > Settings > Authorized domains`
- Mantener solo:
  - `wifihackx.com`
  - `www.wifihackx.com` (si aplica)
  - `localhost` (solo desarrollo)

## 3) reCAPTCHA (siteKey web)

- Ruta: `Google reCAPTCHA Admin Console`
- Dominios permitidos:
  - `wifihackx.com`
  - `www.wifihackx.com` (si aplica)
  - `localhost` (solo desarrollo)
- Eliminar dominios de pruebas viejos.

## 4) Firebase App Check (reCAPTCHA)

- Ruta: `Firebase Console > App Check > Web app`
- Enforce App Check en servicios sensibles (Firestore/Functions) tras validar tráfico legítimo.
- Mantener solo dominios de producción + localhost dev.

## 5) PayPal Client ID

- Ruta: `PayPal Developer Dashboard > App`
- Verifica:
  - App `Live` separada de `Sandbox`.
  - Return/cancel URLs limitadas a `https://wifihackx.com/*`.
  - Webhooks apuntando solo a endpoints de producción.

## 6) Verificación posterior

- Ejecuta auditoría local:
  - `npm run validate:public-config`
- Prueba desde dominio no autorizado:
  - Firebase/Auth/API debe devolver error por origen.
- Prueba desde dominio autorizado:
  - Login y checkout deben funcionar.
