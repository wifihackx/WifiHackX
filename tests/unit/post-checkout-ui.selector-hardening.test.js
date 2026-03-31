import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPostCheckoutUi } from '../../src/js/post-checkout-ui.js';

describe('post-checkout-ui selector hardening', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <button data-product-id='prod" ] bad' data-action="buyNowAnnouncement"></button>
      <button data-product-id='prod" ] bad' data-action="addToCartAnnouncement"></button>
    `;
    window.localStorage.clear();
  });

  it('disables the exact purchase buttons without building selectors from productId', () => {
    const api = createPostCheckoutUi({
      getCurrentAuthUid: () => 'uid-1',
      clearPendingCheckoutContext: vi.fn(),
      clearPostCheckoutResumeState: vi.fn(),
      persistPostCheckoutCleanupState: vi.fn(),
    });

    api.applyConfirmedPurchaseUiState({
      productId: 'prod" ] bad',
      productName: 'Producto',
      productPrice: 10,
      checkoutSource: 'stripe',
      sessionId: 's1',
    });

    const buttons = document.querySelectorAll('[data-product-id][data-action]');
    expect(buttons).toHaveLength(2);
    buttons.forEach(button => {
      expect(button.classList.contains('is-disabled')).toBe(true);
      expect(button.getAttribute('aria-disabled')).toBe('true');
    });
  });
});
