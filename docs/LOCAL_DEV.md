# Local Development Setup

## Goal

- Keep local login stable with App Check enforce enabled.
- Avoid exposing debug tokens in tracked files.

## One-time setup (local only)

1. Create or update `public/js/local-dev-config.js` as your local-only override file.
2. Set your real App Check debug token or local Stripe key there.

Example:

```js
window.__WFX_LOCAL_DEV__ = {
  appCheck: {
    autoEnableLocal: true,
    localDebugToken: 'YOUR_REAL_DEBUG_TOKEN',
  },
};
```

## Why this is safe

- `local-dev-config.js` is ignored by git (`.gitignore`).
- No debug token is stored in `index.html` or any tracked runtime config.
- In localhost, the app auto-syncs localStorage from this private file.

## Rotation flow

1. Create a new debug token in Firebase App Check.
2. Update `public/js/local-dev-config.js`.
3. Reload localhost.
4. Revoke old token in Firebase.

## Verification

- In browser console:

```js
console.table(window.getAuthBindingStatus());
```

- Expected:
  - `forms.login.submitBound = true`
  - `appCheck.enabled = "1"`
  - `appCheck.runtimeStatus.ready = true`

## E2E admin smoke

1. Copy `.env.e2e.example` to `.env.e2e.local`.
2. Set real local-only values for:
   - `WFX_E2E_ADMIN_EMAIL`
   - `WFX_E2E_ADMIN_PASSWORD`
3. Run:

```bash
npm run test:e2e:smoke
```

Notes:

- `playwright.config.js` auto-loads `.env.e2e.local` and `.env.local` if present.
- `.env.e2e.local` stays out of git because `*.local` is ignored.
- Without those vars, the public smoke still runs and the admin-login smoke stays skipped.

## Release helper

- Run:

```bash
npm run release:final
```

- It executes full tests, deploy check, and final git status.
