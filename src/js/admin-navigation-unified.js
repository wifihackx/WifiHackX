/**
 * Admin Navigation Unified
 * Centralized logic for navigating between admin and public views
 */

export function initAdminNavigation() {
  'use strict';

  if (window.__ADMIN_NAV_INITED__) {
    return;
  }
  window.__ADMIN_NAV_INITED__ = true;

  console.log('🚀 [AdminNav] Unified Navigation System Initialized');

  function getCurrentUser() {
    if (window.auth?.currentUser) return window.auth.currentUser;
    if (window.firebase && firebase.auth) {
      try {
        return firebase.auth().currentUser;
      } catch (_e) {}
    }
    return window.firebaseModular?.auth?.currentUser || null;
  }

  function getAllowlistFromSettings() {
    const settings = window.AdminSettingsCache;
    const emails = (settings?.security?.adminAllowlistEmails || '')
      .split(',')
      .map(item => item.trim().toLowerCase())
      .filter(Boolean);
    const uids = (settings?.security?.adminAllowlistUids || '')
      .split(',')
      .map(item => item.trim())
      .filter(Boolean);
    return { emails, uids };
  }

  async function isAdminUser() {
    try {
      if (window.AppState?.state?.user?.isAdmin === true) return true;
      const user = getCurrentUser();
      if (!user) return false;

      await ensureAdminSettingsCache();
      const allowlist = getAllowlistFromSettings();
      if (window.AdminClaimsService?.isAdmin) {
        return await window.AdminClaimsService.isAdmin(user, allowlist);
      }
      if (allowlist.emails.length && user.email) {
        if (allowlist.emails.includes(user.email.toLowerCase())) return true;
      }
      if (allowlist.uids.length && allowlist.uids.includes(user.uid)) return true;
      const claims = window.getAdminClaims
        ? await window.getAdminClaims(user, false)
        : (await user.getIdTokenResult(true)).claims;
      return !!claims?.admin || claims?.role === 'admin';
    } catch (error) {
      console.warn('[AdminNav] Error verificando admin:', error);
      return false;
    }
  }

  function getAdminMfaTimestamp() {
    try {
      const value = sessionStorage.getItem('adminMfaVerifiedAt');
      return value ? Number(value) : 0;
    } catch (_e) {
      return 0;
    }
  }

  function setAdminMfaTimestamp() {
    try {
      sessionStorage.setItem('adminMfaVerifiedAt', String(Date.now()));
    } catch (_e) {}
  }

  function hasRecentAdminMfa() {
    const last = getAdminMfaTimestamp();
    if (!last) return false;
    const maxAgeMs = 5 * 60 * 1000;
    return Date.now() - last < maxAgeMs;
  }

  async function callFunction(name, data = {}) {
    if (window.firebaseModular?.httpsCallable) {
      const callable = window.firebaseModular.httpsCallable(name);
      const result = await callable(data);
      return result?.data || {};
    }
    if (window.firebase && firebase.functions) {
      const callable = firebase.functions().httpsCallable(name);
      const result = await callable(data);
      return result?.data || {};
    }
    throw new Error('Firebase Functions no está disponible');
  }

  async function ensureAdminSettingsCache() {
    if (window.AdminSettingsService?.getSettings) {
      const settings = await window.AdminSettingsService.getSettings({
        allowDefault: false,
      });
      if (settings) {
        window.AdminSettingsCache = settings;
        return settings;
      }
    }
    return window.AdminSettingsCache || null;
  }

  function getBackupWarningThreshold() {
    const threshold =
      window.AdminSettingsCache?.security?.backupCodesWarningThreshold;
    const parsed = parseInt(threshold, 10);
    return Number.isFinite(parsed) && parsed >= 1 ? parsed : 2;
  }

  async function updateAdminTwoFactorStatus() {
    const statusEl = document.getElementById('admin2faStatus');
    const noticeEl = document.getElementById('admin2faNoticeHeader');
    const noticeDashboardEl = document.getElementById('admin2faNoticeDashboard');
    const counterValueEl = document.getElementById('admin2faCounterValue');
    const counterThresholdEl = document.getElementById(
      'admin2faCounterThreshold'
    );
    const thresholdBadgeEl = document.getElementById('admin2faThresholdBadge');
    if (!statusEl) return;

    const valueEl = statusEl.querySelector('.admin-2fa-value');
    if (valueEl) valueEl.textContent = 'Verificando...';
    statusEl.classList.remove('is-warning', 'is-ok');
    if (noticeEl) noticeEl.classList.add('hidden');
    if (noticeDashboardEl) noticeDashboardEl.classList.add('hidden');

    try {
      await ensureAdminSettingsCache();
      const status = await callFunction('getTotpStatus');
      if (!status.enabled) {
        if (valueEl) valueEl.textContent = 'Desactivado';
        if (counterValueEl) {
          counterValueEl.textContent = '—';
          counterValueEl.classList.remove('is-warning', 'is-ok');
        }
        if (counterThresholdEl) {
          counterThresholdEl.textContent = `Umbral: ${getBackupWarningThreshold()}`;
        }
        if (thresholdBadgeEl) {
          thresholdBadgeEl.textContent = `Umbral: ${getBackupWarningThreshold()}`;
        }
        statusEl.classList.remove('is-warning', 'is-ok');
        if (noticeEl) noticeEl.classList.remove('shake');
        if (noticeDashboardEl) noticeDashboardEl.classList.remove('shake');
        return;
      }

      const remaining = status.remainingBackupCodes;
      if (typeof remaining === 'number') {
        if (valueEl) valueEl.textContent = `${remaining} códigos`;
        if (counterValueEl) {
          counterValueEl.textContent = String(remaining);
          const threshold = getBackupWarningThreshold();
          counterValueEl.classList.toggle('is-warning', remaining <= threshold);
          counterValueEl.classList.toggle('is-ok', remaining > threshold);
        }
        if (counterThresholdEl) {
          counterThresholdEl.textContent = `Umbral: ${getBackupWarningThreshold()}`;
        }
        if (thresholdBadgeEl) {
          thresholdBadgeEl.textContent = `Umbral: ${getBackupWarningThreshold()}`;
        }
        const threshold = getBackupWarningThreshold();
        if (remaining <= threshold) {
          statusEl.classList.add('is-warning');
          statusEl.classList.remove('is-ok');
          if (noticeEl) noticeEl.classList.remove('hidden');
          if (noticeDashboardEl) noticeDashboardEl.classList.remove('hidden');
          const previous = Number(
            sessionStorage.getItem('admin2faPrevRemaining') || '99'
          );
            if (previous > threshold) {
              if (noticeEl) {
                noticeEl.classList.remove('shake');
                requestAnimationFrame(() => noticeEl.classList.add('shake'));
              }
              if (noticeDashboardEl) {
                noticeDashboardEl.classList.remove('shake');
                requestAnimationFrame(() =>
                  noticeDashboardEl.classList.add('shake')
                );
              }
            }
        } else {
          statusEl.classList.add('is-ok');
          statusEl.classList.remove('is-warning');
          if (noticeEl) noticeEl.classList.remove('shake');
          if (noticeDashboardEl) noticeDashboardEl.classList.remove('shake');
        }
        sessionStorage.setItem('admin2faPrevRemaining', String(remaining));
      } else {
        if (valueEl) valueEl.textContent = 'Activo';
        statusEl.classList.add('is-ok');
        statusEl.classList.remove('is-warning');
        if (counterValueEl) {
          counterValueEl.textContent = '—';
          counterValueEl.classList.remove('is-warning', 'is-ok');
        }
        if (counterThresholdEl) {
          counterThresholdEl.textContent = `Umbral: ${getBackupWarningThreshold()}`;
        }
        if (thresholdBadgeEl) {
          thresholdBadgeEl.textContent = `Umbral: ${getBackupWarningThreshold()}`;
        }
        if (noticeEl) noticeEl.classList.remove('shake');
        if (noticeDashboardEl) noticeDashboardEl.classList.remove('shake');
      }
    } catch (error) {
      console.warn('[AdminNav] Error actualizando 2FA status:', error);
      if (valueEl) valueEl.textContent = 'No disponible';
      if (counterValueEl) {
        counterValueEl.textContent = '—';
        counterValueEl.classList.remove('is-warning', 'is-ok');
      }
      if (counterThresholdEl) {
        counterThresholdEl.textContent = 'Umbral: —';
      }
      if (thresholdBadgeEl) {
        thresholdBadgeEl.textContent = 'Umbral: —';
      }
      statusEl.classList.remove('is-warning', 'is-ok');
      if (noticeEl) noticeEl.classList.remove('shake');
      if (noticeDashboardEl) noticeDashboardEl.classList.remove('shake');
    }
  }

  function ensureAdminMfaModal() {
    let modal = document.getElementById('adminMfaModal');
    if (modal) return modal;

    modal = document.createElement('div');
    modal.id = 'adminMfaModal';
    modal.className = 'mfa-login-modal-overlay';
    modal.setAttribute('aria-hidden', 'true');
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'adminMfaTitle');

    modal.innerHTML = `
      <div class="mfa-login-modal" role="document">
        <div class="mfa-login-modal__header">
          <h2 id="adminMfaTitle" class="mfa-login-modal__title">Verificación adicional</h2>
          <button type="button" class="mfa-login-modal__close modal-close" aria-label="Cerrar">×</button>
        </div>
        <div class="mfa-login-modal__body">
          <p class="mfa-login-modal__message">
            Ingresa el código de tu app autenticadora o un código de respaldo.
          </p>
          <div class="mfa-login-modal__group">
            <label for="adminMfaCode">Código</label>
            <input id="adminMfaCode" class="mfa-login-modal__input" inputmode="numeric" maxlength="12" placeholder="123456 o XXXX-XXXX"/>
          </div>
          <div id="adminMfaStatus" class="mfa-login-modal__status" role="status"></div>
        </div>
        <div class="mfa-login-modal__actions">
          <button type="button" class="modal-btn secondary" data-action="adminMfaBackup">Usar respaldo</button>
          <button type="button" class="modal-btn primary" data-action="adminMfaVerify">Verificar</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    return modal;
  }

  function setAdminMfaStatus(modal, message, isError = false) {
    const status = modal.querySelector('#adminMfaStatus');
    if (!status) return;
    status.textContent = message;
    status.classList.toggle('is-error', Boolean(isError));
  }

  function openAdminMfaModal() {
    const modal = ensureAdminMfaModal();
    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');
    setAdminMfaStatus(modal, '');
    return modal;
  }

  function closeAdminMfaModal() {
    const modal = document.getElementById('adminMfaModal');
    if (!modal) return;
    modal.classList.remove('active');
    modal.setAttribute('aria-hidden', 'true');
    setAdminMfaStatus(modal, '');
  }

  async function requireAdminMfa() {
    if (hasRecentAdminMfa()) return true;

    try {
      const status = await callFunction('getTotpStatus');
      if (!status.enabled) return true;
    } catch (error) {
      console.warn('[AdminNav] No se pudo verificar TOTP:', error);
      return true;
    }

    return new Promise(resolve => {
      const modal = openAdminMfaModal();
      const input = modal.querySelector('#adminMfaCode');
      const verifyBtn = modal.querySelector('[data-action="adminMfaVerify"]');
      const backupBtn = modal.querySelector('[data-action="adminMfaBackup"]');
      const closeBtn = modal.querySelector('.mfa-login-modal__close');

      const cleanup = () => {
        if (verifyBtn) verifyBtn.onclick = null;
        if (backupBtn) backupBtn.onclick = null;
        if (closeBtn) closeBtn.onclick = null;
      };

      const verify = async (mode = 'totp') => {
        const code = input ? input.value.trim() : '';
        if (!code) {
          setAdminMfaStatus(modal, 'Ingresa un código válido.', true);
          return;
        }
        try {
          setAdminMfaStatus(modal, 'Verificando...');
          if (mode === 'backup') {
            await callFunction('verifyBackupCode', { code });
          } else {
            await callFunction('verifyTotpForAdmin', { code });
          }
          setAdminMfaTimestamp();
          updateAdminTwoFactorStatus();
          closeAdminMfaModal();
          cleanup();
          resolve(true);
        } catch (error) {
          setAdminMfaStatus(modal, error.message, true);
        }
      };

      if (verifyBtn) {
        verifyBtn.onclick = () => verify('totp');
      }

      if (backupBtn) {
        backupBtn.onclick = () => verify('backup');
      }

      if (closeBtn) {
        closeBtn.onclick = () => {
          closeAdminMfaModal();
          cleanup();
          resolve(false);
        };
      }
    });
  }

  /**
   * Shows the Admin Panel and hides public content
   */
  async function showAdminViewImpl() {
    console.log('🔐 [AdminNav] Switching to Admin View...');

    const allowed = await isAdminUser();
    if (!allowed) {
      console.warn('⛔ [AdminNav] Acceso denegado a Admin View');
      try {
        localStorage.removeItem('adminViewActive');
      } catch (_e) {}
      // Forzar retorno a vista pública si adminView estaba visible
      try {
        goToMainImpl();
      } catch (_e) {}
      if (window.NotificationSystem) {
        window.NotificationSystem.error(
          'No tienes permisos para acceder al panel de administración.'
        );
      } else {
        alert('No tienes permisos para acceder al panel de administración.');
      }
      return;
    }

    await ensureAdminSettingsCache();
    const mfaAllowed = await requireAdminMfa();
    if (!mfaAllowed) {
      console.warn('⛔ [AdminNav] MFA requerida para Admin View');
      return;
    }

    const adminView = document.getElementById('adminView');
    if (!adminView) {
      console.error('❌ [AdminNav] adminView element not found!');
      return;
    }

    // Asegurar que no quede oculto por clases de init/login
    adminView.classList.remove('hidden');
    adminView.setAttribute('aria-hidden', 'false');

    window.DOMUtils.setDisplay(adminView, 'block');
    window.DOMUtils.setVisibility(adminView, true);
    window.DOMUtils.setOpacityClass(adminView, '1');
    adminView.classList.add('active');

    // Hide public content
    const publicElements = [
      document.getElementById('homeView'),
      document.querySelector('.hero-section'),
      document.querySelector('#catalogSection'),
      document.querySelector('.warning-container'),
      document.getElementById('mainFooter') || document.querySelector('footer'),
    ];

    publicElements.forEach(el => {
      if (el) {
        window.DOMUtils.setDisplay(el, 'none');
        el.classList.remove('active');
      }
    });

    document.body.classList.add('admin-mode', 'admin-active');
    document.body.setAttribute('data-current-view', 'adminView');

    // Guardar estado de admin view activo
    try {
      localStorage.setItem('adminViewActive', 'true');
      console.log('💾 [AdminNav] Admin view state saved');
    } catch (error) {
      console.warn('⚠️ [AdminNav] Could not save admin view state:', error);
    }

    // Restaurar sección guardada si existe
    try {
      const savedSection = localStorage.getItem('adminActiveSection');
      if (savedSection && window.showAdminSection) {
        console.log(`🔄 [AdminNav] Restaurando sección: ${savedSection}`);
        setTimeout(() => {
          window.showAdminSection(savedSection);
        }, 100);
      }
    } catch (error) {
      console.warn('⚠️ [AdminNav] No se pudo restaurar sección:', error);
    }

    console.log('✅ [AdminNav] Admin View Active');
    updateAdminTwoFactorStatus();
  }

  /**
   * Returns to the public page and hides Admin Panel
   */
  function goToMainImpl() {
    console.log('🔙 [AdminNav] Returning to Main Content...');

    // Limpiar estado de admin view
    try {
      localStorage.removeItem('adminViewActive');
      console.log('🗑️ [AdminNav] Admin view state cleared');
    } catch (error) {
      console.warn('⚠️ [AdminNav] Could not clear admin view state:', error);
    }

    // Hide Admin
    const adminView = document.getElementById('adminView');
    if (adminView) {
      window.DOMUtils.setDisplay(adminView, 'none');
      window.DOMUtils.setVisibility(adminView, false);
      window.DOMUtils.setOpacityClass(adminView, '0');
      adminView.classList.remove('active');
    }

    // Show Public Content
    const publicElements = [
      {
        query: 'main',
        style: 'block',
      },
      {
        id: 'homeView',
        style: 'block',
      },
      {
        query: '.hero-section',
        style: 'block',
      },
      {
        query: '#catalogSection',
        style: 'block',
      },
      {
        query: '.warning-container',
        style: 'block',
      },
      {
        id: 'mainFooter',
        query: 'footer',
        style: 'block',
      },
    ];

    publicElements.forEach(item => {
      const el = item.id
        ? document.getElementById(item.id)
        : document.querySelector(item.query);
      if (el) {
        window.DOMUtils.setDisplay(el, item.style);
        window.DOMUtils.setVisibility(el, true);
        window.DOMUtils.setOpacityClass(el, '1');
        if (item.id === 'homeView' || item.query === 'main') {
          el.classList.add('active');
        }
      }
    });

    // Sync with app's internal state if possible
    if (typeof window.showView === 'function') {
      console.log('🔄 [AdminNav] Syncing app state to homeView...');
      window.showView('homeView');
    }

    document.body.classList.remove('admin-mode', 'admin-active');
    document.body.classList.remove('admin-body-bg');

    console.log('✅ [AdminNav] Public View Restored');
  }

  // Exponer funciones globalmente de forma segura (no sobrescribir si ya existen)
  if (!window.showAdminView) {
    window.showAdminView = showAdminViewImpl;
  } else {
    console.log('[AdminNav] showAdminView already exists, wrapping it...');
    const originalShowAdminView = window.showAdminView;
    window.showAdminView = function () {
      console.log('🔄 [AdminNav] Calling wrapped showAdminView...');
      try {
        if (typeof originalShowAdminView === 'function') {
          originalShowAdminView();
        }
      } catch (e) {
        console.error('❌ [AdminNav] Error in original showAdminView:', e);
      }
      showAdminViewImpl();
    };
  }

  window.goToMain = goToMainImpl;
  window.backToMainContent = goToMainImpl; // Alias for compatibility
  window.updateAdminTwoFactorStatus = updateAdminTwoFactorStatus;

  function handleTwoFactorNoticeAction() {
    if (typeof window.showAdminSection === 'function') {
      window.showAdminSection('settings');
    }
    setTimeout(() => {
      if (
        window.SettingsCardsGenerator &&
        typeof window.SettingsCardsGenerator.openTwoFactorModal === 'function'
      ) {
        window.SettingsCardsGenerator.openTwoFactorModal();
      }
    }, 300);
  }

  document.addEventListener('click', e => {
    const btn = e.target.closest(
      '#admin2faActionBtnHeader, #admin2faActionBtnDashboard'
    );
    if (!btn) return;
    e.preventDefault();
    handleTwoFactorNoticeAction();
  });

  // Intercept "Volver" buttons automatically
  document.addEventListener(
    'click',
    function (e) {
      const btn = e.target.closest('button');
      if (!btn) return;

      const text = btn.textContent.trim().toLowerCase();
      if (text.includes('volver') && btn.closest('#adminView')) {
        console.log('🖱️ [AdminNav] "Volver" button detected');
        e.preventDefault();
        e.stopPropagation();
        window.goToMain();
      }
    },
    true
  );

  console.log('✅ [AdminNav] Navigation functions registered:', {
    showAdminView: typeof window.showAdminView,
    goToMain: typeof window.goToMain,
    backToMainContent: typeof window.backToMainContent,
  });
}
