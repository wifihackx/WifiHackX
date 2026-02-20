# WifiHackX v2

Web app for WiFi security auditing workflows, admin operations, and secure checkout flows.

## Local Development
- Setup and secure localhost auth/app-check flow: `docs/LOCAL_DEV.md`

## Release
- Final freeze checklist: `docs/RELEASE_FREEZE.md`
- Stripe deploy seguro por env var (sin hardcode): `npm run deploy:hosting:stripe`

## Quality Gates
- Local full release check: `npm run release:final`
- CI-safe release gate: `npm run release:final:ci`
- Mirror consistency gate: `npm run mirror:check:strict`

## Stripe Key Injection (Safe)
- Keep `index.html` with `"stripePublicKey": ""` in Git.
- Inject at build/deploy time with env var:
  - PowerShell:
    - `$env:WFX_STRIPE_PUBLIC_KEY='pk_live_...'; npm run deploy:hosting:stripe`
  - Or:
    - `npm run deploy:hosting:stripe -- -StripePublicKey 'pk_live_...'`
