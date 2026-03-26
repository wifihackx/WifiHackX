# Arquitectura Modular - wifihackx-v2

Fecha: 2026-03-19

## Objetivo

Separar el monolito JS en módulos organizados sin romper comportamiento, manteniendo el espejo `src/` -> `public/` que hoy usa el proyecto.

## Estructura actual

- `src/js/`
  - Código fuente principal usado por Vite en desarrollo.
- `src/js/core/`
  - Bootstrap, app-state y adapters de inicialización.
- `src/js/modules/`
  - Wrappers/orquestadores por dominio (`auth`, `data`, `features`, `payments`, `ui`, `admin`).
- `src/js/security/` y `src/js/ui/`
  - Utilidades especializadas y componentes UI.
- `public/js/`
  - Espejo para build estático y consumo por rutas absolutas en producción.

## Entry points

- `index.html`
  - Dev y build cargan `/js/index-head-init.js` y `/js/main-entry.js`.
  - En localhost, Vite resuelve esas rutas contra `src/`; en build estático se sirven desde `public/`.

- `src/js/index-head-init.js`
  - Loader temprano de runtime config, GTM y compatibilidad de estilos deferred.

- `src/js/main-entry.js`
  - Arranque principal (auth/app-state/bootstrap).

- `src/main.js`
  - Entry Vite que carga estilos base y delega en `src/js/core/bootstrap.js`.

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
- Contiene: users\*, AdminDataManager, firestore-data-cleaner, firebase-permissions-handler,
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

## Static

- `public/` contiene assets estáticos y el espejo JS/CSS para la salida estática.
- `tools/build-static-dist.js` prepara `dist/` desde `public/` + `index.html`.
- `tools/check-mirror-consistency.js` y `tools/refresh-mirror-artifacts.js` vigilan la sincronía entre `src/` y `public/`.

## Notas Localhost

- RUM (`real-user-monitoring.js`) desactivado en localhost para evitar `POST /api/metrics` 404.
- `public/js/local-dev-config.js` se carga solo en localhost como override opcional de runtime.

## Próximos pasos

1. Reducir dependencias legacy y globals en `src/js`.
2. Seguir encapsulando dominios detrás de `modules/*`.
3. Simplificar el mirror `src/` -> `public/` cuando el build permita eliminar duplicación.
