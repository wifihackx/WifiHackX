import { describe, it, expect, vi, beforeEach } from 'vitest';

function createDomUtilsStub() {
  return {
    setDisplay: (el, value) => {
      if (el) el.style.display = value;
    },
    setVisibility: (el, visible) => {
      if (el) el.style.visibility = visible ? 'visible' : 'hidden';
    },
    setOpacityClass: (el, value) => {
      if (!el) return;
      el.style.opacity = String(value);
    },
  };
}

describe('admin-navigation-unified MFA cache regression', () => {
  beforeEach(() => {
    vi.resetModules();
    window.__ADMIN_NAV_INITED__ = false;
    window.AppState = { state: { user: { isAdmin: true } } };
    window.DOMUtils = createDomUtilsStub();
    window.AdminClaimsService = undefined;
    window.AdminSettingsService = undefined;
    window.NotificationSystem = undefined;
    window.firebaseModular = {
      httpsCallable: name =>
        vi.fn(async () => {
          if (name === 'getTotpStatus' || name === 'getTotpStatusV2') {
            return { data: { enabled: true, remainingBackupCodes: 5 } };
          }
          return { data: {} };
        }),
    };

    document.body.innerHTML = `
      <div id="adminView"></div>
      <main id="homeView" class="active"></main>
      <div id="catalogSection"></div>
      <div class="hero-section"></div>
      <div class="warning-container"></div>
      <footer id="mainFooter"></footer>
    `;
  });

  it('does not require MFA modal when verification is still recent', async () => {
    sessionStorage.setItem('adminMfaVerifiedAt', String(Date.now() - 60 * 1000));

    await import('../../src/js/admin-navigation-unified.js');
    await window.showAdminView();

    const modal = document.getElementById('adminMfaModal');
    expect(modal).toBeNull();
    expect(document.getElementById('adminView').classList.contains('active')).toBe(true);
  });

  it('requires MFA modal after cache expiration', async () => {
    sessionStorage.setItem(
      'adminMfaVerifiedAt',
      String(Date.now() - 6 * 60 * 1000)
    );

    await import('../../src/js/admin-navigation-unified.js');
    const navPromise = window.showAdminView();
    await Promise.resolve();
    await new Promise(resolve => setTimeout(resolve, 0));

    const modal = document.getElementById('adminMfaModal');
    expect(modal).not.toBeNull();
    expect(modal.classList.contains('active')).toBe(true);
    expect(modal.getAttribute('aria-hidden')).toBe('false');

    modal.querySelector('.mfa-login-modal__close').click();
    const allowed = await navPromise;

    expect(allowed).toBeUndefined();
    expect(document.getElementById('adminView').classList.contains('active')).toBe(false);
  });
});
