import { beforeEach, describe, expect, it, vi } from 'vitest';

const loadModule = async path => import(`${path}?t=${Date.now()}_${Math.random()}`);

describe('purchases-list-modal attribute hardening', () => {
  beforeEach(() => {
    vi.resetModules();
    document.body.innerHTML = '';
    window.__PURCHASES_LIST_MODAL_INITED__ = false;
    window.__PURCHASES_LIST_MODAL_NO_AUTO__ = true;
    window.Logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      trace: vi.fn(),
    };
    window.lucide = { createIcons: vi.fn() };
    window.DOMUtils = {
      setDisplay: vi.fn(),
      lockBodyScroll: vi.fn(),
    };
    window.ModalManager = null;
    window.AdminClaimsService = {
      requireAdminCurrentUser: vi.fn(async () => ({
        uid: 'admin-1',
        email: 'admin@example.com',
      })),
    };
    window.__WFX_TEST_HOSTNAME__ = 'localhost';
    window.firebase = {
      functions: () => ({
        httpsCallable: vi.fn(() => async () => ({
          data: {
            success: true,
            purchases: [
              {
                id: 'bad" autofocus onclick="alert(1)',
                userEmail: 'user@example.com',
                userId: 'u-1',
                productTitle: 'Producto',
                productId: 'prod-1',
                price: 12.5,
                paymentMethod: 'stripe',
                status: 'completed',
                mode: 'live',
                createdAtMs: Date.now(),
                sourceType: 'orders',
              },
            ],
          },
        })),
      }),
      firestore: vi.fn(() => ({
        collection: vi.fn(),
        collectionGroup: vi.fn(),
      })),
    };
  });

  it('escapes purchase ids before injecting them into data attributes', async () => {
    const mod = await loadModule('../../src/js/purchases-list-modal.js');
    mod.initPurchasesListModal();

    await window.PurchasesListModal.open();

    const card = document.querySelector('.purchase-card');
    const deleteBtn = document.querySelector('.purchase-delete-btn');

    expect(card?.dataset.purchaseId).toBe('bad" autofocus onclick="alert(1)');
    expect(deleteBtn?.dataset.purchaseId).toBe('bad" autofocus onclick="alert(1)');
    expect(deleteBtn?.getAttribute('onclick')).toBeNull();
    expect(deleteBtn?.hasAttribute('autofocus')).toBe(false);
  });
});
