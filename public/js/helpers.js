/**
 * helpers.js - Funciones auxiliares y utilidades
 * Funciones de herramientas, carrito, anuncios, accesibilidad
 */
/* eslint-disable no-unused-vars */

const debugLog = (...args) => {
  if (window.__WFX_DEBUG__ === true) {
    console.info(...args);
  }
};

// ============================================
// FUNCIONES DE CARRITO
// ============================================

function showCart() {
  const modal = document.getElementById('cartModal');
  if (modal) {
    modal.classList.add('active'); // CSS requires this for right: 0
    modal.classList.remove('modal-hide');
    window.DOMUtils.setDisplay(modal, 'block'); // Changed to block as flex might cause layout issues with some CSS versions
    window.DOMUtils.setVisibility(modal, true);
    window.DOMUtils.setOpacityClass(modal, '1');
    modal.setAttribute('aria-hidden', 'false');

    if (typeof loadCartContent === 'function') {
      loadCartContent();
    } else if (
      window.CartUI &&
      typeof CartUI.updateCartDisplay === 'function'
    ) {
      CartUI.updateCartDisplay(window.cart || []);
    }

    // Cerrar con ESC
    const cartEscapeHandler = function (e) {
      if (e.key === 'Escape') {
        closeCart();
        document.removeEventListener('keydown', cartEscapeHandler);
      }
    };
    document.addEventListener('keydown', cartEscapeHandler);

    // Cerrar al hacer clic fuera
    modal.addEventListener('click', e => {
      if (e.target === modal) {
        closeCart();
      }
    });
  }
}

function closeCart() {
  const modal = document.getElementById('cartModal');
  if (modal) {
    modal.classList.remove('active');
    modal.classList.add('modal-hide');
    setTimeout(() => {
      window.DOMUtils.setDisplay(modal, 'none');
      window.DOMUtils.setVisibility(modal, false);
      window.DOMUtils.setOpacityClass(modal, '0');
      modal.setAttribute('aria-hidden', 'true');
    }, 300); // Match transition time
  }
}

function loadCartContent() {
  const container = document.getElementById('cart-container');

  if (!container) return;

  // Usar CartManager si está disponible
  if (
    globalThis.CartManager &&
    typeof globalThis.CartManager.renderCartModal === 'function'
  ) {
    globalThis.CartManager.renderCartModal();
    return;
  }

  if (window.CartUI && typeof CartUI.updateCartDisplay === 'function') {
    CartUI.updateCartDisplay(window.cart || []);
    return;
  }

  container.innerHTML = '<p>Cargando carrito...</p>';
}

function clearCart() {
  if (globalThis.CartManager) {
    globalThis.CartManager.clear();
  }
}

function removeCartItem(index) {
  if (globalThis.CartManager && globalThis.CartManager.items) {
    const item = globalThis.CartManager.items[index];
    if (item) {
      globalThis.CartManager.removeItem(item.id);
    }
  }
}

function addToCart(productId) {
  debugLog('Agregando producto al carrito:', productId);
  if (globalThis.CartManager) {
    // Buscar producto y agregarlo
    // Esta función se puede expandir según necesidad
    globalThis.CartManager.addItem({
      id: productId,
    });
  }
}

// ============================================
// PANEL DE ACCESIBILIDAD
// ============================================
function toggleContrast(event) {
  const button = event.target.closest('[data-mode]');
  if (!button) return;

  const mode = button.dataset.mode;
  const body = document.body;

  // Remover todas las clases de contraste
  body.classList.remove('high-contrast', 'dark-mode', 'high-contrast-mode');

  // Aplicar el modo seleccionado
  if (mode !== 'normal') {
    body.classList.add(mode);
  }

  // Guardar preferencia
  localStorage.setItem('accessibilityContrast', mode);

  // Actualizar botones activos
  const panel = document.getElementById('accessibilityModal');
  if (panel) {
    panel.querySelectorAll('[data-action="setContrast"]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mode === mode);
    });
  }

  debugLog('[ACCESSIBILITY] Contrast mode set to:', mode);
}

function setFontSize(event) {
  const button = event.target.closest('[data-size]');
  if (!button) return;

  const size = button.dataset.size;
  const body = document.body;

  // Remover todas las clases de tamaño
  body.classList.remove(
    'font-small',
    'font-medium',
    'font-large',
    'font-size-small',
    'font-size-normal',
    'font-size-large',
    'font-size-extra-large'
  );

  // Aplicar el tamaño seleccionado
  body.classList.add(`font-${size}`);
  const sizeClassMap = {
    small: 'font-size-small',
    large: 'font-size-large',
    'extra-large': 'font-size-extra-large',
  };
  if (sizeClassMap[size]) {
    body.classList.add(sizeClassMap[size]);
  }

  // Guardar preferencia
  localStorage.setItem('accessibilityFontSize', size);

  // Actualizar botones activos
  const panel = document.getElementById('accessibilityModal');
  if (panel) {
    panel.querySelectorAll('[data-action="setFontSize"]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.size === size);
    });
  }

  debugLog('[ACCESSIBILITY] Font size set to:', size);
}

function toggleReducedMotion() {
  const body = document.body;

  body.classList.toggle('reduced-motion');

  const isEnabled = body.classList.contains('reduced-motion');
  localStorage.setItem('accessibilityReducedMotion', isEnabled);

  // Actualizar botón activo
  const panel = document.getElementById('accessibilityModal');
  if (panel) {
    const btn = panel.querySelector('[data-action="toggleReducedMotion"]');
    if (btn) {
      btn.classList.toggle('active', isEnabled);
    }
  }

  debugLog(
    '[ACCESSIBILITY] Reduced motion:',
    isEnabled ? 'enabled' : 'disabled'
  );
}

function toggleFocusOutline() {
  const body = document.body;

  body.classList.toggle('enhanced-focus');

  const isEnabled = body.classList.contains('enhanced-focus');
  localStorage.setItem('accessibilityFocusOutline', isEnabled);

  // Actualizar botón activo
  const panel = document.getElementById('accessibilityModal');
  if (panel) {
    const btn = panel.querySelector('[data-action="toggleFocusOutline"]');
    if (btn) {
      btn.classList.toggle('active', isEnabled);
    }
  }

  debugLog(
    '[ACCESSIBILITY] Enhanced focus outline:',
    isEnabled ? 'enabled' : 'disabled'
  );
}

function resetAccessibility() {
  const body = document.body;

  // Remover todas las clases de accesibilidad
  body.classList.remove(
    'high-contrast',
    'dark-mode',
    'high-contrast-mode',
    'font-small',
    'font-medium',
    'font-large',
    'font-size-small',
    'font-size-normal',
    'font-size-large',
    'font-size-extra-large',
    'reduced-motion',
    'enhanced-focus'
  );

  // Limpiar localStorage
  localStorage.removeItem('accessibilityContrast');
  localStorage.removeItem('accessibilityFontSize');
  localStorage.removeItem('accessibilityReducedMotion');
  localStorage.removeItem('accessibilityFocusOutline');

  // Restablecer botones activos
  const panel = document.getElementById('accessibilityModal');
  if (panel) {
    panel.querySelectorAll('.accessibility-option-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    // Activar valores por defecto
    const normalBtn = panel.querySelector('[data-mode="normal"]');
    const mediumBtn = panel.querySelector('[data-size="medium"]');
    if (normalBtn) normalBtn.classList.add('active');
    if (mediumBtn) mediumBtn.classList.add('active');
  }

  if (globalThis.NotificationSystem) {
    globalThis.NotificationSystem.success(
      'Configuración de accesibilidad restablecida'
    );
  }

  debugLog('[ACCESSIBILITY] Settings reset to defaults');
}

function loadAccessibilityPreferences() {
  const contrast = localStorage.getItem('accessibilityContrast') || 'normal';
  const fontSize = localStorage.getItem('accessibilityFontSize') || 'medium';
  const reducedMotion =
    localStorage.getItem('accessibilityReducedMotion') === 'true';
  const focusOutline =
    localStorage.getItem('accessibilityFocusOutline') === 'true';

  const body = document.body;

  // Limpiar clases previas para evitar estados mezclados
  body.classList.remove(
    'high-contrast',
    'dark-mode',
    'high-contrast-mode',
    'font-small',
    'font-medium',
    'font-large',
    'font-size-small',
    'font-size-normal',
    'font-size-large',
    'font-size-extra-large',
    'reduced-motion',
    'enhanced-focus'
  );

  // Aplicar contraste
  if (contrast !== 'normal') {
    body.classList.add(contrast);
  }

  // Aplicar tamaño de fuente
  body.classList.add(`font-${fontSize}`);
  const sizeClassMap = {
    small: 'font-size-small',
    large: 'font-size-large',
    'extra-large': 'font-size-extra-large',
  };
  if (sizeClassMap[fontSize]) {
    body.classList.add(sizeClassMap[fontSize]);
  }

  // Aplicar movimiento reducido
  if (reducedMotion) {
    body.classList.add('reduced-motion');
  }

  // Aplicar contorno de foco
  if (focusOutline) {
    body.classList.add('enhanced-focus');
  }

  // Sincronizar botones del modal si está disponible
  const panel = document.getElementById('accessibilityModal');
  if (panel) {
    panel
      .querySelectorAll('[data-action="setContrast"]')
      .forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === contrast);
      });
    panel
      .querySelectorAll('[data-action="setFontSize"]')
      .forEach(btn => {
        btn.classList.toggle('active', btn.dataset.size === fontSize);
      });

    const reducedMotionBtn = panel.querySelector(
      '[data-action="toggleReducedMotion"]'
    );
    if (reducedMotionBtn) {
      reducedMotionBtn.classList.toggle('active', reducedMotion);
    }

    const focusOutlineBtn = panel.querySelector(
      '[data-action="toggleFocusOutline"]'
    );
    if (focusOutlineBtn) {
      focusOutlineBtn.classList.toggle('active', focusOutline);
    }
  }

  debugLog('[ACCESSIBILITY] Preferences loaded:', {
    contrast,
    fontSize,
    reducedMotion,
    focusOutline,
  });
}

// ============================================
// EXPONER FUNCIONES GLOBALMENTE
// ============================================

// Exponer utilidades seleccionadas
globalThis.showCart = showCart;
globalThis.closeCart = closeCart;
globalThis.loadCartContent = loadCartContent;
globalThis.clearCart = clearCart;
globalThis.removeCartItem = removeCartItem;
globalThis.addToCart = addToCart;
globalThis.toggleContrast = toggleContrast;
globalThis.setFontSize = setFontSize;
globalThis.toggleReducedMotion = toggleReducedMotion;
globalThis.toggleFocusOutline = toggleFocusOutline;
globalThis.resetAccessibility = resetAccessibility;
globalThis.loadAccessibilityPreferences = loadAccessibilityPreferences;

// Asegurar que se apliquen preferencias al cargar la página
try {
  loadAccessibilityPreferences();
} catch (_err) {}

