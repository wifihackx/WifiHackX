// Auth module wrapper for legacy scripts.

import '../../auth-handler.js';
import '../../auth-init-early.js?v=1.3';
import '../../auth.js?v=1.1';
import { initAuthTabs } from '../../auth-tabs-handler.js';
import { initAuthNotifications } from '../../auth-notifications.js';

if (typeof window !== 'undefined') {
  const host = window.location && window.location.hostname;
  const isLocalhost = host === 'localhost' || host === '127.0.0.1';
  const isExplicitBypassEnabled =
    isLocalhost &&
    window.localStorage &&
    window.localStorage.getItem('wifihackx:dev:recaptcha_bypass') === '1';
  if (isExplicitBypassEnabled) {
    import('../../recaptcha-localhost-bypass.js').catch(() => {});
  }
}

export function initAuth() {
  initAuthNotifications();
  initAuthTabs();
}
