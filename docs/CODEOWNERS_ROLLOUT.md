# CODEOWNERS Rollout

Use this file when onboarding new maintainers.

## Current mode

- Single-owner fallback: `@wifihackx`
- Domain sections are already split in `.github/CODEOWNERS`
- `main` branch protection requires code owner review

## When adding collaborators

1. Add GitHub users/teams with write access.
2. Update `.github/CODEOWNERS`:
   - Replace fallback-only sections with real owners by domain.
   - Keep the most specific paths last (last match wins).
3. Open a PR and verify:
   - requested reviewers include expected owners
   - `quality-gate` passes
4. Merge and announce new ownership boundaries.

## Suggested ownership split

- Frontend app (`src/js`, `public/js`, CSS)
- Security/policy (`firestore.rules`, config validation, secret scanning)
- CI/DevOps (`.github/workflows`)
- Payments/Admin (`stripe-*`, `paypal-*`, `admin-*`)
