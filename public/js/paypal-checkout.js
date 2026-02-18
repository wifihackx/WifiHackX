'use strict';

function setupPayPalCheckout() {
function debugLog(...args) {
  if (window.__WIFIHACKX_DEBUG__ === true) {
    console.info(...args);
  }
}
/**
 * Lógica de Checkout con PayPal
 */
function trackGtmEvent(eventName, params) {
  if (window.Analytics && typeof window.Analytics.trackEvent === 'function') {
    window.Analytics.trackEvent(
      eventName,
      params?.eventCategory || 'Ecommerce',
      params?.eventLabel || '',
      params?.eventValue
    );
  }
  if (window.dataLayer) {
    window.dataLayer.push({
      event: eventName,
      ...params,
    });
  }
}

globalThis.renderPayPalButton = function (
  containerId,
  totalAmount,
  productId = null
) {
  // Limpiamos el contenedor por si ya había un botón antes
  const container = document.getElementById(containerId);
  if (!container) {
    console.error('[PayPal] Contenedor no encontrado:', containerId);
    return;
  }

  // Evitar condiciones de carrera "Detected container element removed"
  // Si ya estamos renderizando, esperar o cancelar.
  if (container.dataset.rendering === 'true') {
    debugLog('[PayPal] Render ya en progreso, cancelando...');
    return;
  }

  container.dataset.rendering = 'true';
  container.innerHTML = '';

  if (typeof paypal === 'undefined') {
    console.warn('[PayPal] SDK no cargado, esperando...');
    if (globalThis.waitForPayPal) {
      globalThis.waitForPayPal()
        .then(() => {
          delete container.dataset.rendering;
          globalThis.renderPayPalButton(containerId, totalAmount, productId);
        })
        .catch(() => {
          container.innerHTML =
            '<div style="color: #ff4444; padding: 10px;">Error: PayPal SDK no disponible</div>';
          delete container.dataset.rendering;
        });
      return;
    }
    container.innerHTML =
      '<div style="color: #ff4444; padding: 10px;">Error: PayPal SDK no disponible</div>';
    delete container.dataset.rendering;
    return;
  }

  debugLog('[PayPal] Renderizando botón - Total:', totalAmount);

  paypal
    .Buttons({
      style: {
        layout: 'vertical',
        color: 'gold',
        shape: 'rect',
        label: 'paypal',
        height: 45,
      },

      // Mostrar solo el botón de PayPal (cuenta), ocultar botón de tarjeta
      // REVERTIDO: Se vuelve a ocultar para cumplir preferencia del usuario
      fundingSource: paypal.FUNDING.PAYPAL,

      // 1. Configurar la transacción
      createOrder: function (data, actions) {
        debugLog('[PayPal] createOrder llamado');

        // Mostrar mensaje de pasarela segura
        if (globalThis.showPaymentMessage) {
          globalThis.showPaymentMessage();
        }

        // Verificar autenticación
        const user =
          globalThis.firebase &&
          firebase.apps &&
          firebase.apps.length > 0 &&
          firebase.auth
            ? firebase.auth().currentUser
            : null;
        if (!user) {
          console.error('[PayPal] Usuario no autenticado');
          if (globalThis.NotificationSystem) {
            globalThis.NotificationSystem.warning(
              'Debes iniciar sesión para pagar con PayPal'
            );
          }
          if (globalThis.showLoginView) {
            setTimeout(() => globalThis.showLoginView(), 500);
          }
          return Promise.reject(new Error('Usuario no autenticado'));
        }

        trackGtmEvent('checkout_started', {
          eventCategory: 'Ecommerce',
          eventLabel: 'PayPal',
          eventValue: totalAmount,
          value: totalAmount,
          currency: 'EUR',
          payment_method: 'paypal',
          items: [
            {
              item_id: productId || 'cart',
              item_name: 'Compra WifiHackX',
              price: totalAmount,
              quantity: 1,
            },
          ],
        });

        debugLog('[PayPal] Usuario autenticado:', user.uid);

        // CONFIGURACIÓN MINIMALISTA
        // Eliminamos application_context y parámetros extra para evitar conflictos
        return actions.order
          .create({
            purchase_units: [
              {
                description: 'Compra en WifiHackX',
                amount: {
                  value: totalAmount.toFixed(2),
                },
              },
            ],
          })
          .then(orderId => {
            debugLog('[PayPal] Orden creada:', orderId);
            return orderId;
          })
          .catch(err => {
            console.error('[PayPal] Error creando orden:', err);
            throw err;
          });
      },

      // 2. Si el pago es EXITOSO
      onApprove: function (data, actions) {
        debugLog('[PayPal] onApprove llamado - OrderID:', data.orderID);

        return actions.order
          .capture()
          .then(async function (details) {
            debugLog('[PayPal] Pago capturado exitosamente');
            debugLog('[PayPal] Detalles:', details);

            trackGtmEvent('purchase_completed', {
              eventCategory: 'Ecommerce',
              eventLabel: 'PayPal',
              eventValue: totalAmount,
              transaction_id: data.orderID || `paypal-${Date.now()}`,
              value: totalAmount,
              currency: 'EUR',
              payment_method: 'paypal',
              items: [
                {
                  item_id: productId || 'cart',
                  item_name: 'Compra WifiHackX',
                  price: totalAmount,
                  quantity: 1,
                },
              ],
            });

            // A) Limpiar el carrito
            if (globalThis.CartManager) {
              globalThis.CartManager.clear();
              debugLog('[PayPal] Carrito limpiado');
            }

            // B) Guardar en Firebase
            const user =
              globalThis.firebase &&
              firebase.apps &&
              firebase.apps.length > 0 &&
              firebase.auth
                ? firebase.auth().currentUser
                : null;
            if (user) {
              try {
                await firebase
                  .firestore()
                  .collection('users')
                  .doc(user.uid)
                  .collection('payments')
                  .add({
                    method: 'paypal',
                    amount: totalAmount,
                    paypalOrderId: data.orderID,
                    date: new Date(),
                    status: 'completed',
                  payerName: details.payer.name.given_name,
                  });
                debugLog('[PayPal] Pago guardado en Firebase');
              } catch (e) {
                console.error('[PayPal] Error guardando pago en Firebase:', e);
              }
            }

            // C) Redirigir a página de éxito
            debugLog('[PayPal] Redirigiendo a página de éxito...');
            globalThis.location.href =
              '/?status=success&source=paypal' +
              (productId ? '&productId=' + productId : '');
          })
          .catch(err => {
            console.error('[PayPal] Error capturando pago:', err);
            if (globalThis.NotificationSystem) {
              globalThis.NotificationSystem.error(
                'Error procesando el pago. Intenta de nuevo.'
              );
            }
          });
      },

      // 3. Si el usuario cancela
      onCancel: function (_data) {
        debugLog('[PayPal] Pago cancelado por el usuario');
        trackGtmEvent('checkout_cancelled', {
          eventCategory: 'Ecommerce',
          eventLabel: 'PayPal',
          eventValue: totalAmount,
          payment_method: 'paypal',
          value: totalAmount,
          currency: 'EUR',
        });
        if (globalThis.NotificationSystem) {
          globalThis.NotificationSystem.info('Pago cancelado');
        }
      },

      // 4. Si hay ERROR
      onError: function (err) {
        console.error('[PayPal] Error:', err);

        trackGtmEvent('checkout_error', {
          eventCategory: 'Ecommerce',
          eventLabel: 'PayPal',
          eventValue: totalAmount,
          payment_method: 'paypal',
          error_message: err && err.message ? err.message : 'unknown',
        });

        let errorMessage = 'Hubo un error con el pago de PayPal.';

        if (err && err.message) {
          if (err.message.includes('not authenticated')) {
            errorMessage = 'Debes iniciar sesión para pagar con PayPal';
          } else {
            errorMessage += ' ' + err.message;
          }
        }

        if (globalThis.NotificationSystem) {
          globalThis.NotificationSystem.error(errorMessage);
        } else {
          alert(errorMessage);
        }
      },
    })
    .render('#' + containerId)
    .then(() => {
      debugLog('[PayPal] Botón renderizado exitosamente');
      delete container.dataset.rendering;
    })
    .catch(err => {
      console.error('[PayPal] Error renderizando botón:', err);
      delete container.dataset.rendering;
      container.innerHTML =
        '<div style="color: #ff4444; padding: 10px;">Error cargando PayPal. Intenta recargar la página.</div>';
    });
};

debugLog('[PayPal] Script cargado correctamente');

}

function initPayPalCheckout() {
  if (window.__PAYPAL_CHECKOUT_INITED__) {
    return;
  }

  window.__PAYPAL_CHECKOUT_INITED__ = true;
  setupPayPalCheckout();
}

if (typeof window !== 'undefined' && !window.__PAYPAL_CHECKOUT_NO_AUTO__) {
  initPayPalCheckout();
}


