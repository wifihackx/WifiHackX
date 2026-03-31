import { beforeEach, describe, expect, it, vi } from 'vitest';

const loadModule = async path => import(`${path}?t=${Date.now()}_${Math.random()}`);

describe('cart-manager render hardening', () => {
  beforeEach(() => {
    vi.resetModules();
    window.__CART_MANAGER_INITED__ = false;
    window.__CART_MANAGER_NO_AUTO__ = true;
    window.Logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), trace: vi.fn() };
    window.LOG_CATEGORIES = { CART: 'CART', INIT: 'INIT', ERR: 'ERR' };
    window.NotificationSystem = undefined;
    window.DOMUtils = {
      setDisplay: vi.fn(),
    };
    window.lucide = { createIcons: vi.fn() };
    window.firebase = {
      auth: () => ({
        currentUser: null,
        onAuthStateChanged: vi.fn(),
      }),
    };
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: vi.fn(() => null),
        setItem: vi.fn(),
        removeItem: vi.fn(),
      },
      configurable: true,
    });
    document.body.innerHTML = `
      <div id="cartItems"></div>
      <div id="cartTotalValue"></div>
      <button id="checkoutBtn" type="button"></button>
      <div id="paypal-button-container"></div>
      <span id="cartCount"></span>
    `;
  });

  it('escapes product title/id and rejects javascript image URLs', async () => {
    const mod = await loadModule('../../src/js/cart-manager.js');
    mod.initCartManager();

    window.CartManager.items = [
      {
        id: 'bad" onclick="alert(1)',
        title: '<img src=x onerror=alert(1)>',
        imageUrl: 'javascript:alert(1)',
        price: 19.99,
      },
    ];

    window.CartManager.renderCartModal();

    const cartHtml = document.getElementById('cartItems').innerHTML;
    const titleEl = document.querySelector('.cart-item-title');
    const imgEl = document.querySelector('.cart-item-image img');
    const removeBtn = document.querySelector('.remove-item-btn');

    expect(document.querySelector('.cart-item-title img')).toBeNull();
    expect(removeBtn?.getAttribute('onclick')).toBeNull();
    expect(titleEl?.textContent).toBe('<img src=x onerror=alert(1)>');
    expect(imgEl?.getAttribute('src')).toBe('/Tecnologia.webp');
    expect(removeBtn?.dataset.id).toBe('bad" onclick="alert(1)');
  });
});
