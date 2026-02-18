import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('common-handlers passthrough regression', () => {
  beforeEach(() => {
    vi.resetModules();
    window.__COMMON_HANDLERS_INITED__ = false;
    window.__COMMON_HANDLERS_NO_AUTO__ = true;
  });

  it('registers announcement passthrough handlers that call global functions', async () => {
    const handlers = new Map();
    window.EventDelegation = {
      registerHandler: vi.fn((name, fn) => handlers.set(name, fn)),
    };
    window.DOMUtils = { setDisplay: vi.fn() };

    const onSave = vi.fn();
    const onReset = vi.fn();
    const onPreview = vi.fn();
    const onTest = vi.fn();
    window.handleSaveAnnouncement = onSave;
    window.resetAnnouncementForm = onReset;
    window.previewAnnouncement = onPreview;
    window.testAnnouncementHTML = onTest;

    const mod = await import('../../src/js/common-handlers.js');
    mod.initCommonHandlers();

    const event = { preventDefault: vi.fn() };
    handlers.get('handleSaveAnnouncement')(null, event);
    handlers.get('resetAnnouncementForm')(null, event);
    handlers.get('previewAnnouncement')(null, event);
    handlers.get('testAnnouncementHTML')(null, event);

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onReset).toHaveBeenCalledTimes(1);
    expect(onPreview).toHaveBeenCalledTimes(1);
    expect(onTest).toHaveBeenCalledTimes(1);
  });
});
