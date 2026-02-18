/**
 * Core JS - Utilidades básicas y configuración
 * Funciones compartidas y configuración global
 */

/* global NotificationSystem, lucide, IntersectionObserver, AdminDataManager */

// Configuración global
window.APP_CONFIG = {
  version: '1.0.0',
  environment:
    window.location.hostname === 'localhost' ? 'development' : 'production',
};

// Firebase runtime config (single source of truth in index.html runtime-config)
const firebaseConfig =
  (window.RUNTIME_CONFIG && window.RUNTIME_CONFIG.firebase) || {};

// Exponer firebaseConfig globalmente
window.firebaseConfig = firebaseConfig;

// Initialize Firebase (DISABLED: Now handled by firebase-init-modular.js)
/*
(function initFirebase() {
...
})();
*/

// DOMUtils - Utilidades del DOM
window.DOMUtils = window.DOMUtils || {
  // Funciones básicas de utilidad
  createElement: (tag, attrs = {}) => {
    const el = document.createElement(tag);
    Object.entries(attrs).forEach(([key, value]) => {
      if (key === 'text') {
        el.textContent = value;
      } else if (key === 'html') {
        el.innerHTML = value;
      } else if (key === 'class') {
        el.className = value;
      } else if (key.startsWith('on') && typeof value === 'function') {
        el.addEventListener(key.substring(2).toLowerCase(), value);
      } else if (value !== null && value !== undefined) {
        el.setAttribute(key, value);
      }
    });
    return el;
  },

  // Mostrar notificación (compatibilidad con versiones anteriores)
  showNotification(message, type = 'info') {
    if (typeof NotificationSystem !== 'undefined' && NotificationSystem[type]) {
      return NotificationSystem[type](message);
    }
    console.log(`[${type}] ${message}`);
  },

  // Otras utilidades básicas
  ready: fn => {
    if (document.readyState !== 'loading') {
      fn();
    } else {
      document.addEventListener('DOMContentLoaded', fn);
    }
  },

  // Inicializar Lucide
  initLucideIcons() {
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  },

  // Función para cargar múltiples scripts
  loadScripts(scripts) {
    return Promise.all(
      scripts.map(src => {
        return new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = src;
          script.onload = resolve;
          script.onerror = reject;
          document.head.appendChild(script);
        });
      })
    );
  },

  // Función para actualizar texto de elementos
  updateElementText(selector, text) {
    const element = document.querySelector(selector);
    if (element) element.textContent = text;
  },

  // Función para inicializar lazy loading
  initLazyLoading() {
    if ('IntersectionObserver' in window) {
      const lazyImages = document.querySelectorAll('img[data-src]');
      const imageObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const img = entry.target;
            img.src = img.dataset.src;
            img.removeAttribute('data-src');
            observer.unobserve(img);
          }
        });
      });

      lazyImages.forEach(img => imageObserver.observe(img));
    }
  },

  // Función para limpiar un elemento
  clearElement(element) {
    if (element) {
      while (element.firstChild) {
        element.removeChild(element.firstChild);
      }
    }
  },

  // Función para mostrar modal
  showModal(title, content) {
    // Crear overlay del modal
    const modalOverlay = document.createElement('div');
    modalOverlay.className = 'modal-overlay core-modal-overlay';

    // Crear contenedor del modal
    const modalContainer = document.createElement('div');
    modalContainer.className = 'modal-container core-modal-container';

    // Prevenir que clicks dentro del modal cierren el overlay
    modalContainer.addEventListener('click', function (e) {
      e.stopPropagation();
    });

    // Crear header del modal
    const modalHeader = document.createElement('div');
    modalHeader.className = 'core-modal-header';

    const modalTitle = document.createElement('h2');
    modalTitle.textContent = title;
    modalTitle.className = 'core-modal-title';

    const closeButton = document.createElement('button');
    closeButton.innerHTML = '×';
    closeButton.className = 'modal-close-btn core-modal-close';
    closeButton.type = 'button';
    closeButton.setAttribute('aria-label', 'Cerrar modal');

    // Crear body del modal
    const modalBody = document.createElement('div');
    modalBody.innerHTML = content;
    modalBody.className = 'core-modal-body';

    // Ensamblar modal
    modalHeader.appendChild(modalTitle);
    modalHeader.appendChild(closeButton);
    modalContainer.appendChild(modalHeader);
    modalContainer.appendChild(modalBody);
    modalOverlay.appendChild(modalContainer);
    document.body.appendChild(modalOverlay);

    // Función para cerrar el modal
    const closeModal = function (e) {
      try {
        if (e) {
          e.preventDefault();
          e.stopPropagation();
        }

        // Remover event listeners
        document.removeEventListener('keydown', handleEsc);

        // Animar salida
        modalOverlay.classList.add('core-modal-fade-out');
        setTimeout(function () {
          if (modalOverlay && modalOverlay.parentNode) {
            modalOverlay.parentNode.removeChild(modalOverlay);
          }
        }, 300);
      } catch (error) {
        console.error('Error cerrando modal:', error);
        // Forzar eliminación si hay error
        if (modalOverlay && modalOverlay.parentNode) {
          modalOverlay.parentNode.removeChild(modalOverlay);
        }
      }
    };

    // Event listeners para cerrar
    closeButton.addEventListener(
      'click',
      function (e) {
        closeModal(e);
      },
      {
        capture: true,
        once: false,
      }
    );

    modalOverlay.addEventListener('click', function (e) {
      if (e.target === modalOverlay) {
        closeModal(e);
      }
    });

    // Cerrar con tecla ESC
    const handleEsc = function (e) {
      if (e.key === 'Escape') {
        closeModal();
      }
    };
    document.addEventListener('keydown', handleEsc);

    // Animaciones CSS movidas a estilos estáticos (CSP)
  },
};

// NotificationSystem - DISABLED: Ahora se carga desde notification-system.js
// El sistema moderno tiene mejor diseño visual y más funcionalidades
/*
(function () {
  // Inyectar estilos
  const style = document.createElement('style');
  const nonce = globalThis.SECURITY_NONCE || globalThis.NONCE || '';
  if (nonce) style.setAttribute('nonce', nonce);
  style.textContent = `
    .notification-container { position: fixed; z-index: 10000; max-width: 300px; top: 20px; right: 20px; }
    .notification { padding: 12px 16px; margin: 8px; border-radius: 8px; color: white; box-shadow: 0 4px 12px rgba(0,0,0,0.2); display: flex; align-items: center; animation: slideIn 0.3s ease-out; }
    .notification-icon { margin-right: 12px; font-size: 20px; }
    .notification-content { flex: 1; font-size: 14px; }
    .notification-close { background: none; border: none; color: inherit; cursor: pointer; font-size: 18px; margin-left: 8px; opacity: 0.7; padding: 0; }
    .notification-close:hover { opacity: 1; }
    .notification-success { background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%); }
    .notification-error { background: linear-gradient(135deg, #F44336 0%, #e53935 100%); }
    .notification-warning { background: linear-gradient(135deg, #FF9800 0%, #fb8c00 100%); }
    .notification-info { background: linear-gradient(135deg, #2196F3 0%, #1e88e5 100%); }
    @keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
  `;
  document.head.appendChild(style);

  // Crear contenedor
  function getContainer() {
    let container = document.getElementById('notification-container-main');
    if (!container) {
      container = document.createElement('div');
      container.id = 'notification-container-main';
      container.className = 'notification-container';
      document.body.appendChild(container);
    }
    return container;
  }

  // Mostrar notificación
  function show(message, type = 'info') {
    const icons = {
      success: '✅',
      error: '❌',
      warning: '⚠️',
      info: 'ℹ️',
    };
    const container = getContainer();
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;

    const icon = document.createElement('span');
    icon.className = 'notification-icon';
    icon.textContent = icons[type] || icons.info;

    const content = document.createElement('div');
    content.className = 'notification-content';
    content.textContent = message;

    const closeBtn = document.createElement('button');
    closeBtn.className = 'notification-close';
    closeBtn.textContent = '×';
    closeBtn.addEventListener('click', () => notification.remove());

    notification.appendChild(icon);
    notification.appendChild(content);
    notification.appendChild(closeBtn);
    container.appendChild(notification);

    setTimeout(() => notification.remove(), 5000);
  }

  // Exponer globalmente
  window.NotificationSystem = {
    show,
    success: msg => show(msg, 'success'),
    error: msg => show(msg, 'error'),
    warning: msg => show(msg, 'warning'),
    info: msg => show(msg, 'info'),
  };
  window.safeNotify = show;

  console.log('✅ NotificationSystem inicializado');
})();
*/

// Expose AdminDataManager globally if it exists in utils.js
if (typeof AdminDataManager !== 'undefined') {
  window.AdminDataManager = AdminDataManager;
}
