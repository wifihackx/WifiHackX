/**
 * Components bootstrap (safe, non-blocking)
 * Loads optional HTML components after DOM is ready.
 */
(function () {
  'use strict';

  function initComponents(retries = 10) {
    if (!window.templateLoader) {
      if (retries > 0) {
        return setTimeout(() => initComponents(retries - 1), 50);
      }
      console.warn('[Components] TemplateLoader not available');
      return;
    }

    // Header & footer components (safe)
    window.templateLoader.register(
      'header',
      '/components/header.html',
      'header-container'
    );

    // Footer component
    window.templateLoader.register(
      'footer',
      '/components/footer.html',
      'footer-container'
    );

    // Admin users section component
    window.templateLoader.register(
      'admin-users',
      '/components/admin-users-section.html',
      'users-section-container'
    );

    window.templateLoader
      .loadAll()
      .then(() => {
        // Remove fallback markup after components load (only if component loaded)
        const removeFallbackIfLoaded = (name, selector) => {
          if (!window.templateLoader?.getComponentStatus) return;
          const status = window.templateLoader.getComponentStatus(name);
          if (status && status.loaded) {
            document.querySelectorAll(selector).forEach(node => node.remove());
          }
        };

        removeFallbackIfLoaded('header', '[data-component-fallback="header"]');
        removeFallbackIfLoaded('footer', '[data-component-fallback="footer"]');
        removeFallbackIfLoaded(
          'admin-users',
          '[data-component-fallback="users-section"]'
        );

        // Re-render language options if header was injected after initial load
        if (window.LanguageOptionsGenerator?.render) {
          window.LanguageOptionsGenerator.render();
        } else {
          // Fallback: render when generator becomes available
          const retryRender = () => {
            if (window.LanguageOptionsGenerator?.render) {
              window.LanguageOptionsGenerator.render();
            } else {
              setTimeout(retryRender, 50);
            }
          };
          retryRender();
        }

        // Re-apply translations and selector state for injected elements
        if (window.AppState?.getState && window.LANGUAGE_CONFIG) {
          const currentLang =
            window.AppState.getState('i18n.currentLanguage') || 'es';
          if (window.applyTranslations) {
            window.applyTranslations(currentLang);
          }
          if (window.updateLanguageSelector) {
            const cfg = window.LANGUAGE_CONFIG[currentLang];
            if (cfg) {
              window.updateLanguageSelector(currentLang, cfg.name, cfg.flag);
            }
          }
        }

        // Re-init icons for injected markup
        if (window.IconManager?.initializeIcons) {
          window.IconManager.initializeIcons();
        } else if (window.lucide?.createIcons) {
          window.lucide.createIcons();
        }

        window.componentsReady = true;
        document.dispatchEvent(new CustomEvent('components:ready'));
      })
      .catch(error => {
        console.warn('[Components] Load failed', error);
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initComponents);
  } else {
    initComponents();
  }
})();
