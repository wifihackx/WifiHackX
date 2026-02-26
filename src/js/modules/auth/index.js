// Auth module wrapper for legacy scripts.

import '../../auth-handler.js';
import '../../auth-init-early.js';
import '../../auth.js';
import { initAuthTabs } from '../../auth-tabs-handler.js';
import { initAuthNotifications } from '../../auth-notifications.js';

if (typeof window !== 'undefined') {
  const host = window.location && window.location.hostname;
  const isLocalhost = host === 'localhost' || host === '127.0.0.1';
  const bypassValue =
    isLocalhost && window.localStorage
      ? window.localStorage.getItem('wifihackx:dev:recaptcha_bypass')
      : null;
  // En localhost, bypass activado por defecto salvo que el valor sea "0".
  const shouldBypassRecaptcha = isLocalhost && (bypassValue === null || bypassValue === '1');
  window.__WFX_RECAPTCHA_LOCAL_BYPASS__ = shouldBypassRecaptcha;
  if (shouldBypassRecaptcha) {
    import('../../recaptcha-localhost-bypass.js').catch(() => {});
  }
}

export function initAuth() {
  initAuthNotifications();
  initAuthTabs();
}
