import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('admin.js regression', () => {
  beforeEach(() => {
    vi.resetModules();
    window.__ADMIN_UI_INITED__ = false;
    window.__adminSectionInterceptorActive = false;
  });

  it('activates requested section/tab and persists adminActiveSection', async () => {
    document.body.innerHTML = `
      <div id="adminView" class="active">
        <div id="dashboardSection" class="admin-section active"></div>
        <div id="usersSection" class="admin-section"></div>
      </div>
      <button class="admin-nav-tab active" data-params="dashboard" aria-selected="true"></button>
      <button class="admin-nav-tab" data-params="users" aria-selected="false"></button>
    `;

    const loadUsers = vi.fn();
    window.usersManager = { loadUsers, _isLoadingUsers: false };
    window.AdminLoader = { ensureBundle: vi.fn().mockResolvedValue(undefined) };
    window.EventDelegation = { registerHandler: vi.fn() };

    const mod = await import('../../src/js/admin.js');
    mod.initAdminUi();

    window.showAdminSection('users');

    expect(document.getElementById('usersSection').classList.contains('active')).toBe(true);
    expect(document.getElementById('dashboardSection').classList.contains('active')).toBe(false);
    expect(document.querySelector('.admin-nav-tab[data-params="users"]').classList.contains('active')).toBe(true);
    expect(localStorage.getItem('adminActiveSection')).toBe('users');

    await Promise.resolve();
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(loadUsers).toHaveBeenCalledTimes(1);
  });
});
