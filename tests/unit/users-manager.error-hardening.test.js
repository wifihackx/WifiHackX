import { beforeEach, describe, expect, it, vi } from 'vitest';

const loadModule = async path => import(`${path}?t=${Date.now()}_${Math.random()}`);

describe('users-manager error hardening', () => {
  beforeEach(() => {
    vi.resetModules();
    window.__USERS_MANAGER_INITED__ = false;
    window.__USERS_MANAGER_NO_AUTO__ = true;
    window.Logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), trace: vi.fn() };
    window.LOG_CATEGORIES = { USERS: 'USERS', INIT: 'INIT', ERR: 'ERR' };
    window.AppState = { getState: vi.fn(() => null), setState: vi.fn() };
    window.firebase = {
      apps: [{}],
      auth: vi.fn(() => ({ currentUser: null, onAuthStateChanged: vi.fn() })),
    };
    window.MutationObserver = class {
      observe() {}
      disconnect() {}
    };
    document.body.innerHTML = '<table><tbody id="usersTableBody"></tbody></table>';
  });

  it('renders error text without interpreting HTML', async () => {
    const mod = await loadModule('../../src/js/users-manager.js');
    mod.initUsersManager();

    window.usersManager.showError('<img src=x onerror=alert(1)>');

    const cell = document.querySelector('.users-table-error-cell');
    expect(cell?.querySelector('img')).toBeNull();
    expect(cell?.textContent).toBe('<img src=x onerror=alert(1)>');
  });
});
