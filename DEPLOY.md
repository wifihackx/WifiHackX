# Deploy Guide

## Stable deploy command

Use deploy directly from terminal (do not wrap it in an npm script in this environment):

```powershell
firebase deploy --only hosting
```

This already runs `predeploy` and `postdeploy` from `firebase.json`:

1. `npm run sitemap`
2. `npm run build`
3. `npm run validate:sprint5`
4. `npm run validate:sprint5:live`

## Live verification

```powershell
npm run deploy:hosting:verify
```

## GitHub Actions

- CI workflow: `.github/workflows/ci.yml`
  - Build + config validation on PR/push
  - Lighthouse and live validation on `main` / manual dispatch
- Deploy workflow: `.github/workflows/deploy-hosting.yml`
  - Deploy to Firebase Hosting using `FIREBASE_SERVICE_ACCOUNT_WHITE_CASTER_466401_G0` secret
  - Live validation after deploy

## GitHub secrets and variables

Required secret (Repository -> Settings -> Secrets and variables -> Actions -> Secrets):

- `FIREBASE_SERVICE_ACCOUNT_WHITE_CASTER_466401_G0`
  - Value: full JSON of Firebase service account credentials with Hosting deploy permissions.

Recommended repository variables:

- `FIREBASE_PROJECT_ID`
  - Current value: `white-caster-466401-g0`
- `SITE_URL`
  - Current value: `https://white-caster-466401-g0.web.app`
  - Future value (after domain cutover): `https://wifihackx.com`
- `SPRINT5_TARGET_URL`
  - Current value: `https://white-caster-466401-g0.web.app`
  - Future value (after domain cutover): `https://wifihackx.com`

## When custom domain is ready

After configuring DNS/custom domain in Firebase Hosting, run:

```powershell
$env:SITE_URL='https://wifihackx.com'
$env:SPRINT5_TARGET_URL='https://wifihackx.com'
npm run sitemap
node tools/submit-indexnow.js
node tools/validate-sprint5.js --live --url=https://wifihackx.com
firebase deploy --only hosting
```

You can also keep values in env vars based on `.env.example`:

1. Copy `.env.example` to your preferred env setup.
2. Update both values to `https://wifihackx.com`.

## Domain Cutover Script

You can run the full domain cutover workflow with one script.

Dry run first:

```powershell
powershell -ExecutionPolicy Bypass -File tools/domain-cutover.ps1 -Domain wifihackx.com -DryRun
```

Then real run with deploy:

```powershell
powershell -ExecutionPolicy Bypass -File tools/domain-cutover.ps1 -Domain wifihackx.com -Deploy
```

Additional runbooks:

- `DOMAIN_CUTOVER_CHECKLIST.md`
- `MONITORING_POST_LAUNCH.md`
