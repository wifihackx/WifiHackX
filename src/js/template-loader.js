/**
 * TemplateLoader - Sistema de carga de componentes HTML reutilizables
 *
 * Este módulo proporciona una solución ligera para cargar componentes HTML
 * dinámicamente sin introducir dependencias adicionales.
 *
 * @module TemplateLoader
 * @version 1.0.0
 */

/**
 * @typedef {Object} ComponentRegistration
 * @property {string} name - Component identifier
 * @property {string} path - Path to component HTML file
 * @property {string} containerId - Target container element ID
 * @property {boolean} loaded - Whether component has been loaded
 * @property {string|null} cachedContent - Cached HTML content
 */

/**
 * Clase para gestionar la carga de componentes HTML reutilizables
 */
class TemplateLoader {
  constructor() {
    /** @type {Map<string, ComponentRegistration>} */
    this.components = new Map();

    /** @type {boolean} */
    this.loading = false;

    /** @type {string[]} */
    this.errors = [];

    /** @type {Map<string, string>} */
    this.cache = new Map();
  }

  /**
   * Registra un componente para ser cargado
   *
   * @param {string} name - Nombre identificador del componente
   * @param {string} path - Ruta al archivo HTML del componente
   * @param {string} containerId - ID del elemento contenedor donde se inyectará
   * @returns {TemplateLoader} - Retorna this para encadenamiento
   *
   * @example
   * templateLoader.register('header', '/components/header.html', 'header-container');
   */
  register(name, path, containerId) {
    if (!name || typeof name !== 'string') {
      throw new TypeError('Component name must be a non-empty string');
    }

    if (!path || typeof path !== 'string') {
      throw new TypeError('Component path must be a non-empty string');
    }

    if (!containerId || typeof containerId !== 'string') {
      throw new TypeError('Container ID must be a non-empty string');
    }

    this.components.set(name, {
      name,
      path,
      containerId,
      loaded: false,
      cachedContent: null,
    });

    return this;
  }

  /**
   * Carga un componente desde un archivo y lo inyecta en el contenedor
   *
   * @param {string} componentPath - Ruta al archivo HTML del componente
   * @param {string} containerId - ID del elemento contenedor
   * @param {boolean} [useCache=true] - Si debe usar contenido cacheado
   * @returns {Promise<void>}
   *
   * @throws {Error} Si el contenedor no existe o el componente no se puede cargar
   *
   * @example
   * await templateLoader.loadComponent('/components/header.html', 'header-container');
   */
  async loadComponent(componentPath, containerId, useCache = true) {
    // Verificar que el contenedor existe
    const container = document.getElementById(containerId);
    if (!container) {
      const error = `Container element with ID "${containerId}" not found`;
      this.errors.push(error);
      console.error(`[TemplateLoader] ${error}`);
      return;
    }

    try {
      let content;

      // Intentar usar cache si está habilitado
      if (useCache && this.cache.has(componentPath)) {
        content = this.cache.get(componentPath);
      } else {
        // Cargar el componente desde el servidor
        const response = await this._fetchWithRetry(componentPath);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        content = await response.text();

        // Guardar en cache
        this.cache.set(componentPath, content);
      }

      // Inyectar el contenido en el contenedor
      container.innerHTML = content;

      // Actualizar el registro si existe
      for (const [, component] of this.components) {
        if (
          component.path === componentPath &&
          component.containerId === containerId
        ) {
          component.loaded = true;
          component.cachedContent = content;
          break;
        }
      }
    } catch (error) {
      const errorMsg = `Failed to load component from "${componentPath}": ${error.message}`;
      this.errors.push(errorMsg);
      console.error(`[TemplateLoader] ${errorMsg}`);

      // Mostrar contenido de fallback si está disponible
      if (container) {
        const noscript = container.querySelector('noscript');
        if (noscript) {
          container.innerHTML = noscript.textContent;
        }
      }
    }
  }

  /**
   * Carga todos los componentes registrados
   *
   * @returns {Promise<void>}
   *
   * @example
   * await templateLoader.loadAll();
   */
  async loadAll() {
    if (this.loading) {
      console.warn('[TemplateLoader] Components are already loading');
      return;
    }

    this.loading = true;
    this.errors = [];

    try {
      // Cargar todos los componentes en paralelo
      const loadPromises = Array.from(this.components.values()).map(component =>
        this.loadComponent(component.path, component.containerId)
      );

      await Promise.all(loadPromises);

      if (this.errors.length > 0) {
        console.warn(
          `[TemplateLoader] Loaded with ${this.errors.length} error(s)`
        );
      } else {
        console.log('[TemplateLoader] All components loaded successfully');
      }
    } finally {
      this.loading = false;
    }
  }

  /**
   * Obtiene el estado de un componente registrado
   *
   * @param {string} name - Nombre del componente
   * @returns {ComponentRegistration|null} - Información del componente o null si no existe
   *
   * @example
   * const headerStatus = templateLoader.getComponentStatus('header');
   * if (headerStatus && headerStatus.loaded) {
   *   console.log('Header loaded successfully');
   * }
   */
  getComponentStatus(name) {
    return this.components.get(name) || null;
  }

  /**
   * Limpia el cache de componentes
   *
   * @param {string} [componentPath] - Ruta específica a limpiar, o undefined para limpiar todo
   *
   * @example
   * templateLoader.clearCache(); // Limpia todo el cache
   * templateLoader.clearCache('/components/header.html'); // Limpia solo el header
   */
  clearCache(componentPath) {
    if (componentPath) {
      this.cache.delete(componentPath);
    } else {
      this.cache.clear();
    }
  }

  /**
   * Recarga un componente específico
   *
   * @param {string} name - Nombre del componente a recargar
   * @returns {Promise<void>}
   *
   * @example
   * await templateLoader.reload('header');
   */
  async reload(name) {
    const component = this.components.get(name);
    if (!component) {
      console.warn(`[TemplateLoader] Component "${name}" not found`);
      return;
    }

    // Limpiar cache para forzar recarga
    this.clearCache(component.path);
    component.loaded = false;

    await this.loadComponent(component.path, component.containerId, false);
  }

  /**
   * Obtiene estadísticas del loader
   *
   * @returns {{total: number, loaded: number, errors: number, cached: number}}
   *
   * @example
   * const stats = templateLoader.getStats();
   * console.log(`Loaded ${stats.loaded}/${stats.total} components`);
   */
  getStats() {
    const total = this.components.size;
    const loaded = Array.from(this.components.values()).filter(
      c => c.loaded
    ).length;
    const errors = this.errors.length;
    const cached = this.cache.size;

    return { total, loaded, errors, cached };
  }

  /**
   * Realiza un fetch con reintentos automáticos
   *
   * @private
   * @param {string} url - URL a cargar
   * @param {number} [retries=1] - Número de reintentos
   * @param {number} [delay=1000] - Delay entre reintentos en ms
   * @returns {Promise<Response>}
   */
  async _fetchWithRetry(url, retries = 1, delay = 1000) {
    try {
      return await fetch(url);
    } catch (error) {
      if (retries > 0) {
        console.warn(
          `[TemplateLoader] Retrying fetch for "${url}" (${retries} attempts left)`
        );
        await new Promise(resolve => setTimeout(resolve, delay));
        return this._fetchWithRetry(url, retries - 1, delay);
      }
      throw error;
    }
  }
}

// Crear instancia global
if (typeof window !== 'undefined') {
  window.templateLoader = new TemplateLoader();

  // Exponer la clase para uso avanzado
  window.TemplateLoader = TemplateLoader;
}

