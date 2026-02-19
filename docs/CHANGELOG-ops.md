# Changelog Ops

## 2026-02-19

### Scope
Stability and maintainability hardening for auth/app-check local flows, admin logging noise reduction, and security operations documentation.

### Implemented
1. Local App Check fail-open (dev-only)
- File: `src/js/app-check-init.js` (+ mirror in `public/js/app-check-init.js`)
- In localhost, App Check initialization failures no longer hard-block Auth/Firestore development flow.
- Production behavior remains strict.

2. Auth precheck improvements for local development
- File: `src/js/auth.js` (+ mirror in `public/js/auth.js`)
- Improved handling for `auth/firebase-app-check-token-is-invalid` in localhost.
- Added local fallback behavior to avoid repeated lockout loops.

3. Console noise cleanup (expected network/app-check issues)
- Files:
  - `src/js/admin-protection-system.js`
  - `src/js/admin-navigation-unified.js`
  - `src/js/public-settings-loader.js`
  - mirrors in `public/js/...`
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
