import { beforeEach, describe, expect, it, vi } from 'vitest';

const loadModule = async path => import(`${path}?t=${Date.now()}_${Math.random()}`);

describe('post-checkout-handler selector hardening', () => {
  beforeEach(() => {
    vi.resetModules();
    window.__POST_CHECKOUT_HANDLER_INITED__ = false;
    window.__POST_CHECKOUT_HANDLER_NO_AUTO__ = true;
    window.__PURCHASE_SUCCESS_MODAL_INITED__ = true;
    window.showPurchaseSuccessModal = vi.fn();
    window.NotificationSystem = {
      success: vi.fn(),
      info: vi.fn(),
      error: vi.fn(),
    };
    window.Analytics = { trackEvent: vi.fn() };
    window.dataLayer = [];
    window.enhancedAnalytics = { trackPurchaseCompleted: vi.fn() };
    window.UltimateDownloadManager = { registerPurchase: vi.fn() };
    window.CartManager = {
      items: [],
      removeItem: vi.fn(),
      clear: vi.fn(),
    };
    window.firebase = {
      auth: () => ({
        currentUser: { uid: 'uid-1', email: 'safe@example.com' },
        onAuthStateChanged: vi.fn(),
      }),
      firestore: () => ({
        collection: vi.fn(name => {
          if (name === 'announcements') {
            return {
              doc: vi.fn(() => ({
                get: vi.fn(async () => ({
                  exists: true,
                  data: () => ({
                    name: 'Producto seguro',
                    title: 'Producto seguro',
                    price: 9.99,
                  }),
                })),
              })),
            };
          }
          if (name === 'users') {
            return {
              doc: vi.fn(() => ({
                set: vi.fn(async () => {}),
                get: vi.fn(async () => ({ exists: true, data: () => ({ purchases: [] }) })),
                collection: vi.fn(() => ({
                  doc: vi.fn(() => ({
                    set: vi.fn(async () => {}),
                  })),
                })),
              })),
            };
          }
          throw new Error(`Unexpected collection ${name}`);
        }),
        FieldValue: {
          arrayUnion: vi.fn(value => value),
          serverTimestamp: vi.fn(() => new Date()),
        },
      }),
      functions: vi.fn(() => ({
        httpsCallable: vi.fn(() => async () => ({ data: { success: false } })),
      })),
    };
    window.announcementSystem = undefined;
    document.body.innerHTML = `
      <button data-product-id='prod" ] bad' data-action="buyNowAnnouncement">Comprar</button>
      <button data-product-id='prod" ] bad' data-action="addToCartAnnouncement">Carrito</button>
    `;
    window.history.replaceState(
      {},
      '',
      '/checkout?status=success&productId=prod%22%20%5D%20bad&source=checkout'
    );
  });

  it('updates the exact live buttons in the fallback handler path without building CSS selectors', async () => {
    const mod = await loadModule('../../src/js/post-checkout-handler.js');
    mod.initPostCheckoutHandler();
    await new Promise(resolve => setTimeout(resolve, 0));

    const buttons = document.querySelectorAll('[data-product-id][data-action]');
    expect(buttons).toHaveLength(2);
    buttons.forEach(button => {
      expect(button.classList.contains('download-ready')).toBe(true);
      expect(button.getAttribute('data-action')).toBe('secureDownload');
      expect(button.textContent).toBe('Descargar');
    });
  });
});
