/**
 * footer-navigation-spa.js
 * Navegación interna del footer en misma pestaña, preserva el idioma seleccionado.
 */
function setupFooterNavigation() {
  function getCurrentLanguage() {
    try {
      return localStorage.getItem('selectedLanguage') || 'es';
    } catch (_e) {
      return 'es';
    }
  }

  function saveLanguage() {
    const lang = getCurrentLanguage();
    try {
      sessionStorage.setItem('returnLanguage', lang);
    } catch (_e) {}
  }

  function isInternalHtmlLink(href) {
    if (!href || href.startsWith('mailto:') || href.startsWith('tel:'))
      return false;

    // Links absolutos
    if (/^https?:\/\//i.test(href)) {
      try {
        const url = new URL(href, window.location.origin);
        if (url.origin !== window.location.origin) return false;
        return url.pathname.endsWith('.html');
      } catch (_e) {
        return false;
      }
    }

    // Links relativos internos a .html
    return href.endsWith('.html');
  }

  function init() {
    const links = document.querySelectorAll('.footer-link');
    if (!links || links.length === 0) return;

    links.forEach(link => {
      link.addEventListener(
        'click',
        function (e) {
          const href = this.getAttribute('href');
          if (!isInternalHtmlLink(href)) return;

          e.preventDefault();
          e.stopPropagation();

          saveLanguage();
          window.location.href = href;
        },
        { passive: false }
      );
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}

export function initFooterNavigation() {
  if (window.__FOOTER_NAVIGATION_INITED__) {
    return;
  }

  window.__FOOTER_NAVIGATION_INITED__ = true;
  setupFooterNavigation();
}

if (typeof window !== 'undefined' && !window.__FOOTER_NAVIGATION_NO_AUTO__) {
  initFooterNavigation();
}
