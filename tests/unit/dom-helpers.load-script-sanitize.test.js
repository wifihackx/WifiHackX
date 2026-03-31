import { beforeEach, describe, expect, it, vi } from 'vitest';

const loadModule = async path => import(`${path}?t=${Date.now()}_${Math.random()}`);

describe('dom-helpers script loader hardening', () => {
  beforeEach(() => {
    vi.resetModules();
    document.head.innerHTML = '';
    document.body.innerHTML = '';
    delete window.DOMUtils;
  });

  it('blocks cross-origin script sources', async () => {
    await loadModule('../../src/js/dom-helpers.js');

    await expect(window.DOMUtils.loadScript('https://evil.example/payload.js')).rejects.toThrow(
      'Blocked script source'
    );
    expect(document.head.querySelector('script')).toBeNull();
  });

  it('allows same-origin script sources under js', async () => {
    await loadModule('../../src/js/dom-helpers.js');

    const promise = window.DOMUtils.loadScript('/js/app.js?v=1');
    const script = document.head.querySelector('script');

    expect(script?.getAttribute('src')).toContain('/js/app.js?v=1');
    script.onload();
    await expect(promise).resolves.toBeUndefined();
  });
});
