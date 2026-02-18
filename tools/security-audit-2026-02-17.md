# Security Audit (2026-02-17)

## Scope
- Hardcoded values audit in frontend + rules.
- Review of Firestore rule bypass patterns.

## Fixed in this pass
- Removed fixed-domain share URLs and switched to environment-safe URLs:
  - `index.html` footer share now uses relative URL.
  - `public/scanner.html` share URL now relative.
  - `public/ip-hunter.html` share URL now relative.
  - `src/js/announcement-system.js` + `public/js/announcement-system.js` now build share base from `window.location.origin` fallback.
  - `src/js/announcement-public-modal.js` + `public/js/announcement-public-modal.js` now build share base from `window.location.origin` fallback.
- Removed hardcoded UID bypass in Firestore rules:
  - Replaced all `isAdmin() || request.auth.uid == 'hxv41mt6TQYEluvdNeGaIkTWxWo1'` with `isAdmin()`.
- Removed duplicated `announcements` rules block in `firestore.rules` (same behavior, lower maintenance risk).
- Hardened public `create` rules with schema/type/size validation:
  - `activities`
  - `processedEvents`
  - `analytics_visits`
  - `security_logs`
  This keeps existing flows but blocks malformed/noisy payloads.
- Added Firestore rules test harness:
  - `tests/rules/firestore.rules.test.js`
  - `npm run test:rules` (Firestore emulator + Vitest)

## Residual risk (requires product decision)
- Public reads/writes still allowed in specific collections by design:
- Public reads/writes still allowed in specific collections by design:
  - `announcements` read public (`allow read: if true;`) appears twice in rules.
  - `products` read public.
  - `publicSettings` read public.
  - `analytics_visits` read public + create public (now schema validated).
  - `activityLog` create public (now schema validated).
  - `processedEvents` create public (now schema validated).
  - `security_logs` create public (now schema validated).
- These can be valid for a public storefront, but they should be periodically reviewed for abuse/spam and data leakage.

## Recommended next hardening
1. Restrict public `create` rules (`activityLog`, `analytics_visits`, `processedEvents`, `security_logs`) with stricter schema + rate-limit signals + App Check verification metadata.
2. Consider moving canonical domain values into runtime config for static SEO fields only if multi-domain operation is needed.
