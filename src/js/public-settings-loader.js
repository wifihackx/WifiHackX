/* Public Settings Loader
 * Loads system settings and injects real data into public pages.
 */
'use strict';

async function loadPublicSettings() {
  const decodeEmailFromDataAttr = encoded => {
    if (!encoded) return '';
    try {
      const value = atob(encoded).trim();
      return value.includes('@') ? value : '';
    } catch {
      return '';
    }
  };

  const applyContactEmail = contactEmail => {
    if (!contactEmail) return;
    const normalized = String(contactEmail).trim();
    if (!normalized) return;

    window.RUNTIME_CONFIG = window.RUNTIME_CONFIG || {};
    window.RUNTIME_CONFIG.support = window.RUNTIME_CONFIG.support || {};
    window.RUNTIME_CONFIG.support.email = normalized;

    document.querySelectorAll('[data-contact-email]').forEach(el => (el.textContent = normalized));

    document.querySelectorAll('[data-contact-email-link]').forEach(el => {
      const prefix = el.getAttribute('data-contact-email-prefix') || '';
      el.textContent = `${prefix}${normalized}`;
      el.setAttribute('href', `mailto:${normalized}`);
    });
  };

  const applyEncodedFallbackEmail = () => {
    document.querySelectorAll('[data-contact-email-link]').forEach(el => {
      const encoded = el.getAttribute('data-contact-email-b64') || '';
      const decoded = decodeEmailFromDataAttr(encoded);
      if (!decoded) return;
      const prefix = el.getAttribute('data-contact-email-prefix') || '';
      el.textContent = `${prefix}${decoded}`;
      el.setAttribute('href', `mailto:${decoded}`);
    });
  };

  const isExpectedNetworkIssue = error => {
    const code = String(error?.code || '').toLowerCase();
    const msg = String(error?.message || '').toLowerCase();
    return (
      code.includes('network-request-failed') ||
      msg.includes('network-request-failed') ||
      msg.includes('failed to get document because the client is offline') ||
      msg.includes('fetch-status-error') ||
      msg.includes('offline')
    );
  };

  const getPublicSettingsDocModular = async () => {
    const mod = window.firebaseModular;
    if (!mod || !mod.db || !mod.doc || (!mod.getDoc && !mod.getDocFromServer)) return null;
    const ref = mod.doc(mod.db, 'publicSettings', 'system-config');
    const snap = mod.getDocFromServer ? await mod.getDocFromServer(ref) : await mod.getDoc(ref);
    return snap.exists() ? snap.data() : null;
  };

  const getPublicSettingsDocCompat = async () => {
    if (!window.db || !window.db.collection) return null;
    const doc = await window.db.collection('publicSettings').doc('system-config').get();
    const exists = typeof doc.exists === 'function' ? doc.exists() : !!doc.exists;
    return exists ? doc.data() : null;
  };

  try {
    const runtimeEmail = window.RUNTIME_CONFIG?.support?.email || '';
    if (runtimeEmail) {
      applyContactEmail(runtimeEmail);
    } else {
      applyEncodedFallbackEmail();
    }

    const data = (await getPublicSettingsDocModular()) || (await getPublicSettingsDocCompat());
    if (!data) return;

    const contactEmail = data.general?.contactEmail || '';
    const siteName = data.general?.siteName || '';

    if (siteName) {
      document.querySelectorAll('[data-site-name]').forEach(el => (el.textContent = siteName));
    }

    if (contactEmail) applyContactEmail(contactEmail);

    window.dispatchEvent(
      new CustomEvent('public-settings:loaded', {
        detail: {
          contactEmail: contactEmail || '',
          siteName: siteName || '',
        },
      })
    );
  } catch (error) {
    const msg = String(error?.message || '').toLowerCase();
    const isPermissionExpected =
      msg.includes('missing or insufficient permissions') || msg.includes('permission-denied');
    if (isPermissionExpected) {
      if (window.__WFX_DEBUG__ === true || window.__WIFIHACKX_DEBUG__ === true) {
        console.info('[PublicSettings] Lectura no permitida para usuario actual');
      }
      return;
    }
    if (isExpectedNetworkIssue(error)) {
      if (window.__WFX_DEBUG__ === true || window.__WIFIHACKX_DEBUG__ === true) {
        console.info('[PublicSettings] Lectura omitida por error de red esperado');
      }
      return;
    }
    console.warn('[PublicSettings] No se pudo cargar settings:', error);
  }
}

if (window.db || window.firebaseModular?.db) {
  loadPublicSettings();
} else {
  window.addEventListener('firebase:initialized', loadPublicSettings, {
    once: true,
  });
}
