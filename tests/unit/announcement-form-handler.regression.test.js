import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('announcement-form-handler regression', () => {
  beforeEach(() => {
    vi.resetModules();
    window.__ANNOUNCEMENT_FORM_HANDLER_INITED__ = false;
    window.__ANNOUNCEMENT_FORM_HANDLER_NO_AUTO__ = true;
    window.Logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      log: vi.fn(),
    };
  });

  it('binds form actions once even if initialize is called twice', async () => {
    document.body.innerHTML = `
      <form id="announcementForm">
        <button data-action="handleSaveAnnouncement" type="button">Guardar</button>
      </form>
    `;

    const mod = await import('../../src/js/announcement-form-handler.js');
    mod.initAnnouncementFormHandler();

    const handler = new window.AnnouncementFormHandler({});
    expect(handler.initialize('announcementForm')).toBe(true);
    expect(handler.initialize('announcementForm')).toBe(true);

    const saveSpy = vi.fn().mockResolvedValue(undefined);
    handler.saveForm = saveSpy;

    const btn = document.querySelector('[data-action="handleSaveAnnouncement"]');
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(saveSpy).toHaveBeenCalledTimes(1);
  });
});
