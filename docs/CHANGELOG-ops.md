# Changelog Ops

## 2026-03-19

### Scope

Stripe/runtime stabilization, localhost auth recovery under App Check enforcement, smoke E2E hardening, and repository hygiene for release readiness.

### Implemented

1. Stripe/local runtime stabilization

- Files:
  - `public/config/runtime-config.json`
  - `src/js/core/bootstrap.js` + mirror in `public/js/core/bootstrap.js`
  - `src/js/index-head-init.js` + mirror in `public/js/index-head-init.js`
  - `src/js/cart-manager.js` + mirror in `public/js/cart-manager.js`
- Fixed localhost/Vite runtime behavior so Stripe config is respected and checkout wiring is initialized reliably.

2. Local auth/App Check recovery when Auth enforce is active

- Files:
  - `src/js/app-check-init.js` + mirror in `public/js/app-check-init.js`
  - `src/js/auth.js` + mirror in `public/js/auth.js`
- Localhost only enables App Check when a real debug token exists.
- Added recovery path for `auth/firebase-app-check-token-is-invalid` in local development.

3. Tooling and quality gates hardening

- Files:
  - `tools/run-lighthouse-ci.js`
  - `tools/scan-secrets.ps1`
  - `package.json`
  - `tools/clean.js`
- Lighthouse CI now reuses Playwright Chromium.
- Windows secret scan invocation is stable.
- Added local cleanup helpers and kept release checks green.

4. E2E smoke and local runbooks

- Files:
  - `tests/e2e/admin-smoke.spec.js`
  - `tests/setup.js`
  - `playwright.config.js`
  - `docs/LOCAL_DEV.md`
  - `.env.e2e.example`
- Public smoke is always runnable.
- Admin smoke can run with local-only env credentials.
- Local dev docs now explicitly describe the App Check debug-token requirement.

5. Repository hygiene

- Files:
  - `.gitattributes`
  - `.gitignore`
- Pinned repository line endings and reduced Windows Git noise in the working tree.

## 2026-02-19

### Scope

Stability and maintainability hardening for auth/app-check local flows, admin logging noise reduction, and security operations documentation.

### Implemented

1. Local App Check fail-open (dev-only)

- File: `src/js/app-check-init.js` (+ mirror en `public/js/app-check-init.js`)
- In localhost, App Check initialization failures no longer hard-block Auth/Firestore development flow.
- Production behavior remains strict.

2. Auth precheck improvements for local development

- File: `src/js/auth.js` (+ mirror en `public/js/auth.js`)
- Improved handling for `auth/firebase-app-check-token-is-invalid` in localhost.
- Added local fallback behavior to avoid repeated lockout loops.

3. Console noise cleanup (expected network/app-check issues)

- Files:
  - `src/js/admin-protection-system.js`
  - `src/js/admin-navigation-unified.js`
  - `src/js/public-settings-loader.js`
  - mirrors en `public/js/...`
- Expected transient/offline/app-check network failures are downgraded from warning to debug in normal local operation.

4. Security and operations runbooks

- Updated: `docs/KEY_ROTATION_TEMPLATE.md`
- Added: `docs/APP_CHECK_ENFORCE_CHECKLIST.md`
- Updated: `docs/APP_CHECK_SETUP.md`

### Validation

1. `npm run mirror:check:strict` passed.
2. `npm run build --silent` passed.
3. `npm run security:scan` no critical findings.

### Relevant commits

1. `6b40c85` refactor(app-check): unify localhost debug-token flow and auth precheck guidance
2. `df8f241` docs(security): add key-rotation runbook and app-check enforce checklist
3. `01f6d98` docs(security): redact concrete firebase api key in rotation runbook
4. `6e3ee90` fix(local-dev): fail-open app-check on localhost to avoid auth/firestore lockout
5. `e20b597` chore(logging): silence expected local network/app-check noise in admin/public loaders
