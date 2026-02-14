import { initStripeLoader } from '../../stripe-loader.js';
import { initStripeCheckout } from '../../stripe-checkout.js';
import { initPayPalLoader } from '../../paypal-loader.js';
import { initPayPalCheckout } from '../../paypal-checkout.js';
import { initCheckoutInterceptor } from '../../checkout-interceptor.js';
import { initPurchaseSuccessModal } from '../../purchase-success-modal.js';
import { initPostCheckoutHandler } from '../../post-checkout-handler.js';
import { initConfettiAnimation } from '../../confetti-animation.js';
import { initSuccessSound } from '../../success-sound.js';

export function initPayments() {
  initStripeLoader();
  initStripeCheckout();
  initPayPalLoader();
  initPayPalCheckout();
  initCheckoutInterceptor();
  initPurchaseSuccessModal();
  initPostCheckoutHandler();
  initConfettiAnimation();
  initSuccessSound();
}
