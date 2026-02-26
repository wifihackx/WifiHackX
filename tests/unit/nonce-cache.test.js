import { beforeEach, describe, expect, it, vi } from 'vitest';

const loadModule = async path => import(`${path}?t=${Date.now()}_${Math.random()}`);

describe('NonceCache', () => {
  beforeEach(() => {
    localStorage.clear();
    delete window.NonceCache;
    delete window.__WFX_DEBUG__;
    vi.restoreAllMocks();
  });

  it('inicializa singleton global', async () => {
    await loadModule('../../src/js/nonce-cache.js');
    expect(window.NonceCache).toBeTruthy();
    expect(typeof window.NonceCache.set).toBe('function');
  });

  it('set/get retorna nonce, ttl y nonceId', async () => {
    await loadModule('../../src/js/nonce-cache.js');

    const expiresAt = Date.now() + 60_000;
    window.NonceCache.set('nonce-123', expiresAt, 'id-123');

    expect(window.NonceCache.get()).toEqual({
      nonce: 'nonce-123',
      expiresAt,
      nonceId: 'id-123',
    });
  });

  it('get limpia cache expirado y retorna null', async () => {
    await loadModule('../../src/js/nonce-cache.js');

    window.NonceCache.set('nonce-expired', Date.now() - 1_000, 'id-old');
    expect(window.NonceCache.get()).toBeNull();
    expect(localStorage.getItem('wifihackx_nonce_cache')).toBeNull();
  });

  it('isValid y getTimeRemaining respetan umbral de 30 segundos', async () => {
    await loadModule('../../src/js/nonce-cache.js');

    window.NonceCache.set('nonce-ok', Date.now() + 45_000, 'id-ok');
    expect(window.NonceCache.isValid()).toBe(true);
    expect(window.NonceCache.getTimeRemaining()).toBeGreaterThanOrEqual(44);

    window.NonceCache.set('nonce-low', Date.now() + 10_000, 'id-low');
    expect(window.NonceCache.isValid()).toBe(false);
  });
});
