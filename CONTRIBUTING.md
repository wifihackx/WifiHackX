# Contributing

## Branching

- Base branch: `main`
- Create feature branches from `main`:
  - `feat/<short-name>`
  - `fix/<short-name>`
  - `chore/<short-name>`

## Local Checks (before PR)

Run, in order:

1. `npm run lint`
2. `npx --yes knip`
3. `npm run mirror:check:strict`
4. `npm run build`
5. `npm run validate:dist`
6. `npm run test:rules`

Optional (recommended when touching auth/admin flows):

1. `npm run test:e2e:smoke`

## Pull Requests

- Keep PRs focused (single concern).
- Include a short change summary and risk notes.
- If UI/behavior changed, attach screenshots or test evidence.
- Ensure GitHub Actions `Quality Gates` is green.

## E2E Smoke Secrets (GitHub)

Manual workflow: `.github/workflows/e2e-smoke.yml`

Required repository secrets:

- `WFX_E2E_ADMIN_EMAIL`
- `WFX_E2E_ADMIN_PASSWORD`

## Security

- Never commit private keys, service account files, or production secrets.
- Keep Stripe key out of source; inject via deploy/build env vars.
