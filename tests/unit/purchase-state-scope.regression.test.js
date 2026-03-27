import { beforeEach, describe, expect, it, vi } from 'vitest';

const loadModule = async path => import(`${path}?t=${Date.now()}_${Math.random()}`);

describe('purchase state scope regression', () => {
  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
    document.body.innerHTML = '';
    delete window.UltimateDownloadManager;
    delete globalThis.UltimateDownloadManager;
    delete window.announcementSystem;
    delete window.AnnouncementSystem;
    window.__ULTIMATE_DOWNLOAD_MANAGER_INITED__ = false;
    window.__ULTIMATE_DOWNLOAD_MANAGER_NO_AUTO__ = true;
    window.__ANNOUNCEMENT_SYSTEM_INITED__ = false;
    window.__ANNOUNCEMENT_SYSTEM_NO_AUTO__ = true;
    window.Logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      trace: vi.fn(),
    };
    window.firebase = {
      auth: () => ({
        currentUser: {
          uid: 'user-a',
          email: 'user-a@example.com',
        },
        onAuthStateChanged: vi.fn(() => () => {}),
      }),
    };
  });

  it('UltimateDownloadManager scopes storage keys by uid', async () => {
    const mod = await loadModule('../../src/js/ultimate-download-manager.js');
    mod.initUltimateDownloadManager();

    const manager = window.UltimateDownloadManager;
    expect(manager.buildScopedStorageKey('wfx_download_', 'prod-1', 'user-a')).toBe(
      'wfx_download_user-a:prod-1'
    );

    localStorage.setItem('wfx_download_user-a:prod-1', '{"purchaseTimestamp":1}');
    localStorage.setItem('wfx_download_user-a:prod-2', '{"purchaseTimestamp":2}');
    localStorage.setItem('wfx_download_user-b:prod-9', '{"purchaseTimestamp":9}');

    expect(manager.listScopedStorageProductIds('wfx_download_', 'user-a')).toEqual([
      'prod-1',
      'prod-2',
    ]);
    expect(manager.listScopedStorageProductIds('wfx_download_', 'user-b')).toEqual(['prod-9']);
  });

  it('AnnouncementSystem resolves local purchase/download keys for the active uid only', async () => {
    const downloadManagerMod = await loadModule('../../src/js/ultimate-download-manager.js');
    downloadManagerMod.initUltimateDownloadManager();

    const announcementMod = await loadModule('../../src/js/announcement-system.js');
    announcementMod.initAnnouncementSystem();

    const system = new window.AnnouncementSystem();

    localStorage.setItem('wfx_download_user-a:prod-1', '{"purchaseTimestamp":1}');
    localStorage.setItem('wfx_download_user-b:prod-2', '{"purchaseTimestamp":2}');

    expect(system.getLocalPurchasesStorageKey('user-a')).toBe('wfx_local_purchases:user-a');
    expect(system.getDownloadStorageKeys('user-a')).toEqual(['prod-1']);
    expect(system.getDownloadStorageKeys('user-b')).toEqual(['prod-2']);
  });
});
