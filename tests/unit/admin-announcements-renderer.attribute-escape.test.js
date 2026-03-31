import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('admin announcements renderer hardening', () => {
  beforeEach(() => {
    vi.resetModules();
    window.__ADMIN_ANNOUNCEMENTS_RENDERER_INITED__ = false;
    window.__ADMIN_ANNOUNCEMENTS_RENDERER_NO_AUTO__ = true;
    window.__WFX_TEST_HOSTNAME__ = 'localhost';
    window.XSSProtection = {
      escape: value =>
        String(value ?? '')
          .replaceAll('&', '&amp;')
          .replaceAll('<', '&lt;')
          .replaceAll('>', '&gt;')
          .replaceAll('"', '&quot;')
          .replaceAll("'", '&#39;'),
      sanitizeURL: value => String(value ?? ''),
      setInnerHTML: (node, html) => {
        node.innerHTML = html;
      },
    };
    window.firebase = { apps: [{}] };
    window.DOMUtils = { setDisplay: vi.fn() };
    window.NotificationSystem = { error: vi.fn(), success: vi.fn() };
    window.safeConfirm = (_title, _msg, onConfirm) => onConfirm();
    window.UltimateDownloadManager = { resetProductTimer: vi.fn(async () => {}) };
    window.MutationObserver = class {
      observe() {}
      disconnect() {}
    };
    document.body.innerHTML =
      '<div id="adminAnnouncementsGrid"></div><section id="announcementsSection"></section>';
  });

  it('escapes announcement ids in action buttons and still matches the exact reset button', async () => {
    const mod = await import('../../src/js/admin-announcements-renderer.js');
    mod.initAdminAnnouncementsRenderer();

    const renderer = window.adminAnnouncementsRenderer;
    const card = renderer.createCard({
      id: 'bad" autofocus onclick="alert(1)',
      title: 'Producto',
      imageUrl: '/safe.webp',
      price: 10,
      active: true,
    });

    document.getElementById('adminAnnouncementsGrid').appendChild(card);

    const resetBtn = card.querySelector('[data-action="adminResetTimer"]');
    expect(resetBtn?.dataset.id).toBe('bad" autofocus onclick="alert(1)');
    expect(resetBtn?.getAttribute('onclick')).toBeNull();
    expect(resetBtn?.hasAttribute('autofocus')).toBe(false);

    await renderer.resetProductTimer('bad" autofocus onclick="alert(1)');

    expect(window.UltimateDownloadManager.resetProductTimer).toHaveBeenCalledWith(
      'bad" autofocus onclick="alert(1)'
    );
  });
});
