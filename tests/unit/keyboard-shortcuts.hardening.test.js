import { beforeEach, describe, expect, it, vi } from 'vitest';

const loadModule = async path => import(`${path}?t=${Date.now()}_${Math.random()}`);

describe('keyboard-shortcuts hardening', () => {
  beforeEach(() => {
    vi.resetModules();
    window.__KEYBOARD_SHORTCUTS_INITED__ = false;
    window.__KEYBOARD_SHORTCUTS_NO_AUTO__ = true;
    delete window.KeyboardShortcuts;
    document.body.innerHTML = `
      <button type="button" data-action='showLoginView" ] bad'>Open</button>
    `;
  });

  it('matches actions by exact data attribute value without building selectors', async () => {
    const target = document.querySelector('[data-action]');
    target.click = vi.fn();
    Object.defineProperty(target, 'offsetParent', {
      configurable: true,
      get: () => document.body,
    });

    const mod = await loadModule('../../src/js/keyboard-shortcuts.js');
    mod.initKeyboardShortcuts();

    document.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'l',
        ctrlKey: true,
        shiftKey: true,
        bubbles: true,
      })
    );

    expect(target.click).toHaveBeenCalledTimes(0);
  });

  it('renders shortcut descriptions as text in the help modal', async () => {
    const mod = await loadModule('../../src/js/keyboard-shortcuts.js');
    mod.initKeyboardShortcuts();
    window.KeyboardShortcuts.showHelp();

    const descriptions = Array.from(document.querySelectorAll('.shortcut-description'));
    expect(descriptions.length).toBeGreaterThan(0);
    descriptions.forEach(node => {
      expect(node.querySelector('img')).toBeNull();
    });
    expect(document.querySelector('.shortcut-description')?.textContent).toContain('Buscar');
  });
});
