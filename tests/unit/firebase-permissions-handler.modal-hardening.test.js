import { beforeEach, describe, expect, it, vi } from 'vitest';

const loadModule = async path => import(`${path}?t=${Date.now()}_${Math.random()}`);

describe('firebase permissions handler hardening', () => {
  beforeEach(() => {
    vi.resetModules();
    window.__FIREBASE_PERMISSIONS_HANDLER_INITED__ = false;
    window.__FIREBASE_PERMISSIONS_HANDLER_NO_AUTO__ = true;
    window.DOMUtils = { setDisplay: vi.fn() };
    document.body.innerHTML = '';
  });

  it('renders permission details as text without interpreting HTML from error info', async () => {
    const mod = await loadModule('../../src/js/firebase-permissions-handler.js');
    mod.initFirebasePermissionsHandler();

    window.permissionsHandler.showPermissionModal({
      userFriendlyMessage: '<img src=x onerror=alert(1)>',
      instructions: ['<svg onload=alert(1)>', 'Paso 2'],
      reason: 'bad" onclick="alert(1)',
      message: '<script>alert(1)</script>',
    });

    const modal = document.getElementById('permissionErrorModal');
    const message = modal?.querySelector('.permission-error-modal__message');
    const instructions = modal?.querySelectorAll('.permission-error-modal__instructions-list li');
    const details = modal?.querySelector('.permission-error-modal__details');

    expect(modal?.querySelector('img')).toBeNull();
    expect(modal?.querySelector('svg')).toBeNull();
    expect(modal?.querySelector('script')).toBeNull();
    expect(message?.textContent).toBe('<img src=x onerror=alert(1)>');
    expect(instructions?.[0]?.textContent).toBe('<svg onload=alert(1)>');
    expect(details?.textContent).toContain('bad" onclick="alert(1)');
    expect(details?.textContent).toContain('<script>alert(1)</script>');
  });
});
