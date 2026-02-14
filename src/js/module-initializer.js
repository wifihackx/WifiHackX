/**
 * Module Initializer
 * Centralized system for managing module initialization with dependency resolution
 * Ensures modules load in correct order and dependencies are satisfied
 */

/* global performance */

'use strict';

function setupModuleInitializer() {

  class ModuleInitializer {
    constructor() {
      this.modules = new Map();
      this.initialized = new Set();
      this.dependencies = new Map();
      this.errors = new Map();
      this.initPromises = new Map();
    }

    /**
     * Register a module with its initialization function and dependencies
     * @param {string} name - Module name
     * @param {Function} initFn - Initialization function (can be async)
     * @param {string[]} dependencies - Array of module names this module depends on
     */
    register(name, initFn, dependencies = []) {
      if (this.modules.has(name)) {
        console.warn(
          `[ModuleInit] Module ${name} already registered, overwriting`
        );
      }

      this.modules.set(name, initFn);
      this.dependencies.set(name, dependencies);

      console.log(`[ModuleInit] Registered module: ${name}`, {
        dependencies: dependencies.length > 0 ? dependencies : 'none',
      });
    }

    /**
     * Initialize a specific module
     * @param {string} name - Module name to initialize
     * @returns {Promise<boolean>} True if initialization succeeded
     */
    async initialize(name) {
      // Check if already initialized
      if (this.initialized.has(name)) {
        console.log(`[ModuleInit] Module ${name} already initialized`);
        return true;
      }

      // Check if initialization is in progress
      if (this.initPromises.has(name)) {
        console.log(
          `[ModuleInit] Module ${name} initialization in progress, waiting...`
        );
        return await this.initPromises.get(name);
      }

      // Check if module is registered
      if (!this.modules.has(name)) {
        const error = new Error(`Module ${name} not registered`);
        console.error(`[ModuleInit] ${error.message}`);
        this.errors.set(name, error);
        return false;
      }

      // Create initialization promise
      const initPromise = this._initializeModule(name);
      this.initPromises.set(name, initPromise);

      const result = await initPromise;
      this.initPromises.delete(name);

      return result;
    }

    /**
     * Internal method to initialize a module with dependency resolution
     * @private
     */
    async _initializeModule(name) {
      try {
        console.log(`[ModuleInit] Initializing module: ${name}`);

        // Initialize dependencies in parallel
        const deps = this.dependencies.get(name) || [];
        if (deps.length > 0) {
          console.log(`[ModuleInit] Module ${name} has dependencies:`, deps);

          const depResults = await Promise.all(
            deps.map(dep => this.initialize(dep))
          );

          if (depResults.some(success => !success)) {
            const failedDeps = deps.filter((_, i) => !depResults[i]);
            throw new Error(
              `Dependencies [${failedDeps.join(', ')}] failed to initialize`
            );
          }

          console.log(`[ModuleInit] All dependencies for ${name} initialized`);
        }

        // Initialize the module
        const initFn = this.modules.get(name);
        const startTime = performance.now();

        await initFn();

        const duration = (performance.now() - startTime).toFixed(2);
        this.initialized.add(name);

        console.log(
          `[ModuleInit] Module ${name} initialized successfully (${duration}ms)`
        );
        return true;
      } catch (error) {
        console.error(`[ModuleInit] Failed to initialize ${name}:`, error);
        this.errors.set(name, error);

        // Don't throw - allow other modules to initialize
        return false;
      }
    }

    /**
     * Initialize all registered modules
     * @returns {Promise<Object>} Summary of initialization results
     */
    async initializeAll() {
      console.log(`[ModuleInit] Starting initialization of all modules...`);
      console.log(
        `[ModuleInit] Total modules registered: ${this.modules.size}`
      );

      const startTime = performance.now();
      const results = {
        total: this.modules.size,
        succeeded: 0,
        failed: 0,
        errors: [],
      };

      const moduleNames = Array.from(this.modules.keys());
      const initPromises = moduleNames.map(name => this.initialize(name));
      const resultsArray = await Promise.all(initPromises);

      resultsArray.forEach((success, index) => {
        const name = moduleNames[index];
        if (success) {
          results.succeeded++;
        } else {
          results.failed++;
          results.errors.push({
            module: name,
            error:
              (this.errors.get(name) && this.errors.get(name).message) ||
              'Unknown error',
          });
        }
      });

      const duration = (performance.now() - startTime).toFixed(2);

      console.log(`[ModuleInit] Initialization complete (${duration}ms)`, {
        total: results.total,
        succeeded: results.succeeded,
        failed: results.failed,
      });

      if (results.failed > 0) {
        console.error(
          `[ModuleInit] ${results.failed} module(s) failed to initialize:`,
          results.errors
        );
      }

      return results;
    }

    /**
     * Check if a module is initialized
     * @param {string} name - Module name
     * @returns {boolean} True if module is initialized
     */
    isInitialized(name) {
      return this.initialized.has(name);
    }

    /**
     * Get initialization error for a module
     * @param {string} name - Module name
     * @returns {Error|null} Error if module failed to initialize
     */
    getError(name) {
      return this.errors.get(name) || null;
    }

    /**
     * Get list of all registered modules
     * @returns {string[]} Array of module names
     */
    getRegisteredModules() {
      return Array.from(this.modules.keys());
    }

    /**
     * Get list of initialized modules
     * @returns {string[]} Array of initialized module names
     */
    getInitializedModules() {
      return Array.from(this.initialized);
    }

    /**
     * Get initialization status summary
     * @returns {Object} Status summary
     */
    getStatus() {
      return {
        registered: this.modules.size,
        initialized: this.initialized.size,
        failed: this.errors.size,
        pending: this.modules.size - this.initialized.size - this.errors.size,
      };
    }
  }

  // Create global instance
  window.ModuleInitializer = new ModuleInitializer();

  // Expose for debugging
  if (
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1'
  ) {
    window.moduleInitDebug = {
      getStatus: () => window.ModuleInitializer.getStatus(),
      getRegistered: () => window.ModuleInitializer.getRegisteredModules(),
      getInitialized: () => window.ModuleInitializer.getInitializedModules(),
      getErrors: () => {
        const errors = {};
        for (const [name, error] of window.ModuleInitializer.errors) {
          errors[name] = error.message;
        }
        return errors;
      },
    };
  }

  console.log('[ModuleInit] ModuleInitializer ready');
}

export function initModuleInitializer() {
  if (window.__MODULE_INITIALIZER_INITED__) {
    return;
  }

  window.__MODULE_INITIALIZER_INITED__ = true;
  setupModuleInitializer();
}

if (typeof window !== 'undefined' && !window.__MODULE_INITIALIZER_NO_AUTO__) {
  initModuleInitializer();
}
