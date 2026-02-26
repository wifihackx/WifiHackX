# Local Development Setup

## Goal

- Keep local login stable with App Check enforce enabled.
- Avoid exposing debug tokens in tracked files.

## One-time setup (local only)

1. Copy `public/js/local-dev-config.example.js` to `public/js/local-dev-config.js`.
2. Copy `src/js/local-dev-config.example.js` to `src/js/local-dev-config.js`.
3. Set your real App Check debug token in both files.

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
2. Update `public/js/local-dev-config.js` and `src/js/local-dev-config.js`.
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

## Release helper

- Run:

```bash
npm run release:final
```

- It executes full tests, deploy check, and final git status.
