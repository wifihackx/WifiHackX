# Post-Launch Monitoring Runbook

## First 30 minutes

1. Open production home and key pages:
   - `/`
   - `/scanner.html`
   - `/ip-hunter.html`
   - `/faq.html`
2. Confirm there are no console errors blocking UI.
3. Run live validation:
   - `npm run deploy:hosting:verify`

## First 24 hours

1. Review Sentry issues:
   - New unhandled exceptions
   - Error spikes after deploy window
2. Review availability:
   - Home page response and TLS validity
3. Validate SEO endpoints:
   - `/robots.txt`
   - `/sitemap.xml`
   - `/sitemap-images.xml`

## Performance baseline

1. Run:
   - `npm run lighthouse:ci`
2. Capture and store baseline values:
   - Performance score
   - LCP
   - CLS
   - TBT

## Rollback trigger examples

Rollback if any of the following are observed:

1. Live validation fails (`validate:sprint5:live`).
2. Sustained 5xx errors in production.
3. Critical user path broken (login, checkout, content rendering).
4. Severe CSP/security header regression.

