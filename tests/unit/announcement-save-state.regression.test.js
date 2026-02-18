import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('announcement save button state regression', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    window.__ANNOUNCEMENT_FORM_HANDLER_INITED__ = false;
    window.__ANNOUNCEMENT_FORM_HANDLER_NO_AUTO__ = true;
    window.Logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      log: vi.fn(),
    };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('transitions Guardando -> Guardado -> Guardar Anuncio and re-enables button', async () => {
    document.body.innerHTML = `
      <form id="announcementForm">
        <input id="announcementName" name="announcementName" required value="Producto X" />
        <button type="button" data-action="handleSaveAnnouncement">
          <span>Guardar Anuncio</span>
        </button>
      </form>
    `;

    let resolveCreate;
    const dataManager = {
      createAnnouncement: vi.fn(
        () =>
          new Promise(resolve => {
            resolveCreate = resolve;
          })
      ),
    };

    const mod = await import('../../src/js/announcement-form-handler.js');
    mod.initAnnouncementFormHandler();

    const handler = new window.AnnouncementFormHandler(dataManager);
    expect(handler.initialize('announcementForm')).toBe(true);

    const button = document.querySelector('[data-action="handleSaveAnnouncement"]');
    const label = button.querySelector('span');

    const savePromise = handler.saveForm();
    await Promise.resolve();

    expect(label.textContent).toBe('Guardando...');
    expect(button.disabled).toBe(true);

    resolveCreate({ success: true, id: 'ann-1' });
    await savePromise;

    expect(label.textContent).toBe('Guardado');
    expect(button.disabled).toBe(false);

    vi.advanceTimersByTime(1200);
    expect(label.textContent).toBe('Guardar Anuncio');
    expect(button.disabled).toBe(false);
  });
});
