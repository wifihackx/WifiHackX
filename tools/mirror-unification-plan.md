# Plan De Unificacion src/public

## Objetivo

- Definir `src/` como fuente unica de verdad.
- Reducir deriva entre `src/` y `public/` en lotes controlados.
- Mantener comportamiento en produccion sin regresiones.

## Guardas activas

- CI bloqueante: `npm run mirror:check:strict` en `.github/workflows/deploy-hosting.yml`.
- Auditoria de estado: `tools/duplication-audit.json` y `tools/duplication-audit.md`.

## Lotes

1. Payments (completado)

- `src/js/stripe-loader.js` -> `public/js/stripe-loader.js`
- `src/js/stripe-checkout.js` -> `public/js/stripe-checkout.js`
- `src/js/paypal-loader.js` -> `public/js/paypal-loader.js`
- `src/js/paypal-checkout.js` -> `public/js/paypal-checkout.js`

2. Auth + Navegacion (completado)

- Sincronizados en `public/` desde `src/`:
  - `auth.js`
  - `auth-init-early.js`
  - `common-handlers.js`
  - `navigation-helper.js`
  - `i18n.js`
- Ajuste aplicado:
  - vista inicial no autenticada configurable en `auth-init-early.js`:
    - `window.RUNTIME_CONFIG.auth.unauthenticatedView` (`loginView|homeView`)
    - fallback por defecto: `loginView`.

3. Admin Core (completado)

- `admin-loader.js`
- `admin-navigation-unified.js`
- `admin-services.js`
- `admin-settings.js`
- `admin.js`

4. Seguridad y observabilidad (completado)

- `nonce-init.js`, `security-bundle.js`, `sentry-init.js`, `real-user-monitoring.js`

5. Admin dashboard y renderers (completado)

- `admin-audit-renderer.js`
- `admin-dashboard-bootstrap.js`
- `admin-dashboard-core.js`
- `admin-dashboard-data.js`
- `admin-dashboard-ui.js`
- `admin-modals-component.js`
- `admin-panel-init.js`
- `admin-protection-system.js`
- `admin-section-interceptor.js`
- `admin-announcements-renderer.js`

6. Analytics + announcements (completado)

- `analytics.js`
- `analytics-enhanced.js`
- `analytics-tracker.js`
- `analytics-cards-generator.js`
- `announcement-system.js`
- `announcement-admin-init.js`
- `announcement-form-handler.js`
- `announcement-public-modal.js`

7. Event delegation + modal core + init controller (completado)

- `event-delegation.js`
- `event-delegation-manager.js`
- `modal-core.js`
- `modal-init-controller.js`
- `modal-emergency-close.js`
- `module-initializer.js`
- `view-init.js`

8. Auth notifications + permissions + cleaner (completado)

- `auth-notifications.js`
- `auth-tabs-handler.js`
- `firebase-permissions-handler.js`
- `firestore-data-cleaner.js`

9. Cookie consent + post checkout + users (completado)

- `cookie-consent.js`
- `post-checkout-handler.js`
- `purchase-success-modal.js`
- `purchases-list-modal.js`
- `users-actions.js`
- `users-data.js`
- `users-forms.js`
- `users-list-modal.js`
- `users-manager.js`
- `users-modals.js`
- `users-renderer.js`

10. Cart + checkout + realtime (completado)

- `cart-actions.js`
- `checkout-interceptor.js`
- `revenue-reset.js`
- `real-time-data-service.js`

11. UI interactions + accesibilidad (completado)

- `ui-interactions.js`
- `keyboard-shortcuts.js`
- `lucide-init.js`
- `high-contrast-toggle.js`
- `inline-accessibility.js`

12. Notification + feedback UX (completado)

- `notification-system.js`
- `success-sound.js`
- `confetti-animation.js`
- `return-to-footer.js`
- `static-pages-language-chips.js`

13. Core leftovers: utils + nav + i18n + auth/cart/system (completado)

- `utils.js`
- `lazy-loading.js`
- `navigation-helper.js`
- `common-handlers.js`
- `i18n.js`
- `auth.js`
- `cart-manager.js`
- `system-integration.js`

14. Final pass: landmarks + footer + generators + SW + app-check (completado)

- `aria-landmarks.js`
- `footer-navigation.js`
- `language-options-generator.js`
- `filter-buttons-generator.js`
- `sw-register.js`
- `app-check-init.js`

15. Paridad estructural completa (completado)

- Remanente `JS onlySrc` y `JS onlyPublic` espejado en ambas direcciones.
- Remanente `CSS onlySrc` y `CSS onlyPublic` espejado en ambas direcciones.
- Estado objetivo alcanzado en verificador:
  - `JS both=145 same=145 diff=0 onlySrc=0 onlyPublic=0`
  - `CSS both=46 same=46 diff=0 onlySrc=0 onlyPublic=0`

## Estrategia tecnica por lote

1. Sincronizar `public/` desde `src/` (quitar solo `export` cuando aplique).
2. Ejecutar:

- `npm run mirror:check`
- `npm run build --silent`
- `npm run validate:sprint5`

3. Desplegar hosting.
