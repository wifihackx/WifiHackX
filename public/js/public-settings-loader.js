/* Public Settings Loader
 * Loads system settings and injects real data into public pages.
 */
'use strict';

async function loadPublicSettings() {
  const getPublicSettingsDocModular = async () => {
    const mod = window.firebaseModular;
    if (!mod || !mod.db || !mod.doc || (!mod.getDoc && !mod.getDocFromServer))
      return null;
    const ref = mod.doc(mod.db, 'publicSettings', 'system-config');
    const snap = mod.getDocFromServer
      ? await mod.getDocFromServer(ref)
      : await mod.getDoc(ref);
    return snap.exists() ? snap.data() : null;
  };

  const getPublicSettingsDocCompat = async () => {
    if (!window.db || !window.db.collection) return null;
    const doc = await window.db
      .collection('publicSettings')
      .doc('system-config')
      .get();
    const exists = typeof doc.exists === 'function' ? doc.exists() : !!doc.exists;
    return exists ? doc.data() : null;
  };

  try {
    const data =
      (await getPublicSettingsDocModular()) ||
      (await getPublicSettingsDocCompat());
    if (!data) return;

    const contactEmail = data.general?.contactEmail || '';
    const siteName = data.general?.siteName || '';

    if (siteName) {
      document
        .querySelectorAll('[data-site-name]')
        .forEach(el => (el.textContent = siteName));
    }

    if (contactEmail) {
      document
        .querySelectorAll('[data-contact-email]')
        .forEach(el => (el.textContent = contactEmail));

      document.querySelectorAll('[data-contact-email-link]').forEach(el => {
        const prefix = el.getAttribute('data-contact-email-prefix') || '';
        el.textContent = `${prefix}${contactEmail}`;
        el.setAttribute('href', `mailto:${contactEmail}`);
      });
    }
  } catch (error) {
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

