import { beforeEach, describe, expect, it, vi } from 'vitest';

const loadModule = async path => import(`${path}?t=${Date.now()}_${Math.random()}`);

describe('purchase-success-modal hardening', () => {
  beforeEach(() => {
    vi.resetModules();
    window.__PURCHASE_SUCCESS_MODAL_INITED__ = false;
    window.__PURCHASE_SUCCESS_MODAL_NO_AUTO__ = true;
    window.DOMUtils = {
      lockBodyScroll: vi.fn(),
    };
    window.confetti = {
      launch: vi.fn(),
      stop: vi.fn(),
      rain: vi.fn(),
      setHost: vi.fn(),
    };
    window.PurchaseSuccessAudio = undefined;
    window.i18n = { currentLanguage: 'es' };
    window.requestAnimationFrame = callback => {
      callback();
      return 1;
    };
    document.body.innerHTML = '';
  });

  it('escapes product name and preserves product id safely in the action button', async () => {
    const mod = await loadModule('../../src/js/purchase-success-modal.js');
    mod.initPurchaseSuccessModal();

    window.showPurchaseSuccessModal(
      'prod" autofocus onclick="alert(1)',
      '<img src=x onerror=alert(1)>'
    );

    const productNameEl = document.querySelector('.purchase-success-product-name');
    const button = document.querySelector('.purchase-success-btn-primary');

    expect(document.querySelector('.purchase-success-product-name img')).toBeNull();
    expect(productNameEl?.textContent).toBe('<img src=x onerror=alert(1)>');
    expect(button?.dataset.productId).toBe('prod" autofocus onclick="alert(1)');
    expect(button?.getAttribute('onclick')).toBeNull();
    expect(button?.hasAttribute('autofocus')).toBe(false);
  });
});
