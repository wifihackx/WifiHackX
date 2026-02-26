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

  let retryCount = 0;
  const MAX_RETRIES = 8;
  let templateListenerBound = false;

  const initAuthTabs = () => {
    const tabs = document.querySelectorAll('.auth-tab-new');
    const forms = {
      login: document.getElementById('loginForm'),
      register: document.getElementById('registerForm'),
      reset: document.getElementById('resetForm'),
    };
    const loginView = document.getElementById('loginView');
    const templateLoaded = loginView?.dataset?.templateLoaded === '1';

    if (tabs.length === 0) {
      if (!templateLoaded) {
        if (!templateListenerBound) {
          templateListenerBound = true;
          window.addEventListener(
            'loginView:templateLoaded',
            () => {
              retryCount = 0;
              initAuthTabs();
            },
            { once: true }
          );
        }
        return;
      }
      if (retryCount < MAX_RETRIES) {
        retryCount += 1;
        setTimeout(initAuthTabs, 250);
      }
      return;
    }

    if (!forms.login || !forms.register || !forms.reset) {
      if (retryCount < MAX_RETRIES) {
        retryCount += 1;
        setTimeout(initAuthTabs, 250);
      }
      return;
    }
    retryCount = 0;

    // Función para cambiar de pestaña
    const switchTab = tabName => {
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

      console.info('[AUTH_TABS] Tab switch complete:', tabName);
    };

    // Agregar event listeners a las pestañas
    tabs.forEach(tab => {
      tab.addEventListener('click', e => {
        e.preventDefault();
        const tabName = tab.dataset.tab;
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
  };

  // Inicializar cuando el DOM esté listo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAuthTabs);
  } else {
    // DOM already loaded, try to initialize
    initAuthTabs();
  }
}

if (typeof window !== 'undefined' && !window.__AUTH_TABS_NO_AUTO__) {
  initAuthTabs();
}
