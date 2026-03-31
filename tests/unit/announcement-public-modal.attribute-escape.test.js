import { beforeEach, describe, expect, it, vi } from 'vitest';

const loadModule = async path => import(`${path}?t=${Date.now()}_${Math.random()}`);

describe('announcement-public-modal attribute hardening', () => {
  beforeEach(() => {
    vi.resetModules();
    window.__ANNOUNCEMENT_PUBLIC_MODAL_INITED__ = false;
    window.__ANNOUNCEMENT_PUBLIC_MODAL_NO_AUTO__ = true;
    window.announcementSystem = {
      ownedProducts: new Set(),
      openPublicDetailModal: undefined,
    };
    window.DOMUtils = {
      setDisplay: vi.fn(),
      lockBodyScroll: vi.fn(),
    };
    window.ModalManager = undefined;
    window.lucide = {
      createIcons: vi.fn(),
    };
    document.body.innerHTML = '';
  });

  it('escapes announcement-controlled attributes before injecting the modal', async () => {
    const mod = await loadModule('../../src/js/announcement-public-modal.js');
    mod.initAnnouncementPublicModal();

    const maliciousId = 'bad" onclick="alert(1)';
    window.openPublicDetailModal({
      id: maliciousId,
      title: 'Titulo seguro',
      name: 'Titulo seguro',
      price: 10,
      videoUrl: 'javascript:alert(1).mp4',
      description: 'Descripcion',
    });

    const modal = document.getElementById('announcementDetailModal');
    expect(modal).not.toBeNull();

    const shareBtn = modal.querySelector('.announcement-share-btn');
    expect(shareBtn).not.toBeNull();
    expect(shareBtn.getAttribute('onclick')).toBeNull();
    expect(shareBtn.dataset.shareUrl).toContain('#ann-bad%22%20onclick%3D%22alert(1)');

    const buyBtn = modal.querySelector('.announcement-btn-buy');
    expect(buyBtn).not.toBeNull();
    expect(buyBtn.id).toBe('buyNowBtn-bad__onclick__alert_1_');
    expect(buyBtn.getAttribute('data-announcement-id')).toBe(maliciousId);
    expect(buyBtn.getAttribute('onclick')).toBeNull();

    const videoSource = modal.querySelector('video source');
    expect(videoSource).not.toBeNull();
    expect(videoSource.getAttribute('src')).toBe('');
  });

  it('falls back to the current location when share url is rewritten to javascript', async () => {
    const shareSpy = vi.fn(async () => undefined);
    Object.defineProperty(navigator, 'share', {
      value: shareSpy,
      configurable: true,
    });

    const mod = await loadModule('../../src/js/announcement-public-modal.js');
    mod.initAnnouncementPublicModal();

    window.openPublicDetailModal({
      id: 'prod-1',
      title: 'Titulo',
      name: 'Titulo',
      price: 10,
      description: 'Descripcion',
    });

    const shareBtn = document.querySelector('.announcement-share-btn');
    shareBtn.dataset.shareUrl = 'javascript:alert(1)';
    shareBtn.click();

    await Promise.resolve();

    expect(shareSpy).toHaveBeenCalledTimes(1);
    expect(shareSpy.mock.calls[0][0].url).toBe(window.location.href);
  });

  it('escapes quoted titles before injecting them into img alt attributes', async () => {
    const mod = await loadModule('../../src/js/announcement-public-modal.js');
    mod.initAnnouncementPublicModal();

    window.openPublicDetailModal({
      id: 'prod-img',
      title: 'Titulo " onclick="alert(1)',
      name: 'Titulo " onclick="alert(1)',
      imageUrl: '/Tecnologia.webp',
      price: 10,
      description: 'Descripcion',
    });

    const image = document.querySelector('.announcement-detail-image img');
    expect(image?.getAttribute('alt')).toBe('Titulo " onclick="alert(1)');
    expect(image?.getAttribute('onclick')).toBeNull();
  });
});
