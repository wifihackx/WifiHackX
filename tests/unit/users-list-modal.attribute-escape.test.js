import { beforeEach, describe, expect, it, vi } from 'vitest';

const loadModule = async path => import(`${path}?t=${Date.now()}_${Math.random()}`);

describe('users list modal hardening', () => {
  beforeEach(() => {
    vi.resetModules();
    window.__USERS_LIST_MODAL_INITED__ = false;
    window.__USERS_LIST_MODAL_NO_AUTO__ = true;
    window.AdminSettingsCache = { security: { adminAllowlistEmails: '', adminAllowlistUids: '' } };
    window.firebase = {
      auth: () => ({ currentUser: { uid: 'admin-1', email: 'admin@example.com' } }),
    };
    window.Logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
    window.LOG_CATEGORIES = { UI: 'UI', DATA: 'DATA', ERR: 'ERR', SECURITY: 'SECURITY' };
    window.DOMUtils = { setDisplay: vi.fn(), lockBodyScroll: vi.fn() };
    document.body.innerHTML = '';
  });

  it('escapes user email and id before injecting delete button attributes', async () => {
    const mod = await loadModule('../../src/js/users-list-modal.js');
    mod.initUsersListModal();

    const userCardHtml = window.UsersListModal.__test.generateUserCard({
      uid: 'bad" autofocus onclick="alert(1)',
      email: 'evil@example.com" data-x="1',
      displayName: 'Nombre',
      country: 'ES',
      lastIP: '127.0.0.1',
      purchaseCount: 0,
      totalRevenue: 0,
      loginCount: 0,
      createdAt: new Date(),
      lastLogin: new Date(),
      isAdmin: false,
      role: 'user',
    });

    const wrapper = document.createElement('div');
    wrapper.innerHTML = userCardHtml;
    const deleteBtn = wrapper.querySelector('.user-delete-btn-compact');
    const card = wrapper.querySelector('.user-card');

    expect(deleteBtn?.dataset.userId).toBe('bad" autofocus onclick="alert(1)');
    expect(deleteBtn?.dataset.userEmail).toBe('evil@example.com" data-x="1');
    expect(deleteBtn?.getAttribute('onclick')).toBeNull();
    expect(deleteBtn?.getAttribute('data-x')).toBeNull();
    expect(deleteBtn?.hasAttribute('autofocus')).toBe(false);
    expect(card?.dataset.userId).toBe('bad" autofocus onclick="alert(1)');
  });
});
