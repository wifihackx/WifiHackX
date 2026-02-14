// Auth module wrapper for legacy scripts.

import '../../auth-handler.js';
import '../../auth-init-early.js?v=1.3';
import '../../auth.js?v=1.1';
import '../../recaptcha-localhost-bypass.js';
import { initAuthTabs } from '../../auth-tabs-handler.js';
import { initAuthNotifications } from '../../auth-notifications.js';

export function initAuth() {
  initAuthNotifications();
  initAuthTabs();
}
