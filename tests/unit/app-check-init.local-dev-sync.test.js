import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('app-check-init localhost private config sync', () => {
  beforeEach(() => {
    vi.resetModules();
    window.__APP_CHECK_NO_AUTO__ = true;
    window.__APP_CHECK_INITED__ = false;
    window.__WFX_LOCAL_DEV__ = undefined;
    window.RUNTIME_CONFIG = { appCheck: { siteKey: '' } };
    localStorage.clear();
    try {
      delete window.FIREBASE_APPCHECK_DEBUG_TOKEN;
    } catch (_e) {
      window.FIREBASE_APPCHECK_DEBUG_TOKEN = undefined;
    }
  });

  it('auto-seeds enabled and overwrites stale debug token from local private config', async () => {
    window.__WFX_LOCAL_DEV__ = {
      appCheck: {
        autoEnableLocal: true,
        localDebugToken: 'NEW_TOKEN_123',
      },
    };
    localStorage.setItem('wifihackx:appcheck:enabled', '1');
    localStorage.setItem('wifihackx:appcheck:debug_token', 'OLD_TOKEN_123');

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const mod = await import('../../src/js/app-check-init.js');
    mod.initAppCheck();

    expect(localStorage.getItem('wifihackx:appcheck:enabled')).toBe('1');
    expect(localStorage.getItem('wifihackx:appcheck:debug_token')).toBe('NEW_TOKEN_123');
    expect(window.FIREBASE_APPCHECK_DEBUG_TOKEN).toBe('NEW_TOKEN_123');
    warnSpy.mockRestore();
  });

  it('does not auto-enable when local private config is absent', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const mod = await import('../../src/js/app-check-init.js');
    mod.initAppCheck();

    expect(localStorage.getItem('wifihackx:appcheck:enabled')).toBe(null);
    expect(localStorage.getItem('wifihackx:appcheck:debug_token')).toBe(null);
    expect(window.FIREBASE_APPCHECK_DEBUG_TOKEN).toBe(undefined);
    warnSpy.mockRestore();
  });
});
