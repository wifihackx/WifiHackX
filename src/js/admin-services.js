/*
 * Admin Services - Claims + Settings (centralized, low-risk)
 * Exposes:
 *  - window.AdminClaimsService
 *  - window.AdminSettingsService
 */

'use strict';

(function () {
  if (window.AdminSettingsService && window.AdminClaimsService) return;

  const DEFAULT_SETTINGS = {
    general: {
      siteName: 'WifiHackX',
      contactEmail: '',
      maintenanceMode: false,
    },
    security: {
      twoFactorAuth: true,
      sessionTimeout: 30,
      securityLogs: true,
      backupCodesWarningThreshold: 2,
      adminAllowlistEmails: '',
      adminAllowlistUids: '',
    },
    email: {
      smtpServer: '',
      smtpPort: '',
      emailNotifications: false,
    },
  };

  function normalizeSettings(input) {
    const src = input || {};
    return {
      general: { ...DEFAULT_SETTINGS.general, ...(src.general || {}) },
      security: { ...DEFAULT_SETTINGS.security, ...(src.security || {}) },
      email: { ...DEFAULT_SETTINGS.email, ...(src.email || {}) },
      updatedAt: src.updatedAt,
      updatedBy: src.updatedBy,
    };
  }

  const ClaimsService = {
    async getClaims(user, forceRefresh = false) {
      if (!user || !user.getIdTokenResult) return {};
      if (window.getAdminClaims) {
        return window.getAdminClaims(user, forceRefresh);
      }
      const res = await user.getIdTokenResult(!!forceRefresh);
      return res?.claims || {};
    },
    async isAdmin(user, allowlist = null) {
      if (!user) return false;
      if (allowlist) {
        const emails = (allowlist.emails || []).map(e => e.toLowerCase());
        const uids = allowlist.uids || [];
        if (user.email && emails.includes(user.email.toLowerCase())) return true;
        if (uids.includes(user.uid)) return true;
      }
      const claims = await this.getClaims(user, false);
      return !!claims?.admin || claims?.role === 'admin';
    },
  };

  const SettingsService = {
    settingsDocId: 'system-config',
    async getAllowlist(options = {}) {
      const settings = await this.getSettings({
        allowDefault: true,
        ...options,
      });
      const emails = (settings?.security?.adminAllowlistEmails || '')
        .split(',')
        .map(item => item.trim().toLowerCase())
        .filter(Boolean);
      const uids = (settings?.security?.adminAllowlistUids || '')
        .split(',')
        .map(item => item.trim())
        .filter(Boolean);
      return { emails, uids };
    },
    async getSettings(options = {}) {
      if (window.AdminSettingsCache) return window.AdminSettingsCache;
      const auth = window.auth || window.firebaseModular?.auth;
      if (!auth || !auth.currentUser) {
        return options.allowDefault ? normalizeSettings(DEFAULT_SETTINGS) : null;
      }

      // Prefer Functions if available
      if (window.firebaseModular?.httpsCallable) {
        try {
          const fn = window.firebaseModular.httpsCallable('getSystemSettings');
          const res = await fn({});
          const data = res?.data?.data || res?.data || null;
          if (data && Object.keys(data).length) {
            const normalized = normalizeSettings(data);
            window.AdminSettingsCache = normalized;
            return normalized;
          }
        } catch (_e) {
          // silent fallback to Firestore
        }
      }

      // Firestore fallback
      if (window.firebaseModular?.db && window.firebaseModular?.doc) {
        try {
          const ref = window.firebaseModular.doc(
            window.firebaseModular.db,
            'settings',
            this.settingsDocId
          );
          const snap = window.firebaseModular.getDocFromServer
            ? await window.firebaseModular.getDocFromServer(ref)
            : await window.firebaseModular.getDoc(ref);
          const exists =
            typeof snap.exists === 'function' ? snap.exists() : !!snap.exists;
          if (exists) {
            const normalized = normalizeSettings(snap.data());
            window.AdminSettingsCache = normalized;
            return normalized;
          }
        } catch (_e) {}
      } else if (window.firebase && window.firebase.firestore) {
        try {
          const doc = await window.firebase
            .firestore()
            .collection('settings')
            .doc(this.settingsDocId)
            .get();
          const exists =
            typeof doc.exists === 'function' ? doc.exists() : !!doc.exists;
          if (exists) {
            const normalized = normalizeSettings(doc.data());
            window.AdminSettingsCache = normalized;
            return normalized;
          }
        } catch (_e) {}
      }

      return options.allowDefault ? normalizeSettings(DEFAULT_SETTINGS) : null;
    },
    async saveSettings(payload) {
      const normalized = normalizeSettings(payload);
      // Prefer Functions
      if (window.firebaseModular?.httpsCallable) {
        try {
          const fn = window.firebaseModular.httpsCallable('setSystemSettings');
          await fn({ settings: normalized });
          window.AdminSettingsCache = normalized;
          return true;
        } catch (_e) {
          // fallback to Firestore
        }
      }
      if (window.firebaseModular?.db && window.firebaseModular?.setDoc) {
        const ref = window.firebaseModular.doc(
          window.firebaseModular.db,
          'settings',
          this.settingsDocId
        );
        await window.firebaseModular.setDoc(ref, normalized, { merge: true });
        window.AdminSettingsCache = normalized;
        return true;
      }
      return false;
    },
  };

  window.AdminClaimsService = ClaimsService;
  window.AdminSettingsService = SettingsService;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('admin:services-ready'));
  }
})();
