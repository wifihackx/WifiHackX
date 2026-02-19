/**
 * Admin Action Audit
 * Logs critical admin UI actions into security_logs for operational traceability.
 */
'use strict';

function setupAdminActionAudit() {
  const debugLog = (...args) => {
    if (window.__WFX_DEBUG__ === true || window.__WIFIHACKX_DEBUG__ === true) {
      console.info(...args);
    }
  };

  const getCurrentUser = () => {
    if (window.auth?.currentUser) return window.auth.currentUser;
    if (window.firebaseModular?.auth?.currentUser) return window.firebaseModular.auth.currentUser;
    try {
      if (window.firebase?.auth) return window.firebase.auth().currentUser;
    } catch (_e) {}
    return null;
  };

  async function writeLog(entry) {
    const payload = {
      type: 'admin_action',
      source: 'admin_ui',
      createdAt:
        window.firebaseModular?.serverTimestamp?.() ||
        (window.firebase?.firestore?.FieldValue?.serverTimestamp
          ? window.firebase.firestore.FieldValue.serverTimestamp()
          : Date.now()),
      ...entry,
    };

    const mod = window.firebaseModular;
    if (mod?.db && mod.collection && mod.addDoc) {
      const ref = mod.collection(mod.db, 'security_logs');
      await mod.addDoc(ref, payload);
      return;
    }

    if (window.db?.collection) {
      await window.db.collection('security_logs').add(payload);
      return;
    }

    throw new Error('Firestore no disponible para auditoria');
  }

  const log = async (action, details = {}, level = 'info') => {
    if (!action) return false;
    const user = getCurrentUser();
    const entry = {
      action: String(action),
      level: String(level || 'info'),
      actorUid: user?.uid || '',
      actorEmail: user?.email || '',
      details: details || {},
    };
    try {
      await writeLog(entry);
      return true;
    } catch (error) {
      debugLog('[AdminActionAudit] audit write skipped:', error?.message || error);
      return false;
    }
  };

  window.AdminActionAudit = window.AdminActionAudit || { log };
  window.AdminActionAudit.log = log;
}

export function initAdminActionAudit() {
  if (window.__ADMIN_ACTION_AUDIT_INITED__) return;
  window.__ADMIN_ACTION_AUDIT_INITED__ = true;
  setupAdminActionAudit();
}

if (typeof window !== 'undefined' && !window.__ADMIN_ACTION_AUDIT_NO_AUTO__) {
  initAdminActionAudit();
}
