/**
 * common-handlers.js
 * Handlers comunes reutilizables para el sistema de delegación de eventos
 *
 * Este archivo registra handlers para acciones comunes como:
 * - Cerrar modales
 * - Toggle de clases
 * - Mostrar/ocultar elementos
 * - Agregar/remover clases
 *
 * Todos los handlers se registran automáticamente en EventDelegation
 * cuando este archivo se carga.
 */

'use strict';

const debugLog = (...args) => {
  if (window.__WIFIHACKX_DEBUG__ === true) {
    console.info(...args);
  }
};

function setupCommonHandlers() {

  // Verificar que EventDelegation esté disponible
  if (typeof window.EventDelegation === 'undefined') {
    console.error(
      '[CommonHandlers] EventDelegation not found. Load event-delegation.js first.'
    );
    return;
  }

  /**
   * Handler: closeModal
   * Cierra un modal por su ID
   *
   * Data attributes requeridos:
   *   - data-target: ID del modal a cerrar
   *
   * Ejemplo:
   *   <button data-action="closeModal" data-target="myModal">Cerrar</button>
   */
  window.EventDelegation.registerHandler('closeModal', (element, event) => {
    if (event) event.preventDefault();

    const targetId = element.dataset.target;
    let modal;

    if (targetId) {
      modal = document.getElementById(targetId);
    } else {
      // Fallback: buscar el modal más cercano
      modal = element.closest('.modal, .announcement-modal, .modal-overlay');
    }

    if (!modal) {
      // Si no hay target ni modal cercano, no hacemos nada (evitamos warning molesto)
      debugLog(
        '[CommonHandlers] closeModal: No target modal found to close'
      );
      return;
    }

    // Usar ModalManager si está disponible para mantener el estado sincronizado
    if (
      window.ModalManager &&
      typeof window.ModalManager.close === 'function'
    ) {
      window.ModalManager.close(modal);
      debugLog(
        `[CommonHandlers] Modal closed via ModalManager: ${modal.id || 'anonymous'}`
      );
    } else {
      // Fallback manual si ModalManager no existe
      window.DOMUtils.setDisplay(modal, 'none');
      modal.setAttribute('aria-hidden', 'true');
      modal.classList.remove('active', 'modal-visible');
      debugLog(
        `[CommonHandlers] Modal closed via direct DOM: ${modal.id || 'anonymous'}`
      );
    }
  });

  /**
   * Handler: share
   * Comparte un enlace usando Web Share API o copia al portapapeles.
   *
   * Data attributes opcionales:
   *   - data-share-title
   *   - data-share-text
   *   - data-share-url
   */
  window.EventDelegation.registerHandler('share', async (element, event) => {
    if (event) event.preventDefault();

    const title = element.dataset.shareTitle || document.title;
    const text = element.dataset.shareText || '';
    const url = element.dataset.shareUrl || window.location.href;

    try {
      const sheet = window.ShareSheet || (window.ShareSheet = createShareSheet());
      sheet.open({ title, text, url });
    } catch (_e) {
      if (
        window.NotificationSystem &&
        typeof window.NotificationSystem.error === 'function'
      ) {
        window.NotificationSystem.error('No se pudo compartir');
      }
    }
  });

  function createShareSheet() {
    const canNativeShare = typeof navigator !== 'undefined' && !!navigator.share;
    const overlay = document.createElement('div');
    overlay.className = 'share-sheet-overlay';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.innerHTML = `
      <div class="share-sheet" role="dialog" aria-modal="true" aria-label="Compartir">
        <div class="share-sheet-header">
          <div>
            <p class="share-sheet-title">Compartir</p>
            <p class="share-sheet-subtitle" data-share-subtitle>Elige una opción</p>
          </div>
          <button class="share-sheet-close" type="button" aria-label="Cerrar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 6 6 18"></path>
              <path d="M6 6 18 18"></path>
            </svg>
          </button>
        </div>
        <div class="share-sheet-grid">
          ${canNativeShare ? getShareButton('native', 'Compartir') : ''}
          ${getShareButton('whatsapp', 'WhatsApp')}
          ${getShareButton('instagram', 'Instagram')}
          ${getShareButton('telegram', 'Telegram')}
          ${getShareButton('x', 'X')}
          ${getShareButton('facebook', 'Facebook')}
          ${getShareButton('linkedin', 'LinkedIn')}
          ${getShareButton('tiktok', 'TikTok')}
          ${getShareButton('email', 'Email')}
          ${getShareButton('copy', 'Copiar')}
        </div>
        <div class="share-sheet-toast" aria-live="polite" role="status"></div>
      </div>
    `;

    document.body.appendChild(overlay);

    const close = () => {
      overlay.classList.remove('active');
      overlay.setAttribute('aria-hidden', 'true');
    };

    overlay.addEventListener('click', event => {
      if (event.target === overlay) {
        close();
      }
    });

    overlay.querySelector('.share-sheet-close').addEventListener('click', close);

    const toast = overlay.querySelector('.share-sheet-toast');

    overlay.querySelectorAll('.share-sheet-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const channel = btn.dataset.channel;
        const { title, text, url } = overlay.dataset;

        if (channel === 'native' && navigator.share) {
          try {
            await navigator.share({ title, text, url });
          } catch (_e) {
            if (
              window.NotificationSystem &&
              typeof window.NotificationSystem.error === 'function'
            ) {
              window.NotificationSystem.error('No se pudo compartir');
            }
          }
          return;
        }

        if (channel === 'copy') {
          const copied = await copyToClipboard(url);
          if (copied) {
            btn.querySelector('span').textContent = 'Copiado';
            setTimeout(() => {
              btn.querySelector('span').textContent = 'Copiar';
            }, 1600);
            showToast(toast, 'Enlace copiado');
          }
          return;
        }

        if (channel === 'instagram') {
          const copied = await copyToClipboard(url);
          if (copied) {
            btn.querySelector('span').textContent = 'Copiado';
            setTimeout(() => {
              btn.querySelector('span').textContent = 'Instagram';
            }, 1600);
            showToast(toast, 'Enlace copiado para Instagram');
          }
          window.open('https://www.instagram.com/', '_blank', 'noopener');
          return;
        }

        if (channel === 'tiktok') {
          const copied = await copyToClipboard(url);
          if (copied) {
            btn.querySelector('span').textContent = 'Copiado';
            setTimeout(() => {
              btn.querySelector('span').textContent = 'TikTok';
            }, 1600);
            showToast(toast, 'Enlace copiado para TikTok');
          }
          window.open('https://www.tiktok.com/', '_blank', 'noopener');
          return;
        }

        const shareUrl = buildShareUrl(channel, { title, text, url });
        if (shareUrl) {
          window.open(shareUrl, '_blank', 'noopener');
        }
      });
    });

    return {
      open({ title, text, url }) {
        overlay.dataset.title = title;
        overlay.dataset.text = text;
        overlay.dataset.url = url;
        overlay.querySelector('[data-share-subtitle]').textContent = text || title;
        overlay.classList.add('active');
        overlay.setAttribute('aria-hidden', 'false');
        showToast(toast, '');
      },
      close
    };
  }

  function getShareButton(channel, label) {
    return `
      <button class="share-sheet-btn" type="button" data-channel="${channel}">
        ${getShareIcon(channel)}
        <span>${label}</span>
      </button>
    `;
  }

  function getShareIcon(channel) {
    switch (channel) {
      case 'native':
        return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8a3 3 0 1 0-2.83-4H15a3 3 0 0 0 .17 1l-6.34 3.17a3 3 0 1 0 0 5.66l6.34 3.17A3 3 0 1 0 16 14a3 3 0 0 0-.17 1l-6.34-3.17a3 3 0 0 0 0-1.66L15.83 7A3 3 0 0 0 18 8Z"/></svg>';
      case 'whatsapp':
        return '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.52 3.49A11.86 11.86 0 0 0 12.02 0 11.9 11.9 0 0 0 .1 11.89a11.82 11.82 0 0 0 1.64 6.03L0 24l6.32-1.66a11.9 11.9 0 0 0 5.7 1.45h.01A11.9 11.9 0 0 0 24 11.9a11.86 11.86 0 0 0-3.48-8.41Zm-8.5 18.4h-.01a9.86 9.86 0 0 1-5.03-1.38l-.36-.21-3.75.98 1-3.65-.23-.38a9.88 9.88 0 1 1 8.38 4.64Zm5.45-7.46c-.3-.15-1.78-.88-2.06-.98-.28-.1-.48-.15-.68.15-.2.3-.78.98-.95 1.18-.18.2-.35.23-.65.08-.3-.15-1.27-.47-2.42-1.5-.9-.8-1.5-1.78-1.67-2.08-.18-.3-.02-.47.13-.62.14-.14.3-.35.45-.53.15-.18.2-.3.3-.5.1-.2.05-.38-.03-.53-.08-.15-.68-1.64-.94-2.24-.25-.6-.5-.52-.68-.53h-.58c-.2 0-.53.08-.8.38-.28.3-1.05 1.03-1.05 2.5s1.08 2.9 1.23 3.1c.15.2 2.12 3.24 5.14 4.54.72.31 1.28.5 1.72.64.72.23 1.38.2 1.9.12.58-.09 1.78-.73 2.03-1.43.25-.7.25-1.3.18-1.43-.08-.12-.28-.2-.58-.35Z"/></svg>';
      case 'telegram':
        return '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M21.8 2.2a1.6 1.6 0 0 0-1.64-.27L2.4 9.4a1.6 1.6 0 0 0 .1 3.03l4.7 1.6 1.8 5.3a1.6 1.6 0 0 0 2.63.65l2.8-2.6 4.55 3.35a1.6 1.6 0 0 0 2.5-.95l2.5-15.4a1.6 1.6 0 0 0-.72-1.78ZM9.6 13.7l7.92-7.3-6.2 8.1-.23 3.16-1.05-3.1-3.4-1.12 8.1-3.22Z"/></svg>';
      case 'instagram':
        return '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 3h10a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4Zm10 2H7a2 2 0 0 0-2 2v10c0 1.1.9 2 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2Zm-5 3.5A3.5 3.5 0 1 1 8.5 12 3.5 3.5 0 0 1 12 8.5Zm0 2A1.5 1.5 0 1 0 13.5 12 1.5 1.5 0 0 0 12 10.5ZM17.6 7.3a.9.9 0 1 1-.9-.9.9.9 0 0 1 .9.9Z"/></svg>';
      case 'linkedin':
        return '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM3 9h3.96v12H3V9Zm7.5 0H14v1.64h.06c.48-.9 1.64-1.85 3.38-1.85 3.62 0 4.29 2.38 4.29 5.48V21H17.8v-5.35c0-1.28-.02-2.92-1.78-2.92-1.78 0-2.05 1.39-2.05 2.82V21h-3.96V9Z"/></svg>';
      case 'tiktok':
        return '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16.6 2c.4 2.1 1.8 3.5 4.1 3.7v3.2c-1.5.1-2.8-.3-4.1-1v6.4a6.3 6.3 0 1 1-6.3-6.3c.3 0 .6 0 .9.1v3.3a3 3 0 1 0 2.2 2.9V2h3.2Z"/></svg>';
      case 'x':
        return '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.9 2h2.8l-6.1 7 7.2 13h-5.7l-4.5-7.3L6.6 22H3.8l6.6-7.6L3.2 2h5.8l4 6.7L18.9 2Zm-1 18.2h1.5L8 3.7H6.4l11.5 16.5Z"/></svg>';
      case 'facebook':
        return '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M13.5 22v-8h2.7l.4-3h-3.1V9c0-.9.2-1.5 1.5-1.5h1.7V4.8c-.3 0-1.3-.1-2.5-.1-2.5 0-4.2 1.5-4.2 4.3V11H7v3h3v8h3.5Z"/></svg>';
      case 'email':
        return '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm0 4.2 8 4.8 8-4.8V6l-8 4.8L4 6v2.2Z"/></svg>';
      case 'copy':
      default:
        return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"></rect><rect x="3" y="3" width="13" height="13" rx="2"></rect></svg>';
    }
  }

  function buildShareUrl(channel, { title, text, url }) {
    const safeTitle = encodeURIComponent(title || '');
    const safeText = encodeURIComponent(text || title || '');
    const safeUrl = encodeURIComponent(url || '');

    switch (channel) {
      case 'whatsapp':
        return `https://api.whatsapp.com/send?text=${safeText}%20${safeUrl}`;
      case 'telegram':
        return `https://t.me/share/url?url=${safeUrl}&text=${safeText}`;
      case 'x':
        return `https://twitter.com/intent/tweet?text=${safeText}&url=${safeUrl}`;
      case 'facebook':
        return `https://www.facebook.com/sharer/sharer.php?u=${safeUrl}`;
      case 'linkedin':
        return `https://www.linkedin.com/sharing/share-offsite/?url=${safeUrl}`;
      case 'email':
        return `mailto:?subject=${safeTitle}&body=${safeText}%0A${safeUrl}`;
      default:
        return '';
    }
  }

  async function copyToClipboard(value) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(value);
        if (
          window.NotificationSystem &&
          typeof window.NotificationSystem.success === 'function'
        ) {
          window.NotificationSystem.success('Enlace copiado');
        }
        return true;
      }
      prompt('Copia el enlace:', value);
      return true;
    } catch (_e) {
      if (
        window.NotificationSystem &&
        typeof window.NotificationSystem.error === 'function'
      ) {
        window.NotificationSystem.error('No se pudo copiar el enlace');
      }
      return false;
    }
  }

  function showToast(node, message) {
    if (!node) return;
    if (!message) {
      node.classList.remove('active');
      node.textContent = '';
      return;
    }
    node.textContent = message;
    node.classList.add('active');
    clearTimeout(node._toastTimer);
    node._toastTimer = setTimeout(() => {
      node.classList.remove('active');
    }, 1800);
  }

  /**
   * Handler: toggleClass
   * Toggle una clase en un elemento
   *
   * Data attributes requeridos:
   *   - data-target: Selector del elemento ('body', 'this', o selector CSS)
   *   - data-class: Nombre de la clase a toggle
   *
   * Ejemplo:
   *   <button data-action="toggleClass" data-target="body" data-class="dark-mode">
   *     Modo Oscuro
   *   </button>
   */
  window.EventDelegation.registerHandler('toggleClass', element => {
    const targetSelector = element.dataset.target;
    const className = element.dataset.class;

    if (!targetSelector || !className) {
      console.warn(
        '[CommonHandlers] toggleClass: Missing data-target or data-class'
      );
      return;
    }

    let target;

    // Casos especiales
    if (targetSelector === 'body') {
      target = document.body;
    } else if (targetSelector === 'this') {
      target = element;
    } else {
      target = document.querySelector(targetSelector);
    }

    if (target) {
      target.classList.toggle(className);
      debugLog(
        `[CommonHandlers] Class toggled: ${className} on ${targetSelector}`
      );
    } else {
      console.warn(`[CommonHandlers] Target not found: ${targetSelector}`);
    }
  });

  /**
   * Handler: addClass
   * Agrega una clase a un elemento
   *
   * Data attributes requeridos:
   *   - data-target: Selector del elemento
   *   - data-class: Nombre de la clase a agregar
   *
   * Ejemplo:
   *   <button data-action="addClass" data-target="#menu" data-class="open">
   *     Abrir Menú
   *   </button>
   */
  window.EventDelegation.registerHandler('addClass', element => {
    const targetSelector = element.dataset.target;
    const className = element.dataset.class;

    if (!targetSelector || !className) {
      console.warn(
        '[CommonHandlers] addClass: Missing data-target or data-class'
      );
      return;
    }

    let target;

    if (targetSelector === 'body') {
      target = document.body;
    } else if (targetSelector === 'this') {
      target = element;
    } else {
      target = document.querySelector(targetSelector);
    }

    if (target) {
      target.classList.add(className);
      debugLog(
        `[CommonHandlers] Class added: ${className} to ${targetSelector}`
      );
    } else {
      console.warn(`[CommonHandlers] Target not found: ${targetSelector}`);
    }
  });

  /**
   * Handler: removeClass
   * Remueve una clase de un elemento
   *
   * Data attributes requeridos:
   *   - data-target: Selector del elemento
   *   - data-class: Nombre de la clase a remover
   *
   * Ejemplo:
   *   <button data-action="removeClass" data-target="#menu" data-class="open">
   *     Cerrar Menú
   *   </button>
   */
  window.EventDelegation.registerHandler('removeClass', element => {
    const targetSelector = element.dataset.target;
    const className = element.dataset.class;

    if (!targetSelector || !className) {
      console.warn(
        '[CommonHandlers] removeClass: Missing data-target or data-class'
      );
      return;
    }

    let target;

    if (targetSelector === 'body') {
      target = document.body;
    } else if (targetSelector === 'this') {
      target = element;
    } else {
      target = document.querySelector(targetSelector);
    }

    if (target) {
      target.classList.remove(className);
      debugLog(
        `[CommonHandlers] Class removed: ${className} from ${targetSelector}`
      );
    } else {
      console.warn(`[CommonHandlers] Target not found: ${targetSelector}`);
    }
  });

  /**
   * Handler: show
   * Muestra un elemento (display: block)
   *
   * Data attributes requeridos:
   *   - data-target: ID del elemento a mostrar
   *
   * Ejemplo:
   *   <button data-action="show" data-target="sidebar">Mostrar Sidebar</button>
   */
  window.EventDelegation.registerHandler('show', element => {
    const targetId = element.dataset.target;

    if (!targetId) {
      console.warn('[CommonHandlers] show: Missing data-target attribute');
      return;
    }

    const target = document.getElementById(targetId);

    if (target) {
      window.DOMUtils.setDisplay(target, 'block');
      target.setAttribute('aria-hidden', 'false');
      debugLog(`[CommonHandlers] Element shown: ${targetId}`);
    } else {
      console.warn(`[CommonHandlers] Element not found: ${targetId}`);
    }
  });

  /**
   * Handler: hide
   * Oculta un elemento (display: none)
   *
   * Data attributes requeridos:
   *   - data-target: ID del elemento a ocultar
   *
   * Ejemplo:
   *   <button data-action="hide" data-target="sidebar">Ocultar Sidebar</button>
   */
  window.EventDelegation.registerHandler('hide', element => {
    const targetId = element.dataset.target;

    if (!targetId) {
      console.warn('[CommonHandlers] hide: Missing data-target attribute');
      return;
    }

    const target = document.getElementById(targetId);

    if (target) {
      window.DOMUtils.setDisplay(target, 'none');
      target.setAttribute('aria-hidden', 'true');
      debugLog(`[CommonHandlers] Element hidden: ${targetId}`);
    } else {
      console.warn(`[CommonHandlers] Element not found: ${targetId}`);
    }
  });

  /**
   * Handler: toggle
   * Toggle display de un elemento (show/hide)
   *
   * Data attributes requeridos:
   *   - data-target: ID del elemento a toggle
   *
   * Ejemplo:
   *   <button data-action="toggle" data-target="sidebar">Toggle Sidebar</button>
   */
  window.EventDelegation.registerHandler('toggle', element => {
    const targetId = element.dataset.target;

    if (!targetId) {
      console.warn('[CommonHandlers] toggle: Missing data-target attribute');
      return;
    }

    const target = document.getElementById(targetId);

    if (target) {
      const isHidden =
        target.classList.contains('hidden') ||
        window.getComputedStyle(target).display === 'none';

      if (isHidden) {
        window.DOMUtils.setDisplay(target, 'block');
        target.setAttribute('aria-hidden', 'false');
      } else {
        window.DOMUtils.setDisplay(target, 'none');
        target.setAttribute('aria-hidden', 'true');
      }

      debugLog(`[CommonHandlers] Element toggled: ${targetId}`);
    } else {
      console.warn(`[CommonHandlers] Element not found: ${targetId}`);
    }
  });

  /**
   * Handler: preventDefault
   * Previene el comportamiento por defecto de un elemento
   * Útil para enlaces o formularios
   *
   * Ejemplo:
   *   <a href="#" data-action="preventDefault">Link sin acción</a>
   */
  window.EventDelegation.registerHandler('preventDefault', (element, event) => {
    if (event) {
      event.preventDefault();
      debugLog('[CommonHandlers] Default action prevented');
    }
  });

  /**
   * Handler: stopPropagation
   * Detiene la propagación del evento
   *
   * Ejemplo:
   *   <button data-action="stopPropagation">No propagar</button>
   */
  window.EventDelegation.registerHandler(
    'stopPropagation',
    (element, event) => {
      if (event) {
        event.stopPropagation();
        debugLog('[CommonHandlers] Event propagation stopped');
      }
    }
  );

  /**
   * Handler: showCart
   * Abre el modal del carrito de compras
   *
   * Ejemplo:
   *   <button data-action="showCart">Abrir Carrito</button>
   */
  window.EventDelegation.registerHandler('showCart', (element, event) => {
    if (event) {
      event.preventDefault();
    }

    // Preload payment scripts for faster checkout
    if (window.PaymentLoader && typeof window.PaymentLoader.load === 'function') {
      window.PaymentLoader.load().catch(() => {});
    }

    // FORZAR ACTUALIZACIÓN DEL ICONO ANTES DE ABRIR - VERSIÓN SVG
    setTimeout(() => {
      const checkoutBtn = document.getElementById('checkoutBtn');
      if (checkoutBtn) {
        // Eliminar todos los iconos existentes
        const oldIcons = checkoutBtn.querySelectorAll('i, svg');
        oldIcons.forEach(icon => icon.remove());

        // Crear SVG de shopping-bag directamente
        const svgNS = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(svgNS, 'svg');
        svg.setAttribute('xmlns', svgNS);
        svg.setAttribute('width', '20');
        svg.setAttribute('height', '20');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('fill', 'none');
        svg.setAttribute('stroke', 'currentColor');
        svg.setAttribute('stroke-width', '2');
        svg.setAttribute('stroke-linecap', 'round');
        svg.setAttribute('stroke-linejoin', 'round');
        svg.setAttribute('aria-hidden', 'true');
        svg.classList.add('cart-btn-icon');

        // Path 1: Bolsa
        const path1 = document.createElementNS(svgNS, 'path');
        path1.setAttribute(
          'd',
          'M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z'
        );
        svg.appendChild(path1);

        // Line: Línea horizontal
        const line = document.createElementNS(svgNS, 'line');
        line.setAttribute('x1', '3');
        line.setAttribute('y1', '6');
        line.setAttribute('x2', '21');
        line.setAttribute('y2', '6');
        svg.appendChild(line);

        // Path 2: Asa
        const path2 = document.createElementNS(svgNS, 'path');
        path2.setAttribute('d', 'M16 10a4 4 0 0 1-8 0');
        svg.appendChild(path2);

        // Insertar al inicio
        checkoutBtn.insertBefore(svg, checkoutBtn.firstChild);

        debugLog(
          '[ICON-V4] Icono SVG shopping-bag actualizado en showCart'
        );
      }
    }, 50);

    // Intentar usar la función global showCart
    if (typeof globalThis.showCart === 'function') {
      globalThis.showCart();
      debugLog('[CommonHandlers] Cart opened via global showCart()');
      return;
    }

    // Fallback: CartManager instance
    if (window.CartManager && window.CartManager.current) {
      if (typeof window.CartManager.current.showCartModal === 'function') {
        window.CartManager.current.showCartModal();
        debugLog(
          '[CommonHandlers] Cart opened via CartManager.current.showCartModal()'
        );
        return;
      }
      if (typeof window.CartManager.current.toggleCart === 'function') {
        window.CartManager.current.toggleCart();
        debugLog(
          '[CommonHandlers] Cart opened via CartManager.current.toggleCart()'
        );
        return;
      }
    }

    // Fallback: CartManager static method
    if (
      window.CartManager &&
      typeof window.CartManager.showCartModal === 'function'
    ) {
      window.CartManager.showCartModal();
      debugLog(
        '[CommonHandlers] Cart opened via CartManager.showCartModal()'
      );
      return;
    }

    console.warn('[CommonHandlers] showCart: No cart handler available');
  });

  /**
   * Handler: closeCart
   * Cierra el modal del carrito de compras
   *
   * Ejemplo:
   *   <button data-action="closeCart">Cerrar Carrito</button>
   */
  window.EventDelegation.registerHandler('closeCart', (element, event) => {
    if (event) {
      event.preventDefault();
    }

    if (typeof globalThis.closeCart === 'function') {
      globalThis.closeCart();
      debugLog('[CommonHandlers] Cart closed via global closeCart()');
    } else {
      const modal = document.getElementById('cartModal');
      if (modal) {
      window.DOMUtils.setDisplay(modal, 'none');
        modal.setAttribute('aria-hidden', 'true');
        debugLog('[CommonHandlers] Cart closed via direct DOM manipulation');
      }
    }
  });

  // Fallback robusto: asegurar handlers del panel de accesibilidad
  window.EventDelegation.registerHandler(
    'showAccessibilityPanel',
    (element, event) => {
      if (event) event.preventDefault();
      const modal = document.getElementById('accessibilityModal');
      if (!modal) return;

      if (window.ModalManager && typeof window.ModalManager.open === 'function') {
        window.ModalManager.open(modal);
      } else {
        modal.classList.add('active');
        modal.setAttribute('aria-hidden', 'false');
      }

      if (typeof globalThis.loadAccessibilityPreferences === 'function') {
        globalThis.loadAccessibilityPreferences();
      } else if (
        typeof window.loadAccessibilityPreferences === 'function'
      ) {
        window.loadAccessibilityPreferences();
      }
    }
  );

  window.EventDelegation.registerHandler(
    'closeAccessibilityPanel',
    (element, event) => {
      if (event) event.preventDefault();
      const modal = document.getElementById('accessibilityModal');
      if (!modal) return;

      if (
        window.ModalManager &&
        typeof window.ModalManager.close === 'function'
      ) {
        window.ModalManager.close(modal);
      } else {
        modal.classList.remove('active', 'modal-visible', 'show');
        modal.setAttribute('aria-hidden', 'true');
        if (window.DOMUtils && typeof window.DOMUtils.setDisplay === 'function') {
          window.DOMUtils.setDisplay(modal, 'none');
        }
      }

      // Mantener AppState sincronizado aunque el cierre sea por fallback.
      if (window.AppState && typeof window.AppState.setState === 'function') {
        window.AppState.setState('modal.active', null, true);
        window.AppState.setState('modal.data', null, true);
      }
    }
  );

  window.EventDelegation.registerHandler('setContrast', (element, event) => {
    if (typeof globalThis.toggleContrast === 'function') {
      globalThis.toggleContrast(event || { target: element });
    }
  });

  window.EventDelegation.registerHandler('setFontSize', (element, event) => {
    if (typeof globalThis.setFontSize === 'function') {
      globalThis.setFontSize(event || { target: element });
    }
  });

  // Fallback robusto: selector de idioma (cuando no lo registra ui-interactions)
  window.EventDelegation.registerHandler('select-language', (element, event) => {
    if (event) event.preventDefault();
    const option = element && element.closest ? element.closest('.language-option') : null;
    const lang = (option && option.dataset && option.dataset.lang) || (element && element.dataset && element.dataset.lang);
    if (lang && typeof window.changeLanguage === 'function') {
      window.changeLanguage(lang);
    }

    const languageToggle = document.getElementById('languageToggle');
    const languageDropdown = document.getElementById('languageDropdown');
    if (languageToggle) {
      languageToggle.setAttribute('aria-expanded', 'false');
    }
    if (languageDropdown) {
      languageDropdown.classList.remove('show');
      if (window.DOMUtils && typeof window.DOMUtils.setDisplay === 'function') {
        window.DOMUtils.setDisplay(languageDropdown, 'none');
      }
    }
  });

  window.EventDelegation.registerHandler(
    'toggleReducedMotion',
    (element, event) => {
      if (event) event.preventDefault();
      if (typeof globalThis.toggleReducedMotion === 'function') {
        globalThis.toggleReducedMotion();
      }
    }
  );

  window.EventDelegation.registerHandler(
    'toggleFocusOutline',
    (element, event) => {
      if (event) event.preventDefault();
      if (typeof globalThis.toggleFocusOutline === 'function') {
        globalThis.toggleFocusOutline();
      }
    }
  );

  window.EventDelegation.registerHandler(
    'resetAccessibility',
    (element, event) => {
      if (event) event.preventDefault();
      if (typeof globalThis.resetAccessibility === 'function') {
        globalThis.resetAccessibility();
      }
    }
  );

  /**
   * Handler: checkout
   * Procesa el pago del carrito
   *
   * Ejemplo:
   *   <button data-action="checkout">Procesar Pago</button>
   */
  window.EventDelegation.registerHandler('checkout', (element, event) => {
    if (event) {
      event.preventDefault();
    }

    // Verificar si el carrito está vacío ANTES de procesar
    if (
      window.CartManager &&
      window.CartManager.items &&
      window.CartManager.items.length === 0
    ) {
      debugLog('[CommonHandlers] Checkout: Carrito vacío, no se procesa');
      return; // Salir silenciosamente sin mostrar mensaje
    }

    // Mostrar mensaje de preparando pago usando el sistema centralizado
    if (window.showPaymentMessage) {
      window.showPaymentMessage();
    }

    // Obtener el botón de checkout
    const checkoutBtn = document.getElementById('checkoutBtn') || element;

    // Guardar el texto original
    const originalText = checkoutBtn.innerHTML;

    // Cambiar a estado "procesando"
    checkoutBtn.disabled = true;
    checkoutBtn.innerHTML =
      '<i data-lucide="loader" aria-hidden="true" class="animate-spin"></i> Procesando...';
    window.DOMUtils.setOpacityClass(checkoutBtn, '0.7');

    // Reinicializar iconos de Lucide si está disponible
    if (window.lucide) {
      window.lucide.createIcons();
    }

    const runCheckout = () => {
      // Ejecutar checkout directamente con CartManager - NO llamar a funciones globales
      if (
        window.CartManager &&
        typeof window.CartManager.checkout === 'function'
      ) {
        const ok = window.CartManager.checkout(checkoutBtn);
        debugLog(
          '[CommonHandlers] Checkout initiated via CartManager.checkout()'
        );
        if (ok === false) {
          // Restaurar botón si no se pudo iniciar checkout
          setTimeout(() => {
            checkoutBtn.disabled = false;
            checkoutBtn.innerHTML = originalText;
            window.DOMUtils.setOpacityClass(checkoutBtn, '1');
            if (window.lucide) {
              window.lucide.createIcons();
            }
          }, 300);
        }
      } else {
        console.warn('[CommonHandlers] checkout: No checkout handler available');

        // Restaurar botón si no hay handler
        setTimeout(() => {
          checkoutBtn.disabled = false;
          checkoutBtn.innerHTML = originalText;
          window.DOMUtils.setOpacityClass(checkoutBtn, '1');
          if (window.lucide) {
            window.lucide.createIcons();
          }
        }, 1000);
      }
    };

    // Ensure payment scripts are ready before checkout
    if (
      window.PaymentLoader &&
      typeof window.PaymentLoader.ensureStripeReady === 'function'
    ) {
      window.PaymentLoader.ensureStripeReady().then(runCheckout).catch(() => {
        runCheckout();
      });
    } else {
      runCheckout();
    }
  });

  /**
   * Handler: clearCart
   * Vacía el carrito de compras
   *
   * Ejemplo:
   *   <button data-action="clearCart">Vaciar Carrito</button>
   */
  window.EventDelegation.registerHandler('clearCart', (element, event) => {
    if (event) {
      event.preventDefault();
    }

    if (typeof globalThis.clearCart === 'function') {
      globalThis.clearCart();
      debugLog('[CommonHandlers] Cart cleared via global clearCart()');
    } else if (window.CartManager && window.CartManager.current) {
      if (typeof window.CartManager.current.clearCart === 'function') {
        window.CartManager.current.clearCart();
        debugLog(
          '[CommonHandlers] Cart cleared via CartManager.current.clearCart()'
        );
      }
    } else {
      console.warn(
        '[CommonHandlers] clearCart: No clear cart handler available'
      );
    }
  });

  /**
   * Handler: showLoginView
   * Muestra la vista de login
   *
   * Ejemplo:
   *   <button data-action="showLoginView">Iniciar Sesión</button>
   */
  window.EventDelegation.registerHandler(
    'showLoginView',
    async (element, event) => {
    if (event) {
      event.preventDefault();
    }

    debugLog('[CommonHandlers] Switching to login view');

    if (typeof window.showLoginView === 'function') {
      await window.showLoginView();
      return;
    }

    // Ocultar todas las vistas
    const views = document.querySelectorAll('.view');
    views.forEach(view => {
      view.classList.remove('active');
      view.classList.add('hidden');
      window.DOMUtils.setDisplay(view, 'none');
    });

    // Mostrar vista de login
    const loginView = document.getElementById('loginView');
    if (loginView) {
      loginView.classList.add('active');
      loginView.classList.remove('hidden');
      window.DOMUtils.setDisplay(loginView, 'block');
      document.body.setAttribute('data-current-view', 'loginView');
      debugLog('[CommonHandlers] Login view shown');
    } else {
      console.error('[CommonHandlers] Login view not found');
    }
    }
  );

  // Handlers passthrough para botones Google Auth.
  // El flujo real lo maneja auth.js con listeners directos; aquí evitamos warnings
  // de EventDelegation cuando el usuario hace click muy temprano.
  window.EventDelegation.registerHandler('loginWithGoogle', () => {});
  window.EventDelegation.registerHandler('registerWithGoogle', () => {});
  const registerPassthroughHandler = (actionName, globalFunctionName) => {
    window.EventDelegation.registerHandler(actionName, (_el, event) => {
      if (event) event.preventDefault();
      const handler = window[globalFunctionName];
      if (typeof handler === 'function') {
        handler();
      }
    });
  };

  // adminMfaVerify/adminMfaBackup se registran en admin-navigation-unified.js
  // para mantener la lógica MFA agrupada en un único módulo.
  // Passthrough para acciones de formulario de anuncios; evita warnings
  // cuando el usuario pulsa antes de que el form handler termine de enlazar.
  registerPassthroughHandler(
    'handleSaveAnnouncement',
    'handleSaveAnnouncement'
  );
  registerPassthroughHandler(
    'resetAnnouncementForm',
    'resetAnnouncementForm'
  );
  registerPassthroughHandler('previewAnnouncement', 'previewAnnouncement');
  registerPassthroughHandler('testAnnouncementHTML', 'testAnnouncementHTML');

  /**
   * Handler: goHome
   * Regresa a la vista principal (home)
   *
   * Ejemplo:
   *   <button data-action="goHome">Volver al Inicio</button>
   */
  window.EventDelegation.registerHandler('goHome', (element, event) => {
    if (event) {
      event.preventDefault();
    }

    debugLog('[CommonHandlers] Going back to home view');

    // Ocultar todas las vistas
    const views = document.querySelectorAll('.view');
    views.forEach(view => {
      view.classList.remove('active');
      view.classList.add('hidden');
      window.DOMUtils.setDisplay(view, 'none');
    });

    // Mostrar vista home
    const homeView = document.getElementById('homeView');
    if (homeView) {
      homeView.classList.add('active');
      homeView.classList.remove('hidden');
      window.DOMUtils.setDisplay(homeView, 'block');
      document.body.setAttribute('data-current-view', 'homeView');
      debugLog('[CommonHandlers] Home view shown');
    } else {
      console.error('[CommonHandlers] Home view not found');
    }
  });

  /**
   * Handler: logout
   * Cierra la sesión del usuario
   *
   * Ejemplo:
   *   <button data-action="logout">Cerrar Sesión</button>
   */
  window.EventDelegation.registerHandler('logout', async (element, event) => {
    if (event) {
      event.preventDefault();
    }

    // CRITICAL: Evitar notificaciones múltiples
    if (window.__logoutInProgress) {
      debugLog('[CommonHandlers] Logout already in progress, skipping...');
      return;
    }
    window.__logoutInProgress = true;

    debugLog('[CommonHandlers] Logging out user...');

    try {
      // Limpiar listeners en tiempo real antes de cerrar sesión
      try {
        if (window.realTimeDataService?.cleanup) {
          window.realTimeDataService.cleanup();
        }
        if (window.AdminDataManager?.getInstance) {
          const adm = window.AdminDataManager.getInstance();
          if (adm?.unsubscribeAll) adm.unsubscribeAll();
        } else if (window.AdminDataManager?.unsubscribeAll) {
          window.AdminDataManager.unsubscribeAll();
        }
        if (window.AnalyticsManager?.current?.cleanupRealTimeUpdates) {
          window.AnalyticsManager.current.cleanupRealTimeUpdates();
        }
        if (window.DashboardStatsManager?.cleanup) {
          window.DashboardStatsManager.cleanup();
        } else if (window.dashboardStatsManager?.cleanup) {
          window.dashboardStatsManager.cleanup();
        }
        if (window.AdminAuditRenderer?.unsubscribe) {
          window.AdminAuditRenderer.unsubscribe();
        }
      } catch (_e) {}

      // Limpiar carrito al hacer logout para evitar que otros usuarios vean productos de otros
      if (
        window.CartManager &&
        window.CartManager.current &&
        typeof window.CartManager.current.clear === 'function'
      ) {
        window.CartManager.current.clear();
        debugLog('[CommonHandlers] Cart cleared on logout');
      }

      // Limpiar claves de carrito específicas del usuario
      const cartKeys = Object.keys(localStorage).filter(
        key =>
          key.startsWith('wifiHackX_cart') ||
          key.startsWith('wifiHackXCart') ||
          key === 'cart'
      );
      cartKeys.forEach(key => {
        localStorage.removeItem(key);
      });
      debugLog(
        `[CommonHandlers] Removed ${cartKeys.length} cart keys from localStorage`
      );

      await firebase.auth().signOut();

      // Notificar al usuario (ÚNICA NOTIFICACIÓN)
      if (window.NotificationSystem) {
        window.NotificationSystem.success('Sesión cerrada correctamente');
        debugLog('[CommonHandlers] Logout notification shown (SINGLE)');
      }

      // Ocultar botón de admin
      const adminBtn = document.querySelector('.header-admin-btn');
      if (adminBtn) {
        adminBtn.setAttribute('hidden', '');
      }

      // Limpiar estado admin persistido
      try {
        localStorage.removeItem('adminViewActive');
        localStorage.removeItem('isAdmin');
      } catch (_e) {}

      // Limpiar clases de admin
      document.body.classList.remove('admin-mode', 'admin-active');

      // Regresar a home
      const homeView = document.getElementById('homeView');
      const loginView = document.getElementById('loginView');
      const adminView = document.getElementById('adminView');

      if (homeView) {
        homeView.classList.add('active');
        homeView.classList.remove('hidden');
        window.DOMUtils.setDisplay(homeView, 'block');
      }
      if (loginView) {
        loginView.classList.remove('active');
        loginView.classList.add('hidden');
        window.DOMUtils.setDisplay(loginView, 'none');
      }
      if (adminView) {
        adminView.classList.remove('active');
        adminView.classList.add('hidden');
        window.DOMUtils.setDisplay(adminView, 'none');
      }

      document.body.setAttribute('data-current-view', 'homeView');

      debugLog('[CommonHandlers] User logged out successfully');
    } catch (error) {
      console.error('[CommonHandlers] Logout error:', error);
      if (window.NotificationSystem) {
        window.NotificationSystem.error('Error al cerrar sesión');
      }
    } finally {
      // Liberar el flag después de un delay para evitar race conditions
      setTimeout(() => {
        window.__logoutInProgress = false;
      }, 1000);
    }
  });

  /**
   * Handler: openAdmin
   * Abre el panel de administración
   *
   * Ejemplo:
   *   <button data-action="openAdmin">Admin</button>
   */
  window.EventDelegation.registerHandler(
    'openAdmin',
    async (element, event) => {
      if (event) {
        event.preventDefault();
      }

      debugLog('[CommonHandlers] Opening admin panel...');

      // Verificar permisos de admin antes de cargar scripts
      try {
        if (!window.firebase || !firebase.auth) {
          throw new Error('Firebase no disponible');
        }
        const user = firebase.auth().currentUser;
        if (!user) {
          throw new Error('No hay usuario autenticado');
        }
        let isAdmin = false;
        if (window.AdminClaimsService?.isAdmin) {
          let allowlist = null;
          if (window.AdminSettingsService?.getAllowlist) {
            allowlist = await window.AdminSettingsService.getAllowlist({
              allowDefault: true,
            });
          }
          isAdmin = await window.AdminClaimsService.isAdmin(user, allowlist);
        } else {
          const claims = window.getAdminClaims
            ? await window.getAdminClaims(user, true)
            : (await user.getIdTokenResult(true)).claims;
          isAdmin =
            !!claims?.admin ||
            claims?.role === 'admin' ||
            claims?.role === 'super_admin';
        }
        if (!isAdmin) {
          if (window.NotificationSystem) {
            window.NotificationSystem.error(
              'No tienes permisos para acceder al panel de administración.'
            );
          } else {
            alert('No tienes permisos para acceder al panel de administración.');
          }
          return;
        }
      } catch (error) {
        console.warn('[CommonHandlers] Admin check failed:', error);
        if (window.NotificationSystem) {
          window.NotificationSystem.error(
            'No se pudo verificar permisos de admin.'
          );
        }
        return;
      }

      // PASO 1: Cargar core rápido para habilitar showAdminView
      if (window.AdminLoader) {
        try {
          if (typeof window.AdminLoader.loadCore === 'function') {
            if (!window.AdminLoader.isCoreLoaded()) {
              debugLog('[CommonHandlers] ⚡ Loading admin core...');
              await window.AdminLoader.loadCore({ skipAuthCheck: true });
            }
          } else if (typeof window.AdminLoader.load === 'function') {
            if (!window.AdminLoader.isLoaded()) {
              debugLog('[CommonHandlers] ⚡ Loading admin scripts...');
              await window.AdminLoader.load();
            }
          }
        } catch (error) {
          console.error('[CommonHandlers] ❌ Error loading admin core:', error);
          return;
        }
      }

      // PASO 2: Abrir admin inmediatamente si existe showAdminView
      const tryOpenAdmin = (attempts = 0) => {
        if (typeof window.showAdminView === 'function') {
          window.showAdminView();
          debugLog('[CommonHandlers] ✅ Admin panel opened');
          return;
        }

        if (attempts < 10) {
          debugLog(
            `[CommonHandlers] ⏳ Waiting for showAdminView... (attempt ${attempts + 1}/10)`
          );
          setTimeout(() => tryOpenAdmin(attempts + 1), 100);
          return;
        }

        console.error(
          '[CommonHandlers] ❌ showAdminView function not found after 10 attempts'
        );

        // Fallback directo: abrir admin view sin depender de showAdminView.
        const adminView = document.getElementById('adminView');
        if (adminView) {
          adminView.classList.remove('hidden');
          adminView.classList.add('active');
          adminView.setAttribute('aria-hidden', 'false');
          if (window.DOMUtils) {
            window.DOMUtils.setDisplay(adminView, 'block');
            window.DOMUtils.setVisibility(adminView, true);
            window.DOMUtils.setOpacityClass(adminView, '1');
          }
          document.body.classList.add('admin-mode', 'admin-active', 'admin-view');
          document.body.setAttribute('data-current-view', 'adminView');
          if (typeof window.showAdminSection === 'function') {
            window.showAdminSection('dashboard');
          }
          console.warn('[CommonHandlers] ⚠️ Admin opened via fallback mode');
        }

        // Sin inyección manual adicional; el fallback directo ya abrió admin.
      };

      tryOpenAdmin();

      // PASO 3: Cargar bundle activo en background
      if (window.AdminLoader) {
        const loadActive =
          typeof window.AdminLoader.ensureActiveBundle === 'function'
            ? window.AdminLoader.ensureActiveBundle()
            : typeof window.AdminLoader.ensureBundle === 'function'
              ? window.AdminLoader.ensureBundle('dashboard')
              : null;

        if (loadActive && typeof loadActive.catch === 'function') {
          loadActive.catch(error => {
            console.error('[CommonHandlers] ❌ Error loading admin bundle:', error);
          });
        } else if (!window.AdminLoader.isLoaded()) {
          window.AdminLoader.load().catch(error => {
            console.error('[CommonHandlers] ❌ Error loading admin scripts:', error);
          });
        }
      }
    }
  );

  /**
   * Handler: saveSettings
   * Guarda configuración del sistema
   */
  window.EventDelegation.registerHandler('saveSettings', async () => {
    try {
      if (
        !window.settingsController &&
        window.AdminLoader &&
        typeof window.AdminLoader.ensureBundle === 'function'
      ) {
        await window.AdminLoader.ensureBundle('settings', { skipAuthCheck: true });
      }
      if (!window.settingsController && window.SettingsController) {
        window.settingsController =
          window.settingsController || new window.SettingsController(null);
      }
      if (typeof window.saveSettings === 'function') {
        await window.saveSettings();
        return;
      }
      if (
        window.adminController &&
        window.adminController.modules &&
        window.adminController.modules.settings &&
        typeof window.adminController.modules.settings.updateSettings ===
          'function'
      ) {
        await window.adminController.modules.settings.updateSettings();
      } else {
        console.warn('[CommonHandlers] saveSettings no disponible');
      }
    } catch (error) {
      console.error('[CommonHandlers] Error en saveSettings:', error);
    }
  });

  /**
   * Handler: resetSettings
   * Restaura configuración del sistema
   */
  window.EventDelegation.registerHandler('resetSettings', async () => {
    try {
      if (
        !window.settingsController &&
        window.AdminLoader &&
        typeof window.AdminLoader.ensureBundle === 'function'
      ) {
        await window.AdminLoader.ensureBundle('settings', { skipAuthCheck: true });
      }
      if (!window.settingsController && window.SettingsController) {
        window.settingsController =
          window.settingsController || new window.SettingsController(null);
      }
      if (typeof window.resetSettings === 'function') {
        await window.resetSettings();
        return;
      }
      if (
        window.adminController &&
        window.adminController.modules &&
        window.adminController.modules.settings &&
        typeof window.adminController.modules.settings.resetSettings ===
          'function'
      ) {
        await window.adminController.modules.settings.resetSettings();
      } else {
        console.warn('[CommonHandlers] resetSettings no disponible');
      }
    } catch (error) {
      console.error('[CommonHandlers] Error en resetSettings:', error);
    }
  });

  /**
   * Handler: refreshAdminClaims
   * Refresca token para cargar claims admin recientes
   */
  window.EventDelegation.registerHandler('refreshAdminClaims', async () => {
    try {
      if (!window.firebase || !firebase.auth) {
        throw new Error('Firebase no disponible');
      }
      const user = firebase.auth().currentUser;
      if (!user) {
        throw new Error('No hay usuario autenticado');
      }
      await user.getIdToken(true);
      if (typeof DOMUtils !== 'undefined' && DOMUtils.showNotification) {
        DOMUtils.showNotification('Permisos actualizados', 'success');
      }
      window.location.reload();
    } catch (error) {
      console.error('[CommonHandlers] Error en refreshAdminClaims:', error);
      if (typeof DOMUtils !== 'undefined' && DOMUtils.showNotification) {
        DOMUtils.showNotification(
          'No se pudo refrescar permisos',
          'error'
        );
      }
    }
  });

  /**
   * Admin users actions (lazy-load users bundle)
   */
  const ensureUsersBundle = async () => {
    if (window.AdminLoader && typeof window.AdminLoader.ensureBundle === 'function') {
      await window.AdminLoader.ensureBundle('users', { skipAuthCheck: true });
    }
  };

  window.EventDelegation.registerHandler('syncUsers', async (element, event) => {
    if (event) event.preventDefault();
    try {
      await ensureUsersBundle();
      if (window.usersManager && typeof window.usersManager.syncUsers === 'function') {
        window.usersManager.syncUsers();
      } else {
        console.warn('[CommonHandlers] syncUsers: UsersManager not ready');
      }
    } catch (error) {
      console.error('[CommonHandlers] syncUsers failed:', error);
    }
  });

  window.EventDelegation.registerHandler('exportUsers', async (element, event) => {
    if (event) event.preventDefault();
    try {
      await ensureUsersBundle();
      if (window.usersManager && typeof window.usersManager.exportUsers === 'function') {
        window.usersManager.exportUsers();
      } else {
        console.warn('[CommonHandlers] exportUsers: UsersManager not ready');
      }
    } catch (error) {
      console.error('[CommonHandlers] exportUsers failed:', error);
    }
  });

  window.EventDelegation.registerHandler('createUser', async (element, event) => {
    if (event) event.preventDefault();
    try {
      await ensureUsersBundle();
      if (window.usersManager && typeof window.usersManager.createUser === 'function') {
        window.usersManager.createUser();
      } else {
        console.warn('[CommonHandlers] createUser: UsersManager not ready');
      }
    } catch (error) {
      console.error('[CommonHandlers] createUser failed:', error);
    }
  });

  window.EventDelegation.registerHandler('openIntrusionLogs', async (_element, event) => {
    if (event) event.preventDefault();
    try {
      if (typeof window.showAdminSection === 'function') {
        window.showAdminSection('dashboard');
      }

      if (window.AdminLoader && typeof window.AdminLoader.ensureBundle === 'function') {
        await window.AdminLoader.ensureBundle('dashboard', { skipAuthCheck: true });
      }

      const scrollToAudit = () => {
        const section = document.getElementById('adminAuditSection');
        if (!section) return false;
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return true;
      };

      if (!scrollToAudit()) {
        setTimeout(() => {
          scrollToAudit();
        }, 450);
      }
    } catch (error) {
      console.error('[CommonHandlers] openIntrusionLogs failed:', error);
    }
  });

  // Scroll to product from purchase success modal
  window.EventDelegation.registerHandler('scroll-to-product', (element, event) => {
    if (event) event.preventDefault();
    const id = element?.dataset?.productId || element?.dataset?.id;
    if (!id) return;
    const target =
      document.querySelector(`#ann-${id}`) ||
      document.querySelector(`[data-announcement-id="${id}"]`);
    if (target && target.scrollIntoView) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    if (typeof window.showAnnouncementDetails === 'function') {
      window.showAnnouncementDetails(id);
    }
  });

  debugLog('✅ [CommonHandlers] Handlers comunes registrados');
  debugLog('[CommonHandlers] Available handlers:', [
    'closeModal',
    'toggleClass',
    'addClass',
    'removeClass',
    'show',
    'hide',
    'toggle',
    'preventDefault',
    'stopPropagation',
    'showCart',
    'closeCart',
    'checkout',
    'clearCart',
    'showLoginView',
    'goHome',
    'logout',
    'openAdmin',
    'scroll-to-product',
    'syncUsers',
    'exportUsers',
    'createUser',
    'openIntrusionLogs',
  ]);
}

export function initCommonHandlers() {
  if (window.__COMMON_HANDLERS_INITED__) {
    return;
  }

  window.__COMMON_HANDLERS_INITED__ = true;
  setupCommonHandlers();
}

if (typeof window !== 'undefined' && !window.__COMMON_HANDLERS_NO_AUTO__) {
  initCommonHandlers();
}


