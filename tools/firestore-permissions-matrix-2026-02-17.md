# Firestore Permission Matrix (2026-02-17)

## Method
- Source-of-truth audit on deployed rules file: `firestore.rules`.
- Cross-check against real client/server writes in:
  - `src/js/analytics-tracker.js`
  - `src/js/ultimate-download-manager.js`
  - `functions/index.js`
- This is a static verification matrix (no emulator tests in this repo yet).

## Role Model
- `Admin`: authenticated user with custom claim `admin == true`.
- `User`: authenticated user without admin claim.
- `Anonymous`: unauthenticated user.

## Effective Access Matrix
| Collection | Anonymous | User | Admin | Notes |
|---|---|---|---|---|
| `users/{userId}` | `R:No C:No U:No D:No` | `R:Own C:Own U:Own-limited D:No` | `R/C/U/D:Yes` | User update cannot touch role/status/ban fields |
| `users/{userId}/purchases/{purchaseId}` | `R:No C:No U:No D:No` | `R:Own C:No U:No D:No` | `R/U/D:Yes` | Create blocked from client |
| `users/{userId}/cart/{itemId}` | `R/C/U/D:No` | `R/C/U/D:Own` | `R:Yes` | Admin has read only |
| `announcements/{id}` | `R:Yes` | `R:Yes` | `R/C/U/D:Yes` | Public catalog |
| `products/{id}` | `R:Yes` | `R:Yes` | `R/C/U/D:Yes` | Public catalog |
| `orders/{id}` | `R:No` | `R:Own C:No U:No D:No` | `R/U/D:Yes` | Create blocked from client |
| `activities/{id}` | `R/C/U/D:No` | `C:SchemaValidated` | `R/C:SchemaValidated` | `U/D` blocked |
| `publicSettings/{id}` | `R:Yes` | `R:Yes` | `R/C/U/D:Yes` | Write restricted to public fields by rule |
| `carts/{userId}` | `R/C/U/D:No` | `R/C/U:Own D:Own` | `R/D:Yes` | Admin cannot create/update |
| `processedEvents/{id}` | `R/C/U/D:No` | `C:SchemaValidated` | `R/C:SchemaValidated` | `U/D` blocked |
| `analytics_visits/{id}` | `R:Yes C:SchemaValidated U:No D:No` | `R:Yes C:SchemaValidated U:No D:No` | `R:Yes C:SchemaValidated D:Yes` | Public analytics ingestion |
| `banLogs/{id}` | `R/C/U/D:No` | `R/C/U/D:No` | `R/C:Yes U/D:No` | Immutable admin log |
| `bannedIPs/{ip}` | `R/C/U/D:No` | `R/C/U/D:No` | `R/C/U/D:Yes` | Admin only |
| `security_logs/{id}` | `R:No C:SchemaValidated U:No D:No` | `R:No C:SchemaValidated U:No D:No` | `R/C/U/D:Yes` | Public create remains, now validated |
| `security_logs_diagnostics/{id}` | `R/C/U/D:No` | `R/C/U/D:No` | `R:Yes C/U/D:No` | Read-only for admin |
| `alerts/{id}` | `R/C/U/D:No` | `R/C/U/D:No` | `R/U/D:Yes` | Create blocked from client |
| `download_tokens/{id}` | `R/C/U/D:No` | `R/C/U/D:No` | `R/C/U/D:No` | Fully blocked in rules |
| `purchases/{id}` (root) | `R/C/U/D:No` | `R:Own C:No U:No D:No` | `R/U/D:Yes` | Create blocked from client |
| `customers/{userId}` | `R/C/U/D:No` | `R/D:Own` | `R/D:Yes` | Nested Stripe subcollections restricted |
| `/{path=**}/purchases/{id}` (group) | `R:No` | `R:No` | `R:Yes` | Admin audit read |

## Frontend/Functions Write Compatibility Check
- `analytics_visits` writes from `src/js/analytics-tracker.js` are compatible with new schema validator.
- `security_logs` writes from:
  - `src/js/ultimate-download-manager.js`
  - `functions/index.js` (`writeSecurityAudit`)
  remain compatible with new validator.
- No regressions detected in rule compilation/deploy.

## Residual Risk
- Public creates are still intentionally enabled in:
  - `activities`
  - `processedEvents`
  - `analytics_visits`
  - `security_logs`
- They are now schema-validated, but still susceptible to high-volume spam without backend rate controls.

## Recommended Next Step
- Add write throttling at backend edge (App Check + callable/logging gateway) and migrate public creates to Cloud Functions-only where feasible.
