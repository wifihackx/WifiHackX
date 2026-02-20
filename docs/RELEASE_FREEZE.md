# Release Freeze Checklist

## Goal
Final production readiness gate before releasing/deploying.

## Preconditions
- Branch is `main`.
- Working tree clean (`git status`).
- Local dev secrets are not tracked:
  - `public/js/local-dev-config.js`
  - `src/js/local-dev-config.js`

## Mandatory Commands
Run in this order:

```bash
npm run mirror:check:strict
npm run security:scan
npm run test:all
npm run validate:dist
npm run validate:sprint5
npm run lighthouse:ci
npm run deploy:check
# If Stripe checkout is enabled in this release, deploy with key injection:
# $env:WFX_STRIPE_PUBLIC_KEY='pk_live_...'
# npm run deploy:hosting:stripe
```

Shortcut automation:

```bash
# Standard release flow
npm run release:final

# Fast local dry-run (no deploy/smoke/live/tests)
npm run release:final:fast

# Stripe-enabled release flow (inject key at deploy-time, no hardcode in repo)
$env:WFX_STRIPE_PUBLIC_KEY='pk_live_...'
npm run release:final:stripe

# Optional: create local annotated tag after successful checks
powershell -ExecutionPolicy Bypass -File tools/release-final.ps1 -TagVersion v2026.02-freeze -TagMessage "Release freeze"
```

Expected:
- All commands exit with code 0.
- No critical findings in `security:scan`.

## Git Release Steps
```bash
git status --short
git push origin main
git tag -a v2026.02-freeze -m "Release freeze: hardened auth/app-check/CSP/CI gates"
git push origin v2026.02-freeze
```

## Post-Deploy Verification
```bash
npm run smoke:live
npm run validate:sprint5:live
```

## Rollback Plan
- Re-deploy previous known-good Firebase Hosting release/version.
- Re-run:
  - `npm run validate:sprint5:live`
  - `npm run smoke:live`

## Notes
- Browser Firebase API key in frontend is expected (public-by-design).
- Security posture depends on:
  - strict App Check enforce
  - API key referrer restrictions
  - backend secret rotation discipline
