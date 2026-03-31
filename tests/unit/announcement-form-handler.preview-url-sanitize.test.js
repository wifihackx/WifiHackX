import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('announcement-form-handler preview hardening', () => {
  beforeEach(() => {
    vi.resetModules();
    window.__ANNOUNCEMENT_FORM_HANDLER_INITED__ = false;
    window.__ANNOUNCEMENT_FORM_HANDLER_NO_AUTO__ = true;
    window.Logger = { info: vi.fn(), error: vi.fn(), warn: vi.fn() };
    document.body.innerHTML = `
      <form id="announcementForm">
        <input id="announcementName" name="announcementName" value="Producto">
        <input id="announcementPrice" name="announcementPrice" value="12">
        <textarea id="announcementDescription" name="announcementDescription">Desc</textarea>
        <input id="announcementCategory" name="announcementCategory" value="Categoria">
        <input id="announcementImageUrl" name="announcementImageUrl" value="javascript:alert(1)">
        <input id="announcementYoutubeUrl" name="announcementYoutubeUrl" value="javascript:alert(2)">
        <input id="announcementActive" name="announcementActive" type="checkbox" checked>
        <input id="announcementFeatured" name="announcementFeatured" type="checkbox">
        <button data-action="handleSaveAnnouncement" type="button"><span>Guardar Anuncio</span></button>
      </form>
    `;
  });

  it('blocks unsafe preview image and video URLs without relying on XSSProtection', async () => {
    const mod = await import('../../src/js/announcement-form-handler.js');
    mod.initAnnouncementFormHandler();

    const handler = new window.AnnouncementFormHandler(null);
    handler.initialize('announcementForm');
    handler.previewAnnouncement();

    const previewImage = document.querySelector('.preview-image');
    const previewLink = document.querySelector('.announcement-preview a');

    expect(previewImage).toBeNull();
    expect(previewLink).toBeNull();
  });
});
