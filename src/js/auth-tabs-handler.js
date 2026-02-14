/**
 * Auth Tabs Handler
 * Maneja el cambio entre pestañas de Login, Registro y Recuperación
 * @version 1.0.1 - Fixed: Wait for modal to be in DOM
 */

export function initAuthTabs() {
  'use strict';

  if (window.__AUTH_TABS_INITED__) {
    return;
  }
  window.__AUTH_TABS_INITED__ = true;

  console.log('[AUTH_TABS] Script loaded');

  const initAuthTabs = () => {
    console.log('[AUTH_TABS] Attempting to initialize...');

    const tabs = document.querySelectorAll('.auth-tab-new');
    const forms = {
      login: document.getElementById('loginForm'),
      register: document.getElementById('registerForm'),
      reset: document.getElementById('resetForm'),
    };

    console.log('[AUTH_TABS] Found tabs:', tabs.length);
    console.log('[AUTH_TABS] Found forms:', {
      login: !!forms.login,
      register: !!forms.register,
      reset: !!forms.reset,
    });

    if (tabs.length === 0) {
      console.warn('[AUTH_TABS] No tabs found, will retry...');
      // Retry after a delay in case modal is not in DOM yet
      setTimeout(initAuthTabs, 500);
      return;
    }

    if (!forms.login || !forms.register || !forms.reset) {
      console.warn('[AUTH_TABS] Not all forms found, will retry...');
      setTimeout(initAuthTabs, 500);
      return;
    }

    console.log('[AUTH_TABS] All elements found, setting up handlers');

    // Función para cambiar de pestaña
    const switchTab = tabName => {
      console.log('[AUTH_TABS] Switching to tab:', tabName);

      // Actualizar estado de las pestañas
      tabs.forEach(tab => {
        const isActive = tab.dataset.tab === tabName;
        tab.classList.toggle('active', isActive);
        tab.setAttribute('aria-selected', isActive);
        tab.setAttribute('tabindex', isActive ? '0' : '-1');
      });

      // Mostrar/ocultar formularios
      Object.keys(forms).forEach(formName => {
        const form = forms[formName];
        if (form) {
          const isActive = formName === tabName;
          console.log(
            `[AUTH_TABS] Form ${formName}: ${isActive ? 'SHOW' : 'HIDE'}`
          );

          if (isActive) {
            form.removeAttribute('hidden');
            form.setAttribute('aria-hidden', 'false');
            form.classList.add('active'); // Add active class for CSS
            window.DOMUtils.setDisplay(form, ''); // Ensure display is not none
          } else {
            form.setAttribute('hidden', '');
            form.setAttribute('aria-hidden', 'true');
            form.classList.remove('active'); // Remove active class for CSS
          }
        }
      });

      console.log('[AUTH_TABS] Tab switch complete:', tabName);
    };

    // Agregar event listeners a las pestañas
    tabs.forEach(tab => {
      tab.addEventListener('click', e => {
        e.preventDefault();
        const tabName = tab.dataset.tab;
        console.log('[AUTH_TABS] Tab clicked:', tabName);
        if (tabName) {
          switchTab(tabName);
        }
      });

      // Soporte para navegación con teclado
      tab.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          const tabName = tab.dataset.tab;
          if (tabName) {
            switchTab(tabName);
          }
        }
      });
    });

    // Inicializar con la pestaña de login activa
    switchTab('login');

    console.log('[AUTH_TABS] ✅ Handler initialized successfully');
  };

  // Inicializar cuando el DOM esté listo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAuthTabs);
  } else {
    // DOM already loaded, try to initialize
    initAuthTabs();
  }
}
