# Mirror Workflow

## Policy

- Source of truth: `src/`
- Managed mirror roots:
  - `src/js` -> `public/js`
  - `src/css` -> `public/css`
- `public/` stays editable only for assets outside those managed roots.
- Explicit mirror exception:
  - `public/js/local-dev-config.js`

## Required flow

1. Edit files in `src/`.
2. Run `npm run mirror:sync`.
3. Run `npm run mirror:guard`.
4. Run `npm run mirror:check:strict`.

## Guardrails

- `npm run mirror:sync` copies managed files from `src` to `public` and removes stale mirrored files from `public`.
- `npm run mirror:guard` fails if a mirrored file under `public/` changed without its `src/` counterpart changing too.
- `npm run build` and `npm run preprod` run with mirror synchronization in the path, so `dist/` is built from a deterministic `public/`.

## Current migration batch

- `announcement-admin-init.js`
- `announcement-form-handler.js`
- `announcement-public-modal.js`
- `announcement-system.js`
- `announcement-utils.js`
- `cart-manager.js`
- `post-checkout-handler.js`
- `ultimate-download-manager.js`

These files are the active reference batch for legacy cleanup because they recently carried the highest duplication churn.
