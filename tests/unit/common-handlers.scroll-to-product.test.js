import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('common-handlers scroll-to-product hardening', () => {
  beforeEach(() => {
    vi.resetModules();
    window.__COMMON_HANDLERS_INITED__ = false;
    window.__COMMON_HANDLERS_NO_AUTO__ = true;
  });

  it('finds the exact announcement by data attribute without building unsafe selectors', async () => {
    const handlers = new Map();
    window.EventDelegation = {
      registerHandler: vi.fn((name, fn) => handlers.set(name, fn)),
    };
    window.DOMUtils = { setDisplay: vi.fn() };
    window.showAnnouncementDetails = vi.fn();

    document.body.innerHTML = `
      <div data-announcement-id='prod" ] bad'>
        <button id="target-btn" type="button"></button>
      </div>
    `;

    const target = document.querySelector('[data-announcement-id]');
    target.scrollIntoView = vi.fn();

    const mod = await import('../../src/js/common-handlers.js');
    mod.initCommonHandlers();

    const handler = handlers.get('scroll-to-product');
    handler(
      {
        dataset: {
          productId: 'prod" ] bad',
        },
      },
      { preventDefault: vi.fn() }
    );

    expect(target.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
    expect(window.showAnnouncementDetails).toHaveBeenCalledWith('prod" ] bad');
  });
});
