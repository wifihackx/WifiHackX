/**
 * ui-interactions.js
 * Maneja interacciones de UI: selector de idiomas y panel de accesibilidad
 */

'use strict';

const debugLog = (...args) => {
  if (window.__WFX_DEBUG__ === true) {
    console.info(...args);
  }
};

function setupUiInteractions() {
  const uiBindings = {
    languageToggle: null,
    languageToggleHandler: null,
    languageDropdownObserved: null,
    languageDropdownObserver: null,
    accessibilityCloseBtn: null,
    accessibilityCloseBtnHandler: null,
  };

  // Fallback del logger
  const logSystem = window.Logger || {
    info: (m, c) => debugLog(`[${c}] ${m}`),
    warn: (m, c) => console.warn(`[${c}] ${m}`),
    error: (m, c, d) => console.error(`[${c}] ${m}`, d),
    debug: (m, c) => debugLog(`[DEBUG][${c}] ${m}`),
    startGroup: (n, e) => console.group(`${e || ''} ${n}`),
    endGroup: () => console.groupEnd(),
  };
  const CAT = window.LOG_CATEGORIES || {
    UI: 'UI',
    INIT: 'INIT',
    ERR: 'ERR',
  };

  logSystem.info('Inicializando interacciones...', CAT.INIT);

  function initActionDelegates() {
    document.addEventListener('click', function (e) {
      const target = e.target instanceof Element ? e.target : null;
      if (!target) return;

      // Accessibility modal backdrop close.
      const accessibilityModal = document.getElementById('accessibilityModal');
      if (accessibilityModal && target === accessibilityModal) {
        if (window.ModalManager && typeof window.ModalManager.close === 'function') {
          window.ModalManager.close(accessibilityModal);
        } else {
          accessibilityModal.classList.remove('active', 'modal-visible', 'show');
          accessibilityModal.setAttribute('aria-hidden', 'true');
          if (window.DOMUtils && typeof window.DOMUtils.setDisplay === 'function') {
            window.DOMUtils.setDisplay(accessibilityModal, 'none');
          }
        }
        return;
      }

      // Password input toggle (merged here to keep a single document click listener).
      const toggleBtn = target.closest('.toggle-password');
      if (toggleBtn) {
        e.preventDefault();
        const wrapper = toggleBtn.closest('.password-input-wrapper');
        const input = wrapper ? wrapper.querySelector('input') : null;
        if (!input) return;
        const isPassword = input.type === 'password';
        input.type = isPassword ? 'text' : 'password';
        toggleBtn.setAttribute('aria-pressed', !isPassword);
        const eyeIcon = toggleBtn.querySelector('.eye-icon');
        const eyeOffIcon = toggleBtn.querySelector('.eye-off-icon');
        if (eyeIcon && eyeOffIcon) {
          eyeIcon.classList.toggle('hidden', !isPassword);
          eyeOffIcon.classList.toggle('hidden', isPassword);
        }
        return;
      }

      const el = target.closest('[data-action]');
      if (!el) return;

      const action = el.dataset.action;
      try {
        // Admin interactions
        if (
          action === 'openAdmin' &&
          typeof globalThis.showAdminView === 'function'
        ) {
          e.preventDefault();
          globalThis.showAdminView();
          return;
        }
        if (action === 'goHome' && typeof globalThis.goToMain === 'function') {
          e.preventDefault();
          globalThis.goToMain();
          return;
        }

        // General UI actions
        if (action === 'showCart') {
          e.preventDefault();
          if (typeof globalThis.showCart === 'function') {
            globalThis.showCart();
          } else if (window.CartManager && window.CartManager.current) {
            if (
              typeof window.CartManager.current.showCartModal === 'function'
            ) {
              window.CartManager.current.showCartModal();
            } else if (
              typeof window.CartManager.current.toggleCart === 'function'
            ) {
              window.CartManager.current.toggleCart();
            }
          } else if (
            window.CartManager &&
            typeof window.CartManager.showCartModal === 'function'
          ) {
            window.CartManager.showCartModal();
          } else {
            logSystem.warn('No cart handler available', CAT.UI);
          }
          return;
        }

        if (
          action === 'showLoginView' &&
          typeof globalThis.showLoginView === 'function'
        ) {
          e.preventDefault();
          globalThis.showLoginView();
          return;
        }

        // NOTE: Accessibility actions are centralized in common-handlers/EventDelegation.

        // Safe actions
        if (
          action === 'safeView' &&
          typeof globalThis.handleSafeView === 'function'
        ) {
          e.preventDefault();
          globalThis.handleSafeView(el);
          return;
        }
        if (
          action === 'safeEdit' &&
          typeof globalThis.handleSafeEdit === 'function'
        ) {
          e.preventDefault();
          globalThis.handleSafeEdit(el);
          return;
        }
        if (
          action === 'safeDelete' &&
          typeof globalThis.handleSafeDelete === 'function'
        ) {
          e.preventDefault();
          globalThis.handleSafeDelete(el);
          return;
        }

        // Admin Announcement Actions
        if (action === 'adminViewAnnouncement') {
          e.preventDefault();
          if (
            globalThis.adminAnnouncementsRenderer &&
            typeof globalThis.adminAnnouncementsRenderer.viewAnnouncement ===
              'function'
          ) {
            globalThis.adminAnnouncementsRenderer.viewAnnouncement(
              el.dataset.id
            );
          }
          return;
        }

        if (action === 'adminEditAnnouncement') {
          e.preventDefault();
          if (
            globalThis.adminAnnouncementsRenderer &&
            typeof globalThis.adminAnnouncementsRenderer.editAnnouncement ===
              'function'
          ) {
            globalThis.adminAnnouncementsRenderer.editAnnouncement(
              el.dataset.id
            );
          }
          return;
        }

        if (action === 'adminDeleteAnnouncement') {
          e.preventDefault();
          if (
            globalThis.adminAnnouncementsRenderer &&
            typeof globalThis.adminAnnouncementsRenderer.deleteAnnouncement ===
              'function'
          ) {
            globalThis.adminAnnouncementsRenderer.deleteAnnouncement(
              el.dataset.id
            );
          }
          return;
        }

        // Reload Actions
        if (
          action === 'reloadAdminAnnouncements' &&
          globalThis.adminAnnouncementsRenderer &&
          typeof globalThis.adminAnnouncementsRenderer.renderAll === 'function'
        ) {
          e.preventDefault();
          globalThis.adminAnnouncementsRenderer.renderAll();
          return;
        }
      } catch (err) {
        logSystem.warn(`Error handling action: ${action}`, CAT.UI, err);
      }
    });
  }

  function initLanguageSelector(force = false) {
    const languageToggle = document.getElementById('languageToggle');
    const languageDropdown = document.getElementById('languageDropdown');

    if (!languageToggle || !languageDropdown) {
      logSystem.warn(
        'Elementos del selector de idiomas no encontrados',
        CAT.UI
      );
      return;
    }

    if (
      !force &&
      uiBindings.languageToggle === languageToggle &&
      typeof uiBindings.languageToggleHandler === 'function'
    ) {
      return;
    }

    if (
      uiBindings.languageToggle &&
      uiBindings.languageToggle !== languageToggle &&
      typeof uiBindings.languageToggleHandler === 'function'
    ) {
      uiBindings.languageToggle.removeEventListener(
        'click',
        uiBindings.languageToggleHandler
      );
    }

    if (
      uiBindings.languageToggle !== languageToggle ||
      typeof uiBindings.languageToggleHandler !== 'function'
    ) {
      uiBindings.languageToggleHandler = function (e) {
        e.stopPropagation();
        const isExpanded = languageToggle.getAttribute('aria-expanded') === 'true';
        const newState = !isExpanded;
        languageToggle.setAttribute('aria-expanded', newState);
        languageDropdown.classList.toggle('show', newState);
        window.DOMUtils.setDisplay(
          languageDropdown,
          newState ? 'block' : 'none'
        );

        if (newState) {
          ensureLanguageOptionsLoaded().catch(() => {});
        }
      };
      languageToggle.addEventListener('click', uiBindings.languageToggleHandler);
      uiBindings.languageToggle = languageToggle;
    }
    languageToggle.dataset.uiBound = 'true';

    if (!document.documentElement.dataset.langDocBound) {
      document.documentElement.dataset.langDocBound = 'true';
      document.addEventListener('click', function (e) {
        const toggle = e.target.closest('.language-toggle');
        if (toggle) {
          e.stopPropagation();
          const selector = toggle.closest('.language-selector');
          const dropdown = selector
            ? selector.querySelector('.language-dropdown')
            : null;
          if (!dropdown) return;
          const isExpanded = toggle.getAttribute('aria-expanded') === 'true';
          const newState = !isExpanded;
          toggle.setAttribute('aria-expanded', newState);
          selector.classList.toggle('open', newState);
          dropdown.classList.toggle('show', newState);
          window.DOMUtils.setDisplay(dropdown, newState ? 'block' : 'none');
          if (newState) {
            ensureLanguageOptionsLoaded().catch(() => {});
          }
          return;
        }

        // Close any open dropdowns if click outside
        if (!e.target.closest('.language-selector')) {
          document.querySelectorAll('.language-toggle').forEach(btn => {
            btn.setAttribute('aria-expanded', 'false');
          });
          document.querySelectorAll('.language-selector').forEach(sel => {
            sel.classList.remove('open');
          });
          document.querySelectorAll('.language-dropdown').forEach(drop => {
            drop.classList.remove('show');
            window.DOMUtils.setDisplay(drop, 'none');
          });
        }
      });
    }

    if (window.EventDelegationManager) {
      window.EventDelegationManager.register(
        'select-language',
        (target, _event) => {
          const option = target.closest('.language-option');
          if (!option) return;
          const lang = option.dataset.lang;
          logSystem.info(
            `Language selected via EventDelegationManager: ${lang}`,
            CAT.UI
          );
          if (lang && typeof window.changeLanguage === 'function') {
            window.changeLanguage(lang);
          }
          languageToggle.setAttribute('aria-expanded', 'false');
          languageDropdown.classList.remove('show');
          window.DOMUtils.setDisplay(languageDropdown, 'none');
        }
      );

      if (uiBindings.languageDropdownObserved !== languageDropdown) {
        if (uiBindings.languageDropdownObserver) {
          uiBindings.languageDropdownObserver.disconnect();
        }
        uiBindings.languageDropdownObserver = new MutationObserver(() => {
          document
            .querySelectorAll('.language-option:not([data-action])')
            .forEach(option => {
              option.setAttribute('data-action', 'select-language');
            });
        });
        uiBindings.languageDropdownObserver.observe(languageDropdown, {
          childList: true,
          subtree: true,
        });
        uiBindings.languageDropdownObserved = languageDropdown;
      }
      document.querySelectorAll('.language-option').forEach(option => {
        option.setAttribute('data-action', 'select-language');
      });
    }
  }

  function ensureLanguageOptionsLoaded() {
    if (window.LanguageOptionsGenerator) {
      window.LanguageOptionsGenerator.render();
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      const existing = document.querySelector(
        'script[src*="language-options-generator.js"]'
      );
      if (existing) {
        existing.addEventListener('load', () => resolve());
        existing.addEventListener('error', () =>
          reject(new Error('Failed to load language-options-generator.js'))
        );
        return;
      }

      const script = document.createElement('script');
      script.src = 'js/language-options-generator.js';
      script.defer = true;
      const nonce = window.SECURITY_NONCE || window.NONCE;
      if (nonce) {
        script.nonce = nonce;
      }
      script.onload = () => {
        if (window.LanguageOptionsGenerator) {
          window.LanguageOptionsGenerator.render();
        }
        resolve();
      };
      script.onerror = () =>
        reject(new Error('Failed to load language-options-generator.js'));
      document.body.appendChild(script);
    });
  }

  function initAccessibilityPanel() {
    // Asegurar que el modal no se abra al iniciar
    const initialModal = document.getElementById('accessibilityModal');
    if (initialModal) {
      initialModal.classList.remove('active', 'modal-visible', 'show');
      initialModal.setAttribute('aria-hidden', 'true');
      if (window.DOMUtils && typeof window.DOMUtils.setDisplay === 'function') {
        window.DOMUtils.setDisplay(initialModal, 'none');
      }
    }
    try {
      if (window.AppState && window.AppState.getState) {
        const activeModal = window.AppState.getState('modal.active');
        if (activeModal === 'accessibilityModal') {
          window.AppState.setState('modal.active', null, true);
          window.AppState.setState('modal.data', null, true);
          try {
            localStorage.removeItem('modal.active');
            localStorage.removeItem('modal.data');
          } catch (_e) {}
        }
      }
    } catch (_err) {}

    if (typeof globalThis.loadAccessibilityPreferences === 'function') {
      try {
        globalThis.loadAccessibilityPreferences();
      } catch (_err) {}
    }

    // Accessibility action handlers are registered once in common-handlers.js.

    const closeBtn = document.querySelector(
      '#accessibilityModal [data-action="closeAccessibilityPanel"]'
    );
    if (
      uiBindings.accessibilityCloseBtn &&
      uiBindings.accessibilityCloseBtn !== closeBtn &&
      typeof uiBindings.accessibilityCloseBtnHandler === 'function'
    ) {
      uiBindings.accessibilityCloseBtn.removeEventListener(
        'click',
        uiBindings.accessibilityCloseBtnHandler
      );
      uiBindings.accessibilityCloseBtn = null;
      uiBindings.accessibilityCloseBtnHandler = null;
    }
    if (closeBtn && !window.EventDelegationManager) {
      uiBindings.accessibilityCloseBtnHandler = e => {
        e.preventDefault();
        const modal = document.getElementById('accessibilityModal');
        if (!modal) return;
        if (window.ModalManager && typeof window.ModalManager.close === 'function') {
          window.ModalManager.close(modal);
        } else {
          modal.classList.remove('active', 'modal-visible', 'show');
          modal.setAttribute('aria-hidden', 'true');
          if (window.DOMUtils && typeof window.DOMUtils.setDisplay === 'function') {
            window.DOMUtils.setDisplay(modal, 'none');
          }
        }
        logSystem.info('Accessibility panel closed (direct handler)', CAT.UI);
      };
      closeBtn.addEventListener('click', uiBindings.accessibilityCloseBtnHandler);
      uiBindings.accessibilityCloseBtn = closeBtn;
    }
  }

  function initKeyboardActions() {
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        const modal = document.getElementById('accessibilityModal');
        if (modal && modal.classList.contains('active')) {
          const closeHandler = window.EventDelegationManager
            ? window.EventDelegationManager.handlers.get(
                'closeAccessibilityPanel'
              )
            : null;
          if (closeHandler) {
            closeHandler(null, null);
          } else {
            modal.classList.remove('active', 'modal-visible', 'show');
            modal.setAttribute('aria-hidden', 'true');
            if (window.DOMUtils && typeof window.DOMUtils.setDisplay === 'function') {
              window.DOMUtils.setDisplay(modal, 'none');
            }
          }
        }
        return;
      }

      // Solo procesar Enter y Space en elementos con data-action
      if (e.key !== 'Enter' && e.key !== ' ') return;

      const el = e.target.closest('[data-action]');
      if (!el) return;

      // Prevenir scroll con Space
      if (e.key === ' ') {
        e.preventDefault();
      }

      // Simular click
      el.click();
    });
  }

  function init() {
    logSystem.startGroup('UI Initialization', CAT.INIT);
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        initLanguageSelector();
        initAccessibilityPanel();
        initActionDelegates();
        initKeyboardActions();
        logSystem.endGroup('UI Initialization');
      });
    } else {
      initLanguageSelector();
      initAccessibilityPanel();
      initActionDelegates();
      initKeyboardActions();
      logSystem.endGroup('UI Initialization');
    }

    // Re-init language selector after components load (header injected)
    document.addEventListener('components:ready', () => {
      initLanguageSelector(true);
    });

    // If components already loaded before listener was attached
    if (window.componentsReady) {
      initLanguageSelector(true);
    }
  }

  init();
}

export function initUiInteractions() {
  if (window.__UI_INTERACTIONS_INITED__) {
    return;
  }

  window.__UI_INTERACTIONS_INITED__ = true;
  setupUiInteractions();
}

if (typeof window !== 'undefined' && !window.__UI_INTERACTIONS_NO_AUTO__) {
  initUiInteractions();
}



