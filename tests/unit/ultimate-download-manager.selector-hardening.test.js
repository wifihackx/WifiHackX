import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('ultimate-download-manager selector hardening', () => {
  beforeEach(() => {
    vi.resetModules();
    window.__ULTIMATE_DOWNLOAD_MANAGER_INITED__ = false;
    window.__ULTIMATE_DOWNLOAD_MANAGER_NO_AUTO__ = true;
    window.Logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), trace: vi.fn() };
    window.LOG_CATEGORIES = { DOWNLOAD: 'DOWNLOAD', INIT: 'INIT', ERR: 'ERR', SECURITY: 'SEC' };
    window.firebase = { auth: () => ({ currentUser: { uid: 'uid-1', email: 'a@b.c' }, onAuthStateChanged: vi.fn() }) };
    window.AppState = undefined;
    window.fetch = vi.fn(async () => ({ json: async () => ({ ip: '127.0.0.1' }) }));
    document.body.innerHTML = `
      <button data-action="secureDownload" data-product-id='prod" ] bad'></button>
    `;
    window.localStorage.clear();
  });

  it('finds secure download buttons by exact data attribute match', async () => {
    const mod = await import('../../src/js/ultimate-download-manager.js');
    mod.initUltimateDownloadManager();

    const manager = window.UltimateDownloadManager;
    const buttons = manager.getDownloadButtons('prod" ] bad');

    expect(buttons).toHaveLength(1);
    expect(buttons[0].dataset.productId).toBe('prod" ] bad');
  });

  it('finds timer and downloads displays safely and escapes toast messages', async () => {
    document.body.innerHTML = `
      <div data-timer-for='prod" ] bad'></div>
      <div data-downloads-for='prod" ] bad'></div>
    `;

    const mod = await import('../../src/js/ultimate-download-manager.js');
    mod.initUltimateDownloadManager();

    const manager = window.UltimateDownloadManager;
    const timerDisplays = manager.getTimerDisplays('prod" ] bad');
    const downloadsDisplays = manager.getDownloadsDisplays('prod" ] bad');

    expect(timerDisplays).toHaveLength(1);
    expect(downloadsDisplays).toHaveLength(1);

    manager.notify('<img src=x onerror=alert(1)>', 'error');

    const toast = document.querySelector('.toast-message');
    expect(toast?.querySelector('img')).toBeNull();
    expect(toast?.textContent).toBe('<img src=x onerror=alert(1)>');
  });
});
