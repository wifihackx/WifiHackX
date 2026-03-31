import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('lazy-loading URL hardening', () => {
  beforeEach(() => {
    vi.resetModules();
    window.__LAZY_LOADING_INITED__ = false;
    window.__LAZY_LOADING_NO_AUTO__ = true;
    window.IntersectionObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
    document.body.innerHTML = '';

    global.Image = class {
      set onload(fn) {
        this._onload = fn;
      }

      get onload() {
        return this._onload;
      }

      set onerror(fn) {
        this._onerror = fn;
      }

      get onerror() {
        return this._onerror;
      }

      set src(value) {
        this._src = value;
        if (this._onload) this._onload();
      }

      set srcset(value) {
        this._srcset = value;
      }
    };
  });

  it('rejects javascript image URLs and keeps only safe srcset candidates', async () => {
    const mod = await import('../../src/js/lazy-loading.js');
    mod.initLazyLoading();

    const img = document.createElement('img');
    img.dataset.src = 'javascript:alert(1)';
    img.dataset.srcset = 'javascript:alert(1) 1x, /safe.webp 2x';

    window.LazyLoadManager.load(img);

    expect(img.getAttribute('src')).toBeNull();
    expect(img.srcset).toBe(`${new URL('/safe.webp', window.location.origin).href} 2x`);
    expect(img.classList.contains('lazy-loaded')).toBe(true);
    expect(img.dataset.src).toBeUndefined();
    expect(img.dataset.srcset).toBeUndefined();
  });
});
