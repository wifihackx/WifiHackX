import { beforeEach, describe, expect, it, vi } from 'vitest';

const loadModule = async path => import(`${path}?t=${Date.now()}_${Math.random()}`);

describe('admin-support-requests evidence URL hardening', () => {
  beforeEach(() => {
    vi.resetModules();
    document.body.innerHTML = `
      <select id="supportStatusFilter"><option value="all">all</option></select>
      <button id="refreshSupportRequestsBtn" type="button"></button>
      <div id="supportRequestsGrid"></div>
    `;
    window.AppState = {
      state: {
        user: {
          isAdmin: true,
        },
      },
    };
    window.NotificationSystem = undefined;
    window.firebaseModular = {
      db: {},
      collection: vi.fn(),
      query: vi.fn(),
      orderBy: vi.fn(),
      limit: vi.fn(),
      getDocs: vi.fn(async () => ({
        docs: [
          {
            id: 'r1',
            data: () => ({
              subject: 'Issue',
              name: 'Alice',
              email: 'alice@example.com',
              status: 'new',
              message: 'Help',
              evidenceUrl: 'javascript:alert(1)',
            }),
          },
        ],
      })),
    };
  });

  it('does not render dangerous evidence links', async () => {
    await loadModule('../../src/js/admin-support-requests.js');
    await window.adminSupportRequestsManager.loadRequests();

    const link = document.querySelector('.support-admin-evidence a');
    expect(link).toBeNull();
    expect(document.getElementById('supportRequestsGrid').textContent).toContain('Help');
  });

  it('escapes request ids before injecting them into data attributes', async () => {
    window.firebaseModular.getDocs = vi.fn(async () => ({
      docs: [
        {
          id: 'bad" onclick="alert(1)',
          data: () => ({
            subject: 'Issue',
            name: 'Alice',
            email: 'alice@example.com',
            status: 'new',
            message: 'Help',
            evidenceUrl: 'https://example.com/file.png',
          }),
        },
      ],
    }));

    await loadModule('../../src/js/admin-support-requests.js');
    await window.adminSupportRequestsManager.loadRequests();

    const card = document.querySelector('.support-admin-card');
    expect(card?.dataset.requestId).toBe('bad" onclick="alert(1)');
    expect(card?.getAttribute('onclick')).toBeNull();
  });
});
