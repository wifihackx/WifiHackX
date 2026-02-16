/**
 * cart-actions.js
 * Maneja eventos del carrito específicamente para interceptarlos antes que el bundle.
 * Usa fase de captura para prevenir errores "Unknown action" del bundle-app.
 * @version 2.1.0 - Syntax Compatibility Refactor
 */

'use strict';

function setupCartActions() {

  /**
   * Obtiene un anuncio por su ID desde el announcementManager
   * @param {string} id - ID del anuncio
   * @returns {Object|null} Anuncio encontrado o null
   */
  function getAnnouncement(id) {
    const am = globalThis.announcementManager;
    if (am && am.currentAnnouncements) {
      return am.currentAnnouncements.find(a => String(a.id) === String(id));
    }
    return null;
  }

  /**
   * Resuelve la URL de la imagen del anuncio con múltiples fallbacks.
   * Busca en los datos del anuncio, en el modal activo o en la tarjeta.
   * @param {Object} announcement - Datos del anuncio
   * @param {string} id - ID del anuncio
   * @returns {string} URL de la imagen resultante
   */
  function resolveImageUrl(announcement, id) {
    let imageUrl = '';

    if (announcement) {
      imageUrl =
        announcement.imageUrl ||
        (announcement.mainImage &&
          (announcement.mainImage.url || announcement.mainImage)) ||
        announcement.image ||
        '';
    }

    // Limpiar URLs sospechosas o demasiado cortas
    if (imageUrl.length < 10) imageUrl = '';

    // Fallback 1: Buscar en el modal activo
    if (!imageUrl) {
      const modal = document.querySelector('.announcement-modal.active');
      if (modal) {
        const modalImage = modal.querySelector(
          '.announcement-modal-image, .announcement-detail-image img'
        );
        if (modalImage && modalImage.src) {
          imageUrl = modalImage.src;
          console.log(
            '✅ [Cart-Actions] Imagen encontrada en modal:',
            imageUrl
          );
        }
      }
    }

    // Fallback 2: Buscar en la tarjeta del anuncio
    if (!imageUrl) {
      const card = document.querySelector(
        `[data-announcement-id="${id}"], [data-id="${id}"].announcement-card`
      );
      if (card) {
        const cardImage = card.querySelector('.announcement-card-image, img');
        if (cardImage && cardImage.src) {
          imageUrl = cardImage.src;
          console.log(
            '✅ [Cart-Actions] Imagen encontrada en tarjeta:',
            imageUrl
          );
        }
      }
    }

    // Fallback Final: Placeholder
    if (!imageUrl || imageUrl.length < 10) {
      imageUrl = '/Tecnologia-600.webp';
      console.log(
        '⚠️ [Cart-Actions] No se encontró imagen, usando placeholder'
      );
    }

    return imageUrl;
  }

  /**
   * Intenta añadir el producto al carrito usando diferentes métodos disponibles.
   * @param {Object} data - Datos completos del producto
   * @returns {boolean} True si se pudo añadir por algún método
   */
  function tryAddToCart(data) {
    const cm = globalThis.CartManager;
    if (!cm) return false;

    // Método 1: CartManager directo (clase o instancia)
    if (typeof cm.addItem === 'function') {
      try {
        cm.addItem(data);
        return true;
      } catch (e) {
        console.error('[Cart-Actions] Error en CartManager.addItem:', e);
      }
    }

    // Método 2: CartManager.current (patrón singleton)
    if (cm.current && typeof cm.current.addItem === 'function') {
      try {
        cm.current.addItem(data);
        return true;
      } catch (e) {
        console.error(
          '[Cart-Actions] Error en CartManager.current.addItem:',
          e
        );
      }
    }

    // Método 3: Legacy global.addToCart
    if (typeof globalThis.addToCart === 'function') {
      try {
        globalThis.addToCart(data.id, data);
        return true;
      } catch (e) {
        console.error('[Cart-Actions] Error en addToCart legacy:', e);
      }
    }

    return false;
  }

  /**
   * Maneja el flujo de "Comprar ahora": cierra el modal y abre el carrito.
   */
  function handleBuyNowFlow() {
    const am = globalThis.announcementManager;
    // Cerrar modal de anuncio primero
    if (am && typeof am.closeAnnouncementModal === 'function') {
      console.log('🔒 [Cart-Actions] Cerrando modal de anuncio...');
      am.closeAnnouncementModal();
    }

    // Abrir carrito con un pequeño delay
    setTimeout(() => {
      if (typeof globalThis.showCart === 'function') {
        console.log('🛒 [Cart-Actions] Abriendo carrito (showCart)...');
        globalThis.showCart();
      } else {
        const cm = globalThis.CartManager;
        if (cm && typeof cm.showCartModal === 'function') {
          console.log('🛒 [Cart-Actions] Abriendo carrito (CartManager)...');
          cm.showCartModal();
        }
      }
    }, 350);
  }

  /**
   * Listener capturador de clics para interceptar acciones del carrito.
   */
  document.addEventListener(
    'click',
    function (e) {
      const target = e.target.closest('[data-action]');
      if (!target) return;

      const action = target.dataset.action;
      if (action !== 'addAnnouncementToCart' && action !== 'buyAnnouncement')
        return;

      console.log('🛒 [Cart-Actions] Interceptando acción:', action);

      // Prevenir propagación
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      const id = target.dataset.id;
      if (!id) {
        console.warn(
          '⚠️ [Cart-Actions] Acción capturada pero sin ID de producto'
        );
        return;
      }

      const announcement = getAnnouncement(id);
      if (!announcement) {
        console.error('❌ [Cart-Actions] No se encontró anuncio con ID:', id);
        if (globalThis.NotificationSystem) {
          globalThis.NotificationSystem.error(
            'Error: No se pudo añadir el producto. Recarga la página.'
          );
        }
        return;
      }

      const imageUrl = resolveImageUrl(announcement, id);
      const productData = {
        id: announcement.id,
        title: announcement.name || announcement.title || 'Producto',
        price: Number.parseFloat(announcement.price) || 0,
        imageUrl: imageUrl,
        image: imageUrl, // Retrocompatibilidad
        stripeId: announcement.stripeId,
      };

      console.log('📦 [Cart-Actions] Datos preparados:', productData);

      if (tryAddToCart(productData)) {
        console.log('✅ [Cart-Actions] Éxito al añadir al carrito');
        if (action === 'buyAnnouncement') {
          handleBuyNowFlow();
        }
      } else {
        console.error('❌ [Cart-Actions] Ningún sistema de carrito disponible');
        if (globalThis.NotificationSystem) {
          globalThis.NotificationSystem.error(
            'Error del sistema. Por favor, recarga la página.'
          );
        }
      }
    },
    true
  );

  console.log(
    '✅ [Cart-Actions] Interceptor activado (Compatibility Mode v2.1)'
  );
}

export function initCartActions() {
  if (window.__CART_ACTIONS_INITED__) {
    return;
  }

  window.__CART_ACTIONS_INITED__ = true;
  setupCartActions();
}

if (typeof window !== 'undefined' && !window.__CART_ACTIONS_NO_AUTO__) {
  initCartActions();
}

