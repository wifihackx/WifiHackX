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

  it('escapes user id and email before injecting action attributes and visible fields', async () => {
    const mod = await loadModule('../../src/js/users-renderer.js');
    mod.initUsersRenderer();

    const manager = {
      users: [],
      filteredUsers: [
        {
          id: 'bad" autofocus onclick="alert(1)',
          email: 'evil@example.com" data-x="1',
          name: 'Nombre',
          joinDate: '<img src=x onerror=alert(1)>',
          banned: false,
          role: 'user" onclick="alert(1)',
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
    const row = document.querySelector('.user-row');
    const cells = row?.querySelectorAll('td') || [];
    const roleBadge = document.querySelector('.role-badge');
    expect(editButton?.dataset.userId).toBe('bad" autofocus onclick="alert(1)');
    expect(editButton?.getAttribute('onclick')).toBeNull();
    expect(editButton?.getAttribute('autofocus')).toBeNull();
    expect(banButton?.dataset.userEmail).toBe('evil@example.com" data-x="1');
    expect(banButton?.getAttribute('data-x')).toBeNull();
    expect(cells[2]?.querySelector('img')).toBeNull();
    expect(cells[2]?.textContent).toBe('<img src=x onerror=alert(1)>');
    expect(roleBadge?.textContent).toBe('USER" ONCLICK="ALERT(1)');
    expect(roleBadge?.className).toContain('role-useronclickalert1');
    expect(roleBadge?.getAttribute('onclick')).toBeNull();
  });
});
