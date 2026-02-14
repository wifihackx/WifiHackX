# Arquitectura Modular - wifihackx-v2

Fecha: 2026-02-09

## Objetivo
Separar el monolito JS en módulos organizados sin romper comportamiento, manteniendo compatibilidad con scripts legacy.

## Entry Point
- `src/main.js`
  - Importa `src/css/styles.css`
  - Importa `src/js/core/bootstrap.js`

## Bootstrap
- `src/js/core/bootstrap.js`
  - Orquesta el orden de carga y ejecuta los módulos en este orden:
    1. `initAuth()`
    2. `initData()`
    3. `initPayments()`
    4. `initFeatures()`
    5. `initAdmin()`
    6. `initUi()`

## Módulos

### Auth
- `src/js/modules/auth/index.js`
- Contiene: auth-handler, auth-init-early, auth, auth-tabs-handler, recaptcha bypass, auth-notifications.

### Data
- `src/js/modules/data/index.js`
- Contiene: users*, AdminDataManager, firestore-data-cleaner, firebase-permissions-handler,
  analytics (ga4/enhanced/tracker), real-time-data-service, RUM, settings.

### Payments
- `src/js/modules/payments/index.js`
- Contiene: stripe-loader/checkout, paypal-loader/checkout, checkout-interceptor,
  purchase-success-modal, post-checkout, confetti, sound.

### Features (Misc)
- `src/js/modules/features/index.js`
- Contiene: notification-system, event-delegation, ban-system, common-handlers,
  i18n, cart, navigation, sentry-init, sw-register, generators, announcements,
  system-integration, admin-protection-system, UI helpers varios.

### Admin
- `src/js/modules/admin/index.js`
- Contiene: admin-loader, admin.js, admin-section-interceptor, admin-navigation-unified.

### UI
- `src/js/modules/ui/index.js`
- Contiene: modal-core, modal-init-controller, ui-interactions, helpers,
  modal-emergency-close, lucide-init, aria-landmarks, high-contrast, inline accessibility,
  cookie-consent.

## Público (Static)
- `public/css/*` y `public/js/*` están presentes para scripts legacy que se cargan vía rutas absolutas (`/css/...`, `/js/...`).

## Notas Localhost
- RUM (`real-user-monitoring.js`) desactivado en localhost para evitar `POST /api/metrics` 404.
- Advertencias CSP y cookies suelen venir de extensiones o scripts de terceros.

## Próximos pasos
1. Migrar scripts legacy a módulos ES reales (export/init) y eliminar globals.
2. Crear bundles por dominio (auth, admin, data, payments, ui) con imports explícitos.
3. Reemplazar carga dinámica de `/js/...` por imports estáticos.
4. Remover `public/js` cuando todo esté modularizado.
