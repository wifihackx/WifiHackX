/**
 * Keyboard Shortcuts
 * Atajos de teclado con modal de ayuda
 */
'use strict';

function setupKeyboardShortcuts() {
  const shortcuts = new Map();

  const normalizeKey = key => {
    if (!key) return '';
    if (key.length === 1) {
      const lowered = key.toLowerCase();
      return lowered === '?' ? '/' : lowered;
    }
    return key.toLowerCase();
  };

  const buildShortcutKey = (key, modifiers) => {
    const parts = [];
    if (modifiers.ctrl) parts.push('ctrl');
    if (modifiers.alt) parts.push('alt');
    if (modifiers.shift) parts.push('shift');
    if (modifiers.meta) parts.push('meta');
    parts.push(normalizeKey(key));
    return parts.join('+');
  };

  const isEditableTarget = target => {
    if (!target) return false;
    if (target.isContentEditable) return true;
    const tag = target.tagName ? target.tagName.toLowerCase() : '';
    return tag === 'input' || tag === 'textarea' || tag === 'select';
  };

  const isVisible = element => {
    if (!element) return false;
    if (element.hasAttribute('hidden')) return false;
    if (element.getAttribute('aria-hidden') === 'true') return false;
    return element.offsetParent !== null;
  };

  const clickAction = action => {
    const target = document.querySelector(`[data-action="${action}"]`);
    if (!target || !isVisible(target)) return false;
    if (target.disabled || target.getAttribute('aria-disabled') === 'true') {
      return false;
    }
    target.click();
    return true;
  };

  const focusUserSearch = () => {
    const input = document.getElementById('userSearchInput');
    if (!input || !isVisible(input)) return false;
    input.focus();
    input.select?.();
    return true;
  };

  const getHelpModal = () => document.getElementById('shortcutsHelpModal');

  const toggleHelpModal = () => {
    const existing = getHelpModal();
    if (existing) {
      const isOpen = existing.getAttribute('aria-hidden') === 'false';
      if (isOpen) {
        existing.remove();
        return;
      }
      existing.remove();
    }

    const modal = createHelpModal();
    document.body.appendChild(modal);
    modal.setAttribute('aria-hidden', 'false');
    modal.classList.add('active');
  };

  const createHelpModal = () => {
    const modal = document.createElement('div');
    modal.id = 'shortcutsHelpModal';
    modal.className = 'modal-overlay';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-labelledby', 'shortcutsTitle');
    modal.setAttribute('aria-hidden', 'true');

    const shortcutsList = Array.from(shortcuts.values())
      .map(shortcut => {
        const keys = [];
        if (shortcut.modifiers.ctrl) keys.push('Ctrl');
        if (shortcut.modifiers.meta) keys.push('Cmd');
        if (shortcut.modifiers.alt) keys.push('Alt');
        if (shortcut.modifiers.shift) keys.push('Shift');
        keys.push(shortcut.key.toUpperCase());

        return `
          <div class="shortcut-item">
            <div class="shortcut-keys">
              ${keys.map(k => `<kbd>${k}</kbd>`).join(' + ')}
            </div>
            <div class="shortcut-description">${shortcut.description}</div>
          </div>
        `;
      })
      .join('');

    modal.innerHTML = `
      <div class="modal-content shortcuts-modal">
        <div class="modal-header">
          <h2 id="shortcutsTitle">Atajos de teclado</h2>
          <button class="modal-close-top" type="button" data-action="closeShortcutsHelp" aria-label="Cerrar modal">
            ×
          </button>
        </div>
        <div class="modal-body">
          <div class="shortcuts-list">
            ${shortcutsList}
          </div>
        </div>
      </div>
    `;

    modal
      .querySelector('[data-action="closeShortcutsHelp"]')
      .addEventListener('click', () => {
        modal.remove();
      });

    return modal;
  };

  const register = (key, callback, description, modifiers = {}) => {
    const shortcutKey = buildShortcutKey(key, modifiers);
    shortcuts.set(shortcutKey, {
      callback,
      description,
      key,
      modifiers,
    });
  };

  const handleKeyDown = event => {
    if (!event) return;
    if (isEditableTarget(event.target)) {
      return;
    }

    const modifiers = {
      ctrl: event.ctrlKey,
      alt: event.altKey,
      shift: event.shiftKey,
      meta: event.metaKey,
    };

    const shortcutKey = buildShortcutKey(event.key, modifiers);
    const shortcut = shortcuts.get(shortcutKey);
    if (!shortcut) return;

    const shouldPrevent = shortcut.callback(event);
    if (shouldPrevent !== false) {
      event.preventDefault();
    }
  };

  const registerDefaultShortcuts = () => {
    register(
      'k',
      () => focusUserSearch(),
      'Buscar usuarios',
      { ctrl: true }
    );
    register(
      'k',
      () => focusUserSearch(),
      'Buscar usuarios',
      { meta: true }
    );

    register(
      '/',
      () => toggleHelpModal(),
      'Mostrar atajos de teclado',
      { ctrl: true }
    );
    register(
      '/',
      () => toggleHelpModal(),
      'Mostrar atajos de teclado',
      { meta: true }
    );

    register(
      's',
      () => clickAction('saveSettings'),
      'Guardar configuracion',
      { ctrl: true }
    );
    register(
      's',
      () => clickAction('saveSettings'),
      'Guardar configuracion',
      { meta: true }
    );

    register(
      'p',
      () => clickAction('openAdmin'),
      'Abrir panel admin',
      { ctrl: true, shift: true }
    );
    register(
      'p',
      () => clickAction('openAdmin'),
      'Abrir panel admin',
      { meta: true, shift: true }
    );

    register(
      'c',
      () => clickAction('showCart'),
      'Abrir carrito',
      { ctrl: true, shift: true }
    );
    register(
      'c',
      () => clickAction('showCart'),
      'Abrir carrito',
      { meta: true, shift: true }
    );

    register(
      'l',
      () => clickAction('showLoginView'),
      'Abrir login',
      { ctrl: true, shift: true }
    );
    register(
      'l',
      () => clickAction('showLoginView'),
      'Abrir login',
      { meta: true, shift: true }
    );

    register(
      'm',
      () => clickAction('showAccessibilityPanel'),
      'Abrir accesibilidad',
      { ctrl: true, shift: true }
    );
    register(
      'm',
      () => clickAction('showAccessibilityPanel'),
      'Abrir accesibilidad',
      { meta: true, shift: true }
    );

    register(
      'h',
      () => clickAction('goHome'),
      'Ir a inicio',
      { ctrl: true, shift: true }
    );
    register(
      'h',
      () => clickAction('goHome'),
      'Ir a inicio',
      { meta: true, shift: true }
    );

    register(
      'o',
      () => clickAction('openScannerModal'),
      'Abrir scanner',
      { ctrl: true, shift: true }
    );
    register(
      'o',
      () => clickAction('openScannerModal'),
      'Abrir scanner',
      { meta: true, shift: true }
    );
  };

  registerDefaultShortcuts();
  document.addEventListener('keydown', handleKeyDown);
}

export function initKeyboardShortcuts() {
  if (window.__KEYBOARD_SHORTCUTS_INITED__) {
    return;
  }

  window.__KEYBOARD_SHORTCUTS_INITED__ = true;
  setupKeyboardShortcuts();
}

if (typeof window !== 'undefined' && !window.__KEYBOARD_SHORTCUTS_NO_AUTO__) {
  initKeyboardShortcuts();
}


