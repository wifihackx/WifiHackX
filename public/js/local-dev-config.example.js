// Local-only development configuration (DO NOT COMMIT with real secrets).
// 1) Copy to: js/local-dev-config.js
// 2) Fill your real App Check debug token
// 3) Keep it untracked (.gitignore already covers it)

window.__WFX_LOCAL_DEV__ = {
  appCheck: {
    autoEnableLocal: true,
    localDebugToken: 'REPLACE_WITH_REAL_APPCHECK_DEBUG_TOKEN',
  },
};
