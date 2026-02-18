# Security Follow-up (2026-02-18)

## Applied now
- Updated Cloud Functions SDK dependency:
  - `functions/package.json`: `firebase-functions` -> `^6.0.1`
  - `functions/package-lock.json` regenerated (resolved to `6.6.0`)
- Added repo secret scan command:
  - `tools/scan-secrets.ps1`
  - `npm run security:scan`

## Findings (current tree)
- Public config keys are present in `index.html` runtime config:
  - Stripe publishable key (`pk_test_...`) in `index.html`
  - Firebase API key (`AIza...`) in `index.html`
- These are not private server secrets, but should still be rotated if previously exposed in unintended places and should be managed as deploy-time config.

## Rotation runbook (Stripe + Firebase)
1. Stripe:
   - Dashboard -> Developers -> API keys.
   - Create new publishable/secret keys and new webhook signing secret (`whsec_...`) per environment.
   - Update backend secret storage first (Firebase Functions params/secrets).
   - Deploy functions, then swap frontend publishable key.
   - Re-test checkout + webhook end-to-end.
   - Revoke old keys.
2. Firebase:
   - If any service account key JSON was ever committed/shared, create a new key, update workloads, then disable/delete old key.
   - Prefer Workload Identity / default service account over long-lived JSON keys.
   - For web config (`apiKey`), rotate only if policy requires; it is identifier-level but rotation can reduce abuse/noise.
3. Post-rotation validation:
   - `npm run security:scan`
   - test checkout, login, admin panel, and functions endpoints.

## About `punycode` CLI warning
- `DEP0040` from Node CLI toolchain is informational.
- Usually emitted by transitive dependencies in Firebase/Node tooling.
- Action: monitor upstream updates; do not block deploy for this warning alone.
