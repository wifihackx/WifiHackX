/**
 * managers.js - Gestores y utilidades de la aplicación
 * ImageManager, BreadcrumbManager, viewConfig
 */

// View Configuration for Breadcrumbs
const viewConfig = {
  homeView: {
    name: 'Inicio',
    icon: 'home',
  },
  adminView: {
    name: 'Panel de Administración',
    icon: 'shield',
  },
  catalogView: {
    name: 'Catálogo',
    icon: 'shopping-bag',
  },
  loginView: {
    name: 'Iniciar Sesión',
    icon: 'log-in',
  },
};

// Image Optimization and Alt Text Management
const ImageManager = {
  // Enhanced alt text for different image types
  getAltText(imageSrc, context = '') {
    const altTexts = {
      '4.png':
        'Dashboard de herramientas de auditoría de ciberseguridad WiFi mostrando interfaz profesional de análisis de redes inalámbricas con gráficos de señal, dispositivos conectados y métricas de seguridad',
      '4.webp':
        'Dashboard de herramientas de auditoría de ciberseguridad WiFi mostrando interfaz profesional de análisis de redes inalámbricas con gráficos de señal, dispositivos conectados y métricas de seguridad',
      'favicon.svg':
        'Logo de WifiHackX - Herramientas de ciberseguridad inalámbrica',
    };

    if (altTexts[imageSrc]) {
      return altTexts[imageSrc];
    }

    // Generate contextual alt text based on filename and context
    const filename = imageSrc.split('/').pop().split('.')[0];
    const contextAlt = this.generateContextualAlt(filename, context);
    return contextAlt;
  },

  generateContextualAlt(filename, context) {
    const contexts = {
      dashboard: 'Captura de pantalla del panel de control administrativo',
      chart: 'Gráfico estadístico mostrando métricas y tendencias',
      user: 'Icono representativo de usuario o perfil',
      product: 'Imagen del producto o servicio ofrecido',
      wifi: 'Icono de señal WiFi indicando conectividad inalámbrica',
      security: 'Icono relacionado con seguridad y protección',
      admin: 'Interfaz de administración del sistema',
      catalog: 'Catálogo de productos y servicios disponibles',
    };

    const baseContext = contexts[context] || context || 'Imagen';
    return `${baseContext} - ${filename}`;
  },

  // Optimize image loading
  optimizeImages() {
    const images = document.querySelectorAll('img');

    images.forEach(img => {
      // Add WebP class for optimization
      img.classList.add('webp-optimized');

      // Ensure alt text is present
      if (!img.alt || img.alt.trim() === '') {
        const src = img.src || img.dataset.src || '';
        const context = img.dataset.context || this.detectContext(img);
        img.alt = this.getAltText(src, context);
      }

      // Add loading optimization
      if (!img.loading) {
        img.loading = 'lazy';
      }

      // Add error handling
      img.addEventListener('error', e => {
        this.handleImageError(e.target);
      });
    });
  },

  detectContext(img) {
    const parentClasses = img.parentElement?.className || '';
    const grandparentClasses =
      img.parentElement?.parentElement?.className || '';

    if (parentClasses.includes('banner') || parentClasses.includes('hero')) {
      return 'hero';
    }
    if (
      parentClasses.includes('chart') ||
      grandparentClasses.includes('chart')
    ) {
      return 'chart';
    }
    if (
      parentClasses.includes('product') ||
      grandparentClasses.includes('product')
    ) {
      return 'product';
    }
    if (parentClasses.includes('user') || grandparentClasses.includes('user')) {
      return 'user';
    }

    return 'general';
  },

  handleImageError(img) {
    // Replace broken images with appropriate fallbacks
    const fallbackIcon = this.getFallbackIcon(img);
    if (fallbackIcon) {
      const fallback = document.createElement('div');
      fallback.className = 'image-fallback';
      fallback.innerHTML = `<i data-lucide="${fallbackIcon}" aria-hidden="true"></i>`;
      fallback.setAttribute('aria-label', img.alt || 'Imagen no disponible');

      if (img.parentNode) {
        img.parentNode.replaceChild(fallback, img);
        // Reinitialize Lucide icons
        if (typeof lucide !== 'undefined') {
          lucide.createIcons({ nameAttr: 'data-lucide' });
        }
      }
    }
  },

  getFallbackIcon(img) {
    const _src = img.src || '';
    const context = img.dataset.context || 'general';

    const fallbacks = {
      hero: 'wifi',
      chart: 'bar-chart',
      product: 'package',
      user: 'user-circle',
      general: 'image',
    };

    return fallbacks[context] || 'image';
  },
};

// Breadcrumb Management
const BreadcrumbManager = {
  updateBreadcrumb(viewName, sectionName = '') {
    const breadcrumbList = document.getElementById('breadcrumbList');
    if (!breadcrumbList) return;

    // Clear existing breadcrumbs (except home)
    while (breadcrumbList.children.length > 1) {
      breadcrumbList.removeChild(breadcrumbList.lastChild);
    }

    // Add current view breadcrumb
    if (viewConfig[viewName]) {
      const listItem = document.createElement('li');
      listItem.className = 'breadcrumb-item';

      const link = document.createElement('a');
      link.href = '#';
      link.setAttribute('aria-label', `Ir a ${viewConfig[viewName].name}`);

      const icon = document.createElement('i');
      icon.setAttribute('data-lucide', viewConfig[viewName].icon);
      icon.setAttribute('aria-hidden', 'true');

      const span = document.createElement('span');
      span.textContent = viewConfig[viewName].name;

      link.appendChild(icon);
      link.appendChild(span);
      listItem.appendChild(link);
      breadcrumbList.appendChild(listItem);
    }

    // Add section breadcrumb for admin sections
    if (viewName === 'adminView' && sectionName) {
      const sectionConfig = {
        dashboard: { name: 'Dashboard', icon: 'bar-chart-3' },
        users: { name: 'Usuarios', icon: 'users' },
        products: { name: 'Productos', icon: 'package' },
        orders: { name: 'Pedidos', icon: 'shopping-bag' },
        analytics: { name: 'Analytics', icon: 'trending-up' },
        content: { name: 'Contenido', icon: 'edit' },
        announcements: { name: 'Anuncios', icon: 'megaphone' },
        settings: { name: 'Configuración', icon: 'settings' },
      };

      if (sectionConfig[sectionName]) {
        const listItem = document.createElement('li');
        listItem.className = 'breadcrumb-item';

        const link = document.createElement('a');
        link.href = '#';
        link.setAttribute(
          'aria-label',
          `Ir a ${sectionConfig[sectionName].name}`
        );

        const icon = document.createElement('i');
        icon.setAttribute('data-lucide', sectionConfig[sectionName].icon);
        icon.setAttribute('aria-hidden', 'true');

        const span = document.createElement('span');
        span.textContent = sectionConfig[sectionName].name;

        link.appendChild(icon);
        link.appendChild(span);
        listItem.appendChild(link);
        breadcrumbList.appendChild(listItem);
      }
    }

    // Reinitialize Lucide icons for breadcrumbs
    if (typeof lucide !== 'undefined') {
      lucide.createIcons({ nameAttr: 'data-lucide' });
    }
  },
};

// Auto-inicializar ImageManager cuando el DOM esté listo
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    if (ImageManager && ImageManager.optimizeImages) {
      ImageManager.optimizeImages();
    }
  });
} else {
  // DOM ya está listo
  if (ImageManager && ImageManager.optimizeImages) {
    ImageManager.optimizeImages();
  }
}

// Exponer globalmente
window.ImageManager = ImageManager;
window.BreadcrumbManager = BreadcrumbManager;
window.viewConfig = viewConfig;
