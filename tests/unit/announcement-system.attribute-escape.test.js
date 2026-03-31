import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('announcement-system attribute hardening', () => {
  beforeEach(() => {
    vi.resetModules();
    window.__ANNOUNCEMENT_SYSTEM_INITED__ = false;
    window.__ANNOUNCEMENT_SYSTEM_NO_AUTO__ = true;
    window.Logger = { info: vi.fn(), debug: vi.fn(), error: vi.fn() };
    window.DOMPurify = {
      sanitize: value => value,
    };
    document.body.innerHTML =
      '<div id="publicAnnouncementsContainer"></div><div id="skeletonAnnouncements"></div>';
  });

  it('escapes ids and names in public cards and rejects javascript image URLs', async () => {
    const mod = await import('../../src/js/announcement-system.js');
    const system = new window.AnnouncementSystem();

    const html = system.createAnnouncementCard({
      id: 'bad" autofocus onclick="alert(1)',
      name: '<img src=x onerror=alert(1)>',
      price: 10,
      imageUrl: 'javascript:alert(1)',
    });

    document.getElementById('publicAnnouncementsContainer').innerHTML = html;

    const card = document.querySelector('.announcement-card');
    const buyBtn = document.querySelector('[data-action="buyNowAnnouncement"]');
    const img = document.querySelector('.announcement-card-image');
    const title = document.querySelector('.announcement-card-name');
    const shareBtn = document.querySelector('.announcement-share-btn');

    expect(card?.dataset.announcementId).toBe('bad" autofocus onclick="alert(1)');
    expect(buyBtn?.dataset.id).toBe('bad" autofocus onclick="alert(1)');
    expect(buyBtn?.getAttribute('onclick')).toBeNull();
    expect(buyBtn?.hasAttribute('autofocus')).toBe(false);
    expect(document.querySelector('.announcement-card-name img')).toBeNull();
    expect(title?.textContent).toBe('<img src=x onerror=alert(1)>');
    expect(img?.getAttribute('src')).toBe(`${window.location.origin}/Tecnologia.webp`);
    expect(shareBtn?.dataset.shareUrl).toContain('#ann-bad%22%20autofocus%20onclick%3D%22alert(1)');
  });
});
