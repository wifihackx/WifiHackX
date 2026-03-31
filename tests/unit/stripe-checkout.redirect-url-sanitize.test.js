import { beforeEach, describe, expect, it, vi } from 'vitest';

const loadModule = async path => import(`${path}?t=${Date.now()}_${Math.random()}`);

describe('stripe-checkout redirect url hardening', () => {
  beforeEach(() => {
    vi.resetModules();
    window.__STRIPE_CHECKOUT_INITED__ = false;
    window.__STRIPE_CHECKOUT_NO_AUTO__ = true;
    delete window.StripeCheckout;
    window.__WFX_DEBUG_LOG__ = undefined;
    window.Logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      startGroup: vi.fn(),
      endGroup: vi.fn(),
    };
    window.LOG_CATEGORIES = { PAYMENTS: 'PAY', INIT: 'INIT', ERR: 'ERR' };
    window.RuntimeConfigUtils = {
      getPaymentsKeys: vi.fn(() => ({ stripePublicKey: 'pk_test_123' })),
    };
    window.Stripe = vi.fn(() => ({}));
    window.loadStripeSdk = vi.fn(async () => undefined);
    window.NotificationSystem = undefined;
    window.markScriptLoaded = vi.fn();
    window.firebase = {
      auth: () => ({
        currentUser: {
          uid: 'u1',
          emailVerified: true,
        },
      }),
      functions: () => ({
        httpsCallable: vi.fn(name => {
          if (name === 'createCheckoutSession') {
            return async () => ({ data: { url: 'javascript:alert(1)' } });
          }
          if (name === 'updateUserLocation') {
            return async () => ({ data: { ok: true } });
          }
          return async () => ({ data: {} });
        }),
      }),
    };
    document.body.innerHTML = '<button id="checkoutBtn" type="button"></button>';
    globalThis.alert = vi.fn();
  });

  it('blocks non-http checkout redirect urls returned by the backend', async () => {
    const mod = await loadModule('../../src/js/stripe-checkout.js');
    mod.initStripeCheckout();

    const targetBtn = {
      getAttribute: vi.fn(name => {
        if (name === 'data-price-id') return 'price_123';
        if (name === 'data-product-id') return 'prod_1';
        if (name === 'data-product-name') return 'Producto';
        if (name === 'data-price') return '19.99';
        return null;
      }),
    };

    await window.iniciarCompra(targetBtn);

    expect(globalThis.alert).toHaveBeenCalled();
    expect(String(globalThis.alert.mock.calls[0][0] || '')).toContain('URL de checkout inválida');
  });

  it('accepts only http/https redirect urls', async () => {
    const mod = await loadModule('../../src/js/stripe-checkout.js');
    mod.initStripeCheckout();

    expect(window.StripeCheckout.resolveSafeRedirectUrl('javascript:alert(1)')).toBe('');
    expect(window.StripeCheckout.resolveSafeRedirectUrl('https://checkout.stripe.com/pay/test'))
      .toBe('https://checkout.stripe.com/pay/test');
  });
});
