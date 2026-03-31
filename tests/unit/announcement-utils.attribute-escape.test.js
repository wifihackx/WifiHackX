import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('announcement-utils buildSecureDownloadMarkup hardening', () => {
  beforeEach(async () => {
    vi.resetModules();
    document.body.innerHTML = '';
    await import('../../src/js/announcement-utils.js');
  });

  it('escapes ids, labels and titles in generated secure download markup', () => {
    const html = window.AnnouncementUtils.buildSecureDownloadMarkup({
      buttonId: 'btn" autofocus',
      announcementId: 'ann" onclick="alert(1)',
      productId: 'prod" onclick="alert(2)',
      label: '<img src=x onerror=alert(3)>',
      title: '"bad"',
      timerText: '<b>timer</b>',
      downloadsText: '<i>downloads</i>',
    });

    document.body.innerHTML = html;

    const button = document.querySelector('[data-action="secureDownload"]');
    const label = document.querySelector('.btn-text');
    const timer = document.querySelector('.countdown-timer');

    expect(button?.dataset.id).toBe('ann" onclick="alert(1)');
    expect(button?.dataset.productId).toBe('prod" onclick="alert(2)');
    expect(button?.getAttribute('onclick')).toBeNull();
    expect(button?.hasAttribute('autofocus')).toBe(false);
    expect(document.querySelector('.btn-text img')).toBeNull();
    expect(label?.textContent).toBe('<img src=x onerror=alert(3)>');
    expect(timer?.textContent).toBe('<b>timer</b>');
  });
});
