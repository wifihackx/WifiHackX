import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('admin-loader template path hardening', () => {
  beforeEach(() => {
    vi.resetModules();
    window.__ADMIN_LOADER_INITED__ = false;
    window.__ADMIN_LOADER_NO_AUTO__ = true;
    window.__WIFIHACKX_DEBUG__ = false;
    window.NotificationSystem = undefined;
    window.AppState = undefined;
    window.AdminSettingsCache = { security: { adminAllowlistEmails: '', adminAllowlistUids: '' } };
    window.firebase = {
      auth: () => ({
        currentUser: { uid: 'admin-1', email: 'admin@example.com' },
        onAuthStateChanged: vi.fn(() => () => {}),
      }),
    };
    window.getAdminClaims = vi.fn(async () => ({ admin: true }));
    window.fetch = vi.fn(async () => ({
      ok: true,
      text: async () => '<div class="admin-container"></div><div id="banReasonModal"></div>',
    }));
    document.body.innerHTML = '<section id="adminView" data-template="https://evil.example/admin.html"></section>';
  });

  it('blocks cross-origin admin templates before fetch', async () => {
    const mod = await import('../../src/js/admin-loader.js');
    mod.initAdminLoader();

    await expect(window.AdminLoader.loadCore({ skipAuthCheck: true })).rejects.toThrow(
      'Blocked template path'
    );
    expect(window.fetch).not.toHaveBeenCalled();
  });
});
