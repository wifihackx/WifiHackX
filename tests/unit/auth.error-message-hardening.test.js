import { beforeEach, describe, expect, it, vi } from 'vitest';

const loadModule = async path => import(`${path}?t=${Date.now()}_${Math.random()}`);

describe('auth error message hardening', () => {
  beforeEach(() => {
    vi.resetModules();
    delete window.AuthSecurity;
    delete window.setupAuthListeners;
    delete window.handleGoogleAuth;
    window.__AUTH_JS_MODULE_INITED__ = false;
    globalThis.AppState = {
      getState: vi.fn(() => null),
      setState: vi.fn(),
      subscribe: vi.fn(),
    };
    window.AppState = globalThis.AppState;
    window.Logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    };
    window.DOMUtils = {
      setDisplay: vi.fn(),
      lockBodyScroll: vi.fn(),
    };
    window.NotificationSystem = {
      error: vi.fn(),
      warning: vi.fn(),
      info: vi.fn(),
      success: vi.fn(),
    };
    const authInstance = {
      currentUser: null,
      useDeviceLanguage: vi.fn(),
      onAuthStateChanged: vi.fn(() => () => {}),
      setPersistence: vi.fn(async () => undefined),
      getRedirectResult: vi.fn(async () => ({ user: null })),
    };
    window.firebase = {
      auth: () => authInstance,
    };
    window.firebase.auth.Auth = {
      Persistence: {
        LOCAL: 'local',
      },
    };
    document.body.innerHTML = `
      <form id="loginFormElement"></form>
      <button data-testid="login-submit" type="submit"></button>
    `;
  });

  it('returns generic text for unknown auth errors instead of propagating raw backend messages', async () => {
    await loadModule('../../src/js/auth.js');

    expect(
      window.AuthSecurity.getSafeAuthErrorMessage({
        code: 'auth/internal-error',
        message: '<img src=x onerror=alert(1)> backend leak',
      })
    ).toBe('Error de autenticación. Inténtalo de nuevo.');
  });

  it('keeps mapped messages for known auth codes', async () => {
    await loadModule('../../src/js/auth.js');

    expect(
      window.AuthSecurity.getSafeAuthErrorMessage({
        code: 'auth/invalid-email',
        message: 'ignored',
      })
    ).toBe('El formato del correo electrónico no es válido.');
  });
});
