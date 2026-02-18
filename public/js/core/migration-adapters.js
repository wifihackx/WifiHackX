// Compatibility adapters for legacy globals expected by older modules.
(() => {
  'use strict';

  if (!window.AppState) {
    return;
  }

  // Legacy alias used by some older scripts.
  if (!window.stateManager) {
    window.stateManager = window.AppState;
  }
})();
