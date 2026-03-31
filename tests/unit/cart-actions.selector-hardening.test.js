import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('cart-actions selector hardening', () => {
  beforeEach(() => {
    vi.resetModules();
    window.__CART_ACTIONS_INITED__ = false;
    window.__CART_ACTIONS_NO_AUTO__ = true;
    window.NotificationSystem = { error: vi.fn() };
    window.CartManager = { addItem: vi.fn() };
    window.announcementManager = {
      currentAnnouncements: [
        {
          id: 'prod" ] bad',
          title: 'Producto',
          price: 12,
          imageUrl: '',
          image: '',
        },
      ],
    };
    document.body.innerHTML = `
      <div class="announcement-card" data-announcement-id='prod" ] bad'>
        <img class="announcement-card-image" src="/safe-card.webp">
      </div>
      <button data-action="addAnnouncementToCart" data-id='prod" ] bad'>Comprar</button>
    `;
  });

  it('finds the exact announcement card without building a CSS selector from the id', async () => {
    const mod = await import('../../src/js/cart-actions.js');
    mod.initCartActions();

    const trigger = document.querySelector('[data-action="addAnnouncementToCart"]');
    trigger.dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true })
    );

    expect(window.CartManager.addItem).toHaveBeenCalledTimes(1);
    expect(window.CartManager.addItem.mock.calls[0][0].imageUrl).toContain('/safe-card.webp');
  });
});
