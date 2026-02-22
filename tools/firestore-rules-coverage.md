# Firestore Rules Coverage Matrix

Last updated: 2026-02-22

## Scope
This document tracks automated rule coverage executed by `npm run test:rules` (`tests/rules/firestore.rules.test.js`).

## Covered Areas

| Domain | Rule intent | Covered |
|---|---|---|
| `users/{userId}` | Self-create with constrained payload | Yes |
| `users/{userId}` | Owner update restrictions (`role`, `status`, ban fields) | Yes |
| `users` (list) | Admin-only list query | Yes |
| `orders/{orderId}` | Read owner/admin only, client create denied | Yes |
| `orders` (list) | Admin-only list query | Yes |
| `users/{userId}/purchases/{purchaseId}` | Owner/admin write with strict schema | Yes |
| `purchases/{purchaseId}` (root) | Read owner/admin, create denied, update/delete admin only | Yes |
| `collectionGroup purchases` | Admin-only audit query | Yes |
| `announcements/{id}` | Public read | Yes |
| `publicSettings/{id}` | Public read, admin write | Yes |
| `processedEvents/{id}` | Controlled create schema | Yes |
| `processedEvents` (list) | Admin-only list query | Yes |
| `security_logs/{id}` | Controlled create schema and limits | Yes |
| `security_logs` (list) | Admin-only list query | Yes |
| `analytics_visits/{id}` | Public create with strict schema | Yes |
| `activities` (list) | Admin-only list query | Yes |
| `alerts` (list) | Admin-only list query | Yes |
| `customers/{userId}` | Owner/admin read, owner/admin delete | Yes |
| `customers/{userId}/checkout_sessions/{id}` | Owner read/create only, no update/delete | Yes |
| `customers/{userId}/payments/{id}` | Owner/admin read, write denied | Yes |
| `customers/{userId}/subscriptions/{id}` | Owner/admin read, write denied | Yes |
| `/{document=**}` fallback | Deny unknown collections by default | Yes |

## Current Test Inventory

- File: `tests/rules/firestore.rules.test.js`
- Test count: 54
- Result target: all pass with Firestore Emulator.
- Nightly fuzz suite: `tests/rules/firestore.rules.fuzz.test.js` (non-blocking CI)

## Gaps / Next Hardening Targets

1. Expand fuzz suite with mixed-type mutations (maps, arrays, nullability edges) for `security_logs.details` and `analytics_visits.viewport`.
2. Add historical trend tracking for fuzz failures (artifact retention + issue auto-open) if nightly starts regressing.

## Gate Enforcement

- Local release gate: `npm run gate:release`
- CI gate workflow: `.github/workflows/quality-gates.yml`
- Nightly fuzz workflow: `.github/workflows/nightly-rules-fuzz.yml`
