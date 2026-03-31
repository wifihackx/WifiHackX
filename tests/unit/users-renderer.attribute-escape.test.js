import { beforeEach, describe, expect, it, vi } from 'vitest';

const loadModule = async path => import(`${path}?t=${Date.now()}_${Math.random()}`);

describe('users-renderer attribute hardening', () => {
  beforeEach(() => {
    vi.resetModules();
    window.__USERS_RENDERER_INITED__ = false;
    window.__USERS_RENDERER_NO_AUTO__ = true;
    window.firebase = {
      auth: () => ({
        currentUser: { uid: 'other-user' },
      }),
    };
    document.body.innerHTML = '<table><tbody id="usersTableBody"></tbody></table>';
  });

  it('escapes user id and email before injecting action attributes', async () => {
    const mod = await loadModule('../../src/js/users-renderer.js');
    mod.initUsersRenderer();

    const manager = {
      users: [],
      filteredUsers: [
        {
          id: 'bad" autofocus onclick="alert(1)',
          email: 'evil@example.com" data-x="1',
          name: 'Nombre',
          joinDate: '2026-03-31',
          banned: false,
          role: 'user',
        },
      ],
      currentFilter: 'all',
      searchQuery: '',
      CAT: { USERS: 'USERS', INIT: 'INIT' },
      log: {
        trace: vi.fn(),
        debug: vi.fn(),
        error: vi.fn(),
      },
      escapeHtml: value =>
        String(value)
          .replaceAll('&', '&amp;')
          .replaceAll('<', '&lt;')
          .replaceAll('>', '&gt;')
          .replaceAll('"', '&quot;')
          .replaceAll("'", '&#39;'),
    };

    const renderer = new window.UsersRenderer(manager);
    renderer.renderUsers();

    const editButton = document.querySelector('[data-action="edit-user"]');
    const banButton = document.querySelector('[data-action="ban-user"]');
    expect(editButton?.dataset.userId).toBe('bad" autofocus onclick="alert(1)');
    expect(editButton?.getAttribute('onclick')).toBeNull();
    expect(editButton?.getAttribute('autofocus')).toBeNull();
    expect(banButton?.dataset.userEmail).toBe('evil@example.com" data-x="1');
    expect(banButton?.getAttribute('data-x')).toBeNull();
  });
});
