import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('navigation-helper template path hardening', () => {
  beforeEach(() => {
    vi.resetModules();
    window.__NAVIGATION_HELPER_INITED__ = false;
    window.__NAVIGATION_HELPER_NO_AUTO__ = true;
    window.AppState = {
      state: {},
      getState: vi.fn(() => null),
      setState: vi.fn(),
      subscribe: vi.fn(),
    };
    window.DOMUtils = {
      setDisplay: vi.fn(),
    };
    window.Logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    };
    window.LOG_CATEGORIES = { NAV: 'NAV' };
    window.fetch = vi.fn(async () => ({
      ok: true,
      text: async () => '<div>ok</div>',
    }));
    document.body.innerHTML = '<section id="homeView" class="view" data-template=""></section>';
  });

  it('blocks cross-origin template paths', async () => {
    const mod = await import('../../src/js/navigation-helper.js');
    mod.initNavigationHelper();

    expect(() =>
      window.ViewTemplateLoader.resolveSafeTemplatePath('https://evil.example/partial.html')
    ).toThrow('Blocked template path');
  });

  it('allows same-origin template paths under partials', async () => {
    const mod = await import('../../src/js/navigation-helper.js');
    mod.initNavigationHelper();

    expect(window.ViewTemplateLoader.resolveSafeTemplatePath('/partials/home.html?x=1')).toBe(
      '/partials/home.html?x=1'
    );
  });
});
