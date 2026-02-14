/**
 * ui-interactions.js
 * Maneja interacciones de UI: selector de idiomas y panel de accesibilidad
 */

'use strict';

function setupUiInteractions() {

  // Fallback del logger
  const logSystem = window.Logger || {
    info: (m, c) => console.log(`[${c}] ${m}`),
    warn: (m, c) => console.warn(`[${c}] ${m}`),
    error: (m, c, d) => console.error(`[${c}] ${m}`, d),
    debug: (m, c) => console.log(`[DEBUG][${c}] ${m}`),
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
      const el = e.target.closest('[data-action]');
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

        // NOTE: showAccessibilityPanel and closeAccessibilityPanel are handled by EventDelegationManager
        // in initAccessibilityPanel() to avoid duplicate handlers

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

    if (!force && languageToggle.dataset.uiBound === 'true') {
      return;
    }

    languageToggle.dataset.uiBound = 'true';

    languageToggle.addEventListener('click', function (e) {
      e.stopPropagation();
      const isExpanded = this.getAttribute('aria-expanded') === 'true';
      const newState = !isExpanded;
      this.setAttribute('aria-expanded', newState);
      languageDropdown.classList.toggle('show', newState);
      window.DOMUtils.setDisplay(languageDropdown, newState ? 'block' : 'none');

      if (newState) {
        ensureLanguageOptionsLoaded().catch(() => {});
      }
    });

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

      if (!languageDropdown.dataset.langObserver) {
        const observer = new MutationObserver(() => {
          document
            .querySelectorAll('.language-option:not([data-action])')
            .forEach(option => {
              option.setAttribute('data-action', 'select-language');
            });
        });
        observer.observe(languageDropdown, {
          childList: true,
          subtree: true,
        });
        languageDropdown.dataset.langObserver = 'true';
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

    if (window.EventDelegationManager) {
      window.EventDelegationManager.register(
        'showAccessibilityPanel',
        (target, event) => {
          if (event) event.preventDefault();
          const modal = document.getElementById('accessibilityModal');
          if (modal) {
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
            logSystem.info(
              'Accessibility panel opened via EventDelegationManager',
              CAT.UI
            );
          }
        }
      );

      window.EventDelegationManager.register(
        'closeAccessibilityPanel',
        (target, event) => {
          if (event) event.preventDefault();
          const modal = document.getElementById('accessibilityModal');
          if (modal) {
            if (window.ModalManager && typeof window.ModalManager.close === 'function') {
              window.ModalManager.close(modal);
            } else {
              modal.classList.remove('active', 'modal-visible', 'show');
              modal.setAttribute('aria-hidden', 'true');
              if (window.DOMUtils && typeof window.DOMUtils.setDisplay === 'function') {
                window.DOMUtils.setDisplay(modal, 'none');
              }
            }
            logSystem.info(
              'Accessibility panel closed via EventDelegationManager',
              CAT.UI
            );
          }
        }
      );

      window.EventDelegationManager.register('setContrast', (target, event) => {
        if (typeof globalThis.toggleContrast === 'function') {
          globalThis.toggleContrast(
            event || {
              target,
            }
          );
        }
      });

      window.EventDelegationManager.register('setFontSize', (target, event) => {
        if (typeof globalThis.setFontSize === 'function') {
          globalThis.setFontSize(
            event || {
              target,
            }
          );
        }
      });

      window.EventDelegationManager.register(
        'toggleReducedMotion',
        (target, event) => {
          if (event) event.preventDefault();
          if (typeof globalThis.toggleReducedMotion === 'function') {
            globalThis.toggleReducedMotion();
          }
        }
      );

      window.EventDelegationManager.register(
        'toggleFocusOutline',
        (target, event) => {
          if (event) event.preventDefault();
          if (typeof globalThis.toggleFocusOutline === 'function') {
            globalThis.toggleFocusOutline();
          }
        }
      );

      window.EventDelegationManager.register(
        'resetAccessibility',
        (target, event) => {
          if (event) event.preventDefault();
          if (typeof globalThis.resetAccessibility === 'function') {
            globalThis.resetAccessibility();
          }
        }
      );
    }

    document.addEventListener('click', function (e) {
      const modal = document.getElementById('accessibilityModal');
      if (modal && e.target === modal) {
        const closeHandler = window.EventDelegationManager
          ? window.EventDelegationManager.handlers.get(
              'closeAccessibilityPanel'
            )
          : null;
        if (closeHandler) closeHandler(null, null);
        else {
          modal.classList.remove('active', 'modal-visible', 'show');
          modal.setAttribute('aria-hidden', 'true');
          if (window.DOMUtils && typeof window.DOMUtils.setDisplay === 'function') {
            window.DOMUtils.setDisplay(modal, 'none');
          }
        }
      }
    });

    const closeBtn = document.querySelector(
      '#accessibilityModal [data-action="closeAccessibilityPanel"]'
    );
    if (closeBtn) {
      closeBtn.addEventListener('click', e => {
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
      });
    }

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        const modal = document.getElementById('accessibilityModal');
        if (modal && modal.classList.contains('active')) {
          const closeHandler = window.EventDelegationManager
            ? window.EventDelegationManager.handlers.get(
                'closeAccessibilityPanel'
              )
            : null;
          if (closeHandler) closeHandler(null, null);
          else {
            modal.classList.remove('active', 'modal-visible', 'show');
            modal.setAttribute('aria-hidden', 'true');
            if (window.DOMUtils && typeof window.DOMUtils.setDisplay === 'function') {
              window.DOMUtils.setDisplay(modal, 'none');
            }
          }
        }
      }
    });
  }

  function initPasswordToggles() {
    document.addEventListener('click', function (e) {
      const toggleBtn = e.target.closest('.toggle-password');
      if (!toggleBtn) return;
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
    });
  }

  function initKeyboardActions() {
    document.addEventListener('keydown', function (e) {
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
        initPasswordToggles();
        initActionDelegates();
        initKeyboardActions();
        logSystem.endGroup('UI Initialization');
      });
    } else {
      initLanguageSelector();
      initAccessibilityPanel();
      initPasswordToggles();
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
